/**
 * APIクライアント
 */

function getApiBaseUrl(): string {
  const env = process.env.NEXT_PUBLIC_API_URL || '';
  if (env) return env;
  if (typeof window !== 'undefined' && window.location?.hostname === 'localhost') {
    return 'http://localhost:3001';
  }
  return '';
}

const API_BASE_URL = getApiBaseUrl();

export interface ApiError {
  error: string;
  message: string;
  details?: any;
}

export class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  /** リクエスト時に参照。SSR/ビルド時は baseUrl が空になるため、ブラウザでは localhost:3001 を補正 */
  private getBaseUrl(): string {
    if (this.baseUrl) return this.baseUrl;
    if (typeof window !== 'undefined' && window.location?.hostname === 'localhost') {
      return 'http://localhost:3001';
    }
    return '';
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.getBaseUrl()}${endpoint}`;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };

    // 管理者API・認証が必要なAPI用: ローカルストレージのトークンを付与
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('authToken');
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
    }
    
    try {
      const response = await fetch(url, {
        ...options,
        headers,
      });

      if (!response.ok) {
        let error: ApiError;
        try {
          error = await response.json();
        } catch {
          error = {
            error: 'UNKNOWN_ERROR',
            message: `HTTP ${response.status}: ${response.statusText}`,
          };
        }
        
        // より詳細なエラーメッセージを構築
        let errorMessage = error.message || error.error || `HTTP ${response.status}`;
        
        // HTTPステータスコードに基づいたメッセージ
        if (response.status === 400) {
          errorMessage = `リクエストが無効です: ${errorMessage}`;
        } else if (response.status === 401) {
          errorMessage = `認証が必要です: ${errorMessage}`;
        } else if (response.status === 403) {
          errorMessage = `アクセスが拒否されました: ${errorMessage}`;
        } else if (response.status === 404) {
          errorMessage = `リソースが見つかりません: ${errorMessage}`;
        } else if (response.status === 500) {
          errorMessage = error.details
            ? `サーバーエラー: ${String(error.details)}`
            : `サーバーエラーが発生しました: ${errorMessage}`;
        } else if (response.status >= 500) {
          errorMessage = `サーバーエラー (${response.status}): ${errorMessage}`;
        }
        
        const enhancedError = new Error(errorMessage);
        (enhancedError as any).status = response.status;
        (enhancedError as any).originalError = error;
        throw enhancedError;
      }

      return response.json();
    } catch (error: any) {
      // ネットワークエラー（接続拒否・バックエンド未起動など）
      const baseUrl = this.getBaseUrl();
      const isLocalApi = typeof window !== 'undefined' && baseUrl.includes('localhost:3001');
      if (error.name === 'TypeError' && (error.message?.includes('fetch') || error.message?.includes('Failed to fetch'))) {
        throw new Error(
          isLocalApi
            ? 'ネットワークエラー: バックエンド（localhost:3001）に接続できません。別ターミナルで「cd apps/qr-attendance/backend && npx ts-node local-server.ts」を実行してAPIサーバーを起動してください。'
            : 'ネットワークエラー: サーバーに接続できません。インターネット接続を確認してください。'
        );
      }
      
      // タイムアウトエラーの処理
      if (error.name === 'AbortError') {
        throw new Error('リクエストがタイムアウトしました。しばらく待ってから再試行してください。');
      }
      
      // その他のエラーはそのまま再スロー
      throw error;
    }
  }

  async login(email: string, password: string) {
    return this.request<{
      token: string;
      refreshToken: string;
      userId: string;
      userName: string;
      orgId: string | null;
      roleFlag: number;
    }>('/v1/users/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  }

  async register(data: {
    email: string;
    password: string;
    name_kanji: string;
    name_kana: string;
    tel: string;
  }) {
    return this.request<{
      userId: string;
      status: string;
    }>('/v1/users/register', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // イベント管理API
  async createEvent(data: {
    event_name: string;
    event_date: string;
    location?: string;
    capacity?: number;
    summary?: string;
  }) {
    return this.request<{
      eventId: number;
      event: any;
    }>('/v1/admin/events', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  /** スタッフ・管理者用イベント一覧（打刻スキャン時のイベント選択に使用） */
  async listEventsForStaff(params?: { limit?: number; offset?: number }) {
    const queryParams = new URLSearchParams();
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    if (params?.offset) queryParams.append('offset', params.offset.toString());
    const query = queryParams.toString();
    return this.request<{
      events: Array<{
        event_id: number;
        event_name: string;
        event_date: string;
        location: string | null;
        capacity: number | null;
        summary: string | null;
        created_at: string;
        updated_at: string;
      }>;
      pagination: { total: number; limit: number; offset: number; hasMore: boolean };
    }>(`/v1/events${query ? `?${query}` : ''}`, { method: 'GET' });
  }

  async listEvents(params?: {
    limit?: number;
    offset?: number;
    start_date?: string;
    end_date?: string;
  }) {
    const queryParams = new URLSearchParams();
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    if (params?.offset) queryParams.append('offset', params.offset.toString());
    if (params?.start_date) queryParams.append('start_date', params.start_date);
    if (params?.end_date) queryParams.append('end_date', params.end_date);

    const query = queryParams.toString();
    return this.request<{
      events: Array<{
        event_id: number;
        event_name: string;
        event_date: string;
        location: string | null;
        capacity: number | null;
        summary: string | null;
        created_at: string;
        updated_at: string;
      }>;
      pagination: {
        total: number;
        limit: number;
        offset: number;
        hasMore: boolean;
      };
    }>(`/v1/admin/events${query ? `?${query}` : ''}`, {
      method: 'GET',
    });
  }

  async updateEvent(eventId: number, data: {
    event_name?: string;
    event_date?: string;
    location?: string;
    capacity?: number;
    summary?: string;
  }) {
    return this.request<{
      event: any;
    }>(`/v1/admin/events/${eventId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteEvent(eventId: number) {
    return this.request<{
      message: string;
      eventId: number;
    }>(`/v1/admin/events/${eventId}`, {
      method: 'DELETE',
    });
  }

  async generateQRCode(eventId: number) {
    return this.request<{
      event_id: number;
      event_name: string;
      qr_code_data: string;
      qr_code_url: string;
      signature: string;
      expires_at: string;
    }>(`/v1/admin/events/${eventId}/qr`, {
      method: 'GET',
    });
  }

  async punchAttendance(data: {
    qr_code_data: string;
    signature: string;
    email: string;
  }) {
    return this.request<{
      log_id: number;
      action: 'in' | 'out';
      in_time: string;
      out_time?: string;
      message: string;
    }>('/v1/users/attendance', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  /** 利用者用マイQR取得（スマホで表示用）。有効期限約10分 */
  async getMyQrData() {
    return this.request<{
      qr_code_data: string;
      signature: string;
      expires_at: string;
    }>('/v1/users/me/qr', { method: 'GET' });
  }

  /** スタッフが利用者のQRをスキャンして打刻（要スタッフ/管理者ログイン） */
  async punchAttendanceByScan(data: {
    qr_code_data: string;
    signature: string;
    event_id: number;
  }) {
    return this.request<{
      log_id: number;
      action: 'in' | 'out';
      in_time: string;
      out_time?: string;
      message: string;
    }>('/v1/users/attendance', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getAttendanceHistory(params?: {
    email?: string;
    event_id?: number;
    limit?: number;
    offset?: number;
    start_date?: string;
    end_date?: string;
  }) {
    const queryParams = new URLSearchParams();
    if (params?.email) queryParams.append('email', params.email);
    if (params?.event_id) queryParams.append('event_id', params.event_id.toString());
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    if (params?.offset) queryParams.append('offset', params.offset.toString());
    if (params?.start_date) queryParams.append('start_date', params.start_date);
    if (params?.end_date) queryParams.append('end_date', params.end_date);

    const query = queryParams.toString();
    return this.request<{
      logs: Array<{
        log_id: number;
        email: string;
        user_name: string;
        event_id: number;
        event_name: string;
        event_date: string;
        in_time: string;
        out_time: string | null;
        stay_minutes: number | null;
        staff_email: string;
        staff_name: string;
        created_at: string;
      }>;
      pagination: {
        total: number;
        limit: number;
        offset: number;
        hasMore: boolean;
      };
    }>(`/v1/users/attendance/history${query ? `?${query}` : ''}`, {
      method: 'GET',
    });
  }

  // イベント参加申込API
  async registerForEvent(eventId: number, email: string) {
    return this.request<{
      reg_id: number;
      email: string;
      event_id: number;
      message: string;
    }>(`/v1/users/events/${eventId}/register`, {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  }

  async unregisterFromEvent(eventId: number, email: string) {
    return this.request<{
      message: string;
      email: string;
      event_id: number;
    }>(`/v1/users/events/${eventId}/register?email=${encodeURIComponent(email)}`, {
      method: 'DELETE',
    });
  }

  async getRegistrations(params?: {
    email?: string;
    event_id?: number;
    limit?: number;
    offset?: number;
  }) {
    const queryParams = new URLSearchParams();
    if (params?.email) queryParams.append('email', params.email);
    if (params?.event_id != null) queryParams.append('event_id', params.event_id.toString());
    if (params?.limit != null) queryParams.append('limit', params.limit.toString());
    if (params?.offset != null) queryParams.append('offset', params.offset.toString());

    const query = queryParams.toString();
    return this.request<{
      registrations: Array<{
        reg_id: number;
        email: string;
        user_name: string;
        event_id: number;
        event_name: string;
        event_date: string;
        location: string | null;
        capacity: number | null;
        registration_date: string;
      }>;
      pagination: {
        total: number;
        limit: number;
        offset: number;
        hasMore: boolean;
      };
    }>(`/v1/users/registrations${query ? `?${query}` : ''}`, {
      method: 'GET',
    });
  }

  // 管理者用API
  async getEventParticipants(eventId: number, params?: {
    limit?: number;
    offset?: number;
  }) {
    const queryParams = new URLSearchParams();
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    if (params?.offset) queryParams.append('offset', params.offset.toString());

    const query = queryParams.toString();
    return this.request<{
      event_id: number;
      event_name: string;
      event_date: string;
      participants: Array<{
        email: string;
        name_kanji: string;
        name_kana: string;
        tel: string | null;
        org_id: string | null;
        role_flag: number | null;
        registration_date: string;
      }>;
      pagination: {
        total: number;
        limit: number;
        offset: number;
        hasMore: boolean;
      };
    }>(`/v1/admin/events/${eventId}/participants${query ? `?${query}` : ''}`, {
      method: 'GET',
    });
  }

  async getEventAttendanceReport(eventId: number) {
    return this.request<{
      event_id: number;
      event_name: string;
      event_date: string;
      location: string | null;
      capacity: number | null;
      summary: {
        total_registrations: number;
        total_attendees: number;
        attendance_rate: number;
        no_show_count: number;
      };
      attendance_logs: Array<{
        log_id: number;
        email: string;
        user_name: string;
        in_time: string;
        out_time: string | null;
        stay_minutes: number | null;
        staff_email: string;
        staff_name: string;
      }>;
      statistics: {
        time_slot_distribution: Array<{
          time_slot: string;
          count: number;
        }>;
        stay_duration: {
          avg_minutes: number | null;
          min_minutes: number | null;
          max_minutes: number | null;
        } | null;
      };
    }>(`/v1/admin/events/${eventId}/attendance-report`, {
      method: 'GET',
    });
  }

  // 生徒管理API
  async listStudents(params?: {
    limit?: number;
    offset?: number;
    search?: string;
    org_id?: string;
  }) {
    const queryParams = new URLSearchParams();
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    if (params?.offset) queryParams.append('offset', params.offset.toString());
    if (params?.search) queryParams.append('search', params.search);
    if (params?.org_id) queryParams.append('org_id', params.org_id);

    const query = queryParams.toString();
    return this.request<{
      students: Array<{
        email: string;
        name_kanji: string;
        name_kana: string;
        tel: string;
        org_id: string | null;
        remarks: string | null;
        registration_date: string;
        last_attendance_date: string | null;
      }>;
      pagination: {
        total: number;
        limit: number;
        offset: number;
        hasMore: boolean;
      };
    }>(`/v1/admin/students${query ? `?${query}` : ''}`, {
      method: 'GET',
    });
  }

  async createStudent(data: {
    email: string;
    password: string;
    name_kanji: string;
    name_kana: string;
    tel: string;
    org_id?: string;
    remarks?: string;
  }) {
    return this.request<{
      userId: string;
      status: string;
      message: string;
    }>('/v1/admin/students', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateStudent(email: string, data: {
    name_kanji?: string;
    name_kana?: string;
    tel?: string;
    org_id?: string;
    remarks?: string;
    password?: string;
  }) {
    return this.request<{
      student: any;
      message: string;
    }>(`/v1/admin/students/${encodeURIComponent(email)}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteStudent(email: string) {
    return this.request<{
      message: string;
      email: string;
    }>(`/v1/admin/students/${encodeURIComponent(email)}`, {
      method: 'DELETE',
    });
  }

  /** CSVで生徒を一括登録。CSV形式: email,password,name_kanji,name_kana,tel,org_id,remarks（1行目はヘッダー可） */
  async importStudents(csv: string) {
    return this.request<{
      imported: number;
      totalRows: number;
      errors: Array<{ row: number; email?: string; message: string }>;
    }>('/v1/admin/students/import', {
      method: 'POST',
      body: JSON.stringify({ csv }),
    });
  }

  // スタッフ管理API
  async listStaffs(params?: {
    limit?: number;
    offset?: number;
    search?: string;
  }) {
    const queryParams = new URLSearchParams();
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    if (params?.offset) queryParams.append('offset', params.offset.toString());
    if (params?.search) queryParams.append('search', params.search);

    const query = queryParams.toString();
    return this.request<{
      staffs: Array<{
        email: string;
        name_kanji: string;
        name_kana: string;
        tel: string;
        org_id: string | null;
        remarks: string | null;
        role_flag: number; // 2=スタッフ, 3=管理者
        registration_date: string;
        total_attendance_records: number;
      }>;
      pagination: {
        total: number;
        limit: number;
        offset: number;
        hasMore: boolean;
      };
    }>(`/v1/admin/staffs${query ? `?${query}` : ''}`, {
      method: 'GET',
    });
  }

  async inviteStaff(data: {
    email: string;
    password?: string;
    name_kanji?: string;
    name_kana?: string;
    tel?: string;
    org_id?: string;
    remarks?: string;
  }) {
    return this.request<{
      status: string;
      invitationSent: boolean;
      email: string;
      message: string;
    }>('/v1/admin/invite', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateStaff(email: string, data: {
    name_kanji?: string;
    name_kana?: string;
    tel?: string;
    org_id?: string;
    remarks?: string;
    password?: string;
    role_flag?: number; // 2=スタッフ, 3=管理者
  }) {
    return this.request<{
      staff: any;
      message: string;
    }>(`/v1/admin/staffs/${encodeURIComponent(email)}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteStaff(email: string) {
    return this.request<{
      message: string;
      email: string;
      attendance_records_count?: number;
    }>(`/v1/admin/staffs/${encodeURIComponent(email)}`, {
      method: 'DELETE',
    });
  }
}

export const apiClient = new ApiClient(API_BASE_URL);
