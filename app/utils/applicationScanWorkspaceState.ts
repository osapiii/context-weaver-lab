export interface ApplicationScanFields {
  startUrl: string;
  loginUrl: string;
  username: string;
  password: string;
  usernameSelector: string;
  passwordSelector: string;
  submitSelector: string;
  includePatterns: string[];
  excludePatterns: string[];
  maxPages: number;
  captureScreenshots: boolean;
  fileSpaceId: string;
}

export const emptyApplicationScanFields = (): ApplicationScanFields => ({
  startUrl: "",
  loginUrl: "",
  username: "",
  password: "",
  usernameSelector: "",
  passwordSelector: "",
  submitSelector: "",
  includePatterns: [],
  excludePatterns: [],
  maxPages: 12,
  captureScreenshots: true,
  fileSpaceId: "",
});

const cleanList = (values: unknown): string[] =>
  Array.isArray(values)
    ? values
        .map((value) => (typeof value === "string" ? value.trim() : ""))
        .filter(Boolean)
        .slice(0, 20)
    : [];

const boundedMaxPages = (value: unknown): number => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 12;
  return Math.max(1, Math.min(50, Math.round(parsed)));
};

export const applicationScanModeStateToApi = (
  fields: ApplicationScanFields
): Record<string, unknown> => ({
  phase: "setup",
  setup: {
    confirmed: true,
    start_url: fields.startUrl.trim(),
    login_url: fields.loginUrl.trim() || undefined,
    username: fields.username.trim() || undefined,
    password: fields.password || undefined,
    username_selector: fields.usernameSelector.trim() || undefined,
    password_selector: fields.passwordSelector.trim() || undefined,
    submit_selector: fields.submitSelector.trim() || undefined,
    include_patterns: cleanList(fields.includePatterns),
    exclude_patterns: cleanList(fields.excludePatterns),
    max_pages: boundedMaxPages(fields.maxPages),
    capture_screenshots: fields.captureScreenshots,
    file_space_id: fields.fileSpaceId.trim() || undefined,
  },
});

export const applicationScanFieldsComplete = (
  fields: ApplicationScanFields
): boolean => fields.startUrl.trim().length > 0;

export const buildApplicationScanInitialPrompt = (
  fields: ApplicationScanFields
): string =>
  [
    "Application Scanを開始してください。",
    "",
    `開始URL: ${fields.startUrl.trim()}`,
    fields.loginUrl.trim() ? `ログインURL: ${fields.loginUrl.trim()}` : "ログインURL: なし",
    fields.username.trim() ? "ログインユーザー: 指定あり" : "ログインユーザー: なし",
    `最大ページ数: ${boundedMaxPages(fields.maxPages)}`,
    `スクリーンショット: ${fields.captureScreenshots ? "取得する" : "取得しない"}`,
    fields.fileSpaceId.trim()
      ? `Agent Search登録先 FileSpace: ${fields.fileSpaceId.trim()}`
      : "Agent Search登録先 FileSpace: 未指定",
    "",
    "URL一覧、スクリーンショット一覧、scan summaryをArtifactとして保存し、次工程のユーザーストーリー抽出でSSOTとして使える形にしてください。",
  ].join("\n");

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

export const resolveApplicationScanFieldsFromRecord = (params: {
  state: Record<string, unknown>;
}): ApplicationScanFields => {
  const bucket = params.state.application_scan;
  const setup = isRecord(bucket) && isRecord(bucket.setup) ? bucket.setup : {};
  return {
    startUrl: typeof setup.start_url === "string" ? setup.start_url : "",
    loginUrl: typeof setup.login_url === "string" ? setup.login_url : "",
    username: typeof setup.username === "string" ? setup.username : "",
    password: typeof setup.password === "string" ? setup.password : "",
    usernameSelector:
      typeof setup.username_selector === "string" ? setup.username_selector : "",
    passwordSelector:
      typeof setup.password_selector === "string" ? setup.password_selector : "",
    submitSelector:
      typeof setup.submit_selector === "string" ? setup.submit_selector : "",
    includePatterns: cleanList(setup.include_patterns),
    excludePatterns: cleanList(setup.exclude_patterns),
    maxPages: boundedMaxPages(setup.max_pages),
    captureScreenshots:
      typeof setup.capture_screenshots === "boolean"
        ? setup.capture_screenshots
        : true,
    fileSpaceId: typeof setup.file_space_id === "string" ? setup.file_space_id : "",
  };
};
