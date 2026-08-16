/**
 * Cognito と DB(users) の同期ヘルパー
 * 招待・登録・ログインで Cognito のみ / DB のみ の片側欠落を防ぐ。
 */

import {
  CognitoIdentityProviderClient,
  AdminCreateUserCommand,
  AdminDeleteUserCommand,
  AdminGetUserCommand,
  AdminSetUserPasswordCommand,
  AdminUpdateUserAttributesCommand,
  AdminConfirmSignUpCommand,
  SignUpCommand,
  InitiateAuthCommand,
  MessageActionType,
} from '@aws-sdk/client-cognito-identity-provider';
import * as crypto from 'crypto';
import type { PoolConnection } from 'mysql2/promise';

const region = process.env.AWS_REGION || 'ap-northeast-1';

export function getCognitoClient(): CognitoIdentityProviderClient {
  return new CognitoIdentityProviderClient({ region });
}

export function getUserPoolId(): string {
  return process.env.USER_POOL_ID || '';
}

export function getCognitoClientId(): string {
  return process.env.COGNITO_CLIENT_ID || '';
}

export function isCognitoConfigured(): boolean {
  return Boolean(getUserPoolId());
}

export function randomPlaceholderPasswordHash(): string {
  const raw = crypto.randomBytes(32).toString('hex');
  return crypto.createHash('sha256').update(raw).digest('hex');
}

export function hashPasswordSha256(password: string): string {
  return crypto.createHash('sha256').update(password).digest('hex');
}

export type DbUserRow = {
  email: string;
  password: string;
  name_kanji: string | null;
  name_kana: string | null;
  tel: string | null;
  org_id: string | null;
  role_flag: number;
  remarks?: string | null;
};

export async function findDbUser(conn: PoolConnection, email: string): Promise<DbUserRow | null> {
  const [rows] = (await conn.execute(
    'SELECT email, password, name_kanji, name_kana, tel, org_id, role_flag, remarks FROM users WHERE email = ?',
    [email]
  )) as any[];
  return rows[0] || null;
}

