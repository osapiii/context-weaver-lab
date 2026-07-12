<template>
  <!-- eslint-disable-next-line vue/no-v-html -->
  <div
    :class="[
      'en-aistudio-prose',
      `en-aistudio-prose--${variant}`,
      { 'is-compact': compact },
    ]"
    @click="onContainerClick"
    v-html="renderedHtml"
  />
</template>

<script setup lang="ts">
/**
 * EN AIstudio 共通 Markdown レンダラー.
 *
 * アプリ内のあらゆる Markdown 表示 (AI チャット返答 / ヘルプ / ドキュメント
 * プレビュー / シミュレーター結果) を 1 つに統合するためのコンポーネント.
 *
 * 設計:
 *  - 描画は `utils/markdown.ts` の共有 markdown-it インスタンス経由
 *  - スタイルは `assets/css/en-aistudio-prose.css` の `.en-aistudio-prose` グローバル class
 *  - `variant` で「見出し縦バー色」だけ AI 役割ごとに切替 (本文は全 variant 共通)
 *  - `enableRouterLinks` で `route:`/`launcher:` リンクを SPA 内 navigation
 *    に変換 (EN AIstudio Assistant など、AI 誘導リンクを使う場面で有効化)
 *  - `compact` でチャットバブル内向けに上下マージンを詰める
 */
import { convertHelpTablesToCards, convertMarkdownToHtml } from "@utils/markdown";

type Variant = "default" | "ai" | "research" | "analysis" | "help";
type LauncherKey =
  | "business-consultation"
  | "writing"
  | "sheet"
  | "image";

interface Props {
  markdownText: string;
  /** 見出し縦バー色 (本文は全 variant 共通) */
  variant?: Variant;
  /** `route:`/`launcher:` リンクを SPA 内遷移に変換するか */
  enableRouterLinks?: boolean;
  /** チャットバブル内など、上下マージンを詰める */
  compact?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  variant: "default",
  enableRouterLinks: true,
  compact: false,
});

const renderedHtml = computed(() => {
  const html = convertMarkdownToHtml(props.markdownText ?? "");
  return props.variant === "help" ? convertHelpTablesToCards(html) : html;
});

// 必要なときだけストアを掴む (enableRouterLinks=false の場合は何も操作しない)
const router = useRouter();
const enAiStudioAssistant = useEnAiStudioAssistantStore();

const onContainerClick = (event: MouseEvent): void => {
  if (!props.enableRouterLinks) return;
  const target = event.target as HTMLElement | null;
  if (!target) return;

  const anchor = target.closest<HTMLAnchorElement>(
    "a[data-router-route], a[data-router-launcher]"
  );
  if (!anchor) return;

  event.preventDefault();

  const routeName = anchor.dataset.routerRoute;
  const launcherKey = anchor.dataset.routerLauncher as LauncherKey | undefined;

  if (routeName) {
    router.push({ name: routeName });
    enAiStudioAssistant.close();
    return;
  }

  if (launcherKey) {
    switch (launcherKey) {
      case "business-consultation":
        enAiStudioAssistant.clear();
        enAiStudioAssistant.open();
        return;
      case "writing":
      case "sheet":
      case "image":
        enAiStudioAssistant.clear();
        enAiStudioAssistant.presetMode(launcherKey);
        enAiStudioAssistant.open();
        return;
    }
  }
};
</script>
