#!/usr/bin/env node
/**
 * Cognito に結合テスト用ユーザーを adminCreateUser で強制作成し、直後にパスワードを固定する。
 * MessageAction: SUPPRESS で招待メールは送らない。
 *
 * 使い方:
 *   cd apps/qr-attendance/backend
 *   npm run force-create-cognito-users
 *
 *   UserPoolId を引数で指定:
 *   node scripts/force-create-cognito-users.js ap-northeast-1_xxxxxxx
 *
 * 環境変数:
 *   USER_POOL_ID / COGNITO_USER_POOL_ID / NEXT_PUBLIC_COGNITO_USER_POOL_ID
 *   AWS_REGION / AWS_DEFAULT_REGION（既定 ap-northeast-1）
 *   COGNITO_FORCE_PASSWORD   最終パスワード（既定 TestPass12）
 *   COGNITO_FORCE_CREATE_EMAILS  カンマ区切りメール（未設定時は it-admin 等4件）
 *
 * 既にユーザーがいる場合は作成をスキップし、adminSetUserPassword のみ実行する。
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const {
  CognitoIdentityProviderClient,
  AdminCreateUserCommand,
  AdminSetUserPasswordCommand,
} = require('@aws-sdk/client-cognito-identity-provider');

const DEFAULT_FINAL_PASSWORD = 'TestPass12';

/** AdminCreateUser の一時パスワード（プールポリシー: 8文字以上・大小英字・数字）。直後に上書きする */
const TEMPORARY_PASSWORD_FOR_CREATE = 'Tmp9Aa' + crypto.randomBytes(4).toString('hex');

const DEFAULT_USERS = [
  { email: 'it-admin@example.com', name: '結合テスト管理者' },
  { email: 'it-staff@example.com', name: '結合テストスタッフ' },
  { email: 'it-user@example.com', name: '結合テスト利用者' },
  { email: 'it-dup@example.com', name: '重複登録テスト用' },
];

function parseEnvLine(line) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) return null;
  const eq = trimmed.indexOf('=');
  if (eq <= 0) return null;
  const key = trimmed.slice(0, eq).trim();
  const value = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
  return { key, value };
}

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  const content = fs.readFileSync(filePath, 'utf8');
  for (const line of content.split('\n')) {
    const parsed = parseEnvLine(line);
    if (!parsed) continue;
    if (process.env[parsed.key] === undefined || process.env[parsed.key] === '') {
      process.env[parsed.key] = parsed.value;
    }
  }
}

function getUserPoolId() {
  return (
    process.env.USER_POOL_ID ||
    process.env.COGNITO_USER_POOL_ID ||
    process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID ||
    ''
  ).trim();
}

function getRegion() {
  return (process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || 'ap-northeast-1').trim();
}

function getUserList() {
  if (process.env.COGNITO_FORCE_CREATE_EMAILS) {
    return process.env.COGNITO_FORCE_CREATE_EMAILS.split(',').map((e) => ({
      email: e.trim(),
      name: e.trim().split('@')[0] || 'user',
    }));
  }
  return DEFAULT_USERS;
}

async function main() {
  const backendRoot = path.join(__dirname, '..');
  loadEnvFile(path.join(backendRoot, '.env'));
  loadEnvFile(path.join(backendRoot, '..', 'frontend', '.env.local'));

  const argvPoolId = (process.argv[2] || '').trim();
  const userPoolId = argvPoolId || getUserPoolId();
  const region = getRegion();
  const finalPassword = (process.env.COGNITO_FORCE_PASSWORD || DEFAULT_FINAL_PASSWORD).trim();
  const users = getUserList().filter((u) => u.email);

  if (!userPoolId) {
    console.error(
      'USER_POOL_ID / COGNITO_USER_POOL_ID / NEXT_PUBLIC_COGNITO_USER_POOL_ID が未設定です。\n' +
        '引数で UserPoolId を渡すか .env を設定してください。'
    );
    process.exit(1);
  }

  if (finalPassword.length < 8) {
    console.error('COGNITO_FORCE_PASSWORD は8文字以上にしてください。');
    process.exit(1);
  }

  console.log('--- force-create-cognito-users ---');
  console.log('Region:', region);
  console.log('UserPoolId:', userPoolId);
  console.log('対象:', users.map((u) => u.email).join(', '));
  console.log('最終パスワード: （既定 TestPass12・ログに平文は出しません）');
  console.log('');

  const client = new CognitoIdentityProviderClient({ region });
  let failed = 0;

  for (const { email, name } of users) {
    try {
      try {
        await client.send(
          new AdminCreateUserCommand({
            UserPoolId: userPoolId,
            Username: email,
            UserAttributes: [
              { Name: 'email', Value: email },
              { Name: 'email_verified', Value: 'true' },
              { Name: 'name', Value: name },
            ],
            MessageAction: 'SUPPRESS',
            TemporaryPassword: TEMPORARY_PASSWORD_FOR_CREATE,
          })
        );
        console.log('[create]', email);
      } catch (e) {
        if (e.name === 'UsernameExistsException') {
          console.log('[exists]', email, '— 作成スキップ、パスワードのみ設定');
        } else {
          throw e;
        }
      }

      await client.send(
        new AdminSetUserPasswordCommand({
          UserPoolId: userPoolId,
          Username: email,
          Password: finalPassword,
          Permanent: true,
        })
      );
      console.log('[password]', email, 'Permanent OK');
    } catch (e) {
      failed += 1;
      console.error('[NG]', email, (e.name || 'Error') + ':', e.message || e);
    }
    console.log('');
  }

  if (failed > 0) {
    console.error(failed + ' 件が失敗しました。');
    process.exit(1);
  }
  console.log('完了。Cognito ログインは各メール + 設定したパスワード（既定: TestPass12）です。');
  console.log('DB の users 行も必要なら: npm run seed-test-users');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
