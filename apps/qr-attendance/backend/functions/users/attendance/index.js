"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = void 0;
const connection_1 = require('./shared/db/connection');
const secrets_1 = require('./shared/db/secrets');
const response_1 = require('./shared/utils/response');
const auth_1 = require('./shared/utils/auth');
const crypto = __importStar(require("crypto"));
/**
 * 同一ユーザー・イベントで、この秒数以内の連続スキャンは「同じ1回のスキャン」とみなす。
 * カメラが同じQRを複数フレームで読む／利用者QRが更新されて debounce が効かない場合の
 * 「入室した直後に即退室」「退室した直後に再入室」を防ぐ。
 */
const DEDUP_WINDOW_SECONDS = 15;
/** VARCHAR 系プレースホルダ用（undefined でプレースホルダがずれないよう常に文字列） */
function requireNonEmptyString(value, label) {
    const s = value === undefined || value === null ? '' : String(value).trim();
    if (s === '') {
        throw new Error(`Missing required string for SQL bind: ${label}`);
    }
    return s;
}
const USER_QR_VALID_MS = 10 * 60 * 1000;
const QR_CLOCK_SKEW_MS = 60 * 1000;
function isOutTimeEmpty(out) {
    if (out == null || out === '')
        return true;
    if (out instanceof Date)
        return false;
    const s = String(out).trim();
    return s === '' || s === 'null' || s.startsWith('0000-00-00');
}
async function fetchLatestAttendanceRow(pool, userEmail, eventId) {
    return (0, connection_1.withConnection)(pool, async (conn) => {
        const [rows] = (await conn.execute('SELECT * FROM attendance_logs WHERE email = ? AND event_id = ? ORDER BY log_id DESC LIMIT 1', [userEmail, eventId]));
        return rows[0];
    });
}
/**
 * 当該イベント・ユーザーで「入室済み（in_time あり）かつ未退室（out_time NULL）」の行を1件取得。
 * 最新行の type に依存せず、開いているセッションのみ退室対象とする（初回が退室になる誤判定を防ぐ）。
 * 経過秒は DB の NOW() で算出し、Lambda 側の時計と混ぜない。
 */
