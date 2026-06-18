import type { AgentSseArtifact } from "@composables/useAgentSseClient";
import {
  extractSourceReferences,
  type ConsultationSourceReference,
} from "@utils/consultationSourceReferences";
import { hasGroundingMetadata } from "@utils/adkGrounding";

export function isCitationArtifact(
  artifact: AgentSseArtifact
): artifact is AgentSseArtifact & {
  kind: "citation";
  title: string;
} {
  return artifact.kind === "citation" && typeof artifact.title === "string";
}

/** ADK citation artifact を吹き出し下 reference カード用に変換 */
export function citationArtifactsToSourceReferences(
  artifacts?: AgentSseArtifact[] | null
): ConsultationSourceReference[] {
  if (!artifacts?.length) return [];

  return artifacts.filter(isCitationArtifact).map((artifact) => {
    const uri = artifact.citationUri ?? null;
    const isWeb = !!uri && /^https?:\/\//i.test(uri);
    return {
      sourceType: isWeb ? "webSearch" : "fileSearch",
      displayName: artifact.title,
      uri,
      reason: artifact.snippet ?? null,
    };
  });
}

/** citation artifact / grounding / legacy refs を統合 */
export function resolveMessageSourceReferences(params: {
  artifacts?: AgentSseArtifact[] | null;
  sourceReferences?: ConsultationSourceReference[] | null;
  groundingMetadata?: unknown;
}): ConsultationSourceReference[] {
  const merged: ConsultationSourceReference[] = [];
  const seen = new Set<string>();

  const push = (ref: ConsultationSourceReference) => {
    const key =
      ref.documentId ||
      ref.uri ||
      ref.displayName ||
      ref.reason?.slice(0, 80) ||
      "";
    if (!key || seen.has(key)) return;
    seen.add(key);
    merged.push(ref);
  };

  for (const ref of citationArtifactsToSourceReferences(params.artifacts)) {
    push(ref);
  }
  for (const ref of extractSourceReferences({
    sourceReferences: params.sourceReferences,
    groundingMetadata: params.groundingMetadata,
  })) {
    push(ref);
  }
  return merged;
}

export function messageHasReferenceSources(params: {
  artifacts?: AgentSseArtifact[] | null;
  sourceReferences?: ConsultationSourceReference[] | null;
  groundingMetadata?: unknown;
}): boolean {
  if (citationArtifactsToSourceReferences(params.artifacts).length > 0) {
    return true;
  }
  if (params.sourceReferences?.length) return true;
  return hasGroundingMetadata(
    params.groundingMetadata as Record<string, unknown> | null | undefined
  );
}
