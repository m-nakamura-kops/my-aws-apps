/**
 * タスク管理アプリ - フロントエンドJavaScript
 * 
 * API Gatewayのエンドポイントを呼び出してタスクのCRUD操作を実行します。
 * 
 * 環境変数または設定でAPIエンドポイントを指定してください。
 */

// APIエンドポイントの設定
// 本番環境では環境変数や設定ファイルから読み込むことを推奨
const API_BASE_URL = window.API_BASE_URL || 'https://c060m18l73.execute-api.ap-northeast-1.amazonaws.com/prod';

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

    // Content-Typeを確認してJSONかどうか判断
    const contentType = response.headers.get('content-type');
    let data;
    
    if (contentType && contentType.includes('application/json')) {
      const text = await response.text();
      try {
        data = JSON.parse(text);
      } catch (parseError) {
        // JSONパースエラーの場合
        throw new Error(`Invalid JSON response: ${text.substring(0, 100)}`);
      }
    } else {
      // JSON以外のレスポンスの場合
      const text = await response.text();
      throw new Error(`Expected JSON but got ${contentType || 'unknown'}: ${text.substring(0, 100)}`);
    }

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
      tasksContainer.innerHTML = '';
      return;
    }

    // テーブルヘッダーを作成（まだ存在しない場合）
    if (!tasksContainer.querySelector('table')) {
      const table = document.createElement('table');
      table.className = 'table table-hover table-striped';
      table.innerHTML = `
        <thead class="table-light">
          <tr>
            <th style="width: 150px; min-width: 150px; max-width: 150px;">タイトル</th>
            <th style="width: 180px; min-width: 180px; max-width: 180px;">説明</th>
            <th style="width: 90px; min-width: 90px; max-width: 90px;">期日</th>
            <th style="width: 80px; min-width: 80px; max-width: 80px;">ステータス</th>
            <th style="width: 120px; min-width: 120px; max-width: 120px;">作成日時</th>
            <th style="width: 120px; min-width: 120px; max-width: 120px;">更新日時</th>
            <th style="width: 160px; min-width: 160px; max-width: 160px;">操作</th>
          </tr>
        </thead>
        <tbody id="tasks-tbody">
        </tbody>
      `;
      tasksContainer.appendChild(table);
    }

    const tbody = tasksContainer.querySelector('#tasks-tbody');
    tbody.innerHTML = '';

    tasks.forEach(task => {
      const taskElement = createTaskElement(task);
      tbody.appendChild(taskElement);
    });

  } catch (error) {
    loading.classList.add('d-none');
    showAlert(`タスクの取得に失敗しました: ${error.message}`, 'danger');
    console.error('Failed to load tasks:', error);
  }
}

/**
 * タスク要素を作成（テーブル行として）
 */
