/**
 * タスク管理アプリ - フロントエンドJavaScript
 * 
 * API Gatewayのエンドポイントを呼び出してタスクのCRUD操作を実行します。
 * 
 * 環境変数または設定でAPIエンドポイントを指定してください。
 */

// APIエンドポイントの設定
// 本番環境では環境変数や設定ファイルから読み込むことを推奨
const API_BASE_URL = window.API_BASE_URL || 'https://YOUR_API_GATEWAY_URL.execute-api.ap-northeast-1.amazonaws.com/prod';

// 認証トークン（Cognito認証実装時に使用）
// const AUTH_TOKEN = localStorage.getItem('authToken');

/**
 * API呼び出し用の共通関数
 */
async function callAPI(method, path, body = null) {
  const url = `${API_BASE_URL}${path}`;
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json'
    }
  };

  // Cognito認証トークンがある場合は追加
  // if (AUTH_TOKEN) {
  //   options.headers['Authorization'] = `Bearer ${AUTH_TOKEN}`;
  // }

  if (body) {
    options.body = JSON.stringify(body);
  }

  try {
    const response = await fetch(url, options);
    
    // 204 No Contentの場合は空のオブジェクトを返す
    if (response.status === 204) {
      return {};
    }

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || `HTTP error! status: ${response.status}`);
    }

    return data;
  } catch (error) {
    console.error('API call failed:', error);
    throw error;
  }
}

/**
 * タスク追加
 */
async function createTask(taskData) {
  return await callAPI('POST', '/tasks', taskData);
}

/**
 * タスク一覧取得
 */
async function getTasks() {
  return await callAPI('GET', '/tasks');
}

/**
 * タスク更新
 */
async function updateTask(taskId, taskData) {
  return await callAPI('PUT', `/tasks/${taskId}`, taskData);
}

/**
 * タスク削除
 */
async function deleteTask(taskId) {
  return await callAPI('DELETE', `/tasks/${taskId}`);
}

/**
 * アラート表示
 */
function showAlert(message, type = 'success') {
  const alertContainer = document.getElementById('alert-container');
  const alertId = `alert-${Date.now()}`;
  
  const alertHTML = `
    <div class="alert alert-${type} alert-dismissible fade show" role="alert" id="${alertId}">
      ${message}
      <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    </div>
  `;
  
  alertContainer.innerHTML = alertHTML;
  
  // 3秒後に自動で閉じる
  setTimeout(() => {
    const alertElement = document.getElementById(alertId);
    if (alertElement) {
      const bsAlert = new bootstrap.Alert(alertElement);
      bsAlert.close();
    }
  }, 3000);
}

/**
 * タスク一覧を表示
 */
async function displayTasks() {
  const loading = document.getElementById('loading');
  const tasksContainer = document.getElementById('tasks-container');
  const emptyMessage = document.getElementById('empty-message');

  loading.classList.remove('d-none');
  tasksContainer.innerHTML = '';
  emptyMessage.classList.add('d-none');

  try {
    const response = await getTasks();
    const tasks = response.tasks || [];

    loading.classList.add('d-none');

    if (tasks.length === 0) {
      emptyMessage.classList.remove('d-none');
      return;
    }

    tasks.forEach(task => {
      const taskElement = createTaskElement(task);
      tasksContainer.appendChild(taskElement);
    });

  } catch (error) {
    loading.classList.add('d-none');
    showAlert(`タスクの取得に失敗しました: ${error.message}`, 'danger');
    console.error('Failed to load tasks:', error);
  }
}

/**
 * タスク要素を作成
 */
