<template>
  <section
    class="request-sheet relative mx-auto w-full max-w-[min(98vw,1920px)] min-w-0 overflow-hidden rounded-3xl px-3 py-4 sm:px-4"
    data-testid="research-plan-kiosk-panel"
  >
    <div class="paper-bg absolute inset-0 -z-20" aria-hidden="true" />
    <div class="paper-inset absolute inset-0 -z-10" aria-hidden="true" />
    <span class="corner-tape" aria-hidden="true" />
    <section class="request-group mb-6">
      <div class="flex items-start justify-between gap-3">
        <div class="flex min-w-0 flex-wrap items-end gap-2 sm:gap-3">
          <EnBadge variant="soft" color="neutral" size="sm">
            レポートテーマ
          </EnBadge>
          <span class="pb-0.5 text-sm font-semibold text-neutral-400">:</span>
          <p class="report-theme-title">
            {{ localPlan.deck.title || "(未指定)" }}
          </p>
        </div>
        <EnButton
          v-if="!props.readOnly"
          variant="soft"
          color="neutral"
          size="xs"
          :leading-icon="isPlanEditing ? 'material-symbols:check' : 'material-symbols:edit'"
          :disabled="isRunning"
          @click="togglePlanEdit"
        >
          {{ isPlanEditing ? "保存" : "編集" }}
        </EnButton>
      </div>
      <div class="group-underline mt-3" aria-hidden="true" />
    </section>

    <section class="request-group mb-5">
      <div class="group-label-row">
        <p
          class="group-heading group-heading-with-icon"
        >
          <UIcon name="material-symbols:help-outline-rounded" class="h-5 w-5 text-black" />
          <span>疑問</span>
        </p>
        <EnButton
          v-if="isPlanEditing && !isRunning"
          variant="soft"
          color="neutral"
          size="xs"
          leading-icon="material-symbols:add"
          @click="addSection"
        >
          追加
        </EnButton>
      </div>
      <div class="group-underline mb-3" aria-hidden="true" />

      <div class="relative">
        <div
          class="pointer-events-none absolute left-0 right-2 top-0 z-20 h-7 rounded-t-lg bg-gradient-to-b from-white to-transparent transition-opacity duration-200"
          :class="sectionHasTopShadow ? 'opacity-100' : 'opacity-0'"
          aria-hidden="true"
        />
        <div
          class="pointer-events-none absolute bottom-0 left-0 right-2 z-20 h-7 rounded-b-lg bg-gradient-to-t from-white to-transparent transition-opacity duration-200"
          :class="sectionHasBottomShadow ? 'opacity-100' : 'opacity-0'"
          aria-hidden="true"
        />
        <div
          ref="sectionScrollRef"
          class="max-h-[42vh] overflow-y-auto pr-1"
          @scroll="updateSectionShadowState"
        >
          <TransitionGroup
            name="plan-row"
            tag="div"
            class="plan-note-grid grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4"
          >
            <div
              v-for="(section, index) in localPlan.sections"
              :key="section.id"
              class="note-row request-form-row question-row h-full rounded-lg p-3 transition-all duration-200"
              :style="{ '--note-rotation': rowRotation(index) }"
            >
              <span class="row-tape" aria-hidden="true" />
              <div class="mb-2 flex items-center justify-end gap-2">
                <button
                  v-if="isPlanEditing && !isRunning && localPlan.sections.length > 1"
                  type="button"
                  class="ml-auto text-neutral-400 hover:text-rose-500"
                  @click="removeSection({ index })"
                >
                  <UIcon name="i-heroicons-x-mark-20-solid" class="h-4 w-4" />
                </button>
              </div>
              <textarea
                v-if="isPlanEditing"
                v-model="section.question"
                rows="3"
                placeholder="調べて答えが欲しい問いを入力"
                class="sticky-editor question-editor w-full text-sm"
                :disabled="isRunning"
              />
              <p v-else class="sticky-note-text question-note-text">
                {{ section.question || "（未入力）" }}
              </p>
            </div>
          </TransitionGroup>
        </div>
      </div>
    </section>

    <section class="request-group mb-6">
      <div class="group-label-row">
        <p
          class="group-heading group-heading-with-icon"
        >
          <UIcon name="material-symbols:warning-outline-rounded" class="h-5 w-5 text-black" />
          <span>懸念</span>
        </p>
        <EnButton
          v-if="isPlanEditing && !isRunning"
          variant="soft"
          color="neutral"
          size="xs"
          leading-icon="material-symbols:add"
          @click="addConcern"
        >
          追加
        </EnButton>
      </div>
      <div class="group-underline mb-3" aria-hidden="true" />
      <p
        v-if="localPlan.concerns.length === 0"
        class="rounded-lg border border-dashed border-violet-200 bg-violet-50/40 px-3 py-2 text-xs text-violet-700"
      >
        {{
          isPlanEditing
            ? "懸念がなければ空のままで問題ありません。"
            : "懸念は登録されていません。必要なら編集から追加してください。"
        }}
      </p>
      <div v-else class="relative">
        <div
          class="pointer-events-none absolute left-0 right-2 top-0 z-20 h-7 rounded-t-lg bg-gradient-to-b from-white to-transparent transition-opacity duration-200"
          :class="concernHasTopShadow ? 'opacity-100' : 'opacity-0'"
          aria-hidden="true"
        />
        <div
          class="pointer-events-none absolute bottom-0 left-0 right-2 z-20 h-7 rounded-b-lg bg-gradient-to-t from-white to-transparent transition-opacity duration-200"
          :class="concernHasBottomShadow ? 'opacity-100' : 'opacity-0'"
          aria-hidden="true"
        />
        <div
          ref="concernScrollRef"
          class="max-h-[26vh] overflow-y-auto pr-1"
          @scroll="updateConcernShadowState"
        >
          <TransitionGroup
            name="plan-row"
            tag="div"
            class="plan-note-grid grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4"
          >
            <div
              v-for="(concern, index) in localPlan.concerns"
              :key="concern.id"
              class="note-row request-form-row concern-row h-full rounded-lg p-3 transition-all duration-200"
              :style="{ '--note-rotation': concernRowRotation(index) }"
            >
              <span class="row-tape row-tape--violet" aria-hidden="true" />
              <div class="mb-2 flex items-center justify-end gap-2">
                <button
                  v-if="isPlanEditing && !isRunning"
                  type="button"
                  class="ml-auto text-neutral-400 hover:text-rose-500"
                  @click="removeConcern({ index })"
                >
                  <UIcon name="i-heroicons-x-mark-20-solid" class="h-4 w-4" />
                </button>
              </div>
              <textarea
                v-if="isPlanEditing"
                v-model="concern.text"
                rows="3"
                class="sticky-editor concern-editor min-w-0 w-full text-sm"
                placeholder="リサーチ前に押さえておきたい懸念を入力"
                :disabled="isRunning"
              />
              <p v-else class="sticky-note-text concern-note-text">
                {{ concern.text || "（未入力）" }}
              </p>
            </div>
          </TransitionGroup>
        </div>
      </div>
    </section>

    <div
      v-if="props.showSubmitAction"
      class="sticky bottom-0 z-20 rounded-xl border border-slate-200 bg-slate-50/95 px-3 py-3 shadow-[0_-8px_20px_-16px_rgba(15,23,42,0.35)] backdrop-blur"
    >
      <div class="flex justify-end">
        <EnButton
          variant="solid"
          color="neutral"
          size="md"
          leading-icon="material-symbols:send"
          :loading="isSubmitting || isRunning"
          :disabled="!canSubmit || isSubmitting || isRunning"
          @click="onSubmit"
        >
          {{ isRunning ? "生成中..." : "生成を開始" }}
        </EnButton>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from "vue";
