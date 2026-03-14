/**
 * 生徒一括登録Lambda関数（CSVインポート・管理者用）
 * POST /v1/admin/students/import
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getDB } from '../../../../shared/db/connection';
import { initDBFromSecrets } from '../../../../shared/db/secrets';
import { successResponse, errorResponse, corsResponse } from '../../../../shared/utils/response';
import { checkAdminPermission } from '../../../../shared/utils/auth';
import { validateEmail, validatePassword } from '../../../../shared/utils/validation';
import { parseCSVLine, isHeaderRow } from '../../../../shared/utils/csv';
import * as crypto from 'crypto';


export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  if (event.httpMethod === 'OPTIONS') {
    return corsResponse();
  }

  try {
    await initDBFromSecrets();
    const permissionCheck = await checkAdminPermission(event);
    if (!permissionCheck.authorized) {
      return errorResponse('FORBIDDEN', permissionCheck.error || 'Admin access required', 403);
    }

    if (!event.body) {
      return errorResponse('BAD_REQUEST', 'Request body is required', 400);
    }

    const body = JSON.parse(event.body) as { csv?: string };
    const csv = body.csv;
    if (typeof csv !== 'string' || !csv.trim()) {
      return errorResponse('BAD_REQUEST', 'Field "csv" (string) is required', 400);
    }

    const lines = csv.trim().split(/\r?\n/).filter((l) => l.trim());
    const errors: { row: number; email?: string; message: string }[] = [];
    let imported = 0;
    let hadValidFormatRow = false;
    const db = getDB();

    for (let i = 0; i < lines.length; i++) {
      const rowNum = i + 1;
      const cells = parseCSVLine(lines[i]);
      if (cells.length < 5) {
        errors.push({ row: rowNum, message: '列数が足りません（email, password, name_kanji, name_kana, tel 必須）' });
        continue;
      }
      if (i === 0 && isHeaderRow(cells)) {
        continue;
      }

      const [email, password, name_kanji, name_kana, tel, org_id, remarks] = [
        (cells[0] || '').trim(),
        (cells[1] || '').trim(),
        (cells[2] || '').trim(),
        (cells[3] || '').trim(),
        (cells[4] || '').trim(),
        (cells[5] || '').trim() || null,
        (cells[6] || '').trim() || null,
      ];

      if (!email || !password || !name_kanji || !name_kana || !tel) {
        errors.push({ row: rowNum, email: email || undefined, message: 'email, password, name_kanji, name_kana, tel は必須です' });
        continue;
      }
      if (!validateEmail(email)) {
        errors.push({ row: rowNum, email, message: 'メールアドレスの形式が不正です' });
        continue;
      }
      if (!validatePassword(password)) {
        errors.push({ row: rowNum, email, message: 'パスワードは8文字以上にしてください' });
        continue;
      }

      hadValidFormatRow = true;
      try {
        const [existing] = await db.execute('SELECT email FROM users WHERE email = ?', [email]) as any[];
        if (existing.length > 0) {
          errors.push({ row: rowNum, email, message: '既に登録されているメールアドレスです' });
          continue;
        }

        const hashedPassword = crypto.createHash('sha256').update(password).digest('hex');
        await db.execute(
          `INSERT INTO users (email, password, name_kanji, name_kana, tel, org_id, role_flag, remarks)
           VALUES (?, ?, ?, ?, ?, ?, 1, ?)`,
          [email, hashedPassword, name_kanji, name_kana, tel, org_id, remarks]
        );
        imported++;
      } catch (err: any) {
        if (err.code === 'ER_DUP_ENTRY') {
          errors.push({ row: rowNum, email, message: '既に登録されているメールアドレスです' });
        } else {
          errors.push({ row: rowNum, email, message: err.message || '登録に失敗しました' });
        }
      }
    }

    // 形式不正のときだけ 400（形式上有効な行が1件もない場合）
    if (imported === 0 && errors.length > 0 && !hadValidFormatRow) {
      return errorResponse(
        'BAD_REQUEST',
        'CSV format is invalid or all rows have errors',
        400,
        { errors: errors.slice(0, 20) }
      );
    }

    return successResponse({
      imported,
      totalRows: lines.length,
      errors: errors.slice(0, 100),
    });
  } catch (error: any) {
    console.error('Import students error:', error);
    return errorResponse(
      'INTERNAL_ERROR',
      'An internal error occurred',
      500,
      error.message
    );
  }
};
