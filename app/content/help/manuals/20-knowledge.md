---
title: "AI に知識を与える"
description: "ナレッジ素材、Google Drive 連携、Web 取り込みの使い分け。"
category: manual
tags: [ナレッジ, Google Drive, Web取り込み, ファイル]
routes: [admin-data-source, admin-storage]
order: 30
updatedAt: "2026-06-17"
---

# AI に知識を与える

AI の回答に社内資料や顧客情報を反映したい場合は、[ナレッジ素材](route:admin-data-source) から情報源を登録します。

## 登録方法

| 方法 | 向いている用途 | 確認先 |
| --- | --- | --- |
| ファイル登録 | PDF、Word、Excel、画像などを AI に読ませる | ナレッジ素材 |
| Google Drive 連携 | Drive フォルダを継続的に取り込む | Google Workspace 連携設定 |
| Web 取り込み | Web ページやサイト群をナレッジ化する | Web クロール結果 |
| ストレージ確認 | アップロード済みファイルを確認する | [ストレージ](route:admin-storage) |

## 反映されないとき

- 取り込み処理が完了しているか確認します。
- ファイル名やフォルダ名だけでなく、本文に目的の情報が含まれているか確認します。
- Google Drive 連携は接続状態と権限を見直します。
