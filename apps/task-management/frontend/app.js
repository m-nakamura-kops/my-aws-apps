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

    // テーブルヘッダーを作成または更新
    let table = tasksContainer.querySelector('table');
    if (!table) {
      table = document.createElement('table');
      table.className = 'table table-hover table-striped';
      tasksContainer.appendChild(table);
    }
    
    // テーブルヘッダーを設定（既存のテーブルがある場合も更新）
    const thead = table.querySelector('thead');
    const headerHTML = `
      <tr>
        <th style="width: 40px; min-width: 40px; max-width: 40px;" class="bulk-checkbox-column ${isBulkOperationMode ? '' : 'd-none'}">
          <input type="checkbox" id="select-all-checkbox" title="全選択">
        </th>
        <th style="width: 160px; min-width: 160px; max-width: 160px;">操作</th>
        <th style="width: 150px; min-width: 150px; max-width: 150px;">タイトル</th>
        <th style="width: 180px; min-width: 180px; max-width: 180px;">説明</th>
        <th style="width: 90px; min-width: 90px; max-width: 90px;">期日</th>
        <th style="width: 80px; min-width: 80px; max-width: 80px;">ステータス</th>
        <th style="width: 120px; min-width: 120px; max-width: 120px;">作成日時</th>
        <th style="width: 120px; min-width: 120px; max-width: 120px;">更新日時</th>
      </tr>
    `;
    if (thead) {
      thead.innerHTML = headerHTML;
    } else {
      const theadElement = document.createElement('thead');
      theadElement.className = 'table-light';
      theadElement.innerHTML = headerHTML;
      table.appendChild(theadElement);
    }
    
    // 全選択チェックボックスのイベントリスナー
    const selectAllCheckbox = document.getElementById('select-all-checkbox');
    if (selectAllCheckbox) {
      selectAllCheckbox.addEventListener('change', (e) => {
        const isChecked = e.target.checked;
        const checkboxes = document.querySelectorAll('.task-checkbox');
        checkboxes.forEach(checkbox => {
          checkbox.checked = isChecked;
          const taskId = checkbox.dataset.taskId;
          if (isChecked) {
            selectedTaskIds.add(taskId);
          } else {
            selectedTaskIds.delete(taskId);
          }
        });
        updateBulkActionsVisibility();
      });
    }
    
    // tbodyが存在しない場合は作成
    let tbody = table.querySelector('#tasks-tbody');
    if (!tbody) {
      tbody = document.createElement('tbody');
      tbody.id = 'tasks-tbody';
      table.appendChild(tbody);
    }

    // tbodyは上で既に取得または作成済み
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
  let descriptionFullText = '';
  let descriptionDisplay = '-';
  
  if (task.description) {
    try {
      // JSON形式のチェックリストデータの場合
      const descriptionData = JSON.parse(task.description);
      if (Array.isArray(descriptionData) && descriptionData.length > 0) {
        // テキストが入力されているタスクのみをフィルタ
        const tasksWithText = descriptionData.filter(item => item.text && item.text.trim().length > 0);
        if (tasksWithText.length > 0) {
          const items = tasksWithText.map(item => {
            const prefix = item.checked ? '✓ ' : '☐ ';
            return prefix + item.text;
          });
          descriptionFullText = items.join('\n');
          // 最初のアイテムを表示（30文字まで）
          const firstItem = items[0];
          const firstItemText = firstItem.length > 30 ? firstItem.substring(0, 30) + '...' : firstItem;
          descriptionDisplay = firstItemText;
          // 複数件の場合は件数を追加
          if (tasksWithText.length > 1) {
            descriptionDisplay += ` (+${tasksWithText.length - 1}件)`;
          }
        } else {
          descriptionDisplay = '-';
        }
      } else {
        // 通常のテキストの場合
        descriptionFullText = task.description;
        descriptionDisplay = task.description.length > 30 
          ? task.description.substring(0, 30) + '...' 
          : task.description;
      }
    } catch (e) {
      // 通常のテキストの場合
      descriptionFullText = task.description;
      descriptionDisplay = task.description.length > 30 
        ? task.description.substring(0, 30) + '...' 
        : task.description;
    }
  }

  tr.innerHTML = `
    <td class="align-middle bulk-checkbox-column ${isBulkOperationMode ? '' : 'd-none'}">
      <input type="checkbox" class="task-checkbox" data-task-id="${task.taskId}" title="選択">
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
    <td class="align-middle task-title-cell" title="${titleFullText}">
      ${isBulkEditMode && selectedTaskIds.has(task.taskId)
        ? `<input type="text" class="form-control form-control-sm bulk-edit-title" data-task-id="${task.taskId}" value="${escapeHtml(task.title)}" maxlength="200">`
        : `<strong class="task-title-text">${escapeHtml(titleDisplay)}</strong>`
      }
    </td>
    <td class="align-middle task-description-cell" title="${escapeHtml(descriptionFullText)}">
      <div class="task-description-text">
        ${task.description ? escapeHtml(descriptionDisplay) : '<span class="text-muted">-</span>'}
      </div>
    </td>
    <td class="align-middle">
      ${isBulkEditMode && selectedTaskIds.has(task.taskId)
        ? `<input type="date" class="form-control form-control-sm bulk-edit-due-date" data-task-id="${task.taskId}" value="${task.dueDate || ''}">`
        : dueDateDisplay
      }
    </td>
    <td class="align-middle">
      ${isBulkEditMode && selectedTaskIds.has(task.taskId)
        ? `<select class="form-select form-select-sm bulk-edit-status" data-task-id="${task.taskId}">
            <option value="todo" ${task.status === 'todo' ? 'selected' : ''}>未完了</option>
            <option value="done" ${task.status === 'done' ? 'selected' : ''}>完了</option>
          </select>`
        : statusBadge
      }
    </td>
    <td class="align-middle">
      <small class="text-muted datetime-cell">${formatDateTime(task.createdAt)}</small>
    </td>
    <td class="align-middle">
      <small class="text-muted datetime-cell">${formatDateTime(task.updatedAt)}</small>
    </td>
  `;

  // チェックボックスのイベントリスナー
  const checkbox = tr.querySelector('.task-checkbox');
  if (checkbox) {
    checkbox.addEventListener('change', (e) => {
      const taskId = e.target.dataset.taskId;
      if (e.target.checked) {
        selectedTaskIds.add(taskId);
      } else {
        selectedTaskIds.delete(taskId);
      }
      updateBulkActionsVisibility();
      updateSelectAllCheckbox();
    });
    
    // 既に選択されている場合はチェック状態を設定
    if (selectedTaskIds.has(task.taskId)) {
      checkbox.checked = true;
    }
  }

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

  // 行全体のクリック/タップイベントリスナー（操作カラムのボタン以外をクリックした場合に編集画面を開く）
  tr.addEventListener('click', (e) => {
    // チェックボックスまたは一括編集モードの場合は何もしない
    if (e.target.classList.contains('task-checkbox') || 
        e.target.classList.contains('bulk-edit-title') ||
        e.target.classList.contains('bulk-edit-due-date') ||
        e.target.classList.contains('bulk-edit-status') ||
        isBulkEditMode) {
      return;
    }
    
    // クリックされた要素が操作カラム内のボタンの場合は何もしない
    const clickedElement = e.target;
    const isActionButton = clickedElement.closest('.btn-group') || 
                          clickedElement.classList.contains('btn') ||
                          clickedElement.closest('.btn');
    
    // 操作カラム内のボタンでない場合のみ編集画面を開く
    if (!isActionButton) {
      openEditModal(task);
    }
  });

  return tr;
}

