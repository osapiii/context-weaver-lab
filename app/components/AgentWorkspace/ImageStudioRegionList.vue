<template>
  <aside
    class="flex min-h-0 flex-col border-l border-slate-200/90 bg-white"
    data-testid="image-studio-region-list"
  >
    <div
      class="flex-shrink-0 border-b border-slate-100 px-4 py-3.5 sm:px-5"
    >
      <div class="flex items-center justify-between gap-2">
        <h3 class="text-sm font-bold tracking-tight text-slate-900">
          修正範囲
        </h3>
        <EnBadge
          v-if="editor.canvas.regions.value.length > 0"
          variant="soft"
          color="neutral"
          size="sm"
          :label="`${editor.canvas.regions.value.length} 件`"
        />
      </div>
      <p class="mt-1 text-[11px] leading-relaxed text-slate-500">
        サムネで切り取り位置を確認し、範囲ごとに修正指示を入力します。
      </p>
    </div>

    <div
      v-if="editor.canvas.regions.value.length === 0"
      class="flex flex-1 flex-col items-center justify-center px-5 py-12 text-center"
    >
      <div
        class="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-50 ring-1 ring-slate-200/80"
      >
        <UIcon
          name="material-symbols:crop-free"
          class="h-8 w-8 text-slate-300"
        />
      </div>
      <p class="text-sm font-semibold text-slate-800">
        範囲をまだ指定していません
      </p>
      <p class="mt-1.5 max-w-[15rem] text-[11px] leading-relaxed text-slate-500">
        左のキャンバスをドラッグすると、クロップのプレビューがここに並びます。
      </p>
    </div>

    <ul
      v-else
      class="min-h-0 flex-1 space-y-3 overflow-y-auto p-3 sm:p-4"
    >
      <li
        v-for="(region, index) in editor.canvas.regions.value"
        :key="region.id"
      >
        <article
          class="overflow-hidden rounded-2xl border bg-white transition-all duration-200"
          :class="
            region.id === editor.canvas.selectedRegionId.value
              ? 'border-sky-300 shadow-md shadow-sky-100/80 ring-2 ring-sky-200/60'
              : 'border-slate-200/90 shadow-sm hover:border-slate-300 hover:shadow'
          "
          :data-testid="`image-studio-region-list-item-${index + 1}`"
        >
          <button
            type="button"
            class="flex w-full gap-3 p-3 text-left"
            @click="editor.onSelectRegion(region.id)"
          >
            <div class="relative flex flex-shrink-0 gap-1.5">
              <div
                class="h-20 w-20 overflow-hidden rounded-xl bg-slate-100 ring-1 ring-slate-200/80"
                :data-testid="`image-studio-region-thumb-${index + 1}`"
              >
                <div
                  v-if="hasRegionCropPreview(region)"
                  class="h-full w-full"
                  :style="editor.regionCropStyle(region.bbox)"
                  :aria-label="`範囲 ${index + 1} のクロップ`"
                  role="img"
                />
                <div
                  v-else
                  class="flex h-full w-full flex-col items-center justify-center gap-1 px-1 text-center text-slate-400"
                >
                  <UIcon
                    name="material-symbols:image-outline"
                    class="h-5 w-5"
                  />
                  <span class="text-[9px] font-medium leading-tight">
                    プレビュー準備中
                  </span>
                </div>
              </div>
              <div
                v-if="region.referenceImage || referenceThumbUrl(region.id)"
                class="h-20 w-20 overflow-hidden rounded-xl bg-violet-50 ring-1 ring-violet-200/80"
                :data-testid="`image-studio-region-ref-thumb-${index + 1}`"
                title="差し替え参照画像"
              >
                <img
                  v-if="referenceThumbUrl(region.id)"
                  :src="referenceThumbUrl(region.id)"
                  :alt="`範囲 ${index + 1} の参照画像`"
                  class="h-full w-full object-contain p-1"
                >
                <div
                  v-else
                  class="flex h-full w-full items-center justify-center"
                >
                  <UIcon
                    name="material-symbols:progress-activity"
                    class="h-5 w-5 animate-spin text-violet-500"
                  />
                </div>
              </div>
              <span
                class="absolute -left-1.5 -top-1.5 flex h-5 min-w-[1.25rem] items-center justify-center rounded-md bg-slate-900 px-1 text-[10px] font-bold text-white shadow-sm"
              >
                {{ index + 1 }}
              </span>
            </div>

            <div class="min-w-0 flex-1 pt-0.5">
              <div class="flex items-start justify-between gap-2">
                <p class="text-xs font-bold text-slate-900">
                  範囲 {{ index + 1 }}
                </p>
                <UButton
                  variant="ghost"
                  color="neutral"
                  size="xs"
                  icon="material-symbols:delete-outline"
                  aria-label="この範囲を削除"
                  :disabled="disabled"
                  class="-mr-1 -mt-0.5"
                  @click.stop="editor.onRemoveRegion(region.id)"
                />
              </div>
              <p class="mt-0.5 font-mono text-[10px] text-slate-400">
                {{ bboxLabel(region.bbox) }}
              </p>
              <div class="mt-2 flex flex-wrap gap-1">
                <EnBadge
                  v-if="region.cropGcsPath"
                  variant="soft"
                  color="success"
                  size="sm"
                  label="クロップ済"
                  custom-class="!text-[9px]"
                />
                <EnBadge
                  v-if="region.referenceImage"
                  variant="soft"
                  color="info"
                  size="sm"
                  label="参照画像"
                  custom-class="!text-[9px]"
                />
              </div>
            </div>
          </button>

          <div
            class="border-t border-slate-100 bg-slate-50/40 px-3 pb-3 pt-2.5"
            @click.stop
          >
            <label
              class="mb-1.5 block text-[11px] font-semibold text-slate-600"
              :for="`region-instruction-${region.id}`"
            >
              この範囲の修正指示
            </label>
            <textarea
              :id="`region-instruction-${region.id}`"
              :value="region.instruction"
              rows="2"
              class="w-full resize-none rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs leading-relaxed text-slate-800 shadow-sm placeholder:text-slate-400 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-200/70"
              :placeholder="editor.regionInstructionPlaceholder(index)"
              :disabled="disabled"
              @input="editor.onRegionInstructionInput(region.id, $event)"
              @blur="editor.flushRegionsToStore({ persist: true })"
            />

            <div class="mt-3">
              <p class="mb-1 text-[11px] font-semibold text-slate-600">
                差し替え参照画像
                <span class="font-normal text-slate-400">（任意）</span>
              </p>
              <p class="mb-2 text-[10px] leading-relaxed text-slate-500">
                ロゴや商品写真を別画像に置き換えるときに添付します。
              </p>
              <div
                v-if="region.referenceImage"
                class="mb-2 flex items-center justify-between gap-2 rounded-xl border border-violet-200/80 bg-violet-50/60 px-2.5 py-2"
              >
                <span class="min-w-0 truncate text-[10px] font-medium text-violet-900">
                  {{ region.referenceImage.name }}
                </span>
                <UButton
                  variant="soft"
                  color="neutral"
                  size="xs"
                  label="削除"
                  :disabled="disabled"
                  @click="editor.onClearRegionReference(region.id)"
                />
              </div>
              <div class="flex flex-wrap gap-1.5">
                <UButton
                  variant="soft"
                  color="neutral"
                  size="xs"
                  icon="material-symbols:upload-file-outline"
                  label="ファイル"
                  :disabled="disabled || editor.isReferenceUploading.value"
                  :data-testid="`image-studio-region-ref-upload-${index + 1}`"
                  @click="triggerReferenceFileInput(region.id)"
                />
                <UButton
                  variant="soft"
                  color="neutral"
                  size="xs"
                  icon="material-symbols:content-paste"
                  label="クリップボード"
                  :disabled="disabled || editor.isReferenceUploading.value"
                  :data-testid="`image-studio-region-ref-clipboard-${index + 1}`"
                  @click="onReferenceClipboardClick(region.id)"
                />
              </div>
              <input
                :ref="(el) => setReferenceFileInputRef(region.id, el)"
                type="file"
                accept="image/*"
                class="hidden"
                :disabled="disabled"
                @change="editor.onReferenceFileInput({ regionId: region.id, event: $event })"
              >
            </div>
          </div>
        </article>
      </li>
    </ul>
  </aside>
