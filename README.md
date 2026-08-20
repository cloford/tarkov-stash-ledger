# タルコフ タスク・脱出ナビ

Escape from Tarkovのタスク情報、マップ、脱出地点を簡単に確認する日本語デスクトップアプリです。

マップは拡大・縮小とドラッグ移動に対応し、選択したマップをオフライン用に保存できます。

## 主な機能

- タスク詳細、前提条件、報酬、マップ、脱出地点の確認
- サブタスクの推奨順・レベル順・名前順、マップ／トレーダー別表示
- ANY MAPを含むマップ絞り込み
- マップの拡大・縮小、ドラッグ移動
- 脱出地点の自動フォーカスと照準リング表示
- 日本語化した他マップへのトランジット表示
- マップ画像と脱出地点データのオフライン保存
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

生成物は `outputs/Tarkov-Task-Extract-Navi-test-v4/` に出力されます。

- `win-unpacked/`: 展開済みのポータブル版
- `Tarkov-Task-Extract-Navi-test-v4.exe`: Windowsセットアップ版

## データと保存先

- タスクの初期データは `app/data/` に収録しています。
- タスクやマップで使用する静的画像は `public/` に収録しています。
- 一部のタスク、Wiki画像、翻訳、マップ情報はインターネット接続時に外部サービスから取得します。

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
- ゲームアップデートにより、必要数やタスク条件が実際のゲームと異なる場合があります。
- 現在のテストには初期テンプレート由来の古い内容が残っており、今後整理予定です。
