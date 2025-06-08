# Dockerfile - IntentRelay Container Configuration
FROM node:18-alpine

WORKDIR /app

# Package.jsonをコピーして依存関係をインストール
COPY package*.json ./
RUN npm ci --only=production

# アプリケーションコードをコピー
COPY . .

# 非特権ユーザーを作成
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nextjs -u 1001

# ファイルの所有権を変更
RUN chown -R nextjs:nodejs /app
USER nextjs

# ポート3000を公開
EXPOSE 3000

# 環境変数
ENV NODE_ENV=production
ENV PORT=3000

# ヘルスチェック
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

# アプリケーション起動
CMD ["node", "server.js"]