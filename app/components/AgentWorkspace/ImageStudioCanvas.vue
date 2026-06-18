<template>
  <div
    class="relative flex h-full min-h-0 flex-col"
    data-testid="image-studio-canvas-root"
  >
    <div
      class="pointer-events-none absolute right-3 top-3 z-50 flex items-center gap-0.5 rounded-xl border border-slate-200/90 bg-white/95 p-0.5 shadow-lg ring-1 ring-slate-900/5 backdrop-blur-sm"
      data-testid="image-studio-zoom-controls"
    >
      <UButton
        variant="ghost"
        color="neutral"
        size="xs"
        icon="material-symbols:remove"
        aria-label="ズームアウト"
        :disabled="disabled || !editor.canZoomOut.value"
        @click="editor.zoomOut()"
      />
      <button
        type="button"
        class="min-w-[3rem] rounded-lg px-1.5 py-1 text-center text-[11px] font-semibold tabular-nums text-slate-700 transition hover:bg-slate-100"
        :disabled="disabled"
        title="全体表示に戻す"
        data-testid="image-studio-zoom-fit"
        @click="editor.resetViewportZoom()"
      >
        {{ editor.zoomLabel.value }}
      </button>
      <UButton
        variant="ghost"
        color="neutral"
        size="xs"
        icon="material-symbols:add"
        aria-label="ズームイン"
        :disabled="disabled || !editor.canZoomIn.value"
        @click="editor.zoomIn()"
      />
      <div class="mx-0.5 h-5 w-px bg-slate-200" aria-hidden="true" />
      <UButton
        variant="soft"
        color="neutral"
        size="xs"
        icon="material-symbols:fit-screen"
        aria-label="全体表示"
        title="全体表示"
        :disabled="disabled"
        @click="editor.resetViewportZoom()"
      />
    </div>

    <div
      :ref="bindViewportRef"
      class="min-h-0 flex-1 overflow-auto rounded-2xl bg-slate-900/[0.03] ring-1 ring-slate-200/80"
      data-testid="image-studio-canvas-viewport"
      @wheel="editor.onViewportWheel"
    >
      <div
        class="flex min-h-full min-w-full items-center justify-center p-4"
      >
        <div
          :ref="bindStageRef"
          class="relative flex-shrink-0 rounded-xl bg-white shadow-[0_8px_32px_rgba(15,23,42,0.08)]"
          :class="disabled ? 'cursor-not-allowed opacity-70' : 'cursor-crosshair'"
          :style="editor.stageStyle.value"
          data-testid="image-studio-canvas"
          @pointerdown="editor.onStagePointerDown"
          @pointermove="editor.onPointerMove"
          @pointerup="editor.onPointerUp"
          @pointerleave="editor.onPointerUp"
        >
          <img
            :src="editor.displayImageUrl.value"
            :crossorigin="editor.imageCrossOrigin.value"
            alt="編集対象の画像"
            class="block h-full w-full select-none rounded-xl"
            draggable="false"
            @load="editor.onImageLoad($event)"
          >
          <div
            v-if="
              !disabled &&
                editor.canvas.regions.value.length === 0 &&
                !editor.canvas.isDrawing.value
            "
            class="pointer-events-none absolute inset-0 flex items-center justify-center rounded-xl bg-slate-900/10"
          >
            <p
              class="rounded-xl border border-white/50 bg-white/95 px-5 py-2.5 text-center text-xs font-semibold text-slate-700 shadow-lg"
            >
              ドラッグして修正範囲を指定
            </p>
          </div>

          <div
            v-for="(region, index) in editor.canvas.regions.value"
            :key="region.id"
            data-image-studio-region
            class="absolute"
            :class="
              region.id === editor.canvas.selectedRegionId.value
                ? 'z-30'
                : 'z-20'
            "
            :style="editor.regionRootStyle(region.bbox)"
            :data-testid="`image-studio-region-${index + 1}`"
            @pointerdown.stop="
              editor.onRegionPointerDown({ regionId: region.id, event: $event })
            "
          >
            <div
              class="absolute inset-0 border-2 transition-colors duration-150"
              :class="editor.regionBoxClass(region.id, index)"
            />
            <span
              class="pointer-events-none absolute -left-0.5 -top-0.5 z-10 flex h-5 min-w-[1.25rem] items-center justify-center rounded-br-lg bg-slate-900 px-1 text-[10px] font-bold text-white shadow"
            >
              {{ index + 1 }}
            </span>

            <div
              v-if="region.id === editor.canvas.selectedRegionId.value"
              class="pointer-events-auto absolute z-20 max-w-[min(300px,44vw)]"
              :style="editor.commentBubbleStyle(region.bbox)"
              @pointerdown.stop
            >
              <div
                class="overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-xl ring-1 ring-slate-900/5"
              >
                <div
                  class="flex items-center justify-between gap-2 border-b border-slate-100 bg-slate-50/90 px-2.5 py-1.5"
                >
                  <span class="text-[10px] font-bold text-slate-700">
                    範囲 {{ index + 1 }}
                  </span>
                  <div class="flex items-center gap-1">
                    <EnBadge
                      v-if="region.cropGcsPath"
                      color="success"
                      variant="soft"
                      label="クロップ済"
                      class="!text-[9px]"
                    />
                    <EnBadge
                      v-if="region.referenceImage"
                      color="info"
                      variant="soft"
                      label="参照"
                      class="!text-[9px]"
                    />
                    <UButton
                      variant="ghost"
                      color="neutral"
                      size="xs"
                      label="削除"
                      :disabled="disabled"
                      @click.stop="editor.onRemoveRegion(region.id)"
                    />
                  </div>
                </div>
                <textarea
                  :value="region.instruction"
                  rows="3"
                  class="w-full resize-y border-0 bg-white px-2.5 py-2 text-xs leading-relaxed text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-sky-200"
                  :placeholder="editor.regionInstructionPlaceholder(index)"
                  :disabled="disabled"
                  @input="editor.onRegionInstructionInput(region.id, $event)"
                  @blur="editor.flushRegionsToStore({ persist: true })"
                />
              </div>
            </div>
          </div>

          <div
            v-if="editor.canvas.draftBbox.value"
            class="pointer-events-none absolute z-10 border-2 border-dashed border-sky-400 bg-sky-300/20"
            :style="editor.bboxStyle(editor.canvas.draftBbox.value)"
          />
          <div
            v-if="editor.isUploading.value"
            class="pointer-events-none absolute inset-0 z-40 flex items-center justify-center rounded-xl bg-white/70 backdrop-blur-sm"
          >
            <p
              class="flex items-center gap-2 rounded-full bg-white px-4 py-2 text-xs font-semibold text-slate-700 shadow-lg ring-1 ring-slate-200"
            >
              <UIcon
                name="material-symbols:progress-activity"
                class="h-4 w-4 animate-spin text-sky-600"
              />
              クロップをアップロード中…
            </p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { ComponentPublicInstance } from "vue";
import EnBadge from "@components/EnBadge.vue";
import type { useImageStudioRetouchEditor } from "@composables/useImageStudioRetouchEditor";

const props = defineProps<{
  editor: ReturnType<typeof useImageStudioRetouchEditor>;
  disabled?: boolean;
}>();

const bindViewportRef = (
  el: Element | ComponentPublicInstance | null
): void => {
  props.editor.viewportRef.value =
    el instanceof HTMLElement ? el : null;
};

const bindStageRef = (
  el: Element | ComponentPublicInstance | null
): void => {
  props.editor.stageRef.value =
    el instanceof HTMLElement ? el : null;
};
</script>
