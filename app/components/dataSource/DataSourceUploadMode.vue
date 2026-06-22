<template>
  <div class="space-y-6 relative">
    <!-- 紙吹雪オーバーレイ (subtle) -->
    <div
      v-if="confettiActive"
      class="pointer-events-none fixed inset-0 z-50 overflow-hidden"
      aria-hidden="true"
    >
      <span
        v-for="i in 12"
        :key="`confetti-${confettiKey}-${i}`"
        class="confetti-piece"
        :style="confettiStyle(i)"
      >
        {{ confettiEmojis[i % confettiEmojis.length] }}
      </span>
    </div>

    <!-- ペンギン + 4 系統 (A/B/C/D) 2x2 グリッド -->
    <div class="relative space-y-5">
      <!-- ペンギン: モバイルは上、lg 以上はグリッド左にコンパクト配置 -->
      <div class="flex justify-center lg:hidden">
        <PenguinCompanion
          :document-count="documents.length"
          :indexed-count="statsIndexed"
          :is-dragging="isDragging"
          :is-uploading="isUploading"
          @start-conversation="aiChatPanelStore.open()"
        />
      </div>

      <div class="grid grid-cols-1 gap-5 lg:grid-cols-[160px_minmax(0,1fr)] lg:items-start">
        <div class="hidden lg:flex justify-center lg:sticky lg:top-6">
          <PenguinCompanion
            :document-count="documents.length"
            :indexed-count="statsIndexed"
            :is-dragging="isDragging"
            :is-uploading="isUploading"
            @start-conversation="aiChatPanelStore.open()"
          />
        </div>

        <div class="relative min-w-0 space-y-5">
      <!-- ============================================================ -->
      <!-- Stats Hero — ペンギンが覚えた知識のサマリ                       -->
      <!-- ============================================================ -->
      <section
        v-if="statsTotal > 0"
        class="stats-hero relative overflow-hidden rounded-xl px-4 py-2"
      >
        <!-- 装飾: 角丸の中で右上に薄い光彩 -->
        <div class="absolute inset-0 pointer-events-none opacity-50">
          <div class="absolute -top-12 -right-8 w-40 h-40 rounded-full bg-purple-200/40 blur-3xl" />
        </div>
        <div class="relative flex items-center gap-4 text-[11px]">
          <!-- 主数字 (1 行に圧縮): ✨ AI に教えた知識 199 -->
          <div class="flex items-baseline gap-1.5 flex-shrink-0">
            <UIcon name="i-heroicons-sparkles" class="w-3 h-3 text-purple-600" />
            <span class="text-[10px] uppercase tracking-[0.14em] font-semibold text-purple-700/80 dark:text-purple-400/80">
              AI に教えた知識
            </span>
            <span class="text-lg font-extrabold text-purple-700 dark:text-purple-300 tracking-tight tabular-nums leading-none">
              {{ statsIndexed.toLocaleString() }}
            </span>
            <span class="text-[10px] text-gray-500 font-medium">件</span>
          </div>

          <!-- 区切り -->
          <span class="h-4 w-px bg-purple-200/60 dark:bg-purple-700/40 flex-shrink-0" />

          <!-- 索引率: progress bar + % を 1 行に -->
          <div class="flex items-center gap-2 flex-1 min-w-0">
            <span class="text-[10px] font-semibold text-gray-500 flex-shrink-0">AI 索引率</span>
            <div class="flex-1 min-w-[60px] h-1.5 rounded-full bg-purple-100/70 dark:bg-purple-900/30 overflow-hidden">
              <div
                class="h-full rounded-full bg-gradient-to-r from-purple-400 via-violet-400 to-purple-500 transition-[width] duration-700 ease-out"
                :style="{ width: `${indexedRate}%` }"
              />
            </div>
            <span class="tabular-nums font-bold text-gray-700 dark:text-gray-300 text-[10px] flex-shrink-0">{{ indexedRate }}%</span>
          </div>

          <!-- 内訳 chips: 登録済み / 登録待ち / 閲覧のみ を inline -->
          <div class="flex items-center gap-2.5 text-[10px] text-gray-500 flex-shrink-0">
            <span class="inline-flex items-center gap-1">
              <span class="w-1.5 h-1.5 rounded-full bg-purple-500" />
              {{ statsIndexed.toLocaleString() }}
            </span>
            <span
              v-if="statsPending > 0"
              class="inline-flex items-center gap-1 text-rose-600 dark:text-rose-400 font-semibold"
              title="登録待ち"
            >
              <UIcon name="i-heroicons-exclamation-triangle" class="w-2.5 h-2.5" />
              {{ statsPending }}
            </span>
            <span
              v-if="statsNonIndexable > 0"
              class="inline-flex items-center gap-1 text-gray-400"
              title="動画 / 音声 (AI 索引の対象外)"
            >
              <UIcon name="i-heroicons-photo" class="w-2.5 h-2.5" />
              {{ statsNonIndexable }}
            </span>
          </div>

          <!-- 区切り -->
          <span class="h-4 w-px bg-purple-200/60 dark:bg-purple-700/40 flex-shrink-0" />

          <!-- 右: 全件 + 確認導線 -->
          <button
            type="button"
            class="group/total flex items-center gap-1.5 flex-shrink-0 text-[10px] text-gray-500 transition-colors hover:text-purple-700 dark:hover:text-purple-400"
            @click="emit('switch-to-view')"
          >
            <span class="uppercase tracking-[0.14em] font-semibold">
              全 {{ statsTotal.toLocaleString() }} 件
            </span>
            <span class="font-bold text-purple-700 dark:text-purple-400 inline-flex items-center gap-0.5 group-hover/total:gap-1.5 transition-[gap]">
              知識を確認
              <UIcon name="i-heroicons-arrow-right" class="w-3 h-3" />
            </span>
          </button>
        </div>
      </section>

      <!-- ============================================================ -->
      <!-- A / B / C / D — 2x2 タイル grid                                 -->
      <!-- ============================================================ -->
      <div class="grid grid-cols-1 items-stretch gap-4 md:grid-cols-2">
        <!-- A. ファイルを投げ込んで教える -->
        <IngestMethodCard
          title="ファイルを投げ込んで教える"
          subtitle="PDF / Excel / 画像など、ドラッグ＆ドロップで一括投入"
          icon="i-heroicons-arrow-down-tray"
          tone="purple"
          layout="tile"
        >
          <div
            class="dropzone group relative min-h-[220px] flex-1 cursor-pointer overflow-hidden rounded-2xl bg-white transition-[box-shadow,transform] duration-300 dark:bg-gray-900"
            :class="[
              isDragging
                ? 'is-dragging shadow-[0_16px_40px_-12px_rgba(139,92,246,0.45),0_0_0_3px_rgba(139,92,246,0.2)] ring-2 ring-purple-500'
                : 'shadow-sm ring-1 ring-purple-200/80 dark:ring-purple-800 hover:shadow-md hover:ring-purple-300',
            ]"
            @click="onZoneClick"
            @dragenter.prevent="onDragEnter"
            @dragover.prevent="onDragOver"
            @dragleave.prevent="onDragLeave"
            @drop.prevent="onDrop"
          >
            <div
              v-if="!isDragging && !isUploading"
              class="idle-pulse pointer-events-none absolute left-1/2 top-[42%] h-24 w-24 -translate-x-1/2 -translate-y-1/2 rounded-full bg-purple-300/40"
              aria-hidden="true"
            />

            <input
              ref="fileInputRef"
              type="file"
              multiple
              class="hidden"
              @change="onFilePicked"
            >

            <div
              class="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center"
            >
              <div
                class="relative rounded-xl bg-white p-3 shadow-sm ring-1 ring-purple-100 transition-transform duration-300 dark:bg-gray-800 dark:ring-purple-900/40"
                :class="isDragging ? 'scale-110 rotate-2' : 'group-hover:scale-105'"
              >
                <UIcon
                  :name="
                    isUploading
                      ? 'i-heroicons-arrow-path'
                      : 'i-heroicons-arrow-down-tray'
                  "
                  class="h-8 w-8 text-purple-500"
                  :class="isUploading ? 'animate-spin' : ''"
                />
              </div>

              <div class="space-y-1">
                <p class="text-sm font-bold text-gray-900 dark:text-white">
                  {{
                    isDragging
                      ? "ここに離してください"
                      : isUploading
                        ? `教えている途中... (${uploadingCount} 件)`
                        : "ここにドロップ"
                  }}
                </p>
                <p class="text-xs text-gray-500 dark:text-gray-400">
                  請求書・Excel・PDF・CSV など
                </p>
              </div>

              <div class="flex flex-wrap items-center justify-center gap-1.5">
                <span
                  v-for="chip in fileFormatChips"
                  :key="chip.label"
                  class="inline-flex items-center gap-1 rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-medium text-gray-600 ring-1 ring-gray-200/80 dark:bg-gray-800/90 dark:text-gray-300 dark:ring-gray-700"
                >
                  <UIcon :name="chip.icon" class="h-3 w-3 text-purple-600" />
                  {{ chip.label }}
                </span>
              </div>

              <p class="text-[11px] text-gray-400">
                またはクリックで選択
              </p>

              <div
                v-if="isUploading"
                class="flex items-center gap-2 rounded-full bg-white px-3 py-1 text-xs font-medium text-gray-600 shadow-sm ring-1 ring-gray-900/[0.04] dark:bg-gray-800 dark:text-gray-300"
              >
                <span class="tabular-nums">{{ uploadedCount }} / {{ totalUploadCount }}</span>
                <span class="text-gray-400">完了</span>
              </div>
            </div>
          </div>
        </IngestMethodCard>

        <!-- B. Web ページの URL -->
        <IngestMethodCard
          title="Web ページの URL を登録"
          subtitle="サイトを丸ごとクロール"
          icon="i-heroicons-globe-alt"
          tone="violet"
          layout="tile"
        >
          <WebPageIngestSetupCard
            :file-space-id="fileSpaceId"
            @completed="onIngestCompleted"
          />
        </IngestMethodCard>

        <!-- C. Google Drive -->
        <IngestMethodCard
          title="Google Drive から同期"
          subtitle="フォルダごと一括（オフィス資料向け）"
          icon="logos:google-drive"
          tone="blue"
          layout="tile"
        >
          <GoogleDriveSetupCard :file-space-id="fileSpaceId" />
        </IngestMethodCard>

        <!-- D. クリップボード -->
        <IngestMethodCard
          title="クリップボードから貼り付け"
          subtitle="テキスト・スクショ・コードをそのまま投入"
          icon="i-heroicons-clipboard-document"
          tone="sky"
          layout="tile"
        >
          <div class="flex min-h-0 flex-1 flex-col">
            <UTextarea
              v-model="clipboardText"
              placeholder="ここにペースト (Ctrl+V / ⌘V)…"
              :rows="3"
              :disabled="!fileSpaceId"
              autoresize
              class="w-full flex-1"
              @paste="onClipboardPaste"
            />
            <div
              v-if="pastedImages.length > 0"
              class="mt-2 flex flex-wrap items-center gap-2"
            >
              <div
                v-for="(img, idx) in pastedImages"
                :key="`pasted-${idx}-${img.file.name}`"
                class="group/img relative h-12 w-12 overflow-hidden rounded-lg ring-1 ring-gray-200 dark:ring-gray-700"
              >
                <img
                  :src="img.previewUrl"
                  :alt="img.file.name"
                  class="h-full w-full object-cover"
                >
                <button
                  type="button"
                  class="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors group-hover/img:bg-black/40"
                  :title="`${img.file.name} を削除`"
                  @click="removePastedImage(idx)"
                >
                  <UIcon
                    name="i-heroicons-x-mark"
                    class="h-4 w-4 text-white opacity-0 transition-opacity group-hover/img:opacity-100"
                  />
                </button>
              </div>
            </div>
            <div
              class="mt-2 flex items-center gap-2 rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-700 ring-1 ring-gray-900/[0.04] dark:bg-gray-800/60 dark:text-gray-300 dark:ring-white/10"
              role="status"
            >
              <UIcon
                name="i-heroicons-clipboard-document"
                class="h-4 w-4 shrink-0 text-gray-500"
              />
              <span class="min-w-0 flex-1 leading-snug">{{ clipboardStatusLabel }}</span>
            </div>
            <div class="mt-auto flex justify-end pt-1">
              <EnButton
                variant="hero"
                color="primary"
                size="sm"
                leading-icon="i-heroicons-sparkles"
                custom-class="shrink-0"
                :disabled="!fileSpaceId || !canSubmitClipboard"
                @click="submitClipboard"
              >
                AI に教える
              </EnButton>
            </div>
          </div>
        </IngestMethodCard>
      </div>
      <!-- /A/B/C/D grid -->

        </div>
      </div>
    </div>
    <!-- /ペンギン + 2x2 grid -->

    <!-- 最近教えた知識: hmhm 風シームレス横スクロール
         確認画面のカードに準じたサムネイル領域 + メタを持つ -->
    <div v-if="documents.length > 0" class="space-y-3">
      <div class="flex items-center justify-between">
        <h3
          class="text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-400 flex items-center gap-2"
        >
          <span class="h-px w-4 bg-gray-300" />
          最近教えた知識
          <span class="text-gray-400 tabular-nums">
            ({{ documents.length }} 件)
          </span>
        </h3>
        <button
          type="button"
          class="group/link text-xs text-purple-600 hover:text-purple-700 font-medium flex items-center gap-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-400 focus-visible:ring-offset-2 rounded"
          @click="$emit('switch-to-view')"
        >
          すべて見る
          <UIcon
            name="i-heroicons-arrow-right"
            class="w-3 h-3 transition-transform group-hover/link:translate-x-0.5"
          />
        </button>
      </div>

      <!-- マーキー: カードが流れていく / 左右フェード + hover で停止 -->
      <div class="marquee group/marquee">
        <div class="marquee-track">
          <!-- 元の配列 + 同じ配列をもう一回 (シームレスループ用) -->
          <button
            v-for="(doc, idx) in marqueeDocuments"
            :key="`marquee-${idx}-${doc.name || doc.displayName || ''}`"
            type="button"
            class="marquee-card group/card relative w-[200px] flex-shrink-0 rounded-2xl bg-white dark:bg-gray-900 ring-1 ring-gray-900/[0.06] dark:ring-white/10 shadow-[0_2px_8px_-2px_rgba(15,23,42,0.06)] hover:shadow-[0_10px_28px_-8px_rgba(139,92,246,0.22)] hover:ring-purple-200 hover:-translate-y-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-400 focus-visible:ring-offset-2 transition-all duration-200 overflow-hidden text-left"
            :title="doc.displayName || extractFilename(doc.name) || ''"
            @click="$emit('switch-to-view')"
          >
            <!-- 上部: 画像は GCS サムネ / PDF は1ページ目 / 他はタイプアイコン -->
            <div class="relative h-[88px] w-full overflow-hidden">
              <ConsultationKnowledgeListThumb
                :document="doc"
                size="banner"
              />
              <span
                class="absolute top-2 right-2 z-[1] text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded backdrop-blur-sm"
                :class="formatInfo(doc).labelClass"
              >
                {{ formatInfo(doc).label }}
              </span>
            </div>
            <!-- 下部: ファイル名 + 時刻 -->
            <div class="px-3 py-2.5 space-y-1">
              <div
                class="text-xs font-bold text-gray-800 dark:text-gray-200 truncate leading-snug"
              >
                {{ doc.displayName || extractFilename(doc.name) }}
              </div>
              <div class="text-[10px] text-gray-400 tabular-nums">
                {{ formatRelativeTime(doc.createTime) }}
              </div>
            </div>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { useToast } from "#imports";
