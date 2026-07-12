export type WebPageType =
  | "product_lp"
  | "service_lp"
  | "concept_lp"
  | "campaign_lp"
  | "recruit_lp"
  | "other";

export interface WebPageBuilderFields {
  purpose: string;
  pageType: WebPageType | string;
  referenceUrls: string[];
}

export const emptyWebPageBuilderFields = (): WebPageBuilderFields => ({
  purpose: "",
  pageType: "service_lp",
  referenceUrls: ["", "", ""],
});

export const normalizeWebPageReferenceUrls = (urls: unknown): string[] => {
  if (!Array.isArray(urls)) return [];
  return urls
    .slice(0, 3)
    .map((url) => (typeof url === "string" ? url.trim() : ""))
    .filter(Boolean);
};

export const webPageModeStateToApi = (
  fields: WebPageBuilderFields
): Record<string, unknown> => ({
  phase: "requirements",
  setup: {
    confirmed: true,
    purpose: fields.purpose.trim(),
    page_type: fields.pageType,
    reference_urls: normalizeWebPageReferenceUrls(fields.referenceUrls),
  },
});

export const webPageFieldsComplete = (
  fields: WebPageBuilderFields
): boolean => fields.purpose.trim().length > 0 && String(fields.pageType).trim().length > 0;

export const buildWebPageInitialPrompt = (
  fields: WebPageBuilderFields
): string => {
  const refs = normalizeWebPageReferenceUrls(fields.referenceUrls);
  return [
    "WEBページビルダーを開始してください。",
    "",
    `制作目的: ${fields.purpose.trim()}`,
    `ページタイプ: ${fields.pageType}`,
    refs.length ? `参考URL: ${refs.join(", ")}` : "参考URL: なし",
    "",
    "要件設計、ワイヤーフレーム、コーディング、素材生成の順に進め、HTMLと必要素材をArtifactとして保存してください。",
  ].join("\n");
};

export const resolveWebPageFieldsFromRecord = (params: {
  state: Record<string, unknown>;
}): WebPageBuilderFields => {
  const bucket = params.state.web_page;
  const setup =
    bucket &&
    typeof bucket === "object" &&
    !Array.isArray(bucket) &&
    typeof (bucket as Record<string, unknown>).setup === "object"
      ? ((bucket as Record<string, unknown>).setup as Record<string, unknown>)
      : {};
  return {
    purpose: typeof setup.purpose === "string" ? setup.purpose : "",
    pageType: typeof setup.page_type === "string" ? setup.page_type : "service_lp",
    referenceUrls: normalizeWebPageReferenceUrls(setup.reference_urls),
  };
};
