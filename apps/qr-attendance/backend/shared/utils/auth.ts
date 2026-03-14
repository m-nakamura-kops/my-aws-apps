/**
 * 認証・権限チェックユーティリティ
 */

import { APIGatewayProxyEvent } from 'aws-lambda';
import { getDB } from '../db/connection';
import { isAdmin, isStaffOrAdmin } from './role-check';

/** 権限チェック結果（成功） */
export interface PermissionOk {
  authorized: true;
  email: string;
  roleFlag: number;
}

/** 権限チェック結果（失敗） */
export interface PermissionDenied {
  authorized: false;
  email: string | null;
  error: string;
  statusCode: 401 | 403;
}

export type StaffOrAdminPermissionResult = PermissionOk | PermissionDenied;

/**
 * リクエストからユーザーemailを取得
 * 優先順位: Authorizationヘッダー（JWT または ローカル用 base64 JSON） > クエリパラメータ > リクエストボディ
 */
export function getUserEmailFromRequest(event: APIGatewayProxyEvent): string | null {
  const authHeader = event.headers.Authorization || event.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    try {
      const token = authHeader.substring(7).trim();
      // JWT形式（3部分）: payload は2番目の部分
      const parts = token.split('.');
      if (parts.length >= 2) {
        const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
        if (payload.email) return payload.email;
      }
      // ローカル開発用: トークン全体が base64 の JSON（email を含む）
      const payload = JSON.parse(Buffer.from(token, 'base64').toString());
      if (payload.email) return payload.email;
    } catch (e) {
      // トークンの解析に失敗した場合は無視
    }
  }

  // クエリパラメータから取得
  if (event.queryStringParameters?.email) {
    return event.queryStringParameters.email;
  }

  // リクエストボディから取得
  if (event.body) {
    try {
      const body = JSON.parse(event.body);
      if (body.email) {
        return body.email;
      }
    } catch (e) {
      // ボディの解析に失敗した場合は無視
    }
  }

  return null;
}

/**
 * ユーザーのrole_flagを取得
 */
export async function getUserRoleFlag(email: string): Promise<number | null> {
  const db = getDB();
  const [users] = await db.execute(
    'SELECT role_flag FROM users WHERE email = ?',
    [email]
  ) as any[];

  if (users.length === 0) {
    return null;
  }

  return users[0].role_flag || null;
}

/**
 * 管理者権限チェック
 */
export async function checkAdminPermission(event: APIGatewayProxyEvent): Promise<{ authorized: boolean; email: string | null; error?: string }> {
  const email = getUserEmailFromRequest(event);
  
  if (!email) {
    return {
      authorized: false,
      email: null,
      error: 'User email is required. Please provide email in query parameter or Authorization header.',
    };
  }

  const roleFlag = await getUserRoleFlag(email);
  
  if (!isAdmin(roleFlag)) {
    return {
      authorized: false,
      email,
      error: 'Admin access required. Only administrators can access this resource.',
    };
  }

  return {
    authorized: true,
    email,
  };
}

/**
 * スタッフまたは管理者権限チェック
 * 他エンドポイントで使い回すための共通関数。認証なし→401、権限不足→403。
 */
export async function checkStaffOrAdminPermission(event: APIGatewayProxyEvent): Promise<StaffOrAdminPermissionResult> {
  const email = getUserEmailFromRequest(event);
  if (!email) {
    return {
      authorized: false,
      email: null,
      error: 'Authentication required',
      statusCode: 401,
    };
  }
  const roleFlag = await getUserRoleFlag(email);
  if (!isStaffOrAdmin(roleFlag)) {
    return {
      authorized: false,
      email,
      error: 'Staff or Admin access required',
      statusCode: 403,
    };
  }
  return {
    authorized: true,
    email,
    roleFlag: roleFlag!,
  };
}