import log from "@utils/logger";
import EnButton from "@components/EnButton.vue";
import ConsultationKnowledgeListThumb from "@components/AgentWorkspace/ConsultationKnowledgeListThumb.vue";
import PenguinCompanion from "@components/dataSource/PenguinCompanion.vue";
import WebPageIngestSetupCard from "@components/dataSource/WebPageIngestSetupCard.vue";
import GoogleDriveSetupCard from "@components/dataSource/GoogleDriveSetupCard.vue";
import { useGeminiFileSpaceOperatorStore } from "@stores/geminiFileSpaceOperator";
import { useGlobalLoadingStore } from "@stores/global-loading";
import { useOrganizationStore } from "@stores/organization";
import { useSpaceStore } from "@stores/space";
import { useEnAiStudioAssistantStore } from "@stores/enAiStudioAssistant";
import type { Document } from "@models/geminiFileSpaceRequest";

const props = defineProps<{
  fileSpaceId: string | null;
  documents: Document[];
  isLoadingDocuments: boolean;
}>();

const emit = defineEmits<{
  refresh: [];
  "switch-to-view": [];
}>();

// === Stats Hero 用カウンタ (DataSourceViewMode と同じロジック) ===
const _isPlaceholderName = (d: Document): boolean => {
  const n = d.name || "";
  if (!n) return true;
  return (
    n.includes("/documents/drive_") || n.includes("/documents/webcrawl_img_")
  );
};