import EnBadge from "@components/EnBadge.vue";
import EnButton from "@components/EnButton.vue";
import { cloneResearchPlanDraft, type ResearchPlanDraft } from "@utils/researchPlanDraft";

const props = withDefaults(
  defineProps<{
    plan: ResearchPlanDraft;
    isSubmitting?: boolean;
    isRunning?: boolean;
    readOnly?: boolean;
    showSubmitAction?: boolean;
  }>(),
  {
    isSubmitting: false,
    isRunning: false,
    readOnly: false,
    showSubmitAction: true,
  },
);

const emit = defineEmits<{
  (e: "submit", payload: {
    plan: ResearchPlanDraft;
  }): void;
}>();

const localPlan = ref<ResearchPlanDraft>(cloneResearchPlanDraft(props.plan));
const isPlanEditing = ref(false);
const sectionScrollRef = ref<HTMLElement | null>(null);
const concernScrollRef = ref<HTMLElement | null>(null);
const sectionHasTopShadow = ref(false);
const sectionHasBottomShadow = ref(false);
const concernHasTopShadow = ref(false);
const concernHasBottomShadow = ref(false);
const ROW_ROTATIONS = ["-1deg", "0.9deg", "-0.8deg", "0.7deg"];
const CONCERN_ROW_ROTATIONS = ["0.85deg", "-0.75deg", "0.6deg"];

