#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { QrAttendanceRdsStack } from '../lib/rds-stack';

const app = new cdk.App();

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

// QrAttendance の API、MySQL、dev VPC は 2026-09-07 に廃止した。
// prod のネットワークは post-automation と共有しているため、同じ stack ID と
// 論理 ID のまま VPC と LambdaSecurityGroup だけを維持する。
if (env === 'prod') {
  new QrAttendanceRdsStack(app, 'QrAttendanceRdsStack-prod', {
    env: envConfig,
    description: 'Shared production network (QrAttendance MySQL retired)',
    tags: {
      Project: 'qr-attendance',
      Environment: env,
    },
  });
}

// API stack は廃止済み。ここへ再追加すると削除済み RDS の再作成経路が
// 復活するため、意図的にインスタンス化しない。

// Cognito stack には既存ユーザーがいるため AWS 上は保持するが、廃止済み app の
// `cdk deploy --all` で変更されないよう、意図的にインスタンス化しない。

app.synth();
