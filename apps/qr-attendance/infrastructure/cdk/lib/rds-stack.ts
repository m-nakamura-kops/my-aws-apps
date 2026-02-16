import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import { Construct } from 'constructs';

export interface QrAttendanceRdsStackProps extends cdk.StackProps {}

export class QrAttendanceRdsStack extends cdk.Stack {
  public readonly vpc: ec2.Vpc;
  public readonly dbSecurityGroup: ec2.SecurityGroup;
  public readonly lambdaSecurityGroup: ec2.SecurityGroup;
  public readonly dbSecret: secretsmanager.Secret;
  public readonly dbInstance: rds.DatabaseInstance;

  constructor(scope: Construct, id: string, props: QrAttendanceRdsStackProps) {
    super(scope, id, props);

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
    this.dbInstance = new rds.DatabaseInstance(this, 'DatabaseInstance', {
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
      credentials: rds.Credentials.fromSecret(this.dbSecret),
      databaseName: 'qr_attendance',
      allocatedStorage: 20,
      maxAllocatedStorage: 100,
      storageEncrypted: true,
      backupRetention: cdk.Duration.days(7),
      deleteAutomatedBackups: true,
      deletionProtection: false, // 開発環境ではfalse、本番ではtrue推奨
      removalPolicy: cdk.RemovalPolicy.DESTROY, // 開発環境用、本番ではRETAIN推奨
      multiAz: false, // 開発環境ではfalse（コスト削減）、本番ではtrue推奨
      publiclyAccessible: false,
      enablePerformanceInsights: false, // 開発環境ではfalse（コスト削減）
    });

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
