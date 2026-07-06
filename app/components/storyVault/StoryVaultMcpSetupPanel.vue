<template>
  <div class="space-y-5">
    <section class="rounded-lg border border-slate-200 bg-white p-5">
      <div class="flex flex-wrap items-start justify-between gap-4">
        <div class="min-w-0">
          <div class="flex flex-wrap items-center gap-2">
            <EnBadge color="success" variant="soft" leading-icon="material-symbols:hub">
              MCP設定
            </EnBadge>
            <p class="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
              StoryVault Agent Setup
            </p>
          </div>
          <h2 class="mt-2 text-2xl font-semibold tracking-normal text-slate-950">
            AIツールへStoryVaultを接続する
          </h2>
          <p class="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
            Codex、Claude、AntigravityなどのAIツールから、StoryVaultのクリップ・ストーリー・関連コンテキストをそのまま呼び出せます。
          </p>
        </div>
        <EnButton
          variant="outline"
          color="neutral"
          size="sm"
          leading-icon="material-symbols:refresh"
          :loading="isLoading"
          @click="refresh"
        >
          再読込
        </EnButton>
      </div>

      <EnAlert
        class="mt-4"
        color="warning"
        title="トークンは1回だけ表示されます。外部に見えた可能性がある場合は、下の接続一覧から無効化して作り直してください。"
      />

      <div class="mt-5 grid gap-5 xl:grid-cols-[420px_minmax(0,1fr)]">
        <aside class="space-y-4">
          <div class="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <div class="flex items-center justify-between gap-3">
              <div>
                <p class="text-sm font-semibold text-slate-900">1. 接続するAIツールを選択</p>
                <p class="mt-1 text-xs leading-5 text-slate-500">
                  デモで見せたいツールを選ぶと、コマンドも自動で切り替わります。
                </p>
              </div>
              <EnBadge color="neutral">{{ activeConnectionCount }} active</EnBadge>
            </div>

            <div class="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
              <button
                v-for="agent in agentCards"
                :key="agent.value"
                type="button"
                class="group flex min-h-[92px] items-start gap-3 rounded-lg border bg-white p-3 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                :class="
                  connectionForm.externalAgent === agent.value
                    ? 'border-emerald-300 ring-2 ring-emerald-100'
                    : 'border-slate-200 hover:border-slate-300'
                "
                @click="selectAgent(agent.value)"
              >
                <span
                  class="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border"
                  :class="[agent.logoClass, agent.logoSurfaceClass]"
                >
                  <UIcon :name="agent.icon" class="h-6 w-6" />
                </span>
                <span class="min-w-0">
                  <span class="flex items-center gap-2">
                    <span class="font-semibold text-slate-950">{{ agent.label }}</span>
                    <span
                      v-if="connectionForm.externalAgent === agent.value"
                      class="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700"
                    >
                      選択中
                    </span>
                  </span>
                  <span class="mt-1 block text-xs leading-5 text-slate-500">{{ agent.description }}</span>
                </span>
              </button>
            </div>

            <div class="mt-4 space-y-3">
              <UFormField
                label="接続名"
                help="あとで一覧で見分けるための名前です。"
              >
                <UInput
                  v-model="connectionForm.name"
                  placeholder="Codex local"
                  class="w-full"
                />
              </UFormField>

              <EnButton
                variant="ai"
                size="sm"
                leading-icon="material-symbols:vpn-key"
                :loading="isCreating"
                :disabled="!canCreateConnection"
                @click="createConnection"
              >
                トークンを発行
              </EnButton>
            </div>
          </div>

          <div class="rounded-lg border border-slate-200 bg-white p-4">
            <div class="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 class="text-sm font-semibold text-slate-950">作成済みの接続</h3>
                <p class="mt-1 text-xs text-slate-500">
                  デモではここで対応ツールをロゴ付きで見せられます。
                </p>
              </div>
              <EnBadge color="neutral">{{ connections.length }} connections</EnBadge>
            </div>

            <div class="mt-3 space-y-2">
              <div
                v-for="connection in connectionsWithMeta"
                :key="connection.id"
                class="rounded-lg border border-slate-200 bg-slate-50 p-3"
              >
                <div class="flex items-start gap-3">
                  <span
                    class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border"
                    :class="[connection.agent.logoClass, connection.agent.logoSurfaceClass]"
                  >
                    <UIcon :name="connection.agent.icon" class="h-5 w-5" />
                  </span>
                  <div class="min-w-0 flex-1">
                    <div class="flex flex-wrap items-center gap-2">
                      <p class="truncate text-sm font-semibold text-slate-950">
                        {{ connection.name || connection.id }}
                      </p>
                      <EnBadge
                        :color="connection.revokedAt ? 'error' : 'success'"
                        variant="soft"
                      >
                        {{ connection.revokedAt ? "無効" : "有効" }}
                      </EnBadge>
                    </div>
                    <p class="mt-1 text-xs font-medium text-slate-600">
                      {{ connection.agent.label }} / {{ allowedApplicationLabel(connection.allowedApplicationIds) }}
                    </p>
                    <p class="mt-1 truncate text-[11px] text-slate-400">
                      {{ connection.id }}
                    </p>
                    <div class="mt-2 flex flex-wrap items-center justify-between gap-2">
                      <span class="text-[11px] text-slate-500">
                        最終利用 {{ formatMaybeTimestamp(connection.lastUsedAt) }}
                      </span>
                      <EnButton
                        v-if="!connection.revokedAt"
                        variant="ghost"
                        color="error"
                        size="xs"
                        leading-icon="material-symbols:link-off"
                        :loading="revokingConnectionId === connection.id"
                        @click="revokeConnection(connection.id)"
                      >
                        無効化
                      </EnButton>
                    </div>
                  </div>
                </div>
              </div>

              <div
                v-if="connections.length === 0"
                class="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-7 text-center"
              >
                <div class="mx-auto flex h-10 w-10 items-center justify-center rounded-lg bg-white text-slate-400 shadow-sm">
                  <UIcon name="material-symbols:hub" class="h-5 w-5" />
                </div>
                <p class="mt-3 text-sm font-semibold text-slate-700">接続はまだ作成されていません</p>
                <p class="mt-1 text-xs text-slate-500">
                  トークンを発行すると、ここにAIツール別の接続が並びます。
                </p>
              </div>
            </div>
          </div>
        </aside>

        <div class="space-y-4 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div class="flex flex-wrap items-start justify-between gap-3">
            <div class="flex min-w-0 items-start gap-3">
              <span
                class="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border"
                :class="[selectedSetupAgentCard.logoClass, selectedSetupAgentCard.logoSurfaceClass]"
              >
                <UIcon :name="selectedSetupAgentCard.icon" class="h-7 w-7" />
              </span>
              <div class="min-w-0">
                <p class="text-sm font-semibold text-slate-900">2. コマンドをコピーして実行</p>
                <p class="mt-1 text-xs leading-5 text-slate-500">
                  {{ selectedSetupAgentCard.label }} にSkillとMCP接続を追加します。
                </p>
              </div>
            </div>
            <USelect
              v-model="selectedSetupAgent"
              :items="agentOptions"
              class="w-48"
            />
          </div>

          <CopyLineList
            v-if="createdToken"
            title="1回だけ表示されるトークン"
            tone="secret"
            :lines="[createdToken]"
            @copy="copyText"
          />

          <EnAlert
            v-else
            color="info"
            title="左でトークンを発行すると、MCP Setupコマンドに自動で入ります。"
          />

          <CopyLineList
            title="StoryVault Skill Install"
            subtitle="まずAIツールへStoryVaultの使い方を追加します。"
            :lines="skillInstallLines"
            @copy="copyText"
          />

          <CopyLineList
            title="StoryVault MCP Setup"
            subtitle="次にStoryVault MCPサーバーと発行済みトークンを登録します。"
            tone="primary"
            :lines="mcpSetupLines"
            @copy="copyText"
          />

          <div class="rounded-lg border border-emerald-100 bg-emerald-50 p-4">
            <div class="flex items-start gap-3">
              <div class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white text-emerald-600 shadow-sm">
                <UIcon name="material-symbols:rocket-launch" class="h-5 w-5" />
              </div>
              <div>
                <p class="text-sm font-semibold text-emerald-950">実行後</p>
                <p class="mt-1 text-xs leading-5 text-emerald-800">
                  AIツールを開き直してください。既に開いているスレッドには、後から追加したMCPやSkillが反映されないことがあります。
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, defineComponent, h, onMounted, reactive, ref, watch } from "vue";
import { collection, doc, getDocs, orderBy, query, setDoc, Timestamp, updateDoc } from "firebase/firestore";
import type { Timestamp as FirestoreTimestamp } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import type { DecodedStoryVaultApplication } from "@models/storyVault";
import { storyVaultApplicationConverter } from "@models/storyVault";
import log from "@utils/logger";

