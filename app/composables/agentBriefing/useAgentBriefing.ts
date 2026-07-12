import { computed, reactive, ref, watch } from "vue";

import log from "@utils/logger";
import { isValidEmailAddress } from "@utils/emailAddress";

import type {
  BriefingDraft,
  BriefingDraftValue,
  BriefingFieldDef,
  BriefingFlowConfig,
  BriefingPersistedState,
} from "./types";

const STORAGE_PREFIX = "en-aistudio:agentBriefing";

/**
 * Generic state machine for a multi-step "agent job briefing" flow.
 *
 * Holds (step, draft) reactive state and persists drafts to localStorage so
 * they survive page reloads. The shape of the draft is dictated by the
 * passed-in ``BriefingFlowConfig``.
 *
 * Returns reactive state + actions consumed by ``AgentBriefingSession`` and
 * its child components.
 */
export const useAgentBriefing = (config: BriefingFlowConfig) => {
  const totalSteps = computed(() =>
    Math.max(0, ...config.fields.map((f) => f.step))
  );
  /** ``finalizeStep`` = totalSteps + 1 (confirm screen). */
  const finalizeStep = computed(() => totalSteps.value + 1);

  const step = ref<number>(1);
  const draft = reactive<BriefingDraft>(emptyDraft(config));
  /** True after the user has confirmed the draft and dispatched to the agent. */
  const isComplete = ref<boolean>(false);
  /** Set when the user opted out via the skip-link. */
  const isSkipped = ref<boolean>(false);

  // ------------------------------------------------------------------
  // Persistence: localStorage round-trip per config.id
  // ------------------------------------------------------------------
  const storageKey = `${STORAGE_PREFIX}:${config.id}`;
  const skippedKey = `${storageKey}:skipped`;

  const hydrate = () => {
    if (typeof window === "undefined") return;
    try {
      const skippedRaw = localStorage.getItem(skippedKey);
      if (skippedRaw === "1") {
        isSkipped.value = true;
      }
      const raw = localStorage.getItem(storageKey);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Partial<BriefingPersistedState>;
      if (parsed.draft && typeof parsed.draft === "object") {
        const rawDraft = parsed.draft as BriefingDraft;
        if (
          config.id === "researchAgent" &&
          !Array.isArray(rawDraft.doubts) &&
          Array.isArray(rawDraft.concerns)
        ) {
          rawDraft.doubts = rawDraft.concerns.filter(
            (x): x is string => typeof x === "string",
          );
        }
        for (const field of config.fields) {
          const v = rawDraft[field.key];
          if (field.kind === "text" && typeof v === "string") {
            (draft as BriefingDraft)[field.key] = v;
          }
          if (field.kind === "chips" && Array.isArray(v)) {
            (draft as BriefingDraft)[field.key] = v.filter(
              (x): x is string => typeof x === "string",
            );
          }
        }
      }
      if (typeof parsed.step === "number" && parsed.step >= 1) {
        step.value = Math.min(parsed.step, finalizeStep.value);
      }
    } catch (e) {
      log("WARN", "[agentBriefing] hydrate failed", e);
    }
  };

  const persist = () => {
    if (typeof window === "undefined") return;
    try {
      const payload: BriefingPersistedState = {
        draft: JSON.parse(JSON.stringify(draft)),
        step: step.value,
      };
      localStorage.setItem(storageKey, JSON.stringify(payload));
    } catch (e) {
      log("WARN", "[agentBriefing] persist failed", e);
    }
  };

  const clearStorage = () => {
    if (typeof window === "undefined") return;
    try {
      localStorage.removeItem(storageKey);
    } catch {
      // ignore
    }
  };

  watch(draft, () => persist(), { deep: true });
  watch(step, () => persist());

  // ------------------------------------------------------------------
  // Field helpers
  // ------------------------------------------------------------------
  const fieldsByStep = computed(() => {
    const acc: Record<number, BriefingFieldDef[]> = {};
    for (const f of config.fields) {
      acc[f.step] ??= [];
      acc[f.step]!.push(f);
    }
    return acc;
  });

  const currentFields = computed(() => fieldsByStep.value[step.value] ?? []);

  const isFieldFilled = (field: BriefingFieldDef): boolean => {
    const v = (draft as BriefingDraft)[field.key];
    if (field.kind === "text") {
      if (typeof v !== "string" || v.trim().length === 0) return false;
      if (field.format === "email") return isValidEmailAddress(v);
      return true;
    }
    if (field.kind === "chips") return Array.isArray(v) && v.length > 0;
    return false;
  };

  const isCurrentStepFilled = computed(() =>
    currentFields.value.every(
      (field) => field.optional === true || isFieldFilled(field),
    ),
  );

  const filledFieldCount = computed(
    () => config.fields.filter(isFieldFilled).length
  );

  // ------------------------------------------------------------------
  // Mutators
  // ------------------------------------------------------------------
  const setTextField = (key: string, value: string) => {
    (draft as BriefingDraft)[key] = value;
  };

  const addChip = (key: string, value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return;
    const current = (draft as BriefingDraft)[key];
    const arr = Array.isArray(current) ? current : [];
    if (arr.includes(trimmed)) return;
    (draft as BriefingDraft)[key] = [...arr, trimmed];
  };

  const removeChip = (key: string, index: number) => {
    const current = (draft as BriefingDraft)[key];
    if (!Array.isArray(current)) return;
    (draft as BriefingDraft)[key] = current.filter((_, i) => i !== index);
  };

  // ------------------------------------------------------------------
  // Navigation
  // ------------------------------------------------------------------
  const advance = () => {
    if (step.value >= finalizeStep.value) return;
    step.value += 1;
  };

  const back = () => {
    if (step.value <= 1) return;
    step.value -= 1;
  };

  const goTo = (target: number) => {
    if (target < 1 || target > finalizeStep.value) return;
    step.value = target;
  };

  const reset = () => {
    step.value = 1;
    isComplete.value = false;
    isSkipped.value = false;
    for (const f of config.fields) {
      (draft as BriefingDraft)[f.key] = f.kind === "chips" ? [] : "";
    }
    clearStorage();
    if (typeof window !== "undefined") {
      try {
        localStorage.removeItem(skippedKey);
      } catch {
        // ignore
      }
    }
  };

  const skip = () => {
    isSkipped.value = true;
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem(skippedKey, "1");
      } catch {
        // ignore
      }
    }
  };

  // ------------------------------------------------------------------
  // Finalize
  // ------------------------------------------------------------------
  const buildPrompt = (): string => config.buildPrompt(snapshotDraft());

  const snapshotDraft = (): BriefingDraft =>
    JSON.parse(JSON.stringify(draft)) as BriefingDraft;

  /**
   * Mark the briefing complete and clear persistence.
   * Returns the compiled prompt — callers can hand it to their agent send().
   */
  const finalize = (): string => {
    const prompt = buildPrompt();
    isComplete.value = true;
    clearStorage();
    return prompt;
  };

  return {
    // config (for components to read labels / accents)
    config,
    // reactive state
    step,
    draft,
    isComplete,
    isSkipped,
    // derived
    totalSteps,
    finalizeStep,
    currentFields,
    fieldsByStep,
    isCurrentStepFilled,
    filledFieldCount,
    // mutators
    setTextField,
    addChip,
    removeChip,
    // navigation
    advance,
    back,
    goTo,
    reset,
    skip,
    // lifecycle
    hydrate,
    persist,
    // finalize
    buildPrompt,
    finalize,
    snapshotDraft,
    // utilities for components
    isFieldFilled,
  };
};

export type AgentBriefingHandle = ReturnType<typeof useAgentBriefing>;

const emptyDraft = (config: BriefingFlowConfig): BriefingDraft => {
  const d: BriefingDraft = {};
  for (const f of config.fields) {
    d[f.key] = (f.kind === "chips" ? [] : "") as BriefingDraftValue;
  }
  return d;
};
