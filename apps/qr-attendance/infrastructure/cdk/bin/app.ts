#!/usr/bin/env node
import 'source-map-support/register';
import { execSync } from 'child_process';
import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { QrAttendanceRdsStack } from '../lib/rds-stack';
import { QrAttendanceCognitoStack } from '../lib/cognito-stack';

const app = new cdk.App();

// 環境変数から環境を取得（デフォルト: dev）
const env = process.env.CDK_ENV || 'dev';
const account = process.env.CDK_DEFAULT_ACCOUNT || process.env.AWS_ACCOUNT_ID;
const region = process.env.CDK_DEFAULT_REGION || process.env.AWS_REGION || 'ap-northeast-1';

if (!account) {
  throw new Error('AWS Account ID is required. Set CDK_DEFAULT_ACCOUNT or AWS_ACCOUNT_ID environment variable.');
}

assertProdDeployFromMain(env);

const envConfig = {
  account,
  region,
};

const DEFAULT_FRONTEND_LOGIN_URL = 'https://main.d2s96axh42icx2.amplifyapp.com/login';
const frontendLoginUrl =
  (app.node.tryGetContext('frontendLoginUrl') as string | undefined) ||
  process.env.FRONTEND_LOGIN_URL ||
  DEFAULT_FRONTEND_LOGIN_URL;

// VPC のみ。MySQL と NAT は定義しない（再作成すると月額固定費が戻る）。
// QrAttendanceApiStack は本番から外した。ここに戻すと DB エクスポートへの依存が復活し、
// 次の deploy で MySQL を要求する状態に戻る。
const rdsStack = new QrAttendanceRdsStack(app, `QrAttendanceRdsStack-${env}`, {
  env: envConfig,
  description: 'QRコード打刻システム - shared VPC (no MySQL, no NAT)',
  environmentName: env,
  terminationProtection: env === 'prod',
  tags: {
    Project: 'qr-attendance',
    Environment: env,
  },
});

if (env === 'prod') {
  assertStackHasNoResource(rdsStack, 'AWS::RDS::DBInstance');
  assertStackHasNoResource(rdsStack, 'AWS::EC2::NatGateway');
}

const cognitoStack = new QrAttendanceCognitoStack(app, `QrAttendanceCognitoStack-${env}`, {
  env: envConfig,
  description: 'QRコード打刻システム - Cognito User Pool + CustomMessage Lambda',
  terminationProtection: env === 'prod',
  frontendLoginUrl,
  environmentName: env,
  tags: {
    Project: 'qr-attendance',
    Environment: env,
  },
});

void cognitoStack;

app.synth();

/**
 * 作業ブランチからの `CDK_ENV=prod cdk deploy` を synth 時点で止める。
 * 2026-08、09、10 に別ブランチのデプロイが MySQL と NAT を作り直した。
 */
function assertStackHasNoResource(scope: Construct, resourceType: string) {
  const visit = (node: Construct) => {
    if (cdk.CfnResource.isCfnResource(node) && node.cfnResourceType === resourceType) {
      throw new Error(
        `本番テンプレートに ${resourceType} があります（${node.node.path}）。MySQL と NAT は戻さないでください。`
      );
    }
    for (const child of node.node.children) {
      visit(child);
    }
  };
  visit(scope);
}

function assertProdDeployFromMain(environmentName: string) {
  if (environmentName !== 'prod') {
    return;
  }
  let branch = '';
  try {
    branch = execSync('git rev-parse --abbrev-ref HEAD', {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim();
  } catch {
    throw new Error(
      'CDK_ENV=prod は git の main ブランチでのみ実行できます。ブランチを判定できません。'
    );
  }
  if (branch !== 'main') {
    throw new Error(
      `CDK_ENV=prod は main ブランチでのみ実行できます（現在: ${branch}）。作業ブランチからの本番デプロイは MySQL と NAT の再作成を繰り返したため禁止しています。`
    );
  }
}
