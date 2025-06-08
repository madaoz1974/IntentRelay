import { kv } from '@vercel/kv';
import UAParser from 'ua-parser-js';
import crypto from 'crypto';

const EXPIRATION_TIME = 24 * 60 * 60; // 24時間（秒）

// デバイスフィンガープリント生成
function generateDeviceFingerprint(req) {
  const parser = new UAParser(req.headers['user-agent']);
  const device = parser.getResult();
  
  const fingerprint = crypto
    .createHash('sha256')
    .update([
      req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || 'unknown',
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

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { linkId } = req.query;
    const { content, campaign, source } = req.query;
    
    if (!linkId) {
      return res.status(400).json({ error: 'linkId is required' });
    }
    
    // デバイスフィンガープリント生成
    const fingerprint = generateDeviceFingerprint(req);
    
    // User-Agent解析
    const parser = new UAParser(req.headers['user-agent']);
    const device = parser.getResult();
    const isIOS = device.os.name === 'iOS';
    const isAndroid = device.os.name === 'Android';
    const isMobile = isIOS || isAndroid;
    
    if (!isMobile) {
      // デスクトップの場合はWebページにリダイレクト
      return res.redirect(`https://yourwebsite.com/content/${content || 'default'}`);
    }
    
    // IntentRelay - ディープリンク情報をVercel KVに保存
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
        ip: req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || 'unknown'
      }
    };
    
    // Vercel KVに保存（TTLを設定）
    await kv.setex(`intentrelay:${fingerprint}`, EXPIRATION_TIME, JSON.stringify(linkData));
    
    // アプリストアURL（環境変数から取得）
    const IOS_APP_ID = process.env.IOS_APP_ID || '123456789';
    const ANDROID_PACKAGE = process.env.ANDROID_PACKAGE || 'com.yourapp';
    const APP_SCHEME = process.env.APP_SCHEME || 'yourapp';
    const WEBSITE_URL = process.env.WEBSITE_URL || 'https://yourwebsite.com';
    
    const appStoreURL = isIOS
      ? `https://apps.apple.com/app/yourapp/id${IOS_APP_ID}`
      : `https://play.google.com/store/apps/details?id=${ANDROID_PACKAGE}`;
    
    // ディープリンクURL
    const deepLinkURL = `${APP_SCHEME}://content/${content || 'default'}?campaign=${campaign || 'direct'}&source=${source || 'unknown'}`;
    
    // Smart Bannerとアプリ起動試行のHTML
    const redirectHTML = `
    <!DOCTYPE html>
    <html lang="ja">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>IntentRelay - アプリを開いています...</title>
      ${isIOS ? `<meta name="apple-itunes-app" content="app-id=${IOS_APP_ID}, app-argument=${encodeURIComponent(deepLinkURL)}">` : ''}
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
            // iOSの場合
            window.location = '${deepLinkURL}';
          } else {
            // Androidの場合 - Intent URLを使用
            const intent = 'intent://${content || 'default'}#Intent;scheme=yourapp;package=com.yourapp;S.campaign=${campaign || 'direct'};S.source=${source || 'unknown'};S.browser_fallback_url=${encodeURIComponent(appStoreURL)};end';
            window.location = intent;
          }
          
          // 3秒後にアプリが開かなかった場合はストアへ
          timeout = setTimeout(() => {
            if (!opened) {
              window.location = '${appStoreURL}';
            }
          }, 3000);
        }
        
        // ページ読み込み完了後に実行
        window.addEventListener('load', () => {
          setTimeout(tryOpenApp, 500); // 少し遅延させて確実に実行
        });
        
        // ページがバックグラウンドになった場合（アプリが開いた可能性）
        document.addEventListener('visibilitychange', () => {
          if (document.hidden) {
            opened = true;
            if (timeout) clearTimeout(timeout);
          }
        });
        
        // ページフォーカスが失われた場合
        window.addEventListener('blur', () => {
          opened = true;
          if (timeout) clearTimeout(timeout);
        });
        
        // ページを離れる場合
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
}