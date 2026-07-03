# StoryVault エントリー記事ドラフト

## タイトル

StoryVault: AI コーディング時代のユーザーストーリー SSOT

## 概要

StoryVault は、AI コーディングで高速化した開発現場に「ユーザーストーリーを中心にした統制」を取り戻すための DevOps x AI Agent アプリケーションです。

生成 AI によって実装速度は上がりました。一方で、仕様、Issue、PR、コード、運用動画、開発者の暗黙知が分散しやすくなり、「なぜこの実装なのか」「この機能はどの受け入れ条件を満たしているのか」「AI エディタへ渡すべき正しい文脈は何か」が見えにくくなっています。

StoryVault はアプリケーション単位で知識、GitHub、操作動画、AI Agent の分析結果を束ね、ユーザーストーリーを SSOT として生成・更新します。開発者は StoryVault 上で、要求、根拠、コード参照、ドリフト、AI エディタ向けコンテキストを一気通貫で確認できます。

## 解決したい課題

AI コーディングの課題は、コード生成そのものよりも「文脈の維持」にあります。

- 仕様書、チケット、PR、コード、操作動画が別々の場所にあり、判断根拠が追いにくい
- AI エディタへ渡すコンテキストが属人的で、毎回品質が揺れる
- 実装が進むほど、当初のユーザーストーリーと現実のコードがずれる
- レビュー時に「何を満たせば完了か」がコード差分だけでは判断できない

StoryVault はこれらを、ユーザーストーリー単位の evidence package にまとめます。

## 主な機能

1. アプリケーション別の StoryVault
   - 複数アプリケーションを切り替え、リポジトリ、知識ソース、操作動画、生成済みストーリーをアプリケーション境界で管理します。

2. Story generation agent
   - Google Cloud 上の ADK agent が、仕様・ドキュメント・GitHub 情報・操作動画由来の文脈を読み、ユーザーストーリー、受け入れ条件、根拠、コード参照を生成します。

3. Drift review
   - To-Be と As-Is のずれを見える化し、レビュー前に「仕様に対して実装が足りない箇所」を検出します。

4. MCP endpoint
   - AI エディタや coding agent が StoryVault のコンテキストを取得できる MCP endpoint を提供します。人間が画面で確認する情報と、AI が読む情報を同じ SSOT から供給します。

5. Demo-ready command UI
   - StoryVault のトップ画面に、アプリケーション切り替え、進捗指標、準備チェックリスト、Story/Video/Source/MCP のタブ導線をまとめ、審査時に流れを説明しやすい構成にしました。

## Google Cloud / AI Agent 活用

- Firebase Hosting: Nuxt frontend を配信
- Firestore: アプリケーション、ユーザーストーリー、根拠、Agent 実行状態を保存
- Cloud Functions 2nd gen: GitHub/Slack/Google Workspace 接続、Firestore trigger、ADK invoke request の glue layer
- Cloud Run: unified ADK agent、StoryVault 専用分析 agent、MCP server を運用
- Cloud Build: 各 agent / MCP server の build と deploy
- Gemini / Google ADK: Story generation、zapping analysis、capability structuring の agent orchestration
- GCS: ADK artifacts と MCP report artifact の保存

## デモシナリオ

1. StoryVault で対象アプリケーションを選択する
2. GitHub repository と知識ソースを接続する
3. 操作動画または仕様ドキュメントを読み込む
4. StoryVault agent がユーザーストーリーと根拠を生成する
5. Story detail で、受け入れ条件、根拠、コード参照、ドリフトを確認する
6. MCP endpoint から coding agent 向けコンテキストを取得する

## 審査で見てほしいポイント

StoryVault の価値は「AI がストーリーを書く」ことだけではありません。開発者、レビュアー、AI エディタが同じユーザーストーリー SSOT を参照できることにあります。

AI 開発が速くなるほど、チームにはより強い文脈管理が必要になります。StoryVault は、AI Agent を単発の自動化ではなく、DevOps の継続的な文脈同期レイヤーとして使う提案です。

## 現在のデプロイ

- Frontend: https://storyvault-dev.web.app/admin/storyvault/
- MCP endpoint: https://storyvault-mcp-mdgjayj74q-an.a.run.app/mcp
- Environment: storyvault-dev

## 補足

Firebase Storage は新規 Firebase project 側で初期化が必要なため、Console の Storage 画面で Get Started を押した後に rules deploy を行います。Hosting、Firestore、Functions、Cloud Run agent、MCP server は StoryVault dev にデプロイ済みです。
