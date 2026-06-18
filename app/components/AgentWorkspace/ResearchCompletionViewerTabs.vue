<template>
  <section
    class="mx-auto w-full max-w-[min(98vw,1920px)] min-w-0"
    data-testid="research-completion-viewer"
  >
    <div class="mb-2 flex flex-wrap items-center gap-2 rounded-xl border border-neutral-200 bg-white px-3 py-2">
      <EnBadge
        :variant="contextStatus === 'limited' ? 'ai' : 'assistant'"
        size="sm"
      >
        {{ contextStatus === "limited" ? "コンテキスト限定" : "コンテキスト適用済み" }}
      </EnBadge>
      <p class="text-xs text-neutral-600">
        {{ contextDescription }}
      </p>
    </div>
    <UTabs
      v-model="activeTab"
      :items="tabItems"
      class="w-full"
      :ui="{ content: 'pt-3' }"
    >
      <template #report>
        <div class="overflow-hidden rounded-2xl border border-neutral-200 bg-white">
          <ConsultingReportHtmlFrame
            v-if="hasReportHtml"
            :html="resolvedReportHtml"
            :title="reportTitle || 'research.html'"
            :wide="true"
            class="h-[72vh] min-h-[560px]"
          />
          <div
            v-else
            class="flex h-[56vh] min-h-[360px] flex-col items-center justify-center gap-2 px-4 text-center"
          >
            <UIcon
              name="material-symbols:menu-book-outline-rounded"
              class="h-10 w-10 text-neutral-300"
            />
            <p class="text-sm font-semibold text-neutral-700">
              {{ loadingReport ? "レポート本文を読み込み中です" : "レポート本文を表示できません" }}
            </p>
            <p class="text-xs text-neutral-500">
              {{
                loadingReport
                  ? "少し待つと、このタブ内で research.html を表示できます。"
                  : "右のファイル出力から research.html を開き直して同期を待ってください。"
              }}
            </p>
          </div>
        </div>
      </template>

      <template #request>
        <ResearchPlanKioskPanel
          :plan="plan"
          :read-only="true"
          :show-submit-action="false"
        />
      </template>
    </UTabs>
  </section>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import EnBadge from "@components/EnBadge.vue";
import ConsultingReportHtmlFrame from "@components/AgentWorkspace/ConsultingReportHtmlFrame.vue";
import ResearchPlanKioskPanel from "@components/AgentWorkspace/ResearchPlanKioskPanel.vue";
import { fetchArtifactTextContent } from "@utils/artifactDisplayUrl";
import type { ResearchPlanDraft } from "@utils/researchPlanDraft";

const props = withDefaults(
  defineProps<{
    plan: ResearchPlanDraft;
    reportHtml?: string | null;
    reportTitle?: string | null;
    reportStorageGcsPath?: string | null;
    reportContentType?: string | null;
    contextStatus?: "ready" | "limited" | null;
    contextSummary?: string | null;
    contextWarning?: string | null;
  }>(),
  {
    reportHtml: null,
    reportTitle: null,
    reportStorageGcsPath: null,
    reportContentType: "text/html",
    contextStatus: "ready",
    contextSummary: null,
    contextWarning: null,
  },
);

const activeTab = ref<string | number>("0");

const tabItems = [
  {
    label: "レポート",
    slot: "report",
    icon: "material-symbols:menu-book-rounded",
  },
  {
    label: "依頼内容",
    slot: "request",
    icon: "material-symbols:assignment-outline-rounded",
  },
];

const resolvedReportHtml = ref<string>("");
const loadingReport = ref(false);

let loadSeq = 0;
watch(
  () => [props.reportHtml, props.reportStorageGcsPath, props.reportContentType] as const,
  async ([reportHtml, gcsPath, contentType]) => {
    const html = reportHtml?.trim() ?? "";
    if (html) {
      resolvedReportHtml.value = html;
      loadingReport.value = false;
      return;
    }
    const path = gcsPath?.trim() ?? "";
    if (!path) {
      resolvedReportHtml.value = "";
      loadingReport.value = false;
      return;
    }
    const seq = ++loadSeq;
    loadingReport.value = true;
    try {
      const fetched = await fetchArtifactTextContent({
        storageGcsPath: path,
        contentType,
      });
      if (seq !== loadSeq) return;
      resolvedReportHtml.value = fetched?.trim() ?? "";
    } catch {
      if (seq !== loadSeq) return;
      resolvedReportHtml.value = "";
    } finally {
      if (seq === loadSeq) {
        loadingReport.value = false;
      }
    }
  },
  { immediate: true },
);

const hasReportHtml = computed(() => !!resolvedReportHtml.value.trim());

const contextDescription = computed(() => {
  const summary = props.contextSummary?.trim();
  if (summary) return summary;
  const warning = props.contextWarning?.trim();
  if (warning) return warning;
  return props.contextStatus === "limited"
    ? "企業コンテキストが不足しているため、一般論寄りの可能性があります。"
    : "組織コンテキストを使ってレポートを生成しました。";
});
</script>
