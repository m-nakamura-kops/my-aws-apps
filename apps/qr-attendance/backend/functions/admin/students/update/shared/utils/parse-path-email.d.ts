/**
 * API Gateway の {email} パスパラメータを、users.email（主キー）照合用文字列へ正規化する。
 *
 * 手順（この順が必須）:
 * 1. decodeURIComponent を繰り返し適用し、二重 URL エンコード（例: %2540）を解く
 * 2. その後に前後の空白を除去（半角・改行、U+00A0 NBSP、U+3000 全角スペース、U+FEFF BOM、各種 Zs 相当）
 * 3. 最後に String.prototype.trim()（残りのホワイトスペース）
 */
export type ParsePathEmailResult = {
    ok: true;
    email: string;
} | {
    ok: false;
    reason: string;
};
export declare function parseEmailPathParamForDb(raw: string | undefined | null): ParsePathEmailResult;
