<template>
  <!-- variant が hero / nav / ai → Button3D を内部レンダー (Game feel 維持) -->
  <Button3D
    v-if="useButton3D"
    :color-type="mappedColorType"
    :size="size"
    :variant="variant === 'nav' ? 'nav' : 'cta'"
    :pressed="active"
    :disabled="disabled"
    :block="block"
    :type="type"
    :custom-class="customClass"
    @click="onClick"
  >
    <UIcon
      v-if="loading"
      name="i-svg-spinners-90-ring-with-bg"
      :class="iconClass"
    />
    <UIcon
      v-else-if="leadingIcon"
      :name="leadingIcon"
      :class="iconClass"
    />
    <slot />
    <UIcon
      v-if="trailingIcon && !loading"
      :name="trailingIcon"
      :class="iconClass"
    />
  </Button3D>

  <!-- variant が solid / outline / soft / ghost / assistant → UButton にディスパッチ -->
  <UButton
    v-else
    :color="(mappedUColor as any)"
    :variant="(mappedUVariant as any)"
    :size="size"
    :disabled="disabled"
    :loading="loading"
    :icon="leadingIcon"
    :trailing-icon="trailingIcon"
    :block="block"
    :to="to"
    :type="type"
    :class="customClass"
    @click="onClick"
  >
    <slot />
  </UButton>
</template>

<script setup lang="ts">
/**
 * EN AIstudio 共通ボタン.
 *
 * Button3D (Game feel) と UButton (Nuxt UI) を `variant` で内部ディスパッチし、
 * 「どっち使う?」の判断を API に集約する. EnModal と同じ wrapper パターン.
 *
 * - `variant="hero"` / `"nav"` / `"ai"` → 内部で Button3D を render
 * - それ以外 (`solid` / `outline` / `soft` / `ghost` / `assistant`) → UButton を render
 *
 * 色名は **UButton の `color` 名に統一** (`primary` = 組織テーマ primary, `info` = blue, ...).
 * `variant="ai"` は組織テーマ primary に追従し、`variant="assistant"` は淡い情報色で表示する.
 *
 * 利用例:
 *   <EnButton variant="hero" color="success" size="lg" @click="confirm">
 *     確定して反映
 *   </EnButton>
 *
 *   <EnButton variant="nav" :active="current === mode" :leading-icon="mode.icon">
 *     {{ mode.label }}
 *   </EnButton>
 *
 *   <EnButton variant="ai" leading-icon="i-heroicons-sparkles">
 *     AI に相談
 *   </EnButton>
 */
import Button3D from "@components/Button3D.vue";
import type { RouteLocationRaw } from "vue-router";

type ButtonVariant =
  | "hero" // = Button3D cta. ページ主役 CTA / モーダル確定
  | "solid" // = UButton solid (デフォルト)
  | "outline" // = UButton outline
  | "soft" // = UButton soft
  | "ghost" // = UButton ghost (キャンセル / 戻る等)
  | "nav" // = Button3D neutral-soft (内部). Ribbon / Master タブ
  | "ai" // = Button3D theme primary (color prop 無視)
  | "assistant"; // = UButton color=sky variant=soft (color prop 無視)

type ButtonColor =
  | "primary" // 組織テーマ primary (UButton / Button3D theme)
  | "info" // blue
  | "success" // green
  | "warning" // yellow (UButton と統一. 旧 Button3D の violet は color="violet" を使うこと)
  | "error" // red
  | "neutral" // slate
  | "purple" // purple
  | "violet"; // violet (Button3D の伝統的「データ書き換え系」色)

type ButtonSize = "xs" | "sm" | "md" | "lg" | "xl";

interface Props {
  variant?: ButtonVariant;
  color?: ButtonColor;
  size?: ButtonSize;
  /** variant="nav" の選択中表現. 他 variant では押下固定 (Button3D の pressed と同義) */
  active?: boolean;
  disabled?: boolean;
  loading?: boolean;
  /** loading 中に中央へ表示するメッセージ */
  loadingMessage?: string;
  /** 短い局所処理など、中央 loading を出さない場合だけ false */
  globalLoading?: boolean;
  leadingIcon?: string;
  trailingIcon?: string;
  block?: boolean;
  /** UButton の `to` (NuxtLink 経由). UButton variant でのみ有効 */
  to?: RouteLocationRaw;
  type?: "button" | "submit" | "reset";
  /** layout 系の補助クラス (whitespace-nowrap 等). padding/rounded は size プリセットに固定 */
  customClass?: string;
}

