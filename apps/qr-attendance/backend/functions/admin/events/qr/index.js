"use strict";
/**
 * QRコード生成Lambda関数
 * GET /v1/admin/events/{eventId}/qr
 */
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
const handler = async (event) => {
    // CORSプリフライトリクエスト対応
    if (event.httpMethod === 'OPTIONS') {
        return (0, response_1.corsResponse)();
    }
    try {
        // 管理者権限チェック
        await (0, secrets_1.initDBFromSecrets)();
        const permissionCheck = await (0, auth_1.checkAdminPermission)(event);
        if (!permissionCheck.authorized) {
            return (0, response_1.errorResponse)('FORBIDDEN', permissionCheck.error || 'Admin access required', 403);
        }
        // パスパラメータからeventIdを取得
        const eventId = event.pathParameters?.eventId;
        if (!eventId) {
            return (0, response_1.errorResponse)('BAD_REQUEST', 'eventId is required', 400);
        }
        // データベース接続を取得（既に初期化済み）
        const db = (0, connection_1.getDB)();
        // イベントの存在確認
        const [events] = await db.execute('SELECT * FROM events WHERE event_id = ?', [eventId]);
        if (events.length === 0) {
            return (0, response_1.errorResponse)('NOT_FOUND', 'Event not found', 404);
        }
        const eventData = events[0];
        // QRコードデータを生成（イベントIDとシークレットキーを含む）
        // 本番環境では、より安全な方法でシークレットを管理する必要があります
        const secretKey = process.env.QR_SECRET_KEY || 'default-secret-key-change-in-production';
        const timestamp = Date.now();
        const qrData = {
            event_id: parseInt(eventId, 10),
            event_name: eventData.event_name,
            timestamp: timestamp,
        };
        // データをJSON文字列化してBase64エンコード
        const qrDataString = JSON.stringify(qrData);
        const qrCodeData = Buffer.from(qrDataString).toString('base64');
        // 署名を生成（改ざん防止のため）
        const signature = crypto
            .createHmac('sha256', secretKey)
            .update(qrCodeData)
            .digest('hex');
        // QRコード用のURLを生成（フロントエンドでスキャン時に使用）
        // APIエンドポイントのURLにデータと署名を含める
        const region = process.env.AWS_REGION || 'ap-northeast-1';
        const apiId = process.env.API_ID || 'xcv8usy3dh'; // API GatewayのID（環境変数から取得）
        const apiBaseUrl = `https://${apiId}.execute-api.${region}.amazonaws.com/prod`;
        const qrCodeUrl = `${apiBaseUrl}/v1/users/attendance?data=${encodeURIComponent(qrCodeData)}&sig=${signature}`;
        return (0, response_1.successResponse)({
            event_id: parseInt(eventId, 10),
            event_name: eventData.event_name,
            qr_code_data: qrCodeData,
            qr_code_url: qrCodeUrl,
            signature: signature,
            expires_at: new Date(timestamp + 24 * 60 * 60 * 1000).toISOString(), // 24時間有効
        });
    }
    catch (error) {
        console.error('Generate QR code error:', error);
        return (0, response_1.errorResponse)('INTERNAL_ERROR', 'An internal error occurred', 500, error.message);
    }
};
exports.handler = handler;