/**
 * 編集モーダルを開く
 */
function openEditModal(task) {
  // フォームに現在の値を設定
  document.getElementById('edit-task-id').value = task.taskId;
  document.getElementById('edit-title').value = task.title;
  setDescriptionData('edit-description-checklist', editDescriptionItems, task.description || '');
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
  const description = descriptionDataToString(editDescriptionItems);
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
 * 説明文チェックリストの管理
 */
let descriptionItems = [];
let editDescriptionItems = [];

// 完了確認モーダル用の変数
let pendingCompleteTaskId = null;
let pendingCompleteTitle = null;

// 一括操作用の変数
let selectedTaskIds = new Set();
let isBulkEditMode = false;
let isBulkOperationMode = false; // 一括操作モード（チェックボックス表示状態）
let allTasks = []; // タスク一覧を保持

/**
 * 説明文チェックリストのカウントを更新
 */
function updateDescriptionCount(itemsArray, countElementId) {
  const countElement = document.getElementById(countElementId);
  if (!countElement) return;
  
  // テキストが入力されているタスクのみをカウント
  const tasksWithText = itemsArray.filter(item => item.text && item.text.trim().length > 0);
  const checkedTasks = tasksWithText.filter(item => item.checked);
  
  if (tasksWithText.length === 0) {
    // タスクが入力されていない場合は非表示
    countElement.style.display = 'none';
  } else {
    // カウントを表示
    countElement.textContent = `(${checkedTasks.length}/${tasksWithText.length})`;
    countElement.style.display = 'inline';
  }
}

/**
 * 全てのチェックボックスがチェックされているか確認し、完了確認モーダルを表示
 */
function checkAndShowCompleteModal(itemsArray, containerId) {
  // 編集モーダル内でのみ動作
  if (containerId !== 'edit-description-checklist') {
    return;
  }
  
  // テキストが入力されているタスクのみをチェック
  const tasksWithText = itemsArray.filter(item => item.text && item.text.trim().length > 0);
  
  // タスクが1つもない場合は何もしない
  if (tasksWithText.length === 0) {
    return;
  }
  
  // 全てのタスクがチェックされているか確認
  const allChecked = tasksWithText.every(item => item.checked);
  
  if (allChecked) {
    // タスクIDとタイトルを取得
    const taskId = document.getElementById('edit-task-id').value;
    const taskTitle = document.getElementById('edit-title').value;
    
    if (taskId && taskTitle) {
      pendingCompleteTaskId = taskId;
      pendingCompleteTitle = taskTitle;
      
      // 確認モーダルを表示
      const messageElement = document.getElementById('complete-task-message');
      messageElement.textContent = `「${taskTitle}」を完了にしますか？`;
      
      const modal = new bootstrap.Modal(document.getElementById('completeTaskModal'));
      modal.show();
    }
  }
}

/**
 * 説明文チェックリストのアイテムを作成
 */
function createDescriptionItem(checked = false, text = '', containerId, itemsArray, skipArrayPush = false) {
  const item = { checked, text };
  if (!skipArrayPush) {
    const index = itemsArray.length;
    itemsArray.push(item);
  }

  const container = document.getElementById(containerId);
  const itemDiv = document.createElement('div');
  const index = itemsArray.length - 1;
  itemDiv.className = `description-item ${checked ? 'checked' : ''}`;
  itemDiv.dataset.index = index;

  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.checked = checked;
  // テキストが空の場合はチェックボックスを無効化
  checkbox.disabled = !text || text.trim().length === 0;
  checkbox.addEventListener('change', () => {
    const currentIndex = parseInt(itemDiv.dataset.index);
    if (itemsArray[currentIndex]) {
      itemsArray[currentIndex].checked = checkbox.checked;
      itemDiv.classList.toggle('checked', checkbox.checked);
      // カウントを更新
      const countElementId = containerId === 'description-checklist' ? 'description-count' : 'edit-description-count';
      updateDescriptionCount(itemsArray, countElementId);
      // 全てチェックされているか確認し、完了確認モーダルを表示
      checkAndShowCompleteModal(itemsArray, containerId);
    }
  });

  const textInput = document.createElement('input');
  textInput.type = 'text';
  textInput.value = text;
  textInput.placeholder = '説明を入力... Enterキーで新しい行を追加';
  textInput.maxLength = 2000;
  
  // IME入力状態を追跡
  let isComposing = false;
  let compositionEndTime = 0;
  
  textInput.addEventListener('compositionstart', () => {
    isComposing = true;
  });
  
  textInput.addEventListener('compositionend', () => {
    isComposing = false;
    compositionEndTime = Date.now();
  });
  
  textInput.addEventListener('input', () => {
    const currentIndex = parseInt(itemDiv.dataset.index);
    if (itemsArray[currentIndex]) {
      itemsArray[currentIndex].text = textInput.value;
      // テキストが入力されたらチェックボックスを有効化、空なら無効化
      const hasText = textInput.value.trim().length > 0;
      checkbox.disabled = !hasText;
      // テキストが空になった場合、チェックを外す
      if (!hasText && checkbox.checked) {
        checkbox.checked = false;
        itemsArray[currentIndex].checked = false;
        itemDiv.classList.remove('checked');
      }
    }
  });
  
  // Enterキーで新しい行を追加（IME確定直後は無視、スマホの「次へ」ボタンは有効）
  textInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      // IME確定直後（100ms以内）のEnterキーは無視
      const timeSinceCompositionEnd = Date.now() - compositionEndTime;
      if (isComposing || (compositionEndTime > 0 && timeSinceCompositionEnd < 100)) {
        return; // IME確定のEnterキーなので無視
      }
      
      e.preventDefault();
      e.stopPropagation();
      const currentIndex = parseInt(itemDiv.dataset.index);
      if (itemsArray[currentIndex]) {
        itemsArray[currentIndex].text = textInput.value;
      }
      // 新しい行を追加（現在の行の次）
      const newIndex = currentIndex + 1;
      itemsArray.splice(newIndex, 0, { checked: false, text: '' });
      updateDescriptionChecklist(containerId, itemsArray);
      // カウントを更新
      const countElementId = containerId === 'description-checklist' ? 'description-count' : 'edit-description-count';
      updateDescriptionCount(itemsArray, countElementId);
      // 新しく追加された行のテキスト入力欄にフォーカス
      setTimeout(() => {
        const updatedContainer = document.getElementById(containerId);
        const newItemDiv = updatedContainer.querySelector(`[data-index="${newIndex}"]`);
        if (newItemDiv) {
          const newTextInput = newItemDiv.querySelector('input[type="text"]');
          if (newTextInput) {
            newTextInput.focus();
            // スマホではselect()が動作しない場合があるので、focus()のみ
            if (newTextInput.setSelectionRange) {
              newTextInput.setSelectionRange(0, 0);
            }
          }
        }
      }, 10);
    }
  });

  const deleteBtn = document.createElement('button');
  deleteBtn.type = 'button';
  deleteBtn.className = 'btn btn-sm btn-outline-danger delete-item-btn';
  deleteBtn.textContent = '削除';
  deleteBtn.addEventListener('click', () => {
    const currentIndex = parseInt(itemDiv.dataset.index);
    itemsArray.splice(currentIndex, 1);
    updateDescriptionChecklist(containerId, itemsArray);
    // カウントを更新
    const countElementId = containerId === 'description-checklist' ? 'description-count' : 'edit-description-count';
    updateDescriptionCount(itemsArray, countElementId);
  });

  itemDiv.appendChild(checkbox);
  itemDiv.appendChild(textInput);
  itemDiv.appendChild(deleteBtn);
  container.appendChild(itemDiv);
}

