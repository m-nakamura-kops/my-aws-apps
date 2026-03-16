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

    // API Gateway作成
    this.api = new apigateway.RestApi(this, 'Api', {
      restApiName: 'qr-attendance-api',
      description: 'QRコード打刻システム API',
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: ['Content-Type', 'Authorization'],
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
        // AWS_REGIONはLambdaランタイムによって自動的に設定されるため、手動設定不要
      },
      timeout: cdk.Duration.minutes(5), // マイグレーションには時間がかかる可能性があるため
    });

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
        USER_POOL_ID: props.userPool.userPoolId,
      },
      timeout: cdk.Duration.seconds(60),
    });

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

    // 生徒管理エンドポイント（CSV一括登録）
    const studentsResource = adminResource.addResource('students');
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
  }
}
