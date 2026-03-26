/**
 * APIクライアント
 *
 * ベース URL は下記の本番 API Gateway に固定。
 * NEXT_PUBLIC_API_URL や localhost:3001 など環境変数・フォールバックは参照しない（設定漏れ・誤設定でも常に AWS を向く）。
 */

import { NewPasswordRequiredError } from '@/lib/auth-errors';

/** 本番 API Gateway（execute-api）— ビルド・.env に依存しない */
const API_BASE_URL = 'https://xcv8usy3dh.execute-api.ap-northeast-1.amazonaws.com/prod';

function getApiBaseUrl(): string {
  return API_BASE_URL.replace(/\/+$/, '');
}

export interface ApiError {
  error: string;
  message: string;
  details?: any;
}

export class ApiClient {
  constructor() {}

  private getBaseUrl(): string {
    return getApiBaseUrl();
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const base = this.getBaseUrl();
    if (!base) {
      throw new Error(
        'NEXT_PUBLIC_API_URL が未設定です。apps/qr-attendance/frontend/.env.local に API のベース URL を設定し、開発サーバーを再起動してください。'
      );
    }
    const url = `${base}${endpoint}`;

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
      if (error.name === 'TypeError' && (error.message?.includes('fetch') || error.message?.includes('Failed to fetch'))) {
        throw new Error(
          'ネットワークエラー: API に接続できません。インターネット接続と API Gateway の稼働を確認してください。'
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
    const base = this.getBaseUrl();
    const url = `${base}/v1/users/login`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    let data: any;
    try {
      data = await response.json();
    } catch {
      throw new Error(`HTTP ${response.status}: レスポンスの解析に失敗しました`);
    }
    if (!response.ok) {
      const errorMessage =
        data?.message || data?.error || `HTTP ${response.status}: ${response.statusText}`;
      const enhancedError = new Error(
        response.status === 401 ? `認証が必要です: ${errorMessage}` : errorMessage
      );
      (enhancedError as any).status = response.status;
      throw enhancedError;
    }
    if (data?.challengeName === 'NEW_PASSWORD_REQUIRED') {
      throw new NewPasswordRequiredError(email);
    }
    return data as {
      token: string;
      refreshToken: string;
      userId: string;
      userName: string;
      orgId: string | null;
      roleFlag: number;
    };
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

  /** 現在ログイン中ユーザー情報（マイページ用）。GET /v1/users/me */
  async getMe() {
    return this.request<{
      email: string;
      name_kanji: string | null;
      name_kana: string | null;
      role_flag: number;
      org_id: string | null;
    }>('/v1/users/me', { method: 'GET' });
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

  /** 手動打刻用・生徒検索（スタッフ以上）。GET /v1/students/search?q= */
  async searchStudentsForManual(q: string) {
    const query = new URLSearchParams({ q: q.trim() }).toString();
    return this.request<{
      users: Array<{ user_id: string; name_kanji: string; name_kana: string; email: string }>;
    }>(`/v1/students/search?${query}`, { method: 'GET' });
  }

  /** 手動打刻実行（スタッフ以上）。POST /v1/attendance/manual。action: 'entry' | 'exit' で入室/退出を指定 */
  async manualPunchAttendance(data: { event_id: number; email: string; action?: 'entry' | 'exit' }) {
    return this.request<{
      log_id: number;
      message: string;
      action?: string;
      in_time?: string;
      out_time?: string;
    }>('/v1/attendance/manual', {
      method: 'POST',
      body: JSON.stringify({
        event_id: data.event_id,
        email: data.email,
        ...(data.action ? { action: data.action } : {}),
      }),
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

  /** 自分のスケジュール（申込イベント＋打刻有無）。GET /v1/users/schedule?month=YYYY-MM */
  async getSchedule(month?: string) {
    const query = month ? `?month=${encodeURIComponent(month)}` : '';
    return this.request<{
      schedule: Array<{
        event_id: number;
        event_name: string;
        event_date: string;
        location: string | null;
        capacity: number | null;
        summary: string | null;
        is_registered: boolean;
        is_attended: boolean;
      }>;
      month: string;
    }>(`/v1/users/schedule${query}`, { method: 'GET' });
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

  /** 管理者用：全申込一覧（横断・時系列）。email 不要。 */
  async getAdminRegistrations(params?: {
    limit?: number;
    offset?: number;
    event_id?: number;
    email?: string;
  }) {
    const queryParams = new URLSearchParams();
    if (params?.limit != null) queryParams.append('limit', params.limit.toString());
    if (params?.offset != null) queryParams.append('offset', params.offset.toString());
    if (params?.event_id != null) queryParams.append('event_id', params.event_id.toString());
    if (params?.email) queryParams.append('email', params.email);
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
      pagination: { total: number; limit: number; offset: number; hasMore: boolean };
    }>(`/v1/admin/registrations${query ? `?${query}` : ''}`, { method: 'GET' });
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
        in_time: string | null;
        out_time: string | null;
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

  /** 出席レポートCSVをBlobで取得（BOM付きUTF-8）。ダウンロード用。 */
  async getEventReportCsvBlob(eventId: number): Promise<Blob> {
    const url = `${this.getBaseUrl()}/v1/admin/reports/events/${eventId}/csv`;
    const headers: Record<string, string> = {};
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('authToken');
      if (token) headers['Authorization'] = `Bearer ${token}`;
    }
    const response = await fetch(url, { method: 'GET', headers });
    if (!response.ok) {
      throw new Error(response.status === 403 ? 'CSVのダウンロード権限がありません' : `CSVの取得に失敗しました (${response.status})`);
    }
    return response.blob();
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
        is_active?: boolean;
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
      invitationSent?: boolean;
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
    is_active?: boolean;
  }) {
    return this.request<{
      student: any;
      message: string;
    }>(`/v1/admin/students/${encodeURIComponent(email.trim())}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteStudent(email: string) {
    const id = email.trim();
    return this.request<{
      message: string;
      email: string;
    }>(`/v1/admin/students/${encodeURIComponent(id)}`, {
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
    role_flag?: number; // 1=利用者, 2=スタッフ, 3=管理者
  }) {
    return this.request<{
      staff: any;
      message: string;
    }>(`/v1/admin/staffs/${encodeURIComponent(email)}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  /** スタッフ／管理者ユーザーを DB および可能なら Cognito から物理削除 */
  async deleteStaff(email: string) {
    return this.request<{
      message: string;
      email: string;
      cognito_deleted?: boolean;
      cognito_error?: string;
    }>(`/v1/admin/staffs/${encodeURIComponent(email)}`, {
      method: 'DELETE',
    });
  }

  // お知らせ（利用者向け・公開・掲載期間内のみ）
  async getNews(params?: { limit?: number; page?: number }) {
    const q = new URLSearchParams();
    if (params?.limit != null) q.append('limit', params.limit.toString());
    if (params?.page != null) q.append('page', params.page.toString());
    const query = q.toString();
    return this.request<{
      news: Array<{
        id: number;
        title: string;
        content: string;
        announcement_type: number; // 1=通常, 2=重要
        published_at: string;
        expired_at: string | null;
        created_at: string;
        updated_at: string;
      }>;
      totalCount: number;
      hasNextPage: boolean;
    }>(`/v1/news${query ? `?${query}` : ''}`, { method: 'GET' });
  }

  // お知らせ管理（管理者・全件）
  async getAdminNews(params?: { limit?: number; offset?: number }) {
    const q = new URLSearchParams();
    if (params?.limit != null) q.append('limit', params.limit.toString());
    if (params?.offset != null) q.append('offset', params.offset.toString());
    const query = q.toString();
    return this.request<{
      news: Array<{
        id: number;
        title: string;
        content: string;
        is_published: boolean;
        announcement_type: number;
        published_at: string;
        expired_at: string | null;
        created_at: string;
        updated_at: string;
      }>;
      pagination: { total: number; limit: number; offset: number; hasMore: boolean };
    }>(`/v1/admin/news${query ? `?${query}` : ''}`, { method: 'GET' });
  }

  async createNews(data: {
    title: string;
    content: string;
    is_published: boolean;
    announcement_type: number; // 1=通常, 2=重要
    published_at: string;
    expired_at?: string | null;
  }) {
    return this.request<{ id: number; news: any }>(`/v1/admin/news`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateNews(id: number, data: {
    title?: string;
    content?: string;
    is_published?: boolean;
    announcement_type?: number;
    published_at?: string;
    expired_at?: string | null;
  }) {
    return this.request<{ news: any }>(`/v1/admin/news/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteNews(id: number) {
    return this.request<{ message: string; id: number }>(`/v1/admin/news/${id}`, {
      method: 'DELETE',
    });
  }
}

export const apiClient = new ApiClient();
