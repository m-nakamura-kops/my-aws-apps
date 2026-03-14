/**
 * 生徒削除Lambda関数
 * DELETE /v1/admin/students/{email}
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { CognitoIdentityProviderClient, AdminDeleteUserCommand } from '@aws-sdk/client-cognito-identity-provider';
import { getDB } from '../../../../shared/db/connection';
import { initDBFromSecrets } from '../../../../shared/db/secrets';
import { successResponse, errorResponse, corsResponse } from '../../../../shared/utils/response';
import { checkAdminPermission } from '../../../../shared/utils/auth';

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
    // 管理者権限チェック
    await initDBFromSecrets();
    const permissionCheck = await checkAdminPermission(event);
    if (!permissionCheck.authorized) {
      return errorResponse('FORBIDDEN', permissionCheck.error || 'Admin access required', 403);
    }

    // パスパラメータからemailを取得
    const email = event.pathParameters?.email;
    if (!email) {
      return errorResponse('BAD_REQUEST', 'email is required', 400);
    }

    // データベース接続を取得
    const db = getDB();

    // ユーザーの存在確認（role_flag = 1: 生徒であることを確認）
    const [existingUsers] = await db.execute(
      'SELECT email, role_flag FROM users WHERE email = ?',
      [email]
    ) as any[];

    if (existingUsers.length === 0) {
      return errorResponse('NOT_FOUND', 'Student not found', 404);
    }

    if (existingUsers[0].role_flag !== 1) {
      return errorResponse('BAD_REQUEST', 'User is not a student', 400);
    }

    // データベースから削除（CASCADEにより関連するregistrationsとattendance_logsも削除される）
    await db.execute('DELETE FROM users WHERE email = ?', [email]);

    // Cognitoからも削除（オプション）
    try {
      if (userPoolId) {
        await cognitoClient.send(new AdminDeleteUserCommand({
          UserPoolId: userPoolId,
          Username: email,
        }));
      }
    } catch (cognitoError: any) {
      console.error('Cognito user deletion error:', cognitoError);
      // Cognitoのエラーは無視して続行（データベースからは削除済み）
    }

    return successResponse({
      message: 'Student deleted successfully',
      email: email,
    });
  } catch (error: any) {
    console.error('Delete student error:', error);

    // 外部キー制約エラーの処理
    if (error.code === 'ER_ROW_IS_REFERENCED_2') {
      return errorResponse(
        'CONFLICT',
        'Cannot delete student because there are related records (attendance logs, etc.)',
        409
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