type McpConnectionRow = {
  id: string;
  name?: string;
  externalAgent: string;
  allowedApplicationIds: string[];
  scopes: string[];
  createdAt?: FirestoreTimestamp;
  updatedAt?: FirestoreTimestamp;
  lastUsedAt?: FirestoreTimestamp;
  revokedAt?: FirestoreTimestamp | null;
};

const CopyLineList = defineComponent({
  props: {
    title: { type: String, required: true },
    subtitle: { type: String, default: "" },
    tone: { type: String as () => "default" | "primary" | "secret", default: "default" },
    lines: { type: Array as () => string[], required: true },
  },
  emits: ["copy"],
  setup(props, { emit }) {
    return () =>
      h("div", {
        class: [
          "rounded-lg border p-4",
          props.tone === "primary"
            ? "border-emerald-200 bg-emerald-50"
            : props.tone === "secret"
              ? "border-violet-200 bg-violet-50"
              : "border-slate-200 bg-slate-50",
        ],
      }, [
        h("div", { class: "flex items-start justify-between gap-3" }, [
          h("div", { class: "min-w-0" }, [
            h("p", { class: "text-xs font-semibold uppercase tracking-[0.12em] text-slate-500" }, props.title),
            props.subtitle
              ? h("p", { class: "mt-1 text-xs leading-5 text-slate-500" }, props.subtitle)
              : null,
          ]),
          h("span", { class: "rounded-full bg-white px-2 py-1 text-[10px] font-semibold text-slate-500 shadow-sm" }, "COPY READY"),
        ]),
        h(
          "div",
          { class: "mt-3 space-y-3" },
          props.lines.map((line, index) =>
            h("div", { class: "grid min-w-0 gap-2 md:grid-cols-[minmax(0,1fr)_104px]", key: `${index}-${line}` }, [
              h("input", {
                class:
                  "min-w-0 rounded-lg border border-slate-200 bg-white px-4 py-3 font-mono text-sm text-slate-900 shadow-sm outline-none transition focus:border-emerald-300 focus:ring-2 focus:ring-emerald-100",
                readOnly: true,
                value: line,
                onFocus: (event: FocusEvent) => {
                  const input = event.target as HTMLInputElement;
                  input.select();
                },
              }),
              h(
                "button",
                {
                  class:
                    "shrink-0 rounded-lg bg-slate-950 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800",
                  onClick: () => emit("copy", line),
                },
                "Copy"
              ),
            ])
          )
        ),
      ]);
  },
});

