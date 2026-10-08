import * as cdk from 'aws-cdk-lib';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as path from 'path';
import { Construct } from 'constructs';

export interface QrAttendanceCognitoStackProps extends cdk.StackProps {
  /**
   * 招待・再設定メールに記載するログインURL（例: https://main.d2s96axh42icx2.amplifyapp.com/login）
   * デプロイ時: cdk deploy -c frontendLoginUrl=https://.../login または FRONTEND_LOGIN_URL
   */
  frontendLoginUrl?: string;
  /**
   * CustomMessage Lambda の環境変数 LOGIN_URL を明示上書きする場合に指定。
   * 未指定時: dev は https://test-okegawa-123.com/login、prod は frontendLoginUrl を使用。
   */
  loginUrl?: string;
  /**
   * 環境名（Lambda 物理名のサフィックス。例: dev → qr-attendance-custom-message-dev）
   * app.ts の CDK_ENV と一致させること。
   */
  environmentName: string;
}

export class QrAttendanceCognitoStack extends cdk.Stack {
  public readonly userPool: cognito.UserPool;
  public readonly userPoolClient: cognito.UserPoolClient;

  constructor(scope: Construct, id: string, props: QrAttendanceCognitoStackProps) {
    super(scope, id, props);

    const frontendLoginUrl =
      props.frontendLoginUrl ?? 'https://main.d2s96axh42icx2.amplifyapp.com/login';
    const envName = props.environmentName;
    /** CustomMessage Lambda の LOGIN_URL（dev 固定 / prod は本番ログインURL＝通常 frontendLoginUrl） */
    const loginUrlForCustomMessage =
      props.loginUrl ?? (envName === 'prod' ? frontendLoginUrl : 'https://test-okegawa-123.com/login');

    // CustomMessage Lambda は User Pool より先に定義し、lambdaTriggers で参照する
    const customMessageAssetPath = path.join(__dirname, '../lambda-functions/cognito-custom-message');

    // 論理 ID: CognitoCustomMessage / 物理名: qr-attendance-custom-message-{env}
    // logRetention で CloudWatch ロググループをスタックに明示し、未実行でもコンソールで確認しやすくする
    const customMessageFn = new lambda.Function(this, 'CognitoCustomMessage', {
      functionName: `qr-attendance-custom-message-${envName}`,
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset(customMessageAssetPath),
      environment: {
        FRONTEND_LOGIN_URL: frontendLoginUrl,
        LOGIN_URL: loginUrlForCustomMessage,
        // コード未変更時でも Lambda 更新を強制するためのダミー（必要に応じて値を書き換え）
        FORCE_REDEPLOY_DUMMY_TS: '2026-08-15T08:40:00Z',
      },
      description: 'Cognito CustomMessage: 招待・パスワード再設定メール',
      timeout: cdk.Duration.seconds(10),
      logRetention: logs.RetentionDays.ONE_MONTH,
    });

    // Cognito User Pool作成（L2 lambdaTriggers で CustomMessage を標準接続）
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
      lambdaTriggers: {
        customMessage: customMessageFn,
      },
    });

    // Cognito がこの Lambda を呼び出す権限（明示的に付与）
    customMessageFn.addPermission('AllowCognitoInvokeCustomMessage', {
      principal: new iam.ServicePrincipal('cognito-idp.amazonaws.com'),
      sourceArn: this.userPool.userPoolArn,
    });

    // サインアップを許可（AllowAdminCreateUserOnlyをfalseに設定）
    const cfnUserPool = this.userPool.node.defaultChild as cognito.CfnUserPool;
    cfnUserPool.adminCreateUserConfig = {
      allowAdminCreateUserOnly: false,
      /**
       * 招待メールの「静的」雛形。実運用では CustomMessage Lambda が emailMessage / smsMessage を上書きする。
       * Lambda がタイムアウト・失敗した場合のみここが使われる（上書きではない）。
       * {username} / {####} は Cognito が置換。
       */
      inviteMessageTemplate: {
        emailSubject: '【重要】出席管理システムへのご招待とパスワード設定のお願い',
        emailMessage: `{username} 様\n\n出席管理システムへの登録招待が届いています。\n以下の手順で、ログインとパスワードの本設定を完了してください。\n\n■設定手順\n1. 下記のログインURLへアクセス\n2. 通知された「仮パスワード」でログイン\n3. 画面の指示に従い、新しいパスワードを設定\n\n■ログインURL\n${frontendLoginUrl}\n\n■仮パスワード\n{####}\n\n※ログイン後、すぐにパスワード変更画面が表示されます。\n※本メールは送信専用です。\n`,
      },
    };

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

    new cdk.CfnOutput(this, 'CustomMessageLambdaFunctionName', {
      value: customMessageFn.functionName,
      description: 'Cognito CustomMessage Lambda（コンソール検索用の物理名）',
    });

    new cdk.CfnOutput(this, 'CustomMessageLambdaArn', {
      value: customMessageFn.functionArn,
      description: 'Cognito CustomMessage Lambda ARN',
    });
  }
}
