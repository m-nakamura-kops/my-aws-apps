'use client';

/**
 * 認証コンテキスト（WBS 2-2 ログイン・認証画面）
 *
 * - 認証の正は API の token と roleFlag（localStorage）。Cognito はオプション。
 * - checkAuth: 初回・リロード時に localStorage または Cognito から状態を復元。roleFlag は常に localStorage を参照。
 * - login: API ログイン → token/roleFlag を保存 → Cognito 設定があれば signIn（失敗しても API 成功なら継続）。
 * - logout: Cognito signOut + localStorage クリア。401 時は api-client 側で localStorage クリア＋/login リダイレクトも可。
 * @see apps/qr-attendance/docs/FE_2-2_LOGIN_AUTH_IMPLEMENTATION_PLAN.md
 * @see apps/qr-attendance/docs/SECURITY_DESIGN.md
 */

import React, { createContext, useContext, useEffect, useState } from 'react';
import { Amplify } from 'aws-amplify';
import { signIn, signUp, signOut, getCurrentUser, confirmSignIn, updatePassword } from 'aws-amplify/auth';
import type { SignInOutput, SignUpOutput, AuthUser } from 'aws-amplify/auth';
import { apiClient } from '@/lib/api-client';
import { NewPasswordRequiredError } from '@/lib/auth-errors';

// Amplify設定（クライアントコンポーネントで実行）
if (typeof window !== 'undefined') {
  Amplify.configure({
    Auth: {
      Cognito: {
        userPoolId: process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID || '',
        userPoolClientId: process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID || '',
        region:
          process.env.NEXT_PUBLIC_COGNITO_REGION ||
          process.env.NEXT_PUBLIC_AWS_REGION ||
          'ap-northeast-1',
        loginWith: {
          email: true,
        },
        signUpVerificationMethod: 'code',
        userAttributes: {
          email: {
            required: true,
          },
        },
      },
    },
  } as any, { ssr: false });
}

export enum UserRole {
  USER = 1,      // 利用者
  STAFF = 2,     // スタッフ等
  ADMIN = 3,     // 管理者
}

function mapCognitoChangePasswordError(err: unknown): Error {
  const e = err as Record<string, unknown> & { underlyingError?: { name?: string; message?: string } };
  const name =
    (typeof e?.name === 'string' && e.name) ||
    (typeof e?.underlyingError?.name === 'string' && e.underlyingError.name) ||
    '';
  const msg = typeof e?.message === 'string' ? e.message : '';
  if (name === 'NotAuthorizedException' || msg.includes('NotAuthorizedException')) {
    const lower = msg.toLowerCase();
    if (lower.includes('access token') || lower.includes('expired') || lower.includes('session')) {
      return new Error('セッションの有効期限が切れています。ログアウトしてから再度ログインしてください。');
    }
    return new Error('現在のパスワードが正しくありません。');
  }
  if (name === 'InvalidPasswordException' || msg.includes('InvalidPasswordException')) {
    return new Error(
      '新しいパスワードが要件を満たしていません（8文字以上、およびユーザープールの文字種ルールに準拠してください）。'
    );
  }
  if (name === 'LimitExceededException') {
    return new Error('試行回数が多すぎます。しばらくしてから再度お試しください。');
  }
  if (name === 'InvalidParameterException') {
    return new Error('入力内容が無効です。');
  }
  return new Error(msg || 'パスワードの変更に失敗しました。もう一度お試しください。');
}

interface AuthContextType {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  /** Cognito User Pool + Client ID がフロントに設定されている（ChangePassword 等が使える） */
  isCognitoEnabled: boolean;
  roleFlag: number | null;
  role: UserRole | null;
  roleLabel: string;
  isAdmin: boolean;
  isStaff: boolean;
  login: (email: string, password: string) => Promise<SignInOutput>;
  /** Cognito 初回パスワード設定完了後、API トークン取得まで行う */
  completeNewPassword: (email: string, newPassword: string) => Promise<void>;
  /** ログイン中ユーザーが Cognito ChangePassword でパスワードを更新（AccessToken 必須） */
  changeOwnPassword: (previousPassword: string, proposedPassword: string) => Promise<void>;
  register: (email: string, password: string, nameKanji: string, nameKana: string, tel: string) => Promise<SignUpOutput>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [roleFlag, setRoleFlag] = useState<number | null>(null);