const _isIndexableType = (d: Document): boolean => {
  const mime = (d.mimeType || "").toLowerCase();
  const name = (d.displayName || d.name || "").toLowerCase();
  // 動画/音声は Agent Search 非対応
  if (mime.startsWith("video/")) return false;
  if (mime.startsWith("audio/")) return false;
  if (/\.(webp|svg|heic|heif|avif)$/.test(name)) return false;
  if (/\.(mp4|mov|avi|mkv|webm|m4v)$/.test(name)) return false;
  if (/\.(mp3|wav|m4a|ogg|flac|aac)$/.test(name)) return false;
  return true;
};

const statsIndexed = computed(
  () => props.documents.filter((d) => !_isPlaceholderName(d)).length
);
const statsNonIndexable = computed(
  () =>
    props.documents.filter(
      (d) => _isPlaceholderName(d) && !_isIndexableType(d)
    ).length
);
const statsPending = computed(
  () =>
    props.documents.filter(
      (d) => _isPlaceholderName(d) && _isIndexableType(d)
    ).length
);
const statsTotal = computed(() => props.documents.length);
// AI 登録率 (0-100, 整数) — 分母は indexable のみ (画像等を分母に入れない)
const indexedRate = computed(() => {
  const denom = statsIndexed.value + statsPending.value;
  if (denom === 0) return 0;
  return Math.round((statsIndexed.value / denom) * 100);
});

