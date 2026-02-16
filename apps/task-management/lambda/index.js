/**
 * タスク管理API - Lambda関数
 * 
 * このLambda関数はAPI Gatewayから呼び出され、DynamoDBのTasksテーブルに対して
 * CRUD操作を実行します。
 * 
 * 対応エンドポイント:
 * - POST /tasks - タスク追加
 * - GET /tasks - タスク一覧取得
 * - PUT /tasks/{taskId} - タスク更新
 * - DELETE /tasks/{taskId} - タスク削除
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, QueryCommand, UpdateCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb';
import { randomUUID } from 'crypto';

// DynamoDBクライアントの初期化
// リージョンは環境変数から取得（デフォルト: ap-northeast-1）
const dynamoClient = new DynamoDBClient({
  region: process.env.AWS_REGION || 'ap-northeast-1'
});
const docClient = DynamoDBDocumentClient.from(dynamoClient);

// テーブル名は環境変数から取得
const TABLE_NAME = process.env.TASKS_TABLE_NAME || 'Tasks';

/**
 * Lambdaハンドラー関数
 * API Gatewayからのリクエストを処理します
 */
export const handler = async (event) => {
  console.log('Received event:', JSON.stringify(event, null, 2));

  // CORSヘッダー（開発用、本番ではCloudFrontドメインのみ許可）
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*', // 本番では特定ドメインに変更
    'Access-Control-Allow-Headers': 'Content-Type,Authorization',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS'
  };

  // OPTIONSリクエスト（CORSプリフライト）の処理
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: ''
    };
  }

  try {
    // ルーティング処理
    const { httpMethod, path, pathParameters, body } = event;
    const userId = event.requestContext?.authorizer?.claims?.sub || 'test-user'; // 認証なし時はテストユーザー

    let result;

    switch (httpMethod) {
      case 'POST':
        if (path === '/tasks' || path.endsWith('/tasks')) {
          result = await createTask(userId, JSON.parse(body || '{}'));
        } else {
          throw new Error(`Unsupported path: ${path}`);
        }
        break;

      case 'GET':
        if (path === '/tasks' || path.endsWith('/tasks')) {
          result = await getTasks(userId);
        } else {
          throw new Error(`Unsupported path: ${path}`);
        }
        break;

      case 'PUT':
        if (pathParameters?.taskId) {
          result = await updateTask(userId, pathParameters.taskId, JSON.parse(body || '{}'));
        } else {
          throw new Error('taskId is required');
        }
        break;

      case 'DELETE':
        if (pathParameters?.taskId) {
          result = await deleteTask(userId, pathParameters.taskId);
        } else {
          throw new Error('taskId is required');
        }
        break;

      default:
        throw new Error(`Unsupported HTTP method: ${httpMethod}`);
    }

    return {
      statusCode: result.statusCode || 200,
      headers,
      body: JSON.stringify(result.body || {})
    };

  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: error.statusCode || 500,
      headers,
      body: JSON.stringify({
        error: error.message || 'Internal server error'
      })
    };
  }
};

/**
 * タスク作成
 * POST /tasks
 */
async function createTask(userId, data) {
  // バリデーション
  if (!data.title || data.title.trim().length === 0) {
    throw { statusCode: 400, message: 'title is required' };
  }
  if (data.title.length > 200) {
    throw { statusCode: 400, message: 'title must be 200 characters or less' };
  }
  if (data.description && data.description.length > 2000) {
    throw { statusCode: 400, message: 'description must be 2000 characters or less' };
  }
  if (data.dueDate && !/^\d{4}-\d{2}-\d{2}$/.test(data.dueDate)) {
    throw { statusCode: 400, message: 'dueDate must be in YYYY-MM-DD format' };
  }
  if (data.status && !['todo', 'done'].includes(data.status)) {
    throw { statusCode: 400, message: 'status must be "todo" or "done"' };
  }

  const taskId = randomUUID();
  const now = new Date().toISOString();

  const task = {
    userId, // PK（パーティションキー）
    taskId, // SK（ソートキー）
    title: data.title.trim(),
    description: data.description?.trim() || '',
    dueDate: data.dueDate || null,
    status: data.status || 'todo',
    createdAt: now,
    updatedAt: now
  };

  await docClient.send(new PutCommand({
    TableName: TABLE_NAME,
    Item: task
  }));

  return {
    statusCode: 201,
    body: {
      taskId,
      message: 'Task created successfully'
    }
  };
}

/**
 * タスク一覧取得
 * GET /tasks
 */