/**
 * 説明文チェックリストを更新
 */
function updateDescriptionChecklist(containerId, itemsArray) {
  const container = document.getElementById(containerId);
  container.innerHTML = '';
  
  // アイテムを再作成（配列を一時的に保存）
  const tempArray = itemsArray.map(item => ({ ...item }));
  itemsArray.length = 0;
  
  tempArray.forEach((item) => {
    itemsArray.push({ ...item });
    const index = itemsArray.length - 1;
    const itemDiv = document.createElement('div');
    itemDiv.className = `description-item ${item.checked ? 'checked' : ''}`;
    itemDiv.dataset.index = index;

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = item.checked;
    // テキストが空の場合はチェックボックスを無効化
    checkbox.disabled = !item.text || item.text.trim().length === 0;
    checkbox.addEventListener('change', () => {
      itemsArray[index].checked = checkbox.checked;
      itemDiv.classList.toggle('checked', checkbox.checked);
      // カウントを更新
      const countElementId = containerId === 'description-checklist' ? 'description-count' : 'edit-description-count';
      updateDescriptionCount(itemsArray, countElementId);
      // 全てチェックされているか確認し、完了確認モーダルを表示
      checkAndShowCompleteModal(itemsArray, containerId);
    });

    const textInput = document.createElement('input');
    textInput.type = 'text';
    textInput.value = item.text;
    textInput.placeholder = '説明を入力... Enterキーで新しい行を追加';
    textInput.maxLength = 2000;
    
    // IME入力状態を追跡
    let isComposing = false;
    let compositionEndTime = 0;
    
    textInput.addEventListener('compositionstart', () => {
      isComposing = true;
    });
    
    textInput.addEventListener('compositionend', () => {
      isComposing = false;
      compositionEndTime = Date.now();
    });
    
    textInput.addEventListener('input', () => {
      itemsArray[index].text = textInput.value;
      // テキストが入力されたらチェックボックスを有効化、空なら無効化
      const hasText = textInput.value.trim().length > 0;
      checkbox.disabled = !hasText;
      // テキストが空になった場合、チェックを外す
      if (!hasText && checkbox.checked) {
        checkbox.checked = false;
        itemsArray[index].checked = false;
        itemDiv.classList.remove('checked');
      }
      // カウントを更新
      const countElementId = containerId === 'description-checklist' ? 'description-count' : 'edit-description-count';
      updateDescriptionCount(itemsArray, countElementId);
    });
    
    // Enterキーで新しい行を追加（IME確定直後は無視、スマホの「次へ」ボタンは有効）
    textInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        // IME確定直後（100ms以内）のEnterキーは無視
        const timeSinceCompositionEnd = Date.now() - compositionEndTime;
        if (isComposing || (compositionEndTime > 0 && timeSinceCompositionEnd < 100)) {
          return; // IME確定のEnterキーなので無視
        }
        
        e.preventDefault();
        e.stopPropagation();
        itemsArray[index].text = textInput.value;
        // 新しい行を追加（現在の行の次）
        const newIndex = index + 1;
        itemsArray.splice(newIndex, 0, { checked: false, text: '' });
        updateDescriptionChecklist(containerId, itemsArray);
        // カウントを更新
        const countElementId = containerId === 'description-checklist' ? 'description-count' : 'edit-description-count';
        updateDescriptionCount(itemsArray, countElementId);
        // 新しく追加された行のテキスト入力欄にフォーカス
        setTimeout(() => {
          const updatedContainer = document.getElementById(containerId);
          const newItemDiv = updatedContainer.querySelector(`[data-index="${newIndex}"]`);
          if (newItemDiv) {
            const newTextInput = newItemDiv.querySelector('input[type="text"]');
            if (newTextInput) {
              newTextInput.focus();
              // スマホではselect()が動作しない場合があるので、focus()のみ
              if (newTextInput.setSelectionRange) {
                newTextInput.setSelectionRange(0, 0);
              }
            }
          }
        }, 10);
      }
    });

    const deleteBtn = document.createElement('button');
    deleteBtn.type = 'button';
    deleteBtn.className = 'btn btn-sm btn-outline-danger delete-item-btn';
    deleteBtn.textContent = '削除';
    deleteBtn.addEventListener('click', () => {
      itemsArray.splice(index, 1);
      updateDescriptionChecklist(containerId, itemsArray);
      // カウントはupdateDescriptionChecklist内で更新される
    });

    itemDiv.appendChild(checkbox);
    itemDiv.appendChild(textInput);
    itemDiv.appendChild(deleteBtn);
    container.appendChild(itemDiv);
  });
  
  // カウントを更新
  const countElementId = containerId === 'description-checklist' ? 'description-count' : 'edit-description-count';
  updateDescriptionCount(itemsArray, countElementId);
}

