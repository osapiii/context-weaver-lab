<template>
  <div class="briefing-fields space-y-6">
    <div
      v-for="(fieldItem, fieldIndex) in fields"
      :key="fieldItem.key"
      class="space-y-4"
      :class="fieldIndex > 0 ? 'border-t border-neutral-100 pt-6' : ''"
    >
      <h2
        v-if="showFieldHeadings"
        class="text-xl font-bold text-neutral-800 md:text-2xl"
      >
        {{ fieldItem.heading }}
      </h2>
      <h3
        v-else-if="fields.length > 1"
        class="text-sm font-bold text-neutral-700"
      >
        {{ fieldItem.heading }}
      </h3>
      <p
        v-if="fieldItem.hint && (showFieldHeadings || fields.length > 1)"
        class="text-sm text-neutral-500"
      >
        {{ fieldItem.hint }}
      </p>

      <div
        v-if="fieldItem.kind === 'chips' && chipsFor(fieldItem.key).length > 0"
        class="flex flex-wrap items-center gap-2"
      >
        <span
          v-for="(c, i) in chipsFor(fieldItem.key)"
          :key="`${fieldItem.key}-${i}`"
          :class="[
            'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm',
            chipDisplayClass,
          ]"
        >
          {{ c }}
          <button
            type="button"
            class="text-neutral-500 hover:text-rose-600"
            :aria-label="`「${c}」を削除`"
            @click="onRemoveChip(fieldItem.key, i)"
          >
            <UIcon name="material-symbols:close" class="h-4 w-4" />
          </button>
        </span>
      </div>

      <textarea
        :ref="(el) => setTextareaRef(fieldItem.key, el)"
        :value="textFor(fieldItem.key)"
        :rows="fieldItem.kind === 'chips' ? 2 : 4"
        :placeholder="fieldItem.placeholder ?? ''"
        :class="[
          'w-full resize-none rounded-xl border-2 bg-white px-4 py-3 text-base leading-relaxed text-neutral-800 placeholder-neutral-400 focus:outline-none focus:ring-4',
          inputBorderClass,
        ]"
        :aria-label="fieldItem.heading"
        @input="onTextInput(fieldItem, $event)"
        @keydown="onKeydown($event, fieldItem)"
      />

      <AgentBriefingAiSuggestChips
        v-if="fieldItem.aiSuggestChips"
        :enabled="aiSuggestEnabled"
        :is-loading="aiSuggestions.isLoading.value"
        :suggestions="aiSuggestions.suggestions.value"
        @pick="onAiSuggestionPick(fieldItem, $event)"
      />

      <div
        v-if="
          fieldItem.samples &&
          fieldItem.samples.length > 0 &&
          !fieldItem.aiSuggestChips
        "
        class="space-y-1.5"
      >
        <span
          class="text-[11px] font-medium uppercase tracking-wider text-neutral-500"
        >
          サンプル
        </span>
        <div class="flex flex-wrap gap-1.5">
          <button
            v-for="(s, i) in fieldItem.samples"
            :key="`${fieldItem.key}-s-${i}`"
            type="button"
            :class="[
              'rounded-full border px-3 py-1 text-xs font-medium transition',
              sampleChipClass,
            ]"
            @click="onSampleClick(fieldItem, s)"
          >
            {{ s }}
          </button>
        </div>
      </div>

      <p
        v-if="fieldItem.kind === 'chips'"
        class="text-xs italic text-neutral-500"
      >
        Enter で追加・複数 OK
        <span v-if="fieldItem.optional">（任意）</span>
      </p>
      <p
        v-else-if="
          fieldItem.format === 'email' && textFor(fieldItem.key).trim()
        "
        class="text-xs"
        :class="emailValid(fieldItem) ? 'text-emerald-600' : 'text-rose-600'"
      >
        {{
          emailValid(fieldItem)
            ? "有効なメールアドレスです"
            : "メールアドレスの形式を確認してください"
        }}
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from "vue";
import AgentBriefingAiSuggestChips from "./AgentBriefingAiSuggestChips.vue";
import type { AgentBriefingHandle } from "@composables/agentBriefing/useAgentBriefing";
import type { BriefingFieldDef } from "@composables/agentBriefing/types";
import { isValidEmailAddress } from "@utils/emailAddress";
import { useResearchBriefingQuestionSuggestions } from "@composables/useResearchBriefingQuestionSuggestions";

const props = withDefaults(
  defineProps<{
    briefing: AgentBriefingHandle;
    fields: BriefingFieldDef[];
    showFieldHeadings?: boolean;
    autofocus?: boolean;
  }>(),
  {
    showFieldHeadings: true,
    autofocus: false,
  },
);

const emit = defineEmits<{
  (e: "enter-advance"): void;
}>();

const textareaRefs = ref<Record<string, HTMLTextAreaElement | null>>({});
const textByField = ref<Record<string, string>>({});

const hasAiSuggestField = computed(() =>
  props.fields.some((field) => field.aiSuggestChips),
);

