<template>
  <UCard :ui="(mappedUi as any)" :class="rootClass">
    <template v-if="$slots.header" #header>
      <slot name="header" />
    </template>
    <slot />
    <template v-if="$slots.footer" #footer>
      <slot name="footer" />
    </template>
  </UCard>
</template>

<script setup lang="ts">
/**
 * EN AIstudio 共通カード.
 *
 * UCard を薄くラップし、繰り返しがちな `:ui="{ body: 'p-X', header: 'p-X pb-Y' }"`
 * や `class="bg-white border ..."` を `variant` / `padding` プリセットに集約する.
 * EnModal / EnButton / EnBadge と同じ wrapper パターン.
 *
 * 利用例:
 *   <!-- KPI / 統計カード (BusinessDashboard の 4 連続パターンを置換) -->
 *   <EnCard variant="kpi" padding="snug">
 *     <div class="text-sm font-semibold mb-1">月間売上</div>
 *     <div class="text-2xl font-bold">¥123,456</div>
 *   </EnCard>
 *
 *   <!-- header / body / footer 構造 -->
 *   <EnCard padding="snug">
 *     <template #header><h3 class="text-lg font-bold">タイトル</h3></template>
 *     本文
 *     <template #footer>...</template>
 *   </EnCard>
 *
 *   <!-- 選択可能カード -->
 *   <EnCard variant="selectable" :selected="value === current" @click="select(value)">
 *     {{ value.label }}
 *   </EnCard>
 *
 *   <!-- Game feel ヘッダー -->
 *   <EnCard variant="game">
 *     <template #header>{{ name }}</template>
 *     {{ body }}
 *   </EnCard>
 */

type CardVariant =
  | "default" // 透過 (UCard 既定)
  | "kpi" // bg-white border slate-300 shadow-sm (BusinessDashboard 反復)
  | "flat" // shadow なし border のみ
  | "game" // gradient header (slate-800 + purple accent)
  | "selectable"; // cursor-pointer + hover. selected で primary border

type CardPadding =
  | "minimal" // body: !p-0 px-2 py-0.5 (UCard 既定 p-4 を打ち消す)
  | "scorecard" // body: !p-0 px-3 py-2 (コンパクト KPI スコアカード)
  | "compact" // body: p-3
  | "snug" // body: p-4, header: p-4 pb-3
  | "default" // UCard 既定 (透過)
  | "spacious"; // body: p-6, header: p-6 pb-4

/** マスタ画面カード header 帯の背景 (UCard header 要素に直接付与) */
export type EnCardHeaderTone = "content" | "actions" | "history";

interface Props {
  variant?: CardVariant;
  padding?: CardPadding;
  /** マスタ左/操作/履歴など、header 背景色の役割別トーン */
  headerTone?: EnCardHeaderTone;
  /** variant="selectable" のとき active 状態を表現 */
  selected?: boolean;
  /** layout 系 (mb-6, w-full 等). 色/枠は variant に固定 */
  customClass?: string;
  /** 親 flex 内で body を残り高さいっぱいに伸ばす (マスタ閲覧グリッド用) */
  fillBody?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  variant: "default",
  padding: "default",
  headerTone: undefined,
  selected: false,
  customClass: "",
  fillBody: false,
});

const headerPaddingClass = computed(() => {
  switch (props.padding) {
    case "minimal":
      return "px-2.5 py-1.5 pb-1";
    case "scorecard":
      return "px-3 py-2 pb-1.5";
    case "compact":
      return "p-3 pb-2";
    case "snug":
      return "p-4 pb-3";
    case "spacious":
      return "p-6 pb-4";
    case "default":
    default:
      return "";
  }
});

const headerToneClass = computed(() => {
  switch (props.headerTone) {
    case "content":
      return "bg-slate-50 border-b border-slate-200";
    case "actions":
      return "bg-primary-50 border-b border-primary-100";
    case "history":
      return "bg-primary-50 border-b border-primary-100";
    default:
      return "";
  }
});

/* === padding / headerTone を UCard の :ui に変換 ====================== */
const paddingUi = computed((): Record<string, string> => {
  const bodyPadding =
    props.padding === "minimal"
      ? "!p-0 px-2 py-0.5"
      : props.padding === "scorecard"
      ? "!p-0 px-3 py-2"
      : props.padding === "compact"
      ? "p-3"
      : props.padding === "snug"
        ? "p-4"
        : props.padding === "spacious"
          ? "p-6"
          : "";
  const bodyFill = props.fillBody
    ? "flex min-h-0 flex-1 flex-col"
    : "";
  const body = [bodyPadding, bodyFill].filter(Boolean).join(" ") || undefined;

  const header = [headerPaddingClass.value, headerToneClass.value]
    .filter(Boolean)
    .join(" ");

  const root = props.fillBody
    ? "flex min-h-0 flex-1 flex-col h-full"
    : undefined;

  return {
    ...(body ? { body } : {}),
    ...(header ? { header } : {}),
    ...(root ? { root } : {}),
  };
});

/* === variant ごとの :ui 加味 (header の見た目を強制したい時) ========== */
const variantUi = computed((): Record<string, string> => {
  if (props.variant === "game") {
    return {
      header:
        "bg-gradient-to-r from-slate-800 via-slate-700 to-slate-800 text-white border-b-4 border-purple-400",
    };
  }
  return {};
});

/** UCard に渡す最終 :ui (padding + variant をマージ) */
const mappedUi = computed<Record<string, string>>(() => ({
  ...paddingUi.value,
  ...variantUi.value,
}));

/* === variant 別の root class ======================================== */
const variantClass = computed<string>(() => {
  switch (props.variant) {
    case "kpi":
      return "bg-white border border-slate-300 shadow-sm";
    case "flat":
      return "shadow-none";
    case "selectable":
      return props.selected
        ? "cursor-pointer ring-2 ring-primary-500 border-primary-400 transition-colors"
        : "cursor-pointer hover:border-primary-400 transition-colors";
    case "default":
    case "game":
    default:
      return "";
  }
});

const rootClass = computed<string>(() =>
  [variantClass.value, props.customClass].filter(Boolean).join(" ")
);
</script>
