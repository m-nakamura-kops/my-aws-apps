import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as subscriptions from 'aws-cdk-lib/aws-sns-subscriptions';
import { Construct } from 'constructs';

/**
 * この VPC は post-automation の Aurora PostgreSQL と共有している。
 * isolated サブネット（VpcisolatedSubnet1/2）に Aurora がある。
 * VPC・isolated サブネット・パブリックサブネットは削除しない。
 *
 * MySQL（DatabaseInstanceV2）と NAT ゲートウェイは置かない。
 * 定義を戻すと延長サポートと NAT の月額固定費が再発する。
 */
export interface QrAttendanceRdsStackProps extends cdk.StackProps {
  /** CDK_ENV (dev / prod). prod ではスタックの終了保護を付ける。 */
  environmentName?: string;
}

const RDS_CREATION_ALERT_EMAIL = 'h-magome@ko-partners.biz';

export class QrAttendanceRdsStack extends cdk.Stack {
  public readonly vpc: ec2.Vpc;
  public readonly lambdaSecurityGroup: ec2.SecurityGroup;

  constructor(scope: Construct, id: string, props: QrAttendanceRdsStackProps) {
    super(scope, id, props);

    const environmentName = props.environmentName ?? 'dev';
    const isProd = environmentName === 'prod';
    // VPC ごと消す cdk destroy を拒否する。MySQL はもうこのスタックに無い。
    this.terminationProtection = isProd;

    // natGateways: 0。private は PRIVATE_ISOLATED のまま名前を維持し、
    // サブネットの置換（Aurora / EC2 が載るサブネットの作り直し）を避ける。
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

    this.lambdaSecurityGroup = new ec2.SecurityGroup(this, 'LambdaSecurityGroup', {
      vpc: this.vpc,
      description: 'Security group for Lambda functions',
      allowAllOutbound: true,
    });

    if (isProd) {
      const alertTopic = new sns.Topic(this, 'RdsAlertTopic', {
        displayName: 'qr-attendance-prod-rds-create-alerts',
      });
      alertTopic.addToResourcePolicy(
        new iam.PolicyStatement({
          sid: 'AllowRdsPublish',
          principals: [new iam.ServicePrincipal('rds.amazonaws.com')],
          actions: ['sns:Publish'],
          resources: [alertTopic.topicArn],
        })
      );
      alertTopic.addSubscription(new subscriptions.EmailSubscription(RDS_CREATION_ALERT_EMAIL));
      // インスタンスを指定しない。MySQL を作り直した瞬間に通知する。
      new rds.CfnEventSubscription(this, 'RdsEventSubscription', {
        snsTopicArn: alertTopic.topicArn,
        sourceType: 'db-instance',
        eventCategories: ['creation', 'deletion', 'restoration', 'failure'],
        enabled: true,
      });
      new cdk.CfnOutput(this, 'RdsAlertTopicArn', {
        value: alertTopic.topicArn,
        description: 'SNS topic for RDS instance creation/deletion. Confirm the email subscription.',
        exportName: `${this.stackName}-RdsAlertTopicArn`,
      });
    }

    new cdk.CfnOutput(this, 'VpcId', {
      value: this.vpc.vpcId,
      description: 'VPC ID. Shared with post-automation Aurora. Do not delete.',
      exportName: `${this.stackName}-VpcId`,
    });

    new cdk.CfnOutput(this, 'LambdaSecurityGroupId', {
      value: this.lambdaSecurityGroup.securityGroupId,
      description: 'Lambda Security Group ID',
      exportName: `${this.stackName}-LambdaSecurityGroupId`,
    });
  }
}