const runtimeConfig = useRuntimeConfig();
const toast = useToast();
const organizationStore = useOrganizationStore();
const spaceStore = useSpaceStore();
const contextStore = useContextStore();
const db = useFirestore();

const fallbackMcpUrl = "https://storyvault-mcp-mdgjayj74q-an.a.run.app/mcp";
const setupPackagePath = "/installers/enostech-storyvault-mcp-setup-0.1.1.tgz";
const skillFilePath = "/installers/storyvault-codex-skill/SKILL.md";
const mcpServerUrl = computed(() =>
  String(runtimeConfig.public.storyVaultMcpUrl || runtimeConfig.public.storyVaultMcpUrl || fallbackMcpUrl).trim()
);
const setupPackageUrl = computed(() => {
  if (import.meta.client) {
    return `${window.location.origin}${setupPackagePath}`;
  }
  return `https://storyvault-dev.web.app${setupPackagePath}`;
});
const skillFileUrl = computed(() => {
  if (import.meta.client) {
    return `${window.location.origin}${skillFilePath}`;
  }
  return `https://storyvault-dev.web.app${skillFilePath}`;
});

const agentOptions = [
  { label: "Codex", value: "codex" },
  { label: "Cursor", value: "cursor" },
  { label: "Claude Desktop", value: "claude" },
  { label: "Antigravity", value: "antigravity" },
];

