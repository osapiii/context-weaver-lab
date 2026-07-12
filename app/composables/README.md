# Icons Composables

ガイドライン準拠のアイコン管理システム（`.kiro/steering/guide_02_UI_COMPONENT_nuxt_icon.md`）

## クイックスタート

```vue
<script setup lang="ts">
// 必要なComposableだけインポート
const actionIcons = useActionIcons()
const fileIcons = useFileIcons()
</script>

<template>
  <!-- ✅ CORRECT: Composable経由 -->
  <UButton :icon="actionIcons.add" label="追加" />
  <Icon :name="fileIcons.pdf" size="24" />

  <!-- ❌ WRONG: 直接文字列リテラル -->
  <UButton icon="i-heroicons-plus" label="追加" />
</template>
```

## 利用可能なComposable

| Composable | 用途 | 例 |
|-----------|------|---|
| `useFileIcons()` | ファイル・データタイプ | `pdf`, `excel`, `json` |
| `useActionIcons()` | 操作・ボタン | `add`, `save`, `delete` |
| `useStatusIcons()` | ステータス表示 | `success`, `error`, `pending` |
| `useLoadingIcons()` | ローディング | `spinner`, `dots` |
| `useBusinessIcons()` | ビジネス概念 | `inventory`, `warehouse`, `truck` |
| `useBrandIcons()` | ブランドロゴ | `google`, `slack` |

## 詳細

- 📖 [移行ガイド](./MIGRATION_GUIDE.md)
- 📖 [完全ガイドライン](../../../.kiro/steering/guide_02_UI_COMPONENT_nuxt_icon.md)
