export interface ApplicationScanFields {
  scanProfileId: string;
  scanProfileName: string;
  authMode: "none" | "credentials" | "email_link_manual" | "assisted_session";
  startUrl: string;
  loginUrl: string;
  username: string;
  password: string;
  authenticatedUrl: string;
  emailLinkEmail: string;
  assistedStorageStateJson: string;
  usernameSelector: string;
  passwordSelector: string;
  submitSelector: string;
  includePatterns: string[];
  excludePatterns: string[];
  maxPages: number;
  captureScreenshots: boolean;
  exploreVariants: boolean;
  maxVariantsPerScreen: number;
  maxStepsPerScreen: number;
  allowChatSend: false;
  variantOnly: boolean;
  targetScreenId: string;
  targetScreenUrl: string;
  targetRouteKey: string;
  fileSpaceId: string;
}

export const emptyApplicationScanFields = (): ApplicationScanFields => ({
  scanProfileId: "",
  scanProfileName: "Default",
  authMode: "none",
  startUrl: "",
  loginUrl: "",
  username: "",
  password: "",
  authenticatedUrl: "",
  emailLinkEmail: "",
  assistedStorageStateJson: "",
  usernameSelector: "",
  passwordSelector: "",
  submitSelector: "",
  includePatterns: [],
  excludePatterns: [],
  maxPages: 12,
  captureScreenshots: true,
  exploreVariants: false,
  maxVariantsPerScreen: 5,
  maxStepsPerScreen: 12,
  allowChatSend: false,
  variantOnly: false,
  targetScreenId: "",
  targetScreenUrl: "",
  targetRouteKey: "",
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

const boundedMaxVariantsPerScreen = (value: unknown): number => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 5;
  return Math.max(0, Math.min(10, Math.round(parsed)));
};

const boundedMaxStepsPerScreen = (value: unknown): number => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 12;
  return Math.max(1, Math.min(30, Math.round(parsed)));
};

export const applicationScanModeStateToApi = (
  fields: ApplicationScanFields
): Record<string, unknown> => ({
  phase: "setup",
  setup: {
    confirmed: true,
    scan_profile_id: fields.scanProfileId.trim() || undefined,
    scan_profile_name: fields.scanProfileName.trim() || undefined,
    auth_mode: fields.authMode,
    start_url:
      fields.authMode === "email_link_manual"
        ? undefined
        : fields.startUrl.trim() || undefined,
    login_url: fields.loginUrl.trim() || undefined,
    username: fields.authMode === "credentials" ? fields.username.trim() || undefined : undefined,
    password: fields.authMode === "credentials" ? fields.password || undefined : undefined,
    authenticated_url:
      fields.authMode === "email_link_manual"
        ? fields.authenticatedUrl.trim() || undefined
        : undefined,
    email_hint:
      fields.authMode === "email_link_manual"
        ? fields.emailLinkEmail.trim() || undefined
        : undefined,
    assisted_storage_state:
      fields.authMode === "assisted_session"
        ? parseStorageStateJson(fields.assistedStorageStateJson)
        : undefined,
    username_selector: fields.usernameSelector.trim() || undefined,
    password_selector: fields.passwordSelector.trim() || undefined,
    submit_selector: fields.submitSelector.trim() || undefined,
    include_patterns: cleanList(fields.includePatterns),
    exclude_patterns: cleanList(fields.excludePatterns),
    max_pages: boundedMaxPages(fields.maxPages),
    capture_screenshots: fields.captureScreenshots,
    explore_variants: fields.exploreVariants,
    max_variants_per_screen: boundedMaxVariantsPerScreen(
      fields.maxVariantsPerScreen
    ),
    max_steps_per_screen: boundedMaxStepsPerScreen(fields.maxStepsPerScreen),
    allow_chat_send: false,
    variant_only: fields.variantOnly,
    target_screen_id: fields.targetScreenId.trim() || undefined,
    target_screen_url: fields.targetScreenUrl.trim() || undefined,
    target_route_key: fields.targetRouteKey.trim() || undefined,
    file_space_id: fields.fileSpaceId.trim() || undefined,
  },
});

export const applicationScanFieldsComplete = (
  fields: ApplicationScanFields
): boolean =>
  fields.authMode === "email_link_manual"
    ? fields.authenticatedUrl.trim().length > 0 &&
      fields.emailLinkEmail.trim().length > 0
    : fields.authMode === "assisted_session"
      ? fields.startUrl.trim().length > 0 &&
        isValidStorageStateJson(fields.assistedStorageStateJson)
    : fields.startUrl.trim().length > 0;

