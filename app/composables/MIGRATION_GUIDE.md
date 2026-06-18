# アイコンComposable移行ガイド

## 概要

このプロジェクトは、ガイドライン `.kiro/steering/guide_02_UI_COMPONENT_nuxt_icon.md` に準拠したアイコン実装に移行しました。

**主な変更点**:
- ✅ VSCode Icons、Material Symbols中心の実装
- ✅ カテゴリ別Composable管理（型安全、保守性向上）
- ✅ 直接文字列リテラル使用を禁止
- ⚠️ `utils/icon.ts` は非推奨（後方互換性のため残存）

---

## 利用可能なComposable

### 1. `useFileIcons()` - ファイル・データタイプ

**用途**: ファイル拡張子、技術スタック、データタイプの視覚表現

```vue
<script setup>
const fileIcons = useFileIcons()
</script>

<template>
  <Icon :name="fileIcons.pdf" size="24" />
  <Icon :name="fileIcons.excel" size="24" />
  <Icon :name="fileIcons.json" size="24" />
</template>
```

**利用可能なアイコン**: `pdf`, `excel`, `word`, `json`, `csv`, `video`, `audio`, `image`, `folder`, `file` など

---

### 2. `useActionIcons()` - 操作アクション

**用途**: ボタン、UI操作、CRUD操作

```vue
<script setup>
const actionIcons = useActionIcons()
</script>

<template>
  <UButton :icon="actionIcons.add" label="追加" />
  <UButton :icon="actionIcons.save" label="保存" />
  <UButton :icon="actionIcons.delete" color="error" />
</template>
```

**利用可能なアイコン**: `add`, `edit`, `delete`, `save`, `search`, `refresh`, `upload`, `download`, `logout` など

---

### 3. `useStatusIcons()` - ステータス表示

**用途**: 処理状態、進行状況の表現

```vue
<script setup>
const statusIcons = useStatusIcons()
</script>

<template>
  <!-- 大きく表示する場合は色付きVSCode Icons -->
  <Icon :name="statusIcons.success" size="48" />

  <!-- バッジ・インラインの場合はシンプルなMaterial -->
  <UBadge :icon="statusIcons.successSimple" color="success">完了</UBadge>
</template>
```

**利用可能なアイコン**: `success`, `error`, `warning`, `completed`, `pending`, `inProgress` など

---

### 4. `useLoadingIcons()` - ローディングアニメーション

**用途**: 非同期処理、ローディング表示

```vue
<script setup>
const loadingIcons = useLoadingIcons()
const actionIcons = useActionIcons()
const isLoading = ref(false)
</script>

<template>
  <UButton
    :icon="isLoading ? loadingIcons.buttonSpinner : actionIcons.save"
    :loading="isLoading"
  >
    保存
  </UButton>
</template>
```

**利用可能なアイコン**: `spinner`, `dots`, `pulse`, `buttonSpinner`, `fullScreen` など

---

### 5. `useBusinessIcons()` - ビジネス概念

**用途**: ドメイン特有の概念（業務分類、分析など）

```vue
<script setup>
const businessIcons = useBusinessIcons()
</script>

<template>
  <Icon :name="businessIcons.inventory" size="24" />
  <Icon :name="businessIcons.warehouse" size="24" />
  <Icon :name="businessIcons.truck" size="24" />
</template>
```

**利用可能なアイコン**: `inventory`, `stock`, `warehouse`, `truck`, `shipping`, `analytics`, `dashboard`, `user`, `group` など

---

### 6. `useBrandIcons()` - ブランド・サービス

**用途**: 外部サービスロゴ

```vue
<script setup>
const brandIcons = useBrandIcons()
</script>

<template>
  <Icon :name="brandIcons.google" size="24" />
  <Icon :name="brandIcons.slack" size="24" />
</template>
```

---

## 移行手順

### STEP 1: インポート削除

**❌ 削除**:
```ts
import iconSet from "@utils/icon";
```

### STEP 2: Composable呼び出し

