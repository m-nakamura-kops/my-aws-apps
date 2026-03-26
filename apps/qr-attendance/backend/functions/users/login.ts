/**
 * ユーザーログインLambda関数
 * POST /v1/users/login
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { CognitoIdentityProviderClient, InitiateAuthCommand, AdminGetUserCommand } from '@aws-sdk/client-cognito-identity-provider';
import { getDB, withConnection } from '../../shared/db/connection';
import { initDBFromSecrets } from '../../shared/db/secrets';
import { successResponse, errorResponse, corsResponse } from '../../shared/utils/response';

const cognitoClient = new CognitoIdentityProviderClient({ region: process.env.AWS_REGION || 'ap-northeast-1' });
const userPoolId = process.env.USER_POOL_ID || '';

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

    const { email, password } = JSON.parse(event.body);

    if (!email || !password) {
      return errorResponse('BAD_REQUEST', 'Email and password are required', 400);
    }

    // Cognitoで認証
    const authCommand = new InitiateAuthCommand({
      AuthFlow: 'USER_PASSWORD_AUTH',
      ClientId: process.env.COGNITO_CLIENT_ID,
      AuthParameters: {
        USERNAME: email,
        PASSWORD: password,
      },
    });

    const authResponse = await cognitoClient.send(authCommand);

    if (!authResponse.AuthenticationResult) {
      return errorResponse('UNAUTHORIZED', 'Invalid credentials', 401);
    }

    // ユーザー情報を取得
    const getUserCommand = new AdminGetUserCommand({
      UserPoolId: userPoolId,
      Username: email,
    });

    const userResponse = await cognitoClient.send(getUserCommand);

    // データベース接続を初期化
    await initDBFromSecrets();
    const pool = getDB();
    const [users] = (await withConnection(pool, async (conn) =>
      conn.execute('SELECT email, name_kanji, name_kana, org_id FROM users WHERE email = ?', [email])
    )) as any[];

    const userArray = users as any[];
    let userName = email;
    let orgId = null;

    if (userArray.length > 0) {
      userName = userArray[0].name_kanji;
      orgId = userArray[0].org_id;
    }

    // レスポンス
    return successResponse({
      token: authResponse.AuthenticationResult.IdToken,
      refreshToken: authResponse.AuthenticationResult.RefreshToken,
      userId: email,
      userName: userName,
      orgId: orgId,
    });
  } catch (error: any) {
    console.error('Login error:', error);
    
    if (error.name === 'NotAuthorizedException') {
      return errorResponse('UNAUTHORIZED', 'Invalid email or password', 401);
    }

    return errorResponse(
      'INTERNAL_ERROR',
      'An internal error occurred',
      500,
      error.message
    );
  }
};