/**
 * 説明文チェックリストからデータを取得
 */
function getDescriptionData(itemsArray) {
  return itemsArray.map(item => ({
    checked: item.checked,
    text: item.text
  }));
}

/**
 * 説明文チェックリストにデータを設定
 */
function setDescriptionData(containerId, itemsArray, data) {
  itemsArray.length = 0;
  if (data && data.length > 0) {
    // JSON形式のデータの場合
    if (typeof data === 'string') {
      try {
        const parsed = JSON.parse(data);
        if (Array.isArray(parsed)) {
          itemsArray.push(...parsed);
        } else {
          // 改行区切りのテキストの場合
          const lines = data.split('\n').filter(line => line.trim());
          lines.forEach(line => {
            itemsArray.push({ checked: false, text: line });
          });
        }
      } catch (e) {
        // 改行区切りのテキストの場合
        const lines = data.split('\n').filter(line => line.trim());
        lines.forEach(line => {
          itemsArray.push({ checked: false, text: line });
        });
      }
    } else if (Array.isArray(data)) {
      itemsArray.push(...data);
    }
  }
  updateDescriptionChecklist(containerId, itemsArray);
  // カウントを更新
  const countElementId = containerId === 'description-checklist' ? 'description-count' : 'edit-description-count';
  updateDescriptionCount(itemsArray, countElementId);
}

