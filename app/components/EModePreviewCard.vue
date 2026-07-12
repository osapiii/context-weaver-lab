<template>
  <div
    :style="accentStyle"
    :class="[
      'nav-card-wrapper',
      disabled ? 'is-disabled' : '',
    ]"
  >
    <button
      type="button"
      :disabled="disabled"
      :class="['nav-card group', `nav-card--${accent}`]"
      @click="$emit('click')"
    >
      <!-- 上: カラーアイコン Hero (flat-color-icons / vscode-icons 等) -->
      <div class="nav-card-hero">
        <div class="nav-card-hero-icon-stage" aria-hidden="true">
          <UIcon
            :name="icon"
            class="nav-card-hero-icon"
            :class="{
              'nav-card-hero-icon--multicolor': isMulticolorNavIcon(icon),
            }"
          />
        </div>
        <div class="nav-card-hero-overlay" aria-hidden="true" />

        <!-- 左上: badge (任意) — corner-tape 風に小さく目立たせる -->
        <span v-if="badge" class="nav-card-badge">
          {{ badge }}
        </span>
      </div>

      <!-- 下: タイトル + 説明 -->
      <div class="nav-card-body">
        <div class="nav-card-title-row">
          <UIcon
            :name="icon"
            class="nav-card-title-icon"
            :class="{
              'nav-card-title-icon--multicolor': isMulticolorNavIcon(icon),
            }"
          />
          <h3 class="nav-card-title">{{ title }}</h3>
        </div>
        <p v-if="description" class="nav-card-description">
          {{ description }}
        </p>

        <!--
          準備状況フッター. AI に依頼する仕事カードでのみ意味を持つ.
          状態が無い (data 系のカード等) は何も出さない.
        -->
        <div
          v-if="readiness && readiness.state !== 'coming-soon'"
          class="nav-card-readiness"
        >
          <template v-if="readiness.state === 'todo'">
            <div class="readiness-dots" aria-hidden="true">
              <span
                v-for="i in readiness.totalCount"
                :key="i"
                :class="[
                  'readiness-dot',
                  i <= (readiness.doneCount ?? 0) ? 'is-done' : '',
                ]"
              />
            </div>
            <span class="readiness-progress-label">
              {{ readiness.doneCount ?? 0 }}/{{ readiness.totalCount }} 準備中
            </span>
            <!--
              CTA「続ける」: 準備中ラベルと同じ行の trailing 位置に格納.
              親 <button> 内なので <span role="button"> + @click.stop で独立クリック化.
            -->
            <span
              class="nav-card-setup-cta"
              role="button"
              tabindex="0"
              aria-label="設定を続ける"
              @click.stop="$emit('continueSetup')"
              @keydown.enter.space.prevent.stop="$emit('continueSetup')"
            >
              <UIcon
                name="material-symbols:explore-rounded"
                class="w-3.5 h-3.5"
              />
              <span>続ける</span>
              <UIcon
                name="material-symbols:arrow-forward"
                class="w-3.5 h-3.5"
              />
            </span>
          </template>
          <template v-else-if="readiness.state === 'ready'">
            <UIcon
              name="i-heroicons-check-badge"
              class="readiness-ready-icon"
            />
            <span class="readiness-ready-label">準備OK · AI に依頼</span>
          </template>
        </div>
      </div>
    </button>

    <!-- ピュア CSS のホバーポップオーバー (JS / portal なし).
         .nav-card-wrapper:hover で opacity を上げるだけ.
         position: absolute なので grid セル内に確実に anchor される. -->
    <div
      v-if="tipDetail || useCases.length"
      class="nav-card-tip"
      role="tooltip"
    >
      <p v-if="tipDetail" class="nav-card-tip-detail">
        {{ tipDetail }}
      </p>
      <div
        v-if="tipDetail && useCases.length"
        class="nav-card-tip-divider"
        aria-hidden="true"
      />
      <div v-if="useCases.length" class="nav-card-tip-scenes">
        <span class="nav-card-tip-label">シーン</span>
        <div class="nav-card-tip-chips">
          <span
            v-for="useCase in useCases"
            :key="useCase"
            class="nav-card-tip-chip"
          >
            {{ useCase }}
          </span>
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
/**
 * モード TOP ページ用の汎用ビジュアルカード。
 *
 * 構成: 上 = カラーアイコン Hero (Nuxt UI Icon / Iconify)、
 *       下 = タイトル + 説明 + 利用シーン chips + CTA pill。
 *
 * `icon` は flat-color-icons 等のマルチカラー set を推奨 (`useNavCardIcons`)。
 *
 * フレームは「机に置いた厚みのある物体」感を CSS で表現:
 *   - 多重 box-shadow (drop + ground 厚み + inset highlight)
 *   - hover で translateY(-4px) scale(1.015) + accent カラーで縁が灯る
 * accent prop は `--accent-*` CSS 変数として流し込まれ、border / shadow /
 * CTA pill / chip / focus ring が全て同じ系統色で連動する。
 */
