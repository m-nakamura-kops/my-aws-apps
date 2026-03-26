import * as cdk from 'aws-cdk-lib';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as path from 'path';
import { Construct } from 'constructs';

export interface QrAttendanceCognitoStackProps extends cdk.StackProps {
  /**
   * 招待・再設定メールに記載するログインURL（例: https://app.example.com/login）
   * デプロイ時: cdk deploy -c frontendLoginUrl=https://.../login または FRONTEND_LOGIN_URL
   */
  frontendLoginUrl?: string;
}

export class QrAttendanceCognitoStack extends cdk.Stack {
  public readonly userPool: cognito.UserPool;
  public readonly userPoolClient: cognito.UserPoolClient;

  constructor(scope: Construct, id: string, props: QrAttendanceCognitoStackProps) {
    super(scope, id, props);

    const frontendLoginUrl = props.frontendLoginUrl ?? 'https://example.com/login';

    // Cognito User Pool作成
    this.userPool = new cognito.UserPool(this, 'UserPool', {
      userPoolName: 'qr-attendance-users',
      signInAliases: {
        email: true,
      },
      autoVerify: {
        email: true,
      },
      passwordPolicy: {
        minLength: 8,
        requireLowercase: true,
        requireUppercase: true,
        requireDigits: true,
        requireSymbols: false,
      },
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      removalPolicy: cdk.RemovalPolicy.DESTROY, // 開発環境用、本番ではRETAIN推奨
    });

    // サインアップを許可（AllowAdminCreateUserOnlyをfalseに設定）
    const cfnUserPool = this.userPool.node.defaultChild as cognito.CfnUserPool;
    cfnUserPool.adminCreateUserConfig = {
      allowAdminCreateUserOnly: false,
      // CustomMessage Lambda が主だが、Lambda 障害時のフォールバック用（日本語・{username}/{####} は Cognito が置換）
      inviteMessageTemplate: {
        emailSubject: '【重要】出席管理システムへのご招待とパスワード設定のお願い',
        emailMessage: `{username} 様\n\n出席管理システムへの登録招待が届いています。\n現時点では、まだ登録は完了しておりません。\n\n以下のURLからログイン画面へ進み、通知された「仮パスワード」を使用して、ご自身で新しいパスワードを設定してください。\n\n■ログインおよび設定用URL\n${frontendLoginUrl}\n\n■仮パスワード\n仮パスワード：{####}\n\n※ログイン後、すぐにパスワード変更画面が表示されます。\n※本メールは送信専用です。返信は受け付けておりません。\n`,
      },
    };

    const customMessageFn = new lambda.Function(this, 'CognitoCustomMessage', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../lambda-functions/cognito-custom-message')),
      environment: {
        FRONTEND_LOGIN_URL: frontendLoginUrl,
      },
      description: 'Cognito CustomMessage: 招待・パスワード再設定メール（日本語）',
      timeout: cdk.Duration.seconds(10),
    });

    this.userPool.addTrigger(cognito.UserPoolOperation.CUSTOM_MESSAGE, customMessageFn);

    // User Pool Client作成
    this.userPoolClient = new cognito.UserPoolClient(this, 'UserPoolClient', {
      userPool: this.userPool,
      userPoolClientName: 'qr-attendance-client',
      generateSecret: false, // フロントエンドから直接アクセスするためfalse
      authFlows: {
        userPassword: true,
        userSrp: true,
      },
      preventUserExistenceErrors: false, // サインアップを許可
      refreshTokenValidity: cdk.Duration.days(30),
      accessTokenValidity: cdk.Duration.hours(24),
      idTokenValidity: cdk.Duration.hours(24),
    });

    // 出力
    new cdk.CfnOutput(this, 'UserPoolId', {
      value: this.userPool.userPoolId,
      description: 'Cognito User Pool ID',
      exportName: `${this.stackName}-UserPoolId`,
    });

    new cdk.CfnOutput(this, 'UserPoolClientId', {
      value: this.userPoolClient.userPoolClientId,
      description: 'Cognito User Pool Client ID',
      exportName: `${this.stackName}-UserPoolClientId`,
    });

    new cdk.CfnOutput(this, 'UserPoolArn', {
      value: this.userPool.userPoolArn,
      description: 'Cognito User Pool ARN',
      exportName: `${this.stackName}-UserPoolArn`,
    });

    new cdk.CfnOutput(this, 'FrontendLoginUrlInEmails', {
      value: frontendLoginUrl,
      description: '招待メールに埋め込むログインURL（変更時はスタックを再デプロイ）',
    });
  }
}
