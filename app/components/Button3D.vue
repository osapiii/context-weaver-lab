<template>
  <button
    :class="[
      'btn-3d',
      `btn-3d-${colorType}`,
      `btn-3d-size-${size}`,
      `btn-3d-variant-${variant}`,
      {
        'btn-3d-disabled': disabled,
        'btn-3d-pressed': pressed,
        'btn-3d-block': block,
      },
      customClass,
    ]"
    :type="type"
    :disabled="disabled"
    @click="handleClick"
  >
    <slot />
  </button>
</template>

<script setup lang="ts">
//#region Props
interface Props {
  /**
   * ボタンの色タイプ (セマンティック命名)
   *
   * **新しい命名 (UButton と統一)** — 新規利用はこちらを推奨:
   * - `theme`: 組織カラーテーマ primary (`--ui-color-primary-*`) に追従. EnButton color="primary" の hero variant
   * - `teal`: teal 固定 — レガシー / テーマ非追従が必要な場合のみ
   * - `info`: 青系 — UButton info と同色 (旧 `primary` の青継承)
   * - `success`: 緑系 — 完了 / 成功
   * - `violet`: オレンジ系 — データ書き換え系 (旧 `warning` の violet を明示)
   * - `error`: 赤系 — 削除確認 / 破壊的操作
   *
   * **既存 (Button3D 直利用の後方互換用 — 段階的に EnButton 経由に移行予定)**:
   * - `primary`: 青系 (= 新 `info` と同等)
   * - `accent`: シアン系 — 操作のサブ強調
   * - `warning`: オレンジ系 (= 新 `violet` と同等)
   * - `purple`: アンバー系 — secondary CTA / AI 部下
   * - `neutral`: 灰色系 — フォローアップ
   * - `neutral-soft`: 淡灰色 — グローバルナビ等 (`variant="nav"` 推奨)
   */
  colorType?:
    | "primary"
    | "info"
    | "theme"
    | "teal"
    | "success"
    | "accent"
    | "warning"
    | "violet"
    | "purple"
    | "error"
    | "neutral"
    | "neutral-soft";
  /**
   * サイズプリセット (UButton と揃えた xs/sm/md/lg/xl).
   * 指定すると padding / rounded / font-size が自動適用される.
   * `custom-class` で個別に padding/rounded を渡している既存箇所は size を指定せずに使えば
   * 後方互換が保たれる.
   */
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  /**
   * ホバー挙動:
   * - `cta` (デフォルト): hover で持ち上がる (translateY -2px). 通常の CTA 用.
   * - `nav`: hover で持ち上がらない. Ribbon / Master タブ等のヘッダー密度が高い場面用.
   *   `neutral-soft` colorType と組み合わせて使うことを想定.
   */
  variant?: "cta" | "nav";
  /**
   * ボタンが無効かどうか
   */
  disabled?: boolean;
  /**
   * 押下状態を固定するかどうか（完了状態など、ナビの選択中表現）
   */
  pressed?: boolean;
  /**
   * 横幅を親いっぱいに広げる (UButton の `block` 相当)
   */
  block?: boolean;
  /**
   * button の type 属性 (default: button — form 内での誤送信防止)
   */
  type?: "button" | "submit" | "reset";
  /**
   * カスタムクラス. layout 系 (whitespace-nowrap / flex-shrink-0 等) の補助に使う想定.
   * size プリセットの padding / rounded / font-size は size prop 経由で揃えることを推奨.
   */
  customClass?: string;
}

const props = withDefaults(defineProps<Props>(), {
  colorType: "primary",
  size: undefined,
  variant: "cta",
  disabled: false,
  pressed: false,
  block: false,
  type: "button",
  customClass: "",
});

//#endregion Props

//#region Emits
const emit = defineEmits<{
  click: [event: MouseEvent];
}>();

//#endregion Emits