/**
 * 説明文チェックリストのデータを文字列に変換（保存用）
 */
function descriptionDataToString(itemsArray) {
  return JSON.stringify(itemsArray);
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
    description: descriptionDataToString(descriptionItems),
    dueDate: document.getElementById('dueDate').value || null,
    status: document.getElementById('status').value
  };

  try {
    await createTask(formData);
    showAlert('タスクを追加しました', 'success');
    e.target.reset();
    descriptionItems = [];
    updateDescriptionChecklist('description-checklist', descriptionItems);
    updateDescriptionCount(descriptionItems, 'description-count');
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
 * 行を追加ボタンのイベントリスナー
 */
document.getElementById('add-description-item-btn').addEventListener('click', () => {
  createDescriptionItem(false, '', 'description-checklist', descriptionItems);
  updateDescriptionCount(descriptionItems, 'description-count');
});

document.getElementById('add-edit-description-item-btn').addEventListener('click', () => {
  createDescriptionItem(false, '', 'edit-description-checklist', editDescriptionItems);
  updateDescriptionCount(editDescriptionItems, 'edit-description-count');
});

/**
 * 完了確認モーダルのイベントリスナー
 */
document.addEventListener('DOMContentLoaded', () => {
  // 完了確認モーダルの「はい」ボタン
  document.getElementById('confirm-complete-btn').addEventListener('click', async () => {
    if (pendingCompleteTaskId) {
      try {
        const taskId = pendingCompleteTaskId;
        const title = document.getElementById('edit-title').value;
        const description = descriptionDataToString(editDescriptionItems);
        const dueDate = document.getElementById('edit-dueDate').value;
        
        // タスクを保存（ステータスを「完了」にして、説明のチェックリストも含めて保存）
        await updateTask(taskId, {
          title: title.trim(),
          description: description.trim(),
          dueDate: dueDate || null,
          status: 'done'
        });
        
        // 完了確認モーダルを閉じる
        const completeModal = bootstrap.Modal.getInstance(document.getElementById('completeTaskModal'));
        completeModal.hide();
        
        // 編集モーダルを閉じる
        const editModal = bootstrap.Modal.getInstance(document.getElementById('editTaskModal'));
        editModal.hide();
        
        showAlert('タスクを完了にしました', 'success');
        
        // タスク一覧を更新
        displayTasks();
        
        pendingCompleteTaskId = null;
        pendingCompleteTitle = null;
      } catch (error) {
        showAlert(`タスクの更新に失敗しました: ${error.message}`, 'danger');
      }
    }
  });

  // 完了確認モーダルの「いいえ」ボタン
  document.getElementById('cancel-complete-btn').addEventListener('click', () => {
    // 「いいえ」が選択された場合、最後にチェックしたチェックボックスを外す
    if (pendingCompleteTaskId && editDescriptionItems.length > 0) {
      // 最後にチェックされたアイテムを見つけてチェックを外す
      for (let i = editDescriptionItems.length - 1; i >= 0; i--) {
        if (editDescriptionItems[i].checked && editDescriptionItems[i].text && editDescriptionItems[i].text.trim().length > 0) {
          editDescriptionItems[i].checked = false;
          updateDescriptionChecklist('edit-description-checklist', editDescriptionItems);
          break;
        }
      }
    }
    pendingCompleteTaskId = null;
    pendingCompleteTitle = null;
  });
});

/**
 * 一括操作モードを開始
 */
function enterBulkOperationMode() {
  isBulkOperationMode = true;
  
  // 「一括操作」ボタンを非表示
  const bulkOperationBtn = document.getElementById('bulk-operation-btn');
  if (bulkOperationBtn) {
    bulkOperationBtn.classList.add('d-none');
  }
  
  // 一括操作ボタン（編集、削除、キャンセル）を表示
  const bulkActions = document.getElementById('bulk-actions');
  if (bulkActions) {
    bulkActions.classList.remove('d-none');
  }
  
  // チェックボックスを表示
  displayTasks(); // テーブルを再描画してチェックボックスを表示
}

/**
 * 一括操作モードを終了
 */
function exitBulkOperationMode() {
  isBulkOperationMode = false;
  
  // 選択をクリア
  selectedTaskIds.clear();
  
  // 一括編集モードも終了
  if (isBulkEditMode) {
    exitBulkEditMode();
  }
  
  // 「一括操作」ボタンを表示
  const bulkOperationBtn = document.getElementById('bulk-operation-btn');
  if (bulkOperationBtn) {
    bulkOperationBtn.classList.remove('d-none');
  }
  
  // 一括操作ボタン（編集、削除、キャンセル）を非表示
  const bulkActions = document.getElementById('bulk-actions');
  if (bulkActions) {
    bulkActions.classList.add('d-none');
  }
  
  // チェックボックスを非表示
  displayTasks(); // テーブルを再描画してチェックボックスを非表示
}

/**
 * 一括操作ボタンの表示状態を更新
 */
function updateBulkActionsVisibility() {
  const bulkActions = document.getElementById('bulk-actions');
  if (bulkActions && isBulkOperationMode) {
    // 一括操作モード中は常に表示
    bulkActions.classList.remove('d-none');
    
    // 選択がない場合は編集・削除ボタンを無効化
    const editBtn = document.getElementById('bulk-edit-btn');
    const deleteBtn = document.getElementById('bulk-delete-btn');
    
    if (selectedTaskIds.size === 0) {
      if (editBtn) editBtn.disabled = true;
      if (deleteBtn) deleteBtn.disabled = true;
    } else {
      if (editBtn) editBtn.disabled = false;
      if (deleteBtn) deleteBtn.disabled = false;
    }
  }
}

/**
 * 全選択チェックボックスの状態を更新
 */
function updateSelectAllCheckbox() {
  const selectAllCheckbox = document.getElementById('select-all-checkbox');
  if (selectAllCheckbox) {
    const checkboxes = document.querySelectorAll('.task-checkbox');
    const checkedCount = Array.from(checkboxes).filter(cb => cb.checked).length;
    selectAllCheckbox.checked = checkboxes.length > 0 && checkedCount === checkboxes.length;
    selectAllCheckbox.indeterminate = checkedCount > 0 && checkedCount < checkboxes.length;
  }
}

/**
 * 一括編集モードを開始
 */
function enterBulkEditMode() {
  isBulkEditMode = true;
  displayTasks(); // テーブルを再描画して編集可能なフィールドを表示
}

/**
 * 一括編集モードを終了
 */
function exitBulkEditMode() {
  isBulkEditMode = false;
  displayTasks(); // テーブルを再描画して通常表示に戻す
}

/**
 * 一括編集を保存
 */
async function saveBulkEdit() {
  const selectedTasks = allTasks.filter(task => selectedTaskIds.has(task.taskId));
  
  if (selectedTasks.length === 0) {
    showAlert('選択されたタスクがありません', 'warning');
    return;
  }

  const saveBtn = document.getElementById('bulk-edit-btn');
  const originalText = saveBtn.textContent;
  saveBtn.disabled = true;
  saveBtn.textContent = '保存中...';

  try {
    const updatePromises = selectedTasks.map(async (task) => {
      const titleInput = document.querySelector(`.bulk-edit-title[data-task-id="${task.taskId}"]`);
      const dueDateInput = document.querySelector(`.bulk-edit-due-date[data-task-id="${task.taskId}"]`);
      const statusSelect = document.querySelector(`.bulk-edit-status[data-task-id="${task.taskId}"]`);

      const updateData = {};
      
      if (titleInput && titleInput.value.trim() !== task.title) {
        updateData.title = titleInput.value.trim();
      }
      
      if (dueDateInput) {
        const newDueDate = dueDateInput.value || null;
        if (newDueDate !== (task.dueDate || null)) {
          updateData.dueDate = newDueDate;
        }
      }
      
      if (statusSelect && statusSelect.value !== task.status) {
        updateData.status = statusSelect.value;
      }

      if (Object.keys(updateData).length > 0) {
        await updateTask(task.taskId, updateData);
      }
    });

    await Promise.all(updatePromises);
    
    showAlert(`${selectedTasks.length}件のタスクを更新しました`, 'success');
    
    // 一括編集モードを終了
    exitBulkEditMode();
    selectedTaskIds.clear();
    updateBulkActionsVisibility();
    displayTasks();
  } catch (error) {
    showAlert(`一括編集に失敗しました: ${error.message}`, 'danger');
  } finally {
    saveBtn.disabled = false;
    saveBtn.textContent = originalText;
  }
}

/**
 * 一括削除を実行
 */
async function executeBulkDelete() {
  const selectedTasks = allTasks.filter(task => selectedTaskIds.has(task.taskId));
  
  if (selectedTasks.length === 0) {
    showAlert('選択されたタスクがありません', 'warning');
    return;
  }

  try {
    const deletePromises = selectedTasks.map(task => deleteTask(task.taskId));
    await Promise.all(deletePromises);
    
    showAlert(`${selectedTasks.length}件のタスクを削除しました`, 'success');
    
    // 選択をクリア
    selectedTaskIds.clear();
    updateBulkActionsVisibility();
    updateSelectAllCheckbox();
    displayTasks();
  } catch (error) {
    showAlert(`一括削除に失敗しました: ${error.message}`, 'danger');
  }
}

/**
 * ページ読み込み時にタスク一覧を表示
 */
document.addEventListener('DOMContentLoaded', () => {
  displayTasks();
  // 初期状態で1行追加
  createDescriptionItem(false, '', 'description-checklist', descriptionItems);
  
  // 一括操作ボタンのイベントリスナー
  document.getElementById('bulk-operation-btn').addEventListener('click', () => {
    enterBulkOperationMode();
  });
  
  // 一括操作キャンセルボタンのイベントリスナー
  document.getElementById('cancel-bulk-operation-btn').addEventListener('click', () => {
    exitBulkOperationMode();
  });
  
  // 一括編集ボタンのイベントリスナー
  document.getElementById('bulk-edit-btn').addEventListener('click', () => {
    if (selectedTaskIds.size === 0) {
      showAlert('タスクを選択してください', 'warning');
      return;
    }
    
    if (isBulkEditMode) {
      // 既に一括編集モードの場合は保存
      saveBulkEdit();
    } else {
      // 一括編集モードを開始
      enterBulkEditMode();
      document.getElementById('bulk-edit-btn').textContent = '保存';
    }
  });
  
  // 一括削除ボタンのイベントリスナー
  document.getElementById('bulk-delete-btn').addEventListener('click', () => {
    if (selectedTaskIds.size === 0) {
      showAlert('タスクを選択してください', 'warning');
      return;
    }
    
    // 一括削除確認モーダルを表示
    const countElement = document.getElementById('bulk-delete-count');
    countElement.textContent = `選択されたタスク: ${selectedTaskIds.size}件`;
    
    const modal = new bootstrap.Modal(document.getElementById('bulkDeleteModal'));
    modal.show();
  });
  
  // 一括削除確認モーダルの「はい」ボタン
  document.getElementById('confirm-bulk-delete-btn').addEventListener('click', async () => {
    const modal = bootstrap.Modal.getInstance(document.getElementById('bulkDeleteModal'));
    modal.hide();
    await executeBulkDelete();
  });
  
  // 一括削除確認モーダルの「いいえ」ボタン
  document.getElementById('cancel-bulk-delete-btn').addEventListener('click', () => {
    // 何もしない（モーダルは自動的に閉じられる）
  });
});

