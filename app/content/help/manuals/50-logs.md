---
title: "実行状況とログを確認する"
description: "仕事ログ、リクエストログ、ストレージを使った確認方法。"
category: manual
tags: [ログ, 実行状況, RequestDoc, ストレージ]
routes: [admin-workflow-executions, admin-request-logs, admin-storage]
order: 60
updatedAt: "2026-06-17"
---

# 実行状況とログを確認する

AI の処理が進んでいるか、失敗していないかはログ画面で確認できます。

## 確認先

| 画面 | 見るもの | 使う場面 |
| --- | --- | --- |
| [仕事ログ](route:admin-workflow-executions) | AI ジョブの履歴と状態 | 依頼した仕事の進捗確認 |
| [リクエストログ](route:admin-request-logs) | RequestDoc の実行履歴 | エラー調査、管理者確認 |
| [ストレージ](route:admin-storage) | 生成物やアップロードファイル | ファイルの存在確認 |

## まず見るポイント

1. ステータスが完了、処理中、エラーのどれかを確認します。
2. エラーの場合はメッセージと対象ジョブを控えます。
3. 必要に応じて操作ガイドにエラーメッセージを貼って相談します。
