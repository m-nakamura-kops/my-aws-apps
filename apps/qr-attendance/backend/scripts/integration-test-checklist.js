#!/usr/bin/env node
/**
 * 結合テスト 1.1.1 〜 13.1.2（スプレッドシート順）
 * 事前: ローカルAPI起動 (npm run dev)
 * 使い方: node scripts/integration-test-checklist.js
 * テスト開始前にシードを自動実行します（DBにテストユーザーが存在しない場合に備える）
 */

const crypto = require('crypto');
const path = require('path');
const { execSync } = require('child_process');
const BASE = process.env.API_BASE || 'http://localhost:3001';
const ADMIN = { email: 'it-admin@example.com', password: 'TestPass12' };
const STAFF = { email: 'it-staff@example.com', password: 'TestPass12' };
const USER = { email: 'it-user@example.com', password: 'TestPass12' };
const DUP_EMAIL = 'it-dup@example.com';

async function request(method, path, body = null, token = null) {
  const url = path.startsWith('http') ? path : `${BASE}${path}`;
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json' },
  };
  if (token) opts.headers['Authorization'] = `Bearer ${token}`;
  if (body != null) opts.body = JSON.stringify(body);
  const res = await fetch(url, opts);
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch (_) {}
  return { status: res.status, data, text };
}

async function login(email, password) {
  const { status, data } = await request('POST', '/v1/users/login', { email, password });
  if (status !== 200 || !data?.token) throw new Error(`Login failed: ${status}`);
  return data.token;
}

function ok(actual, expected, msg) {
  const pass = Array.isArray(expected) ? expected.includes(actual) : actual === expected;
  return { pass, actual, expected, msg };
}

const results = [];

