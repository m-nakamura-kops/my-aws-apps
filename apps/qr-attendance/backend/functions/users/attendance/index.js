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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = void 0;
const dayjs_1 = __importDefault(require("dayjs"));
const utc_1 = __importDefault(require("dayjs/plugin/utc"));
const timezone_1 = __importDefault(require("dayjs/plugin/timezone"));
const connection_1 = require('./shared/db/connection');
const secrets_1 = require('./shared/db/secrets');
const response_1 = require('./shared/utils/response');
const auth_1 = require('./shared/utils/auth');
const crypto = __importStar(require("crypto"));
dayjs_1.default.extend(utc_1.default);
dayjs_1.default.extend(timezone_1.default);
const TZ_TOKYO = 'Asia/Tokyo';
/** MySQL DATETIME として安全な形式（厳格） */
const MYSQL_DATETIME_RE = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/;
/**
 * JST の壁時計を `YYYY-MM-DD HH:mm:ss` で返す。
 * 空・不正・Invalid Date のときは再取得 → それでもダメなら UTC+9 のフォールバック。
 * out_time / in_time に空文字が入らないようにする。
 */
function nowJstMysqlDatetime() {
    const primary = (0, dayjs_1.default)().tz(TZ_TOKYO).format('YYYY-MM-DD HH:mm:ss');
    if (isValidMysqlDatetimeString(primary)) {
        return primary;
    }
    const retry = (0, dayjs_1.default)().tz(TZ_TOKYO).format('YYYY-MM-DD HH:mm:ss');
    if (isValidMysqlDatetimeString(retry)) {
        return retry;
    }
    const fallbackUtcPlus9 = dayjs_1.default.utc().add(9, 'hour').format('YYYY-MM-DD HH:mm:ss');
    if (isValidMysqlDatetimeString(fallbackUtcPlus9)) {
        return fallbackUtcPlus9;
    }
    const last = (0, dayjs_1.default)().format('YYYY-MM-DD HH:mm:ss');
    if (isValidMysqlDatetimeString(last)) {
        return last;
    }
    throw new Error('Failed to compute JST datetime for MySQL');
}
function isValidMysqlDatetimeString(s) {
    if (s === undefined || s === null || typeof s !== 'string')
        return false;
    const t = s.trim();
    if (t === '' || t.includes('Invalid'))
        return false;
    if (!MYSQL_DATETIME_RE.test(t))
        return false;
    const [datePart, timePart] = t.split(' ');
    if (!datePart || !timePart)
        return false;
    const [Y, M, D] = datePart.split('-').map((x) => parseInt(x, 10));
    const [h, m, sec] = timePart.split(':').map((x) => parseInt(x, 10));
    if (Number.isNaN(Y) ||
        Number.isNaN(M) ||
        Number.isNaN(D) ||
        Number.isNaN(h) ||
        Number.isNaN(m) ||
        Number.isNaN(sec)) {
        return false;
    }
    if (Y < 1970 || Y > 2100 || M < 1 || M > 12 || D < 1 || D > 31)
        return false;
    if (h > 23 || m > 59 || sec > 59)
        return false;
    return true;
}
/** UPDATE / INSERT 直前に必ず通す（空・undefined を絶対にバインドしない） */
function requireJstDatetimeForBind(candidate, label) {
    if (candidate !== undefined && candidate !== null && isValidMysqlDatetimeString(candidate)) {
        return candidate.trim();
    }
    const fresh = nowJstMysqlDatetime();
    if (!isValidMysqlDatetimeString(fresh)) {
        throw new Error(`Invalid datetime after refresh for ${label}`);
    }
    return fresh;
}
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
function rowType(latest) {
    if (!latest || latest.type == null)
        return '';
    const t = latest.type;
    if (typeof Buffer !== 'undefined' && Buffer.isBuffer(t)) {
        return t.toString('utf8').trim().toLowerCase();
    }
    return String(t).trim().toLowerCase();
}
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
 */