watch(
  () => props.plan,
  (next) => {
    localPlan.value = cloneResearchPlanDraft(next);
    isPlanEditing.value = false;
  },
  { deep: true },
);

watch(
  () => [localPlan.value.sections.length, localPlan.value.concerns.length] as const,
  async () => {
    await nextTick();
    updateSectionShadowState();
    updateConcernShadowState();
  },
  { immediate: true },
);

onMounted(async () => {
  await nextTick();
  updateSectionShadowState();
  updateConcernShadowState();
});

const canSubmit = computed(
  () =>
    localPlan.value.sections.length >= 1 &&
    localPlan.value.sections.every((s) => s.question.trim().length >= 5),
);

const updateScrollShadows = (params: {
  el: HTMLElement | null;
  top: { value: boolean };
  bottom: { value: boolean };
}): void => {
  const el = params.el;
  if (!el) {
    params.top.value = false;
    params.bottom.value = false;
    return;
  }
  const max = Math.max(0, el.scrollHeight - el.clientHeight);
  params.top.value = el.scrollTop > 3;
  params.bottom.value = el.scrollTop < max - 3;
};

const updateSectionShadowState = (): void => {
  updateScrollShadows({
    el: sectionScrollRef.value,
    top: sectionHasTopShadow,
    bottom: sectionHasBottomShadow,
  });
};

const updateConcernShadowState = (): void => {
  updateScrollShadows({
    el: concernScrollRef.value,
    top: concernHasTopShadow,
    bottom: concernHasBottomShadow,
  });
};

const renumberSections = (): void => {
  localPlan.value.sections = localPlan.value.sections.map((s, i) => ({
    ...s,
    id: `Q${i + 1}`,
  }));
};

const renumberConcerns = (): void => {
  localPlan.value.concerns = localPlan.value.concerns.map((c, i) => ({
    ...c,
    id: `C${i + 1}`,
  }));
};

const addSection = (): void => {
  if (!isPlanEditing.value) return;
  const n = localPlan.value.sections.length + 1;
  localPlan.value.sections.push({
    id: `Q${n}`,
    question: "",
    kind: "definitional",
  });
};

const removeSection = (params: { index: number }): void => {
  if (!isPlanEditing.value) return;
  localPlan.value.sections.splice(params.index, 1);
  renumberSections();
};

const addConcern = (): void => {
  if (!isPlanEditing.value) return;
  const n = localPlan.value.concerns.length + 1;
  localPlan.value.concerns.push({ id: `C${n}`, text: "" });
};