function createTaskElement(task) {
  const tr = document.createElement('tr');
  tr.className = 'task-row';
  tr.dataset.taskId = task.taskId;

  const statusBadge = task.status === 'done' 
    ? '<span class="badge bg-success">完了</span>' 
    : '<span class="badge bg-warning">未完了</span>';

  // タイトルの全文をtitle属性に設定（ツールチップ用）
  const titleFullText = escapeHtml(task.title);
  const titleDisplay = task.title.length > 20 ? task.title.substring(0, 20) + '...' : task.title;

  const dueDateDisplay = task.dueDate 
    ? formatDate(task.dueDate)
    : '<span class="text-muted">-</span>';

  // 説明の全文をtitle属性に設定（ツールチップ用）
  const descriptionFullText = task.description ? escapeHtml(task.description) : '';
  const descriptionDisplay = task.description 
    ? (task.description.length > 30 ? task.description.substring(0, 30) + '...' : task.description)
    : '<span class="text-muted">-</span>';

  tr.innerHTML = `
    <td class="align-middle task-title-cell" title="${titleFullText}">
      <strong class="task-title-text">${escapeHtml(titleDisplay)}</strong>
    </td>
    <td class="align-middle task-description-cell" title="${descriptionFullText}">
      <div class="task-description-text">
        ${task.description ? escapeHtml(descriptionDisplay) : '<span class="text-muted">-</span>'}
      </div>
    </td>
    <td class="align-middle">
      ${dueDateDisplay}
    </td>
    <td class="align-middle">
      ${statusBadge}
    </td>
    <td class="align-middle">
      <small class="text-muted datetime-cell">${formatDateTime(task.createdAt)}</small>
    </td>
    <td class="align-middle">
      <small class="text-muted datetime-cell">${formatDateTime(task.updatedAt)}</small>
    </td>
    <td class="align-middle">
      <div class="btn-group btn-group-sm" role="group">
        <button class="btn btn-outline-primary edit-btn" data-task-id="${task.taskId}" title="編集">
          編集
        </button>
        ${task.status === 'done' 
          ? `<button class="btn btn-outline-warning toggle-status-btn" data-task-id="${task.taskId}" data-current-status="${task.status}" title="未完了に戻す">
              未完了
            </button>`
          : `<button class="btn btn-outline-success toggle-status-btn" data-task-id="${task.taskId}" data-current-status="${task.status}" title="完了にする">
              完了
            </button>`
        }
        <button class="btn btn-outline-danger delete-btn" data-task-id="${task.taskId}" title="削除">
          削除
        </button>
      </div>
    </td>
  `;

  // 編集ボタンのイベントリスナー
  const editBtn = tr.querySelector('.edit-btn');
  editBtn.addEventListener('click', () => openEditModal(task));

  // ステータス切り替えボタンのイベントリスナー
  const toggleStatusBtn = tr.querySelector('.toggle-status-btn');
  if (toggleStatusBtn) {
    toggleStatusBtn.addEventListener('click', () => toggleTaskStatus(task.taskId, task.status === 'done' ? 'todo' : 'done'));
  }

  // 削除ボタンのイベントリスナー
  const deleteBtn = tr.querySelector('.delete-btn');
  deleteBtn.addEventListener('click', () => confirmDeleteTask(task.taskId, task.title));

  return tr;
}

/**
 * 編集モーダルを開く
 */
function openEditModal(task) {
  // フォームに現在の値を設定
  document.getElementById('edit-task-id').value = task.taskId;
  document.getElementById('edit-title').value = task.title;
  document.getElementById('edit-description').value = task.description || '';
  document.getElementById('edit-dueDate').value = task.dueDate || '';
  document.getElementById('edit-status').value = task.status;

  // モーダルを表示
  const modal = new bootstrap.Modal(document.getElementById('editTaskModal'));
  modal.show();
}

/**
 * タスク編集を保存
 */
async function saveTaskEdit() {
  const taskId = document.getElementById('edit-task-id').value;
  const title = document.getElementById('edit-title').value;
  const description = document.getElementById('edit-description').value;
  const dueDate = document.getElementById('edit-dueDate').value;
  const status = document.getElementById('edit-status').value;

  if (!title || title.trim().length === 0) {
    showAlert('タイトルは必須です', 'danger');
    return;
  }

  const saveBtn = document.getElementById('save-edit-btn');
  const spinner = document.getElementById('edit-spinner');
  
  saveBtn.disabled = true;
  spinner.classList.remove('d-none');

  try {
    await updateTask(taskId, {
      title: title.trim(),
      description: description.trim(),
      dueDate: dueDate || null,
      status: status
    });

    // モーダルを閉じる
    const modal = bootstrap.Modal.getInstance(document.getElementById('editTaskModal'));
    modal.hide();

    showAlert('タスクを更新しました', 'success');
    displayTasks();
  } catch (error) {
    showAlert(`タスクの更新に失敗しました: ${error.message}`, 'danger');
  } finally {
    saveBtn.disabled = false;
    spinner.classList.add('d-none');
  }
}

/**
 * タスクのステータスを切り替え（完了/未完了）
 */
async function toggleTaskStatus(taskId, newStatus) {
  const statusText = newStatus === 'done' ? '完了' : '未完了';
  
  if (!confirm(`タスクを「${statusText}」に変更しますか？`)) {
    return;
  }

  try {
    await updateTask(taskId, {
      status: newStatus
    });

    showAlert(`タスクを「${statusText}」に変更しました`, 'success');
    displayTasks();
  } catch (error) {
    showAlert(`ステータスの変更に失敗しました: ${error.message}`, 'danger');
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
 * 編集フォームの保存ボタンイベント
 */
document.getElementById('save-edit-btn').addEventListener('click', () => {
  saveTaskEdit();
});

/**
 * ページ読み込み時にタスク一覧を表示
 */
document.addEventListener('DOMContentLoaded', () => {
  displayTasks();
});