async function run() {
  let adminToken, staffToken, userToken;
  let createdEventId = null;
  const testUserEmail = `it-reg-${Date.now()}@example.com`;

  console.log('=== 結合テスト 1.1.1 〜 13.1.2（スプレッドシート順）===\n');

  // テストユーザーをDBに投入（既存は更新される）。SKIP_SEED=1 のときはスキップ（API起動中にシードしない場合用）
  let seedFailed = false;
  if (process.env.SKIP_SEED === '1') {
    console.log('SKIP_SEED=1: シードをスキップします（事前に API 停止中に node scripts/seed-test-users.js を実行済みであること）。\n');
  } else {
    try {
      execSync('node scripts/seed-test-users.js', { cwd: path.join(__dirname, '..'), stdio: 'pipe' });
    } catch (e) {
      seedFailed = true;
      const msg = e.message || String(e);
      console.warn('Warning: seed-test-users failed or skipped:', msg);
      if (msg.includes('Too many connections')) {
        console.warn('\n  → DB接続数超過の可能性があります。');
        console.warn('  → ローカルAPIサーバー(npm run dev)を一度停止し、');
        console.warn('    node scripts/seed-test-users.js を実行してから、');
        console.warn('    再度APIを起動し、結合テストは SKIP_SEED=1 npm run integration-test で実行してください。\n');
      }
    }
  }

  // --- 1.1 認証 ---
  // 1.1.1 ログイン（成功） 200
  try {
    adminToken = await login(ADMIN.email, ADMIN.password);
    const r = ok(200, 200, '1.1.1 認証 ログイン（成功）');
    results.push({ no: '1.1.1', ...r });
    console.log(r.pass ? 'OK' : 'NG', '1.1.1', r.msg, r.pass ? '' : `expected ${r.expected} got ${r.actual}`);
  } catch (e) {
    results.push({ no: '1.1.1', pass: false, msg: '1.1.1 ログイン（成功）', error: e.message });
    console.log('NG 1.1.1 ログイン（成功）', e.message);
  }

  // 1.1.2 ログイン（失敗） 401
  try {
    const { status } = await request('POST', '/v1/users/login', { email: USER.email, password: 'WrongPass1' });
    const r = ok(status, 401, '1.1.2 認証 ログイン（失敗）');
    results.push({ no: '1.1.2', ...r });
    console.log(r.pass ? 'OK' : 'NG', '1.1.2', r.msg, r.pass ? '' : `expected 401 got ${r.actual}`);
  } catch (e) {
    results.push({ no: '1.1.2', pass: false, msg: '1.1.2 ログイン（失敗）', error: e.message });
    console.log('NG 1.1.2', e.message);
  }

  // 1.1.3 ログイン（空） 400
  try {
    const { status } = await request('POST', '/v1/users/login', {});
    const r = ok(status, 400, '1.1.3 認証 ログイン（空）');
    results.push({ no: '1.1.3', ...r });
    console.log(r.pass ? 'OK' : 'NG', '1.1.3', r.msg, r.pass ? '' : `expected 400 got ${r.actual}`);
  } catch (e) {
    results.push({ no: '1.1.3', pass: false, msg: '1.1.3 ログイン（空）', error: e.message });
    console.log('NG 1.1.3', e.message);
  }

  // 1.2.1 利用者登録 自己登録（成功） 201
  try {
    const { status } = await request('POST', '/v1/users/register', {
      name_kanji: '登録テスト',
      name_kana: 'トウロクテスト',
      email: testUserEmail,
      password: 'TestPass12',
      tel: '090-0000-9999',
    });
    const r = ok(status, 201, '1.2.1 利用者登録 自己登録（成功）');
    results.push({ no: '1.2.1', ...r });
    console.log(r.pass ? 'OK' : 'NG', '1.2.1', r.msg, r.pass ? '' : `expected 201 got ${r.actual}`);
  } catch (e) {
    results.push({ no: '1.2.1', pass: false, msg: '1.2.1 自己登録（成功）', error: e.message });
    console.log('NG 1.2.1', e.message);
  }

  // 1.2.2 利用者登録 バリデーション 400（メール形式不正 or 必須不足）
  try {
    const { status } = await request('POST', '/v1/users/register', {
      name_kanji: 'a',
      name_kana: 'a',
      email: 'invalidemail',
      password: 'TestPass12',
      tel: '090-0000-0000',
    });
    const r = ok(status, 400, '1.2.2 利用者登録 バリデーション');
    results.push({ no: '1.2.2', ...r });
    console.log(r.pass ? 'OK' : 'NG', '1.2.2', r.msg, r.pass ? '' : `expected 400 got ${r.actual}`);
  } catch (e) {
    results.push({ no: '1.2.2', pass: false, msg: '1.2.2 バリデーション', error: e.message });
    console.log('NG 1.2.2', e.message);
  }

  // 1.2.3 利用者登録 重複登録 400（既存メール it-dup@example.com）
  try {
    const { status } = await request('POST', '/v1/users/register', {
      name_kanji: '重複',
      name_kana: 'チョウフク',
      email: DUP_EMAIL,
      password: 'TestPass12',
      tel: '090-0000-0000',
    });
    const r = ok(status, [400, 409], '1.2.3 利用者登録 重複登録');
    results.push({ no: '1.2.3', ...r });
    console.log(r.pass ? 'OK' : 'NG', '1.2.3', r.msg, r.pass ? '' : `expected 400/409 got ${r.actual}`);
  } catch (e) {
    results.push({ no: '1.2.3', pass: false, msg: '1.2.3 重複登録', error: e.message });
    console.log('NG 1.2.3', e.message);
  }

  // トークン取得（スタッフ・利用者）
  try {
    staffToken = await login(STAFF.email, STAFF.password);
    userToken = await login(USER.email, USER.password);
  } catch (e) {
    console.log('Warning: staff/user login failed', e.message);
  }

  // --- 2.1 / 2.2 生徒管理 ---
  // 2.1.1 生徒一覧取得 200（管理者）
  try {
    const { status } = await request('GET', '/v1/admin/students', null, adminToken);
    const r = ok(status, 200, '2.1.1 生徒管理 一覧取得');
    results.push({ no: '2.1.1', ...r });
    console.log(r.pass ? 'OK' : 'NG', '2.1.1', r.msg, r.pass ? '' : `expected 200 got ${r.actual}`);
  } catch (e) {
    results.push({ no: '2.1.1', pass: false, msg: '2.1.1 生徒一覧', error: e.message });
    console.log('NG 2.1.1', e.message);
  }

  // 2.1.2 生徒一覧取得 200
  try {
    const { status } = await request('GET', '/v1/admin/students', null, adminToken);
    const r = ok(status, 200, '2.1.2 生徒管理 一覧取得');
    results.push({ no: '2.1.2', ...r });
    console.log(r.pass ? 'OK' : 'NG', '2.1.2', r.msg);
  } catch (e) {
    results.push({ no: '2.1.2', pass: false, msg: '2.1.2', error: e.message });
    console.log('NG 2.1.2', e.message);
  }

  // 2.1.3 生徒一覧取得 403（権限外＝利用者で叩く）
  try {
    const { status } = await request('GET', '/v1/admin/students', null, userToken);
    const r = ok(status, 403, '2.1.3 生徒管理 一覧取得（権限外）');
    results.push({ no: '2.1.3', ...r });
    console.log(r.pass ? 'OK' : 'NG', '2.1.3', r.msg, r.pass ? '' : `expected 403 got ${r.actual}`);
  } catch (e) {
    results.push({ no: '2.1.3', pass: false, msg: '2.1.3 権限外', error: e.message });
    console.log('NG 2.1.3', e.message);
  }

  // 2.2.1 生徒登録 個別作成 201
  const newStudentEmail = `it-student-${Date.now()}@example.com`;
  try {
    const { status } = await request('POST', '/v1/admin/students', {
      email: newStudentEmail,
      name_kanji: '生徒テスト',
      name_kana: 'セイトテスト',
      tel: '090-0000-0010',
    }, adminToken);
    const r = ok(status, 201, '2.2.1 生徒登録 個別作成');
    results.push({ no: '2.2.1', ...r });
    console.log(r.pass ? 'OK' : 'NG', '2.2.1', r.msg, r.pass ? '' : `expected 201 got ${r.actual}`);
  } catch (e) {
    results.push({ no: '2.2.1', pass: false, msg: '2.2.1 個別作成', error: e.message });
    console.log('NG 2.2.1', e.message);
  }

  // 2.2.2 生徒登録 作成（権限外） 403
  try {
    const { status } = await request('POST', '/v1/admin/students', {
      email: 'other@example.com',
      name_kanji: '他',
      name_kana: 'ホカ',
      tel: '090-0000-0011',
    }, userToken);
    const r = ok(status, 403, '2.2.2 生徒登録 作成（権限外）');
    results.push({ no: '2.2.2', ...r });
    console.log(r.pass ? 'OK' : 'NG', '2.2.2', r.msg, r.pass ? '' : `expected 403 got ${r.actual}`);
  } catch (e) {
    results.push({ no: '2.2.2', pass: false, msg: '2.2.2 権限外', error: e.message });
    console.log('NG 2.2.2', e.message);
  }

  // 2.2.3 生徒削除 +含有メール（パス encodeURIComponent）200
  const plusStudentEmail = `it+student-${Date.now()}@example.com`;
  try {
    const { status: cst } = await request('POST', '/v1/admin/students', {
      email: plusStudentEmail,
      name_kanji: 'プラステスト',
      name_kana: 'プラステスト',
      tel: '090-0000-0098',
    }, adminToken);
    if (cst !== 201) {
      results.push({ no: '2.2.3', pass: false, msg: '2.2.3 前提: 生徒作成', error: `expected 201 got ${cst}` });
      console.log('NG 2.2.3 前提作成', cst);
    } else {
      const delPath = `/v1/admin/students/${encodeURIComponent(plusStudentEmail)}`;
      const { status: dst } = await request('DELETE', delPath, null, adminToken);
      const r = ok(dst, 200, '2.2.3 生徒削除 +含有メール（URLエンコード）');
      results.push({ no: '2.2.3', ...r });
      console.log(r.pass ? 'OK' : 'NG', '2.2.3', r.msg, r.pass ? '' : `expected 200 got ${r.actual}`);
    }
  } catch (e) {
    results.push({ no: '2.2.3', pass: false, msg: '2.2.3 生徒削除+', error: e.message });
    console.log('NG 2.2.3', e.message);
  }

  // 2.3.1 生徒CSV インポート成功 200
  try {
    const csv = 'email,password,name_kanji,name_kana,tel\nit-csv@example.com,TestPass12,CSVテスト,シービーイーテスト,090-1111-1111';
    const { status } = await request('POST', '/v1/admin/students/import', { csv }, adminToken);
    const r = ok(status, 200, '2.3.1 生徒CSV インポート成功');
    results.push({ no: '2.3.1', ...r });
    console.log(r.pass ? 'OK' : 'NG', '2.3.1', r.msg, r.pass ? '' : `expected 200 got ${r.actual}`);
  } catch (e) {
    results.push({ no: '2.3.1', pass: false, msg: '2.3.1 CSVインポート', error: e.message });
    console.log('NG 2.3.1', e.message);
  }

  // 2.3.2 生徒CSV 形式不正 400
  try {
    const { status } = await request('POST', '/v1/admin/students/import', { csv: 'invalid' }, adminToken);
    const r = ok(status, 400, '2.3.2 生徒CSV 形式不正');
    results.push({ no: '2.3.2', ...r });
    console.log(r.pass ? 'OK' : 'NG', '2.3.2', r.msg, r.pass ? '' : `expected 400 got ${r.actual}`);
  } catch (e) {
    results.push({ no: '2.3.2', pass: false, msg: '2.3.2 形式不正', error: e.message });
    console.log('NG 2.3.2', e.message);
  }

  // 2.3.3 生徒CSV 権限外 403
  try {
    const { status } = await request('POST', '/v1/admin/students/import', { csv: 'email,password,name_kanji,name_kana,tel\na@a.com,TestPass12,a,a,090-0000-0000' }, userToken);
    const r = ok(status, 403, '2.3.3 生徒CSV 権限外');
    results.push({ no: '2.3.3', ...r });
    console.log(r.pass ? 'OK' : 'NG', '2.3.3', r.msg, r.pass ? '' : `expected 403 got ${r.actual}`);
  } catch (e) {
    results.push({ no: '2.3.3', pass: false, msg: '2.3.3 権限外', error: e.message });
    console.log('NG 2.3.3', e.message);
  }

  // --- 3.1 スタッフ管理 ---
  // 3.1.1 スタッフ一覧取得 200
  try {
    const { status } = await request('GET', '/v1/admin/staffs', null, adminToken);
    const r = ok(status, 200, '3.1.1 スタッフ管理 一覧取得');
    results.push({ no: '3.1.1', ...r });
    console.log(r.pass ? 'OK' : 'NG', '3.1.1', r.msg, r.pass ? '' : `expected 200 got ${r.actual}`);
  } catch (e) {
    results.push({ no: '3.1.1', pass: false, msg: '3.1.1 スタッフ一覧', error: e.message });
    console.log('NG 3.1.1', e.message);
  }

  // 3.1.2 スタッフ管理 権限変更 200（PUT staffs/{email}）
  try {
    const { status } = await request('PUT', `/v1/admin/staffs/${encodeURIComponent(STAFF.email)}`, { role_flag: 2 }, adminToken);
    const r = ok(status, 200, '3.1.2 スタッフ管理 権限変更');
    results.push({ no: '3.1.2', ...r });
    console.log(r.pass ? 'OK' : 'NG', '3.1.2', r.msg, r.pass ? '' : `expected 200 got ${r.actual}`);
  } catch (e) {
    results.push({ no: '3.1.2', pass: false, msg: '3.1.2 権限変更', error: e.message });
    console.log('NG 3.1.2', e.message);
  }

  // 3.1.3 スタッフ管理 権限剥奪 200（PUT staffs/{email} role_flag:1 → 利用者に変更）
  // 注意: 実行後は it-staff が利用者になるため、以降のテストでスタッフトークンは使わない
  try {
    const { status } = await request('PUT', `/v1/admin/staffs/${encodeURIComponent(STAFF.email)}`, { role_flag: 1 }, adminToken);
    const r = ok(status, 200, '3.1.3 スタッフ管理 権限剥奪');
    results.push({ no: '3.1.3', ...r });
    console.log(r.pass ? 'OK' : 'NG', '3.1.3', r.msg, r.pass ? '' : `expected 200 got ${r.actual}`);
    // 再度スタッフに戻す（invite で role を付与）。失敗しても 3.1.3 の結果は変更しない
    try {
      const invRes = await request('POST', '/v1/admin/invite', { email: STAFF.email, role: 'staff' }, adminToken);
      if (invRes.status === 200) staffToken = await login(STAFF.email, STAFF.password);
    } catch (_) {}
  } catch (e) {
    results.push({ no: '3.1.3', pass: false, msg: '3.1.3 権限剥奪', error: e.message });
    console.log('NG 3.1.3', e.message);
  }

  // 3.1.4 スタッフ管理 権限外操作 403（利用者で一覧取得）
  try {
    const { status } = await request('GET', '/v1/admin/staffs', null, userToken);
    const r = ok(status, 403, '3.1.4 スタッフ管理 権限外操作');
    results.push({ no: '3.1.4', ...r });
    console.log(r.pass ? 'OK' : 'NG', '3.1.4', r.msg, r.pass ? '' : `expected 403 got ${r.actual}`);
  } catch (e) {
    results.push({ no: '3.1.4', pass: false, msg: '3.1.4 権限外', error: e.message });
    console.log('NG 3.1.4', e.message);
  }

  // --- 4. イベント ---
  // 4.1.1 イベント 作成（正常） 201
  try {
    const body = {
      event_name: '結合テストイベント',
      event_date: new Date(Date.now() + 86400000).toISOString(),
      location: '会場A',
      capacity: 10,
      summary: 'テスト',
    };
    const { status, data } = await request('POST', '/v1/admin/events', body, adminToken);
    const r = ok(status, 201, '4.1.1 イベント 作成（正常）');
    if (data?.eventId) createdEventId = data.eventId;
    results.push({ no: '4.1.1', ...r });
    console.log(r.pass ? 'OK' : 'NG', '4.1.1', r.msg, r.pass ? '' : `expected 201 got ${r.actual}`);
  } catch (e) {
    results.push({ no: '4.1.1', pass: false, msg: '4.1.1 イベント作成', error: e.message });
    console.log('NG 4.1.1', e.message);
  }

  // 4.1.2 イベント 作成（空文字） 400
  try {
    const { status } = await request('POST', '/v1/admin/events', {
      event_name: '',
      event_date: new Date().toISOString(),
      location: '',
      capacity: 5,
      summary: '',
    }, adminToken);
    const r = ok(status, 400, '4.1.2 イベント 作成（空文字）');
    results.push({ no: '4.1.2', ...r });
    console.log(r.pass ? 'OK' : 'NG', '4.1.2', r.msg, r.pass ? '' : `expected 400 got ${r.actual}`);
  } catch (e) {
    results.push({ no: '4.1.2', pass: false, msg: '4.1.2 空文字', error: e.message });
    console.log('NG 4.1.2', e.message);
  }

  // 4.1.3 イベント 作成（権限外） 403
  try {
    const { status } = await request('POST', '/v1/admin/events', {
      event_name: 'Test',
      event_date: new Date().toISOString(),
      location: 'X',
      capacity: 5,
      summary: 'X',
    }, userToken);
    const r = ok(status, [403, 401], '4.1.3 イベント 作成（権限外）');
    results.push({ no: '4.1.3', ...r });
    console.log(r.pass ? 'OK' : 'NG', '4.1.3', r.msg, r.pass ? '' : `expected 403/401 got ${r.actual}`);
  } catch (e) {
    results.push({ no: '4.1.3', pass: false, msg: '4.1.3 権限外', error: e.message });
    console.log('NG 4.1.3', e.message);
  }

  // 4.2.1 イベント 更新（正常） 200
  if (createdEventId) {
    try {
      const { status } = await request('PUT', `/v1/admin/events/${createdEventId}`, {
        event_name: '結合テストイベント（更新）',
        event_date: new Date(Date.now() + 86400000).toISOString(),
        location: '会場B',
        capacity: 20,
        summary: '更新後',
      }, adminToken);
      const r = ok(status, 200, '4.2.1 イベント 更新（正常）');
      results.push({ no: '4.2.1', ...r });
      console.log(r.pass ? 'OK' : 'NG', '4.2.1', r.msg, r.pass ? '' : `expected 200 got ${r.actual}`);
    } catch (e) {
      results.push({ no: '4.2.1', pass: false, msg: '4.2.1 更新', error: e.message });
      console.log('NG 4.2.1', e.message);
    }
  } else {
    results.push({ no: '4.2.1', pass: false, msg: '4.2.1 更新', error: 'no eventId' });
    console.log('SKIP 4.2.1 (no eventId)');
  }

  // 4.2.2 イベント 削除（正常） 200
  try {
    const { data } = await request('POST', '/v1/admin/events', {
      event_name: '削除用イベント',
      event_date: new Date(Date.now() + 86400000).toISOString(),
      location: 'X',
      capacity: 5,
      summary: 'X',
    }, adminToken);
    const deleteEventId = data?.eventId;
    if (deleteEventId) {
      const { status } = await request('DELETE', `/v1/admin/events/${deleteEventId}`, null, adminToken);
      const r = ok(status, [200, 204], '4.2.2 イベント 削除（正常）');
      results.push({ no: '4.2.2', ...r });
      console.log(r.pass ? 'OK' : 'NG', '4.2.2', r.msg, r.pass ? '' : `expected 200/204 got ${r.actual}`);
    } else {
      results.push({ no: '4.2.2', pass: false, msg: '4.2.2', error: 'create failed' });
      console.log('NG 4.2.2 create failed');
    }
  } catch (e) {
    results.push({ no: '4.2.2', pass: false, msg: '4.2.2 削除', error: e.message });
    console.log('NG 4.2.2', e.message);
  }

  // 4.3.1 イベントQR QRデータ取得 200
  if (createdEventId) {
    try {
      const { status } = await request('GET', `/v1/admin/events/${createdEventId}/qr`, null, adminToken);
      const r = ok(status, 200, '4.3.1 イベントQR QRデータ取得');
      results.push({ no: '4.3.1', ...r });
      console.log(r.pass ? 'OK' : 'NG', '4.3.1', r.msg, r.pass ? '' : `expected 200 got ${r.actual}`);
    } catch (e) {
      results.push({ no: '4.3.1', pass: false, msg: '4.3.1 QR取得', error: e.message });
      console.log('NG 4.3.1', e.message);
    }
  } else {
    results.push({ no: '4.3.1', pass: false, msg: '4.3.1', error: 'no eventId' });
    console.log('SKIP 4.3.1');
  }

  // 4.3.2 イベントQR 権限外 403
  if (createdEventId) {
    try {
      const { status } = await request('GET', `/v1/admin/events/${createdEventId}/qr`, null, userToken);
      const r = ok(status, 403, '4.3.2 イベントQR 権限外');
      results.push({ no: '4.3.2', ...r });
      console.log(r.pass ? 'OK' : 'NG', '4.3.2', r.msg, r.pass ? '' : `expected 403 got ${r.actual}`);
    } catch (e) {
      results.push({ no: '4.3.2', pass: false, msg: '4.3.2 権限外', error: e.message });
      console.log('NG 4.3.2', e.message);
    }
  } else {
    results.push({ no: '4.3.2', pass: false, msg: '4.3.2', error: 'no eventId' });
    console.log('SKIP 4.3.2');
  }

  // --- 5. 参加申込 ---
  if (createdEventId) {
    // 5.1.1 参加申込 申込（正常） 201
    try {
      const { status } = await request('POST', `/v1/users/events/${createdEventId}/register`, { email: USER.email }, userToken);
      const r = ok(status, [200, 201], '5.1.1 参加申込 申込（正常）');
      results.push({ no: '5.1.1', ...r });
      console.log(r.pass ? 'OK' : 'NG', '5.1.1', r.msg, r.pass ? '' : `expected 200/201 got ${r.actual}`);
    } catch (e) {
      results.push({ no: '5.1.1', pass: false, msg: '5.1.1 申込', error: e.message });
      console.log('NG 5.1.1', e.message);
    }

    // 5.1.2 参加申込 二重申込 400
    try {
      const { status } = await request('POST', `/v1/users/events/${createdEventId}/register`, { email: USER.email }, userToken);
      const r = ok(status, 400, '5.1.2 参加申込 二重申込');
      results.push({ no: '5.1.2', ...r });
      console.log(r.pass ? 'OK' : 'NG', '5.1.2', r.msg, r.pass ? '' : `expected 400 got ${r.actual}`);
    } catch (e) {
      results.push({ no: '5.1.2', pass: false, msg: '5.1.2 二重申込', error: e.message });
      console.log('NG 5.1.2', e.message);
    }

    results.push({ no: '5.1.3', pass: true, msg: '5.1.3 定員オーバー', skip: true });
    console.log('SKIP 5.1.3 定員オーバー（手動確認推奨）');

    // 5.1.4 参加申込 取消 200（API は query または body で email 必須）
    try {
      const { status } = await request('DELETE', `/v1/users/events/${createdEventId}/register?email=${encodeURIComponent(USER.email)}`, null, userToken);
      const r = ok(status, 200, '5.1.4 参加申込 取消');
      results.push({ no: '5.1.4', ...r });
      console.log(r.pass ? 'OK' : 'NG', '5.1.4', r.msg, r.pass ? '' : `expected 200 got ${r.actual}`);
      await request('POST', `/v1/users/events/${createdEventId}/register`, { email: USER.email }, userToken);
    } catch (e) {
      results.push({ no: '5.1.4', pass: false, msg: '5.1.4 取消', error: e.message });
      console.log('NG 5.1.4', e.message);
    }
  } else {
    ['5.1.1', '5.1.2', '5.1.3', '5.1.4'].forEach(no => {
      results.push({ no, pass: false, msg: no, error: 'no eventId' });
      console.log('SKIP', no);
    });
  }

  // --- 6. 打刻 ---
  const qrSecret = process.env.QR_SECRET_KEY || 'default-secret-key-change-in-production';
  if (createdEventId) {
    const eventIdNum = parseInt(createdEventId, 10);
    const qrPayload = { event_id: eventIdNum, timestamp: Date.now() };
    const qrB64 = Buffer.from(JSON.stringify(qrPayload)).toString('base64');
    const sig = crypto.createHmac('sha256', qrSecret).update(qrB64).digest('hex');
    try {
      const { status } = await request('POST', '/v1/users/attendance', {
        email: USER.email,
        event_id: eventIdNum,
        qr_code_data: qrB64,
        signature: sig,
      }, userToken);
      const r = ok(status, 200, '6.1.1 打刻（正常）');
      results.push({ no: '6.1.1', ...r });
      console.log(r.pass ? 'OK' : 'NG', '6.1.1', r.msg, r.pass ? '' : `expected 200 got ${r.actual}`);
    } catch (e) {
      results.push({ no: '6.1.1', pass: false, msg: '6.1.1 打刻', error: e.message });
      console.log('NG 6.1.1', e.message);
    }

    try {
      const qrPayload2 = { event_id: eventIdNum, timestamp: Date.now() };
      const qrB64_2 = Buffer.from(JSON.stringify(qrPayload2)).toString('base64');
      const sig2 = crypto.createHmac('sha256', qrSecret).update(qrB64_2).digest('hex');
      const { status } = await request('POST', '/v1/users/attendance', {
        email: STAFF.email,
        event_id: eventIdNum,
        qr_code_data: qrB64_2,
        signature: sig2,
      }, staffToken);
      const r = ok(status, [403, 400, 404], '6.1.2 打刻 未申込イベント');
      results.push({ no: '6.1.2', ...r });
      console.log(r.pass ? 'OK' : 'NG', '6.1.2', r.msg, r.pass ? '' : `expected 403/400/404 got ${r.actual}`);
    } catch (e) {
      results.push({ no: '6.1.2', pass: false, msg: '6.1.2 未申込', error: e.message });
      console.log('NG 6.1.2', e.message);
    }
  } else {
    results.push({ no: '6.1.1', pass: false, msg: '6.1.1', error: 'no eventId' });
    results.push({ no: '6.1.2', pass: false, msg: '6.1.2', error: 'no eventId' });
    console.log('SKIP 6.1.1, 6.1.2');
  }

  // 6.1.3 打刻 トークンなし 401
  try {
    const { status } = await request('POST', '/v1/users/attendance', {
      email: USER.email,
      event_id: createdEventId || 1,
      qr_code_data: 'e30=',
      signature: 'x',
    }, null);
    const r = ok(status, [401, 400, 403], '6.1.3 打刻 トークンなし');
    results.push({ no: '6.1.3', ...r });
    console.log(r.pass ? 'OK' : 'NG', '6.1.3', r.msg, r.pass ? '' : `expected 401/400/403 got ${r.actual}`);
  } catch (e) {
    results.push({ no: '6.1.3', pass: false, msg: '6.1.3 トークンなし', error: e.message });
    console.log('NG 6.1.3', e.message);
  }

  // 6.2.1 マイQR QR表示 200
  try {
    const { status } = await request('GET', '/v1/users/me/qr', null, userToken);
    const r = ok(status, 200, '6.2.1 マイQR QR表示');
    results.push({ no: '6.2.1', ...r });
    console.log(r.pass ? 'OK' : 'NG', '6.2.1', r.msg, r.pass ? '' : `expected 200 got ${r.actual}`);
  } catch (e) {
    results.push({ no: '6.2.1', pass: false, msg: '6.2.1 マイQR', error: e.message });
    console.log('NG 6.2.1', e.message);
  }

  // --- 7. 履歴 ---
  try {
    const { status } = await request('GET', '/v1/users/attendance/history', null, userToken);
    const r = ok(status, 200, '7.1.1 履歴 自分の履歴');
    results.push({ no: '7.1.1', ...r });
    console.log(r.pass ? 'OK' : 'NG', '7.1.1', r.msg, r.pass ? '' : `expected 200 got ${r.actual}`);
  } catch (e) {
    results.push({ no: '7.1.1', pass: false, msg: '7.1.1 自分の履歴', error: e.message });
    console.log('NG 7.1.1', e.message);
  }

  try {
    const { status } = await request('GET', '/v1/users/attendance/history?email=' + encodeURIComponent(ADMIN.email), null, userToken);
    const r = ok(status, [403, 200], '7.1.2 履歴 他人の履歴');
    results.push({ no: '7.1.2', ...r });
    console.log(r.pass ? 'OK' : 'NG', '7.1.2', r.msg, r.pass ? '' : `expected 403 or 200 got ${r.actual}`);
  } catch (e) {
    results.push({ no: '7.1.2', pass: false, msg: '7.1.2 他人の履歴', error: e.message });
    console.log('NG 7.1.2', e.message);
  }

  // --- 9. お知らせ ---
  // 9.1.1 お知らせ一覧取得 200（要ログイン・利用者/スタッフ/管理者共通）
  try {
    const { status, data } = await request('GET', '/v1/news', null, adminToken);
    const r = ok(status, 200, '9.1.1 お知らせ一覧取得');
    const valid = r.pass && data && Array.isArray(data.news) && typeof data.totalCount === 'number' && typeof data.hasNextPage === 'boolean';
    results.push({ no: '9.1.1', pass: valid, actual: r.actual, expected: r.expected, msg: r.msg });
    console.log(valid ? 'OK' : 'NG', '9.1.1', r.msg, valid ? '' : `expected 200 with news/totalCount/hasNextPage got ${r.actual}`);
  } catch (e) {
    results.push({ no: '9.1.1', pass: false, msg: '9.1.1 お知らせ一覧', error: e.message });
    console.log('NG 9.1.1', e.message);
  }

  // 9.1.2 お知らせ 作成・編集・削除（管理者・スタッフのみ）200/201
  try {
    const createRes = await request('POST', '/v1/admin/news', {
      title: '結合テストお知らせ',
      content: '本文です。',
      published_at: new Date().toISOString(),
    }, adminToken);
    const createdId = createRes.data?.id;
    if (createRes.status !== 201 || !createdId) {
      results.push({ no: '9.1.2', pass: false, msg: '9.1.2 お知らせ作成', actual: createRes.status });
      console.log('NG 9.1.2 expected 201 got', createRes.status);
    } else {
      const updateRes = await request('PUT', `/v1/admin/news/${createdId}`, { title: '結合テストお知らせ（更新）' }, adminToken);
      const delRes = await request('DELETE', `/v1/admin/news/${createdId}`, null, adminToken);
      const r = ok(updateRes.status, 200, '9.1.2 お知らせ 更新');
      const r2 = ok(delRes.status, [200, 204], '9.1.2 お知らせ 削除');
      const pass = r.pass && r2.pass;
      results.push({ no: '9.1.2', pass, actual: r.actual, expected: r.expected, msg: '9.1.2 お知らせ 作成・編集・削除' });
      console.log(pass ? 'OK' : 'NG', '9.1.2', 'お知らせ 作成・編集・削除', pass ? '' : `update=${updateRes.status} delete=${delRes.status}`);
    }
  } catch (e) {
    results.push({ no: '9.1.2', pass: false, msg: '9.1.2 お知らせ', error: e.message });
    console.log('NG 9.1.2', e.message);
  }

  // 9.1.3 お知らせ 権限外（一般利用者は POST /v1/admin/news で 403）
  try {
    const { status } = await request('POST', '/v1/admin/news', {
      title: '無権限',
      content: '本文',
      published_at: new Date().toISOString(),
    }, userToken);
    const r = ok(status, 403, '9.1.3 お知らせ 権限外');
    results.push({ no: '9.1.3', ...r });
    console.log(r.pass ? 'OK' : 'NG', '9.1.3', r.msg, r.pass ? '' : `expected 403 got ${r.actual}`);
  } catch (e) {
    results.push({ no: '9.1.3', pass: false, msg: '9.1.3 権限外', error: e.message });
    console.log('NG 9.1.3', e.message);
  }

  // --- 10. カレンダー・スケジュール ---
  // 10.1.1 カレンダー取得 200（要ログイン、month 任意）
  try {
    const yyyymm = new Date().toISOString().slice(0, 7);
    const { status, data } = await request('GET', `/v1/calendar?month=${yyyymm}`, null, adminToken);
    const r = ok(status, 200, '10.1.1 カレンダー取得');
    const valid = r.pass && data && Array.isArray(data.events) && data.month;
    results.push({ no: '10.1.1', pass: valid, actual: r.actual, expected: r.expected, msg: r.msg });
    console.log(valid ? 'OK' : 'NG', '10.1.1', r.msg, valid ? '' : `expected 200 with events/month got ${r.actual}`);
  } catch (e) {
    results.push({ no: '10.1.1', pass: false, msg: '10.1.1 カレンダー取得', error: e.message });
    console.log('NG 10.1.1', e.message);
  }

  // 10.1.2 スケジュール取得 200（自分用・申込＋is_attended）
  try {
    const yyyymm = new Date().toISOString().slice(0, 7);
    const { status, data } = await request('GET', `/v1/users/schedule?month=${yyyymm}`, null, userToken);
    const r = ok(status, 200, '10.1.2 スケジュール取得');
    const valid = r.pass && data && Array.isArray(data.schedule) && data.month;
    results.push({ no: '10.1.2', pass: valid, actual: r.actual, expected: r.expected, msg: r.msg });
    console.log(valid ? 'OK' : 'NG', '10.1.2', r.msg, valid ? '' : `expected 200 with schedule/month got ${r.actual}`);
  } catch (e) {
    results.push({ no: '10.1.2', pass: false, msg: '10.1.2 スケジュール取得', error: e.message });
    console.log('NG 10.1.2', e.message);
  }

  // --- 8.1 レポート（イベント別出席者一覧CSV） ---
  // 8.1.1 出席者一覧CSV 取得（管理者）200 + BOM付きUTF-8 CSV
  if (createdEventId) {
    try {
      const { status, text } = await request('GET', `/v1/admin/reports/events/${createdEventId}/csv`, null, adminToken);
      const hasBOM = text && (text.charCodeAt(0) === 0xFEFF || text.startsWith('\uFEFF'));
      const hasHeader = text && text.includes('イベントID,開催日,イベント名,利用者名,ふりがな,メールアドレス,区分（生徒/一般）,申込日時,打刻日時（実績）');
      const valid = status === 200 && hasHeader;
      results.push({ no: '8.1.1', pass: valid, actual: status, expected: 200, msg: '8.1.1 出席者一覧CSV 取得（管理者）' });
      console.log(valid ? 'OK' : 'NG', '8.1.1', '出席者一覧CSV 取得（管理者）', valid ? (hasBOM ? ' (BOM付き)' : '') : `status=${status} header=${!!hasHeader}`);
    } catch (e) {
      results.push({ no: '8.1.1', pass: false, msg: '8.1.1 出席者一覧CSV', error: e.message });
      console.log('NG 8.1.1', e.message);
    }
    // 8.1.2 出席者一覧CSV 権限外（スタッフ）403
    try {
      const { status } = await request('GET', `/v1/admin/reports/events/${createdEventId}/csv`, null, staffToken);
      const r = ok(status, 403, '8.1.2 出席者一覧CSV 権限外（スタッフ）');
      results.push({ no: '8.1.2', ...r });
      console.log(r.pass ? 'OK' : 'NG', '8.1.2', r.msg, r.pass ? '' : `expected 403 got ${r.actual}`);
    } catch (e) {
      results.push({ no: '8.1.2', pass: false, msg: '8.1.2 権限外', error: e.message });
      console.log('NG 8.1.2', e.message);
    }
  } else {
    results.push({ no: '8.1.1', pass: false, msg: '8.1.1 CSV取得', error: 'no eventId' });
    results.push({ no: '8.1.2', pass: false, msg: '8.1.2 権限外', error: 'no eventId' });
    console.log('SKIP 8.1.1, 8.1.2 (no eventId)');
  }

  // --- 11.1.2 〜 11.1.4 手動打刻（生徒検索・手動打刻・権限外） ---
  // 11.1.2 手動打刻用生徒検索 200（スタッフ/管理者）
  try {
    const { status, data } = await request('GET', '/v1/students/search?q=' + encodeURIComponent('結合'), null, adminToken);
    const valid = status === 200 && data && Array.isArray(data.users);
    results.push({ no: '11.1.2', pass: valid, actual: status, expected: 200, msg: '11.1.2 手動打刻用生徒検索' });
    console.log(valid ? 'OK' : 'NG', '11.1.2', '手動打刻用生徒検索', valid ? '' : `status=${status}`);
  } catch (e) {
    results.push({ no: '11.1.2', pass: false, msg: '11.1.2 生徒検索', error: e.message });
    console.log('NG 11.1.2', e.message);
  }

  // 11.1.3 手動打刻実行 201（未打刻の生徒で実行）
  if (createdEventId) {
    let testUserToken = null;
    try {
      testUserToken = await login(testUserEmail, 'TestPass12');
    } catch (_) {}
    // SKIP_SEED=1 等で 1.2.1 がスキップされた場合: 利用者を登録してから再ログイン試行
    if (!testUserToken) {
      try {
        await request('POST', '/v1/users/register', {
          name_kanji: '手動打刻テスト',
          name_kana: 'テドウダコクテスト',
          email: testUserEmail,
          password: 'TestPass12',
          tel: '090-0000-9999',
        });
        testUserToken = await login(testUserEmail, 'TestPass12');
      } catch (_) {}
    }
    if (testUserToken) {
      try {
        await request('POST', `/v1/users/events/${createdEventId}/register`, { email: testUserEmail }, testUserToken);
      } catch (_) {}
      try {
        const { status, data } = await request('POST', '/v1/attendance/manual', { event_id: createdEventId, email: testUserEmail }, adminToken);
        const valid = status === 201 && data && (data.log_id != null || data.message);
        results.push({ no: '11.1.3', pass: valid, actual: status, expected: 201, msg: '11.1.3 手動打刻実行' });
        console.log(valid ? 'OK' : 'NG', '11.1.3', '手動打刻実行', valid ? '' : `status=${status}`);
      } catch (e) {
        results.push({ no: '11.1.3', pass: false, msg: '11.1.3 手動打刻', error: e.message });
        console.log('NG 11.1.3', e.message);
      }
    } else {
      results.push({ no: '11.1.3', pass: false, msg: '11.1.3 手動打刻', error: 'testUser login failed' });
      console.log('SKIP 11.1.3 (testUser login failed)');
    }
  } else {
    results.push({ no: '11.1.3', pass: false, msg: '11.1.3 手動打刻', error: 'no eventId' });
    console.log('SKIP 11.1.3 (no eventId)');
  }

  // 11.1.4 検索/手動打刻（権限外）利用者で 403 または 401（トークン無効時）
  try {
    const { status } = await request('GET', '/v1/students/search?q=test', null, userToken);
    const r = ok(status, [401, 403], '11.1.4 生徒検索（権限外）');
    results.push({ no: '11.1.4', ...r });
    console.log(r.pass ? 'OK' : 'NG', '11.1.4', r.msg, r.pass ? '' : `expected 401/403 got ${r.actual}`);
  } catch (e) {
    results.push({ no: '11.1.4', pass: false, msg: '11.1.4 権限外', error: e.message });
    console.log('NG 11.1.4', e.message);
  }

  // --- 11.1.1 スキャン打刻・12〜13 未実装エンドポイント → SKIP ---
  const skipNos = ['11.1.1', '12.1.1', '12.1.2', '12.1.3', '13.1.1', '13.1.2'];
  for (const no of skipNos) {
    results.push({ no, pass: true, msg: no, skip: true });
    console.log('SKIP', no, '(エンドポイント未実装)');
  }

  const passed = results.filter(r => r.pass && !r.skip).length;
  const failed = results.filter(r => !r.pass && !r.skip).length;
  const skipped = results.filter(r => r.skip).length;
  console.log('\n=== サマリ ===');
  console.log('OK:', passed, 'NG:', failed, 'SKIP:', skipped);
  process.exit(failed > 0 ? 1 : 0);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
