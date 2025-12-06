// Notion API連携用のJavaScript

class NotionClient {
    constructor(apiKey) {
        this.apiKey = apiKey;
        this.baseUrl = 'https://api.notion.com/v1';
    }

    async queryDatabase(databaseId) {
        try {
            const response = await fetch(`${this.baseUrl}/databases/${databaseId}/query`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'Notion-Version': '2022-06-28',
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || 'Failed to query database');
            }

            return await response.json();
        } catch (error) {
            console.error('Error querying Notion database:', error);
            throw error;
        }
    }

    async getPage(pageId) {
        try {
            const response = await fetch(`${this.baseUrl}/pages/${pageId}`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'Notion-Version': '2022-06-28'
                }
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || 'Failed to get page');
            }

            return await response.json();
        } catch (error) {
            console.error('Error getting Notion page:', error);
            throw error;
        }
    }

    async getPageContent(pageId) {
        try {
            const response = await fetch(`${this.baseUrl}/blocks/${pageId}/children`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'Notion-Version': '2022-06-28'
                }
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || 'Failed to get page content');
            }

            return await response.json();
        } catch (error) {
            console.error('Error getting page content:', error);
            throw error;
        }
    }

    async testConnection() {
        try {
            // ユーザー情報を取得して接続をテスト
            const response = await fetch(`${this.baseUrl}/users/me`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'Notion-Version': '2022-06-28'
                }
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || '接続に失敗しました');
            }

            const user = await response.json();
            return {
                success: true,
                user: user
            };
        } catch (error) {
            console.error('Connection test failed:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    async getDatabaseStructure(databaseId) {
        try {
            // データベースIDからハイフンを削除（APIはハイフンなしでも動作）
            const cleanId = databaseId.replace(/-/g, '');
            
            const response = await fetch(`${this.baseUrl}/databases/${cleanId}`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'Notion-Version': '2022-06-28'
                }
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || 'データベースの取得に失敗しました');
            }

            return await response.json();
        } catch (error) {
            console.error('Error getting database structure:', error);
            throw error;
        }
    }

    extractDatabaseIdFromUrl(url) {
        // Notion URLからデータベースIDを抽出
        // 例: https://www.notion.so/workspace/2a924e2ab5e9813f9cfac90cfa2041a1?v=...
        const match = url.match(/notion\.so\/[^\/]+\/([a-f0-9]{32})/);
        if (match) {
            return match[1];
        }
        // ハイフン付きの形式も試す
        const match2 = url.match(/notion\.so\/[^\/]+\/([a-f0-9-]{36})/);
        if (match2) {
            return match2[1].replace(/-/g, '');
        }
        return null;
    }

    formatProperty(property) {
        if (!property) return '';

        switch (property.type) {
            case 'title':
                return property.title.map(t => t.plain_text).join('');
            case 'rich_text':
                return property.rich_text.map(t => t.plain_text).join('');
            case 'number':
                return property.number;
            case 'select':
                return property.select?.name || '';
            case 'multi_select':
                return property.multi_select.map(s => s.name).join(', ');
            case 'date':
                return property.date ? new Date(property.date.start).toLocaleDateString() : '';
            case 'checkbox':
                return property.checkbox ? '✓' : '✗';
            case 'url':
                return property.url || '';
            case 'email':
                return property.email || '';
            case 'phone_number':
                return property.phone_number || '';
            default:
                return JSON.stringify(property);
        }
    }
}

// UI管理クラス
class NotionUI {
    constructor() {
        this.client = null;
        this.init();
    }

    init() {
        // デフォルトのAPIキー
        const defaultApiKey = 'ntn_E99013565214T4wg8jHhYVzp494xwL7YR5Q7vpQ4P6vfJA';
        
        // 保存されたAPIキーを読み込む（なければデフォルトを使用）
        const savedApiKey = localStorage.getItem('notion_api_key') || defaultApiKey;
        
        if (savedApiKey) {
            document.getElementById('api-key-input').value = savedApiKey;
            this.connect(savedApiKey).then(() => {
                // 接続成功後、指定されたデータベースの構造を確認
                const databaseUrl = 'https://www.notion.so/fantamstick/2a924e2ab5e9813f9cfac90cfa2041a1?v=2ab24e2ab5e980cf8aaf000cced17c32';
                setTimeout(() => {
                    this.checkDatabaseStructure(databaseUrl);
                }, 500);
            });
        }
    }

