# deploy.sh - デプロイスクリプト
#!/bin/bash

set -e

echo "🚀 IntentRelay Service Deployment"

# Vercelデプロイ用の環境変数チェック
check_vercel_env() {
    echo "📋 Checking Vercel environment variables..."
    
    if [ -z "$KV_REST_API_URL" ] || [ -z "$KV_REST_API_TOKEN" ]; then
        echo "❌ Error: Vercel KV environment variables are not set"
        echo "Please set up Vercel KV and configure the following environment variables:"
        echo "  - KV_REST_API_URL"
        echo "  - KV_REST_API_TOKEN"
        echo ""
        echo "You can set them using:"
        echo "  vercel env add KV_REST_API_URL"
        echo "  vercel env add KV_REST_API_TOKEN"
        echo ""
        echo "Optional app-specific environment variables:"
        echo "  vercel env add IOS_APP_ID [your-ios-app-id]"
        echo "  vercel env add ANDROID_PACKAGE [your.android.package]"
        echo "  vercel env add APP_SCHEME [your-app-scheme]"
        echo "  vercel env add WEBSITE_URL [https://your-website.com]"
        exit 1
    fi
    
    echo "✅ Required environment variables are set"
    
    # オプション設定の確認
    if [ -z "$IOS_APP_ID" ]; then
        echo "⚠️  Warning: IOS_APP_ID not set, using default"
    fi
    if [ -z "$ANDROID_PACKAGE" ]; then
        echo "⚠️  Warning: ANDROID_PACKAGE not set, using default"
    fi
}

# Vercelにデプロイ
deploy_to_vercel() {
    echo "🔧 Installing Vercel CLI..."
    npm install -g vercel
    
    echo "📦 Installing dependencies..."
    npm install
    
    echo "🚀 Deploying to Vercel..."
    vercel --prod
    
    echo "✅ Deployment completed!"
    echo "🌐 Your IntentRelay service is now live on Vercel"
}

# Dockerイメージのビルドとデプロイ
deploy_docker() {
    echo "🐳 Building Docker image..."
    docker build -t intentrelay .
    
    echo "🏷️ Tagging image..."
    docker tag intentrelay:latest your-registry/intentrelay:latest
    
    echo "📤 Pushing to registry..."
    docker push your-registry/intentrelay:latest
    
    echo "✅ Docker deployment completed!"
}

# メイン処理
case "${1:-vercel}" in
    "vercel")
        echo "🎯 Deploying to Vercel..."
        check_vercel_env
        deploy_to_vercel
        ;;
    "docker")
        echo "🎯 Deploying with Docker..."
        deploy_docker
        ;;
    *)
        echo "Usage: $0 [vercel|docker]"
        echo "  vercel: Deploy to Vercel (default)"
        echo "  docker: Build and push Docker image"
        exit 1
        ;;
esac

echo "🎉 Deployment completed successfully!"

# .env.example - 環境変数のサンプル
# ==================================================

# Vercel用環境変数 (.env.local)
# KV_REST_API_URL=https://your-kv-url.upstash.io
# KV_REST_API_TOKEN=your-kv-token

# Docker用環境変数 (.env)
# NODE_ENV=production
# PORT=3000
# REDIS_URL=redis://localhost:6379

# アプリ設定
# APP_NAME=YourApp
# APP_SCHEME=yourapp
# IOS_APP_ID=123456789
# ANDROID_PACKAGE=com.yourapp
# WEBSITE_URL=https://yourwebsite.com

# ==================================================

# docker-compose.yml - 開発・テスト用
# ==================================================
version: '3.8'

services:
  intentrelay:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - REDIS_URL=redis://redis:6379
    depends_on:
      - redis
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    restart: unless-stopped

volumes:
  redis_data:

# ==================================================

# .vercelignore - Vercelで無視するファイル
# ==================================================
Dockerfile
docker-compose.yml
server.js
.env
.env.local
*.log
node_modules
.git

# ==================================================

# GitHub Actions ワークフロー (.github/workflows/deploy.yml)
# ==================================================
name: Deploy to Vercel

on:
  push:
    branches: [ main ]
  pull_request:
    branches: [ main ]

jobs:
  deploy:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '18'
        cache: 'npm'
    
    - name: Install dependencies
      run: npm ci
    
    - name: Deploy to Vercel
      uses: amondnet/vercel-action@v25
      with:
        vercel-token: ${{ secrets.VERCEL_TOKEN }}
        vercel-org-id: ${{ secrets.ORG_ID }}
        vercel-project-id: ${{ secrets.PROJECT_ID }}
        vercel-args: '--prod'