// マーキー用: createTime 降順で並べた配列をシームレスループのために 2 倍にする
//   (track 全体を translateX(-50%) で動かして 1 周分が見えなくなった瞬間に元位置に戻る)
const marqueeDocuments = computed(() => {
  const sorted = [...props.documents].sort((a, b) => {
    const ta = a.createTime || "";
    const tb = b.createTime || "";
    return tb.localeCompare(ta);
  });
  // 表示は最大 24 件まで (極端に多いと DOM が重くなる)
  const capped = sorted.slice(0, 24);
  // シームレスループ用に 2 倍にする
  return [...capped, ...capped];
});

const toast = useToast();
const fileSpaceStore = useGeminiFileSpaceOperatorStore();
const organizationStore = useOrganizationStore();
const spaceStore = useSpaceStore();
const globalLoading = useGlobalLoadingStore();
const aiChatPanelStore = useEnAiStudioAssistantStore();

const fileFormatChips = [
  { label: "PDF", icon: "i-heroicons-document-text" },
  { label: "Excel", icon: "i-heroicons-table-cells" },
  { label: "画像", icon: "i-heroicons-photo" },
  { label: "CSV", icon: "i-heroicons-document-chart-bar" },
] as const;

// マウント時に「永久 loading 状態」をリセット (旧セッションの残骸対策)
onMounted(() => {
  globalLoading.stopLoading();
});

