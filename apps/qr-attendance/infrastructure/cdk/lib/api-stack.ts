import * as cdk from 'aws-cdk-lib';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as path from 'path';
import { Construct } from 'constructs';

export interface QrAttendanceApiStackProps extends cdk.StackProps {
  rdsSecret: secretsmanager.Secret;
  dbSecurityGroup: ec2.SecurityGroup;
  lambdaSecurityGroup: ec2.SecurityGroup;
  vpc: ec2.Vpc;
  userPool: cognito.UserPool;
  userPoolClient: cognito.UserPoolClient;
  dbEndpoint: string;
}

export class QrAttendanceApiStack extends cdk.Stack {
  public readonly api: apigateway.RestApi;

  constructor(scope: Construct, id: string, props: QrAttendanceApiStackProps) {
    super(scope, id, props);

    // Lambda実行用のIAMロール
    const lambdaRole = new iam.Role(this, 'LambdaExecutionRole', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole'),
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaVPCAccessExecutionRole'),
      ],
    });

    // Secrets ManagerとRDSへのアクセス権限を追加
    lambdaRole.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          'secretsmanager:GetSecretValue',
          'secretsmanager:DescribeSecret',
        ],
        resources: [props.rdsSecret.secretArn],
      })
    );

    // Cognitoへのアクセス権限を追加
    lambdaRole.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          'cognito-idp:InitiateAuth',
          'cognito-idp:SignUp',
          'cognito-idp:AdminConfirmSignUp',
          'cognito-idp:AdminGetUser',
          'cognito-idp:AdminDeleteUser',
          'cognito-idp:AdminCreateUser',
          'cognito-idp:AdminResetUserPassword',
        ],
        resources: [props.userPool.userPoolArn],
      })
    );

    // Lambda関数用のセキュリティグループ（RDSスタックから取得）
    const lambdaSecurityGroup = ec2.SecurityGroup.fromSecurityGroupId(
      this,
      'LambdaSecurityGroup',
      cdk.Fn.importValue(`${this.stackName.replace('Api', 'Rds')}-LambdaSecurityGroupId`)
    );

    // サンプルLambda関数（後で実装）
    const sampleLambda = new lambda.Function(this, 'SampleLambda', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromInline(`
        exports.handler = async (event) => {
          return {
            statusCode: 200,
            body: JSON.stringify({
              message: 'QR Attendance API is running',
              timestamp: new Date().toISOString()
            })
          };
        };
      `),
      role: lambdaRole,
      vpc: props.vpc,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
      },
      securityGroups: [props.lambdaSecurityGroup],
      environment: {
        DB_SECRET_ARN: props.rdsSecret.secretArn,
        DB_NAME: 'qr_attendance',
        USER_POOL_ID: props.userPool.userPoolId,
      },
      timeout: cdk.Duration.seconds(30),
    });

    // CORS: ブラウザから localhost:3000（Next.js）を明示許可。本番フロントのオリジンは CDK コンテキスト cors:extraOrigins 等で追加可能。
    const corsExtraOrigins =
      (this.node.tryGetContext('corsExtraOrigins') as string[] | undefined) ?? [];
    const corsAllowOrigins = [
      'http://localhost:3000',
      'http://127.0.0.1:3000',
      ...corsExtraOrigins,
    ];
    // OPTIONS, GET, POST, PUT, DELETE を含む（Cors.ALL_METHODS でヘッダーと整合）
    const corsAllowMethods = apigateway.Cors.ALL_METHODS;
    const corsAllowHeaders = [
      'Content-Type',
      'Authorization',
      'X-Amz-Date',
      'X-Api-Key',
      'X-Amz-Security-Token',
    ];

    // API Gateway作成
    this.api = new apigateway.RestApi(this, 'Api', {
      restApiName: 'qr-attendance-api',
      description: 'QRコード打刻システム API',
      defaultCorsPreflightOptions: {
        allowOrigins: corsAllowOrigins,
        allowMethods: corsAllowMethods,
        allowHeaders: corsAllowHeaders,
      },
    });

    // Lambda 未到達の 4xx/5xx（スロットル・認可エラー等）でもブラウザが CORS エラーにならないようゲートウェイ応答にヘッダーを付与
    const gwCorsOrigin = "'http://localhost:3000'";
    const gwCorsHeaders = "'Content-Type,Authorization,X-Amz-Date,X-Api-Key,X-Amz-Security-Token'";
    const gwCorsMethods = "'GET,POST,PUT,DELETE,OPTIONS'";
    this.api.addGatewayResponse('Default4xxCors', {
      type: apigateway.ResponseType.DEFAULT_4XX,
      responseHeaders: {
        'Access-Control-Allow-Origin': gwCorsOrigin,
        'Access-Control-Allow-Headers': gwCorsHeaders,
        'Access-Control-Allow-Methods': gwCorsMethods,
      },
    });
    this.api.addGatewayResponse('Default5xxCors', {
      type: apigateway.ResponseType.DEFAULT_5XX,
      responseHeaders: {
        'Access-Control-Allow-Origin': gwCorsOrigin,
        'Access-Control-Allow-Headers': gwCorsHeaders,
        'Access-Control-Allow-Methods': gwCorsMethods,
      },
    });
    this.api.addGatewayResponse('IntegrationFailureCors', {
      type: apigateway.ResponseType.INTEGRATION_FAILURE,
      responseHeaders: {
        'Access-Control-Allow-Origin': gwCorsOrigin,
        'Access-Control-Allow-Headers': gwCorsHeaders,
        'Access-Control-Allow-Methods': gwCorsMethods,
      },
    });

    // データベースマイグレーション用Lambda関数
    const migrateLambda = new lambda.Function(this, 'MigrateLambda', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../lambda-functions/migrate')),
      role: lambdaRole,
      vpc: props.vpc,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
      },
      securityGroups: [props.lambdaSecurityGroup],
      environment: {
        DB_SECRET_ARN: props.rdsSecret.secretArn,
        DB_NAME: 'qr_attendance',
        DB_HOST: props.dbEndpoint,
        DB_PORT: '3306',
        DB_SSL: 'true',
        CONNECTION_LIMIT: '2',
        // AWS_REGIONはLambdaランタイムによって自動的に設定されるため、手動設定不要
      },
      timeout: cdk.Duration.minutes(5), // マイグレーションには時間がかかる可能性があるため
    });

    // マイグレーション006（entry/exit）— API 公開なし。aws lambda invoke のみで実行（VPC 内から RDS へ接続）
    const migrate006Lambda = new lambda.Function(this, 'Migrate006Lambda', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../lambda-functions/migrate-006')),
      role: lambdaRole,
      vpc: props.vpc,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
      },
      securityGroups: [props.lambdaSecurityGroup],
      environment: {
        DB_SECRET_ARN: props.rdsSecret.secretArn,
        DB_NAME: 'qr_attendance',
        DB_HOST: props.dbEndpoint,
        DB_PORT: '3306',
        DB_SSL: 'true',
      },
      timeout: cdk.Duration.minutes(5),
    });

    // 結合テストユーザー投入（ローカルからプライベート RDS に届かない場合用・invoke のみ）
    const seedTestUsersLambda = new lambda.Function(this, 'SeedTestUsersLambda', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../lambda-functions/seed-test-users')),
      role: lambdaRole,
      vpc: props.vpc,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
      },
      securityGroups: [props.lambdaSecurityGroup],
      environment: {
        DB_SECRET_ARN: props.rdsSecret.secretArn,
        DB_NAME: 'qr_attendance',
        DB_HOST: props.dbEndpoint,
        DB_PORT: '3306',
        DB_SSL: 'true',
      },
      timeout: cdk.Duration.minutes(2),
    });

    // 本番開始前 DB クリーンアップ（invoke のみ・破壊的操作のため運用で厳重に扱う）
    const dbProdCleanupLambda = new lambda.Function(this, 'DbProdCleanupLambda', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../lambda-functions/db-prod-cleanup')),
      role: lambdaRole,
      vpc: props.vpc,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
      },
      securityGroups: [props.lambdaSecurityGroup],
      environment: {
        DB_SECRET_ARN: props.rdsSecret.secretArn,
        DB_NAME: 'qr_attendance',
        DB_HOST: props.dbEndpoint,
        DB_PORT: '3306',
        DB_SSL: 'true',
      },
      timeout: cdk.Duration.minutes(2),
    });
    dbProdCleanupLambda.node.addMetadata('purpose', 'Invoke-only destructive DB cleanup; remove from stack after use if desired');

    // ログインLambda関数
    const loginLambda = new lambda.Function(this, 'LoginLambda', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../../../backend/functions/users/login')),
      role: lambdaRole,
      vpc: props.vpc,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
      },
      securityGroups: [props.lambdaSecurityGroup],
      environment: {
        DB_SECRET_ARN: props.rdsSecret.secretArn,
        DB_NAME: 'qr_attendance',
        DB_HOST: props.dbEndpoint,
        DB_PORT: '3306',
        DB_SSL: 'true',
        CONNECTION_LIMIT: '2',
        USER_POOL_ID: props.userPool.userPoolId,
        COGNITO_CLIENT_ID: props.userPoolClient.userPoolClientId,
        // AWS_REGIONはLambdaランタイムによって自動的に設定される
      },
      timeout: cdk.Duration.seconds(30),
    });

    // ユーザー登録Lambda関数
    const registerLambda = new lambda.Function(this, 'RegisterLambda', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../../../backend/functions/users/register')),
      role: lambdaRole,
      vpc: props.vpc,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
      },
      securityGroups: [props.lambdaSecurityGroup],
      environment: {
        DB_SECRET_ARN: props.rdsSecret.secretArn,
        DB_NAME: 'qr_attendance',
        DB_HOST: props.dbEndpoint,
        DB_PORT: '3306',
        DB_SSL: 'true',
        CONNECTION_LIMIT: '2',
        USER_POOL_ID: props.userPool.userPoolId,
        COGNITO_CLIENT_ID: props.userPoolClient.userPoolClientId,
        AUTO_CONFIRM: 'true', // 開発環境では自動確認
        // AWS_REGIONはLambdaランタイムによって自動的に設定される
      },
      timeout: cdk.Duration.seconds(30),
    });

    // APIエンドポイントの定義
    const v1Resource = this.api.root.addResource('v1');
    const usersResource = v1Resource.addResource('users');

    // サンプルエンドポイント（認証なし）
    const sampleResource = this.api.root.addResource('health');
    sampleResource.addMethod('GET', new apigateway.LambdaIntegration(sampleLambda));
    
    // マイグレーションエンドポイント（認証なし、開発環境のみ）
    const migrateResource = this.api.root.addResource('migrate');
    migrateResource.addMethod('POST', new apigateway.LambdaIntegration(migrateLambda));

    // ログインエンドポイント
    const loginResource = usersResource.addResource('login');
    loginResource.addMethod('POST', new apigateway.LambdaIntegration(loginLambda));

    // ユーザー登録エンドポイント
    const registerResource = usersResource.addResource('register');
    registerResource.addMethod('POST', new apigateway.LambdaIntegration(registerLambda));

    // イベント管理Lambda関数
    const createEventLambda = new lambda.Function(this, 'CreateEventLambda', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../../../backend/functions/admin/events/create')),
      role: lambdaRole,
      vpc: props.vpc,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
      },
      securityGroups: [props.lambdaSecurityGroup],
      environment: {
        DB_SECRET_ARN: props.rdsSecret.secretArn,
        DB_NAME: 'qr_attendance',
        DB_HOST: props.dbEndpoint,
        DB_PORT: '3306',
        DB_SSL: 'true',
        CONNECTION_LIMIT: '2',
      },
      timeout: cdk.Duration.seconds(30),
    });

    const listEventsLambda = new lambda.Function(this, 'ListEventsLambda', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../../../backend/functions/admin/events/list')),
      role: lambdaRole,
      vpc: props.vpc,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
      },
      securityGroups: [props.lambdaSecurityGroup],
      environment: {
        DB_SECRET_ARN: props.rdsSecret.secretArn,
        DB_NAME: 'qr_attendance',
        DB_HOST: props.dbEndpoint,
        DB_PORT: '3306',
        DB_SSL: 'true',
        CONNECTION_LIMIT: '2',
      },
      timeout: cdk.Duration.seconds(30),
    });

    const updateEventLambda = new lambda.Function(this, 'UpdateEventLambda', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../../../backend/functions/admin/events/update')),
      role: lambdaRole,
      vpc: props.vpc,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
      },
      securityGroups: [props.lambdaSecurityGroup],
      environment: {
        DB_SECRET_ARN: props.rdsSecret.secretArn,
        DB_NAME: 'qr_attendance',
        DB_HOST: props.dbEndpoint,
        DB_PORT: '3306',
        DB_SSL: 'true',
        CONNECTION_LIMIT: '2',
      },
      timeout: cdk.Duration.seconds(30),
    });

    const deleteEventLambda = new lambda.Function(this, 'DeleteEventLambda', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../../../backend/functions/admin/events/delete')),
      role: lambdaRole,
      vpc: props.vpc,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
      },
      securityGroups: [props.lambdaSecurityGroup],
      environment: {
        DB_SECRET_ARN: props.rdsSecret.secretArn,
        DB_NAME: 'qr_attendance',
        DB_HOST: props.dbEndpoint,
        DB_PORT: '3306',
        DB_SSL: 'true',
        CONNECTION_LIMIT: '2',
      },
      timeout: cdk.Duration.seconds(30),
    });

    // QRコード生成Lambda関数
    const generateQRLambda = new lambda.Function(this, 'GenerateQRLambda', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../../../backend/functions/admin/events/qr')),
      role: lambdaRole,
      vpc: props.vpc,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
      },
      securityGroups: [props.lambdaSecurityGroup],
      environment: {
        DB_SECRET_ARN: props.rdsSecret.secretArn,
        DB_NAME: 'qr_attendance',
        DB_HOST: props.dbEndpoint,
        DB_PORT: '3306',
        DB_SSL: 'true',
        CONNECTION_LIMIT: '2',
        QR_SECRET_KEY: 'change-this-secret-key-in-production', // 本番環境ではSecrets Managerから取得
        API_ID: this.api.restApiId, // API GatewayのIDを設定（循環依存を避けるため）
      },
      timeout: cdk.Duration.seconds(30),
    });

    // 打刻Lambda関数
    const attendancePunchLambda = new lambda.Function(this, 'AttendancePunchLambda', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../../../backend/functions/users/attendance')),
      role: lambdaRole,
      vpc: props.vpc,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
      },
      securityGroups: [props.lambdaSecurityGroup],
      environment: {
        DB_SECRET_ARN: props.rdsSecret.secretArn,
        DB_NAME: 'qr_attendance',
        DB_HOST: props.dbEndpoint,
        DB_PORT: '3306',
        DB_SSL: 'true',
        CONNECTION_LIMIT: '2',
        USER_POOL_ID: props.userPool.userPoolId,
        QR_SECRET_KEY: 'change-this-secret-key-in-production', // 本番環境ではSecrets Managerから取得
      },
      timeout: cdk.Duration.seconds(30),
    });

    // 打刻履歴取得Lambda関数
    const attendanceHistoryLambda = new lambda.Function(this, 'AttendanceHistoryLambda', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../../../backend/functions/users/attendance/history')),
      role: lambdaRole,
      vpc: props.vpc,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
      },
      securityGroups: [props.lambdaSecurityGroup],
      environment: {
        DB_SECRET_ARN: props.rdsSecret.secretArn,
        DB_NAME: 'qr_attendance',
        DB_HOST: props.dbEndpoint,
        DB_PORT: '3306',
        DB_SSL: 'true',
        CONNECTION_LIMIT: '2',
      },
      timeout: cdk.Duration.seconds(30),
    });

    // イベント参加申込Lambda関数
    const eventRegisterLambda = new lambda.Function(this, 'EventRegisterLambda', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../../../backend/functions/users/events/register')),
      role: lambdaRole,
      vpc: props.vpc,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
      },
      securityGroups: [props.lambdaSecurityGroup],
      environment: {
        DB_SECRET_ARN: props.rdsSecret.secretArn,
        DB_NAME: 'qr_attendance',
        DB_HOST: props.dbEndpoint,
        DB_PORT: '3306',
        DB_SSL: 'true',
        CONNECTION_LIMIT: '2',
      },
      timeout: cdk.Duration.seconds(30),
    });

    // イベント参加取消Lambda関数
    const eventUnregisterLambda = new lambda.Function(this, 'EventUnregisterLambda', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../../../backend/functions/users/events/unregister')),
      role: lambdaRole,
      vpc: props.vpc,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
      },
      securityGroups: [props.lambdaSecurityGroup],
      environment: {
        DB_SECRET_ARN: props.rdsSecret.secretArn,
        DB_NAME: 'qr_attendance',
        DB_HOST: props.dbEndpoint,
        DB_PORT: '3306',
        DB_SSL: 'true',
        CONNECTION_LIMIT: '2',
      },
      timeout: cdk.Duration.seconds(30),
    });

    // 申込一覧取得Lambda関数
    const userRegistrationsLambda = new lambda.Function(this, 'UserRegistrationsLambda', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../../../backend/functions/users/registrations')),
      role: lambdaRole,
      vpc: props.vpc,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
      },
      securityGroups: [props.lambdaSecurityGroup],
      environment: {
        DB_SECRET_ARN: props.rdsSecret.secretArn,
        DB_NAME: 'qr_attendance',
        DB_HOST: props.dbEndpoint,
        DB_PORT: '3306',
        DB_SSL: 'true',
        CONNECTION_LIMIT: '2',
      },
      timeout: cdk.Duration.seconds(30),
    });

    // イベント参加者一覧取得Lambda関数（管理者用）
    const eventParticipantsLambda = new lambda.Function(this, 'EventParticipantsLambda', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../../../backend/functions/admin/events/participants')),
      role: lambdaRole,
      vpc: props.vpc,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
      },
      securityGroups: [props.lambdaSecurityGroup],
      environment: {
        DB_SECRET_ARN: props.rdsSecret.secretArn,
        DB_NAME: 'qr_attendance',
        DB_HOST: props.dbEndpoint,
        DB_PORT: '3306',
        DB_SSL: 'true',
        CONNECTION_LIMIT: '2',
      },
      timeout: cdk.Duration.seconds(30),
    });

    // イベント出席レポート取得Lambda関数（管理者用）
    const eventAttendanceReportLambda = new lambda.Function(this, 'EventAttendanceReportLambda', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../../../backend/functions/admin/events/attendance-report')),
      role: lambdaRole,
      vpc: props.vpc,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
      },
      securityGroups: [props.lambdaSecurityGroup],
      environment: {
        DB_SECRET_ARN: props.rdsSecret.secretArn,
        DB_NAME: 'qr_attendance',
        DB_HOST: props.dbEndpoint,
        DB_PORT: '3306',
        DB_SSL: 'true',
        CONNECTION_LIMIT: '2',
      },
      timeout: cdk.Duration.seconds(30),
    });

    // 生徒一括登録（CSVインポート）Lambda関数
    const importStudentsLambda = new lambda.Function(this, 'ImportStudentsLambda', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../../../backend/functions/admin/students/import')),
      role: lambdaRole,
      vpc: props.vpc,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
      },
      securityGroups: [props.lambdaSecurityGroup],
      environment: {
        DB_SECRET_ARN: props.rdsSecret.secretArn,
        DB_NAME: 'qr_attendance',
        DB_HOST: props.dbEndpoint,
        DB_PORT: '3306',
        DB_SSL: 'true',
        CONNECTION_LIMIT: '2',
        USER_POOL_ID: props.userPool.userPoolId,
      },
      timeout: cdk.Duration.seconds(60),
    });

    const lambdaDbEnv = {
      DB_SECRET_ARN: props.rdsSecret.secretArn,
      DB_NAME: 'qr_attendance',
      DB_HOST: props.dbEndpoint,
      DB_PORT: '3306',
      DB_SSL: 'true',
      CONNECTION_LIMIT: '2',
      USER_POOL_ID: props.userPool.userPoolId,
      COGNITO_CLIENT_ID: props.userPoolClient.userPoolClientId,
    };

    const newsListLambda = new lambda.Function(this, 'NewsListLambda', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../../../backend/functions/news/list')),
      role: lambdaRole,
      vpc: props.vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      securityGroups: [props.lambdaSecurityGroup],
      environment: { ...lambdaDbEnv },
      timeout: cdk.Duration.seconds(30),
    });

    const eventsListForStaffLambda = new lambda.Function(this, 'EventsListForStaffLambda', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../../../backend/functions/events/list')),
      role: lambdaRole,
      vpc: props.vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      securityGroups: [props.lambdaSecurityGroup],
      environment: { ...lambdaDbEnv },
      timeout: cdk.Duration.seconds(30),
    });

    const attendanceManualLambda = new lambda.Function(this, 'AttendanceManualLambda', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../../../backend/functions/attendance/manual')),
      role: lambdaRole,
      vpc: props.vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      securityGroups: [props.lambdaSecurityGroup],
      environment: { ...lambdaDbEnv },
      timeout: cdk.Duration.seconds(30),
    });

    const studentsSearchLambda = new lambda.Function(this, 'StudentsSearchLambda', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../../../backend/functions/students/search')),
      role: lambdaRole,
      vpc: props.vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      securityGroups: [props.lambdaSecurityGroup],
      environment: { ...lambdaDbEnv },
      timeout: cdk.Duration.seconds(30),
    });

    const userMeLambda = new lambda.Function(this, 'UserMeLambda', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../../../backend/functions/users/me')),
      role: lambdaRole,
      vpc: props.vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      securityGroups: [props.lambdaSecurityGroup],
      environment: { ...lambdaDbEnv },
      timeout: cdk.Duration.seconds(30),
    });

    const userMeQrLambda = new lambda.Function(this, 'UserMeQrLambda', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../../../backend/functions/users/me-qr')),
      role: lambdaRole,
      vpc: props.vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      securityGroups: [props.lambdaSecurityGroup],
      environment: {
        ...lambdaDbEnv,
        QR_SECRET_KEY: 'change-this-secret-key-in-production',
      },
      timeout: cdk.Duration.seconds(30),
    });

    const userScheduleLambda = new lambda.Function(this, 'UserScheduleLambda', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../../../backend/functions/users/schedule')),
      role: lambdaRole,
      vpc: props.vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      securityGroups: [props.lambdaSecurityGroup],
      environment: { ...lambdaDbEnv },
      timeout: cdk.Duration.seconds(30),
    });

    const adminRegistrationsListLambda = new lambda.Function(this, 'AdminRegistrationsListLambda', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../../../backend/functions/admin/registrations/list')),
      role: lambdaRole,
      vpc: props.vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      securityGroups: [props.lambdaSecurityGroup],
      environment: { ...lambdaDbEnv },
      timeout: cdk.Duration.seconds(30),
    });

    const adminStudentsListLambda = new lambda.Function(this, 'AdminStudentsListLambda', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../../../backend/functions/admin/students/list')),
      role: lambdaRole,
      vpc: props.vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      securityGroups: [props.lambdaSecurityGroup],
      environment: { ...lambdaDbEnv },
      timeout: cdk.Duration.seconds(30),
    });

    const adminStudentsCreateLambda = new lambda.Function(this, 'AdminStudentsCreateLambda', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../../../backend/functions/admin/students/create')),
      role: lambdaRole,
      vpc: props.vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      securityGroups: [props.lambdaSecurityGroup],
      environment: { ...lambdaDbEnv },
      timeout: cdk.Duration.seconds(30),
    });

    const adminStudentsUpdateLambda = new lambda.Function(this, 'AdminStudentsUpdateLambda', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../../../backend/functions/admin/students/update')),
      role: lambdaRole,
      vpc: props.vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      securityGroups: [props.lambdaSecurityGroup],
      environment: { ...lambdaDbEnv },
      timeout: cdk.Duration.seconds(30),
    });

    const adminStudentsDeleteLambda = new lambda.Function(this, 'AdminStudentsDeleteLambda', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../../../backend/functions/admin/students/delete')),
      role: lambdaRole,
      vpc: props.vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      securityGroups: [props.lambdaSecurityGroup],
      environment: { ...lambdaDbEnv },
      timeout: cdk.Duration.seconds(30),
    });

    const adminStaffsListLambda = new lambda.Function(this, 'AdminStaffsListLambda', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../../../backend/functions/admin/staffs/list')),
      role: lambdaRole,
      vpc: props.vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      securityGroups: [props.lambdaSecurityGroup],
      environment: { ...lambdaDbEnv },
      timeout: cdk.Duration.seconds(30),
    });

    const adminStaffsInviteLambda = new lambda.Function(this, 'AdminStaffsInviteLambda', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../../../backend/functions/admin/staffs/invite')),
      role: lambdaRole,
      vpc: props.vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      securityGroups: [props.lambdaSecurityGroup],
      environment: { ...lambdaDbEnv },
      timeout: cdk.Duration.seconds(30),
    });

    const adminStaffsUpdateLambda = new lambda.Function(this, 'AdminStaffsUpdateLambda', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../../../backend/functions/admin/staffs/update')),
      role: lambdaRole,
      vpc: props.vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      securityGroups: [props.lambdaSecurityGroup],
      environment: { ...lambdaDbEnv },
      timeout: cdk.Duration.seconds(30),
    });

    const adminStaffsDeleteLambda = new lambda.Function(this, 'AdminStaffsDeleteLambda', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../../../backend/functions/admin/staffs/delete')),
      role: lambdaRole,
      vpc: props.vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      securityGroups: [props.lambdaSecurityGroup],
      environment: { ...lambdaDbEnv },
      timeout: cdk.Duration.seconds(30),
    });

    const adminNewsListLambda = new lambda.Function(this, 'AdminNewsListLambda', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../../../backend/functions/admin/news/list')),
      role: lambdaRole,
      vpc: props.vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      securityGroups: [props.lambdaSecurityGroup],
      environment: { ...lambdaDbEnv },
      timeout: cdk.Duration.seconds(30),
    });

    const adminNewsCreateLambda = new lambda.Function(this, 'AdminNewsCreateLambda', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../../../backend/functions/admin/news/create')),
      role: lambdaRole,
      vpc: props.vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      securityGroups: [props.lambdaSecurityGroup],
      environment: { ...lambdaDbEnv },
      timeout: cdk.Duration.seconds(30),
    });

    const adminNewsUpdateLambda = new lambda.Function(this, 'AdminNewsUpdateLambda', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../../../backend/functions/admin/news/update')),
      role: lambdaRole,
      vpc: props.vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      securityGroups: [props.lambdaSecurityGroup],
      environment: { ...lambdaDbEnv },
      timeout: cdk.Duration.seconds(30),
    });

    const adminNewsDeleteLambda = new lambda.Function(this, 'AdminNewsDeleteLambda', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../../../backend/functions/admin/news/delete')),
      role: lambdaRole,
      vpc: props.vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      securityGroups: [props.lambdaSecurityGroup],
      environment: { ...lambdaDbEnv },
      timeout: cdk.Duration.seconds(30),
    });

    const adminReportsEventCsvLambda = new lambda.Function(this, 'AdminReportsEventCsvLambda', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../../../backend/functions/admin/reports/events/csv')),
      role: lambdaRole,
      vpc: props.vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      securityGroups: [props.lambdaSecurityGroup],
      environment: { ...lambdaDbEnv },
      timeout: cdk.Duration.seconds(60),
    });

    // GET /v1/users/me, GET /v1/users/me/qr, GET /v1/users/schedule
    const userMeResource = usersResource.addResource('me');
    userMeResource.addMethod('GET', new apigateway.LambdaIntegration(userMeLambda));
    const userMeQrResource = userMeResource.addResource('qr');
    userMeQrResource.addMethod('GET', new apigateway.LambdaIntegration(userMeQrLambda));
    const userScheduleResource = usersResource.addResource('schedule');
    userScheduleResource.addMethod('GET', new apigateway.LambdaIntegration(userScheduleLambda));

    // GET /v1/news（お知らせ一覧）
    const newsResource = v1Resource.addResource('news');
    newsResource.addMethod('GET', new apigateway.LambdaIntegration(newsListLambda));

    // GET /v1/events（スタッフ・管理者向けイベント一覧）
    const eventsListResource = v1Resource.addResource('events');
    eventsListResource.addMethod('GET', new apigateway.LambdaIntegration(eventsListForStaffLambda));

    // POST /v1/attendance/manual（手動打刻）
    const attendanceManualResource = v1Resource.addResource('attendance').addResource('manual');
    attendanceManualResource.addMethod('POST', new apigateway.LambdaIntegration(attendanceManualLambda));

    // GET /v1/students/search?q=
    const studentsSearchResource = v1Resource.addResource('students').addResource('search');
    studentsSearchResource.addMethod('GET', new apigateway.LambdaIntegration(studentsSearchLambda));

    // イベント管理エンドポイント
    const adminResource = v1Resource.addResource('admin');
    const eventsResource = adminResource.addResource('events');
    
    // POST /v1/admin/events - イベント作成
    eventsResource.addMethod('POST', new apigateway.LambdaIntegration(createEventLambda));
    
    // GET /v1/admin/events - イベント一覧取得
    eventsResource.addMethod('GET', new apigateway.LambdaIntegration(listEventsLambda));
    
    // PUT /v1/admin/events/{eventId} - イベント更新
    const eventIdResource = eventsResource.addResource('{eventId}');
    eventIdResource.addMethod('PUT', new apigateway.LambdaIntegration(updateEventLambda));
    
    // DELETE /v1/admin/events/{eventId} - イベント削除
    eventIdResource.addMethod('DELETE', new apigateway.LambdaIntegration(deleteEventLambda));
    
    // GET /v1/admin/events/{eventId}/qr - QRコード生成
    const qrResource = eventIdResource.addResource('qr');
    qrResource.addMethod('GET', new apigateway.LambdaIntegration(generateQRLambda));

    // GET /v1/admin/events/{eventId}/participants - 参加者一覧取得（管理者用）
    const participantsResource = eventIdResource.addResource('participants');
    participantsResource.addMethod('GET', new apigateway.LambdaIntegration(eventParticipantsLambda));

    // GET /v1/admin/events/{eventId}/attendance-report - 出席レポート取得（管理者用）
    const attendanceReportResource = eventIdResource.addResource('attendance-report');
    attendanceReportResource.addMethod('GET', new apigateway.LambdaIntegration(eventAttendanceReportLambda));

    // お知らせ管理（管理者）
    const adminNewsResource = adminResource.addResource('news');
    adminNewsResource.addMethod('GET', new apigateway.LambdaIntegration(adminNewsListLambda));
    adminNewsResource.addMethod('POST', new apigateway.LambdaIntegration(adminNewsCreateLambda));
    const adminNewsIdResource = adminNewsResource.addResource('{id}');
    adminNewsIdResource.addMethod('PUT', new apigateway.LambdaIntegration(adminNewsUpdateLambda));
    adminNewsIdResource.addMethod('DELETE', new apigateway.LambdaIntegration(adminNewsDeleteLambda));

    // GET /v1/admin/registrations
    const adminRegistrationsResource = adminResource.addResource('registrations');
    adminRegistrationsResource.addMethod('GET', new apigateway.LambdaIntegration(adminRegistrationsListLambda));

    // スタッフ管理・招待
    const adminStaffsResource = adminResource.addResource('staffs');
    adminStaffsResource.addMethod('GET', new apigateway.LambdaIntegration(adminStaffsListLambda));
    const adminStaffEmailResource = adminStaffsResource.addResource('{email}');
    adminStaffEmailResource.addMethod('PUT', new apigateway.LambdaIntegration(adminStaffsUpdateLambda));
    adminStaffEmailResource.addMethod('DELETE', new apigateway.LambdaIntegration(adminStaffsDeleteLambda));
    const adminInviteResource = adminResource.addResource('invite');
    adminInviteResource.addMethod('POST', new apigateway.LambdaIntegration(adminStaffsInviteLambda));

    // GET /v1/admin/reports/events/{eventId}/csv
    const adminReportsCsvResource = adminResource
      .addResource('reports')
      .addResource('events')
      .addResource('{eventId}')
      .addResource('csv');
    adminReportsCsvResource.addMethod('GET', new apigateway.LambdaIntegration(adminReportsEventCsvLambda));

    // 生徒管理エンドポイント（一覧・作成・更新・削除・CSV一括登録）
    const studentsResource = adminResource.addResource('students');
    studentsResource.addMethod('GET', new apigateway.LambdaIntegration(adminStudentsListLambda));
    studentsResource.addMethod('POST', new apigateway.LambdaIntegration(adminStudentsCreateLambda));
    const adminStudentEmailResource = studentsResource.addResource('{email}');
    adminStudentEmailResource.addMethod('PUT', new apigateway.LambdaIntegration(adminStudentsUpdateLambda));
    adminStudentEmailResource.addMethod('DELETE', new apigateway.LambdaIntegration(adminStudentsDeleteLambda));
    const studentsImportResource = studentsResource.addResource('import');
    studentsImportResource.addMethod('POST', new apigateway.LambdaIntegration(importStudentsLambda));

    // 打刻エンドポイント
    const attendanceResource = usersResource.addResource('attendance');
    // POST /v1/users/attendance - QRコード打刻
    attendanceResource.addMethod('POST', new apigateway.LambdaIntegration(attendancePunchLambda));
    // GET /v1/users/attendance - QRコード打刻（URLから）
    attendanceResource.addMethod('GET', new apigateway.LambdaIntegration(attendancePunchLambda));
    
    // GET /v1/users/attendance/history - 打刻履歴取得
    const attendanceHistoryResource = attendanceResource.addResource('history');
    attendanceHistoryResource.addMethod('GET', new apigateway.LambdaIntegration(attendanceHistoryLambda));

    // イベント参加申込エンドポイント
    const userEventsResource = usersResource.addResource('events');
    const userEventIdResource = userEventsResource.addResource('{eventId}');
    const eventRegisterResource = userEventIdResource.addResource('register');
    // POST /v1/users/events/{eventId}/register - イベント参加申込
    eventRegisterResource.addMethod('POST', new apigateway.LambdaIntegration(eventRegisterLambda));
    // DELETE /v1/users/events/{eventId}/register - イベント参加取消
    eventRegisterResource.addMethod('DELETE', new apigateway.LambdaIntegration(eventUnregisterLambda));

    // GET /v1/users/registrations - 申込一覧取得
    const registrationsResource = usersResource.addResource('registrations');
    registrationsResource.addMethod('GET', new apigateway.LambdaIntegration(userRegistrationsLambda));
    
    // Cognito認証オーサライザー（認証が必要なエンドポイントで使用）
    // 実際に使用するメソッドにアタッチする必要があるため、後で実装時に追加
    // const authorizer = new apigateway.CognitoUserPoolsAuthorizer(this, 'CognitoAuthorizer', {
    //   cognitoUserPools: [props.userPool],
    //   identitySource: 'method.request.header.Authorization',
    // });
    // 
    // const protectedResource = this.api.root.addResource('protected');
    // protectedResource.addMethod('GET', new apigateway.LambdaIntegration(sampleLambda), {
    //   authorizer: authorizer,
    // });

    // 出力
    new cdk.CfnOutput(this, 'ApiUrl', {
      value: this.api.url,
      description: 'API Gateway endpoint URL',
      exportName: `${this.stackName}-ApiUrl`,
    });

    new cdk.CfnOutput(this, 'ApiId', {
      value: this.api.restApiId,
      description: 'API Gateway ID',
      exportName: `${this.stackName}-ApiId`,
    });

    new cdk.CfnOutput(this, 'Migrate006LambdaName', {
      value: migrate006Lambda.functionName,
      description: 'Invoke-only: migration 006 (aws lambda invoke)',
      exportName: `${this.stackName}-Migrate006LambdaName`,
    });

    new cdk.CfnOutput(this, 'MigrateLambdaName', {
      value: migrateLambda.functionName,
      description: 'Schema migration (DDL + views). POST /migrate or aws lambda invoke',
      exportName: `${this.stackName}-MigrateLambdaName`,
    });

    new cdk.CfnOutput(this, 'SeedTestUsersLambdaName', {
      value: seedTestUsersLambda.functionName,
      description: 'Invoke-only: seed test users to RDS (aws lambda invoke)',
      exportName: `${this.stackName}-SeedTestUsersLambdaName`,
    });

    new cdk.CfnOutput(this, 'DbProdCleanupLambdaName', {
      value: dbProdCleanupLambda.functionName,
      description: 'Invoke-only: transactional prod DB cleanup (aws lambda invoke)',
      exportName: `${this.stackName}-DbProdCleanupLambdaName`,
    });
  }
}
