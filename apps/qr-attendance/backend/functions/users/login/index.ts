/**
 * ユーザーログインLambda関数
 * POST /v1/users/login
 *
 * Cognito 認証を正とし、DB 欠落時は Cognito 情報から自動補完する。
 * 逆に DB のみ存在する場合は Cognito ユーザーを自動作成してから認証する。
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getDB, withConnection } from '../../../shared/db/connection';
import { initDBFromSecrets } from '../../../shared/db/secrets';
import { successResponse, errorResponse, corsResponse } from '../../../shared/utils/response';
import {
  ensureCognitoUserFromDbCredentials,
  ensureDbUserFromCognitoAuth,
  findDbUser,
  getCognitoClientId,
  getUserPoolId,
  hashPasswordSha256,
  initiateUserPasswordAuth,
} from '../../../shared/utils/cognito-db-sync';
import * as crypto from 'crypto';

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  if (event.httpMethod === 'OPTIONS') {
    return corsResponse();
  }

  const userPoolId = getUserPoolId();
  const cognitoClientId = getCognitoClientId();
  const useCognito = !!(userPoolId && cognitoClientId);

  console.log('[login] useCognito=', useCognito, {
    USER_POOL_ID_set: Boolean(userPoolId),
    COGNITO_CLIENT_ID_set: Boolean(cognitoClientId),
  });

  try {
    if (!event.body) {
      return errorResponse('BAD_REQUEST', 'Request body is required', 400);
    }

    let email: string;
    let password: string;
    try {
      const body = JSON.parse(event.body);
      email = String(body?.email ?? '').trim();
      password = body?.password ?? '';
    } catch {
      return errorResponse('BAD_REQUEST', 'Invalid JSON body', 400);
    }

    if (!email || !password) {
      return errorResponse('BAD_REQUEST', 'Email and password are required', 400);
    }

    await initDBFromSecrets();
    const pool = getDB();

    let authToken = '';
    let refreshToken = '';
    let user = await withConnection(pool, async (conn) => findDbUser(conn, email));

    if (useCognito) {
      try {
        let authResponse = await initiateUserPasswordAuth(email, password);

        if (authResponse.ChallengeName === 'NEW_PASSWORD_REQUIRED') {
          if (!user) {
            user = await withConnection(pool, async (conn) =>
              ensureDbUserFromCognitoAuth(conn, email, { role_flag: 1 })
            );
          }
          return successResponse({
            challengeName: 'NEW_PASSWORD_REQUIRED',
            session: authResponse.Session,
            email,
            userName: user.name_kanji || email,
            roleFlag: user.role_flag || 1,
          });
        }

        if (!authResponse.AuthenticationResult) {
          return errorResponse('UNAUTHORIZED', 'Invalid credentials', 401);
        }

        authToken = authResponse.AuthenticationResult.IdToken || '';
        refreshToken = authResponse.AuthenticationResult.RefreshToken || '';

        // Cognito 成功 → DB が無ければ自動作成
        if (!user) {
          console.log('[login] Cognito OK but DB missing; auto-creating users row for', email);
          user = await withConnection(pool, async (conn) =>
            ensureDbUserFromCognitoAuth(conn, email, { role_flag: 1 })
          );
        }
      } catch (cognitoError: any) {
        console.error('Cognito authentication error:', cognitoError);

        // Cognito に居ない / パスワード不一致だが、DB のハッシュが一致する場合は Cognito を補完
        if (
          cognitoError.name === 'UserNotFoundException' ||
          cognitoError.name === 'NotAuthorizedException'
        ) {
          if (!user) {
            return errorResponse('UNAUTHORIZED', 'Invalid email or password', 401);
          }

          const hashedPassword = hashPasswordSha256(password);
          const dbPasswordMatches = user.password === hashedPassword;
          if (!dbPasswordMatches) {
            // 招待ユーザー（DB はプレースホルダ）で Cognito 未作成のケースは
            // 任意パスワードでの Cognito 作成を許さない
            return errorResponse('UNAUTHORIZED', 'Invalid email or password', 401);
          }

          try {
            console.log('[login] healing Cognito from DB credentials for', email);
            await ensureCognitoUserFromDbCredentials({
              email,
              password,
              name: user.name_kanji || email,
            });
            const retry = await initiateUserPasswordAuth(email, password);
            if (retry.ChallengeName === 'NEW_PASSWORD_REQUIRED') {
              return successResponse({
                challengeName: 'NEW_PASSWORD_REQUIRED',
                session: retry.Session,
                email,
                userName: user.name_kanji || email,
                roleFlag: user.role_flag || 1,
              });
            }
            if (!retry.AuthenticationResult) {
              return errorResponse('UNAUTHORIZED', 'Invalid email or password', 401);
            }
            authToken = retry.AuthenticationResult.IdToken || '';
            refreshToken = retry.AuthenticationResult.RefreshToken || '';
          } catch (healErr: any) {
            console.error('[login] Cognito heal failed:', healErr);
            return errorResponse('UNAUTHORIZED', 'Invalid email or password', 401);
          }
        } else {
          throw cognitoError;
        }
      }
    } else {
      // ローカル開発: DB ハッシュ比較
      if (!user) {
        return errorResponse('UNAUTHORIZED', 'Invalid email or password', 401);
      }
      const hashedPassword = crypto.createHash('sha256').update(password).digest('hex');
      if (user.password !== hashedPassword) {
        return errorResponse('UNAUTHORIZED', 'Invalid email or password', 401);
      }
      const tokenPayload = {
        email: user.email,
        roleFlag: user.role_flag,
        exp: Math.floor(Date.now() / 1000) + 24 * 60 * 60,
      };
      authToken = Buffer.from(JSON.stringify(tokenPayload)).toString('base64');
      refreshToken = Buffer.from(
        JSON.stringify({ ...tokenPayload, type: 'refresh' })
      ).toString('base64');
    }

    if (!user) {
      return errorResponse('UNAUTHORIZED', 'Invalid email or password', 401);
    }

    return successResponse({
      token: authToken,
      refreshToken: refreshToken,
      userId: email,
      userName: user.name_kanji || email,
      orgId: user.org_id,
      roleFlag: user.role_flag || 1,
    });
  } catch (error: any) {
    console.error('Login error:', error);

    if (error.name === 'NotAuthorizedException' || error.name === 'UserNotFoundException') {
      return errorResponse('UNAUTHORIZED', 'Invalid email or password', 401);
    }

    const code = error?.code ?? error?.errno;
    const msg = error?.message ?? '';
    if (
      code === 'ECONNREFUSED' ||
      code === 'ENOTFOUND' ||
      code === 'ETIMEDOUT' ||
      code === 'ER_ACCESS_DENIED_ERROR'
    ) {
      return errorResponse(
        'SERVICE_UNAVAILABLE',
        'Database connection failed. Ensure MySQL is running and DB_HOST/DB_USER/DB_PASSWORD/DB_NAME are set.',
        503,
        error.message
      );
    }
    if (
      code === 'ER_CON_COUNT_ERROR' ||
      (typeof msg === 'string' && msg.includes('Too many connections'))
    ) {
      return errorResponse(
        'SERVICE_UNAVAILABLE',
        'Database is busy (too many connections). Please retry in a moment.',
        503,
        error.message
      );
    }

    return errorResponse(
      'INTERNAL_ERROR',
      'An internal error occurred',
      500,
      error.message
    );
  }
};
