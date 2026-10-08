"use strict";
/**
 * 利用規約・プライバシーポリシー同意
 * POST /v1/users/terms-accept
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = void 0;
const connection_1 = require("./shared/db/connection");
const secrets_1 = require("./shared/db/secrets");
const response_1 = require("./shared/utils/response");
const auth_1 = require("./shared/utils/auth");

const handler = async (event) => {
    if (event.httpMethod === "OPTIONS") {
        return (0, response_1.corsResponse)();
    }
    try {
        const email = (0, auth_1.getUserEmailFromRequest)(event);
        if (!email) {
            return (0, response_1.errorResponse)("UNAUTHORIZED", "Authentication required", 401);
        }
        await (0, secrets_1.initDBFromSecrets)();
        const db = (0, connection_1.getDB)();
        const [users] = await db.execute(
            "SELECT email, role_flag, terms_accepted_at FROM users WHERE email = ?",
            [email]
        );
        if (users.length === 0) {
            return (0, response_1.errorResponse)("NOT_FOUND", "User not found", 404);
        }
        await db.execute(
            `UPDATE users
             SET terms_accepted_at = NOW(), updated_at = CURRENT_TIMESTAMP
             WHERE email = ? AND terms_accepted_at IS NULL`,
            [email]
        );
        const [updated] = await db.execute(
            "SELECT terms_accepted_at FROM users WHERE email = ? LIMIT 1",
            [email]
        );
        const raw = updated[0] && updated[0].terms_accepted_at;
        let termsAcceptedAt = null;
        if (raw != null && raw !== "") {
            termsAcceptedAt = String(raw)
                .replace("T", " ")
                .replace(/\.\d+/, "")
                .replace(/[zZ]|[+-]\d{2}:?\d{2}$/, "")
                .trim();
            if (!termsAcceptedAt || termsAcceptedAt.startsWith("0000-00-00")) {
                termsAcceptedAt = null;
            }
        }
        return (0, response_1.successResponse)({
            email,
            terms_accepted_at: termsAcceptedAt,
            status: "accepted",
        });
    }
    catch (error) {
        console.error("Accept terms error:", error);
        return (0, response_1.errorResponse)(
            "INTERNAL_ERROR",
            "An internal error occurred",
            500,
            error.message
        );
    }
};
exports.handler = handler;