  const checkAuth = async () => {
    try {
      const cognitoUserPoolId = process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID || '';
      const cognitoClientId = process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID || '';
      
      if (cognitoUserPoolId && cognitoClientId) {
        // Cognito設定がある場合: Cognitoから認証状態を取得
        const currentUser = await getCurrentUser();
        setUser(currentUser);
      } else {
        // Cognito設定がない場合: ローカルストレージのトークンから認証状態を判定
        const authToken = localStorage.getItem('authToken');
        if (authToken) {
          // トークンが存在する場合は、ダミーのuserオブジェクトを設定
          // トークンからemailを取得（Base64デコード）
          try {
            const decoded = atob(authToken);
            const tokenPayload = JSON.parse(decoded);
            setUser({
              userId: tokenPayload.email || 'user',
              username: tokenPayload.email || 'user',
              signInDetails: {
                loginId: tokenPayload.email || 'user',
              },
            } as AuthUser);
          } catch {
            // トークンの解析に失敗した場合でも、トークンが存在すれば認証済みとみなす
            setUser({
              userId: 'user',
              username: 'user',
              signInDetails: {
                loginId: 'user',
              },
            } as AuthUser);
          }
        } else {
          setUser(null);
        }
      }
      
      // ローカルストレージからroleFlagを読み込む
      const storedRoleFlag = localStorage.getItem('roleFlag');
      if (storedRoleFlag) {
        setRoleFlag(parseInt(storedRoleFlag, 10));
      }
    } catch (error) {
      // Cognitoエラーの場合でも、ローカルストレージにトークンがあれば認証済みとみなす
      const authToken = localStorage.getItem('authToken');
      if (authToken) {
        try {
          const decoded = atob(authToken);
          const tokenPayload = JSON.parse(decoded);
          setUser({
            userId: tokenPayload.email || 'user',
            username: tokenPayload.email || 'user',
            signInDetails: {
              loginId: tokenPayload.email || 'user',
            },
          } as AuthUser);
        } catch {
          setUser({
            userId: 'user',
            username: 'user',
            signInDetails: {
              loginId: 'user',
            },
          } as AuthUser);
        }
      } else {
        setUser(null);
      }
      // トークン復元時は roleFlag も localStorage から復元
      const storedRoleFlag = localStorage.getItem('roleFlag');
      if (storedRoleFlag) {
        setRoleFlag(parseInt(storedRoleFlag, 10));
      } else {
        setRoleFlag(null);
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    checkAuth();
  }, []);

  const persistApiSession = async (response: {
    token: string;
    refreshToken?: string;
    roleFlag?: number;
  }) => {
    if (response.token) {
      localStorage.setItem('authToken', response.token);
      localStorage.setItem('refreshToken', response.refreshToken || '');
      if (response.roleFlag !== undefined) {
        localStorage.setItem('roleFlag', String(response.roleFlag));
        setRoleFlag(response.roleFlag);
      }
    }
  };

  const completeNewPassword = async (email: string, newPassword: string) => {
    const cognitoUserPoolId = process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID || '';
    const cognitoClientId = process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID || '';
    if (!cognitoUserPoolId || !cognitoClientId) {
      throw new Error('Cognito が未設定のため、初回パスワード設定は利用できません。');
    }
    const { isSignedIn } = await confirmSignIn({ challengeResponse: newPassword });
    if (!isSignedIn) {
      throw new Error('パスワード設定を完了できませんでした。ログイン画面からやり直してください。');
    }
    const response = await apiClient.login(email, newPassword);
    await persistApiSession(response);
    await checkAuth();
  };

  const login = async (email: string, password: string) => {
    const cognitoUserPoolId = process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID || '';
    const cognitoClientId = process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID || '';

    if (cognitoUserPoolId && cognitoClientId) {
      const out = await signIn({ username: email, password });
      const step = out.nextStep?.signInStep;
      const needsNewPassword =
        step === 'CONFIRM_SIGN_IN_WITH_NEW_PASSWORD_REQUIRED' ||
        (typeof step === 'string' && step.toUpperCase().includes('NEW_PASSWORD'));
      if (needsNewPassword) {
        throw new NewPasswordRequiredError(email);
      }
      if (!out.isSignedIn) {
        throw new Error(
          step ? `追加の認証手順が必要です: ${step}` : 'ログインに失敗しました'
        );
      }
      const response = await apiClient.login(email, password);
      await persistApiSession(response);
      await checkAuth();
      return out;
    }

    const response = await apiClient.login(email, password);
    await persistApiSession(response);

    const authToken = localStorage.getItem('authToken');
    if (authToken) {
      try {
        const decoded = atob(authToken);
        const tokenPayload = JSON.parse(decoded);
        setUser({
          userId: tokenPayload.email || email,
          username: tokenPayload.email || email,
          signInDetails: {
            loginId: tokenPayload.email || email,
          },
        } as AuthUser);
      } catch {
        setUser({
          userId: email,
          username: email,
          signInDetails: {
            loginId: email,
          },
        } as AuthUser);
      }
    }
    await checkAuth();
    return {
      isSignedIn: true,
      nextStep: {
        signInStep: 'DONE',
      },
    } as SignInOutput;
  };

  const register = async (
    email: string,
    password: string,
    nameKanji: string,
    nameKana: string,
    tel: string
  ) => {
    // API経由でユーザー登録（Cognito + DB登録）
    const response = await apiClient.register({
      email,
      password,
      name_kanji: nameKanji,
      name_kana: nameKana,
      tel,
    });
    
    // Cognitoでもサインアップ（Amplify UIとの統合のため）
    // ローカル開発環境ではCognito設定がない場合があるため、スキップ
    const cognitoUserPoolId = process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID || '';
    const cognitoClientId = process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID || '';
    
    if (cognitoUserPoolId && cognitoClientId) {
      try {
        const output = await signUp({
          username: email,
          password,
          options: {
            userAttributes: {
              email,
            },
          },
        });
        return output;
      } catch (cognitoError: any) {
        // Cognitoエラーは警告のみ（データベースには登録済み）
        console.warn('Cognito registration failed, but database registration succeeded:', cognitoError);
        // ダミーのSignUpOutputを返す
        return {
          userId: email,
          nextStep: {
            signUpStep: 'DONE',
          },
        } as SignUpOutput;
      }
    } else {
      // Cognito設定がない場合は、データベース登録のみで完了
      console.log('Cognito not configured, skipping Cognito registration');
      return {
        userId: email,
        nextStep: {
          signUpStep: 'DONE',
        },
      } as SignUpOutput;
    }
  };

  const changeOwnPassword = async (previousPassword: string, proposedPassword: string) => {
    const cognitoUserPoolId = process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID || '';
    const cognitoClientId = process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID || '';
    if (!cognitoUserPoolId || !cognitoClientId) {
      throw new Error('Cognito が未設定のため、ここからパスワードを変更できません。');
    }
    try {
      await updatePassword({
        oldPassword: previousPassword,
        newPassword: proposedPassword,
      });
    } catch (err) {
      throw mapCognitoChangePasswordError(err);
    }
  };

  const logout = async () => {
    const cognitoUserPoolId = process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID || '';
    const cognitoClientId = process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID || '';

    if (cognitoUserPoolId && cognitoClientId) {
      try {
        await signOut();
      } catch (err: any) {
        console.warn('Cognito signOut failed (e.g. UserPool not configured):', err?.message);
      }
    }

    setUser(null);
    setRoleFlag(null);
    localStorage.removeItem('authToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('roleFlag');
  };

  const role = roleFlag ? (roleFlag as UserRole) : null;
  const isAdmin = role === UserRole.ADMIN;
  const isStaff = role === UserRole.STAFF || role === UserRole.ADMIN;
  const roleLabel =
    role === UserRole.ADMIN ? '管理者' : role === UserRole.STAFF ? 'スタッフ' : '利用者';
  const isCognitoEnabled = !!(
    process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID && process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID
  );

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        isCognitoEnabled,
        roleFlag,
        role,
        roleLabel,
        isAdmin,
        isStaff,
        login,
        completeNewPassword,
        changeOwnPassword,
        register,
        logout,
        checkAuth,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
