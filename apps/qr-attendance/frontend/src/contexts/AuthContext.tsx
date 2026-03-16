'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { Amplify } from 'aws-amplify';
import { signIn, signUp, signOut, getCurrentUser } from 'aws-amplify/auth';
import type { SignInOutput, SignUpOutput, AuthUser } from 'aws-amplify/auth';
import { apiClient } from '@/lib/api-client';

// Amplify設定（クライアントコンポーネントで実行）
if (typeof window !== 'undefined') {
  Amplify.configure({
    Auth: {
      Cognito: {
        userPoolId: process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID || '',
        userPoolClientId: process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID || '',
        region: process.env.NEXT_PUBLIC_AWS_REGION || 'ap-northeast-1',
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

interface AuthContextType {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  roleFlag: number | null;
  role: UserRole | null;
  roleLabel: string;
  isAdmin: boolean;
  isStaff: boolean;
  login: (email: string, password: string) => Promise<SignInOutput>;
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
      setRoleFlag(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    checkAuth();
  }, []);

  const login = async (email: string, password: string) => {
    // API経由でログイン（Cognito認証とDB情報取得）
    const response = await apiClient.login(email, password);
    
    // トークンとrole_flagをローカルストレージに保存
    if (response.token) {
      localStorage.setItem('authToken', response.token);
      localStorage.setItem('refreshToken', response.refreshToken || '');
      if (response.roleFlag !== undefined) {
        localStorage.setItem('roleFlag', String(response.roleFlag));
        setRoleFlag(response.roleFlag);
      }
    }
    
    // Amplifyの認証状態を更新するため、Cognitoでサインイン
    // ローカル開発環境ではCognito設定がない場合があるため、スキップ
    const cognitoUserPoolId = process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID || '';
    const cognitoClientId = process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID || '';
    
    if (cognitoUserPoolId && cognitoClientId) {
      try {
        const output = await signIn({ username: email, password });
        await checkAuth();
        return output;
      } catch (cognitoError: any) {
        // Cognitoエラーは警告のみ（APIログインは成功している）
        console.warn('Cognito signIn failed, but API login succeeded:', cognitoError);
        await checkAuth();
        // ダミーのSignInOutputを返す
        return {
          isSignedIn: true,
          nextStep: {
            signInStep: 'DONE',
          },
        } as SignInOutput;
      }
    } else {
      // Cognito設定がない場合は、APIログインのみで完了
      console.log('Cognito not configured, skipping Cognito signIn');
      // ローカルストレージのトークンからuserオブジェクトを設定
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
    }
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

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        roleFlag,
        role,
        roleLabel,
        isAdmin,
        isStaff,
        login,
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