import type { NavBehavior } from "@composables/useNavigationModeRegistry";

/**
 * AI に依頼する仕事カードの準備状況.
 * - todo: まだ準備が足りない (進捗ドット + 「設定を続ける」CTA を表示)
 * - ready: 準備完了 (「準備OK」表示)
 * - coming-soon: 将来リリース (既存の「今後追加予定」overlay と同等. 何も追加しない)
 */
export interface CardReadiness {
  state: "todo" | "ready" | "coming-soon";
  doneCount?: number;
  totalCount?: number;
}

interface Props {
  title: string;
  description?: string;
  /** ホバー時のツールチップに出す詳細説明 (2-3 文)。未指定なら description にフォールバック */
  purpose?: string;
  /** Hero + タイトル行に表示する Iconify 名 (カラー set 推奨) */
  icon: string;
  behavior: NavBehavior;
  badge?: string;
  disabled?: boolean;
  /** フォールバック背景 / accent の系統色 */
  accent?: "purple" | "warning" | "success" | "neutral" | "info";
  /** 利用シーン (どんな時に使うか) を示す soft chips。最大 2 個まで表示 */
  useCases?: string[];
  /** AI 依頼カード時に渡す準備状況. 渡されない場合は何も表示しない */
  readiness?: CardReadiness;
}

const props = withDefaults(defineProps<Props>(), {
  description: "",
  purpose: "",
  badge: "",
  disabled: false,
  accent: "purple",
  useCases: () => [],
  readiness: undefined,
});

defineEmits<{
  click: [];
  continueSetup: [];
}>();

/**
 * accent ごとの CSS 変数を <button> に流し込む。
 * border / shadow / CTA / chip / focus ring が全てこの変数を参照するので、
 * accent を増やしてもスタイル側に手を入れなくて済む。
 */
type AccentPalette = {
  /** 普段の chip / pill のフィル */
  soft: string;
  /** 普段の chip / pill の文字色 */
  text: string;
  /** 普段の chip / pill の縁取り */
  ring: string;
  /** hover 時の border 色 */
  borderHover: string;
  /** hover 時の drop shadow の色味 */
  shadowHover: string;
  /** fallback 背景の gradient (画像未配置時) */
  fallback: string;
};

const PALETTES: Record<NonNullable<Props["accent"]>, AccentPalette> = {
  purple: {
    soft: "#faf5ff",
    text: "#7e22ce",
    ring: "#e9d5ff",
    borderHover: "rgba(168, 85, 247, 0.55)",
    shadowHover: "rgba(168, 85, 247, 0.35)",
    fallback: "linear-gradient(135deg, #c084fc 0%, #a855f7 55%, #7c3aed 100%)",
  },
  warning: {
    soft: "#f5f3ff",
    text: "#6d28d9",
    ring: "#ddd6fe",
    borderHover: "rgba(124, 58, 237, 0.55)",
    shadowHover: "rgba(124, 58, 237, 0.35)",
    fallback: "linear-gradient(135deg, #a855f7 0%, #7c3aed 55%, #4c1d95 100%)",
  },
  success: {
    soft: "#ecfdf5",
    text: "#047857",
    ring: "#a7f3d0",
    borderHover: "rgba(16, 185, 129, 0.55)",
    shadowHover: "rgba(16, 185, 129, 0.32)",
    fallback: "linear-gradient(135deg, #10b981 0%, #14b8a6 55%, #0891b2 100%)",
  },
  neutral: {
    soft: "#f1f5f9",
    text: "#334155",
    ring: "#cbd5e1",
    borderHover: "rgba(71, 85, 105, 0.55)",
    shadowHover: "rgba(15, 23, 42, 0.28)",
    fallback: "linear-gradient(135deg, #94a3b8 0%, #64748b 55%, #475569 100%)",
  },
  info: {
    soft: "#eff6ff",
    text: "#1d4ed8",
    ring: "#bfdbfe",
    borderHover: "rgba(37, 99, 235, 0.55)",
    shadowHover: "rgba(37, 99, 235, 0.32)",
    fallback: "linear-gradient(135deg, #60a5fa 0%, #3b82f6 55%, #0ea5e9 100%)",
  },
};