    async connect(apiKey) {
        if (!apiKey) {
            alert('APIキーを入力してください');
            return;
        }

        // 接続状態を「接続中」に変更
        const statusEl = document.getElementById('connection-status');
        statusEl.textContent = '接続テスト中...';
        statusEl.className = 'status testing';

        this.client = new NotionClient(apiKey);
        
        // 実際にAPIに接続できるかテスト
        const testResult = await this.client.testConnection();
        
        if (testResult.success) {
            localStorage.setItem('notion_api_key', apiKey);
            statusEl.textContent = '✓ 接続成功';
            statusEl.className = 'status connected';
            document.getElementById('notion-controls').style.display = 'block';
            
            // 接続情報を表示
            const resultsDiv = document.getElementById('results');
            resultsDiv.innerHTML = `
                <div class="connection-info">
                    <h3>✓ Notionに接続できました</h3>
                    <p><strong>ユーザー:</strong> ${testResult.user.name || testResult.user.id}</p>
                    <p><strong>タイプ:</strong> ${testResult.user.type}</p>
                </div>
            `;
        } else {
            statusEl.textContent = '✗ 接続失敗';
            statusEl.className = 'status error';
            document.getElementById('notion-controls').style.display = 'none';
            
            const resultsDiv = document.getElementById('results');
            resultsDiv.innerHTML = `
                <div class="error">
                    <h3>✗ 接続に失敗しました</h3>
                    <p>エラー: ${testResult.error}</p>
                    <p>APIキーが正しいか、Notion Integrationが有効になっているか確認してください。</p>
                </div>
            `;
        }
    }

    disconnect() {
        this.client = null;
        localStorage.removeItem('notion_api_key');
        document.getElementById('api-key-input').value = '';
        document.getElementById('connection-status').textContent = '未接続';
        document.getElementById('connection-status').className = 'status disconnected';
        document.getElementById('notion-controls').style.display = 'none';
        document.getElementById('results').innerHTML = '';
    }

    async loadDatabase() {
        const urlOrId = document.getElementById('database-url-input').value.trim();
        if (!urlOrId) {
            alert('データベースURLまたはIDを入力してください');
            return;
        }

        // URLからデータベースIDを抽出、またはそのままIDとして使用
        let databaseId = this.client.extractDatabaseIdFromUrl(urlOrId) || urlOrId.trim();
        
        if (!databaseId) {
            alert('データベースIDを取得できませんでした');
            return;
        }

        const resultsDiv = document.getElementById('results');
        resultsDiv.innerHTML = '<p>読み込み中...</p>';

        try {
            const data = await this.client.queryDatabase(databaseId);
            this.displayDatabaseResults(data);
        } catch (error) {
            resultsDiv.innerHTML = `<p class="error">エラー: ${error.message}</p>`;
        }
    }

