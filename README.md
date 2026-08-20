# Tarkov Stash Ledger

Escape from Tarkovのクエスト、ハイドアウト、必要アイテム、マップ情報をまとめて確認する日本語向けデスクトップアプリです。

現在の版は機能整理前の保存版です。今後、不要な機能を削除しながら構成を簡素化します。

## 主な機能

- 未完了クエストとハイドアウト設備から必要アイテム数を計算
- 所持数、不足数、余剰数をローカル保存
- クエストとハイドアウトの進捗管理
- タスク詳細、前提条件、報酬、マップ、脱出地点の確認
- スクリーンショットからハイドアウト素材を読み取る機能
- 売却前に残すべきアイテムを確認する機能
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

Windowsでは `STASH-LEDGERを起動.bat` からも開発版を起動できます。

## デスクトップ版のビルド

```bash
npm run desktop:build
```

生成物は `outputs/windows-app/` に出力されます。

- `win-unpacked/`: 展開済みのポータブル版
- `Tarkov Stash Ledger Setup 0.1.0.exe`: Windowsセットアップ版

## データと保存先

- タスク、アイテム、ハイドアウトの初期データは `app/data/` に収録しています。
- アイテム画像などの静的ファイルは `public/` に収録しています。
- アプリ上の進捗はElectronまたはブラウザのローカルストレージに保存されます。
- 一部のタスク、Wiki画像、翻訳、マップ情報はインターネット接続時に外部サービスから取得します。

## ディレクトリ構成

```text
app/       React画面、スタイル、初期データ
desktop/   Electron向けViteエントリーポイント
electron/  ElectronメインプロセスとIPCブリッジ
public/    アイテム、設備、マップ、トレーダー画像
scripts/   データ更新、画像取得、配布物生成用スクリプト
worker/    Vinext／Cloudflare Workerエントリーポイント
db/        将来用のDrizzle設定
tests/     テストコード
```

## 注意事項

- 本リポジトリはBattlestate Gamesの公式プロジェクトではありません。
- ゲームアップデートにより、必要数やタスク条件が実際のゲームと異なる場合があります。
- 現在のテストには初期テンプレート由来の古い内容が残っており、今後整理予定です。
