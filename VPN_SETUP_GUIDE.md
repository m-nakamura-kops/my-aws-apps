# VPN設定ガイド（検証環境アクセス用）

検証環境（`https://jpai-polaris-dev.azurewebsites.net/miniapps`）にアクセスするには、VPN設定が必要です。

## 📋 VPN認証情報

- **プロトコル**: OpenVPN (TCP)
- **サービスユーザー名**: `rzxeCCw9qJVAh2jAXVa6hMCc`
- **サービスパスワード**: `f9puGx72Wj8tdYWdQpF6ALbx`
- **ホスト名/IP**: `86.104.213.225`
- **ポート**: `1443`

**注意**: アカウント等は作成しなくても使えます。

## 🖥️ macOSでの設定手順（Surfshark VPN）

### 方法1: Surfshark VPNアプリを使用

1. **Surfshark VPNアプリをダウンロード**
   - https://surfshark.com/download からmacOS版をダウンロード
   - インストール

2. **手動接続の設定**
   - アプリを起動
   - 「Manual Connection」または「手動接続」を選択
   - 以下の情報を入力:
     - **Protocol**: OpenVPN (TCP)
     - **Service Username**: `rzxeCCw9qJVAh2jAXVa6hMCc`
     - **Service Password**: `f9puGx72Wj8tdYWdQpF6ALbx`
     - **Hostname/IP**: `86.104.213.225`
     - **Port**: `1443`
   - 「Connect」または「接続する」をクリック

3. **接続確認**
   - VPN接続後、検証環境URLにアクセス: https://jpai-polaris-dev.azurewebsites.net/miniapps

### 方法2: OpenVPN Connectアプリを使用

1. **OpenVPN Connectアプリをダウンロード**
   - App Storeから「OpenVPN Connect」をダウンロード
   - または https://openvpn.net/client-connect-vpn-for-mac-os/ からダウンロード

2. **設定ファイルの作成**
   - 以下の内容で `.ovpn` ファイルを作成:
   ```
   client
   dev tun
   proto tcp
   remote 86.104.213.225 1443
   resolv-retry infinite
   nobind
   persist-key
   persist-tun
   auth-user-pass
   ```

3. **接続**
   - OpenVPN Connectアプリで設定ファイルをインポート
   - ユーザー名とパスワードを入力
   - 接続

### 方法3: ターミナルからOpenVPNを使用

1. **OpenVPNのインストール**
   ```bash
   brew install openvpn
   ```

2. **設定ファイルの作成**
   ```bash
   # 設定ファイルを作成
   cat > ~/polaris-vpn.ovpn << EOF
   client
   dev tun
   proto tcp
   remote 86.104.213.225 1443
   resolv-retry infinite
   nobind
   persist-key
   persist-tun
   auth-user-pass
   EOF
   ```

3. **認証情報ファイルの作成**
   ```bash
   # 認証情報ファイルを作成
   cat > ~/polaris-vpn-auth.txt << EOF
   rzxeCCw9qJVAh2jAXVa6hMCc
   f9puGx72Wj8tdYWdQpF6ALbx
   EOF
   chmod 600 ~/polaris-vpn-auth.txt
   ```

4. **設定ファイルの編集**
   ```bash
   # 設定ファイルに認証情報ファイルのパスを追加
   echo "auth-user-pass ~/polaris-vpn-auth.txt" >> ~/polaris-vpn.ovpn
   ```

5. **VPN接続**
   ```bash
   sudo openvpn --config ~/polaris-vpn.ovpn
   ```

6. **接続確認**
   - VPN接続後、別のターミナルで検証環境URLにアクセス

## 🔍 接続確認

VPN接続後、以下のURLにアクセスできることを確認:
- https://jpai-polaris-dev.azurewebsites.net/miniapps

## 📚 参考資料

- Surfshark VPN設定動画（Windows版ですが参考になります）:
  https://support.surfshark.com/hc/en-us/articles/360003204233-How-to-set-up-the-OpenVPN-Connect-app-on-Windows

## ⚠️ 注意事項

- VPN認証情報は機密情報です。外部に漏洩しないよう注意してください
- VPN接続中は、インターネット接続がVPN経由になります
- VPN接続を切断する場合は、アプリの「Disconnect」をクリックするか、ターミナルで `Ctrl+C` を押してください

