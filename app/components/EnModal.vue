<template>
  <UModal
    v-model:open="internalOpen"
    :dismissible="closeOnBackdrop"
    :fullscreen="fullscreen"
    :ui="mergedUi"
  >
    <template #content>
      <div
        :class="[
          'en-aistudio-modal',
          `en-aistudio-modal--header-${headerVariant}`,
          { 'is-fullscreen': fullscreen },
        ]"
      >
        <!-- Header -->
        <header :class="['en-aistudio-modal-header', `is-${headerVariant}`]">
          <div class="en-aistudio-modal-header-titles">
            <h2 class="en-aistudio-modal-title">
              <UIcon
                v-if="titleIcon"
                :name="titleIcon"
                class="en-aistudio-modal-title-icon"
              />
              <slot name="title">{{ title }}</slot>
            </h2>
            <p v-if="hasSubtitle" class="en-aistudio-modal-subtitle">
              <slot name="subtitle">{{ subtitle }}</slot>
            </p>
          </div>

          <slot name="close">
            <button
              v-if="!hideClose"
              type="button"
              class="en-aistudio-modal-close"
              :class="`is-${headerVariant}`"
              :aria-label="closeAriaLabel"
              @click="close"
            >
              <UIcon name="i-heroicons-x-mark" class="w-4 h-4" />
            </button>
          </slot>
        </header>

        <!-- Body -->
        <div :class="['en-aistudio-modal-body', `is-padding-${padding}`]">
          <slot />
        </div>

        <!-- Footer (slot 渡された時だけ描画) -->
        <footer v-if="$slots.footer" class="en-aistudio-modal-footer">
          <slot name="footer" />
        </footer>
      </div>
    </template>
  </UModal>
</template>

<script setup lang="ts">
/**
 * EN AIstudio 共通モーダル.
 *
 * Nuxt UI の `UModal` を薄くラップし、ヘッダー variant・サイズプリセット・
 * 閉じる X の標準装備・footer slot を 1 箇所に集約する.
 *
 * - 直書きの UModal を毎度コピペするのを止め、変更を 1 箇所で吸収する
 * - `headerVariant` で見た目を切替 (default / brand / warning / dark)
 * - `size` で最大幅を 6 段階プリセット
 * - DialogTitle が必ず存在する設計 (Nuxt UI の a11y 警告を回避)
 *
 * 利用例:
 *   <EnModal
 *     v-model:open="open"
 *     title="項目を新しく追加"
 *     subtitle="どの方法で追加しますか?"
 *     size="2xl"
 *     header-variant="default"
 *   >
 *     <CardGrid />
 *     <template #footer>
 *       <UButton color="neutral" variant="ghost" @click="open = false">閉じる</UButton>
 *     </template>
 *   </EnModal>
 */

type HeaderVariant = "default" | "brand" | "warning" | "dark";
type Size = "sm" | "md" | "lg" | "xl" | "2xl" | "3xl" | "full";
type Padding = "none" | "sm" | "md" | "lg";

interface Props {
  open: boolean;
  /** タイトル文字列. リッチタイトルは #title slot で. */
  title?: string;
  /** サブタイトル (h2 直下の灰色テキスト) */
  subtitle?: string;
  /** タイトル左に出すアイコン (Material Symbols / Heroicons) */
  titleIcon?: string;
  /** モーダル最大幅プリセット */
  size?: Size;
  /** ヘッダーの色味バリエーション */
  headerVariant?: HeaderVariant;
  /** 閉じる X を隠す */
  hideClose?: boolean;
  /** 閉じる X の aria-label (i18n しやすいよう外出し) */
  closeAriaLabel?: string;
  /** 背景クリックで閉じるか (Nuxt UI の dismissible に渡す) */
  closeOnBackdrop?: boolean;
  /** body 内側の padding */
  padding?: Padding;
  /**
   * フルスクリーン (`inset-0` 配置) にするかどうか. `true` で `top-1/2 -translate-y-1/2`
   * の中央配置を捨て、`inset-0` で viewport にぴったり貼り付ける. データ取り込みなど
   * 大型の作業モーダルで「translate が効かず modal が画面外に飛ぶ」事故を防ぐ.
   */
  fullscreen?: boolean;
  /** UModal の :ui props passthrough (slot 単位の class 追加上書き) */
  ui?: Record<string, string>;
}

const props = withDefaults(defineProps<Props>(), {
  title: "",
  subtitle: "",
  titleIcon: "",
  size: "md",
  headerVariant: "default",
  hideClose: false,
  closeAriaLabel: "閉じる",
  closeOnBackdrop: true,
  padding: "md",
  fullscreen: false,
  ui: () => ({}),
});

const emit = defineEmits<{
  (event: "update:open", value: boolean): void;
  (event: "close"): void;
}>();

const slots = useSlots();

const internalOpen = computed({
  get: () => props.open,
  set: (v) => emit("update:open", v),
});

const close = () => {
  emit("update:open", false);
  emit("close");
};

const hasSubtitle = computed(
  () => Boolean(props.subtitle) || Boolean(slots.subtitle)
);

