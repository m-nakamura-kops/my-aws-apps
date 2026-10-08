/**
 * Cognito と DB(users) の同期ヘルパー
 * 招待・登録・ログインで Cognito のみ / DB のみ の片側欠落を防ぐ。
 */
import { CognitoIdentityProviderClient } from '@aws-sdk/client-cognito-identity-provider';
import type { PoolConnection } from 'mysql2/promise';
export declare function getCognitoClient(): CognitoIdentityProviderClient;
export declare function getUserPoolId(): string;
export declare function getCognitoClientId(): string;
export declare function isCognitoConfigured(): boolean;
export declare function randomPlaceholderPasswordHash(): string;
export declare function hashPasswordSha256(password: string): string;
export type DbUserRow = {
    email: string;
    password: string;
    name_kanji: string | null;
    name_kana: string | null;
    tel: string | null;
    org_id: string | null;
    role_flag: number;
    remarks?: string | null;
};
export declare function findDbUser(conn: PoolConnection, email: string): Promise<DbUserRow | null>;
export declare function upsertDbUser(conn: PoolConnection, params: {
    email: string;
    passwordHash: string;
    name_kanji: string;
    name_kana: string;
    tel: string;
    org_id?: string | null;
    remarks?: string | null;
    role_flag: number;
    /** 既存ユーザーの role を強制更新するか（スタッフ招待で 2 にする等） */
    forceRole?: boolean;
}): Promise<{
    created: boolean;
}>;
export declare function deleteDbUser(conn: PoolConnection, email: string): Promise<void>;
/**
 * 招待用: Cognito にユーザーを作成（仮パスワードメール送信）。
 * 既存なら属性更新のみ（再招待は呼び出し側で Reset を判断）。
 */
export declare function ensureCognitoInvitedUser(params: {
    email: string;
    name?: string;
    resendInviteIfExists?: boolean;
}): Promise<{
    created: boolean;
    invitationSent: boolean;
    message: string;
}>;
export declare function deleteCognitoUser(email: string): Promise<void>;
/** セルフ登録: Cognito SignUp + 必要なら自動確認 */
export declare function ensureCognitoSelfRegisteredUser(params: {
    email: string;
    password: string;
    name?: string;
}): Promise<{
    created: boolean;
}>;
export declare function getCognitoUserAttributes(email: string): Promise<Record<string, string> | null>;
/**
 * Cognito 認証成功後に DB 行が無ければ作成する。
 */
export declare function ensureDbUserFromCognitoAuth(conn: PoolConnection, email: string, opts?: {
    name_kanji?: string;
    role_flag?: number;
}): Promise<DbUserRow>;
/**
 * DB のみ存在するユーザー向け: Cognito に恒久パスワードでユーザーを作成する。
 */
export declare function ensureCognitoUserFromDbCredentials(params: {
    email: string;
    password: string;
    name?: string;
}): Promise<void>;
export declare function initiateUserPasswordAuth(email: string, password: string): Promise<import("@aws-sdk/client-cognito-identity-provider").InitiateAuthCommandOutput>;
//# sourceMappingURL=cognito-db-sync.d.ts.map