<template>
  <UBadge
    :color="(mappedColor as any)"
    :variant="mappedVariant"
    :size="size"
    :class="customClass"
  >
    <UIcon
      v-if="leadingIcon"
      :name="leadingIcon"
      :class="iconClass"
    />
    <slot>{{ label }}</slot>
    <UIcon
      v-if="trailingIcon"
      :name="trailingIcon"
      :class="iconClass"
    />
  </UBadge>
</template>

<script setup lang="ts">
/**
 * EN AIstudio 共通バッジ.
 *
 * UBadge を薄くラップし、プロジェクト固有の意味的 variant (tag / ai / assistant)
 * を提供する. EnButton と同じ wrapper パターン.
 *
 * - 透過 variant (`solid` / `outline` / `soft` / `subtle`) → UButton 同様 color 指定が効く
 * - 意味的 variant (`tag` / `ai` / `assistant`) → 色/variant を内部固定 (規約強制)
 *
 * 利用例:
 *   <!-- メタ情報・分類タグ (デフォルト neutral outline) -->
 *   <EnBadge variant="tag">タグA</EnBadge>
 *
 *   <!-- 状態表示 (色 = 意味) -->
 *   <EnBadge color="warning" variant="solid">編集中</EnBadge>
 *   <EnBadge color="success">充足</EnBadge>
 *
 *   <!-- AI 関連 (color/variant 無視で primary + soft 強制) -->
 *   <EnBadge variant="ai">AI 提案中</EnBadge>
 *
 *   <!-- 操作アシスタント関連 (info + soft 強制) -->
 *   <EnBadge variant="assistant">ヒント</EnBadge>
 */

type BadgeVariant =
  | "soft" // default. UBadge color 透過
  | "outline" // UBadge color 透過
  | "subtle" // UBadge color 透過
  | "solid" // UBadge color 透過
  | "tag" // = neutral outline 強制. メタ情報・分類用
  | "ai" // = primary soft 強制 (color prop 無視). AI 部下の出力
  | "assistant"; // = info soft 強制 (color prop 無視). 操作アシスタント

type BadgeColor =
  | "primary" // teal
  | "info" // blue
  | "success" // green
  | "warning" // yellow
  | "error" // red
  | "neutral" // slate
  | "purple"
  | "violet";

type BadgeSize = "xs" | "sm" | "md" | "xl";

interface Props {
  variant?: BadgeVariant;
  color?: BadgeColor;
  size?: BadgeSize;
  /** slot の代替. inline 利用で短文時の簡略指定 */
  label?: string;
  leadingIcon?: string;
  trailingIcon?: string;
  /** layout 系の補助クラス (font-bold, mr-1 等). 色は variant で固定 */
  customClass?: string;
}

const props = withDefaults(defineProps<Props>(), {
  variant: "soft",
  color: "neutral",
  size: "sm",
  label: "",
  leadingIcon: "",
  trailingIcon: "",
  customClass: "",
});

/* === color マッピング =============================================== */
const mappedColor = computed<BadgeColor>(() => {
  switch (props.variant) {
    case "ai":
      return "primary";
    case "assistant":
      return "info";
    case "tag":
      return "neutral";
    default:
      return props.color;
  }
});

/* === variant マッピング ============================================= */
const mappedVariant = computed<"solid" | "outline" | "soft" | "subtle">(() => {
  switch (props.variant) {
    case "ai":
    case "assistant":
      return "soft";
    case "tag":
      return "outline";
    case "solid":
    case "outline":
    case "soft":
    case "subtle":
      return props.variant;
    default:
      return "soft";
  }
});

/* === slot 内アイコンサイズ =========================================== */
const iconClass = computed<string>(() => {
  switch (props.size) {
    case "xs":
      return "w-3 h-3";
    case "sm":
      return "w-3.5 h-3.5";
    case "md":
      return "w-4 h-4";
    case "xl":
      return "w-5 h-5";
    default:
      return "w-3.5 h-3.5";
  }
});
</script>
