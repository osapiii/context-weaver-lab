<template>
  <div class="space-y-5">
    <section class="rounded-lg border border-slate-200 bg-white p-5">
      <div class="flex flex-wrap items-start justify-between gap-4">
        <div class="min-w-0">
          <p class="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
            StoryVault Agent Setup
          </p>
          <h2 class="mt-1 text-lg font-semibold text-slate-950">
            AIツールへStoryVaultを接続する
          </h2>
          <p class="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
            必要なのは、トークン発行、AIツール選択、Skill InstallとMCP Setupコマンドの実行だけです。
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

      <div class="mt-5 grid gap-4 lg:grid-cols-[360px_minmax(0,1fr)]">
        <div class="space-y-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
          <div>
            <p class="text-sm font-semibold text-slate-900">1. トークン発行</p>
            <p class="mt-1 text-xs leading-5 text-slate-500">
              AIツールからStoryVaultを読むための接続を作ります。
            </p>
          </div>

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

          <UFormField label="AIツール">
            <USelect
              v-model="connectionForm.externalAgent"
              :items="agentOptions"
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

        <div class="space-y-4 rounded-lg border border-slate-200 bg-white p-4">
          <div class="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p class="text-sm font-semibold text-slate-900">2. コマンドを実行</p>
              <p class="mt-1 text-xs leading-5 text-slate-500">
                Skillを入れてから、MCP接続をAIツールへ登録します。
              </p>
            </div>
            <USelect
              v-model="selectedSetupAgent"
              :items="agentOptions"
              class="w-44"
            />
          </div>

          <CopyLineList
            v-if="createdToken"
            title="1回だけ表示されるトークン"
            :lines="[createdToken]"
            @copy="copyText"
          />

          <EnAlert
            v-else
            color="info"
            title="左でトークンを発行すると、下のMCP Setupコマンドに自動で入ります。"
          />

          <CopyLineList
            title="StoryVault Skill Install"
            :lines="skillInstallLines"
            @copy="copyText"
          />

          <CopyLineList
            title="StoryVault MCP Setup"
            :lines="mcpSetupLines"
            @copy="copyText"
          />

          <div class="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <p class="text-xs font-semibold text-slate-700">実行後</p>
            <p class="mt-1 text-xs leading-5 text-slate-500">
              AIツールを開き直してください。既に開いているスレッドには、後から追加したMCPやSkillが反映されないことがあります。
            </p>
          </div>
        </div>
      </div>
    </section>

    <section class="rounded-lg border border-slate-200 bg-white p-5">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 class="text-base font-semibold text-slate-950">作成済みの接続</h3>
          <p class="mt-1 text-xs text-slate-500">
            使わなくなった接続は無効化できます。
          </p>
        </div>
        <EnBadge color="neutral">{{ connections.length }} connections</EnBadge>
      </div>

      <div class="mt-4 overflow-x-auto">
        <table class="min-w-full divide-y divide-slate-200 text-sm">
          <thead class="bg-slate-50 text-left text-xs font-semibold text-slate-500">
            <tr>
              <th class="px-3 py-2">接続名</th>
              <th class="px-3 py-2">AIツール</th>
              <th class="px-3 py-2">対象アプリ</th>
              <th class="px-3 py-2">最終利用</th>
              <th class="px-3 py-2">状態</th>
              <th class="px-3 py-2">
                <span class="sr-only">操作</span>
              </th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            <tr
              v-for="connection in connections"
              :key="connection.id"
              class="align-top"
            >
              <td class="px-3 py-3 font-semibold text-slate-900">
                {{ connection.name || connection.id }}
                <p class="mt-1 break-all text-xs font-normal text-slate-400">
                  {{ connection.id }}
                </p>
              </td>
              <td class="px-3 py-3 text-slate-700">{{ connection.externalAgent }}</td>
              <td class="px-3 py-3 text-slate-700">
                {{ allowedApplicationLabel(connection.allowedApplicationIds) }}
              </td>
              <td class="px-3 py-3 text-slate-500">
                {{ formatMaybeTimestamp(connection.lastUsedAt) }}
              </td>
              <td class="px-3 py-3">
                <EnBadge
                  :color="connection.revokedAt ? 'error' : 'success'"
                  variant="soft"
                >
                  {{ connection.revokedAt ? "無効" : "有効" }}
                </EnBadge>
              </td>
              <td class="px-3 py-3 text-right">
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
              </td>
            </tr>
            <tr v-if="connections.length === 0">
              <td
                colspan="6"
                class="px-3 py-8 text-center text-sm text-slate-500"
              >
                接続はまだ作成されていません。
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, defineComponent, h, onMounted, reactive, ref, watch } from "vue";
import { collection, doc, getDocs, orderBy, query, setDoc, Timestamp, updateDoc } from "firebase/firestore";
import type { Timestamp as FirestoreTimestamp } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import type { DecodedVibeControlApplication } from "@models/vibeControl";
import { vibeControlApplicationConverter } from "@models/vibeControl";
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
    lines: { type: Array as () => string[], required: true },
  },
  emits: ["copy"],
  setup(props, { emit }) {
    return () =>
      h("div", { class: "rounded-lg border border-slate-200 bg-slate-50 p-3" }, [
        h("p", { class: "text-xs font-semibold uppercase tracking-[0.12em] text-slate-500" }, props.title),
        h(
          "div",
          { class: "mt-2 space-y-2" },
          props.lines.map((line, index) =>
            h("div", { class: "flex min-w-0 items-center gap-2", key: `${index}-${line}` }, [
              h("input", {
                class:
                  "min-w-0 flex-1 rounded-md border border-slate-200 bg-white px-3 py-2 font-mono text-xs text-slate-800 shadow-sm",
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
                    "shrink-0 rounded-md border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-100",
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

const fallbackMcpUrl = "https://storyvault-mcp-q2uwnmd3yq-an.a.run.app/mcp";
const setupPackagePath = "/installers/enostech-storyvault-mcp-setup-0.1.1.tgz";
const skillFilePath = "/installers/storyvault-codex-skill/SKILL.md";
const mcpServerUrl = computed(() =>
  String(runtimeConfig.public.storyVaultMcpUrl || runtimeConfig.public.vibeControlMcpUrl || fallbackMcpUrl).trim()
);
const setupPackageUrl = computed(() => {
  if (import.meta.client) {
    return `${window.location.origin}${setupPackagePath}`;
  }
  return `https://vibe-control-dev.web.app${setupPackagePath}`;
});
const skillFileUrl = computed(() => {
  if (import.meta.client) {
    return `${window.location.origin}${skillFilePath}`;
  }
  return `https://vibe-control-dev.web.app${skillFilePath}`;
});

const agentOptions = [
  { label: "Codex", value: "codex" },
  { label: "Cursor", value: "cursor" },
  { label: "Claude Desktop", value: "claude" },
  { label: "Antigravity", value: "antigravity" },
];

const connectionForm = reactive({
  name: "Codex local",
  externalAgent: "codex",
});

const selectedSetupAgent = ref("codex");
const applications = ref<DecodedVibeControlApplication[]>([]);
const connections = ref<McpConnectionRow[]>([]);
const createdToken = ref("");
const isLoading = ref(false);
const isCreating = ref(false);
const revokingConnectionId = ref("");

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
  contextStore.baseFirestorePath("vibeControlMcpConnections");

const applicationCollectionPath = (): string =>
  contextStore.baseFirestorePath("vibeControlApplications");

const refresh = async (): Promise<void> => {
  isLoading.value = true;
  try {
    const [applicationSnapshot, connectionSnapshot] = await Promise.all([
      getDocs(collection(db, applicationCollectionPath()).withConverter(vibeControlApplicationConverter)),
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