const fileInputRef = ref<HTMLInputElement | null>(null);
const isDragging = ref(false);
const dragCounter = ref(0);
const uploadingCount = ref(0);
const totalUploadCount = ref(0);
const uploadedCount = ref(0);
// === クリップボード貼り付け state ===
type PastedImage = { file: File; previewUrl: string };
const clipboardText = ref("");
const pastedImages = ref<PastedImage[]>([]);

const clipboardStatusLabel = computed(() => {
  if (pastedImages.value.length > 0 && clipboardText.value.trim()) {
    return `画像 ${pastedImages.value.length} 枚 + テキスト`;
  }
  if (pastedImages.value.length > 0) {
    return `画像 ${pastedImages.value.length} 枚`;
  }
  if (clipboardText.value.trim()) {
    return `${clipboardText.value.length.toLocaleString()} 文字`;
  }
  return "テキストまたは画像をペースト";
});

const canSubmitClipboard = computed(
  () => clipboardText.value.trim().length > 0 || pastedImages.value.length > 0
);

// 紙吹雪
const confettiActive = ref(false);
const confettiKey = ref(0);
const confettiEmojis = ["✨", "🎉", "💫"];
const triggerConfetti = () => {
  confettiKey.value += 1;
  confettiActive.value = true;
  setTimeout(() => (confettiActive.value = false), 1600);
};
const confettiStyle = (_i: number) => {
  const left = Math.random() * 100;
  const delay = Math.random() * 0.3;
  const duration = 1.4 + Math.random() * 0.4;
  const size = 1 + Math.random() * 0.6;
  return {
    left: `${left}%`,
    animationDelay: `${delay}s`,
    animationDuration: `${duration}s`,
    fontSize: `${size}rem`,
  };
};

const isUploading = computed(() => uploadingCount.value > 0);

const extractFilename = (name: string | null): string => {
  if (!name) return "(no name)";
  const parts = name.split("/");
  return parts[parts.length - 1] || name;
};

// ファイル種別の判定 (mimeType を優先、フォールバックで拡張子)
type FormatKey =
  | "pdf"
  | "excel"
  | "csv"
  | "image"
  | "word"
  | "ppt"
  | "md"
  | "web"
  | "default";

const detectFormat = (doc: Document): FormatKey => {
  if (doc.subCategory === "entryUrl" || doc.subCategory === "urlMarkdown")
    return "web";
  const mime = (doc.mimeType || "").toLowerCase();
  if (mime.includes("pdf")) return "pdf";
  if (mime.includes("spreadsheet") || mime.includes("excel")) return "excel";
  if (mime.includes("csv")) return "csv";
  if (mime.startsWith("image/")) return "image";
  if (mime.includes("word") || mime.includes("wordprocessingml")) return "word";
  if (mime.includes("powerpoint") || mime.includes("presentation"))
    return "ppt";
  if (mime.includes("markdown")) return "md";
  const lower = (doc.displayName || doc.name || "").toLowerCase();
  if (lower.endsWith(".pdf")) return "pdf";
  if (lower.endsWith(".xlsx") || lower.endsWith(".xls")) return "excel";
  if (lower.endsWith(".csv")) return "csv";
  if (/\.(png|jpe?g|gif|webp|svg)$/.test(lower)) return "image";
  if (lower.endsWith(".docx") || lower.endsWith(".doc")) return "word";
  if (lower.endsWith(".pptx") || lower.endsWith(".ppt")) return "ppt";
  if (lower.endsWith(".md")) return "md";
  return "default";
};

const fileIcons = useFileIcons();

