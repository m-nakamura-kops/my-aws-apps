import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { Construct } from 'constructs';

export interface QrAttendanceRdsStackProps extends cdk.StackProps {}

/**
 * The historical stack name is retained because post-automation uses its VPC.
 * QrAttendance's MySQL and all DB-only resources are intentionally retired.
 */
export class QrAttendanceRdsStack extends cdk.Stack {
  public readonly vpc: ec2.Vpc;
  public readonly lambdaSecurityGroup: ec2.SecurityGroup;

  constructor(scope: Construct, id: string, props: QrAttendanceRdsStackProps) {
    super(scope, id, props);

    // post-automation と共有しているため、既存の論理 ID を変えずに維持する。
    //
    // NAT Gateway は 2026-09 に廃止 (時間課金 $50/月 の削減)。
    // post-automation の Lambda は RDS Data API 移行で VPC 外に出たため、
    // この VPC から外向き通信を行うものは残っていない (EC2 web はパブリック
    // サブネット + EIP で NAT 非依存、Aurora へは Data API 経由)。
    // ⚠️ デプロイ前提: post-automation 側の Data API 移行 + Lambda の VPC 離脱
    // が完了し、VPC 内の lambda タイプ ENI が消えていること。
    // 'private' サブネットは NAT 廃止に伴い PRIVATE_ISOLATED に変更
    // (subnet group 名と CIDR は据え置きなのでサブネット自体は置換されず、
    // NAT 向けルートと NAT GW / EIP だけが削除される)。
    this.vpc = new ec2.Vpc(this, 'Vpc', {
      maxAzs: 2,
      natGateways: 0,
      subnetConfiguration: [
        {
          cidrMask: 24,
          name: 'public',
          subnetType: ec2.SubnetType.PUBLIC,
        },
        {
          cidrMask: 24,
          name: 'private',
          subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
        },
        {
          cidrMask: 24,
          name: 'isolated',
          subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
        },
      ],
    });

    // post-automation が参照しているため、既存の論理 ID を変えずに維持する。
    this.lambdaSecurityGroup = new ec2.SecurityGroup(this, 'LambdaSecurityGroup', {
      vpc: this.vpc,
      description: 'Security group for Lambda functions',
      allowAllOutbound: true,
    });

    // QrAttendance の MySQL は 2026-09-07 に廃止済み。
    // RDS、DB Secret、DB Subnet Group、DB Security Group を再追加すると、
    // RDS Extended Support を含む恒常課金が再発し得るため禁止する。

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
