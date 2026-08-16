/**
 * ローカル開発用APIサーバー
 * Lambda関数をローカルで実行するための簡易HTTPサーバー
 */

import * as http from 'http';
import * as url from 'url';
import * as path from 'path';
import * as fs from 'fs';

const PORT = parseInt(process.env.PORT || '3001', 10);

// Lambda関数のパスマッピング（backendディレクトリからの相対パス）
const routeMap: { [key: string]: string } = {
  'POST:/v1/users/login': './functions/users/login/index.js',
  'POST:/v1/users/register': './functions/users/register/index.js',
  'GET:/v1/admin/students': './functions/admin/students/list/index.js',
  'POST:/v1/admin/students': './functions/admin/students/create/index.js',
  'POST:/v1/admin/students/import': './functions/admin/students/import/index.js',
  'PUT:/v1/admin/students/{email}': './functions/admin/students/update/index.js',
  'DELETE:/v1/admin/students/{email}': './functions/admin/students/delete/index.js',
  'GET:/v1/admin/staffs': './functions/admin/staffs/list/index.js',
  'POST:/v1/admin/invite': './functions/admin/staffs/invite/index.js',
  'PUT:/v1/admin/staffs/{email}': './functions/admin/staffs/update/index.js',
  'DELETE:/v1/admin/staffs/{email}': './functions/admin/staffs/delete/index.js',
  'GET:/v1/admin/events': './functions/admin/events/list/index.js',
  'GET:/v1/events': './functions/events/list/index.js',
  'POST:/v1/admin/events': './functions/admin/events/create/index.js',
  'PUT:/v1/admin/events/{eventId}': './functions/admin/events/update/index.js',
  'DELETE:/v1/admin/events/{eventId}': './functions/admin/events/delete/index.js',
  'GET:/v1/admin/events/{eventId}/qr': './functions/admin/events/qr/index.js',
  'GET:/v1/admin/events/{eventId}/participants': './functions/admin/events/participants/index.js',
  'GET:/v1/admin/events/{eventId}/attendance-report': './functions/admin/events/attendance-report/index.js',
  'GET:/v1/admin/reports/events/{eventId}/csv': './functions/admin/reports/events/csv/index.js',
  'POST:/v1/users/attendance': './functions/users/attendance/index.js',
  'GET:/v1/users/attendance': './functions/users/attendance/index.js',
  'GET:/v1/users/attendance/history': './functions/users/attendance/history/index.js',
  'GET:/v1/users/me/qr': './functions/users/me-qr/index.js',
  'POST:/v1/users/events/{eventId}/register': './functions/users/events/register/index.js',
  'DELETE:/v1/users/events/{eventId}/register': './functions/users/events/unregister/index.js',
  'GET:/v1/users/registrations': './functions/users/registrations/index.js',
  'GET:/v1/admin/registrations': './functions/admin/registrations/list/index.js',
  'GET:/v1/news': './functions/news/list/index.js',
  'GET:/v1/admin/news': './functions/admin/news/list/index.js',
  'POST:/v1/admin/news': './functions/admin/news/create/index.js',
  'PUT:/v1/admin/news/{id}': './functions/admin/news/update/index.js',
  'DELETE:/v1/admin/news/{id}': './functions/admin/news/delete/index.js',
  'GET:/v1/students/search': './functions/students/search/index.js',
  'POST:/v1/attendance/manual': './functions/attendance/manual/index.js',
  'GET:/v1/calendar': './functions/calendar/list/index.js',
  'GET:/v1/users/schedule': './functions/users/schedule/index.js',
};

// パスパラメータを抽出
function extractPathParams(pattern: string, actualPath: string): { [key: string]: string } {
  const params: { [key: string]: string } = {};
  const patternParts = pattern.split('/');
  const actualParts = actualPath.split('/');

  for (let i = 0; i < patternParts.length; i++) {
    if (patternParts[i].startsWith('{') && patternParts[i].endsWith('}')) {
      const paramName = patternParts[i].slice(1, -1);
      params[paramName] = actualParts[i];
    }
  }

  return params;
}

// ルートをマッチング
function findRoute(method: string, pathname: string): { handler: string; pathParams: { [key: string]: string } } | null {
  for (const [route, handler] of Object.entries(routeMap)) {
    const [routeMethod, routePath] = route.split(':');
    
    if (routeMethod !== method) continue;

    // パスパラメータを{param}形式に変換してマッチング
    const routePattern = routePath.replace(/\{[^}]+\}/g, '([^/]+)');
    const regex = new RegExp(`^${routePattern}$`);
    
    if (regex.test(pathname)) {
      const pathParams = extractPathParams(routePath, pathname);
      return { handler, pathParams };
    }
  }

  return null;
}

