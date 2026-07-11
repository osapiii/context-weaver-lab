import { resolve, dirname  } from "path";
import { fileURLToPath } from "url";
import { existsSync } from "fs";
import { config } from "dotenv";
import checker from "vite-plugin-checker";
import {
  SITE_DESCRIPTION,
  SITE_FAVICON_LINKS,
  SITE_NAME,
  SITE_URL,
} from "./constants/siteSeo";
import {
  DRIVE_TO_GCS_SYNC_SERVICE_URL,
  GOOGLE_DRIVE_WORKFLOW_KICKER_URL,
} from "./constants/googleDriveServices";
import { WEB_CRAWL_WORKFLOW_KICKER_URL } from "./constants/webCrawlServices";

// 環境変数の読み込み（--dotenvフラグで指定されたファイルを読み込む）
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const envFile =
  process.env.NUXT_DOTENV_FILE || resolve(__dirname, "./.env.local");
if (existsSync(envFile)) {
  config({ path: envFile });
}

/** 明示的 true のときだけ Emulator プラグインを読み込む（デフォルトは実 Firebase） */
const useFirebaseEmulator =
  process.env.NUXT_PUBLIC_USE_FIREBASE_EMULATOR === "true";
const firebaseProjectId = process.env.NUXT_PUBLIC_FIREBASECONFIG_PROJECTID || "";
const devAuthBypassDefaultProjects = new Set([
  "storyvault-dev",
  "en-aistudio-development",
]);
const defaultDevAuthBypassEmails =
  devAuthBypassDefaultProjects.has(firebaseProjectId) ||
  (firebaseProjectId && firebaseProjectId !== "en-aistudio-production")
    ? "super@enostech.co.jp"
    : "";
const devAuthBypassEmails =
  process.env.NUXT_PUBLIC_DEV_AUTH_BYPASS_EMAILS ||
  defaultDevAuthBypassEmails;
const devAuthBypassEnabled =
  process.env.NUXT_PUBLIC_DEV_AUTH_BYPASS_ENABLED ||
  (devAuthBypassEmails ? "true" : "false");
const defaultDatadogEnv =
  firebaseProjectId === "en-aistudio-production" ||
  process.env.NODE_ENV === "production"
    ? "prod"
    : "dev";
const datadogEnv = process.env.NUXT_PUBLIC_DATADOG_ENV || defaultDatadogEnv;

// プロジェクトルート（app ディレクトリの親）のパス
const projectRoot = resolve(__dirname, "..");
const backendPath = resolve(projectRoot, "backend");
const dumpsPath = resolve(projectRoot, "dumps");

