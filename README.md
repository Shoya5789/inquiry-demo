# pubtech-inquiry-proto

行政AI問い合わせ対応システムのローカル動作 + Vercel 公開プロトタイプ。

## 技術スタック

- **Next.js 14** (App Router) + TypeScript
- **TailwindCSS** — UI
- **PostgreSQL (Supabase) + Prisma** — DB（ローカル開発もSupabaseを推奨）
- **Leaflet + react-leaflet** — OpenStreetMapベースの地図
- **Anthropic SDK** — AI（キーなしでもMockモードで全機能動作）
- **mailparser** — メール取り込み

---

## A. ローカル開発セットアップ

### 前提
- Node.js 20+
- Supabase アカウント（無料プランで OK）または ローカル Postgres

### 手順

```bash
# 1. 依存関係インストール（postinstall で prisma generate も自動実行）
npm install

# 2. .env ファイルを作成
cp .env.example .env
# → .env を開いて DATABASE_URL に Supabase の接続文字列を貼り付ける（下記参照）

# 3. DB マイグレーション（テーブル作成）
npx prisma migrate deploy

# 4. シードデータ投入（デモ用の10件の問い合わせ等）
npm run db:seed

# ↑ 3+4 を一括でやるなら:
npm run db:setup

# 5. 開発サーバー起動
npm run dev
```

→ http://localhost:3000 を開く

### DATABASE_URL の取得方法（Supabase）

1. https://supabase.com → 新プロジェクト作成
2. **Project Settings → Database → Connection string → URI**
3. **Transaction pooler** の URL をコピー（`?pgbouncer=true` が付くもの）
4. `.env` の `DATABASE_URL=` に貼り付け

```
# 例
DATABASE_URL=postgresql://postgres.xxxxxxxxxxxx:MyPassword@aws-0-ap-northeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true
```

> **PgBouncer + `prisma migrate deploy` の問題について**
> Transaction Pooler 経由では `migrate deploy` が失敗することがあります。
> その場合は **Session pooler** の URL（ポート `5432`、`?pgbouncer=true` なし）を使うか、
> Supabase の **Direct connection** URL（6543ではなく5432、pgbouncer なし）を使ってください。

---

## B. Vercel へのデプロイ

### 1. Supabase プロジェクト作成（未作成の場合）
上記「DATABASE_URL の取得方法」を参照。

### 2. GitHub にプッシュ

```bash
git init
git add .
git commit -m "init pubtech-inquiry-proto"
git remote add origin https://github.com/YOUR_NAME/pubtech-inquiry-proto.git
git push -u origin main
```

### 3. Vercel でプロジェクト作成

1. https://vercel.com → 「Add New Project」
2. GitHub リポジトリを選択
3. **Environment Variables** に以下を設定：

| Key | Value |
|-----|-------|
| `DATABASE_URL` | Supabase の接続文字列（Transaction pooler URL） |
| `STAFF_ADMIN_PASSWORD` | `admin123`（または任意の値） |
| `STAFF_STAFF_PASSWORD` | `staff123`（または任意の値） |
| `ANTHROPIC_API_KEY` | Anthropic の API キー（任意） |
| `SESSION_SECRET` | 任意のランダム文字列（32文字以上推奨） |
| `NEXT_PUBLIC_BASE_URL` | `https://your-app.vercel.app` |

4. 「Deploy」を押す → ビルド完了まで待つ

> `postinstall` に `prisma generate` が設定済みのため、
> Vercel のビルド中に自動的に Prisma Client が生成されます。

### 4. 初回のみ：DB 初期化（マイグレーション + シード）

Vercel ビルド中には自動でマイグレーションしません。**ローカルから手動実行**します：

```bash
# .env の DATABASE_URL が Supabase を向いていることを確認してから実行
npm run db:setup
# = prisma migrate deploy && prisma db seed
```

> `db:seed` は冪等設計なので、2回以上実行しても重複しません（既存データがあればスキップします）。

### 5. 動作確認

デプロイされた URL（例: `https://pubtech-inquiry-proto.vercel.app`）を開く。

---

## C. 環境変数一覧

| 変数 | 必須 | 説明 |
|------|------|------|
| `DATABASE_URL` | ✅ | PostgreSQL 接続文字列（Supabase 推奨） |
| `STAFF_ADMIN_PASSWORD` | ✅ | admin1 のパスワード（デフォルト: admin123） |
| `STAFF_STAFF_PASSWORD` | ✅ | staff1 のパスワード（デフォルト: staff123） |
| `ANTHROPIC_API_KEY` | 任意 | 未設定時は Mock AI モードで動作 |
| `SESSION_SECRET` | 任意 | セッション暗号化用（将来の署名付きCookie対応） |
| `NEXT_PUBLIC_BASE_URL` | 任意 | 公開URL（現在は未使用だが環境識別に利用） |

