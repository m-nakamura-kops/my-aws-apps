# QrAttendance infrastructure (retired)

QrAttendance の API、RDS MySQL、dev VPC は 2026-09-07 に廃止しました。

現在この CDK app が管理するのは次のリソースだけです。

- `prod`: post-automation と共有する既存 VPC / subnet / route / NAT / IGW と
  `LambdaSecurityGroup`
- `dev`: synth 対象なし

共有先の Aurora PostgreSQL `post-automation-prod-aurora-pg` は保持しています。
2026-09-07 に RDS Extended Support の自動加入を無効化し、エンジン 16.13 と
稼働状態を変えずに `open-source-rds-extended-support-disabled` へ設定済みです。

`QrAttendanceApiStack-*` と `QrAttendanceRdsStack-dev` は意図的に synth 対象から
除外しています。`QrAttendanceRdsStack-prod` という既存 stack 名は互換性のため
維持していますが、DB関連リソースを含まないネットワーク専用スタックです。
既存 Cognito stack はユーザーデータを残したまま AWS 上で保持し、廃止済み app の
一括 deploy で変更されないよう synth 対象から除外しています。

## 再作成禁止

次のリソースをこの app に再追加しないでください。

- `AWS::RDS::DBInstance` / `rds.DatabaseInstance`
- QrAttendance DB 用 Secret、DB subnet group、DB security group
- 削除済み API stack
- dev RDS/VPC stack

AWS 側では、管理者グループ、実際に復元操作を行ったユーザー、既知の
CloudFormation 実行ロール、および AWS Backup 復元ロールに
`../guardrails/deny-rds-recreation.json` をインラインポリシー
`DenyQrAttendanceRdsRecreation` として設定しています。
QrAttendance を示す DB 識別子、`Project=qr-attendance` タグ、または保持 snapshot を
使った DB 作成・復元を明示的に拒否します。このガードを外す場合は、RDS Extended
Support を無効にした復元計画と承認を先に用意してください。

保持している MySQL 8.0 の snapshot を復元する必要が生じた場合は、新しい対応済み
major version への移行計画を立てたうえで、RDS API/CLI の
`EngineLifecycleSupport` を `open-source-rds-extended-support-disabled` に明示して
ください。既定値のまま復元すると RDS Extended Support 課金が再発します。

## 確認

```bash
cd apps/qr-attendance/infrastructure/cdk
npm ci

CDK_ENV=prod \
CDK_DEFAULT_ACCOUNT=588738585231 \
CDK_DEFAULT_REGION=ap-northeast-1 \
npx cdk list

CDK_ENV=prod \
CDK_DEFAULT_ACCOUNT=588738585231 \
CDK_DEFAULT_REGION=ap-northeast-1 \
npx cdk synth QrAttendanceRdsStack-prod
```

synthesized template に `AWS::RDS::DBInstance` が存在しないことを確認してください。
prod の共有 VPC は post-automation の Aurora PostgreSQL が利用しているため、
`QrAttendanceRdsStack-prod` 自体を destroy してはいけません。
