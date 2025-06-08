# IntentRelay

# IntentRelay

**ユーザーの意図を中継する、インテリジェントなDeferred DeepLinkサービス**

アプリ未インストール時のディープリンククリックとアプリ初回起動時の情報を安全に紐付けるサーバーサイドサービスです。

## 🎯 IntentRelayの特長

- **🔗 Intent Capturing**: ディープリンククリック時のユーザー意図を確実にキャプチャ
- **🛡️ Secure Matching**: デバイスフィンガープリントによる安全なマッチング  
- **⚡ High Performance**: Vercelサーバーレスまたはコンテナ対応
- **📱 Multi-Platform**: iOS/Android両対応
- **📊 Analytics Ready**: 詳細な統計情報とモニタリング

## 🌟 主要機能

### **Intent Capture**
ユーザーがディープリンクをクリックした瞬間の「意図」を確実にキャプチャし、安全に保存します。

### **Smart Relay**
アプリ初回起動時に、保存されたユーザー意図を正確に中継し、シームレスな体験を提供します。

### **Device Intelligence**
高度なデバイスフィンガープリンティングにより、プライバシーを保護しながら確実なマッチングを実現します。

## 🚀 Vercelでのクイックスタート

### 1. Vercel KVの設定

```bash
# Vercel CLIのインストール
npm install -g vercel

# プロジェクトの初期化
vercel

# IntentRelay専用KVデータベースの作成
vercel kv create intentrelay-db
```

### 2. 環境変数の設定

```bash
# Vercel KV接続情報（自動生成）
vercel env add KV_REST_API_URL
vercel env add KV_REST_API_TOKEN

# アプリ設定
vercel env add APP_NAME "YourApp"
vercel env add APP_SCHEME "yourapp" 
vercel env add IOS_APP_ID "123456789"
vercel env add ANDROID_PACKAGE "com.yourapp"
```

### 3. デプロイ実行

```bash
npm install
vercel --prod
```

## 🐳 Dockerでの運用

### Development Setup

```bash
# 開発環境の起動
docker-compose up -d

# 本番用イメージのビルド
docker build -t intentrelay .
```

### Production Deployment

```bash
# コンテナの実行
docker run -d \
  -p 3000:3000 \
  -e REDIS_URL=redis://your-redis:6379 \
  -e NODE_ENV=production \
  intentrelay
```

## 📱 アプリ側実装ガイド

### React Native 実装

```javascript
import DeviceInfo from 'react-native-device-info';

class IntentRelaySDK {
  constructor(serviceUrl) {
    this.serviceUrl = serviceUrl;
  }

  async checkIntent() {
    try {
      const deviceInfo = {
        os: await DeviceInfo.getSystemName(),
        osVersion: await DeviceInfo.getSystemVersion(),
        deviceModel: await DeviceInfo.getModel(),
        language: await DeviceInfo.getDeviceLocale(),
      };

      const response = await fetch(`${this.serviceUrl}/api/deferred-deeplink`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceInfo })
      });

      const result = await response.json();
      
      if (result.found) {
        console.log('🎯 Intent found:', result.linkData);
        return this.handleIntent(result.linkData);
      }
      
      return null;
    } catch (error) {
      console.warn('❌ IntentRelay check failed:', error);
      return null;
    }
  }

  handleIntent(linkData) {
    // カスタムナビゲーション処理
    const { content, campaign, source } = linkData;
    
    // 分析追跡
    this.trackIntentRelay(linkData);
    
    // ナビゲーション実行
    return {
      action: 'navigate',
      screen: 'Content',
      params: { id: content, campaign, source }
    };
  }

  trackIntentRelay(linkData) {
    // アナリティクスに送信
    console.log('📊 Intent relay tracked:', {
      intentId: linkData.linkId,
      content: linkData.content,
      campaign: linkData.campaign,
      source: linkData.source,
      matchScore: linkData.matchScore
    });
  }
}

// App.js での使用例
export default class App extends Component {
  async componentDidMount() {
    const intentRelay = new IntentRelaySDK('https://your-intentrelay.vercel.app');
    
    const intent = await intentRelay.checkIntent();
    if (intent) {
      // 意図を受け取った場合の処理
      this.navigateToContent(intent.params);
    }
  }
}
```