const agentCards = [
  {
    label: "Codex",
    value: "codex",
    icon: "simple-icons:openai",
    description: "CLIとCodexスレッドからStoryVaultを呼び出します。",
    logoClass: "text-slate-950",
    logoSurfaceClass: "border-slate-200 bg-white",
  },
  {
    label: "Claude",
    value: "claude",
    icon: "simple-icons:anthropic",
    description: "Claude DesktopのMCP接続として登録できます。",
    logoClass: "text-orange-700",
    logoSurfaceClass: "border-orange-200 bg-orange-50",
  },
  {
    label: "Antigravity",
    value: "antigravity",
    icon: "material-symbols:orbit",
    description: "Agentic IDEの作業文脈にStoryVaultを追加します。",
    logoClass: "text-sky-700",
    logoSurfaceClass: "border-sky-200 bg-sky-50",
  },
  {
    label: "Cursor",
    value: "cursor",
    icon: "material-symbols:near-me",
    description: "エディター内のAIチャットから参照できます。",
    logoClass: "text-violet-700",
    logoSurfaceClass: "border-violet-200 bg-violet-50",
  },
];

const connectionForm = reactive({
  name: "Codex local",
  externalAgent: "codex",
});

const selectedSetupAgent = ref("codex");
const applications = ref<DecodedStoryVaultApplication[]>([]);
const connections = ref<McpConnectionRow[]>([]);
const createdToken = ref("");
const isLoading = ref(false);
const isCreating = ref(false);
const revokingConnectionId = ref("");

const fallbackAgentCard = agentCards[0];
const activeConnectionCount = computed(() => connections.value.filter((connection) => !connection.revokedAt).length);
const findAgentCard = (value: string) =>
  agentCards.find((agent) => agent.value === value) ?? fallbackAgentCard;
const selectedSetupAgentCard = computed(() => findAgentCard(selectedSetupAgent.value));
const connectionsWithMeta = computed(() =>
  connections.value.map((connection) => ({
    ...connection,
    agent: findAgentCard(connection.externalAgent),
  }))
);

const canCreateConnection = computed(
  () =>
    Boolean(organizationStore.getLoggedInOrganizationId) &&
    Boolean(spaceStore.selectedSpace?.id) &&
    Boolean(connectionForm.name.trim())
);

const scopes = computed(() => ["context:read"]);

const skillInstallCommand = computed(() => {
  const configured = String(runtimeConfig.public.storyVaultSkillInstallCommand || "").trim();
  if (configured) return configured;
  return `mkdir -p ~/.codex/skills/storyvault-codex-skill && curl -fsSL "${skillFileUrl.value}" -o ~/.codex/skills/storyvault-codex-skill/SKILL.md`;
});

const skillInstallLines = computed(() => [skillInstallCommand.value]);

const mcpSetupLines = computed(() => {
  const token = createdToken.value || "<STORYVAULT_MCP_TOKEN>";
  return [
    `npx -y "${setupPackageUrl.value}" --client ${selectedSetupAgent.value} --token '${token}' --url "${mcpServerUrl.value}"`,
  ];
});

const encodeBase64Url = (input: string): string =>
  btoa(input).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");

const bytesToHex = (buffer: ArrayBuffer): string =>
  [...new Uint8Array(buffer)].map((byte) => byte.toString(16).padStart(2, "0")).join("");

const randomSecret = (): string => {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return encodeBase64Url(String.fromCharCode(...bytes));
};

const sha256Hex = async (text: string): Promise<string> => {
  const encoded = new TextEncoder().encode(text);
  return bytesToHex(await crypto.subtle.digest("SHA-256", encoded));
};

const makeToken = (params: {
  organizationId: string;
  spaceId: string;
  connectionId: string;
}): string => {
  const payload = encodeBase64Url(
    JSON.stringify({
      organizationId: params.organizationId,
      spaceId: params.spaceId,
      connectionId: params.connectionId,
    })
  );
  return `sv_mcp_${payload}.${randomSecret()}`;
};