const accentStyle = computed(() => {
  const p = PALETTES[props.accent];
  return {
    "--accent-soft": p.soft,
    "--accent-text": p.text,
    "--accent-ring": p.ring,
    "--accent-border-hover": p.borderHover,
    "--accent-shadow-hover": p.shadowHover,
    "--accent-fallback": p.fallback,
  } as Record<string, string>;
});

/** ホバーポップオーバーで表示する詳細文 (purpose 優先、なければ description) */
const tipDetail = computed(() => props.purpose || props.description);
</script>

<style scoped>
/* === ホバーポップオーバー親 (CSS だけで anchor を成立させる) =========== */
.nav-card-wrapper {
  position: relative;
  width: 100%;
}

/* === カード本体: 「机に置いた厚みのある物体」 ===========================
 *  - 多重 box-shadow で drop + ground (厚み) + 上端ハイライト
 *  - 普段は neutral 寄り、hover で初めて accent が縁取りに灯る
 *    (「グローバルナビ neutral 基調」原則: 静止時は強い色を持たせない)
 * ====================================================================== */
.nav-card {
  position: relative;
  width: 100%;
  text-align: left;
  background: linear-gradient(180deg, #ffffff 0%, #fafafa 100%);
  border: 2px solid rgba(15, 23, 42, 0.08);
  border-radius: 16px;
  overflow: hidden;
  cursor: pointer;
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.9),
    0 3px 0 -1px rgba(15, 23, 42, 0.1),
    0 8px 16px -6px rgba(15, 23, 42, 0.16),
    0 2px 4px rgba(15, 23, 42, 0.06);
  transition:
    transform 240ms cubic-bezier(0.34, 1.56, 0.64, 1),
    box-shadow 240ms ease,
    border-color 220ms ease;
  will-change: transform, box-shadow;
  backface-visibility: hidden;
  transform: translateZ(0);
}

.nav-card:hover:not(:disabled) {
  transform: translateY(-4px) scale(1.015) translateZ(0);
  border-color: var(--accent-border-hover);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 1),
    0 5px 0 -1px rgba(15, 23, 42, 0.12),
    0 14px 28px -8px var(--accent-shadow-hover),
    0 4px 10px rgba(15, 23, 42, 0.08);
}

.nav-card:active:not(:disabled) {
  transform: translateY(-1px) scale(0.998) translateZ(0);
  transition-duration: 80ms;
}

/* キーボードフォーカスでも accent カラーで縁が灯る */
.nav-card:focus-visible {
  outline: none;
  border-color: var(--accent-border-hover);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 1),
    0 0 0 4px var(--accent-ring),
    0 8px 16px -6px var(--accent-shadow-hover);
}

.nav-card:disabled {
  opacity: 0.45;
  cursor: not-allowed;
  filter: saturate(0.6);
}