function createTaskElement(task) {
  const div = document.createElement('div');
  div.className = 'task-item card mb-3';
  div.dataset.taskId = task.taskId;

  const statusBadge = task.status === 'done' 
    ? '<span class="badge bg-success">完了</span>' 
    : '<span class="badge bg-warning">未完了</span>';

  const dueDateDisplay = task.dueDate 
    ? `<small class="text-muted">期日: ${formatDate(task.dueDate)}</small>` 
    : '';

  const descriptionDisplay = task.description 
    ? `<p class="card-text text-muted">${escapeHtml(task.description)}</p>` 
    : '';

  div.innerHTML = `
    <div class="card-body">
      <div class="d-flex justify-content-between align-items-start mb-2">
        <h5 class="card-title mb-0">${escapeHtml(task.title)}</h5>
        ${statusBadge}
      </div>
      ${descriptionDisplay}
      <div class="d-flex justify-content-between align-items-center mt-2">
        <div>
          ${dueDateDisplay}
          <small class="text-muted d-block">作成: ${formatDateTime(task.createdAt)}</small>
          <small class="text-muted d-block">更新: ${formatDateTime(task.updatedAt)}</small>
        </div>
        <div>
          <button class="btn btn-sm btn-outline-primary edit-btn" data-task-id="${task.taskId}">
            編集
          </button>
          <button class="btn btn-sm btn-outline-danger delete-btn" data-task-id="${task.taskId}">
            削除
          </button>
        </div>
      </div>
    </div>
  `;

  // 編集ボタンのイベントリスナー
  const editBtn = div.querySelector('.edit-btn');
  editBtn.addEventListener('click', () => editTask(task));

  // 削除ボタンのイベントリスナー
  const deleteBtn = div.querySelector('.delete-btn');
  deleteBtn.addEventListener('click', () => confirmDeleteTask(task.taskId, task.title));

  return div;
}

/**
 * タスク編集
 */
async function editTask(task) {
  // モーダルまたはインライン編集を実装
  // ここでは簡易的にプロンプトで実装
  const newTitle = prompt('タイトルを編集:', task.title);
  if (newTitle === null) return;

  const newDescription = prompt('説明を編集:', task.description || '');
  if (newDescription === null) return;

  const newDueDate = prompt('期日を編集 (YYYY-MM-DD):', task.dueDate || '');
  if (newDueDate === null) return;

  const newStatus = confirm('タスクを完了済みにしますか？') ? 'done' : 'todo';

  try {
    await updateTask(task.taskId, {
      title: newTitle,
      description: newDescription,
      dueDate: newDueDate || null,
      status: newStatus
    });

    showAlert('タスクを更新しました', 'success');
    displayTasks();
  } catch (error) {
    showAlert(`タスクの更新に失敗しました: ${error.message}`, 'danger');
  }
}

/**
 * タスク削除確認
 */
async function confirmDeleteTask(taskId, taskTitle) {
  if (!confirm(`「${taskTitle}」を削除しますか？`)) {
    return;
  }

  try {
    await deleteTask(taskId);
    showAlert('タスクを削除しました', 'success');
    displayTasks();
  } catch (error) {
    showAlert(`タスクの削除に失敗しました: ${error.message}`, 'danger');
  }
}

/**
 * 日付フォーマット
 */
function formatDate(dateString) {
  if (!dateString) return '';
  const date = new Date(dateString + 'T00:00:00');
  return date.toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' });
}

/**
 * 日時フォーマット
 */
function formatDateTime(dateString) {
  if (!dateString) return '';
  const date = new Date(dateString);
  return date.toLocaleString('ja-JP');
}

/**
 * HTMLエスケープ
 */
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * フォーム送信処理
 */
document.getElementById('task-form').addEventListener('submit', async (e) => {
  e.preventDefault();

  const submitBtn = e.target.querySelector('button[type="submit"]');
  const spinner = document.getElementById('submit-spinner');
  
  submitBtn.disabled = true;
  spinner.classList.remove('d-none');

  const formData = {
    title: document.getElementById('title').value,
    description: document.getElementById('description').value,
    dueDate: document.getElementById('dueDate').value || null,
    status: document.getElementById('status').value
  };

  try {
    await createTask(formData);
    showAlert('タスクを追加しました', 'success');
    e.target.reset();
    displayTasks();
  } catch (error) {
    showAlert(`タスクの追加に失敗しました: ${error.message}`, 'danger');
  } finally {
    submitBtn.disabled = false;
    spinner.classList.add('d-none');
  }
});

/**
 * 更新ボタンのイベントリスナー
 */
document.getElementById('refresh-btn').addEventListener('click', () => {
  displayTasks();
});

/**
 * ページ読み込み時にタスク一覧を表示
 */
document.addEventListener('DOMContentLoaded', () => {
  displayTasks();
});

