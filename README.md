# ポーカーフェイト成績表

ポーカーチェイスのフレンド戦の集計表。

## 画面

| ファイル | 内容 |
|---|---|
| `index.html` | 成績表（集計期間・規定数で絞り込み、列クリックで並び替え） |
| `matches.html` | 試合一覧 |
| `input.html` | 試合結果の入力・編集・削除（要ログイン） |
| `master.html` | プレイヤー / 集計期間（要ログイン） |

## 集計ルール

- 1試合6人。順位は 1位〜6位
- ポイント: 1位 +4 / 2位 +2 / 3位 0 / 4位 −1 / 5位 −2 / 6位 −3（合計0）
- 平均順位 / 1〜6位率 / 2〜5連対率 / 1〜6位回数
- 集計期間は1ヶ月ごと。マスタで追加・編集する
- 規定数… 指定したゲーム数に満たない人は成績表に出さない

## データ

Firebase Realtime Database（ドラフト会議アプリと同じ `porker-chase-draft` プロジェクト）の
`stats/` 配下に保存する。

```
stats/
  teams/{id}     { id, no, name }
  players/{id}   { id, no, name, teamId, youtube }
  periods/{id}   { id, no, name, from, to }   ※ from/to は YYYYMMDD の数値
  matches/{id}   { id, no, code, date, players: [1位, 2位, ..., 6位のplayerId] }
  settings       { points, seats, minGames }
```

### はじめて使うとき

データは空の状態から始める。`master.html` でプレイヤーと集計期間を登録し、
`input.html` で試合結果を入れていく。

チームは画面に出していない。後で使うときのために、データ構造だけ残してある
（`teams` と選手の `teamId`。今はどちらも空）。

### Firebase のルール

セキュリティルールはデータベースに1枚しかなく、ドラフト会議アプリと共用している。
ルート直下が `.read: false / .write: false` で、名指しで開けたパスしか通らないため、
`stats/` のブロックを追記しないと読み書きとも拒否される。

追記する内容は [`firebase-rules-stats.json`](firebase-rules-stats.json)。
既存の `draft` / `live` ブロックには触らない。

## ログイン

入力とマスタ編集は **Firebase Authentication（メール/パスワード）の共有アカウント**で守る。
ルール側も `stats/.write: "auth != null"` にしてあるので、DBのレベルで効いている。

- 共有アカウントのメールアドレスは `js/core.js` の `ADMIN_EMAIL`
- 画面ではパスワードだけ入力する（メールアドレスはコードに埋め込み）
- パスワードの変更は Firebase コンソール → Authentication → ユーザー から

### 初期設定

1. Firebase コンソール → **Authentication** → **始める**
2. **Sign-in method** → **メール/パスワード** を有効にする
3. **Users** → **ユーザーを追加** で共有アカウントを1つ作る
4. そのメールアドレスを `js/core.js` の `ADMIN_EMAIL` に書く

### 練習モード（`?demo=1`）のパスワード

Firebase を使わないので、クライアント側の SHA-256 照合のみ。初期値は `pokachi`。
変えるときは `js/core.js` の `ADMIN_HASH` を差し替える。

```bash
node -e "console.log(require('crypto').createHash('sha256').update('新しいパスワード').digest('hex'))"
```

## ローカル確認

`?demo=1` を付けると Firebase を使わず localStorage 上で動く。本番データを触らずに試せる。

```
http://localhost:5182/index.html?demo=1
```

## 公開

GitHub Pages（main / root）。

## メモ

- 編集は `.js` を直接触る。ビルドは無し
- 改行は CRLF、文字コードは UTF-8
- 元になった集計表（スプレッドシート）は別ゲームのものなので、データは引き継がない
