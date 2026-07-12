<template>
  <div class="flex h-full flex-col overflow-hidden">
    <!-- ヘッダ -->
    <div class="flex items-center justify-between border-b bg-white px-6 py-2">
      <div class="text-xs font-bold uppercase tracking-wider text-neutral-500">
        生成済みアウトプット
        <span class="ml-2 text-neutral-400">
          ({{ store.artifacts.length }} 件)
        </span>
      </div>
    </div>

    <!-- 本体 -->
    <div class="flex-1 overflow-y-auto px-6 py-4">
      <!-- 空状態: 各 Phase で生成される成果物の skeleton カード -->
      <div v-if="!store.artifacts.length" class="space-y-5">
        <div class="text-center">
          <div
            class="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-purple-100 to-violet-100 ring-1 ring-purple-200"
          >
            <UIcon
              name="material-symbols:hourglass-empty"
              class="h-7 w-7 animate-pulse text-purple-500"
            />
          </div>
          <h4 class="mt-3 text-sm font-bold text-neutral-700">
            まだ生成されたファイルはありません
          </h4>
          <p class="mt-1 text-xs text-neutral-500">
            会話が進むと、ここに以下の成果物が順次出てきます
          </p>
        </div>

        <div class="grid grid-cols-1 gap-2.5">
          <div
            v-for="upcoming in upcomingOutputs"
            :key="upcoming.label"
            class="skeleton-card group flex items-center gap-3 rounded-xl border border-dashed border-neutral-200 bg-white/60 px-4 py-3 backdrop-blur transition hover:border-purple-200 hover:bg-white"
          >
            <div
              class="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-neutral-100 text-neutral-400 transition group-hover:bg-purple-50 group-hover:text-purple-500"
            >
              <UIcon :name="upcoming.icon" class="h-4.5 w-4.5" />
            </div>
            <div class="min-w-0 flex-1">
              <div class="flex items-center gap-1.5">
                <span class="text-sm font-semibold text-neutral-700">
                  {{ upcoming.label }}
                </span>
                <span
                  class="rounded-full bg-purple-50 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-purple-600 ring-1 ring-purple-100"
                >
                  {{ upcoming.phase }}
                </span>
              </div>
              <p class="mt-0.5 truncate text-[11px] text-neutral-500">
                {{ upcoming.desc }}
              </p>
            </div>
            <UIcon
              name="material-symbols:more-horiz"
              class="h-4 w-4 flex-shrink-0 animate-pulse text-neutral-300"
            />
          </div>
        </div>
      </div>

      <div v-else class="space-y-6">
        <!-- メイン: research.html (Notion 風読み物) -->
        <section v-if="primary.length">
          <div
            class="mb-2 text-[11px] font-bold uppercase tracking-wider text-neutral-500"
          >
            リサーチレポート (Notion 風)
          </div>
          <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <ResearchAgentArtifactCard
              v-for="(a, i) in primary"
              :key="`p-${i}-${a.gcsPath}`"
              :artifact="a"
              @select="openPreview"
            />
          </div>
        </section>

        <!-- SoT: research.json -->
        <section v-if="secondary.length">
          <div
            class="mb-2 text-[11px] font-bold uppercase tracking-wider text-neutral-500"
          >
            構造化データ (SoT)
          </div>
          <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <ResearchAgentArtifactCard
              v-for="(a, i) in secondary"
              :key="`s-${i}-${a.gcsPath}`"
              :artifact="a"
              @select="openPreview"
            />
          </div>
        </section>

        <!-- SVG 図解 (各章の挿絵, image kind) -->
        <section v-if="previews.length">
          <div
            class="mb-2 text-[11px] font-bold uppercase tracking-wider text-neutral-500"
          >
            SVG 図解 ({{ previews.length }} 枚)
          </div>
          <div
            class="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-5"
          >
            <button
              v-for="(a, i) in previews"
              :key="`img-${i}-${a.gcsPath}`"
              type="button"
              class="group block overflow-hidden rounded-lg border border-neutral-200 bg-white text-left transition hover:border-purple-400 hover:shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-400"
              @click="openPreview(a)"
            >
              <AdkArtifactImage
                v-if="a.artifactId"
                :artifact-id="a.artifactId"
                :alt="a.name"
                class="block aspect-[4/3] w-full object-cover transition group-hover:scale-105"
              />
              <div
                class="truncate border-t border-neutral-100 px-2 py-1 text-[10px] text-neutral-600"
              >
                {{ a.name }}
              </div>
            </button>
          </div>
        </section>
      </div>
    </div>

    <ResearchAgentArtifactPreviewModal
      v-model:open="previewOpen"
      :artifact="selectedArtifact"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { useResearchAgentStore } from "@stores/researchAgent";
import type { ResearchAgentArtifact } from "@stores/researchAgent";
import AdkArtifactImage from "@components/AgentWorkspace/AdkArtifactImage.vue";

const store = useResearchAgentStore();

const previewOpen = ref(false);
const selectedArtifact = ref<ResearchAgentArtifact | null>(null);

const openPreview = (a: ResearchAgentArtifact) => {
  selectedArtifact.value = a;
  previewOpen.value = true;
};

// 2026-05 大胆刷新:
// primary = research.html (Notion 風読み物 / 一級成果物)
// secondary = research.json (SoT / 設計情報)
// previews = SVG 各章図解 (image kind)
const primary = computed<ResearchAgentArtifact[]>(() =>
  store.artifacts.filter(
    (a) => a.kind === "html" || /research\.html$/i.test(a.name),
  ),
);
const secondary = computed<ResearchAgentArtifact[]>(() =>
  store.artifacts.filter(
    (a) =>
      a.kind === "plan_json" ||
      /research\.json$/i.test(a.name) ||
      a.kind === "other",
  ),
);
const previews = computed<ResearchAgentArtifact[]>(() =>
  store.artifacts.filter((a) => a.kind === "image"),
);

// 空状態で見せる「これから出るもの」リスト
const upcomingOutputs = [
  {
    label: "research.json",
    desc: "リサーチ結果の構造化データ (Phase 1.8 で生成)",
    icon: "material-symbols:account-tree",
    phase: "Phase 2",
  },
  {
    label: "SVG 図解",
    desc: "各章用の図解を Pro モデルで自動生成",
    icon: "material-symbols:auto-awesome-mosaic",
    phase: "Phase 3",
  },
  {
    label: "research.html",
    desc: "Notion 風リッチ読み物 (SVG 内包 / 単一ファイル完結)",
    icon: "material-symbols:menu-book",
    phase: "Phase 4",
  },
];
</script>
