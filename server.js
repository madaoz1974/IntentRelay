// server.js - IntentRelay Docker用のExpressサーバー
const express = require('express');
const crypto = require('crypto');
const UAParser = require('ua-parser-js');
const Redis = require('redis');

const app = express();
const PORT = process.env.PORT || 3000;

// Redis接続設定
const redis = Redis.createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379'
});

redis.on('error', (err) => console.error('Redis Client Error', err));
redis.connect();

const EXPIRATION_TIME = 24 * 60 * 60; // 24時間（秒）

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// CORS設定
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  next();
});

// デバイスフィンガープリント生成
function generateDeviceFingerprint(req) {
  const parser = new UAParser(req.headers['user-agent']);
  const device = parser.getResult();
  
  const fingerprint = crypto
    .createHash('sha256')
    .update([
      req.ip || req.headers['x-forwarded-for'] || 'unknown',
      device.browser.name || 'unknown',
      device.browser.version || 'unknown',
      device.os.name || 'unknown',
      device.os.version || 'unknown',
      device.device.model || 'unknown',
      req.headers['accept-language'] || '',
      req.headers['accept-encoding'] || ''
    ].join('|'))
    .digest('hex');
    
  return fingerprint;
}

// リンククリック処理
app.get('/link/:linkId', async (req, res) => {
  try {
    const { linkId } = req.params;
    const { content, campaign, source } = req.query;
    
    const fingerprint = generateDeviceFingerprint(req);
    const parser = new UAParser(req.headers['user-agent']);
    const device = parser.getResult();
    const isIOS = device.os.name === 'iOS';
    const isAndroid = device.os.name === 'Android';
    const isMobile = isIOS || isAndroid;
    
    if (!isMobile) {
      return res.redirect(`https://yourwebsite.com/content/${content || 'default'}`);
    }
    
    const linkData = {
      linkId,
      content: content || 'default',
      campaign: campaign || 'direct',
      source: source || 'unknown',
      fingerprint,
      timestamp: Date.now(),
      deviceInfo: {
        os: device.os.name,
        osVersion: device.os.version,
        browser: device.browser.name,
        ip: req.ip || req.headers['x-forwarded-for'] || 'unknown'
      }
    };
    
    // Redisに保存
    await redis.setEx(`intentrelay:${fingerprint}`, EXPIRATION_TIME, JSON.stringify(linkData));
    
    const appStoreURL = isIOS
      ? 'https://apps.apple.com/app/yourapp/id123456789'
      : 'https://play.google.com/store/apps/details?id=com.yourapp';
    
    const deepLinkURL = `yourapp://content/${content || 'default'}?campaign=${campaign || 'direct'}&source=${source || 'unknown'}`;
    
    const redirectHTML = `
    <!DOCTYPE html>
    <html lang="ja">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>アプリを開いています...</title>
      ${isIOS ? `<meta name="apple-itunes-app" content="app-id=123456789, app-argument=${encodeURIComponent(deepLinkURL)}">` : ''}
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          margin: 0;
          padding: 20px;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
          text-align: center;
        }
        .container {
          background: rgba(255, 255, 255, 0.1);
          padding: 40px;
          border-radius: 16px;
          backdrop-filter: blur(10px);
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
        }
        .spinner {
          width: 40px;
          height: 40px;
          border: 4px solid rgba(255, 255, 255, 0.3);
          border-top: 4px solid white;
          border-radius: 50%;
          animation: spin 1s linear infinite;
          margin: 20px auto;
        }
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        .store-button {
          display: inline-block;
          background: white;
          color: #333;
          padding: 12px 24px;
          text-decoration: none;
          border-radius: 8px;
          margin-top: 20px;
          font-weight: bold;
          transition: transform 0.2s;
        }
        .store-button:hover {
          transform: translateY(-2px);
        }
      </style>
    </head>
    <body>
      <div class="container">
        <h2>アプリを開いています...</h2>
        <div class="spinner"></div>
        <p>アプリがインストールされていない場合は、<br>自動的にストアにリダイレクトされます。</p>
        <a href="${appStoreURL}" id="storeLink" class="store-button">アプリをダウンロード</a>
      </div>
      
      <script>
        let opened = false;
        let timeout;
        
        function tryOpenApp() {
          if (opened) return;
          
          const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
          
          if (isIOS) {
            window.location = '${deepLinkURL}';
          } else {
            const intent = 'intent://${content || 'default'}#Intent;scheme=yourapp;package=com.yourapp;S.campaign=${campaign || 'direct'};S.source=${source || 'unknown'};S.browser_fallback_url=${encodeURIComponent(appStoreURL)};end';
            window.location = intent;
          }
          
          timeout = setTimeout(() => {
            if (!opened) {
              window.location = '${appStoreURL}';
            }
          }, 3000);
        }
        
        window.addEventListener('load', () => {
          setTimeout(tryOpenApp, 500);
        });
        
        document.addEventListener('visibilitychange', () => {
          if (document.hidden) {
            opened = true;
            if (timeout) clearTimeout(timeout);
          }
        });
        
        window.addEventListener('blur', () => {
          opened = true;
          if (timeout) clearTimeout(timeout);
        });
        
        window.addEventListener('beforeunload', () => {
          opened = true;
          if (timeout) clearTimeout(timeout);
        });
      </script>
    </body>
    </html>`;
    
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.status(200).send(redirectHTML);
    
  } catch (error) {
    console.error('Link processing error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Deferred DeepLink取得API
app.post('/api/deferred-deeplink', async (req, res) => {
  try {
    const { deviceInfo, appInfo } = req.body;
    
    if (!deviceInfo) {
      return res.status(400).json({ error: 'deviceInfo is required' });
    }
    
    const fingerprint = crypto
      .createHash('sha256')
      .update([
        deviceInfo.ip || req.ip || 'unknown',
        deviceInfo.browser || 'app',
        deviceInfo.browserVersion || (appInfo && appInfo.version) || 'unknown',
        deviceInfo.os || 'unknown',
        deviceInfo.osVersion || 'unknown',
        deviceInfo.deviceModel || 'unknown',
        deviceInfo.language || '',
        deviceInfo.encoding || ''
      ].join('|'))
      .digest('hex');
    
    const linkDataStr = await redis.get(`intentrelay:${fingerprint}`);
    
    if (!linkDataStr) {
      return res.json({ found: false, reason: 'No matching fingerprint found' });
    }
    
    const linkData = JSON.parse(linkDataStr);
    
    if (Date.now() - linkData.timestamp > EXPIRATION_TIME * 1000) {
      await redis.del(`intentrelay:${fingerprint}`);
      return res.json({ found: false, reason: 'Data expired' });
    }
    
    const response = {
      found: true,
      linkData: {
        linkId: linkData.linkId,
        content: linkData.content,
        campaign: linkData.campaign,
        source: linkData.source,
        timestamp: linkData.timestamp
      }
    };
    
    await redis.del(`intentrelay:${fingerprint}`);
    
    res.json(response);
    
  } catch (error) {
    console.error('Deferred deeplink API error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ヘルスチェック
app.get('/health', async (req, res) => {
  try {
    const testKey = `health:${Date.now()}`;
    await redis.setEx(testKey, 10, 'ok');
    const testValue = await redis.get(testKey);
    await redis.del(testKey);
    
    if (testValue !== 'ok') {
      throw new Error('Redis test failed');
    }
    
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      redis: 'connected'
    });
    
  } catch (error) {
    console.error('Health check failed:', error);
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error.message
    });
  }
});

// 統計情報
app.get('/api/stats', async (req, res) => {
  try {
    const keys = await redis.keys('intentrelay:*');
    res.json({
      activePendingLinks: keys.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Stats error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// サーバー起動
app.listen(PORT, () => {
  console.log(`IntentRelay Server running on port ${PORT}`);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully');
  await redis.quit();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down gracefully');
  await redis.quit();
  process.exit(0);
});

module.exports = app;