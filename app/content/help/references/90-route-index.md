---
title: "画面リンク一覧"
description: "操作ガイド AI が案内に使う主要 route と launcher の一覧。"
category: reference
tags: [route, launcher, ナビゲーション]
routes: [admin, admin-ai-studio, admin-data-source, admin-workflow-executions]
order: 900
updatedAt: "2026-06-17"
---

# 画面リンク一覧

操作ガイド AI は、回答内で次のリンク文法を使います。

| 種別 | 書式 | 例 |
| --- | --- | --- |
| ページ遷移 | `[ラベル](route:routeName)` | [AI に依頼](route:admin-ai-studio) |
| ランチャー | `[ラベル](launcher:launcherKey)` | [経営相談を開く](launcher:business-consultation) |

## 主要 route

| route | 画面 |
| --- | --- |
| `admin` | ホーム |
| `admin-work` | 仕事をこなす |
| `admin-ai-studio` | AI に依頼 |
| `admin-data-source` | ナレッジ素材 |
| `admin-business-partners-list` | 取引先 |
| `admin-workflow-executions` | 仕事ログ |
| `admin-request-logs` | リクエストログ |
| `admin-storage` | ストレージ |
| `admin-preferences` | 設定 |
| `admin-api-keys` | API キー |
| `admin-settings` | 組織設定 |

## 主要 launcher

| launcher | 動作 |
| --- | --- |
| `business-consultation` | 経営相談を開始 |
| `writing` | 書類記入モードを開始 |
| `sheet` | シート編集モードを開始 |
| `image` | 画像生成モードを開始 |
