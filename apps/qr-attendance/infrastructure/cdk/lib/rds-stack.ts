import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import * as sns from 'aws-cdk-lib/aws-sns';
import { Construct } from 'constructs';

export interface QrAttendanceRdsStackProps extends cdk.StackProps {
  /** CDK_ENV (dev / prod). prod では削除保護・保持ポリシーを強制する。 */
  environmentName?: string;
}

export class QrAttendanceRdsStack extends cdk.Stack {
  public readonly vpc: ec2.Vpc;
  public readonly dbSecurityGroup: ec2.SecurityGroup;
  public readonly lambdaSecurityGroup: ec2.SecurityGroup;
  public readonly dbSecret: secretsmanager.Secret;
  public readonly dbInstance: rds.IDatabaseInstance;

  constructor(scope: Construct, id: string, props: QrAttendanceRdsStackProps) {
    super(scope, id, props);

    const environmentName = props.environmentName ?? 'dev';
    const isProd = environmentName === 'prod';
    // 本番スタック自体の誤削除（cdk destroy / DeleteStack）を防ぐ
    this.terminationProtection = isProd;

    // VPC作成
    this.vpc = new ec2.Vpc(this, 'Vpc', {
      maxAzs: 2,
      natGateways: 1,
      subnetConfiguration: [
        {
          cidrMask: 24,
          name: 'public',
          subnetType: ec2.SubnetType.PUBLIC,
        },
        {
          cidrMask: 24,
          name: 'private',
          subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
        },
        {
          cidrMask: 24,
          name: 'isolated',
          subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
        },
      ],
    });

    // データベース用セキュリティグループ
    this.dbSecurityGroup = new ec2.SecurityGroup(this, 'DbSecurityGroup', {
      vpc: this.vpc,
      description: 'Security group for RDS MySQL instance',
      allowAllOutbound: true,
    });

    // Lambda用セキュリティグループ（APIスタックで使用）
    this.lambdaSecurityGroup = new ec2.SecurityGroup(this, 'LambdaSecurityGroup', {
      vpc: this.vpc,
      description: 'Security group for Lambda functions',
      allowAllOutbound: true,
    });

    // LambdaからRDSへのアクセスを許可
    this.dbSecurityGroup.addIngressRule(
      this.lambdaSecurityGroup,
      ec2.Port.tcp(3306),
      'Allow MySQL access from Lambda'
    );

    // データベース認証情報をSecrets Managerに保存
    this.dbSecret = new secretsmanager.Secret(this, 'DbSecret', {
      description: 'RDS MySQL master user credentials',
      generateSecretString: {
        secretStringTemplate: JSON.stringify({ username: 'admin' }),
        generateStringKey: 'password',
        excludeCharacters: '"@/\\',
        includeSpace: false,
        passwordLength: 32,
      },
    });

    // RDSサブネットグループ
    const dbSubnetGroup = new rds.SubnetGroup(this, 'DbSubnetGroup', {
      vpc: this.vpc,
      description: 'Subnet group for RDS MySQL instance',
      vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
      },
    });