### iOS (Swift) 実装

```swift
import Foundation

class IntentRelaySDK {
    private let serviceURL: String
    
    init(serviceURL: String) {
        self.serviceURL = serviceURL
    }
    
    func checkIntent(completion: @escaping (IntentData?) -> Void) {
        let deviceInfo: [String: Any] = [
            "os": "iOS",
            "osVersion": UIDevice.current.systemVersion,
            "deviceModel": UIDevice.current.model,
            "language": Locale.current.languageCode ?? "unknown"
        ]
        
        let requestBody = ["deviceInfo": deviceInfo]
        
        guard let url = URL(string: "\(serviceURL)/api/deferred-deeplink"),
              let jsonData = try? JSONSerialization.data(withJSONObject: requestBody) else {
            completion(nil)
            return
        }
        
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.httpBody = jsonData
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        URLSession.shared.dataTask(with: request) { data, response, error in
            guard let data = data,
                  let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
                  let found = json["found"] as? Bool, found,
                  let linkData = json["linkData"] as? [String: Any] else {
                completion(nil)
                return
            }
            
            let intent = IntentData(from: linkData)
            DispatchQueue.main.async {
                completion(intent)
            }
        }.resume()
    }
}

struct IntentData {
    let linkId: String
    let content: String
    let campaign: String
    let source: String
    let matchScore: Double
    
    init(from dictionary: [String: Any]) {
        self.linkId = dictionary["linkId"] as? String ?? ""
        self.content = dictionary["content"] as? String ?? ""
        self.campaign = dictionary["campaign"] as? String ?? ""
        self.source = dictionary["source"] as? String ?? ""
        self.matchScore = dictionary["matchScore"] as? Double ?? 0.0
    }
}
```

## 🔗 インテントリンクの生成

IntentRelayでは以下のURL形式でユーザーの意図を含むリンクを生成します：

```
https://your-intentrelay.vercel.app/link/product-launch-2024
  ?content=premium-subscription
  &campaign=black-friday-2024
  &source=instagram-stories
  &utm_medium=social
```

### パラメータ説明

| パラメータ | 説明 | 例 |
|-----------|------|-----|
| `linkId` | 一意のインテントID | `product-launch-2024` |
| `content` | 目的コンテンツ | `premium-subscription` |
| `campaign` | キャンペーン名 | `black-friday-2024` |
| `source` | 流入元 | `instagram-stories` |

## 📊 API エンドポイント

### Intent Capture
```http
GET /link/:linkId?content=xxx&campaign=xxx&source=xxx
```
ユーザーのクリック時にインテントをキャプチャします。

### Intent Retrieval  
```http
POST /api/deferred-deeplink
Content-Type: application/json

{
  "deviceInfo": {
    "os": "iOS",
    "osVersion": "17.0", 
    "deviceModel": "iPhone",
    "language": "ja"
  }
}
```

### Health Check
```http
GET /health
```

### Analytics
```http
GET /api/stats?days=7
```

## 🛡️ セキュリティ & プライバシー

### **デバイスフィンガープリンティング**
- 複数のデバイス属性を組み合わせた暗号化済みフィンガープリント
- 個人特定情報は一切保存せず、ハッシュ値のみを使用

### **データ保護**
- 24時間自動削除によるプライバシー保護
- HTTPS必須の安全な通信
- GDPR/CCPA準拠の設計

### **マッチング精度**
- 60-70%以上の一致度による安全なマッチング
- 誤マッチ防止の多層チェック

## 📈 モニタリング & 分析

### **リアルタイム統計**
```bash
# 今日の成功率
curl https://your-intentrelay.vercel.app/api/stats

# 過去7日間の詳細統計  
curl https://your-intentrelay.vercel.app/api/stats?days=7
```

### **主要指標**
- **Intent Capture Rate**: インテントキャプチャ成功率
- **Relay Success Rate**: インテント中継成功率  
- **Match Accuracy**: デバイスマッチング精度
- **Time to Relay**: キャプチャから中継までの時間

