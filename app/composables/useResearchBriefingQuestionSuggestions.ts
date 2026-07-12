import { computed, ref, watch, type ComputedRef, type Ref } from "vue";
import log from "@utils/logger";
import { zodToJsonSchema } from "@utils/zod-to-json-schema";
import { useGeminiByokStore } from "@stores/gemini-byok";
import {
  buildResearchQuestionSuggestionsPrompt,
  parseResearchQuestionSuggestions,
  researchQuestionSuggestionsZodObject,
} from "@utils/researchBriefingQuestionSuggestions";

const SUGGESTION_MODEL = "gemini-2.5-flash-lite";
const DEBOUNCE_MS = 650;

const RESPONSE_SCHEMA = zodToJsonSchema(researchQuestionSuggestionsZodObject);

export function useResearchBriefingQuestionSuggestions(params: {
  theme: Ref<string> | ComputedRef<string>;
  existingQuestions: Ref<string[]> | ComputedRef<string[]>;
  draftInput: Ref<string> | ComputedRef<string>;
  enabled: Ref<boolean> | ComputedRef<boolean>;
}) {
  const suggestions = ref<string[]>([]);
  const isLoading = ref(false);
  let debounceTimer: ReturnType<typeof setTimeout> | undefined;
  let requestSeq = 0;

  const canFetch = computed(
    () => params.enabled.value && params.theme.value.trim().length > 0,
  );

  const fetchSuggestions = async () => {
    if (!canFetch.value) {
      suggestions.value = [];
      return;
    }

    const seq = ++requestSeq;
    isLoading.value = true;

    try {
      const client = await useGeminiByokStore().ensureGeminiClient();
      const prompt = buildResearchQuestionSuggestionsPrompt({
        theme: params.theme.value,
        existingQuestions: params.existingQuestions.value,
        draftInput: params.draftInput.value,
      });

      const response = await client.models.generateContent({
        model: SUGGESTION_MODEL,
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        config: {
          temperature: 0.7,
          maxOutputTokens: 512,
          responseMimeType: "application/json",
          responseSchema: RESPONSE_SCHEMA,
        },
      });

      if (seq !== requestSeq) return;

      const parsed = JSON.parse(response.text ?? "{}");
      suggestions.value = parseResearchQuestionSuggestions({
        raw: parsed,
        exclude: params.existingQuestions.value,
      });
    } catch (error) {
      log("WARN", "[useResearchBriefingQuestionSuggestions] failed", error);
      if (seq === requestSeq) suggestions.value = [];
    } finally {
      if (seq === requestSeq) isLoading.value = false;
    }
  };

  const scheduleFetch = () => {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      void fetchSuggestions();
    }, DEBOUNCE_MS);
  };

  watch(
    () =>
      [
        params.enabled.value,
        params.theme.value,
        params.draftInput.value,
        params.existingQuestions.value.join("\n"),
      ] as const,
    () => {
      if (!canFetch.value) {
        suggestions.value = [];
        isLoading.value = false;
        return;
      }
      scheduleFetch();
    },
    { immediate: true },
  );

  return {
    suggestions,
    isLoading,
    refresh: fetchSuggestions,
  };
}