const props = withDefaults(defineProps<Props>(), {
  variant: "solid",
  color: "primary",
  size: "md",
  active: false,
  disabled: false,
  loading: false,
  loadingMessage: "処理中…",
  globalLoading: true,
  leadingIcon: "",
  trailingIcon: "",
  block: false,
  to: undefined,
  type: "button",
  customClass: "",
});

const emit = defineEmits<{
  click: [event: MouseEvent];
}>();

const globalLoadingStore = useGlobalLoadingStore();
let globalLoadingToken: string | null = null;
let stopLoadingWatch: (() => void) | null = null;

const stopGlobalLoading = (): void => {
  if (!globalLoadingToken) return;
  globalLoadingStore.endLoading(globalLoadingToken);
  globalLoadingToken = null;
};

onMounted(() => {
  stopLoadingWatch = watch(
    () => [props.loading, props.globalLoading, props.loadingMessage] as const,
    ([loading, useGlobalLoading, loadingMessage]) => {
      stopGlobalLoading();
      if (loading && useGlobalLoading) {
        globalLoadingToken = globalLoadingStore.beginLoading(loadingMessage);
      }
    },
    { immediate: true }
  );
});

onBeforeUnmount(() => {
  stopLoadingWatch?.();
  stopGlobalLoading();
});

/* === ディスパッチ判定 ================================================ */
const useButton3D = computed(
  () => props.variant === "hero" || props.variant === "nav" || props.variant === "ai"
);

/* === Button3D 用の colorType マッピング =============================== */
const mappedColorType = computed<
  | "info"
  | "theme"
  | "teal"
  | "success"
  | "violet"
  | "error"
  | "neutral"
  | "purple"
  | "neutral-soft"
>(() => {
  if (props.variant === "ai") return "theme";
  if (props.variant === "nav") {
    // nav variant:
    //   - 通常 (active=false) は neutral-soft (淡灰色)
    //   - active=true で `color` 指定があれば その色のフル 3D を表示 (violet/info 等)
    //   - active=true で `color` がデフォルト (primary) なら neutral-soft の pressed
    //     状態 (Button3D 側で `var(--ui-color-primary-500)` の teal 表示)
    if (props.active && props.color !== "primary") {
      return colorToButton3D(props.color);
    }
    return "neutral-soft";
  }
  // hero variant: UButton 色名 → Button3D colorType
  return colorToButton3D(props.color);
});

/** 共通: EnButton の color → Button3D colorType 変換 */
function colorToButton3D(
  color: ButtonColor
): "info" | "theme" | "teal" | "success" | "violet" | "error" | "neutral" | "purple" {
  switch (color) {
    case "primary":
      return "theme";
    case "info":
      return "info";
    case "success":
      return "success";
    case "warning":
      // hero+warning は yellow になると 3D 上で読みにくいので violet にフォールバック.
      return "violet";
    case "error":
      return "error";
    case "neutral":
      return "neutral";
    case "purple":
      return "purple";
    case "violet":
      return "violet";
    default:
      return "teal";
  }
}

/* === UButton 用の color マッピング =================================== */
const mappedUColor = computed<string>(() => {
  if (props.variant === "assistant") return "info";
  return props.color;
});

/* === UButton 用の variant マッピング ================================= */
const mappedUVariant = computed<string>(() => {
  if (props.variant === "assistant") return "soft";
  switch (props.variant) {
    case "outline":
      return "outline";
    case "soft":
      return "soft";
    case "ghost":
      return "ghost";
    case "solid":
    default:
      return "solid";
  }
});

/* === Icon size class (Button3D 系の slot 内アイコン用) ================ */
const iconClass = computed<string>(() => {
  switch (props.size) {
    case "xs":
      return "w-3.5 h-3.5";
    case "sm":
    case "md":
      return "w-4 h-4";
    case "lg":
    case "xl":
      return "w-5 h-5";
    default:
      return "w-4 h-4";
  }
});

const onClick = (event: MouseEvent) => {
  if (props.disabled || props.loading) return;
  emit("click", event);
};
</script>
