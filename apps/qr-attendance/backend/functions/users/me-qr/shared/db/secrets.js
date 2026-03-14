"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.initDBFromSecrets = initDBFromSecrets;
const connection_1 = require("./connection");
let dbInitialized = false;
async function initDBFromSecrets() {
    if (dbInitialized) return;
    const secretArn = process.env.DB_SECRET_ARN;
    if (!secretArn) {
        const config = (0, connection_1.getDBConfig)();
        (0, connection_1.initDB)(config);
        dbInitialized = true;
        return;
    }
    const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');
    const client = new SecretsManagerClient({ region: process.env.AWS_REGION || 'ap-northeast-1' });
    const res = await client.send(new GetSecretValueCommand({ SecretId: secretArn }));
    const secret = JSON.parse(res.SecretString || '{}');
    (0, connection_1.initDB)({
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT || '3306', 10),
        user: secret.username,
        password: secret.password,
        database: process.env.DB_NAME || 'qr_attendance',
        ssl: process.env.DB_SSL === 'true',
    });
    dbInitialized = true;
}