async function fetchOpenSessionRow(pool, userEmail, eventId) {
    return (0, connection_1.withConnection)(pool, async (conn) => {
        const [rows] = (await conn.execute(`SELECT log_id, in_time FROM attendance_logs
       WHERE email = ? AND event_id = ?
         AND in_time IS NOT NULL
         AND out_time IS NULL
       ORDER BY log_id DESC
       LIMIT 1`, [userEmail, eventId]));
        const r = rows[0];
        if (!r)
            return null;
        return { log_id: Number(r.log_id), in_time: r.in_time ?? null };
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
    const t = rowType(latest);
    if (t === 'exit') {
        const [enRows] = (await (0, connection_1.withConnection)(pool, async (conn) => conn.execute(`SELECT log_id, in_time FROM attendance_logs WHERE email = ? AND event_id = ? AND type = 'entry' ORDER BY log_id DESC LIMIT 1`, [userEmail, eventId])));
        const en = enRows[0];
        return {
            log_id: Number(latest.log_id),
            action: 'out',
            in_time: en?.in_time ?? null,
            out_time: latest.out_time,
            message: '退室打刻が完了しました',
        };
    }
    // entry / レガシー: out_time が埋まっていれば退室済み（UPDATE 済みで exit 行より log_id が小さい場合）
    if (!isOutTimeEmpty(latest.out_time)) {
        const [exRows] = (await (0, connection_1.withConnection)(pool, async (conn) => conn.execute(`SELECT log_id, out_time FROM attendance_logs WHERE email = ? AND event_id = ? AND type = 'exit' ORDER BY log_id DESC LIMIT 1`, [userEmail, eventId])));
        const ex = exRows[0];
        const [enRows] = (await (0, connection_1.withConnection)(pool, async (conn) => conn.execute(`SELECT log_id, in_time FROM attendance_logs WHERE email = ? AND event_id = ? AND type = 'entry' ORDER BY log_id DESC LIMIT 1`, [userEmail, eventId])));
        const en = enRows[0];
        return {
            log_id: ex ? Number(ex.log_id) : Number(latest.log_id),
            action: 'out',
            in_time: (en?.in_time ?? latest.in_time),
            out_time: (ex?.out_time ?? latest.out_time),
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
        const entryInTime = openSession.in_time;
        const outTimeForDb = requireJstDatetimeForBind(nowJstMysqlDatetime(), 'out_time (checkout UPDATE)');
        const conn = await pool.getConnection();
        try {
            await conn.beginTransaction();
            // 開いているセッション行のみ更新（in_time 必須・out_time NULL を再確認）
            const [upd] = (await conn.execute(`UPDATE attendance_logs
         SET out_time = ?, staff_email = ?, updated_at = CURRENT_TIMESTAMP
         WHERE log_id = ? AND email = ? AND event_id = ?
           AND in_time IS NOT NULL
           AND out_time IS NULL`, [outTimeForDb, staffEmailBound, entryLogId, userEmail, eventId]));
            if (upd.affectedRows === 0) {
                await conn.rollback();
                return punchEntryExitToggle(pool, userEmail, eventId, staffEmailBound, retryDepth + 1);
            }
            const outTimeInsert = requireJstDatetimeForBind(outTimeForDb, 'out_time (checkout INSERT exit row)');
            await conn.execute(`INSERT INTO attendance_logs (email, event_id, type, in_time, out_time, staff_email)
         VALUES (?, ?, 'exit', NULL, ?, ?)`, [userEmail, eventId, outTimeInsert, staffEmailBound]);
            await conn.commit();
            return {
                log_id: entryLogId,
                action: 'out',
                in_time: entryInTime,
                out_time: outTimeInsert,
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
    // 入室: in_time は DATETIME 文字列、out_time は SQL の NULL（プレースホルダは使わない）
    const inTimeForDb = requireJstDatetimeForBind(nowJstMysqlDatetime(), 'in_time (checkin INSERT)');
    try {
        return await (0, connection_1.withConnection)(pool, async (conn) => {
            const [result] = (await conn.execute(`INSERT INTO attendance_logs (email, event_id, type, in_time, out_time, staff_email)
         VALUES (?, ?, 'entry', ?, NULL, ?)`, [userEmail, eventId, inTimeForDb, staffEmailBound]));
            return {
                log_id: result.insertId,
                action: 'in',
                in_time: inTimeForDb,
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