## 🔧 カスタマイズ例

### **カスタムランディングページ**
```html
<!-- 自社ブランド対応のランディングページ -->
<div style="background: linear-gradient(135deg, #your-brand-color 0%, #secondary-color 100%);">
  <div class="brand-container">
    <img src="/your-logo.svg" alt="Your Brand" />
    <h2>アプリで続きを見る</h2>
    <p>より良い体験をお楽しみください</p>
  </div>
</div>
```

### **A/Bテスト対応**
```javascript
// リンク生成時にバリエーション指定
const linkUrl = `https://your-intentrelay.vercel.app/link/campaign-${campaignId}
  ?content=${contentId}
  &variant=${abTestVariant}  // A, B, C等
  &campaign=${campaignName}`;
```

## 🌍 本番運用のベストプラクティス

### **Vercel設定**
```json
{
  "functions": {
    "api/**/*.js": {
      "maxDuration": 30
    }
  },
  "regions": ["nrt1", "sfo1", "fra1"]
}
```

### **Redis設定（Docker版）**
```yaml
version: '3.8'
services:
  intentrelay:
    image: intentrelay:latest
    environment:
      - REDIS_URL=redis://redis-cluster:6379
      - NODE_ENV=production
    deploy:
      replicas: 3
```

### **監視設定**
```bash
# Vercel Functions監視
vercel logs --follow

# Docker監視  
docker logs -f intentrelay
```

## 📞 サポート & トラブルシューティング

### **よくある問題**

**Q: インテントが見つからない**
```bash
# デバッグ手順
1. デバイス情報の確認
2. タイムスタンプの確認（24時間以内か？）
3. フィンガープリント生成の検証
```

**Q: マッチング精度が低い** 
```javascript
// マッチング閾値の調整
const MATCH_THRESHOLD = 0.6; // 60%から調整可能
```

**Q: レスポンス時間が遅い**
```bash
# パフォーマンス最適化
- Vercel Edgeの活用
- Redis接続プールの設定
- CDNキャッシュの最適化
```

### **技術サポート**
- 📧 Email: support@your-domain.com
- 📚 Documentation: https://docs.intentrelay.dev
- 💬 Community: https://github.com/your-org/intentrelay

---

## 🚀 今すぐ始めよう

```bash
# 1分でスタート
git clone https://github.com/your-org/intentrelay
cd intentrelay
vercel
```

**IntentRelay** で、ユーザーの意図を確実に中継し、アプリ成長を加速させましょう。

---

*IntentRelay - ユーザーの意図を、確実に届ける。*

# IntentRelay - プロジェクト構造

## 📁 最終ファイル構造

```
intentrelay/
├── 📋 package.json                    # 依存関係・スクリプト
├── 📋 vercel.json                     # Vercel設定
├── 📋 README.md                       # プロジェクトドキュメント
├── 📋 .env.example                    # 環境変数サンプル
├── 📋 .vercelignore                   # Vercel無視ファイル
├── 📋 deploy.sh                       # デプロイスクリプト
├── 📋 Dockerfile                      # Docker設定
├── 📋 docker-compose.yml              # Docker Compose設定
├── 📋 server.js                       # Docker用Expressサーバー
├── 📁 api/                            # Vercel Serverless Functions
│   ├── 📄 link.js                     # リンククリック処理
│   ├── 📄 deferred-deeplink.js        # Intent取得API
│   ├── 📄 health.js                   # ヘルスチェック
│   └── 📄 stats.js                    # 統計情報API
├── 📁 .github/
│   └── 📁 workflows/
│       └── 📄 deploy.yml              # GitHub Actions設定
└── 📁 docs/
    ├── 📄 api-reference.md            # API仕様書
    ├── 📄 integration-guide.md        # 統合ガイド
    └── 📄 troubleshooting.md          # トラブルシューティング
```

## 🎯 アーティファクト対応表