const server = http.createServer(async (req, res) => {
  // CORSヘッダーを設定
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  // OPTIONSリクエスト（プリフライト）の処理
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  const parsedUrl = url.parse(req.url || '', true);
  const pathname = parsedUrl.pathname || '';
  const method = req.method || 'GET';

  console.log(`[${method}] ${pathname}`);

  // ルートパス（/）はAPI案内を返す
  if (pathname === '/' || pathname === '') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      message: 'QRコード打刻システム API サーバー',
      hint: 'フロントエンドは http://localhost:3000 で利用してください。APIは /v1/... のパスで提供されています。',
    }));
    return;
  }

  // ルートを検索
  const route = findRoute(method, pathname);

  if (!route) {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'NOT_FOUND', message: 'ルートが見つかりません' }));
    return;
  }

  // Lambda関数のハンドラーを読み込んで実行
  try {
    // パスを解決（相対パスを絶対パスに変換）
    const handlerPath = path.isAbsolute(route.handler) 
      ? route.handler 
      : path.resolve(__dirname, route.handler);
    
    // ファイルが存在するか確認
    if (!fs.existsSync(handlerPath)) {
      console.error(`Handler not found: ${handlerPath}`);
      console.error(`  Expected at: ${path.resolve(__dirname, route.handler)}`);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'INTERNAL_ERROR', message: 'Handler not found' }));
      return;
    }

    // Lambda関数を動的に読み込み
    // モジュールキャッシュをクリア（handlerPathとその依存関係）
    const resolvedPath = require.resolve(handlerPath);
    delete require.cache[resolvedPath];
    
    // 依存モジュールのキャッシュもクリア（より広範囲に）
    // handlerPathのディレクトリから相対パスで解決される可能性があるモジュールもクリア
    const handlerDir = path.dirname(resolvedPath);
    
    // すべてのsecrets.jsとconnection.jsのキャッシュをクリア（より積極的に）
    const cacheKeys = Object.keys(require.cache);
    cacheKeys.forEach(key => {
      if (key.includes('shared/db/secrets') || 
          key.includes('shared/db/connection') ||
          (key.includes('functions') && (key.includes('secrets.js') || key.includes('connection.js'))) ||
          (key.startsWith(handlerDir) && (key.includes('secrets') || key.includes('connection'))) ||
          key.endsWith('secrets.js') ||
          key.endsWith('connection.js') ||
          (key.includes('attendance/history') && (key.includes('secrets') || key.includes('connection'))) ||
          (key.includes('attendance') && key.includes('history') && (key.includes('secrets') || key.includes('connection')))) {
        delete require.cache[key];
      }
    });
    
    // すべての関数のsecrets.jsを強制的に再読み込み
    const secretsPath = path.resolve(handlerDir, 'shared/db/secrets.js');
    if (fs.existsSync(secretsPath)) {
      try {
        // すべての可能なパスでキャッシュをクリア
        const allCacheKeys = Object.keys(require.cache);
        allCacheKeys.forEach(key => {
          if (key.includes('secrets.js') || key.includes('shared/db/secrets')) {
            delete require.cache[key];
          }
        });
        // 新しいパスで解決を試みる
        const resolvedSecretsPath = require.resolve(secretsPath);
        delete require.cache[resolvedSecretsPath];
        // 相対パスで解決される可能性があるパスもクリア
        const relativeSecretsPath = path.join(handlerDir, 'shared', 'db', 'secrets.js');
        try {
          const resolvedRelativePath = require.resolve(relativeSecretsPath);
          delete require.cache[resolvedRelativePath];
        } catch (e) {
          // エラーは無視
        }
        // さらに、handlerDir配下のすべてのsecrets.jsのキャッシュをクリア
        const handlerCacheKeys = Object.keys(require.cache);
        handlerCacheKeys.forEach(key => {
          if (key.startsWith(handlerDir) && (key.includes('secrets') || key.includes('connection'))) {
            delete require.cache[key];
          }
        });
      } catch (e) {
        // エラーは無視
      }
    }
    
    // handlerPathを再読み込みする前に、すべての依存関係のキャッシュをクリア
    const finalCacheKeys = Object.keys(require.cache);
    finalCacheKeys.forEach(key => {
      if (key.includes('functions') && (key.includes('secrets') || key.includes('connection'))) {
        delete require.cache[key];
      }
    });
    
    // 最後に、handlerPathの依存関係を再解決してキャッシュをクリア
    // 注意: handlerPathを読み込む前に、すべてのsecrets.jsのキャッシュをクリア
    const beforeLoadCacheKeys = Object.keys(require.cache);
    beforeLoadCacheKeys.forEach(key => {
      if (key.includes('secrets.js') || key.includes('shared/db/secrets') || 
          (key.startsWith(handlerDir) && (key.includes('secrets') || key.includes('connection')))) {
        delete require.cache[key];
      }
    });
    
    // handlerPathを直接読み込む
    // handlerDir配下のsecrets.jsとconnection.jsのキャッシュを確実にクリア
    let handler;
    try {
      // handlerDir配下のsecrets.jsとconnection.jsのパスを解決
      const resolvedSecretsPath = require.resolve('./shared/db/secrets.js', { paths: [handlerDir] });
      const resolvedConnectionPath = require.resolve('./shared/db/connection.js', { paths: [handlerDir] });
      
      console.log(`[DEBUG] Loading handler from: ${handlerPath}`);
      console.log(`[DEBUG] Handler dir: ${handlerDir}`);
      console.log(`[DEBUG] Resolved secrets path: ${resolvedSecretsPath}`);
      console.log(`[DEBUG] Resolved connection path: ${resolvedConnectionPath}`);
      
      // すべての関連するキャッシュをクリア（より積極的に）
      const allCacheKeys = Object.keys(require.cache);
      const deletedKeys: string[] = [];
      allCacheKeys.forEach(key => {
        if (key.includes('secrets.js') || key.includes('connection.js') || 
            key === handlerPath || key.startsWith(handlerDir)) {
          delete require.cache[key];
          deletedKeys.push(key);
        }
      });
      console.log(`[DEBUG] Deleted ${deletedKeys.length} cache entries`);
      
      // handlerDir配下のsecrets.jsとconnection.jsを直接読み込んでキャッシュを確実にクリア
      try {
        require(resolvedSecretsPath);
        require(resolvedConnectionPath);
        // 読み込んだモジュールのキャッシュを再度クリア
        delete require.cache[resolvedSecretsPath];
        delete require.cache[resolvedConnectionPath];
        console.log(`[DEBUG] Pre-loaded and cleared secrets.js and connection.js`);
      } catch (preloadError) {
        console.error(`[DEBUG] Pre-load error:`, preloadError);
      }
      
      // handlerPathを直接読み込む（絶対パスで）
      const handlerModule = require(handlerPath);
      handler = handlerModule.handler || handlerModule.default?.handler || handlerModule.default;
      
      // 実際に読み込まれたsecrets.jsのパスを確認
      const Module = require('module');
      const loadedSecrets = Object.keys(require.cache).find(key => 
        key.includes('secrets.js') && key.startsWith(handlerDir)
      );
      console.log(`[DEBUG] Actually loaded secrets.js: ${loadedSecrets || 'NOT FOUND'}`);
      
      // 読み込まれたsecrets.jsの内容を確認
      if (loadedSecrets) {
        const fs = require('fs');
        const secretsContent = fs.readFileSync(loadedSecrets, 'utf8');
        console.log(`[DEBUG] Secrets.js contains local fallback: ${secretsContent.includes('DB_SECRET_ARN not set, using environment variables')}`);
        console.log(`[DEBUG] Secrets.js contains throw error: ${secretsContent.includes('DB_SECRET_ARN environment variable is not set')}`);
      }
      
      if (!handler) {
        console.error(`Handler function not found in: ${handlerPath}`);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'INTERNAL_ERROR', message: 'Handler function not found' }));
        return;
      }
    } catch (error: any) {
      console.error('Handler loading error:', error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        error: 'INTERNAL_ERROR',
        message: error.message || 'Failed to load handler',
      }));
      return;
    }

    // リクエストボディを読み込み
    let body = '';
    req.on('data', (chunk) => {
      body += chunk.toString();
    });

    req.on('end', async () => {
      // API Gatewayイベント形式に変換
      const event = {
        httpMethod: method,
        path: pathname,
        pathParameters: route.pathParams,
        queryStringParameters: parsedUrl.query,
        headers: req.headers as { [key: string]: string },
        body: body || null,
        isBase64Encoded: false,
        requestContext: {
          requestId: 'local-request-id',
          accountId: 'local',
          stage: 'local',
          httpMethod: method,
          path: pathname,
          requestTime: new Date().toISOString(),
          requestTimeEpoch: Date.now(),
        },
      };

      try {
        // Lambda関数を実行
        const result = await handler(event);

        // レスポンスを送信
        res.writeHead(result.statusCode || 200, result.headers || {});
        res.end(result.body || '');
      } catch (error: any) {
        console.error('Handler execution error:', error);
        console.error('Error stack:', error.stack);
        console.error('Error message:', error.message);
        console.error('Error name:', error.name);
        console.error('Error details:', JSON.stringify(error, Object.getOwnPropertyNames(error)));
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          error: 'INTERNAL_ERROR',
          message: error.message || 'Internal server error',
          details: error.message || 'An internal error occurred',
        }));
      }
    });
  } catch (error: any) {
    console.error('Server error:', error);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      error: 'INTERNAL_ERROR',
      message: error.message || 'Internal server error',
    }));
  }
});

server.listen(PORT, () => {
  console.log(`🚀 Local API Server running on http://localhost:${PORT}`);
  console.log(`📝 Available endpoints:`);
  Object.keys(routeMap).forEach(route => {
    console.log(`   ${route}`);
  });
});

// エラーハンドリング
server.on('error', (error: NodeJS.ErrnoException) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`❌ Port ${PORT} is already in use. Please stop the process using this port.`);
    console.error(`   Run: lsof -ti:${PORT} | xargs kill -9`);
  } else {
    console.error('Server error:', error);
  }
  process.exit(1);
});
