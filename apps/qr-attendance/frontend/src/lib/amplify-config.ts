/**
 * AWS Amplify設定
 */
import { Amplify } from 'aws-amplify';

// Cognito の Pool ID / Client ID は公開識別子であり、秘密情報ではない。
// Amplify のビルド環境変数を優先し、未設定でも本番認証が動作するよう
// 現在の prod スタックの値をフォールバックとして使用する。
export const COGNITO_USER_POOL_ID =
  process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID || 'ap-northeast-1_9rrjpioAm';
export const COGNITO_CLIENT_ID =
  process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID || '2q6ca3s3u7jc76tm6856jk32ab';
export const COGNITO_REGION =
  process.env.NEXT_PUBLIC_COGNITO_REGION ||
  process.env.NEXT_PUBLIC_AWS_REGION ||
  'ap-northeast-1';

const amplifyConfig = {
  Auth: {
    Cognito: {
      userPoolId: COGNITO_USER_POOL_ID,
      userPoolClientId: COGNITO_CLIENT_ID,
      region: COGNITO_REGION,
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
  API: {
    REST: {
      qrAttendanceApi: {
        endpoint: process.env.NEXT_PUBLIC_API_URL || '',
        region: process.env.NEXT_PUBLIC_AWS_REGION || 'ap-northeast-1',
      },
    },
  },
};

Amplify.configure(amplifyConfig as any, { ssr: true });

export default amplifyConfig;
