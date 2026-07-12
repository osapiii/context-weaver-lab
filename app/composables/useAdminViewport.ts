import type { InjectionKey, ComputedRef } from "vue";

/**
 * admin layout のページコンテナ仕様.
 *
 * - 外枠: ヘッダー下の共通マージン (ADMIN_PAGE_MARGIN_CLASS)
 * - 内側: max-width 制限なしのフル幅 (ADMIN_PAGE_CONTENT_CLASS)
 * - ビューポート充填: ADMIN_VIEWPORT_FILL_CLASS (100vh calc は使わない)
 */
export type AdminPageContainerVariant = "default" | "ai" | "flush";

export type AdminPageContainerOverride = {
  variant?: AdminPageContainerVariant;
  fillHeight?: boolean;
};

/** ヘッダー直下〜左右の共通オフセット */
export const ADMIN_PAGE_MARGIN_CLASS =
  "px-6 pt-8 pb-10 lg:px-10 xl:px-12" as const;

/** コンテナ内コンテンツはフル幅 */
export const ADMIN_PAGE_CONTENT_CLASS = "w-full max-w-none min-w-0" as const;

/** 標準ページの縦スタック間隔 (任意で contentClass に上書き可) */
export const ADMIN_PAGE_STACK_CLASS = "space-y-6" as const;

export const ADMIN_AI_PAGE_BG_CLASS = "bg-[#f1f5f3]" as const;

export const ADMIN_VIEWPORT_FILL_CLASS =
  "flex h-full min-h-0 flex-col" as const;

/** カードコレクション画面の縦スタック */
export const ADMIN_COLLECTION_PAGE_STACK_CLASS =
  "flex w-full min-w-0 flex-col gap-6" as const;

/** AIスタジオのジョブカード群と同型のレスポンシブグリッド */
export const ADMIN_COLLECTION_GRID_CLASS =
  "grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" as const;

/** 画面幅に応じて列数が決まるカードグリッド（列数上限なし） */
export const ADMIN_AUTO_FILL_GRID_CLASS =
  "grid grid-cols-[repeat(auto-fill,minmax(min(100%,17.5rem),1fr))] gap-4" as const;

/** 一覧本体を載せる白パネル（マスタ画面のカード枠に近い密度） */
export const ADMIN_COLLECTION_PANEL_CLASS =
  "rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6" as const;

export const ADMIN_PAGE_CONTAINER_KEY: InjectionKey<
  ComputedRef<AdminPageContainerOverride | undefined>
> = Symbol("adminPageContainer");

/** admin layout の main がビューポート充填 (overflow-hidden) か */
export const ADMIN_PAGE_FILL_HEIGHT_KEY: InjectionKey<
  ComputedRef<boolean>
> = Symbol("adminPageFillHeight");
