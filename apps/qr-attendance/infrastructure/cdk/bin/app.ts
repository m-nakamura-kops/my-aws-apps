#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { QrAttendanceRdsStack } from '../lib/rds-stack';
import { QrAttendanceCognitoStack } from '../lib/cognito-stack';
import { QrAttendanceApiStack } from '../lib/api-stack';

const app = new cdk.App();

// 環境変数から環境を取得（デフォルト: dev）
const env = process.env.CDK_ENV || 'dev';
const account = process.env.CDK_DEFAULT_ACCOUNT || process.env.AWS_ACCOUNT_ID;
const region = process.env.CDK_DEFAULT_REGION || process.env.AWS_REGION || 'ap-northeast-1';

if (!account) {
  throw new Error('AWS Account ID is required. Set CDK_DEFAULT_ACCOUNT or AWS_ACCOUNT_ID environment variable.');
}

const envConfig = {
  account,
  region,
};

// RDSスタック
const rdsStack = new QrAttendanceRdsStack(app, `QrAttendanceRdsStack-${env}`, {
  env: envConfig,
  description: 'QRコード打刻システム - RDS (MySQL)',
  tags: {
    Project: 'qr-attendance',
    Environment: env,
  },
});

// Cognitoスタック
const cognitoStack = new QrAttendanceCognitoStack(app, `QrAttendanceCognitoStack-${env}`, {
  env: envConfig,
  description: 'QRコード打刻システム - Cognito User Pool',
  tags: {
    Project: 'qr-attendance',
    Environment: env,
  },
});

// API Gateway + Lambdaスタック（RDSとCognitoに依存）
const apiStack = new QrAttendanceApiStack(app, `QrAttendanceApiStack-${env}`, {
  env: envConfig,
  description: 'QRコード打刻システム - API Gateway + Lambda',
  rdsSecret: rdsStack.dbSecret,
  dbSecurityGroup: rdsStack.dbSecurityGroup,
  lambdaSecurityGroup: rdsStack.lambdaSecurityGroup,
  vpc: rdsStack.vpc,
  userPool: cognitoStack.userPool,
  userPoolClient: cognitoStack.userPoolClient,
  dbEndpoint: rdsStack.dbInstance.instanceEndpoint.hostname,
  tags: {
    Project: 'qr-attendance',
    Environment: env,
  },
});

// スタック間の依存関係を明示
apiStack.addDependency(rdsStack);
apiStack.addDependency(cognitoStack);

app.synth();