**✅ 追加**:
```vue
<script setup lang="ts">
//#region composables
const fileIcons = useFileIcons()
const actionIcons = useActionIcons()
const businessIcons = useBusinessIcons()
// 必要なComposableのみインポート
//#endregion composables
</script>
```

### STEP 3: アイコン使用を置き換え

**❌ Before（アンチパターン）**:
```vue
<template>
  <Icon name="i-heroicons-trash" />
  <Icon name="i-lucide-house" />
  <UButton icon="i-flat-color-icons:deployment" />
</template>
```

**✅ After（正しいパターン）**:
```vue
<script setup>
const actionIcons = useActionIcons()
const businessIcons = useBusinessIcons()
const brandIcons = useBrandIcons()
</script>

<template>
  <Icon :name="actionIcons.delete" />
  <Icon :name="businessIcons.warehouse" />
  <UButton :name="brandIcons.deployment" />
</template>
```

---

## よくある置き換えパターン

| 旧パターン | 新パターン | Composable |
|----------|----------|-----------|
| `"i-heroicons-trash"` | `actionIcons.delete` | useActionIcons |
| `"i-lucide-house"` | `businessIcons.warehouse` | useBusinessIcons |
| `"i-lucide-truck"` | `businessIcons.truck` | useBusinessIcons |
| `"i-flat-color-icons:deployment"` | `brandIcons.deployment` | useBrandIcons |
| `"i-heroicons-eye"` | `actionIcons.visibility` | useActionIcons |
| `"i-material-symbols-add-circle-outline"` | `actionIcons.add` | useActionIcons |
| `"i-vscode-icons:file-type-pdf2"` | `fileIcons.pdf` | useFileIcons |

---

## 移行済みファイル

以下のファイルは既に移行完了：

1. ✅ `app/layouts/admin.vue`
2. ✅ `app/components/ui/layout/ESidebar.vue`
3. ✅ `app/components/ui/feedback/EBadge.vue`
4. ✅ `app/components/EnAlert.vue`（旧 `EAlert` は削除済み）
5. ✅ `app/components/inventory/InventoryPlanCreateModal.vue`
6. ✅ `app/utils/icon.ts` (非推奨マークと新アイコンセットへの更新)

---

## 未移行ファイル（優先度順）

以下のファイルは同じパターンを多用しており、優先的に移行すべきです：

### 高優先度（`i-lucide-*` パターン多用）

1. ~~Sheet→App 直接取込 Modal 群~~ → 削除済み。取込は `admin/production-line/[id]/ai-setup`（AIマスタ登録）に統一。
2. `app/components/shipping/ShippingEventCreateModel.vue`（未使用の場合は削除候補）
3. `app/components/simulation/SimulationOutput.vue`（アイコン移行のみ）

### 中優先度（`i-heroicons-*` パターン使用）

7. `app/pages/admin/production-line/detail/[workspaceId].vue`
8. `app/pages/admin/settings.vue`

### 低優先度（アイコン使用頻度低）

9. その他の34ファイル

---

## トラブルシューティング

### Q: Composableが認識されない

**A**: 以下のコマンドを実行してNuxtの型定義を再生成してください：

```bash
npx nuxi prepare
```

### Q: 既存の`iconSet`を使っているコードはどうすればいい？

**A**: `utils/icon.ts`は後方互換性のため残されています。段階的に新しいComposableに移行してください。

### Q: 新しいアイコンを追加したい

**A**: 適切なComposableファイルに追加してください：

```ts
// app/composables/useActionIcons.ts
export const useActionIcons = () => {
  return {
    // 既存のアイコン...
    newIcon: 'material-symbols:new-icon-name', // 追加
  } as const
}
```

---

## 参考リンク

- [ガイドライン本文](.kiro/steering/guide_02_UI_COMPONENT_nuxt_icon.md)
- [VSCode Icons](https://icon-sets.iconify.design/vscode-icons/)
- [Material Symbols](https://github.com/material-icons/material-icons)
- [SVG Spinners](https://www.npmjs.com/package/@iconify-json/svg-spinners)

---

**Last Updated**: 2025-10-19
**Status**: 移行進行中（5/39ファイル完了）
