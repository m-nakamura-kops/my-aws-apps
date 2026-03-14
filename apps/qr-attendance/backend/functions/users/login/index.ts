/**
 * ユーザーログインLambda関数
 * POST /v1/users/login
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { CognitoIdentityProviderClient, InitiateAuthCommand } from '@aws-sdk/client-cognito-identity-provider';
import { getDB } from '../../../shared/db/connection';
import { initDBFromSecrets } from '../../../shared/db/secrets';
import { successResponse, errorResponse, corsResponse } from '../../../shared/utils/response';
import * as crypto from 'crypto';

const cognitoClient = new CognitoIdentityProviderClient({ region: process.env.AWS_REGION || 'ap-northeast-1' });
const userPoolId = process.env.USER_POOL_ID || '';
const cognitoClientId = process.env.COGNITO_CLIENT_ID || '';
const useCognito = !!(userPoolId && cognitoClientId);

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  // CORSプリフライトリクエスト対応
  if (event.httpMethod === 'OPTIONS') {
    return corsResponse();
  }

  try {
    // リクエストボディの解析
    if (!event.body) {
      return errorResponse('BAD_REQUEST', 'Request body is required', 400);
    }

    let email: string;
    let password: string;
    try {
      const body = JSON.parse(event.body);
      email = body?.email ?? '';
      password = body?.password ?? '';
    } catch {
      return errorResponse('BAD_REQUEST', 'Invalid JSON body', 400);
    }

    if (!email || !password) {
      return errorResponse('BAD_REQUEST', 'Email and password are required', 400);
    }

    // データベース接続を初期化
    await initDBFromSecrets();
    const db = getDB();

    // ユーザー情報を取得
    const [users] = await db.execute(
      'SELECT email, password, name_kanji, name_kana, org_id, role_flag FROM users WHERE email = ?',
      [email]
    ) as any[];

    if (users.length === 0) {
      return errorResponse('UNAUTHORIZED', 'Invalid email or password', 401);
    }

    const user = users[0];

    // 認証処理
    let authToken = '';
    let refreshToken = '';

    if (useCognito) {
      // Cognito認証を使用（本番環境）
      try {
        const authCommand = new InitiateAuthCommand({
          AuthFlow: 'USER_PASSWORD_AUTH',
          ClientId: cognitoClientId,
          AuthParameters: {
            USERNAME: email,
            PASSWORD: password,
          },
        });

        const authResponse = await cognitoClient.send(authCommand);

        if (!authResponse.AuthenticationResult) {
          return errorResponse('UNAUTHORIZED', 'Invalid credentials', 401);
        }

        authToken = authResponse.AuthenticationResult.IdToken || '';
        refreshToken = authResponse.AuthenticationResult.RefreshToken || '';
      } catch (cognitoError: any) {
        console.error('Cognito authentication error:', cognitoError);
        if (cognitoError.name === 'NotAuthorizedException' || cognitoError.name === 'UserNotFoundException') {
          return errorResponse('UNAUTHORIZED', 'Invalid email or password', 401);
        }
        throw cognitoError;
      }
    } else {
      // ローカル開発環境: データベースのパスワードで認証
      // パスワードのハッシュ化（SHA-256を使用、本番環境ではbcrypt推奨）
      const hashedPassword = crypto.createHash('sha256').update(password).digest('hex');

      if (user.password !== hashedPassword) {
        return errorResponse('UNAUTHORIZED', 'Invalid email or password', 401);
      }

      // ローカル開発用の簡易トークン生成（本番環境ではJWTを使用）
      const jwtSecret = process.env.JWT_SECRET || 'local-dev-secret';
      const tokenPayload = {
        email: user.email,
        roleFlag: user.role_flag,
        exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60), // 24時間有効
      };
      authToken = Buffer.from(JSON.stringify(tokenPayload)).toString('base64');
      refreshToken = Buffer.from(JSON.stringify({ ...tokenPayload, type: 'refresh' })).toString('base64');
    }

    // レスポンス
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

    // Cognito認証エラーの処理
    if (error.name === 'NotAuthorizedException' || error.name === 'UserNotFoundException') {
      return errorResponse('UNAUTHORIZED', 'Invalid email or password', 401);
    }

    // DB接続エラー（ローカルでMySQL未起動など）
    const code = error?.code ?? error?.errno;
    if (code === 'ECONNREFUSED' || code === 'ENOTFOUND' || code === 'ETIMEDOUT' || code === 'ER_ACCESS_DENIED_ERROR') {
      return errorResponse(
        'SERVICE_UNAVAILABLE',
        'Database connection failed. Ensure MySQL is running and DB_HOST/DB_USER/DB_PASSWORD/DB_NAME are set.',
        503,
        error.message
      );
    }

    // その他のエラー
    return errorResponse(
      'INTERNAL_ERROR',
      'An internal error occurred',
      500,
      error.message
    );
  }
};