const formatInfo = (doc: Document) => {
  switch (detectFormat(doc)) {
    case "pdf":
      return {
        label: "PDF",
        icon: "i-heroicons-document-text",
        vscodeIcon: fileIcons.pdf,
        iconColor: "text-rose-500",
        iconBg: "bg-rose-50/70 dark:bg-rose-900/20",
        accentBar: "bg-rose-400",
        labelClass:
          "bg-white/85 text-rose-700 ring-1 ring-rose-200 dark:bg-rose-900/40 dark:text-rose-300",
      };
    case "excel":
      return {
        label: "EXCEL",
        icon: "i-heroicons-table-cells",
        vscodeIcon: fileIcons.excel,
        iconColor: "text-emerald-600",
        iconBg: "bg-emerald-50/70 dark:bg-emerald-900/20",
        accentBar: "bg-emerald-400",
        labelClass:
          "bg-white/85 text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-300",
      };
    case "csv":
      return {
        label: "CSV",
        icon: "i-heroicons-table-cells",
        vscodeIcon: fileIcons.csv,
        iconColor: "text-emerald-600",
        iconBg: "bg-emerald-50/70 dark:bg-emerald-900/20",
        accentBar: "bg-emerald-400",
        labelClass:
          "bg-white/85 text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-300",
      };
    case "image":
      return {
        label: "画像",
        icon: "i-heroicons-photo",
        vscodeIcon: fileIcons.image,
        iconColor: "text-violet-500",
        iconBg: "bg-violet-50/70 dark:bg-violet-900/20",
        accentBar: "bg-violet-400",
        labelClass:
          "bg-white/85 text-violet-700 ring-1 ring-violet-200 dark:bg-violet-900/40 dark:text-violet-300",
      };
    case "word":
      return {
        label: "WORD",
        icon: "i-heroicons-document",
        vscodeIcon: fileIcons.word,
        iconColor: "text-blue-500",
        iconBg: "bg-blue-50/70 dark:bg-blue-900/20",
        accentBar: "bg-blue-400",
        labelClass:
          "bg-white/85 text-blue-700 ring-1 ring-blue-200 dark:bg-blue-900/40 dark:text-blue-300",
      };
    case "ppt":
      return {
        label: "PPT",
        icon: "i-heroicons-presentation-chart-bar",
        vscodeIcon: fileIcons.powerpoint,
        iconColor: "text-violet-500",
        iconBg: "bg-violet-50/70 dark:bg-violet-900/20",
        accentBar: "bg-violet-400",
        labelClass:
          "bg-white/85 text-violet-700 ring-1 ring-violet-200 dark:bg-violet-900/40 dark:text-violet-300",
      };
    case "md":
      return {
        label: "MD",
        icon: "i-heroicons-document-text",
        vscodeIcon: fileIcons.file,
        iconColor: "text-slate-500",
        iconBg: "bg-slate-50/70 dark:bg-slate-800",
        accentBar: "bg-slate-400",
        labelClass:
          "bg-white/85 text-slate-600 ring-1 ring-slate-200 dark:bg-slate-800 dark:text-slate-300",
      };
    case "web":
      return {
        label: "WEB",
        icon: "i-heroicons-globe-alt",
        vscodeIcon: "vscode-icons:file-type-html",
        iconColor: "text-sky-500",
        iconBg: "bg-sky-50/70 dark:bg-sky-900/20",
        accentBar: "bg-sky-400",
        labelClass:
          "bg-white/85 text-sky-700 ring-1 ring-sky-200 dark:bg-sky-900/40 dark:text-sky-300",
      };
    default:
      return {
        label: "FILE",
        icon: "i-heroicons-document",
        vscodeIcon: fileIcons.file,
        iconColor: "text-gray-500",
        iconBg: "bg-gray-100/70 dark:bg-gray-800",
        accentBar: "bg-gray-300",
        labelClass:
          "bg-white/85 text-gray-600 ring-1 ring-gray-200 dark:bg-gray-800 dark:text-gray-300",
      };
  }
};

// 相対時間表示 ("3 分前" "1 時間前" "M/D" 等)
const formatRelativeTime = (iso: string | null | undefined): string => {
  if (!iso) return "";
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return "";
  const diff = Date.now() - t;
  const min = Math.floor(diff / 60_000);
  if (min < 1) return "たった今";
  if (min < 60) return `${min} 分前`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} 時間前`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day} 日前`;
  const d = new Date(t);
  return `${d.getMonth() + 1}/${d.getDate()}`;
};

// === D&D ハンドラ ===
const onZoneClick = () => {
  if (!props.fileSpaceId) {
    toast.add({ title: "AI 作業スペースを準備中です", color: "warning" });
    return;
  }
  fileInputRef.value?.click();
};
const onDragEnter = (_e: DragEvent) => {
  dragCounter.value += 1;
  isDragging.value = true;
};
const onDragOver = (_e: DragEvent) => {
  isDragging.value = true;
};
const onDragLeave = (_e: DragEvent) => {
  dragCounter.value -= 1;
  if (dragCounter.value <= 0) {
    dragCounter.value = 0;
    isDragging.value = false;
  }
};
const onDrop = (e: DragEvent) => {
  dragCounter.value = 0;
  isDragging.value = false;
  const files = Array.from(e.dataTransfer?.files || []);
  if (files.length === 0) return;
  void uploadFiles(files);
};
const onFilePicked = (e: Event) => {
  const input = e.target as HTMLInputElement;
  const files = Array.from(input.files || []);
  if (files.length === 0) return;
  void uploadFiles(files);
  input.value = "";
};

