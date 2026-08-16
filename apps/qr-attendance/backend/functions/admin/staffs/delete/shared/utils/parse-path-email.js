"use strict";
/**
 * API Gateway の {email} パスパラメータを、users.email（主キー）照合用文字列へ正規化する。
 *
 * 手順（この順が必須）:
 * 1. decodeURIComponent を繰り返し適用し、二重 URL エンコード（例: %2540）を解く
 * 2. その後に前後の空白を除去（半角・改行、U+00A0 NBSP、U+3000 全角スペース、U+FEFF BOM、各種 Zs 相当）
 * 3. 最後に String.prototype.trim()（残りのホワイトスペース）
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseEmailPathParamForDb = parseEmailPathParamForDb;
const OUTER_SPACE_RUN = /^[\u0009-\u000D\u0020\u0085\u00A0\u1680\u2000-\u200A\u2028\u2029\u202F\u205F\u3000]+|[\u0009-\u000D\u0020\u0085\u00A0\u1680\u2000-\u200A\u2028\u2029\u202F\u205F\u3000]+$/;
function parseEmailPathParamForDb(raw) {
    if (raw == null || raw === '') {
        return { ok: false, reason: 'empty_raw' };
    }
    let s = raw;
    for (let i = 0; i < 5; i++) {
        try {
            const decoded = decodeURIComponent(s);
            if (decoded === s) {
                break;
            }
            s = decoded;
        }
        catch {
            return { ok: false, reason: 'decodeURIComponent_error' };
        }
    }
    let t = s.replace(/^\uFEFF+/, '');
    for (let g = 0; g < 32; g++) {
        const next = t.replace(OUTER_SPACE_RUN, '');
        if (next === t) {
            break;
        }
        t = next;
    }
    t = t.trim();
    if (!t) {
        return { ok: false, reason: 'empty_after_normalize' };
    }
    return { ok: true, email: t };
}
