/**
 * AWS Amplify設定
 */
import { Amplify } from 'aws-amplify';

const amplifyConfig = {
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