// === ファイル upload ===
const uploadFiles = async (files: File[]) => {
  if (!props.fileSpaceId) {
    toast.add({ title: "AI 作業スペースが未準備です", color: "error" });
    return;
  }
  const orgId = organizationStore.getLoggedInOrganizationId;
  const spaceId = spaceStore.selectedSpace?.id;
  if (!orgId || !spaceId) {
    toast.add({ title: "組織/スペース未選択", color: "error" });
    return;
  }

  uploadingCount.value += files.length;
  totalUploadCount.value += files.length;

  const successFiles: string[] = [];
  const failedFiles: string[] = [];

  for (const file of files) {
    try {
      const result = await fileSpaceStore.uploadFileToFileSpace({
        storeId: props.fileSpaceId,
        file,
        mimeType: file.type || undefined,
        organizationId: orgId,
        spaceId,
      });
      if (result) {
        successFiles.push(file.name);
      } else {
        failedFiles.push(file.name);
      }
    } catch (e) {
      log("ERROR", "uploadFiles failed", { fileName: file.name, error: e });
      failedFiles.push(file.name);
    } finally {
      uploadedCount.value += 1;
      uploadingCount.value -= 1;
    }
  }

  if (uploadingCount.value === 0) {
    uploadedCount.value = 0;
    totalUploadCount.value = 0;
    globalLoading.stopLoading();
  }

  if (successFiles.length > 0) {
    triggerConfetti();
    toast.add({
      title: `${successFiles.length} 件、AI に教えました`,
      description: "AI がこの内容を参照できるようになりました",
      color: "success",
    });
    emit("refresh");
  }
  if (failedFiles.length > 0) {
    toast.add({
      title: `${failedFiles.length} 件、教えるのに失敗`,
      description: failedFiles.join(", "),
      color: "error",
    });
  }
};

const onIngestCompleted = () => {
  emit("refresh");
};

// === クリップボード貼り付け ハンドラ ===
// タイムスタンプ (YYYYMMDD-HHmmss) — 同時ペーストで重複しないよう ms も足す
const clipboardTimestamp = (): string => {
  const d = new Date();
  const pad = (n: number, w = 2) => String(n).padStart(w, "0");
  return (
    `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}` +
    `-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}` +
    `-${pad(d.getMilliseconds(), 3)}`
  );
};

// 貼り付けイベントから画像を抽出。テキストは v-model がそのまま受ける.
const onClipboardPaste = (e: ClipboardEvent) => {
  const items = e.clipboardData?.items;
  if (!items) return;
  let imageAdded = false;
  for (let i = 0; i < items.length; i += 1) {
    const item = items[i];
    if (!item || item.kind !== "file") continue;
    if (!item.type.startsWith("image/")) continue;
    const file = item.getAsFile();
    if (!file) continue;
    const ext = item.type.split("/")[1] || "png";
    const renamed = new File(
      [file],
      `clipboard-${clipboardTimestamp()}.${ext}`,
      { type: item.type }
    );
    pastedImages.value.push({
      file: renamed,
      previewUrl: URL.createObjectURL(renamed),
    });
    imageAdded = true;
  }
  // 画像をペーストしたとき textarea に "[object File]" 等が入らないよう preventDefault.
  // ただしテキスト+画像 (HTML 形式のリッチコンテンツ) のケースでテキストも欲しいので
  // テキストが含まれていなければ preventDefault する.
  if (imageAdded) {
    const hasText = (e.clipboardData?.getData("text/plain") || "").length > 0;
    if (!hasText) e.preventDefault();
  }
};

const removePastedImage = (idx: number) => {
  const removed = pastedImages.value.splice(idx, 1)[0];
  if (removed) URL.revokeObjectURL(removed.previewUrl);
};

const submitClipboard = async () => {
  if (!props.fileSpaceId) {
    toast.add({ title: "AI 作業スペースを準備中です", color: "warning" });
    return;
  }
  if (!canSubmitClipboard.value) return;

  const files: File[] = pastedImages.value.map((p) => p.file);

  const text = clipboardText.value.trim();
  if (text) {
    // ファイル名はテキスト先頭 (記号除去) + タイムスタンプ. テキストが長文/英文なら最初の語句.
    const firstLine = text.split(/\r?\n/)[0] || "";
    const safeStem = firstLine
      .slice(0, 40)
      .replace(/[\\/:*?"<>|]/g, "")
      .trim();
    const stem = safeStem || "clipboard";
    const fileName = `${stem}-${clipboardTimestamp()}.txt`;
    files.push(new File([text], fileName, { type: "text/plain" }));
  }

  // クリア (URL.revokeObjectURL でメモリ解放). アップロードは進行中の独立処理.
  const urlsToRevoke = pastedImages.value.map((p) => p.previewUrl);
  clipboardText.value = "";
  pastedImages.value = [];
  setTimeout(() => urlsToRevoke.forEach((u) => URL.revokeObjectURL(u)), 0);

  await uploadFiles(files);
};

// アンマウント時にプレビュー URL を解放
onBeforeUnmount(() => {
  pastedImages.value.forEach((p) => URL.revokeObjectURL(p.previewUrl));
});
</script>

<style scoped>
/* === Stats Hero (ペンギンが覚えた件数のサマリ) === */
.stats-hero {
  background:
    linear-gradient(135deg, rgba(254, 243, 199, 0.6) 0%, rgba(255, 251, 235, 0.4) 100%);
  box-shadow:
    0 1px 2px rgba(168, 85, 247, 0.06),
    inset 0 0 0 1px rgba(168, 85, 247, 0.18);
}

:root.dark .stats-hero,
.dark .stats-hero {
  background:
    linear-gradient(135deg, rgba(120, 53, 15, 0.25) 0%, rgba(69, 26, 3, 0.15) 100%);
  box-shadow:
    0 1px 2px rgba(0, 0, 0, 0.2),
    inset 0 0 0 1px rgba(168, 85, 247, 0.25);
}

/* === D&D zone: 方眼ノート風 + ゆらゆら浮遊 === */

.dropzone {
  /* idle 時は subtle に上下に浮く */
  animation: dropzone-float 5.6s ease-in-out infinite;
  will-change: transform;

  /* 方眼ノート風グリッド: 細い罫線 (24px) + 5 マスごとの太めライン (120px) を重ねる
     紙の質感は ほんのり クリーム色寄りで温かみを足す */
  background-color: #fbfaf6 !important;
  background-image:
    /* 太め (5 マスごと、垂直) */
    linear-gradient(to right, rgba(139,92,246, 0.09) 1px, transparent 1px),
    /* 太め (5 マスごと、水平) */
    linear-gradient(to bottom, rgba(139,92,246, 0.09) 1px, transparent 1px),
    /* 細い (1 マスごと、垂直) */
    linear-gradient(to right, rgba(15, 23, 42, 0.05) 1px, transparent 1px),
    /* 細い (1 マスごと、水平) */
    linear-gradient(to bottom, rgba(15, 23, 42, 0.05) 1px, transparent 1px);
  background-size:
    120px 120px,
    120px 120px,
    24px 24px,
    24px 24px;
  background-position: 0 0;
}

:global(.dark) .dropzone {
  background-color: #0f172a !important;
  background-image:
    linear-gradient(to right, rgba(139,92,246, 0.16) 1px, transparent 1px),
    linear-gradient(to bottom, rgba(139,92,246, 0.16) 1px, transparent 1px),
    linear-gradient(to right, rgba(148, 163, 184, 0.07) 1px, transparent 1px),
    linear-gradient(to bottom, rgba(148, 163, 184, 0.07) 1px, transparent 1px);
  background-size:
    120px 120px,
    120px 120px,
    24px 24px,
    24px 24px;
}

/* drag 中は浮遊を止めてピタッと止める */
.dropzone.is-dragging {
  animation: none;
  transform: scale(1.008);
  background-color: rgba(236, 253, 245, 0.95) !important;
}

@keyframes dropzone-float {
  0%,
  100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-3px);
  }
}