const removeConcern = (params: { index: number }): void => {
  if (!isPlanEditing.value) return;
  localPlan.value.concerns.splice(params.index, 1);
  renumberConcerns();
};

const togglePlanEdit = (): void => {
  if (props.readOnly) return;
  if (props.isRunning) return;
  isPlanEditing.value = !isPlanEditing.value;
};

const onSubmit = (): void => {
  if (!props.showSubmitAction || !canSubmit.value || props.isRunning) return;
  isPlanEditing.value = false;
  emit("submit", {
    plan: cloneResearchPlanDraft(localPlan.value),
  });
};

const rowRotation = (index: number): string =>
  ROW_ROTATIONS[index % ROW_ROTATIONS.length] ?? "0deg";

const concernRowRotation = (index: number): string =>
  CONCERN_ROW_ROTATIONS[index % CONCERN_ROW_ROTATIONS.length] ?? "0deg";
</script>

<style scoped>
.request-sheet {
  box-shadow: 0 12px 30px -22px rgba(15, 23, 42, 0.35);
}
.paper-bg {
  background-color: #fcfcf8;
  background-image:
    linear-gradient(rgba(0, 0, 0, 0.04) 1px, transparent 1px),
    linear-gradient(90deg, rgba(0, 0, 0, 0.04) 1px, transparent 1px);
  background-size:
    24px 24px,
    24px 24px;
}
.paper-inset {
  box-shadow:
    inset 0 0 0 1px rgba(0, 0, 0, 0.05),
    inset 0 0 0 6px rgba(255, 255, 255, 0.45),
    0 10px 28px -22px rgba(0, 0, 0, 0.3);
}
.corner-tape {
  position: absolute;
  top: 18px;
  right: -18px;
  width: 104px;
  height: 24px;
  background: rgba(253, 224, 71, 0.72);
  border-radius: 1px;
  transform: rotate(26deg);
  box-shadow:
    0 2px 4px rgba(0, 0, 0, 0.08),
    inset 0 -1px 0 rgba(0, 0, 0, 0.06);
  background-image: repeating-linear-gradient(
    90deg,
    transparent 0,
    transparent 5px,
    rgba(202, 138, 4, 0.2) 5px,
    rgba(202, 138, 4, 0.2) 6px
  );
  pointer-events: none;
}
.request-group {
  position: relative;
}
.group-label-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
}
.group-heading {
  font-size: 1.6rem;
  font-weight: 900;
  line-height: 1.25;
  color: #0f172a;
  letter-spacing: -0.01em;
}
.group-heading-with-icon {
  display: flex;
  align-items: center;
  gap: 0.42rem;
}
.group-underline {
  margin-top: 0.35rem;
  height: 1px;
  width: 100%;
  background: linear-gradient(
    90deg,
    rgba(148, 163, 184, 0.28) 0%,
    rgba(148, 163, 184, 0.5) 26%,
    rgba(148, 163, 184, 0.24) 100%
  );
}
.report-theme-title {
  font-size: clamp(1.6rem, 2vw, 2.2rem);
  font-weight: 900;
  line-height: 1.25;
  color: #020617;
  letter-spacing: -0.01em;
}
.note-row {
  transform: rotate(var(--note-rotation, 0deg));
  transform-origin: top center;
}
.request-form-row {
  position: relative;
  border: 1px solid rgba(0, 0, 0, 0.08);
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.8) 0%, rgba(255, 254, 249, 0.72) 100%);
  box-shadow:
    0 7px 16px -10px rgba(93, 67, 28, 0.25),
    0 1px 0 rgba(255, 255, 255, 0.68) inset;
  transition:
    transform 0.2s ease,
    box-shadow 0.2s ease,
    border-color 0.2s ease;
}
.request-form-row:hover {
  transform: rotate(var(--note-rotation, 0deg)) translateY(-2px);
  box-shadow:
    0 10px 18px -10px rgba(93, 67, 28, 0.3),
    0 1px 0 rgba(255, 255, 255, 0.75) inset;
}
.request-form-row::before {
  content: "";
  position: absolute;
  left: -6px;
  top: 12px;
  width: 12px;
  height: 12px;
  border-radius: 999px;
  background: rgba(252, 251, 243, 0.95);
  box-shadow:
    inset 0 0 0 2px rgba(0, 0, 0, 0.09),
    0 1px 2px rgba(0, 0, 0, 0.06);
}
.request-form-row::after {
  content: "";
  position: absolute;
  right: 0;
  top: 0;
  width: 24px;
  height: 24px;
  clip-path: polygon(100% 0, 0 0, 100% 100%);
  background: rgba(255, 255, 255, 0.42);
  box-shadow: -1px 1px 0 rgba(0, 0, 0, 0.06);
}
.question-row {
  border-color: rgba(251, 191, 36, 0.34);
  background:
    linear-gradient(180deg, rgba(255, 251, 220, 0.94) 0%, rgba(255, 245, 192, 0.9) 100%);
}
.concern-row {
  border-color: rgba(167, 139, 250, 0.34);
  background:
    linear-gradient(180deg, rgba(244, 239, 255, 0.95) 0%, rgba(234, 225, 255, 0.9) 100%);
}
.row-tape {
  position: absolute;
  top: -6px;
  left: 18px;
  width: 34px;
  height: 11px;
  border-radius: 1px;
  transform: rotate(-10deg);
  background: rgba(253, 224, 71, 0.65);
  box-shadow:
    0 1px 2px rgba(0, 0, 0, 0.08),
    inset 0 0 0 1px rgba(255, 255, 255, 0.5);
  pointer-events: none;
}
.row-tape--violet {
  background: rgba(221, 214, 254, 0.8);
}
.sticky-editor {
  width: 100%;
  resize: none;
  border: 0;
  border-radius: 0;
  background: transparent;
  padding: 0.35rem 0.4rem;
  min-height: 5.5rem;
  box-shadow: none;
  line-height: 1.65;
  font-weight: 560;
  color: #1f2937;
  white-space: pre-wrap;
  word-break: break-word;
  transition:
    color 0.2s ease,
    background-color 0.2s ease;
}
.sticky-note-text {
  min-height: 5.5rem;
  border-radius: 0.78rem;
  border: 1px solid rgba(0, 0, 0, 0.08);
  padding: 0.78rem 0.88rem;
  line-height: 1.65;
  font-weight: 560;
  white-space: pre-wrap;
  word-break: break-word;
}
.question-note-text {
  color: #2c2410;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.72), rgba(255, 255, 255, 0.58)),
    repeating-linear-gradient(
      to bottom,
      transparent 0,
      transparent 1.62rem,
      rgba(251, 191, 36, 0.16) 1.62rem,
      rgba(251, 191, 36, 0.16) 1.68rem
    );
}
.concern-note-text {
  color: #35284a;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.74), rgba(255, 255, 255, 0.6)),
    repeating-linear-gradient(
      to bottom,
      transparent 0,
      transparent 1.62rem,
      rgba(167, 139, 250, 0.14) 1.62rem,
      rgba(167, 139, 250, 0.14) 1.68rem
    );
}
.sticky-editor::placeholder {
  color: rgba(71, 85, 105, 0.7);
}
.sticky-editor:focus {
  outline: none;
  background: rgba(255, 255, 255, 0.22);
}
.question-editor {
  color: #2c2410;
}
.question-editor:focus {
  box-shadow: none;
}
.concern-editor {
  color: #35284a;
}
.concern-editor:focus {
  box-shadow: none;
}
.plan-row-enter-active,
.plan-row-leave-active,
.plan-row-move {
  transition: all 0.22s ease;
}
.plan-row-enter-from,
.plan-row-leave-to {
  opacity: 0;
  transform: translateY(10px) scale(0.985);
}
</style>