/** size → Tailwind max-width クラス */
const sizeMaxWidthClass = computed(() => {
  switch (props.size) {
    case "sm":
      return "sm:max-w-sm";
    case "md":
      return "sm:max-w-md";
    case "lg":
      return "sm:max-w-lg";
    case "xl":
      return "sm:max-w-xl";
    case "2xl":
      return "sm:max-w-2xl";
    case "3xl":
      return "sm:max-w-3xl";
    case "full":
      return "sm:max-w-none";
  }
});

/** UModal の :ui に渡すマージ済み class. 利用者が ui prop で個別上書き可. */
const mergedUi = computed(() => ({
  content: [sizeMaxWidthClass.value, props.ui.content ?? ""]
    .filter(Boolean)
    .join(" "),
  overlay: props.ui.overlay ?? "",
}));
</script>

<style scoped>
.en-aistudio-modal {
  display: flex;
  flex-direction: column;
  background: #ffffff;
  border-radius: 12px;
  overflow: hidden;
  min-height: 0;
  /* UModal content に明示高さ (h-[88vh] 等) があるとき、下の余白を出さない */
  height: 100%;
  /* デフォルト (中央配置): 内容に応じた auto height, 上限 90vh */
  max-height: 90vh;
}

/* fullscreen 時のみ全高に伸ばす. UModal の content は inset-0 で viewport
   いっぱいになるので、内側もそれに追従させる. */
.en-aistudio-modal.is-fullscreen {
  height: 100%;
  max-height: none;
  border-radius: 0;
}

/* === Header (variants) =============================================== */
.en-aistudio-modal-header {
  display: flex;
  flex-shrink: 0;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding: 14px 18px 12px;
  border-bottom: 1px solid #e2e8f0;
}

.en-aistudio-modal-header.is-default {
  background: #f8fafc;
  color: #0f172a;
}

.en-aistudio-modal-header.is-brand {
  background: linear-gradient(135deg, #fffbeb 0%, #ffedd5 100%);
  color: #0f172a;
  border-bottom-color: #fed7aa;
}

.en-aistudio-modal-header.is-warning {
  background: #fffbeb;
  color: #78350f;
  border-bottom-color: #fcd34d;
}

.en-aistudio-modal-header.is-dark {
  background: linear-gradient(
    135deg,
    #1e293b 0%,
    #0f172a 50%,
    #1e293b 100%
  );
  color: #ffffff;
  border-bottom: none;
  box-shadow: inset 0 -1px 0 rgba(255, 255, 255, 0.06),
    0 2px 6px rgba(0, 0, 0, 0.18);
}

.en-aistudio-modal-header-titles {
  min-width: 0;
  flex: 1;
}

.en-aistudio-modal-title {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 16px;
  font-weight: 800;
  letter-spacing: 0.01em;
  margin: 0;
  /* color は header の is-* で上書きされる */
  color: inherit;
}

.en-aistudio-modal-title-icon {
  width: 18px;
  height: 18px;
  flex-shrink: 0;
  opacity: 0.9;
}

.en-aistudio-modal-subtitle {
  margin: 2px 0 0;
  font-size: 12px;
  line-height: 1.5;
  color: #64748b;
}
.en-aistudio-modal-header.is-warning .en-aistudio-modal-subtitle {
  color: #92400e;
}
.en-aistudio-modal-header.is-dark .en-aistudio-modal-subtitle {
  color: rgba(255, 255, 255, 0.78);
}
.en-aistudio-modal-header.is-brand .en-aistudio-modal-subtitle {
  color: #92400e;
}

/* === Close X ========================================================= */
.en-aistudio-modal-close {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 8px;
  flex-shrink: 0;
  background: transparent;
  color: #64748b;
  transition: background-color 120ms ease, color 120ms ease;
}
.en-aistudio-modal-close:hover {
  background: rgba(15, 23, 42, 0.08);
  color: #0f172a;
}
.en-aistudio-modal-close.is-warning {
  color: #b45309;
}
.en-aistudio-modal-close.is-warning:hover {
  background: rgba(180, 83, 9, 0.12);
  color: #78350f;
}
.en-aistudio-modal-close.is-dark {
  color: rgba(255, 255, 255, 0.8);
}
.en-aistudio-modal-close.is-dark:hover {
  background: rgba(255, 255, 255, 0.12);
  color: #ffffff;
}
.en-aistudio-modal-close.is-brand:hover {
  background: rgba(180, 83, 9, 0.08);
  color: #78350f;
}

/* === Body ============================================================ */
.en-aistudio-modal-body {
  flex: 1 1 0%;
  min-height: 0;
  overflow-y: auto;
  background: #ffffff;
  color: #0f172a;
}
.en-aistudio-modal-body.is-padding-none {
  padding: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}
.en-aistudio-modal-body.is-padding-sm {
  padding: 12px;
}
.en-aistudio-modal-body.is-padding-md {
  padding: 18px;
}
.en-aistudio-modal-body.is-padding-lg {
  padding: 24px;
}

/* === Footer ========================================================== */
.en-aistudio-modal-footer {
  display: flex;
  flex-shrink: 0;
  justify-content: flex-end;
  align-items: center;
  gap: 8px;
  padding: 12px 18px;
  background: #f8fafc;
  border-top: 1px solid #f1f5f9;
}
</style>