async function getTasks(userId) {
  // QueryでuserId（PK）に一致するタスクを取得
  // updatedAt降順で並べ替え（DynamoDBのソートキーではできないため、取得後にソート）
  const response = await docClient.send(new QueryCommand({
    TableName: TABLE_NAME,
    KeyConditionExpression: 'userId = :userId',
    ExpressionAttributeValues: {
      ':userId': userId
    }
  }));

  let tasks = response.Items || [];

  // updatedAt降順でソート
  tasks.sort((a, b) => {
    const dateA = new Date(a.updatedAt);
    const dateB = new Date(b.updatedAt);
    return dateB - dateA; // 降順
  });

  return {
    statusCode: 200,
    body: {
      tasks,
      count: tasks.length
    }
  };
}

/**
 * タスク更新
 * PUT /tasks/{taskId}
 */
async function updateTask(userId, taskId, data) {
  // まずタスクが存在し、所有者が正しいか確認
  const getResponse = await docClient.send(new QueryCommand({
    TableName: TABLE_NAME,
    KeyConditionExpression: 'userId = :userId AND taskId = :taskId',
    ExpressionAttributeValues: {
      ':userId': userId,
      ':taskId': taskId
    }
  }));

  if (!getResponse.Items || getResponse.Items.length === 0) {
    throw { statusCode: 404, message: 'Task not found' };
  }

  // バリデーション
  if (data.title !== undefined) {
    if (!data.title || data.title.trim().length === 0) {
      throw { statusCode: 400, message: 'title cannot be empty' };
    }
    if (data.title.length > 200) {
      throw { statusCode: 400, message: 'title must be 200 characters or less' };
    }
  }
  if (data.description !== undefined && data.description.length > 2000) {
    throw { statusCode: 400, message: 'description must be 2000 characters or less' };
  }
  if (data.dueDate !== undefined && data.dueDate !== null && !/^\d{4}-\d{2}-\d{2}$/.test(data.dueDate)) {
    throw { statusCode: 400, message: 'dueDate must be in YYYY-MM-DD format' };
  }
  if (data.status !== undefined && !['todo', 'done'].includes(data.status)) {
    throw { statusCode: 400, message: 'status must be "todo" or "done"' };
  }

  // 更新可能なフィールドのみ更新
  const updateExpression = [];
  const expressionAttributeNames = {};
  const expressionAttributeValues = {};

  if (data.title !== undefined) {
    updateExpression.push('#title = :title');
    expressionAttributeNames['#title'] = 'title';
    expressionAttributeValues[':title'] = data.title.trim();
  }
  if (data.description !== undefined) {
    updateExpression.push('#description = :description');
    expressionAttributeNames['#description'] = 'description';
    expressionAttributeValues[':description'] = data.description.trim();
  }
  if (data.dueDate !== undefined) {
    updateExpression.push('dueDate = :dueDate');
    expressionAttributeValues[':dueDate'] = data.dueDate || null;
  }
  if (data.status !== undefined) {
    updateExpression.push('#status = :status');
    expressionAttributeNames['#status'] = 'status';
    expressionAttributeValues[':status'] = data.status;
  }

  // updatedAtは常に更新
  updateExpression.push('updatedAt = :updatedAt');
  expressionAttributeValues[':updatedAt'] = new Date().toISOString();

  if (updateExpression.length === 0) {
    throw { statusCode: 400, message: 'No fields to update' };
  }

  await docClient.send(new UpdateCommand({
    TableName: TABLE_NAME,
    Key: {
      userId,
      taskId
    },
    UpdateExpression: `SET ${updateExpression.join(', ')}`,
    ExpressionAttributeNames: Object.keys(expressionAttributeNames).length > 0 ? expressionAttributeNames : undefined,
    ExpressionAttributeValues: expressionAttributeValues
  }));

  return {
    statusCode: 200,
    body: {
      message: 'Task updated successfully'
    }
  };
}

/**
 * タスク削除
 * DELETE /tasks/{taskId}
 */
async function deleteTask(userId, taskId) {
  // まずタスクが存在し、所有者が正しいか確認
  const getResponse = await docClient.send(new QueryCommand({
    TableName: TABLE_NAME,
    KeyConditionExpression: 'userId = :userId AND taskId = :taskId',
    ExpressionAttributeValues: {
      ':userId': userId,
      ':taskId': taskId
    }
  }));

  if (!getResponse.Items || getResponse.Items.length === 0) {
    throw { statusCode: 404, message: 'Task not found' };
  }

  await docClient.send(new DeleteCommand({
    TableName: TABLE_NAME,
    Key: {
      userId,
      taskId
    }
  }));

  return {
    statusCode: 204,
    body: {}
  };
}

