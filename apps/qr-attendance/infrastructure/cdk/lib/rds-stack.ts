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