export default defineNuxtConfig({
  future: {
    compatibilityVersion: 4,
  },
  compatibilityDate: "2025-10-18",
  ssr: false,

  // ファイル監視から除外するパス
  ignore: [
    "../backend/**",
    "../dumps/**",
    "backend/**", // app/backend シンボリックリンクを除外
    "**/venv/**",
    "**/__pycache__/**",
    "**/.venv/**",
    "pages/admin/ai-chat.vue",
    "pages/admin/ai-studio.vue",
    "pages/admin/business-partners/**",
    "pages/admin/help.vue",
    "pages/admin/images.vue",
    "pages/admin/oauth/**",
    "pages/admin/research-agent.vue",
    "pages/admin/researches.vue",
    "pages/admin/sheets.vue",
    "pages/admin/storage.vue",
    "pages/admin/work.vue",
    "pages/admin/writings.vue",
  ],

  colorMode: {
    preference: "light",
  },

  css: [
    "~/assets/css/main.css",
    // EN AIstudio 共通 Markdown prose スタイル
    "~/assets/css/en-aistudio-prose.css",
    // highlight.js (fenced code のシンタックスハイライト)
    "highlight.js/styles/github.css",
  ],

  components: [
    {
      path: "~/components",
      pathPrefix: false,
    },
  ],

  app: {
    head: {
      title: SITE_NAME,
      htmlAttrs: {
        lang: "ja",
      },
      // タブレット (iPad 等) で正しいスケールで表示するための viewport 設定を明示。
      // ピンチズームは無効化しない (アクセシビリティ確保)。viewport-fit=cover で
      // ノッチ/ホームインジケータ領域も safe-area で扱えるようにする。
      charset: "utf-8",
      viewport: "width=device-width, initial-scale=1, viewport-fit=cover",
      meta: [
        {
          name: "description",
          content: SITE_DESCRIPTION,
        },
        {
          name: "theme-color",
          content: "#0F172A",
        },
        {
          property: "og:site_name",
          content: SITE_NAME,
        },
        {
          property: "og:type",
          content: "website",
        },
        {
          property: "og:title",
          content: SITE_NAME,
        },
        {
          property: "og:description",
          content: SITE_DESCRIPTION,
        },
        {
          property: "og:url",
          content: SITE_URL,
        },
        {
          name: "twitter:card",
          content: "summary",
        },
        {
          name: "twitter:title",
          content: SITE_NAME,
        },
        {
          name: "twitter:description",
          content: SITE_DESCRIPTION,
        },
      ],
      link: [
        ...SITE_FAVICON_LINKS,
        {
          rel: "preconnect",
          href: "https://fonts.googleapis.com",
        },
      ],
      script: [],
    },
  },

  devtools: {
    enabled: false,
  },

  plugins: [
    "~/plugins/datadog.client.ts",
    "~/plugins/errorHandle.ts",
    "~/plugins/loader.ts",
    ...(useFirebaseEmulator
      ? ["~/infrastructure/firebase-emulator.client.ts"]
      : []),
  ],

  // devServer: {
  //   https: {
  //     key: resolve(__dirname, "./localhost.key"),
  //     cert: resolve(__dirname, "./localhost.crt"),
  //   },
  // },

  modules: [
    "@nuxt/ui", // UI foundation
    "@nuxt/test-utils/module", // Vitest integration helpers
    "@nuxt/eslint", // ESLint configuration
    "@pinia/nuxt", // State management
    "@nuxt/image", // Image optimisation
    "@nuxtjs/mdc", // Markdown components
    "@nuxt/icon", // Icon component support
    "nuxt-vuefire", // Firebase integration
    "@nuxtjs/google-fonts", // Google Fonts loader
    "@vueuse/nuxt", // VueUse composables
    "floating-vue/nuxt", // Floating UI components
    "dayjs-nuxt", // Day.js utilities
  ],

  // Phase R-1: 手書き風フォント (Caveat) を data-source 画面の装飾矢印で使用
  googleFonts: {
    families: {
      Caveat: [400, 600, 700],
    },
    display: "swap",
    preload: true,
  },

  // Nuxt Image設定: Firebase Hostingのような静的ホスティング環境では
  // IPXサーバーが動作しないため、画像最適化を無効にして元の画像をそのまま使用
  image: {
    provider: 'none', // 静的ホスティング環境では最適化を無効化
  },

  vuefire: {
    auth: {
      enabled: true,
    },
    firestore: {
      ignoreUndefinedProperties: true,
    },
    config: {
      apiKey: process.env.NUXT_PUBLIC_FIREBASECONFIG_APIKEY,
      authDomain: process.env.NUXT_PUBLIC_FIREBASECONFIG_AUTHDOMEIN,
      projectId: process.env.NUXT_PUBLIC_FIREBASECONFIG_PROJECTID,
      storageBucket: process.env.NUXT_PUBLIC_FIREBASECONFIG_STORAGEBUCKET,
      appId: process.env.NUXT_PUBLIC_FIREBASECONFIG_APPID,
    },
  },

  runtimeConfig: {
    public: {
      /** "true" のときのみ Emulator（local:dev:emulator / E2E）。未設定は実 Firebase */
      useFirebaseEmulator: useFirebaseEmulator ? "true" : "false",
      environment: process.env.NODE_ENV ?? "development",
      /** Firebase App Check (Web / reCAPTCHA Enterprise) public site key. */
      firebaseAppCheckRecaptchaEnterpriseSiteKey:
        process.env.NUXT_PUBLIC_FIREBASE_APPCHECK_RECAPTCHA_ENTERPRISE_SITE_KEY || "",
      /** Google Workspace OAuth auth-code flow client id. Secret is backend-only. */
      googleWorkspaceOAuthClientId:
        process.env.NUXT_PUBLIC_GOOGLE_WORKSPACE_OAUTH_CLIENT_ID || "",
      /** GitHub OAuth client id. Secret and tokens are backend-only. */
      githubOAuthClientId:
        process.env.NUXT_PUBLIC_GITHUB_OAUTH_CLIENT_ID || "",
      /** GitHub OAuth callback URL. Localhost is normalized in the client when omitted. */
      githubOAuthRedirectUri:
        process.env.NUXT_PUBLIC_GITHUB_OAUTH_REDIRECT_URI || "",
      /** Slack OAuth client id. Secret and tokens are backend-only. */
      slackOAuthClientId:
        process.env.NUXT_PUBLIC_SLACK_OAUTH_CLIENT_ID || "",
      /** Slack OAuth callback URL. Localhost is normalized in the client when omitted. */
      slackOAuthRedirectUri:
        process.env.NUXT_PUBLIC_SLACK_OAUTH_REDIRECT_URI || "",
      /** Atlassian Jira Cloud OAuth 2.0 (3LO) client id. */
      jiraOAuthClientId:
        process.env.NUXT_PUBLIC_JIRA_OAUTH_CLIENT_ID || "",
      /** Jira OAuth callback URL. Localhost is normalized in the client when omitted. */
      jiraOAuthRedirectUri:
        process.env.NUXT_PUBLIC_JIRA_OAUTH_REDIRECT_URI || "",
      /** StoryVault remote MCP endpoint for coding agents. */
      storyVaultMcpUrl:
        process.env.NUXT_PUBLIC_STORYVAULT_MCP_URL ||
        "https://storyvault-mcp-mdgjayj74q-an.a.run.app/mcp",
      /** Optional override for the StoryVault Codex Skill install command shown in settings. */
      storyVaultSkillInstallCommand:
        process.env.NUXT_PUBLIC_STORYVAULT_SKILL_INSTALL_COMMAND || "",
      /** Gシート連携: ユーザーが「編集者」で招待する SA（ui-backend の .cred.json と一致） */
      gsheetServiceAccountEmail:
        process.env.NUXT_PUBLIC_GSHEET_SERVICE_ACCOUNT_EMAIL ||
        "en-aistudio-nkm-service-agent@en-aistudio-development.iam.gserviceaccount.com",
      firebase: {
        apiKey: process.env.NUXT_PUBLIC_FIREBASECONFIG_APIKEY,
        authDomain: process.env.NUXT_PUBLIC_FIREBASECONFIG_AUTHDOMEIN,
        projectId: process.env.NUXT_PUBLIC_FIREBASECONFIG_PROJECTID,
        storageBucket: process.env.NUXT_PUBLIC_FIREBASECONFIG_STORAGEBUCKET,
        appId: process.env.NUXT_PUBLIC_FIREBASECONFIG_APPID,
      },
      devAuthBypass: {
        enabled: devAuthBypassEnabled,
        emails: devAuthBypassEmails,
      },
      datadog: {
        applicationId: process.env.NUXT_PUBLIC_DATADOG_APPLICATIONID || "",
        clientToken: process.env.NUXT_PUBLIC_DATADOG_CLIENTTOKEN || "",
        site: process.env.NUXT_PUBLIC_DATADOG_SITE || "ap1.datadoghq.com",
        service:
          process.env.NUXT_PUBLIC_DATADOG_SERVICE ||
          "storyvault-frontend",
        env: datadogEnv,
        version:
          process.env.NUXT_PUBLIC_APP_VERSION ||
          process.env.npm_package_version ||
          "",
      },
      // Gemini は BYOK のみ (useGeminiByokStore). env フォールバックは廃止.
      // Drive → GCS Sync microservice (drive-to-gcs-sync) の単一 URL.
      // 取り込みは Workflows 経由 (kicker microservice)、FE は /scan/* のみを叩く.
      driveToGcsSyncServiceUrl: DRIVE_TO_GCS_SYNC_SERVICE_URL,
      // Google Drive Workflow Kicker. UI からは debug 用に /inspect-input のみ叩く.
      googleDriveWorkflowKickerServiceUrl:
        process.env.NUXT_PUBLIC_GOOGLE_DRIVE_WORKFLOW_KICKER_URL ||
        GOOGLE_DRIVE_WORKFLOW_KICKER_URL,
      webCrawlWorkflowKickerServiceUrl:
        process.env.NUXT_PUBLIC_WEB_CRAWL_WORKFLOW_KICKER_URL ||
        WEB_CRAWL_WORKFLOW_KICKER_URL,
      // ENOSTECH リサーチエージェント (ADK) (Cloud Run) の URL.
      // 各ユーザーが EN AIstudio 設定で登録した Gemini API キー (BYOK) を使って動く.
      researchAgentServiceUrl:
        process.env.NUXT_PUBLIC_RESEARCH_AGENT_SERVICE_URL ||
        process.env.NUXT_PUBLIC_EN_AISTUDIO_ADK_BASE_URL ||
        "https://en-aistudio-adk-agent-mdgjayj74q-an.a.run.app",
      // データ分析エージェント (Cloud Run, Conversational Analytics API のラッパー) の URL.
      // setup_org_bq.py で provisioning した 1 org = 1 Data Agent を呼び出す.
      dataAnalystServiceUrl:
        process.env.NUXT_PUBLIC_DATA_ANALYST_SERVICE_URL ||
        "",
      // EN AIstudio ADK 統合エージェント (unified Cloud Run) のベース URL.
      // 末尾スラッシュなし. クライアントは {base}/v1/agents/{mode}/invoke を叩く.
      // unified 未設定時は mode 別 URL (legacy per-service deploy) にフォールバック.
      enAiStudioAdkBaseUrl:
        process.env.NUXT_PUBLIC_EN_AISTUDIO_ADK_BASE_URL ||
        "https://en-aistudio-adk-agent-mdgjayj74q-an.a.run.app",
      enAiStudioAdkWritingUrl:
        process.env.NUXT_PUBLIC_EN_AISTUDIO_ADK_WRITING_URL ||
        "https://en-aistudio-writing-agent-mdgjayj74q-an.a.run.app",
      enAiStudioAdkSheetUrl:
        process.env.NUXT_PUBLIC_EN_AISTUDIO_ADK_SHEET_URL ||
        "https://en-aistudio-sheet-agent-mdgjayj74q-an.a.run.app",
      enAiStudioAdkImageUrl:
        process.env.NUXT_PUBLIC_EN_AISTUDIO_ADK_IMAGE_URL ||
        "https://en-aistudio-image-agent-mdgjayj74q-an.a.run.app",
      enAiStudioAdkConsultationUrl:
        process.env.NUXT_PUBLIC_EN_AISTUDIO_ADK_CONSULTATION_URL ||
        process.env.NUXT_PUBLIC_EN_AISTUDIO_ADK_BASE_URL ||
        "https://en-aistudio-consultation-agent-mdgjayj74q-an.a.run.app",
      enAiStudioAdkStoryVaultZappingAnalysisUrl:
        process.env.NUXT_PUBLIC_EN_AISTUDIO_ADK_STORYVAULT_ZAPPING_ANALYSIS_URL ||
        process.env.NUXT_PUBLIC_EN_AISTUDIO_ADK_BASE_URL ||
        "https://storyvault-zapping-analysis-agent-mdgjayj74q-an.a.run.app",
      enAiStudioAdkStoryVaultCapabilityStructuringUrl:
        process.env.NUXT_PUBLIC_EN_AISTUDIO_ADK_STORYVAULT_CAPABILITY_STRUCTURING_URL ||
        process.env.NUXT_PUBLIC_EN_AISTUDIO_ADK_BASE_URL ||
        "https://storyvault-capability-structuring-agent-mdgjayj74q-an.a.run.app",
      enAiStudioAdkStoryVaultStoryGenerationUrl:
        process.env.NUXT_PUBLIC_EN_AISTUDIO_ADK_STORYVAULT_STORY_GENERATION_URL ||
        process.env.NUXT_PUBLIC_EN_AISTUDIO_ADK_BASE_URL ||
        "https://storyvault-story-generation-agent-mdgjayj74q-an.a.run.app",
      /** false 明示時のみ legacy SSE。デフォルトは RequestDoc + Firebase trigger */
      adkInvokeViaRequestDoc:
        process.env.NUXT_PUBLIC_ADK_INVOKE_VIA_REQUEST_DOC !== "false",
      /** ADK GcsArtifactService のバケット（Functions ingest 前の表示フォールバック） */
      enAiStudioAdkArtifactBucket:
        process.env.NUXT_PUBLIC_ADK_ARTIFACT_BUCKET ||
        "storyvault-dev-adk-artifacts",
      // 取引先プロファイル自動取得 (法人番号 / 公式URL → 概要・所在地・資本金・代表者)
      // Cloud Run `corporate-info-lookup` の POST /lookup URL を設定 (推奨)。
      // 例: NUXT_PUBLIC_CORPORATE_INFO_LOOKUP_ENDPOINT=https://...run.app/lookup
      // 未設定時は gBizINFO 直接呼び出し (gbizInfoApiToken) にフォールバック。
      corporateInfoLookupEndpoint:
        process.env.NUXT_PUBLIC_CORPORATE_INFO_LOOKUP_ENDPOINT ||
        "",
      // フロント直叩き用フォールバック (本番は Cloud Run 側 GBIZ_INFO_API_TOKEN 推奨)
      gbizInfoApiToken:
        process.env.NUXT_PUBLIC_GBIZ_INFO_API_TOKEN ||
        "JX51WSf4NmlpDiHOxHZyPCO3P7m9qnEW",
    },
  },

  vite: {
    optimizeDeps: {
      include: [
        "echarts/core",
        "echarts/renderers",
        "echarts/charts",
        "echarts/components",
        "vue-echarts",
        "vue-cal",
        "@tanstack/vue-table",
        "ag-grid-vue3",
        "ag-grid-community",
      ],
    },
    plugins: [
      checker({
        vueTsc: false,
        overlay: {
          initialIsOpen: false,
        },
        enableBuild: true,
      }),
    ],
    server: {
      watch: {
        // シンボリックリンクを追跡しない
        followSymlinks: false,
        ignored: [
          // 絶対パスで親ディレクトリの backend と dumps を除外
          backendPath,
          dumpsPath,
          // app ディレクトリ内の backend シンボリックリンクを明示的に除外
          resolve(__dirname, "backend"),
          // 相対パスパターンも追加
          "**/backend/**",
          "**/dumps/**",
          "../backend/**",
          "../dumps/**",
          "backend/**",
          "**/node_modules/**",
          "**/.git/**",
          "**/.nuxt/**",
          "**/.output/**",
          "**/venv/**",
          "**/__pycache__/**",
          "**/.venv/**",
          "**/*.log",
        ],
      },
    },
    resolve: {
      alias: {
        "@components": resolve(__dirname, "./components"),
        "@models": resolve(__dirname, "./types/models"),
        "@utils": resolve(__dirname, "./utils"),
        "@stores": resolve(__dirname, "./stores"),
        "@pages": resolve(__dirname, "./pages"),
        "@composables": resolve(__dirname, "./composables"),
        "@constants": resolve(__dirname, "./constants"),
        "@adapters": resolve(__dirname, "./adapters"),
      },
    },
    vue: {
      script: {
        propsDestructure: true,
        defineModel: true,
      },
    },
  },

  nitro: {
    preset: "firebase",
    watchOptions: {
      ignored: [
        // 絶対パスで親ディレクトリの backend と dumps を除外
        backendPath,
        dumpsPath,
        // app ディレクトリ内の backend シンボリックリンクを明示的に除外
        resolve(__dirname, "backend"),
        // 相対パスパターンも追加
        "**/backend/**",
        "**/dumps/**",
        "../backend/**",
        "../dumps/**",
        "backend/**",
        "**/venv/**",
        "**/python/**",
        "**/.venv/**",
        "**/__pycache__/**",
        "**/node_modules/**",
        "**/.git/**",
        "**/*.log",
      ],
    },
    firebase: {
      gen: 2,
      nodeVersion: "20",
      httpsOptions: {
        region: "asia-northeast1",
      },
    },
  },

  typescript: {
    strict: true,
    typeCheck: false,
    shim: false,
  },
});
