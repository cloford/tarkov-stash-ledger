# タルコフ タスク・脱出ナビ

Escape from Tarkovのタスク情報、マップ、脱出地点、鍵の用途を簡単に確認する日本語デスクトップアプリです。

マップは拡大・縮小とドラッグ移動に対応し、選択したマップをオフライン用に保存できます。

## 主な機能

- タスク詳細、前提条件、報酬、マップ、脱出地点の確認
- サブタスクの推奨順・レベル順・名前順、マップ／トレーダー別表示
- ANY MAPを含むマップ絞り込み
- マップの拡大・縮小、ドラッグ移動
- 脱出地点の自動フォーカスと照準リング表示
- 日本語化した他マップへのトランジット表示
- マップ画像と脱出地点データのオフライン保存
- 英語Wikiに掲載されている2D・3D・屋内などの別マップ画像への切り替え
- 鍵名・タスク名・マップ名を横断できる鍵Wiki（空白を省いた検索にも対応）
- 鍵を拾った時の保管判断と、マップ上の正確な使用位置の確認
- 英語Wikiの「Lock Location」と「Behind the Lock」に基づく、使用場所と開錠先の入手物表示
- 鍵Wikiから関連マップ・関連タスクへ直接移動
- Windows向けElectronデスクトップ版

## 必要環境

- Node.js 22.13.0以上
- npm
- Windows版の配布物を作成する場合はWindows環境

## 開発版の起動

```bash
npm install
npm run dev
```

Windowsでは起動用バッチファイルからも開発版を起動できます。

## デスクトップ版のビルド

```bash
npm run desktop:build
```

生成物は `package.json` の `build.directories.output` で指定したフォルダに出力されます。

- `win-unpacked/`: 確認・配布用の展開済みポータブル版

現在はインストーラーやZIPを生成せず、`win-unpacked/` のみを配布対象とします。

## データと保存先

- タスクの初期データは `app/data/` に収録しています。
- タスクやマップで使用する静的画像は `public/` に収録しています。
- 一部のタスク、Wiki画像、翻訳、別マップ画像、鍵情報はインターネット接続時に外部サービスから取得します。
- 鍵カタログの同梱データは `npm run keys:update` で更新できます。

## ディレクトリ構成

```text
app/       React画面、スタイル、タスクデータ
desktop/   Electron向けViteエントリーポイント
electron/  ElectronメインプロセスとIPCブリッジ
public/    タスク、マップ、トレーダー用画像
worker/    Vinext／Cloudflare Workerエントリーポイント
db/        将来用のDrizzle設定
tests/     テストコード
```

## 注意事項

- 本リポジトリはBattlestate Gamesの公式プロジェクトではありません。
- 脱出地点対応の高解像度マップは [RE3MR MAPS](https://reemr.se/) の作品をオンライン表示します。各マップは作者が示す Creative Commons Attribution-NonCommercial-ShareAlike 4.0 の条件に従います。
- 別マップ画像と補足画像は [Escape from Tarkov Wiki](https://escapefromtarkov.fandom.com/wiki/Escape_from_Tarkov_Wiki) の掲載情報を参照します。各画像の権利・利用条件は掲載元に従います。
- ゲームアップデートにより、必要数やタスク条件が実際のゲームと異なる場合があります。
- 現在のテストには初期テンプレート由来の古い内容が残っており、今後整理予定です。
