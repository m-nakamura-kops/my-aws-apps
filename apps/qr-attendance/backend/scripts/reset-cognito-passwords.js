#!/usr/bin/env node
/**
 * Cognito ユーザーのパスワードを AdminSetUserPassword で強制上書きする（コンソール不要）
 *
 * 使い方:
 *   cd apps/qr-attendance/backend
 *   npm run reset-cognito-passwords
 *
 *   第1引数で UserPoolId を直指定しても可:
 *   node scripts/reset-cognito-passwords.js ap-northeast-1_xxxxxxx
 *
 *   パスワードだけ変える:
 *   COGNITO_RESET_PASSWORD='YourPass1' npm run reset-cognito-passwords
 *
 * 前提:
 *   - AWS CLI と同じ認証情報（環境変数・~/.aws/credentials 等）
 *   - ユーザープール ID を環境変数で渡す（いずれか）
 *       USER_POOL_ID / COGNITO_USER_POOL_ID / NEXT_PUBLIC_COGNITO_USER_POOL_ID
 *   - リージョン: AWS_REGION / AWS_DEFAULT_REGION（既定 ap-northeast-1）
 *
 * 読み込む .env（存在するものだけ、未設定のキーのみ補完）:
 *   - backend/.env
 *   - ../frontend/.env.local
 *
 * 環境変数:
 *   COGNITO_RESET_PASSWORD  平文（既定 TestPass12）
 *   COGNITO_RESET_EMAILS     カンマ区切り（既定 it-admin,it-staff,it-user,it-dup @example.com）
 */

const fs = require('fs');
const path = require('path');
const {
  CognitoIdentityProviderClient,
  AdminSetUserPasswordCommand,
} = require('@aws-sdk/client-cognito-identity-provider');

const DEFAULT_PASSWORD = 'TestPass12';

const DEFAULT_EMAILS = [
  'it-admin@example.com',
  'it-staff@example.com',
  'it-user@example.com',
  'it-dup@example.com',
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

/** 未設定のキーだけ埋める（先に読んだファイルを優先） */
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

function getEmails() {
  if (process.env.COGNITO_RESET_EMAILS) {
    return process.env.COGNITO_RESET_EMAILS.split(',')
      .map((e) => e.trim())
      .filter(Boolean);
  }
  return DEFAULT_EMAILS;
}

async function main() {
  const backendRoot = path.join(__dirname, '..');
  loadEnvFile(path.join(backendRoot, '.env'));
  loadEnvFile(path.join(backendRoot, '..', 'frontend', '.env.local'));

  const argvPoolId = (process.argv[2] || '').trim();
  const userPoolId = argvPoolId || getUserPoolId();
  const region = getRegion();
  const password = (process.env.COGNITO_RESET_PASSWORD || DEFAULT_PASSWORD).trim();
  const emails = getEmails();

  if (!userPoolId) {
    console.error(
      'USER_POOL_ID / COGNITO_USER_POOL_ID / NEXT_PUBLIC_COGNITO_USER_POOL_ID が未設定です。\n' +
        'backend/.env または frontend/.env.local にユーザープール ID を設定してください。'
    );
    process.exit(1);
  }

  if (password.length < 8) {
    console.error('パスワードは8文字以上にしてください（Cognito ポリシー）。');
    process.exit(1);
  }

  console.log('--- reset-cognito-passwords ---');
  console.log('Region:', region);
  console.log('UserPoolId:', userPoolId);
  console.log('対象:', emails.join(', '));
  console.log('新パスワード長:', password.length, '文字（平文はログに出しません）');
  console.log('');

  const client = new CognitoIdentityProviderClient({ region });

  let failed = 0;
  for (const email of emails) {
    try {
      await client.send(
        new AdminSetUserPasswordCommand({
          UserPoolId: userPoolId,
          Username: email,
          Password: password,
          Permanent: true,
        })
      );
      console.log('[OK]', email);
    } catch (e) {
      failed += 1;
      const name = e.name || 'Error';
      const msg = e.message || String(e);
      console.error('[NG]', email, name + ':', msg);
      if (name === 'UserNotFoundException') {
        console.error('     → Cognito にユーザーがいません。招待作成が必要です（スタッフ招待 API 等）。');
      }
      if (name === 'InvalidPasswordException') {
        console.error('     → ユーザープールのパスワードポリシーを満たしていません。COGNITO_RESET_PASSWORD を変更してください。');
      }
      if (name === 'AccessDeniedException' || name === 'UnauthorizedOperation') {
        console.error('     → IAM に cognito-idp:AdminSetUserPassword が必要です。');
      }
    }
  }

  console.log('');
  if (failed > 0) {
    console.error(failed + ' 件が失敗しました。');
    process.exit(1);
  }
  console.log('完了。ログインはメール + 設定したパスワード（既定: TestPass12）で試してください。');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