| ファイル名 | アーティファクトID | 説明 |
|-----------|------------------|------|
| `package.json` | `vercel_serverless_config` | 📦 依存関係とプロジェクト設定 |
| `vercel.json` | `vercel_config` | ⚙️ Vercelルーティング・ビルド設定 |
| `api/link.js` | `vercel_link_handler` | 🔗 リンククリック処理API |
| `api/deferred-deeplink.js` | `vercel_deferred_api` | 📱 Intent取得API |
| `api/health.js` | `vercel_health_api` | 🏥 ヘルスチェックAPI |
| `api/stats.js` | `vercel_stats_api` | 📊 統計情報API |
| `Dockerfile` | `dockerfile_config` | 🐳 Docker設定 |
| `server.js` | `docker_server` | 🖥️ Docker用Expressサーバー |
| `deploy.sh` + その他設定 | `deployment_scripts` | 🚀 デプロイスクリプト群 |
| `README.md` | `readme_documentation` | 📚 完全なドキュメント |

## 🚀 Vercel版（推奨）

### 必須ファイル
```
intentrelay/
├── package.json          ← vercel_serverless_config
├── vercel.json           ← vercel_config  
├── api/
│   ├── link.js           ← vercel_link_handler
│   ├── deferred-deeplink.js ← vercel_deferred_api
│   ├── health.js         ← vercel_health_api
│   └── stats.js          ← vercel_stats_api
└── README.md             ← readme_documentation
```

### デプロイ手順
```bash
# 1. ファイル作成（上記アーティファクトをコピー）
# 2. Vercel KV作成
vercel kv create intentrelay-db
# 3. デプロイ
vercel --prod
```

## 🐳 Docker版

### 必須ファイル
```
intentrelay/
├── package.json          ← vercel_serverless_config（nameとdependencies部分）
├── Dockerfile            ← dockerfile_config
├── docker-compose.yml    ← deployment_scripts（docker-compose部分）
├── server.js             ← docker_server
└── README.md             ← readme_documentation
```

### デプロイ手順
```bash
# 1. ファイル作成（上記アーティファクトをコピー）
# 2. Docker起動
docker-compose up -d
# または
docker build -t intentrelay .
docker run -p 3000:3000 intentrelay
```

## 📝 セットアップ順序

### Step 1: 基本ファイル作成
1. `package.json` → `vercel_serverless_config`をコピー
2. `README.md` → `readme_documentation`をコピー

### Step 2: Vercel版かDocker版を選択

#### 🎯 Vercel版（推奨）
3. `vercel.json` → `vercel_config`をコピー
4. `api/`フォルダ作成
5. `api/link.js` → `vercel_link_handler`をコピー
6. `api/deferred-deeplink.js` → `vercel_deferred_api`をコピー
7. `api/health.js` → `vercel_health_api`をコピー
8. `api/stats.js` → `vercel_stats_api`をコピー

#### 🐳 Docker版
3. `Dockerfile` → `dockerfile_config`をコピー
4. `server.js` → `docker_server`をコピー
5. `docker-compose.yml` → `deployment_scripts`の該当部分をコピー

### Step 3: 環境設定
- Vercel版: Vercel KV作成 + 環境変数設定
- Docker版: Redis準備 + 環境変数設定

### Step 4: デプロイ
- Vercel版: `vercel --prod`
- Docker版: `docker-compose up -d`

## 🎯 開発フロー

1. **ローカル開発**
   ```bash
   # Vercel版
   vercel dev
   
   # Docker版  
   docker-compose up
   ```

2. **テスト**
   ```bash
   # ヘルスチェック
   curl http://localhost:3000/health
   
   # テストリンク
   curl http://localhost:3000/link/test123?content=demo
   ```

3. **本番デプロイ**
   ```bash
   # Vercel版
   vercel --prod
   
   # Docker版
   docker build -t intentrelay .
   docker push your-registry/intentrelay
   ```

## 💡 推奨開発環境

```bash
# 開発に必要なツール
npm install -g vercel          # Vercel CLI
docker --version              # Docker
git --version                 # Git

# エディタ推奨設定
.vscode/settings.json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode"
}
```

この構造に従って、各アーティファクトを対応するファイルにコピーしてください！