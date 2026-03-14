/**
 * Secrets Managerからデータベース認証情報を取得
 */

import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';
import { getDBConfig, initDB } from './connection';

const secretsManager = new SecretsManagerClient({
  region: process.env.AWS_REGION || 'ap-northeast-1',
});

let dbInitialized = false;

/**
 * Secrets Managerから認証情報を取得してDB接続を初期化
 * ローカル開発環境では環境変数から直接接続を初期化
 */
export async function initDBFromSecrets(): Promise<void> {
  if (dbInitialized) {
    return;
  }

  const secretArn = process.env.DB_SECRET_ARN;
  
  // ローカル開発環境: DB_SECRET_ARNが設定されていない場合は環境変数から直接接続
  if (!secretArn) {
    console.log('DB_SECRET_ARN not set, using environment variables for local development');
    const config = getDBConfig();
    initDB(config);
    dbInitialized = true;
    return;
  }

  // AWS環境: Secrets Managerから認証情報を取得
  try {
    const command = new GetSecretValueCommand({ SecretId: secretArn });
    const response = await secretsManager.send(command);
    
    if (!response.SecretString) {
      throw new Error('Secret string is empty');
    }

    const secret = JSON.parse(response.SecretString);
    const dbHost = process.env.DB_HOST || '';
    const dbPort = parseInt(process.env.DB_PORT || '3306', 10);
    const dbName = process.env.DB_NAME || 'qr_attendance';

    initDB({
      host: dbHost,
      port: dbPort,
      user: secret.username,
      password: secret.password,
      database: dbName,
      ssl: process.env.DB_SSL === 'true',
    });

    dbInitialized = true;
  } catch (error) {
    console.error('Failed to initialize DB from Secrets Manager:', error);
    throw error;
  }
}