export async function upsertDbUser(
  conn: PoolConnection,
  params: {
    email: string;
    passwordHash: string;
    name_kanji: string;
    name_kana: string;
    tel: string;
    org_id?: string | null;
    remarks?: string | null;
    role_flag: number;
    /** 既存ユーザーの role を強制更新するか（スタッフ招待で 2 にする等） */
    forceRole?: boolean;
  }
): Promise<{ created: boolean }> {
  const existing = await findDbUser(conn, params.email);
  if (existing) {
    if (params.forceRole && existing.role_flag !== params.role_flag) {
      await conn.execute(
        `UPDATE users SET role_flag = ?, password = ?, name_kanji = COALESCE(?, name_kanji), name_kana = COALESCE(?, name_kana), tel = COALESCE(?, tel), org_id = COALESCE(?, org_id), remarks = COALESCE(?, remarks) WHERE email = ?`,
        [
          params.role_flag,
          params.passwordHash,
          params.name_kanji || null,
          params.name_kana || null,
          params.tel || null,
          params.org_id ?? null,
          params.remarks ?? null,
          params.email,
        ]
      );
    } else {
      await conn.execute(
        `UPDATE users SET password = ?, name_kanji = COALESCE(?, name_kanji), name_kana = COALESCE(?, name_kana), tel = COALESCE(?, tel), org_id = COALESCE(?, org_id), remarks = COALESCE(?, remarks) WHERE email = ?`,
        [
          params.passwordHash,
          params.name_kanji || null,
          params.name_kana || null,
          params.tel || null,
          params.org_id ?? null,
          params.remarks ?? null,
          params.email,
        ]
      );
    }
    return { created: false };
  }

  await conn.execute(
    `INSERT INTO users (email, password, name_kanji, name_kana, tel, org_id, role_flag, remarks)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      params.email,
      params.passwordHash,
      params.name_kanji || '',
      params.name_kana || '',
      params.tel || '',
      params.org_id ?? null,
      params.role_flag,
      params.remarks ?? null,
    ]
  );
  return { created: true };
}

export async function deleteDbUser(conn: PoolConnection, email: string): Promise<void> {
  await conn.execute('DELETE FROM users WHERE email = ?', [email]);
}

/**
 * 招待用: Cognito にユーザーを作成（仮パスワードメール送信）。
 * 既存なら属性更新のみ（再招待は呼び出し側で Reset を判断）。
 */
export async function ensureCognitoInvitedUser(params: {
  email: string;
  name?: string;
  resendInviteIfExists?: boolean;
}): Promise<{ created: boolean; invitationSent: boolean; message: string }> {
  const userPoolId = getUserPoolId();
  if (!userPoolId) {
    throw new Error('USER_POOL_ID is not configured');
  }
  const client = getCognitoClient();
  const displayName = (params.name || '').trim() || params.email;

  try {
    await client.send(
      new AdminCreateUserCommand({
        UserPoolId: userPoolId,
        Username: params.email,
        UserAttributes: [
          { Name: 'email', Value: params.email },
          { Name: 'email_verified', Value: 'true' },
          { Name: 'name', Value: displayName },
        ],
        DesiredDeliveryMediums: ['EMAIL'],
      })
    );
    return {
      created: true,
      invitationSent: true,
      message: '招待メールを送信しました（仮パスワード）',
    };
  } catch (err: any) {
    if (err?.name !== 'UsernameExistsException') {
      throw err;
    }

    try {
      await client.send(
        new AdminUpdateUserAttributesCommand({
          UserPoolId: userPoolId,
          Username: params.email,
          UserAttributes: [
            { Name: 'email', Value: params.email },
            { Name: 'email_verified', Value: 'true' },
            { Name: 'name', Value: displayName },
          ],
        })
      );
    } catch (attrErr) {
      console.warn('AdminUpdateUserAttributes failed:', attrErr);
    }

    if (params.resendInviteIfExists) {
      // 既存ユーザーへ仮パスワードを再発行して招待メール相当を送る
      await client.send(
        new AdminCreateUserCommand({
          UserPoolId: userPoolId,
          Username: params.email,
          MessageAction: MessageActionType.RESEND,
          DesiredDeliveryMediums: ['EMAIL'],
        })
      );
      return {
        created: false,
        invitationSent: true,
        message: '既存ユーザーに招待メールを再送しました',
      };
    }

    return {
      created: false,
      invitationSent: false,
      message: 'Cognito ユーザーは既に存在します',
    };
  }
}

export async function deleteCognitoUser(email: string): Promise<void> {
  const userPoolId = getUserPoolId();
  if (!userPoolId) return;
  const client = getCognitoClient();
  try {
    await client.send(
      new AdminDeleteUserCommand({
        UserPoolId: userPoolId,
        Username: email,
      })
    );
  } catch (err: any) {
    if (err?.name !== 'UserNotFoundException') {
      console.warn('AdminDeleteUser failed:', err);
    }
  }
}

/** セルフ登録: Cognito SignUp + 必要なら自動確認 */
export async function ensureCognitoSelfRegisteredUser(params: {
  email: string;
  password: string;
  name?: string;
}): Promise<{ created: boolean }> {
  const userPoolId = getUserPoolId();
  const clientId = getCognitoClientId();
  if (!userPoolId || !clientId) {
    throw new Error('USER_POOL_ID / COGNITO_CLIENT_ID is not configured');
  }
  const client = getCognitoClient();

  try {
    await client.send(
      new SignUpCommand({
        ClientId: clientId,
        Username: params.email,
        Password: params.password,
        UserAttributes: [
          { Name: 'email', Value: params.email },
          ...(params.name ? [{ Name: 'name', Value: params.name }] : []),
        ],
      })
    );
  } catch (err: any) {
    if (err?.name === 'UsernameExistsException') {
      throw Object.assign(new Error('User already exists'), { name: 'UsernameExistsException' });
    }
    throw err;
  }

  // 招待フローと同様、メール確認待ちでログイン不能にならないよう確認する
  try {
    await client.send(
      new AdminConfirmSignUpCommand({
        UserPoolId: userPoolId,
        Username: params.email,
      })
    );
  } catch (confirmErr: any) {
    // 既に確認済み等は無視
    console.warn('AdminConfirmSignUp:', confirmErr?.name || confirmErr);
  }

  try {
    await client.send(
      new AdminUpdateUserAttributesCommand({
        UserPoolId: userPoolId,
        Username: params.email,
        UserAttributes: [{ Name: 'email_verified', Value: 'true' }],
      })
    );
  } catch (attrErr) {
    console.warn('email_verified update failed:', attrErr);
  }

  return { created: true };
}

export async function getCognitoUserAttributes(
  email: string
): Promise<Record<string, string> | null> {
  const userPoolId = getUserPoolId();
  if (!userPoolId) return null;
  const client = getCognitoClient();
  try {
    const res = await client.send(
      new AdminGetUserCommand({
        UserPoolId: userPoolId,
        Username: email,
      })
    );
    const attrs: Record<string, string> = {};
    for (const a of res.UserAttributes || []) {
      if (a.Name && a.Value != null) attrs[a.Name] = a.Value;
    }
    return attrs;
  } catch (err: any) {
    if (err?.name === 'UserNotFoundException') return null;
    throw err;
  }
}

/**
 * Cognito 認証成功後に DB 行が無ければ作成する。
 */
export async function ensureDbUserFromCognitoAuth(
  conn: PoolConnection,
  email: string,
  opts?: { name_kanji?: string; role_flag?: number }
): Promise<DbUserRow> {
  const existing = await findDbUser(conn, email);
  if (existing) return existing;

  let name = opts?.name_kanji || '';
  let tel = '';
  try {
    const attrs = await getCognitoUserAttributes(email);
    if (attrs) {
      name = name || attrs.name || attrs.email || email;
      tel = attrs.phone_number || '';
    }
  } catch (e) {
    console.warn('getCognitoUserAttributes during DB heal:', e);
  }

  const passwordHash = randomPlaceholderPasswordHash();
  try {
    await conn.execute(
      `INSERT INTO users (email, password, name_kanji, name_kana, tel, org_id, role_flag, remarks)
       VALUES (?, ?, ?, ?, ?, NULL, ?, ?)`,
      [
        email,
        passwordHash,
        name || email,
        name || email,
        tel || '00000000000',
        opts?.role_flag ?? 1,
        'auto-synced from Cognito on login',
      ]
    );
  } catch (err: any) {
    if (err?.code === 'ER_DUP_ENTRY') {
      const again = await findDbUser(conn, email);
      if (again) return again;
    }
    throw err;
  }
  const created = await findDbUser(conn, email);
  if (!created) {
    throw new Error('Failed to auto-create DB user from Cognito');
  }
  return created;
}

/**
 * DB のみ存在するユーザー向け: Cognito に恒久パスワードでユーザーを作成する。
 */
export async function ensureCognitoUserFromDbCredentials(params: {
  email: string;
  password: string;
  name?: string;
}): Promise<void> {
  const userPoolId = getUserPoolId();
  if (!userPoolId) {
    throw new Error('USER_POOL_ID is not configured');
  }
  const client = getCognitoClient();
  const displayName = (params.name || '').trim() || params.email;

  const existing = await getCognitoUserAttributes(params.email);
  if (!existing) {
    try {
      await client.send(
        new AdminCreateUserCommand({
          UserPoolId: userPoolId,
          Username: params.email,
          TemporaryPassword: params.password,
          MessageAction: MessageActionType.SUPPRESS,
          UserAttributes: [
            { Name: 'email', Value: params.email },
            { Name: 'email_verified', Value: 'true' },
            { Name: 'name', Value: displayName },
          ],
        })
      );
    } catch (err: any) {
      if (err?.name !== 'UsernameExistsException') throw err;
    }
  }

  await client.send(
    new AdminSetUserPasswordCommand({
      UserPoolId: userPoolId,
      Username: params.email,
      Password: params.password,
      Permanent: true,
    })
  );
}

export async function initiateUserPasswordAuth(email: string, password: string) {
  const clientId = getCognitoClientId();
  if (!clientId) {
    throw new Error('COGNITO_CLIENT_ID is not configured');
  }
  const client = getCognitoClient();
  return client.send(
    new InitiateAuthCommand({
      AuthFlow: 'USER_PASSWORD_AUTH',
      ClientId: clientId,
      AuthParameters: {
        USERNAME: email,
        PASSWORD: password,
      },
    })
  );
}