export const buildApplicationScanInitialPrompt = (
  fields: ApplicationScanFields
): string =>
  [
    "Application Scanを開始してください。",
    "",
    fields.authMode !== "email_link_manual" && fields.startUrl.trim()
      ? `開始URL: ${fields.startUrl.trim()}`
      : "",
    fields.variantOnly && fields.targetScreenUrl.trim()
      ? `対象Screen URL: ${fields.targetScreenUrl.trim()}`
      : "",
    fields.loginUrl.trim() ? `ログインURL: ${fields.loginUrl.trim()}` : "ログインURL: なし",
    `認証方式: ${fields.authMode}`,
    fields.authMode === "credentials" && fields.username.trim()
      ? "ログインユーザー: 指定あり"
      : "",
    fields.authMode === "email_link_manual" && fields.authenticatedUrl.trim()
      ? "認証済みURL: 指定あり"
      : "",
    fields.authMode === "email_link_manual" && fields.emailLinkEmail.trim()
      ? "リンク送信先メール: 指定あり"
      : "",
    fields.authMode === "assisted_session"
      ? `補助ログインセッション: ${isValidStorageStateJson(fields.assistedStorageStateJson) ? "指定あり" : "未指定"}`
      : "",
    `最大ページ数: ${boundedMaxPages(fields.maxPages)}`,
    `スクリーンショット: ${fields.captureScreenshots ? "取得する" : "取得しない"}`,
    `探索モード: ${fields.variantOnly ? "対象ScreenのVariant探索のみ" : "Screen Atlas全体スキャン"}`,
    `Variant探索: ${fields.exploreVariants ? "有効" : "無効"}`,
    fields.exploreVariants
      ? `最大Variant数/画面: ${boundedMaxVariantsPerScreen(fields.maxVariantsPerScreen)}`
      : "",
    fields.exploreVariants
      ? `最大操作数/画面: ${boundedMaxStepsPerScreen(fields.maxStepsPerScreen)}`
      : "",
    fields.fileSpaceId.trim()
      ? `Agent Search登録先 FileSpace: ${fields.fileSpaceId.trim()}`
      : "Agent Search登録先 FileSpace: 未指定",
    "",
    "URL一覧、スクリーンショット一覧、Screen Atlas summaryをArtifactとして保存し、次工程のユーザーストーリー抽出でSSOTとして使える形にしてください。",
  ]
    .filter(Boolean)
    .join("\n");

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const parseStorageStateJson = (value: string): Record<string, unknown> | undefined => {
  try {
    const parsed = JSON.parse(value);
    return isRecord(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
};

export const isValidStorageStateJson = (value: string): boolean => {
  const parsed = parseStorageStateJson(value);
  if (!parsed) return false;
  return Array.isArray(parsed.cookies) || Array.isArray(parsed.origins);
};

export const resolveApplicationScanFieldsFromRecord = (params: {
  state: Record<string, unknown>;
}): ApplicationScanFields => {
  const bucket = params.state.application_scan;
  const setup = isRecord(bucket) && isRecord(bucket.setup) ? bucket.setup : {};
  return {
    scanProfileId:
      typeof setup.scan_profile_id === "string" ? setup.scan_profile_id : "",
    scanProfileName:
      typeof setup.scan_profile_name === "string"
        ? setup.scan_profile_name
        : "Default",
    authMode:
      setup.auth_mode === "credentials" ||
      setup.auth_mode === "email_link_manual" ||
      setup.auth_mode === "assisted_session"
        ? setup.auth_mode
        : "none",
    startUrl: typeof setup.start_url === "string" ? setup.start_url : "",
    loginUrl: typeof setup.login_url === "string" ? setup.login_url : "",
    username: typeof setup.username === "string" ? setup.username : "",
    password: typeof setup.password === "string" ? setup.password : "",
    authenticatedUrl:
      typeof setup.authenticated_url === "string" ? setup.authenticated_url : "",
    emailLinkEmail:
      typeof setup.email_hint === "string" ? setup.email_hint : "",
    assistedStorageStateJson: isRecord(setup.assisted_storage_state)
      ? JSON.stringify(setup.assisted_storage_state, null, 2)
      : "",
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
    exploreVariants:
      typeof setup.explore_variants === "boolean" ? setup.explore_variants : false,
    maxVariantsPerScreen: boundedMaxVariantsPerScreen(
      setup.max_variants_per_screen
    ),
    maxStepsPerScreen: boundedMaxStepsPerScreen(setup.max_steps_per_screen),
    allowChatSend: false,
    variantOnly: typeof setup.variant_only === "boolean" ? setup.variant_only : false,
    targetScreenId:
      typeof setup.target_screen_id === "string" ? setup.target_screen_id : "",
    targetScreenUrl:
      typeof setup.target_screen_url === "string" ? setup.target_screen_url : "",
    targetRouteKey:
      typeof setup.target_route_key === "string" ? setup.target_route_key : "",
    fileSpaceId: typeof setup.file_space_id === "string" ? setup.file_space_id : "",
  };
};
