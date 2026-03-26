# 検証環境403エラー（Ip Forbidden）の対処法

## 問題の概要

検証環境（`https://jpai-polaris-dev.azurewebsites.net/miniapps`）にアクセスしようとすると、以下のエラーが発生：

- **エラー**: `Error 403 - Forbidden`
- **メッセージ**: "The web app you have attempted to reach has blocked your access."
- **コンソールエラー**: "Failed to load resource: the server responded with a status of 403 (Ip Forbidden)"

## 原因

検証環境は**IPアドレスベースのアクセス制御**が設定されており、許可されたIPアドレスからのみアクセス可能です。VPN接続が正しく機能していない、またはVPN経由のIPアドレスが許可リストに含まれていない可能性があります。

## 確認手順

### 1. VPN接続の確認

VPNが正しく接続されているか確認してください：

**Windowsの場合（Surfshark VPN）:**
- VPNアプリが起動しているか確認
- 「接続済み」または「Connected」と表示されているか確認
- 接続が切れている場合は、再接続を試す

**macOSの場合:**
- VPNアプリのステータスを確認
- 接続が切れている場合は、再接続を試す

### 2. IPアドレスの確認

VPN接続後、実際にVPN経由のIPアドレスになっているか確認：

1. VPNを接続した状態で、以下のサイトにアクセス：
   - https://www.whatismyip.com/
   - https://ipinfo.io/

2. 表示されるIPアドレスを確認
   - VPN接続前と後でIPアドレスが変わっているか確認
   - 変わっていない場合、VPN接続が正しく機能していない可能性があります

### 3. VPN設定の再確認

検証環境用のVPN設定が正しいか確認：

**VPN認証情報:**
- **プロトコル**: OpenVPN (TCP)
- **サービスユーザー名**: `rzxeCCw9qJVAh2jAXVa6hMCc`
- **サービスパスワード**: `f9puGx72Wj8tdYWdQpF6ALbx`
- **ホスト名/IP**: `86.104.213.225`
- **ポート**: `1443`

## 対処法

### 方法1: VPN接続の再接続

1. VPN接続を一度切断
2. 数秒待つ
3. VPN接続を再度確立
4. ブラウザをリロードして再アクセス

### 方法2: VPN設定の再確認

VPN設定が正しいか確認し、必要に応じて再設定：

**Windows（Surfshark VPN）の場合:**
1. VPNアプリを開く
2. 「Manual Connection」または「手動接続」を選択
3. 以下の情報が正しく入力されているか確認：
   - Protocol: OpenVPN (TCP)
   - Service Username: `rzxeCCw9qJVAh2jAXVa6hMCc`
   - Service Password: `f9puGx72Wj8tdYWdQpF6ALbx`
   - Hostname/IP: `86.104.213.225`
   - Port: `1443`
4. 接続を試す

### 方法3: ブラウザのキャッシュクリア

ブラウザのキャッシュやCookieをクリアして再試行：

1. ブラウザの設定を開く
2. 履歴データの削除を選択
3. キャッシュとCookieを削除
4. ブラウザを再起動
5. VPN接続後、再度検証環境にアクセス

### 方法4: 別のブラウザで試す

現在のブラウザで問題が続く場合、別のブラウザで試してください：

- Chrome
- Firefox
- Edge
- Safari

### 方法5: 管理者に確認

上記の方法で解決しない場合、以下の情報を管理者に確認してください：

- 現在のIPアドレス（VPN接続後）
- VPN接続の状態
- エラーメッセージのスクリーンショット

## 注意事項

- 検証環境はVPN接続が**必須**です
- VPN接続が切れていると、403エラーが発生します
- VPN接続後もIPアドレスが変わらない場合は、VPN設定を見直してください
- 検証環境へのアクセス権限は管理者が管理しています

## 参考資料

- VPN設定ガイド: `VPN_SETUP_GUIDE.md`
- 環境構築ガイド: `POLARIS_SETUP_GUIDE.md`

