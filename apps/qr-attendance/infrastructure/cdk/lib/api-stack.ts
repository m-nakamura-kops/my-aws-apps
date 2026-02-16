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

    // サンプルエンドポイント（認証なし）
    const sampleResource = this.api.root.addResource('health');
    sampleResource.addMethod('GET', new apigateway.LambdaIntegration(sampleLambda));
    
    // マイグレーションエンドポイント（認証なし、開発環境のみ）
    const migrateResource = this.api.root.addResource('migrate');
    migrateResource.addMethod('POST', new apigateway.LambdaIntegration(migrateLambda));
    
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