    async checkDatabaseStructure(urlOrId) {
        if (!this.client) {
            alert('まず接続してください');
            return;
        }

        const resultsDiv = document.getElementById('results');
        resultsDiv.innerHTML = '<p>データベース構造を確認中...</p>';

        try {
            // URLからデータベースIDを抽出、またはそのままIDとして使用
            let databaseId = this.client.extractDatabaseIdFromUrl(urlOrId) || urlOrId.trim();
            
            if (!databaseId) {
                throw new Error('データベースIDを取得できませんでした');
            }

            // データベース構造を取得
            const database = await this.client.getDatabaseStructure(databaseId);
            
            // データベース情報を表示
            let html = '<div class="database-structure">';
            html += '<h3>📊 データベース構造</h3>';
            
            // タイトルの取得（複数の形式に対応）
            let title = 'タイトルなし';
            if (database.title && Array.isArray(database.title) && database.title.length > 0) {
                title = this.client.formatProperty({type: 'title', title: database.title});
            } else if (database.title && typeof database.title === 'object') {
                title = this.client.formatProperty(database.title);
            }
            
            html += `<p><strong>タイトル:</strong> ${title}</p>`;
            html += `<p><strong>データベースID:</strong> <code>${database.id}</code></p>`;
            
            // プロパティ（カラム）の情報を表示
            if (database.properties) {
                html += '<h4>プロパティ（カラム）一覧:</h4>';
                html += '<div class="properties-list">';
                
                for (const [key, prop] of Object.entries(database.properties)) {
                    html += '<div class="property-item">';
                    html += `<strong>${key}</strong> `;
                    html += `<span class="property-type">[${prop.type}]</span>`;
                    
                    // タイプ別の詳細情報
                    if (prop.type === 'select' && prop.select?.options) {
                        html += `<div class="property-options">選択肢: ${prop.select.options.map(o => o.name).join(', ')}</div>`;
                    } else if (prop.type === 'multi_select' && prop.multi_select?.options) {
                        html += `<div class="property-options">選択肢: ${prop.multi_select.options.map(o => o.name).join(', ')}</div>`;
                    } else if (prop.type === 'relation' && prop.relation) {
                        html += `<div class="property-options">関連データベース: ${prop.relation.database_id}</div>`;
                    } else if (prop.type === 'formula' && prop.formula) {
                        html += `<div class="property-options">式: ${JSON.stringify(prop.formula)}</div>`;
                    }
                    
                    html += '</div>';
                }
                
                html += '</div>';
            }
            
            html += '</div>';
            
            // データも取得して表示
            html += '<hr>';
            html += '<h4>データサンプル（最初の5件）:</h4>';
            try {
                const data = await this.client.queryDatabase(databaseId);
                if (data.results && data.results.length > 0) {
                    html += `<p>全${data.results.length}件中、最初の5件を表示:</p>`;
                    html += '<div class="notion-results">';
                    
                    data.results.slice(0, 5).forEach((page, index) => {
                        html += `<div class="notion-item">`;
                        html += `<h5>項目 ${index + 1}</h5>`;
                        
                        if (page.properties) {
                            html += '<ul>';
                            for (const [key, value] of Object.entries(page.properties)) {
                                const formatted = this.client.formatProperty(value);
                                html += `<li><strong>${key}:</strong> ${formatted || '(空)'}</li>`;
                            }
                            html += '</ul>';
                        }
                        
                        html += `</div>`;
                    });
                    
                    html += '</div>';
                } else {
                    html += '<p>データがありません</p>';
                }
            } catch (dataError) {
                html += `<p class="error">データの取得に失敗: ${dataError.message}</p>`;
            }
            
            resultsDiv.innerHTML = html;
            
        } catch (error) {
            resultsDiv.innerHTML = `<div class="error"><h3>エラー</h3><p>${error.message}</p></div>`;
        }
    }

    displayDatabaseResults(data) {
        const resultsDiv = document.getElementById('results');
        
        if (!data.results || data.results.length === 0) {
            resultsDiv.innerHTML = '<p>データが見つかりませんでした</p>';
            return;
        }

        let html = '<h3>データベース結果:</h3>';
        html += `<p>${data.results.length}件の結果</p>`;
        html += '<div class="notion-results">';

        data.results.forEach((page, index) => {
            html += `<div class="notion-item">`;
            html += `<h4>項目 ${index + 1}</h4>`;
            
            // プロパティを表示
            if (page.properties) {
                html += '<ul>';
                for (const [key, value] of Object.entries(page.properties)) {
                    const formatted = this.client.formatProperty(value);
                    html += `<li><strong>${key}:</strong> ${formatted}</li>`;
                }
                html += '</ul>';
            }
            
            html += `</div>`;
        });

        html += '</div>';
        resultsDiv.innerHTML = html;
    }
}

// グローバルインスタンス
let notionUI;

// ページ読み込み時に初期化
document.addEventListener('DOMContentLoaded', () => {
    notionUI = new NotionUI();
});

