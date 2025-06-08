import { kv } from '@vercel/kv';
import crypto from 'crypto';

const EXPIRATION_TIME = 24 * 60 * 60 * 1000; // 24時間（ミリ秒）

// デバイス情報の一致度計算
function calculateDeviceMatchScore(stored, current) {
  let score = 0;
  let totalChecks = 0;
  
  // OS名
  if (stored.os && current.os) {
    totalChecks++;
    if (stored.os === current.os) score++;
  }
  
  // OSバージョン（メジャーバージョンのみ）
  if (stored.osVersion && current.osVersion) {
    totalChecks++;
    const storedMajor = stored.osVersion.split('.')[0];
    const currentMajor = current.osVersion.split('.')[0];
    if (storedMajor === currentMajor) score++;
  }
  
  // IP (同一ネットワークの可能性)
  if (stored.ip && current.ip) {
    totalChecks++;
    const storedSubnet = stored.ip.split('.').slice(0, 3).join('.');
    const currentSubnet = current.ip.split('.').slice(0, 3).join('.');
    if (storedSubnet === currentSubnet) score++;
  }
  
  return totalChecks > 0 ? score / totalChecks : 0;
}

export default async function handler(req, res) {
  // CORSヘッダーを追加
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { deviceInfo, appInfo } = req.body;
    
    if (!deviceInfo) {
      return res.status(400).json({ error: 'deviceInfo is required' });
    }
    
    // デバイスフィンガープリント再生成
    const fingerprint = crypto
      .createHash('sha256')
      .update([
        deviceInfo.ip || req.headers['x-forwarded-for'] || 'unknown',
        deviceInfo.browser || 'app',
        deviceInfo.browserVersion || (appInfo && appInfo.version) || 'unknown',
        deviceInfo.os || 'unknown',
        deviceInfo.osVersion || 'unknown',
        deviceInfo.deviceModel || 'unknown',
        deviceInfo.language || '',
        deviceInfo.encoding || ''
      ].join('|'))
      .digest('hex');
    
    // Vercel KVから保存されたリンクデータを取得
    const linkDataStr = await kv.get(`intentrelay:${fingerprint}`);
    
    if (!linkDataStr) {
      return res.json({ found: false, reason: 'No matching fingerprint found' });
    }
    
    const linkData = JSON.parse(linkDataStr);
    
    // 期限チェック
    if (Date.now() - linkData.timestamp > EXPIRATION_TIME) {
      // 期限切れデータを削除
      await kv.del(`intentrelay:${fingerprint}`);
      return res.json({ found: false, reason: 'Data expired' });
    }
    
    // デバイス情報の一致度チェック
    const deviceScore = calculateDeviceMatchScore(linkData.deviceInfo, deviceInfo);
    
    if (deviceScore < 0.6) { // 60%以上の一致が必要（Vercelでは少し緩めに設定）
      return res.json({ 
        found: false, 
        reason: 'Device mismatch',
        score: deviceScore 
      });
    }
    
    // マッチしたリンクデータを返却
    const response = {
      found: true,
      linkData: {
        linkId: linkData.linkId,
        content: linkData.content,
        campaign: linkData.campaign,
        source: linkData.source,
        matchScore: deviceScore,
        timestamp: linkData.timestamp
      }
    };
    
    // 使用済みデータを削除
    await kv.del(`intentrelay:${fingerprint}`);
    
    // 統計情報を更新
    try {
      const today = new Date().toISOString().split('T')[0];
      await kv.incr(`stats:success:${today}`);
    } catch (statsError) {
      console.warn('Failed to update stats:', statsError);
    }
    
    res.json(response);
    
  } catch (error) {
    console.error('Deferred deeplink API error:', error);
    
    // エラー統計を更新
    try {
      const today = new Date().toISOString().split('T')[0];
      await kv.incr(`stats:error:${today}`);
    } catch (statsError) {
      console.warn('Failed to update error stats:', statsError);
    }
    
    res.status(500).json({ error: 'Internal server error' });
  }
}