</template>

<script setup lang="ts">
import EnBadge from "@components/EnBadge.vue";
import type { useImageStudioRetouchEditor } from "@composables/useImageStudioRetouchEditor";
import type { ImageRetouchRegion, NormalizedBbox } from "@utils/imageStudioState";

const props = defineProps<{
  editor: ReturnType<typeof useImageStudioRetouchEditor>;
  disabled?: boolean;
}>();

/** v-for の :ref で reactive を更新すると再レンダーが無限ループするため plain object */
const referenceFileInputs: Record<string, HTMLInputElement | null> = {};

/** 表示中の画像 URL を CSS で切り抜くので、画像さえ表示できていれば常にプレビュー可能 */
const hasRegionCropPreview = (region: ImageRetouchRegion): boolean =>
  Boolean(props.editor.displayImageUrl.value.trim()) &&
  region.bbox.w > 0 &&
  region.bbox.h > 0;

const referenceThumbUrl = (regionId: string): string | undefined =>
  props.editor.referenceThumbUrl(regionId);

const bboxLabel = (bbox: NormalizedBbox): string =>
  `${Math.round(bbox.x * 100)}%, ${Math.round(bbox.y * 100)}% · ${Math.round(bbox.w * 100)}×${Math.round(bbox.h * 100)}%`;

const setReferenceFileInputRef = (
  regionId: string,
  el: Element | { $el?: Element } | null
): void => {
  const node =
    el instanceof HTMLInputElement
      ? el
      : el && "$el" in el && el.$el instanceof HTMLInputElement
        ? el.$el
        : null;
  referenceFileInputs[regionId] = node;
};

const triggerReferenceFileInput = (regionId: string): void => {
  referenceFileInputs[regionId]?.click();
};

const onReferenceClipboardClick = async (regionId: string): Promise<void> => {
  const ok = await props.editor.onReferenceClipboard({ regionId });
  if (!ok) {
    window.alert("クリップボードに画像がありません。画像をコピーしてから再度お試しください。");
  }
};
</script>