//#region Methods
const handleClick = (event: MouseEvent) => {
  if (!props.disabled) {
    emit("click", event);
  }
};
//#endregion Methods
</script>

<style scoped>
/* ベース3Dボタンスタイル */
.btn-3d {
  position: relative;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  transform-style: preserve-3d;
  cursor: pointer;
  user-select: none;
  border: none;
  outline: none;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
}

.btn-3d::before {
  content: "";
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  border-radius: inherit;
  opacity: 0;
  transition: opacity 0.2s ease;
  background: linear-gradient(
    135deg,
    rgba(255, 255, 255, 0.3) 0%,
    rgba(255, 255, 255, 0) 50%,
    rgba(0, 0, 0, 0.1) 100%
  );
  pointer-events: none;
}

.btn-3d:hover::before {
  opacity: 1;
}

/* === Size プリセット =================================================
 * `custom-class` で都度書いていた padding/rounded/font-size をプロパティ化.
 * 既存利用箇所は size を指定しなければ custom-class 側の値が効く (後方互換).
 */
.btn-3d-size-xs {
  padding: 0.375rem 0.75rem;
  border-radius: 0.5rem; /* rounded-lg */
  font-size: 0.75rem; /* text-xs */
  font-weight: 700;
  gap: 0.25rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.btn-3d-size-sm {
  padding: 0.5rem 1rem;
  border-radius: 0.5rem;
  font-size: 0.75rem;
  font-weight: 700;
  gap: 0.375rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.btn-3d-size-md {
  padding: 0.625rem 1.25rem;
  border-radius: 0.75rem; /* rounded-xl */
  font-size: 0.875rem; /* text-sm */
  font-weight: 700;
  gap: 0.5rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.btn-3d-size-lg {
  padding: 0.75rem 1.5rem;
  border-radius: 0.75rem;
  font-size: 1rem; /* text-base */
  font-weight: 700;
  gap: 0.5rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.btn-3d-size-xl {
  padding: 1rem 2rem;
  border-radius: 0.75rem;
  font-size: 1.125rem; /* text-lg */
  font-weight: 700;
  gap: 0.625rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.btn-3d-block {
  width: 100%;
  display: flex;
}

/* === Variant nav: hover で持ち上がらない (密度の高いヘッダー用) ============
 * neutral-soft 以外でも nav variant で使えるよう、translateY を相殺する. */
.btn-3d-variant-nav:hover {
  transform: none !important;
}

/* Primary (青系) — 後方互換用 (新規は `info` を推奨) */
.btn-3d-primary {
  background: linear-gradient(135deg, #3b82f6 0%, #2563eb 50%, #1d4ed8 100%);
  color: white;
  box-shadow:
    0 6px 0 0 #1e40af,
    0 8px 16px rgba(37, 99, 235, 0.4),
    0 0 0 1px rgba(255, 255, 255, 0.1) inset;
}

.btn-3d-primary:hover {
  transform: translateY(-2px);
  box-shadow:
    0 8px 0 0 #1e40af,
    0 12px 24px rgba(37, 99, 235, 0.5),
    0 0 0 1px rgba(255, 255, 255, 0.15) inset;
}

.btn-3d-primary:active {
  transform: translateY(4px);
  box-shadow:
    0 2px 0 0 #1e40af,
    0 4px 8px rgba(37, 99, 235, 0.3),
    0 0 0 1px rgba(255, 255, 255, 0.05) inset;
}

/* Success (緑系) */
.btn-3d-success {
  background: linear-gradient(135deg, #10b981 0%, #059669 50%, #047857 100%);
  color: white;
  box-shadow:
    0 6px 0 0 #065f46,
    0 8px 16px rgba(16, 185, 129, 0.4),
    0 0 0 1px rgba(255, 255, 255, 0.1) inset;
}

.btn-3d-success:hover {
  transform: translateY(-2px);
  box-shadow:
    0 8px 0 0 #065f46,
    0 12px 24px rgba(16, 185, 129, 0.5),
    0 0 0 1px rgba(255, 255, 255, 0.15) inset;
}

.btn-3d-success:active {
  transform: translateY(4px);
  box-shadow:
    0 2px 0 0 #065f46,
    0 4px 8px rgba(16, 185, 129, 0.3),
    0 0 0 1px rgba(255, 255, 255, 0.05) inset;
}

/* Accent (シアン系) - 操作のサブ強調 */
.btn-3d-accent {
  background: linear-gradient(135deg, #06b6d4 0%, #0891b2 50%, #0e7490 100%);
  color: white;
  box-shadow:
    0 6px 0 0 #155e75,
    0 8px 16px rgba(6, 182, 212, 0.4),
    0 0 0 1px rgba(255, 255, 255, 0.1) inset;
}

.btn-3d-accent:hover {
  transform: translateY(-2px);
  box-shadow:
    0 8px 0 0 #155e75,
    0 12px 24px rgba(6, 182, 212, 0.5),
    0 0 0 1px rgba(255, 255, 255, 0.15) inset;
}

.btn-3d-accent:active {
  transform: translateY(4px);
  box-shadow:
    0 2px 0 0 #155e75,
    0 4px 8px rgba(6, 182, 212, 0.3),
    0 0 0 1px rgba(255, 255, 255, 0.05) inset;
}

/* Warning - 注意喚起 / データ書き換え系。ENOSTECH Violet に寄せる */
.btn-3d-warning {
  background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 50%, #6d28d9 100%);
  color: white;
  box-shadow:
    0 6px 0 0 #5b21b6,
    0 8px 16px rgba(124, 58, 237, 0.4),
    0 0 0 1px rgba(255, 255, 255, 0.1) inset;
}

.btn-3d-warning:hover {
  transform: translateY(-2px);
  box-shadow:
    0 8px 0 0 #5b21b6,
    0 12px 24px rgba(124, 58, 237, 0.5),
    0 0 0 1px rgba(255, 255, 255, 0.15) inset;
}

.btn-3d-warning:active {
  transform: translateY(4px);
  box-shadow:
    0 2px 0 0 #5b21b6,
    0 4px 8px rgba(124, 58, 237, 0.3),
    0 0 0 1px rgba(255, 255, 255, 0.05) inset;
}

/* Purple - secondary CTA / AI companion CTA */
.btn-3d-purple {
  background: linear-gradient(135deg, #c084fc 0%, #a855f7 50%, #9333ea 100%);
  color: white;
  box-shadow:
    0 6px 0 0 #7e22ce,
    0 8px 16px rgba(168, 85, 247, 0.4),
    0 0 0 1px rgba(255, 255, 255, 0.1) inset;
}

.btn-3d-purple:hover {
  transform: translateY(-2px);
  box-shadow:
    0 8px 0 0 #7e22ce,
    0 12px 24px rgba(168, 85, 247, 0.5),
    0 0 0 1px rgba(255, 255, 255, 0.15) inset;
}

.btn-3d-purple:active {
  transform: translateY(4px);
  box-shadow:
    0 2px 0 0 #7e22ce,
    0 4px 8px rgba(168, 85, 247, 0.3),
    0 0 0 1px rgba(255, 255, 255, 0.05) inset;
}

/*
 * Neutral-soft - グローバルナビのモードタブで使う。
 * 非選択 = 白系で控えめ。pressed (= 選択中) は暗いスレートで強くメリハリ。
 */
.btn-3d-neutral-soft {
  background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 50%, #cbd5e1 100%);
  color: #334155; /* slate-700 — 白系背景でも読める */
  text-shadow: none;
  box-shadow:
    0 6px 0 0 #94a3b8,
    0 8px 16px rgba(148, 163, 184, 0.3),
    0 0 0 1px rgba(255, 255, 255, 0.6) inset;
}

/*
 * 密度の高いヘッダー内で使う想定なので、ホバー時に上方向に動かない。
 * 視覚フィードバックは明度アップ + シャドウの広がりだけで表現する。
 */
.btn-3d-neutral-soft:hover {
  background: linear-gradient(135deg, #ffffff 0%, #f1f5f9 50%, #e2e8f0 100%);
  box-shadow:
    0 6px 0 0 #94a3b8,
    0 10px 20px rgba(148, 163, 184, 0.45),
    0 0 0 1px rgba(255, 255, 255, 0.8) inset;
}

.btn-3d-neutral-soft:active {
  transform: translateY(4px);
  box-shadow:
    0 2px 0 0 #94a3b8,
    0 4px 8px rgba(148, 163, 184, 0.25),
    0 0 0 1px rgba(255, 255, 255, 0.4) inset;
}

/* Neutral (灰色系) - 無効化済み / フォローアップ */
.btn-3d-neutral {
  background: linear-gradient(135deg, #6b7280 0%, #4b5563 50%, #374151 100%);
  color: white;
  box-shadow:
    0 6px 0 0 #1f2937,
    0 8px 16px rgba(107, 114, 128, 0.4),
    0 0 0 1px rgba(255, 255, 255, 0.1) inset;
}

.btn-3d-neutral:hover {
  transform: translateY(-2px);
  box-shadow:
    0 8px 0 0 #1f2937,
    0 12px 24px rgba(107, 114, 128, 0.5),
    0 0 0 1px rgba(255, 255, 255, 0.15) inset;
}

.btn-3d-neutral:active {
  transform: translateY(4px);
  box-shadow:
    0 2px 0 0 #1f2937,
    0 4px 8px rgba(107, 114, 128, 0.3),
    0 0 0 1px rgba(255, 255, 255, 0.05) inset;
}

/* === 新規 colorType (UButton と揃えた命名) ============================ */

/* Info (青系) - 旧 primary と同等. 通知系 / 補助情報 */
.btn-3d-info {
  background: linear-gradient(135deg, #3b82f6 0%, #2563eb 50%, #1d4ed8 100%);
  color: white;
  box-shadow:
    0 6px 0 0 #1e40af,
    0 8px 16px rgba(37, 99, 235, 0.4),
    0 0 0 1px rgba(255, 255, 255, 0.1) inset;
}
.btn-3d-info:hover {
  transform: translateY(-2px);
  box-shadow:
    0 8px 0 0 #1e40af,
    0 12px 24px rgba(37, 99, 235, 0.5),
    0 0 0 1px rgba(255, 255, 255, 0.15) inset;
}
.btn-3d-info:active {
  transform: translateY(4px);
  box-shadow:
    0 2px 0 0 #1e40af,
    0 4px 8px rgba(37, 99, 235, 0.3),
    0 0 0 1px rgba(255, 255, 255, 0.05) inset;
}

/* Teal (UButton primary と同色) - EnButton color="primary" + variant="hero" */
.btn-3d-teal {
  background: linear-gradient(135deg, #14b8a6 0%, #0d9488 50%, #0f766e 100%);
  color: white;
  box-shadow:
    0 6px 0 0 #115e59,
    0 8px 16px rgba(20, 184, 166, 0.4),
    0 0 0 1px rgba(255, 255, 255, 0.1) inset;
}
.btn-3d-teal:hover {
  transform: translateY(-2px);
  box-shadow:
    0 8px 0 0 #115e59,
    0 12px 24px rgba(20, 184, 166, 0.5),
    0 0 0 1px rgba(255, 255, 255, 0.15) inset;
}
.btn-3d-teal:active {
  transform: translateY(4px);
  box-shadow:
    0 2px 0 0 #115e59,
    0 4px 8px rgba(20, 184, 166, 0.3),
    0 0 0 1px rgba(255, 255, 255, 0.05) inset;
}

/* Theme primary — 組織カラーテーマ (Nuxt UI --ui-color-primary-*) に追従 */
.btn-3d-theme {
  background: linear-gradient(
    135deg,
    var(--ui-color-primary-500) 0%,
    var(--ui-color-primary-600) 50%,
    var(--ui-color-primary-700) 100%
  );
  color: white;
  box-shadow:
    0 6px 0 0 var(--ui-color-primary-800),
    0 8px 16px color-mix(in srgb, var(--ui-color-primary-500) 40%, transparent),
    0 0 0 1px rgba(255, 255, 255, 0.1) inset;
}
.btn-3d-theme:hover {
  transform: translateY(-2px);
  box-shadow:
    0 8px 0 0 var(--ui-color-primary-800),
    0 12px 24px color-mix(in srgb, var(--ui-color-primary-500) 50%, transparent),
    0 0 0 1px rgba(255, 255, 255, 0.15) inset;
}
.btn-3d-theme:active {
  transform: translateY(4px);
  box-shadow:
    0 2px 0 0 var(--ui-color-primary-800),
    0 4px 8px color-mix(in srgb, var(--ui-color-primary-500) 30%, transparent),
    0 0 0 1px rgba(255, 255, 255, 0.05) inset;
}

/* Violet - primary action / data mutation */
.btn-3d-violet {
  background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 50%, #6d28d9 100%);
  color: white;
  box-shadow:
    0 6px 0 0 #5b21b6,
    0 8px 16px rgba(124, 58, 237, 0.4),
    0 0 0 1px rgba(255, 255, 255, 0.1) inset;
}
.btn-3d-violet:hover {
  transform: translateY(-2px);
  box-shadow:
    0 8px 0 0 #5b21b6,
    0 12px 24px rgba(124, 58, 237, 0.5),
    0 0 0 1px rgba(255, 255, 255, 0.15) inset;
}
.btn-3d-violet:active {
  transform: translateY(4px);
  box-shadow:
    0 2px 0 0 #5b21b6,
    0 4px 8px rgba(124, 58, 237, 0.3),
    0 0 0 1px rgba(255, 255, 255, 0.05) inset;
}

/* Error (赤系) - 削除確認 / 破壊的操作 */
.btn-3d-error {
  background: linear-gradient(135deg, #ef4444 0%, #dc2626 50%, #b91c1c 100%);
  color: white;
  box-shadow:
    0 6px 0 0 #991b1b,
    0 8px 16px rgba(239, 68, 68, 0.4),
    0 0 0 1px rgba(255, 255, 255, 0.1) inset;
}
.btn-3d-error:hover {
  transform: translateY(-2px);
  box-shadow:
    0 8px 0 0 #991b1b,
    0 12px 24px rgba(239, 68, 68, 0.5),
    0 0 0 1px rgba(255, 255, 255, 0.15) inset;
}
.btn-3d-error:active {
  transform: translateY(4px);
  box-shadow:
    0 2px 0 0 #991b1b,
    0 4px 8px rgba(239, 68, 68, 0.3),
    0 0 0 1px rgba(255, 255, 255, 0.05) inset;
}

/* Disabled */
.btn-3d-disabled {
  opacity: 0.6;
  cursor: not-allowed;
  pointer-events: none;
}

.btn-3d-disabled:hover {
  transform: none;
  box-shadow: inherit;
}

/* Pressed (押下状態固定) - 凹んだ感じ */
.btn-3d-pressed {
  transform: translateY(6px) !important;
  cursor: default;
  pointer-events: none;
}

.btn-3d-pressed.btn-3d-primary {
  box-shadow:
    0 2px 0 0 #1e40af,
    0 4px 8px rgba(37, 99, 235, 0.3),
    0 0 0 1px rgba(255, 255, 255, 0.05) inset !important;
}

.btn-3d-pressed.btn-3d-success {
  box-shadow:
    0 2px 0 0 #065f46,
    0 4px 8px rgba(16, 185, 129, 0.3),
    0 0 0 1px rgba(255, 255, 255, 0.05) inset !important;
}

.btn-3d-pressed.btn-3d-accent {
  box-shadow:
    0 2px 0 0 #155e75,
    0 4px 8px rgba(6, 182, 212, 0.3),
    0 0 0 1px rgba(255, 255, 255, 0.05) inset !important;
}

.btn-3d-pressed.btn-3d-warning {
  box-shadow:
    0 2px 0 0 #5b21b6,
    0 4px 8px rgba(124, 58, 237, 0.3),
    0 0 0 1px rgba(255, 255, 255, 0.05) inset !important;
}

.btn-3d-pressed.btn-3d-purple {
  box-shadow:
    0 2px 0 0 #7e22ce,
    0 4px 8px rgba(168, 85, 247, 0.3),
    0 0 0 1px rgba(255, 255, 255, 0.05) inset !important;
}

.btn-3d-pressed.btn-3d-neutral {
  box-shadow:
    0 2px 0 0 #1f2937,
    0 4px 8px rgba(107, 114, 128, 0.3),
    0 0 0 1px rgba(255, 255, 255, 0.05) inset !important;
}

.btn-3d-pressed.btn-3d-info {
  box-shadow:
    0 2px 0 0 #1e40af,
    0 4px 8px rgba(37, 99, 235, 0.3),
    0 0 0 1px rgba(255, 255, 255, 0.05) inset !important;
}

.btn-3d-pressed.btn-3d-teal {
  box-shadow:
    0 2px 0 0 #115e59,
    0 4px 8px rgba(20, 184, 166, 0.3),
    0 0 0 1px rgba(255, 255, 255, 0.05) inset !important;
}

.btn-3d-pressed.btn-3d-theme {
  box-shadow:
    0 2px 0 0 var(--ui-color-primary-800),
    0 4px 8px color-mix(in srgb, var(--ui-color-primary-500) 30%, transparent),
    0 0 0 1px rgba(255, 255, 255, 0.05) inset !important;
}

.btn-3d-pressed.btn-3d-violet {
  box-shadow:
    0 2px 0 0 #5b21b6,
    0 4px 8px rgba(124, 58, 237, 0.3),
    0 0 0 1px rgba(255, 255, 255, 0.05) inset !important;
}

.btn-3d-pressed.btn-3d-error {
  box-shadow:
    0 2px 0 0 #991b1b,
    0 4px 8px rgba(239, 68, 68, 0.3),
    0 0 0 1px rgba(255, 255, 255, 0.05) inset !important;
}

/*
 * neutral-soft の pressed は「現在モード」のような静的アクティブ表示用。
 * 非選択 (白系) ↔ 選択 (組織のテーマ primary 色) で、ダーク navy ヘッダー内でもしっかり点灯する。
 * カラーテーマ切替に追従させるため Nuxt UI の `--ui-color-primary-*` を参照する。
 * クリック圧時の translateY は相殺してインライン (ヘッダー) で行揃いを保つ。
 */
.btn-3d-pressed.btn-3d-neutral-soft,
.btn-3d-pressed.btn-3d-neutral-soft:hover {
  transform: translateY(0) !important;
  background: linear-gradient(
    135deg,
    var(--ui-color-primary-500) 0%,
    var(--ui-color-primary-600) 50%,
    var(--ui-color-primary-700) 100%
  ) !important;
  color: white !important;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.25) !important;
  box-shadow:
    0 2px 0 0 var(--ui-color-primary-800),
    inset 0 2px 4px rgba(0, 0, 0, 0.18),
    0 0 0 1px rgba(255, 255, 255, 0.14) inset !important;
}

.btn-3d-pressed:hover {
  transform: translateY(6px) !important;
}

.btn-3d-pressed::before {
  opacity: 0 !important;
}
</style>
