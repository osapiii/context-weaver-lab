import {
  businessPartnerAssistantPatchZodObject,
  type BusinessPartnerAssistantPatch,
} from "@models/businessPartnerFormAssistant";

const extractJsonText = (raw: string): string => {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/```json\s*([\s\S]*?)\s*```/);
  if (fenced) return fenced[1].trim();
  const brace = trimmed.match(/\{[\s\S]*\}/);
  return brace ? brace[0] : trimmed;
};

export const parseBusinessPartnerAdkOutput = (params: {
  output: Record<string, unknown> | null | undefined;
}): BusinessPartnerAssistantPatch | null => {
  const output = params.output;
  if (!output || typeof output !== "object") return null;

  const bp = output.businessPartner;
  if (bp && typeof bp === "object") {
    const bucket = bp as Record<string, unknown>;
    const draft = bucket.draft;
    if (draft && typeof draft === "object") {
      const parsed = businessPartnerAssistantPatchZodObject.safeParse(draft);
      if (parsed.success) return parsed.data;
    }
  }

  const draftOnly = output.businessPartnerDraft;
  if (draftOnly && typeof draftOnly === "object") {
    const parsed = businessPartnerAssistantPatchZodObject.safeParse(draftOnly);
    if (parsed.success) return parsed.data;
  }

  return null;
};

export const parseBusinessPartnerJsonDocumentBody = (
  body: string | undefined
): BusinessPartnerAssistantPatch | null => {
  if (!body?.trim()) return null;
  try {
    const json = JSON.parse(extractJsonText(body));
    const parsed = businessPartnerAssistantPatchZodObject.safeParse(json);
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
};
