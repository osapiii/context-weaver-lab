import { useRoute } from "vue-router";
import { useGlobalLoadingNavigation } from "@composables/useGlobalLoadingNavigation";
import type { AiStudioJobKind } from "@stores/aiStudio";
import {
  AI_STUDIO_HUB_KIND_FILTER_ALL,
  aiStudioHubKindToQuery,
  isAiStudioHubJobKind,
  type AiStudioHubKindFilter,
} from "@constants/aiStudioHub";

const DEFAULT_KIND_FILTER: AiStudioHubKindFilter = AI_STUDIO_HUB_KIND_FILTER_ALL;

const toKindFilter = (
  kind?: AiStudioJobKind | AiStudioHubKindFilter | null
): AiStudioHubKindFilter => {
  if (!kind || kind === AI_STUDIO_HUB_KIND_FILTER_ALL) {
    return AI_STUDIO_HUB_KIND_FILTER_ALL;
  }
  if (isAiStudioHubJobKind(kind)) {
    return kind;
  }
  return DEFAULT_KIND_FILTER;
};

/**
 * ヘッダー / Cmd+K / 仕事をこなすカードから AIスタジオ TOP を開く.
 * Workspace は起動せず、ハブで種別フィルタだけ効かせる.
 */
export function useAiStudioLauncher() {
  const route = useRoute();
  const { pushWithGlobalLoading, replaceWithGlobalLoading } =
    useGlobalLoadingNavigation();

  const openAiStudio = async (params?: {
    /** @deprecated `kind` を使用 */
    preferred?: AiStudioJobKind | null;
    kind?: AiStudioJobKind | AiStudioHubKindFilter | null;
  }): Promise<void> => {
    const kindFilter = toKindFilter(
      params?.kind ?? params?.preferred ?? DEFAULT_KIND_FILTER
    );
    const kindQuery = aiStudioHubKindToQuery(kindFilter);
    const query: Record<string, string> = {};
    if (kindQuery?.kind) {
      query.kind = kindQuery.kind;
    }

    if (route.name !== "admin-ai-studio") {
      await pushWithGlobalLoading({
        name: "admin-ai-studio",
        query,
      });
      return;
    }

    await replaceWithGlobalLoading({
      name: "admin-ai-studio",
      query,
    });
  };

  return { openAiStudio };
}

/** @deprecated use useAiStudioLauncher */
export function useBusinessConsultationLauncher() {
  const { openAiStudio } = useAiStudioLauncher();
  return {
    openBusinessConsultation: () =>
      openAiStudio({ kind: "consultation" }),
  };
}