    // RDS MySQLインスタンス
    // NOTE: Construct ID は 'DatabaseInstanceV2' のまま維持すること。
    // 付け替えると CloudFormation が既存インスタンスを置換（削除）しようとする。
    // 本番は 2026-09-07 のスタック更新でインスタンスが消えたため、残っている手動スナップショットから復元する。
    // この snapshot ID を変えるとインスタンス置換になるので、復元後も固定する。
    const PROD_RESTORE_SNAPSHOT =
      'qrattendancerdsstack-prod-databaseinstancev250db82-sck0rl1jhog9-snapshot';
    const dbRemovalPolicy = isProd ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY;
    const dbCommon = {
      engine: rds.DatabaseInstanceEngine.mysql({
        version: rds.MysqlEngineVersion.VER_8_0,
      }),
      instanceType: ec2.InstanceType.of(
        ec2.InstanceClass.T3,
        ec2.InstanceSize.MICRO
      ),
      vpc: this.vpc,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
      },
      securityGroups: [this.dbSecurityGroup],
      subnetGroup: dbSubnetGroup,
      allocatedStorage: 20,
      maxAllocatedStorage: 100,
      storageEncrypted: true,
      // 自動バックアップ + PITR。本番は 14 日保持（日次スナップショット相当）
      backupRetention: cdk.Duration.days(isProd ? 14 : 7),
      preferredBackupWindow: '18:31-19:01',
      copyTagsToSnapshot: true,
      deleteAutomatedBackups: false, // インスタンス削除時も自動バックアップを保持
      deletionProtection: isProd, // コンソールからの即時削除を拒否（解除操作が必要）
      removalPolicy: dbRemovalPolicy, // スタック削除時もインスタンスを保持（本番）
      multiAz: false, // コスト削減のため単一AZ（必要に応じて true）
      publiclyAccessible: false,
      enablePerformanceInsights: false, // コスト削減
    };
    this.dbInstance = isProd
      ? new rds.DatabaseInstanceFromSnapshot(this, 'DatabaseInstanceV2', {
          ...dbCommon,
          snapshotIdentifier: PROD_RESTORE_SNAPSHOT,
          credentials: rds.SnapshotCredentials.fromSecret(this.dbSecret),
        })
      : new rds.DatabaseInstance(this, 'DatabaseInstanceV2', {
          ...dbCommon,
          credentials: rds.Credentials.fromSecret(this.dbSecret),
          databaseName: 'qr_attendance',
        });

    // L1 にも DeletionPolicy/UpdateReplacePolicy を明示し、差し替え・スタック削除での物理削除を防ぐ
    const cfnDb = this.dbInstance.node.defaultChild as rds.CfnDBInstance;
    cfnDb.applyRemovalPolicy(dbRemovalPolicy);
    if (isProd) {
      cfnDb.deletionProtection = true;
      cfnDb.deleteAutomatedBackups = false;
    }

    if (isProd) {
      const alertTopic = new sns.Topic(this, 'RdsAlertTopic', {
        displayName: 'qr-attendance-prod-rds-alerts',
      });
      alertTopic.addToResourcePolicy(
        new iam.PolicyStatement({
          sid: 'AllowRdsPublish',
          principals: [new iam.ServicePrincipal('rds.amazonaws.com')],
          actions: ['sns:Publish'],
          resources: [alertTopic.topicArn],
        })
      );
      new rds.CfnEventSubscription(this, 'RdsEventSubscription', {
        snsTopicArn: alertTopic.topicArn,
        sourceType: 'db-instance',
        sourceIds: [this.dbInstance.instanceIdentifier],
        eventCategories: ['deletion', 'failure', 'low storage', 'recovery', 'restoration'],
        enabled: true,
      });
      new cdk.CfnOutput(this, 'RdsAlertTopicArn', {
        value: alertTopic.topicArn,
        description: 'SNS topic for RDS deletion/failure events (subscribe an email to receive alerts)',
        exportName: `${this.stackName}-RdsAlertTopicArn`,
      });
    }

    // 出力
    new cdk.CfnOutput(this, 'DbEndpoint', {
      value: this.dbInstance.instanceEndpoint.hostname,
      description: 'RDS MySQL endpoint',
      exportName: `${this.stackName}-DbEndpoint`,
    });

    new cdk.CfnOutput(this, 'DbPort', {
      value: this.dbInstance.instanceEndpoint.port.toString(),
      description: 'RDS MySQL port',
      exportName: `${this.stackName}-DbPort`,
    });

    new cdk.CfnOutput(this, 'DbSecretArn', {
      value: this.dbSecret.secretArn,
      description: 'RDS MySQL secret ARN',
      exportName: `${this.stackName}-DbSecretArn`,
    });

    new cdk.CfnOutput(this, 'DbName', {
      value: 'qr_attendance',
      description: 'RDS MySQL database name',
      exportName: `${this.stackName}-DbName`,
    });

    new cdk.CfnOutput(this, 'VpcId', {
      value: this.vpc.vpcId,
      description: 'VPC ID',
      exportName: `${this.stackName}-VpcId`,
    });

    new cdk.CfnOutput(this, 'LambdaSecurityGroupId', {
      value: this.lambdaSecurityGroup.securityGroupId,
      description: 'Lambda Security Group ID',
      exportName: `${this.stackName}-LambdaSecurityGroupId`,
    });
  }
}
