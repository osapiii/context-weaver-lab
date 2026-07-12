import { getApp } from "firebase/app";
import { getFunctions, httpsCallable } from "firebase/functions";

const FUNCTIONS_REGION = "asia-northeast1";

export type AskEnAiStudioGuideRequest = {
  prompt: string;
  guideContext?: string;
};

export type EnAiStudioGuideAutoNavigation =
  | {
      kind: "route";
      label: string;
      routeName: string;
    }
  | {
      kind: "launcher";
      label: string;
      launcherKey: string;
    };

export type AskEnAiStudioGuideResponse = {
  text: string;
  groundingMetadata?: unknown;
  autoNavigation?: EnAiStudioGuideAutoNavigation | null;
};

const NAVIGATION_LINK_RE =
  /\[([^\]]{1,80})\]\((route|launcher):([A-Za-z0-9_-]+)\)/;

export const extractGuideAutoNavigation = (
  text: string
): EnAiStudioGuideAutoNavigation | null => {
  const match = NAVIGATION_LINK_RE.exec(text ?? "");
  if (!match) return null;
  const rawLabel = match[1];
  const kind = match[2];
  const target = match[3];
  if (!rawLabel || !target || (kind !== "route" && kind !== "launcher")) {
    return null;
  }
  const label = rawLabel.trim();
  if (kind === "route") {
    return {
      kind,
      label,
      routeName: target.trim(),
    };
  }
  return {
    kind,
    label,
    launcherKey: target.trim(),
  };
};

const normalizeAutoNavigation = (
  value: unknown
): EnAiStudioGuideAutoNavigation | null => {
  if (!value || typeof value !== "object") return null;
  const data = value as Record<string, unknown>;
  const kind = data.kind;
  const label = String(data.label ?? "").trim();
  if (!label) return null;
  if (kind === "route") {
    const routeName = String(data.routeName ?? "").trim();
    return routeName ? { kind, label, routeName } : null;
  }
  if (kind === "launcher") {
    const launcherKey = String(data.launcherKey ?? "").trim();
    return launcherKey ? { kind, label, launcherKey } : null;
  }
  return null;
};

export const askEnAiStudioGuide = async (
  request: AskEnAiStudioGuideRequest
): Promise<AskEnAiStudioGuideResponse> => {
  const functions = getFunctions(getApp(), FUNCTIONS_REGION);
  const callable = httpsCallable<
    AskEnAiStudioGuideRequest,
    AskEnAiStudioGuideResponse
  >(functions, "ask_en_aistudio_guide");
  const result = await callable(request);
  const text = String(result.data?.text ?? "");
  return {
    text,
    groundingMetadata: result.data?.groundingMetadata,
    autoNavigation:
      normalizeAutoNavigation(result.data?.autoNavigation) ??
      extractGuideAutoNavigation(text),
  };
};