async function fetchOpenSessionRow(pool, userEmail, eventId) {
    return (0, connection_1.withConnection)(pool, async (conn) => {
        const [rows] = (await conn.execute(`SELECT log_id, in_time, TIMESTAMPDIFF(SECOND, in_time, NOW()) AS in_age_seconds
       FROM attendance_logs
       WHERE email = ? AND event_id = ?
         AND in_time IS NOT NULL
         AND out_time IS NULL
       ORDER BY log_id DESC
       LIMIT 1`, [userEmail, eventId]));
        const r = rows[0];
        if (!r)
            return null;
        return {
            log_id: Number(r.log_id),
            in_time: r.in_time ?? null,
            in_age_seconds: Number(r.in_age_seconds ?? 0),
        };
    });
}
/** 直近の「退室済み」行を1件取得（退室直後の重複スキャンで新規入室 INSERT を防ぐため） */
async function fetchLatestClosedSessionRow(pool, userEmail, eventId) {
    return (0, connection_1.withConnection)(pool, async (conn) => {
        const [rows] = (await conn.execute(`SELECT log_id, in_time, out_time, TIMESTAMPDIFF(SECOND, out_time, NOW()) AS out_age_seconds
       FROM attendance_logs
       WHERE email = ? AND event_id = ?
         AND out_time IS NOT NULL
       ORDER BY log_id DESC
       LIMIT 1`, [userEmail, eventId]));
        const r = rows[0];
        if (!r)
            return null;
        return {
            log_id: Number(r.log_id),
            in_time: r.in_time ?? null,
            out_time: r.out_time ?? null,
            out_age_seconds: Number(r.out_age_seconds ?? 0),
        };
    });
}
/** 書き込み後の確定値を DB から読み直す（JST 文字列のまま返す） */
async function fetchRowById(pool, logId) {
    return (0, connection_1.withConnection)(pool, async (conn) => {
        const [rows] = (await conn.execute('SELECT in_time, out_time FROM attendance_logs WHERE log_id = ? LIMIT 1', [logId]));
        const r = rows[0];
        if (!r)
            return null;
        return { in_time: r.in_time ?? null, out_time: r.out_time ?? null };
    });
}
async function ensureRegistrationForWalkIn(pool, userEmail, eventId) {
    await (0, connection_1.withConnection)(pool, async (conn) => {
        const [existing] = (await conn.execute('SELECT reg_id FROM registrations WHERE email = ? AND event_id = ? LIMIT 1', [userEmail, eventId]));
        if (existing.length > 0)
            return;
        try {
            await conn.execute('INSERT INTO registrations (email, event_id) VALUES (?, ?)', [userEmail, eventId]);
        }
        catch (e) {
            const c = e?.code ?? e?.errno;
            if (c === 'ER_DUP_ENTRY' || c === 1062)
                return;
            throw e;
        }
    });
}
function isDup(e) {
    const c = e?.code ?? e?.errno;
    return c === 'ER_DUP_ENTRY' || c === 1062;
}
/** DB 現在状態からレスポンスを組み立てる（冪等） */
async function punchResultFromDbState(pool, userEmail, eventId) {
    const latest = await fetchLatestAttendanceRow(pool, userEmail, eventId);
    if (!latest) {
        throw new Error('No attendance row after punch');
    }
    if (!isOutTimeEmpty(latest.out_time)) {
        return {
            log_id: Number(latest.log_id),
            action: 'out',
            in_time: latest.in_time ?? null,
            out_time: latest.out_time,
            message: '退室打刻が完了しました',
        };
    }
    return {
        log_id: Number(latest.log_id),
        action: 'in',
        in_time: latest.in_time ?? null,
        message: '入室打刻が完了しました',
    };
}
async function punchEntryExitToggle(pool, userEmail, eventId, staffEmail, retryDepth = 0) {
    if (retryDepth > 5) {
        throw new Error('Attendance punch retry limit exceeded');
    }
    const openSession = await fetchOpenSessionRow(pool, userEmail, eventId);
    const staffEmailBound = requireNonEmptyString(staffEmail, 'staff_email');
    if (openSession) {
        const entryLogId = openSession.log_id;
        // 入室直後（または in_time が未来にズレている）場合は同一スキャンの重複とみなし、退室にしない
        if (openSession.in_age_seconds < DEDUP_WINDOW_SECONDS) {
            return {
                log_id: entryLogId,
                action: 'in',
                in_time: openSession.in_time,
                message: '入室打刻が完了しました',
            };
        }
        const conn = await pool.getConnection();
        try {
            await conn.beginTransaction();
            // 開いているセッション行のみ更新。in_time は絶対に書き換えない。
            // out_time は GREATEST(NOW(), in_time) で必ず in_time 以降になり、逆転しない。
            const [upd] = (await conn.execute(`UPDATE attendance_logs
         SET out_time = GREATEST(NOW(), in_time), staff_email = ?, updated_at = CURRENT_TIMESTAMP
         WHERE log_id = ? AND email = ? AND event_id = ?
           AND in_time IS NOT NULL
           AND out_time IS NULL`, [staffEmailBound, entryLogId, userEmail, eventId]));
            if (upd.affectedRows === 0) {
                // 並行リクエストが先に閉じた場合は DB の現在状態を返す（新規 INSERT はしない）
                await conn.rollback();
                return punchResultFromDbState(pool, userEmail, eventId);
            }
            await conn.commit();
            const saved = await fetchRowById(pool, entryLogId);
            return {
                log_id: entryLogId,
                action: 'out',
                in_time: saved?.in_time ?? openSession.in_time,
                out_time: saved?.out_time ?? null,
                message: '退室打刻が完了しました',
            };
        }
        catch (e) {
            try {
                await conn.rollback();
            }
            catch (_) { }
            if (isDup(e)) {
                return punchResultFromDbState(pool, userEmail, eventId);
            }
            throw e;
        }
        finally {
            conn.release();
        }
    }
    // 退室直後の重複スキャンでは新しい入室行を作らず、直前の退室結果を返す
    const latestClosed = await fetchLatestClosedSessionRow(pool, userEmail, eventId);
    if (latestClosed && latestClosed.out_age_seconds < DEDUP_WINDOW_SECONDS) {
        return {
            log_id: latestClosed.log_id,
            action: 'out',
            in_time: latestClosed.in_time,
            out_time: latestClosed.out_time,
            message: '退室打刻が完了しました',
        };
    }
    // 入室: in_time も DB の NOW()（JST）を使い、Lambda 側の時計は使わない
    try {
        return await (0, connection_1.withConnection)(pool, async (conn) => {
            const [result] = (await conn.execute(`INSERT INTO attendance_logs (email, event_id, type, in_time, out_time, staff_email)
         VALUES (?, ?, 'entry', NOW(), NULL, ?)`, [userEmail, eventId, staffEmailBound]));
            const logId = Number(result.insertId);
            const [rows] = (await conn.execute('SELECT in_time FROM attendance_logs WHERE log_id = ? LIMIT 1', [logId]));
            return {
                log_id: logId,
                action: 'in',
                in_time: rows[0]?.in_time ?? null,
                message: '入室打刻が完了しました',
            };
        });
    }
    catch (e) {
        if (isDup(e)) {
            return punchResultFromDbState(pool, userEmail, eventId);
        }
        throw e;
    }
}
const handler = async (event) => {
    if (event.httpMethod === 'OPTIONS') {
        return (0, response_1.corsResponse)();
    }
    try {
        if (!event.body) {
            return (0, response_1.errorResponse)('BAD_REQUEST', 'Request body is required', 400);
        }
        const body = JSON.parse(event.body);
        const qrData = body.qr_code_data || body.data;
        const signature = body.signature || body.sig;
        const eventIdParam = body.event_id;
        if (!qrData || !signature) {
            return (0, response_1.errorResponse)('BAD_REQUEST', 'qr_code_data and signature are required', 400);
        }
        const secretKey = process.env.QR_SECRET_KEY || 'default-secret-key-change-in-production';
        const expectedSignature = crypto.createHmac('sha256', secretKey).update(qrData).digest('hex');
        if (signature !== expectedSignature) {
            return (0, response_1.errorResponse)('UNAUTHORIZED', 'Invalid QR code signature', 401);
        }
        let qrCodeInfo;
        try {
            const decodedData = Buffer.from(qrData, 'base64').toString('utf8');
            qrCodeInfo = JSON.parse(decodedData);
        }
        catch (err) {
            return (0, response_1.errorResponse)('BAD_REQUEST', 'Invalid QR code data format', 400);
        }
        await (0, secrets_1.initDBFromSecrets)();
        const db = (0, connection_1.getDB)();
        if (qrCodeInfo.email != null && eventIdParam != null) {
            const userEmail = String(qrCodeInfo.email);
            const qrTimestamp = Number(qrCodeInfo.timestamp);
            const eventId = typeof eventIdParam === 'number' ? eventIdParam : parseInt(String(eventIdParam), 10);
            const now = Date.now();
            const qrAge = now - qrTimestamp;
            if (qrAge > USER_QR_VALID_MS || qrAge < -QR_CLOCK_SKEW_MS) {
                return (0, response_1.errorResponse)('BAD_REQUEST', 'QR code has expired. Please show the latest QR again.', 400);
            }
            const staffPermission = await (0, auth_1.checkStaffOrAdminPermission)(event);
            if (!staffPermission.authorized) {
                return (0, response_1.errorResponse)(staffPermission.statusCode === 401 ? 'UNAUTHORIZED' : 'FORBIDDEN', staffPermission.error, staffPermission.statusCode);
            }
            const staffEmail = String(staffPermission.email ?? '').trim();
            if (!staffEmail) {
                return (0, response_1.errorResponse)('UNAUTHORIZED', 'Staff email missing from token', 401);
            }
            const [events] = (await (0, connection_1.withConnection)(db, async (conn) => conn.execute('SELECT * FROM events WHERE event_id = ?', [eventId])));
            if (events.length === 0) {
                return (0, response_1.errorResponse)('NOT_FOUND', 'Event not found', 404);
            }
            const [users] = (await (0, connection_1.withConnection)(db, async (conn) => conn.execute('SELECT * FROM users WHERE email = ?', [userEmail])));
            if (users.length === 0) {
                return (0, response_1.errorResponse)('NOT_FOUND', 'User not found', 404);
            }
            await ensureRegistrationForWalkIn(db, userEmail, eventId);
            const punch = await punchEntryExitToggle(db, userEmail, eventId, staffEmail);
            return (0, response_1.successResponse)(punch);
        }
        const eventId = qrCodeInfo.event_id;
        const qrTimestamp = qrCodeInfo.timestamp;
        const userEmail = body.email;
        if (eventId == null || qrTimestamp == null || !userEmail) {
            return (0, response_1.errorResponse)('BAD_REQUEST', 'Invalid request. For staff scan: send qr_code_data, signature, and event_id with staff Authorization. For user QR: show QR from "My QR" page and let staff scan it.', 400);
        }
        const now = Date.now();
        const qrAge = now - qrTimestamp;
        if (qrAge > 24 * 60 * 60 * 1000) {
            return (0, response_1.errorResponse)('BAD_REQUEST', 'QR code has expired', 400);
        }
        const [events] = (await (0, connection_1.withConnection)(db, async (conn) => conn.execute('SELECT * FROM events WHERE event_id = ?', [eventId])));
        if (events.length === 0) {
            return (0, response_1.errorResponse)('NOT_FOUND', 'Event not found', 404);
        }
        const [users] = (await (0, connection_1.withConnection)(db, async (conn) => conn.execute('SELECT * FROM users WHERE email = ?', [userEmail])));
        if (users.length === 0) {
            return (0, response_1.errorResponse)('NOT_FOUND', 'User not found', 404);
        }
        await ensureRegistrationForWalkIn(db, userEmail, eventId);
        const punch = await punchEntryExitToggle(db, userEmail, eventId, userEmail);
        return (0, response_1.successResponse)(punch);
    }
    catch (error) {
        console.error('Attendance punch error:', error);
        return (0, response_1.errorResponse)('INTERNAL_ERROR', 'An internal error occurred', 500, error.message);
    }
};
exports.handler = handler;