const connectionCollectionPath = (): string =>
  contextStore.baseFirestorePath("storyVaultMcpConnections");

const applicationCollectionPath = (): string =>
  contextStore.baseFirestorePath("storyVaultApplications");

const refresh = async (): Promise<void> => {
  isLoading.value = true;
  try {
    const [applicationSnapshot, connectionSnapshot] = await Promise.all([
      getDocs(collection(db, applicationCollectionPath()).withConverter(storyVaultApplicationConverter)),
      getDocs(query(collection(db, connectionCollectionPath()), orderBy("createdAt", "desc"))),
    ]);
    applications.value = applicationSnapshot.docs.map((snap) => snap.data());
    connections.value = connectionSnapshot.docs.map((snap) => {
      const data = snap.data() as Omit<McpConnectionRow, "id"> & { name?: string };
      return {
        id: snap.id,
        name: data.name,
        externalAgent: data.externalAgent || "codex",
        allowedApplicationIds: Array.isArray(data.allowedApplicationIds) ? data.allowedApplicationIds : [],
        scopes: Array.isArray(data.scopes) ? data.scopes : ["context:read"],
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
        lastUsedAt: data.lastUsedAt,
        revokedAt: data.revokedAt ?? null,
      };
    });
  } catch (error) {
    toast.add({ color: "error", title: "MCP設定の取得に失敗しました" });
    log("ERROR", "MCP settings refresh failed", error);
  } finally {
    isLoading.value = false;
  }
};

const createConnection = async (): Promise<void> => {
  if (!canCreateConnection.value) return;
  isCreating.value = true;
  try {
    const organizationId = organizationStore.getLoggedInOrganizationId;
    const spaceId = spaceStore.selectedSpace?.id ?? "";
    const connectionId = `mcp-${connectionForm.externalAgent}-${crypto.randomUUID().slice(0, 12)}`;
    const token = makeToken({ organizationId, spaceId, connectionId });
    const tokenHash = await sha256Hex(token);
    const now = Timestamp.now();
    await setDoc(
      doc(db, connectionCollectionPath(), connectionId),
      {
        tokenHash,
        name: connectionForm.name.trim(),
        externalAgent: connectionForm.externalAgent,
        allowedApplicationIds: [],
        scopes: scopes.value,
        createdBy: getAuth().currentUser?.uid,
        createdAt: now,
        updatedAt: now,
        revokedAt: null,
      }
    );
    createdToken.value = token;
    toast.add({ color: "success", title: "トークンを発行しました" });
    await refresh();
  } catch (error) {
    toast.add({ color: "error", title: "トークン発行に失敗しました" });
    log("ERROR", "MCP connection creation failed", error);
  } finally {
    isCreating.value = false;
  }
};

const selectAgent = (agent: string): void => {
  connectionForm.externalAgent = agent;
  selectedSetupAgent.value = agent;
  const label = findAgentCard(agent).label;
  connectionForm.name = `${label} local`;
};

const revokeConnection = async (connectionId: string): Promise<void> => {
  revokingConnectionId.value = connectionId;
  try {
    await updateDoc(doc(db, connectionCollectionPath(), connectionId), {
      revokedAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });
    toast.add({ color: "success", title: "接続を無効化しました" });
    await refresh();
  } catch (error) {
    toast.add({ color: "error", title: "接続の無効化に失敗しました" });
    log("ERROR", "MCP connection revoke failed", error);
  } finally {
    revokingConnectionId.value = "";
  }
};

const copyText = async (text: string): Promise<void> => {
  await navigator.clipboard.writeText(text);
  toast.add({ color: "success", title: "コピーしました" });
};

const allowedApplicationLabel = (ids: string[]): string => {
  if (!ids.length) return "All applications";
  return ids
    .map((id) => applications.value.find((application) => application.id === id)?.name || id)
    .join(", ");
};

const formatMaybeTimestamp = (value?: FirestoreTimestamp): string => {
  if (!value) return "-";
  return value.toDate().toLocaleString("ja-JP");
};

onMounted(() => {
  void refresh();
});

watch(
  () => connectionForm.externalAgent,
  (agent) => {
    selectedSetupAgent.value = agent;
  }
);
</script>