---

## D. AI モードについて

### Mock モード（デフォルト・API キー不要）
`ANTHROPIC_API_KEY` が未設定の場合、全機能がルールベースのモックで動作します：
- 緊急度・重要度・担当部署：キーワードマッチング
- レコメンド：KnowledgeSource のキーワード重なりで上位3件
- 類似検索：過去 Inquiry の normalizedText とのキーワード重なりで Top5
- 回答生成：ソース引用付きテンプレート回答

### LLM モード（Anthropic claude-haiku）
`ANTHROPIC_API_KEY` を設定すると Claude API を使用。LLMに投げる前に `maskPII()` でメール/電話をマスキングします。

---

## E. 画面一覧

| URL | 説明 |
|-----|------|
| `/citizen` | 住民向け問い合わせフォーム（3ステップ） |
| `/citizen/done` | 送信完了・受付番号表示 |
| `/staff/login` | 職員ログイン |
| `/staff` | 問い合わせ一覧（フィルタ・ソート付き） |
| `/staff/inquiries/[id]` | 詳細（地図・類似・AI回答生成・承認・送信） |
| `/staff/map` | 地図ビュー（位置情報付きマーカー） |
| `/admin/import` | メール/電話取り込み |
| `/admin/knowledge` | ナレッジ管理（追加/編集/削除/Sync） |
| `/admin/audit` | 監査ログ一覧 |

---

## F. デモ手順（主要フロー）

### 1. 住民フォーム（/citizen）
1. テキスト入力（例：「近所の道路が陥没しています。危険です」）
2. 「次へ」→ AI レコメンド表示 + 追加質問（位置・日時など）
3. 「返答を希望する」ON → 連絡先入力
4. 地図をクリックして位置設定（任意）
5. 「送信する」→ `/citizen/done` で受付番号確認

### 2. 職員ログイン（/staff/login）
- `admin1` / `admin123`（管理者・全画面アクセス可）
- `staff1` / `staff123`（職員・環境課）

### 3. AI 回答生成フロー（/staff/inquiries/[id]）
1. 問い合わせ詳細を開く
2. 「AI 回答案を生成」→ 参照ソース + 方針 + 回答文 + 補足が表示
3. 回答文を編集 → 「✅ 承認する」
4. 「📧 メールで送信」（擬似送信・ログに記録）

### 4. ナレッジ更新（/admin/knowledge）
1. 「+ ナレッジ追加」で新しいKnowledgeSource を作成
2. 既存のものを編集 → 「🔄 Sync」で差分更新（contentHash で判定）

---

## G. ローカルトンネル（外部公開・任意）

Vercel デプロイなしに外部から確認したい場合：

### cloudflared（推奨）
```bash
# macOS
brew install cloudflared
npm run dev &
cloudflared tunnel --url http://localhost:3000
# → https://xxxx.trycloudflare.com のような URL が発行される
```

### ngrok
```bash
# インストール後
ngrok http 3000
# → https://xxxx.ngrok-free.app のような URL が発行される
```

---

## H. トラブルシューティング

### `prisma migrate deploy` が失敗する（Supabase）
Transaction Pooler では DDL が通らない場合があります。以下を試してください：

```bash
# Session Pooler URL（ポート 5432）を使って実行
DATABASE_URL="postgresql://postgres.xxxx:pass@aws-0-ap-northeast-1.pooler.supabase.com:5432/postgres" npx prisma migrate deploy
```

または Supabase ダッシュボードの **SQL Editor** で `prisma/migrations/20260225000000_init/migration.sql` の内容を直接実行してください。

### DB をリセットしたい場合
```bash
# Supabase SQL Editor でテーブルをDROP後、再度:
npm run db:setup
```

### 地図が表示されない
Leaflet は SSR 非対応のため `dynamic()` で遅延ロードしています。ブラウザをリロードしてください。

### ログインできない
Cookie が残っている可能性があります。ブラウザの Cookie（`pubtech_session`）を削除してください。

---

## I. スクリプト一覧

| コマンド | 説明 |
|---------|------|
| `npm run dev` | 開発サーバー起動（localhost:3000） |
| `npm run build` | 本番ビルド |
| `npm run db:setup` | migrate deploy + seed（初回セットアップ） |
| `npm run db:migrate` | `prisma migrate deploy`（本番向け） |
| `npm run db:migrate:dev` | `prisma migrate dev`（開発時・新マイグレーション作成） |
| `npm run db:seed` | シードデータ投入（冪等・重複スキップ） |
| `npm run db:studio` | Prisma Studio 起動 |