/* Idle pulse — 待機中にゆっくり脈打って視線を引く */
.idle-pulse {
  animation: idle-pulse 3.4s ease-in-out infinite;
  filter: blur(20px);
}
@keyframes idle-pulse {
  0%,
  100% {
    transform: translate(-50%, -68%) scale(0.95);
    opacity: 0.45;
  }
  50% {
    transform: translate(-50%, -68%) scale(1.15);
    opacity: 0.7;
  }
}

/* 紙吹雪 (調整版: 軌道を sin で揺らす) */
@keyframes confettiFall {
  0% {
    transform: translateY(-20vh) translateX(0) rotate(0deg);
    opacity: 0.9;
  }
  50% {
    transform: translateY(40vh) translateX(20px) rotate(270deg);
  }
  100% {
    transform: translateY(100vh) translateX(-20px) rotate(540deg);
    opacity: 0;
  }
}

.confetti-piece {
  position: absolute;
  top: 0;
  animation-name: confettiFall;
  animation-timing-function: ease-in;
  animation-fill-mode: forwards;
  display: inline-block;
  user-select: none;
  pointer-events: none;
}

/* 手書き矢印の出入り — 2x2 レイアウトでは未使用 */
.marquee {
  position: relative;
  overflow: hidden;
  /* 左右をうっすらフェードアウト (中身が edge に到達したときの違和感を消す) */
  -webkit-mask-image: linear-gradient(
    90deg,
    transparent 0%,
    black 6%,
    black 94%,
    transparent 100%
  );
  mask-image: linear-gradient(
    90deg,
    transparent 0%,
    black 6%,
    black 94%,
    transparent 100%
  );
}

.marquee-track {
  display: flex;
  gap: 12px;
  padding: 4px 0 8px;
  width: max-content;
  animation: marquee-scroll 48s linear infinite;
  will-change: transform;
}

/* hover / focus 中は停止 (カードを読みたいときの配慮) */
.marquee:hover .marquee-track,
.marquee:focus-within .marquee-track {
  animation-play-state: paused;
}

@keyframes marquee-scroll {
  from {
    transform: translate3d(0, 0, 0);
  }
  to {
    /* 配列を 2 倍にしているので 50% 動けば元位置に戻る */
    transform: translate3d(-50%, 0, 0);
  }
}

/* マーキーカード — 押した瞬間に subtle にへこんで「クリックした」感触 */
.marquee-card {
  transition:
    transform 220ms cubic-bezier(0.4, 0, 0.2, 1),
    box-shadow 220ms ease,
    background-color 220ms ease;
}
.marquee-card:active {
  transform: translateY(0) scale(0.98);
}

@media (prefers-reduced-motion: reduce) {
  .idle-pulse,
  .marquee-track,
  .dropzone,
  .marquee-card {
    animation: none;
    transition: none;
  }
  .dropzone.is-dragging {
    transform: none;
  }
}
</style>
