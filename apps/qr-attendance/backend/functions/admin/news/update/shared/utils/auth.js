"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getUserEmailFromRequest = getUserEmailFromRequest;
exports.getUserRoleFlag = getUserRoleFlag;
exports.checkStaffOrAdminPermission = checkStaffOrAdminPermission;
const connection_1 = require("../db/connection");
const role_check_1 = require("./role-check");
function getUserEmailFromRequest(event) {
    const authHeader = event.headers.Authorization || event.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        try {
            const token = authHeader.substring(7).trim();
            const parts = token.split('.');
            if (parts.length >= 2) {
                const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
                if (payload.email) return payload.email;
            }
            const payload = JSON.parse(Buffer.from(token, 'base64').toString());
            if (payload.email) return payload.email;
        } catch (e) {}
    }
    if (event.queryStringParameters?.email) return event.queryStringParameters.email;
    if (event.body) {
        try {
            const body = JSON.parse(event.body);
            if (body.email) return body.email;
        } catch (e) {}
    }
    return null;
}
async function getUserRoleFlag(email) {
    try {
        const db = (0, connection_1.getDB)();
        const [users] = await db.execute('SELECT role_flag FROM users WHERE email = ?', [String(email || '')]);
        if (users.length === 0) return null;
        return users[0].role_flag ?? null;
    } catch (e) {
        return null;
    }
}
async function checkStaffOrAdminPermission(event) {
    try {
        const email = getUserEmailFromRequest(event);
        if (!email) {
            return { authorized: false, email: null, error: 'Authentication required.' };
        }
        const roleFlag = await getUserRoleFlag(email);
        const roleNum = roleFlag != null ? Number(roleFlag) : null;
        if (!(0, role_check_1.isStaffOrAdmin)(roleNum)) {
            return { authorized: false, email, error: 'Staff or admin access required.' };
        }
        return { authorized: true, email };
    } catch (e) {
        return { authorized: false, email: null, error: 'Permission check failed.' };
    }
}