/* === ヒーロー (上半分) =============================================== */
.nav-card-hero {
  position: relative;
  width: 100%;
  aspect-ratio: 16 / 9;
  overflow: hidden;
  background: linear-gradient(
    145deg,
    color-mix(in oklab, var(--accent-soft, #fff7ed) 88%, white) 0%,
    #f8fafc 48%,
    #eef2f7 100%
  );
}

.nav-card-hero-icon-stage {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0.75rem 1rem;
}

.nav-card-hero-icon {
  /* Hero 高さの約 6 割を占有 — カード幅が変わっても存在感を保つ */
  width: clamp(6.5rem, 62%, 10rem);
  height: clamp(6.5rem, 62%, 10rem);
  color: rgba(255, 255, 255, 0.95);
  filter: drop-shadow(0 12px 24px rgba(15, 23, 42, 0.14));
  transition: transform 500ms cubic-bezier(0.4, 0, 0.2, 1);
}

@media (min-width: 640px) {
  .nav-card-hero-icon {
    width: clamp(7rem, 64%, 11rem);
    height: clamp(7rem, 64%, 11rem);
  }
}

.nav-card-hero-icon--multicolor {
  color: unset;
}

.nav-card:hover:not(:disabled) .nav-card-hero-icon {
  transform: scale(1.08) translateY(-2px);
}

.nav-card-hero-overlay {
  position: absolute;
  inset: 0;
  pointer-events: none;
  background: linear-gradient(
    180deg,
    transparent 55%,
    rgba(15, 23, 42, 0.06) 100%
  );
}

.nav-card-badge {
  position: absolute;
  top: 0.55rem;
  left: 0.55rem;
  padding: 0.2rem 0.55rem;
  font-size: 10.5px;
  font-weight: 800;
  letter-spacing: 0.02em;
  color: var(--accent-text);
  background: rgba(255, 255, 255, 0.96);
  border: 1px solid var(--accent-ring);
  border-radius: 999px;
  box-shadow:
    0 2px 0 rgba(15, 23, 42, 0.08),
    0 4px 8px -2px rgba(15, 23, 42, 0.18);
  transform: rotate(-2deg);
}

/* coming-soon (disabled) のときは、コーナーではなく画像中央に大きく出す.
   「今後追加予定」をぱっと認識させたいので、サイズと存在感を底上げする. */
.nav-card-wrapper.is-disabled .nav-card-badge {
  top: 50%;
  left: 50%;
  padding: 0.35rem 0.95rem;
  font-size: 13px;
  letter-spacing: 0.04em;
  transform: translate(-50%, -50%) rotate(-2deg);
  box-shadow:
    0 2px 0 rgba(15, 23, 42, 0.08),
    0 8px 20px -4px rgba(15, 23, 42, 0.28);
}

/* === 本体 (下半分) =================================================== */
.nav-card-body {
  padding: 16px 16px 18px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.nav-card-title-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.nav-card-title-icon {
  width: 28px;
  height: 28px;
  color: var(--accent-text);
  flex-shrink: 0;
}

.nav-card-title-icon--multicolor {
  color: unset;
}

.nav-card-title {
  flex: 1 1 0;
  font-size: 18px;
  font-weight: 800;
  letter-spacing: -0.015em;
  color: #0f172a;
  line-height: 1.25;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  min-width: 0;
}

.nav-card-description {
  font-size: 13px;
  color: #475569;
  line-height: 1.6;
  display: -webkit-box;
  -webkit-line-clamp: 4;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

/* === 準備状況フッター (todo / ready) =================================
 *  todo:  ●●○○○○ + "3/6 準備中" + (trailing) [続ける →] CTA.
 *  ready: ✓ + "準備OK · AI に依頼" の sky 系強調.
 *  CTA は同じフッター行の trailing 位置に格納する (準備中ラベルと同居).
 * ====================================================================== */
.nav-card-readiness {
  margin-top: 4px;
  padding-top: 10px;
  border-top: 1px dashed rgba(15, 23, 42, 0.1);
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 22px;
}

.readiness-dots {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.readiness-dot {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 999px;
  background: rgba(15, 23, 42, 0.12);
  transition: background-color 200ms ease;
}

.readiness-dot.is-done {
  background: rgb(16, 185, 129);
  box-shadow: 0 0 0 2px rgba(16, 185, 129, 0.15);
}

.readiness-progress-label {
  font-size: 11.5px;
  font-weight: 700;
  color: rgb(180, 83, 9); /* purple-700 */
  letter-spacing: 0.01em;
  tabular-nums: 1;
}

.readiness-ready-icon {
  width: 16px;
  height: 16px;
  color: rgb(16, 185, 129);
}

.readiness-ready-label {
  font-size: 12px;
  font-weight: 800;
  color: rgb(6, 95, 70); /* emerald-800 */
  letter-spacing: 0.01em;
}

/* === 「設定を続ける」二次 CTA (title row trailing 格納版) ===============
 *  Card ヘッダー (title row) の右端に小さい sky-soft chip として埋め込む.
 *  sky = MEMORY 規約: 操作アシスタント (案内系) の配色.
 *  parent button 内に居るが <span role="button"> + @click.stop で独立クリック.
 * ====================================================================== */
.nav-card-setup-cta {
  margin-left: auto;
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px 4px 7px;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.01em;
  color: rgb(2, 132, 199);
  background: rgb(240, 249, 255); /* sky-50 */
  border: 1px solid rgb(186, 230, 253); /* sky-200 */
  border-radius: 9999px;
  cursor: pointer;
  transition:
    background-color 150ms ease,
    border-color 150ms ease,
    color 150ms ease,
    transform 150ms ease;
  user-select: none;
}

.nav-card-setup-cta:hover {
  background: rgb(224, 242, 254); /* sky-100 */
  border-color: rgb(125, 211, 252); /* sky-300 */
  color: rgb(7, 89, 133); /* sky-800 */
  transform: translateX(1px);
}

.nav-card-setup-cta:active {
  transform: translateX(0);
  background: rgb(186, 230, 253); /* sky-200 */
}

.nav-card-setup-cta:focus-visible {
  outline: none;
  box-shadow: 0 0 0 2px rgba(14, 165, 233, 0.35);
}

/* === ホバー詳細ポップオーバー (純 CSS、JS / portal なし) ===============
 *  - 普段は opacity:0 + pointer-events:none で完全に不可視
 *  - .nav-card-wrapper:hover で opacity:1
 *  - position: absolute で grid セル内に anchor (絶対にズレない)
 *  - 上方向に出し、edge clipping を避けるため max-width を絞る
 * ====================================================================== */
.nav-card-tip {
  position: absolute;
  left: 50%;
  bottom: calc(100% + 10px);
  transform: translateX(-50%) translateY(4px);
  width: max-content;
  max-width: min(320px, calc(100vw - 32px));
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  background: #ffffff;
  color: #334155;
  text-align: left;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  box-shadow:
    0 12px 28px -8px rgba(15, 23, 42, 0.25),
    0 4px 10px rgba(15, 23, 42, 0.08);
  opacity: 0;
  pointer-events: none;
  transition:
    opacity 180ms ease,
    transform 180ms cubic-bezier(0.4, 0, 0.2, 1);
  z-index: 60;
}

.nav-card-tip-detail {
  margin: 0;
  font-size: 12.5px;
  line-height: 1.6;
  color: #334155;
}

.nav-card-tip-divider {
  height: 1px;
  background: #e2e8f0;
  margin: 0 -2px;
}

.nav-card-tip-scenes {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.nav-card-tip-label {
  font-size: 10.5px;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #94a3b8;
}

.nav-card-tip-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.nav-card-tip-chip {
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  font-size: 11px;
  font-weight: 600;
  line-height: 1.45;
  color: var(--accent-text);
  background: var(--accent-soft);
  border: 1px solid var(--accent-ring);
  border-radius: 5px;
}

/* tooltip の下端に小さい三角 (吹き出しのしっぽ) */
.nav-card-tip::after {
  content: "";
  position: absolute;
  top: 100%;
  left: 50%;
  transform: translateX(-50%);
  border: 6px solid transparent;
  border-top-color: #ffffff;
  filter: drop-shadow(0 1px 0 rgba(15, 23, 42, 0.08));
}

.nav-card-wrapper:not(.is-disabled):hover .nav-card-tip,
.nav-card-wrapper:not(.is-disabled):focus-within .nav-card-tip {
  opacity: 1;
  pointer-events: none;
  transform: translateX(-50%) translateY(0);
  transition-delay: 200ms;
}

/* === モーション軽減環境 =============================================== */
@media (prefers-reduced-motion: reduce) {
  .nav-card,
  .nav-card-hero-icon,
  .nav-card-tip {
    transition: none;
  }
  .nav-card:hover:not(:disabled) {
    transform: none;
  }
  .nav-card:hover:not(:disabled) .nav-card-hero-icon {
    transform: none;
  }
  .nav-card-wrapper:not(.is-disabled):hover .nav-card-tip {
    transform: translateX(-50%);
  }
}
</style>