const aiSuggestEnabled = computed(
  () =>
    hasAiSuggestField.value &&
    props.briefing.config.id === "researchAgent" &&
    typeof props.briefing.draft.theme === "string" &&
    props.briefing.draft.theme.trim().length > 0,
);

const existingQuestions = computed(() => {
  const v = props.briefing.draft.questions;
  return Array.isArray(v)
    ? v.filter((x): x is string => typeof x === "string")
    : [];
});

const questionsDraftInput = computed(() => textByField.value.questions ?? "");

const aiSuggestions = useResearchBriefingQuestionSuggestions({
  theme: computed(() =>
    typeof props.briefing.draft.theme === "string"
      ? props.briefing.draft.theme
      : "",
  ),
  existingQuestions,
  draftInput: questionsDraftInput,
  enabled: aiSuggestEnabled,
});

const setTextareaRef = (key: string, el: unknown) => {
  textareaRefs.value[key] = (el as HTMLTextAreaElement | null) ?? null;
};

const syncTextFieldsFromDraft = () => {
  const next: Record<string, string> = {};
  for (const field of props.fields) {
    const v = props.briefing.draft[field.key];
    next[field.key] =
      field.kind === "text" && typeof v === "string" ? v : "";
  }
  textByField.value = next;
};

watch(
  () => props.fields.map((f) => f.key).join(","),
  () => {
    syncTextFieldsFromDraft();
    if (props.autofocus) {
      void nextTick(() => focusFirstField());
    }
  },
  { immediate: true },
);

onMounted(() => {
  if (props.autofocus) {
    void nextTick(() => focusFirstField());
  }
});

const focusFirstField = () => {
  const first = props.fields[0];
  if (first) textareaRefs.value[first.key]?.focus();
};

const textFor = (key: string): string => textByField.value[key] ?? "";

const chipsFor = (key: string): string[] => {
  const v = props.briefing.draft[key];
  return Array.isArray(v)
    ? v.filter((x): x is string => typeof x === "string")
    : [];
};

const emailValid = (field: BriefingFieldDef): boolean => {
  if (field.format !== "email") return true;
  const v = textFor(field.key).trim();
  return isValidEmailAddress(v);
};

const onTextInput = (field: BriefingFieldDef, event: Event) => {
  const value = (event.target as HTMLTextAreaElement).value;
  textByField.value = { ...textByField.value, [field.key]: value };
  if (field.kind === "text") {
    props.briefing.setTextField(field.key, value);
  }
};

const onAddChipFromInput = (field: BriefingFieldDef) => {
  if (field.kind !== "chips") return;
  const trimmed = textFor(field.key).trim();
  if (!trimmed) return;
  props.briefing.addChip(field.key, trimmed);
  textByField.value = { ...textByField.value, [field.key]: "" };
};

const onRemoveChip = (key: string, index: number) => {
  props.briefing.removeChip(key, index);
};

const onSampleClick = (field: BriefingFieldDef, sample: string) => {
  if (field.kind === "chips") {
    props.briefing.addChip(field.key, sample);
    return;
  }
  textByField.value = { ...textByField.value, [field.key]: sample };
  props.briefing.setTextField(field.key, sample);
};

const onAiSuggestionPick = (field: BriefingFieldDef, suggestion: string) => {
  if (field.kind !== "chips") return;
  props.briefing.addChip(field.key, suggestion);
  textByField.value = { ...textByField.value, [field.key]: "" };
};

const onKeydown = (event: KeyboardEvent, field: BriefingFieldDef) => {
  if (event.key !== "Enter" || event.shiftKey) return;
  event.preventDefault();
  if (field.kind === "chips") {
    onAddChipFromInput(field);
    return;
  }
  emit("enter-advance");
};

const accent = computed(() => props.briefing.config.accent ?? "purple");

const inputBorderClass = computed(() => {
  switch (accent.value) {
    case "emerald":
      return "border-emerald-200 focus:border-emerald-400 focus:ring-emerald-200/60";
    case "sky":
      return "border-sky-200 focus:border-sky-400 focus:ring-sky-200/60";
    case "violet":
      return "border-violet-200 focus:border-violet-400 focus:ring-violet-200/60";
    case "purple":
    default:
      return "border-purple-200 focus:border-purple-400 focus:ring-purple-200/60";
  }
});

const chipDisplayClass = computed(() => {
  switch (accent.value) {
    case "emerald":
      return "border-emerald-200 bg-emerald-50 text-emerald-900";
    case "sky":
      return "border-sky-200 bg-sky-50 text-sky-900";
    case "violet":
      return "border-violet-200 bg-violet-50 text-violet-900";
    case "purple":
    default:
      return "border-purple-200 bg-purple-50 text-purple-900";
  }
});

const sampleChipClass = computed(() => {
  switch (accent.value) {
    case "emerald":
      return "border-emerald-300 bg-white text-emerald-700 hover:bg-emerald-50";
    case "sky":
      return "border-sky-300 bg-white text-sky-700 hover:bg-sky-50";
    case "violet":
      return "border-violet-300 bg-white text-violet-700 hover:bg-violet-50";
    case "purple":
    default:
      return "border-purple-300 bg-white text-purple-700 hover:bg-purple-50";
  }
});
</script>
