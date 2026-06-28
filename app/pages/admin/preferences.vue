<template>
  <div class="w-full space-y-6">
    <AdminModePageNav current-page-label="設定" />
    <header class="space-y-1">
      <h1 class="text-2xl font-semibold tracking-tight flex items-center gap-2">
        <UIcon name="material-symbols:tune" class="text-purple-500 w-6 h-6" />
        設定
      </h1>
      <p class="text-sm text-neutral-500">
        アプリの外観や API キーなど、組織・個人の各種設定をここで管理します。
        <span class="ml-1 text-neutral-400">
          (
          <UKbd class="text-[10px]">{{ isMac ? "⌘" : "Ctrl" }}</UKbd>
          +
          <UKbd class="text-[10px]">,</UKbd>
          でいつでも開けます)
        </span>
      </p>
    </header>

    <UTabs :items="tabItems" class="w-full">
      <!-- メンバー管理 -->
      <template #members>
        <OrganizationMemberManagementPanel />
      </template>

      <!-- 外観 -->
      <template #appearance>
        <div class="space-y-6">
          <section class="rounded-lg border border-neutral-200 bg-white p-6 shadow-sm">
            <div class="mb-4 flex items-center gap-2">
              <UIcon name="material-symbols:image" class="text-purple-500 w-5 h-5" />
              <h2 class="text-lg font-semibold">ヘッダーロゴ</h2>
            </div>
            <p class="mb-4 text-sm leading-relaxed text-neutral-600">
              自社のロゴ画像を設定すると、ヘッダーの「VibeControl」文字の代わりにそのロゴが表示されます。
              透過 PNG / SVG を推奨します (高さ 24px 前後で表示)。
            </p>

            <div class="flex flex-col items-start gap-6 sm:flex-row">
              <div
                class="flex h-16 min-w-[200px] items-center justify-center rounded-lg border border-dashed border-neutral-300 bg-slate-900 px-4"
              >
                <NuxtImg
                  v-if="appearance.hasCustomLogo.value"
                  :src="appearance.logoUrl.value"
                  alt="ヘッダーロゴ プレビュー"
                  class="h-8 max-w-[160px] object-contain"
                />
                <span
                  v-else
                  class="text-xl font-bold text-white tracking-tight font-mono"
                >VibeControl</span>
              </div>

              <div class="flex-1 space-y-2">
                <input
                  ref="logoInput"
                  type="file"
                  accept="image/png,image/jpeg,image/svg+xml,image/webp"
                  class="hidden"
                  @change="onLogoSelected"
                >
                <div class="flex flex-wrap gap-2">
                  <EButton
                    label="画像を選んでアップロード"
                    color="primary"
                    size="md"
                    icon="material-symbols:upload"
                    :disabled="uploadingLogo"
                    @click="logoInput?.click()"
                  />
                  <EButton
                    v-if="appearance.hasCustomLogo.value"
                    label="リセット (VibeControl 表示に戻す)"
                    color="neutral"
                    size="md"
                    icon="material-symbols:restart-alt"
                    :disabled="uploadingLogo"
                    @click="resetLogo"
                  />
                </div>
                <p v-if="uploadingLogo" class="text-xs text-neutral-500">
                  アップロード中…
                </p>
                <p v-if="logoError" class="text-xs text-rose-600">
                  ⚠️ {{ logoError }}
                </p>
              </div>
            </div>
          </section>

          <section class="rounded-lg border border-neutral-200 bg-white p-6 shadow-sm">
            <div class="mb-4 flex items-center gap-2">
              <UIcon name="material-symbols:palette" class="text-primary-500 w-5 h-5" />
              <h2 class="text-lg font-semibold">カラーテーマ</h2>
            </div>
            <p class="mb-4 text-sm leading-relaxed text-neutral-600">
              UI の primary / secondary / accent / neutral 色を組織全体で切り替えます。
              Nuxt UI コンポーネント (ボタン・入力欄・バッジなど) に即時反映されます。
            </p>

            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <button
                v-for="preset in colorThemePresets"
                :key="preset.id"
                type="button"
                class="group relative rounded-lg border bg-white p-4 text-left shadow-sm transition-all hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                :class="
                  currentColorThemeId === preset.id
                    ? themeSemanticClasses.selectionCard
                    : 'border-neutral-200 hover:border-neutral-300'
                "
                :disabled="savingTheme"
                @click="onSelectTheme(preset.id)"
              >
                <div class="flex items-center justify-between mb-2">
                  <span class="text-sm font-semibold text-neutral-900">{{ preset.label }}</span>
                  <UIcon
                    v-if="currentColorThemeId === preset.id"
                    name="material-symbols:check-circle"
                    :class="[themeSemanticClasses.selectionIcon, 'w-5 h-5']"
                  />
                </div>
                <div class="flex gap-1 mb-2">
                  <span
                    class="h-6 flex-1 rounded"
                    :style="{ background: preset.swatch.primary }"
                  />
                  <span
                    class="h-6 flex-1 rounded"
                    :style="{ background: preset.swatch.secondary }"
                  />
                  <span
                    class="h-6 flex-1 rounded"
                    :style="{ background: preset.swatch.neutral }"
                  />
                </div>
                <p class="text-xs text-neutral-500 leading-relaxed">{{ preset.description }}</p>
              </button>
            </div>

            <p v-if="themeError" class="mt-3 text-xs text-rose-600">
              ⚠️ {{ themeError }}
            </p>
          </section>

          <section class="rounded-lg border border-neutral-200 bg-white p-6 shadow-sm">
            <div class="mb-4 flex items-center gap-2">
              <UIcon name="material-symbols:smart-toy" class="text-purple-500 w-5 h-5" />
              <h2 class="text-lg font-semibold">AI アシスタントのアバター</h2>
            </div>
            <p class="mb-4 text-sm leading-relaxed text-neutral-600">
              VibeControl の AI 補助で表示されるキャラクター画像です。
              自社のマスコットに差し替えると、対応する AI 機能でその画像が使われます。
              未設定なら VibeControl 標準のアバターが表示されます。
            </p>

            <div class="flex flex-col items-start gap-6 sm:flex-row">
              <div
                class="flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br from-violet-50 to-purple-50 ring-1 ring-violet-100"
              >
                <NuxtImg
                  :src="appearance.aiAvatarUrl.value"
                  alt="AI アバター プレビュー"
                  class="h-20 w-20 object-contain"
                />
              </div>

              <div class="flex-1 space-y-2">
                <input
                  ref="avatarInput"
                  type="file"
                  accept="image/png,image/jpeg,image/svg+xml,image/webp"
                  class="hidden"
                  @change="onAvatarSelected"
                >
                <div class="flex flex-wrap gap-2">
                  <EButton
                    label="画像を選んでアップロード"
                    color="primary"
                    size="md"
                    icon="material-symbols:upload"
                    :disabled="uploadingAvatar"
                    @click="avatarInput?.click()"
                  />
                  <EButton
                    v-if="appearance.hasCustomAiAvatar.value"
                    label="標準アバターに戻す"
                    color="neutral"
                    size="md"
                    icon="material-symbols:restart-alt"
                    :disabled="uploadingAvatar"
                    @click="resetAvatar"
                  />
                </div>
                <p v-if="uploadingAvatar" class="text-xs text-neutral-500">
                  アップロード中…
                </p>
                <p v-if="avatarError" class="text-xs text-rose-600">
                  ⚠️ {{ avatarError }}
                </p>
              </div>
            </div>
          </section>
        </div>
      </template>

      <!-- AI 連携 -->
      <template #ai-integration>
        <div class="space-y-6">
          <EnCard variant="kpi" padding="spacious">
            <template #header>
              <div class="flex items-center gap-2">
                <UIcon name="material-symbols:key" class="h-5 w-5 text-purple-500" />
                <h2 class="text-lg font-semibold text-neutral-900">
                  Gemini API キー
                </h2>
              </div>
              <p class="mt-2 text-sm leading-relaxed text-neutral-600">
                Google AI Studio (
                <a
                  href="https://aistudio.google.com/apikey"
                  target="_blank"
                  rel="noopener"
                  class="text-purple-600 underline hover:text-purple-700"
                >aistudio.google.com/apikey</a>
                ) で発行したキーを登録します。ADK エージェントの推論に使用されます。
                <span class="mt-1 block text-xs text-neutral-500">
                  保存先:
                  <code>users/{あなたの uid}/secrets/geminiApiKey</code>
                </span>
              </p>
            </template>

            <div v-if="geminiLoading" class="text-sm text-neutral-500">
              読み込み中…
            </div>

            <div v-else class="space-y-4">
              <div
                v-if="hasGeminiKey"
                class="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700"
              >
                ✓ 登録済み ({{ maskedGeminiKey }})
                <span v-if="geminiUpdatedAt" class="ml-2 text-emerald-600/70">
                  最終更新: {{ formatTs(geminiUpdatedAt) }}
                </span>
              </div>
              <div
                v-else
                class="rounded-md bg-purple-50 px-3 py-2 text-sm text-purple-800"
              >
                ⚠️ まだ登録されていません。AI 機能を使う前に登録してください。
              </div>

              <UFormField
                label="新しい API キー"
                :required="!hasGeminiKey"
                help="Google AI Studio で発行した Gemini API キー"
              >
                <UInput
                  v-model="newGeminiKey"
                  type="text"
                  :placeholder="hasGeminiKey ? '（更新する場合のみ入力）' : 'Gemini API キー'"
                  class="w-full font-mono"
                />
              </UFormField>

              <div class="flex flex-wrap gap-2">
                <EButton
                  label="保存"
                  color="primary"
                  size="md"
                  icon="material-symbols:save"
                  :disabled="!newGeminiKey || geminiSaving"
                  @click="saveGeminiKey"
                />
                <EButton
                  v-if="hasGeminiKey"
                  label="削除"
                  color="neutral"
                  size="md"
                  icon="material-symbols:delete-outline"
                  :disabled="geminiSaving"
                  @click="confirmRemoveGeminiKey"
                />
              </div>

              <div
                v-if="geminiError"
                class="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700"
              >
                ⚠️ {{ geminiError }}
              </div>
              <div
                v-if="geminiSuccess"
                class="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700"
              >
                ✓ {{ geminiSuccess }}
              </div>
            </div>
          </EnCard>

          <EnCard variant="kpi" padding="spacious">
            <template #header>
              <div class="flex items-center gap-2">
                <UIcon name="material-symbols:image" class="h-5 w-5 text-emerald-600" />
                <h2 class="text-lg font-semibold text-neutral-900">
                  OpenAI API キー（画像生成）
                </h2>
              </div>
              <p class="mt-2 text-sm leading-relaxed text-neutral-600">
                OpenAI の画像生成（gpt-image-2）を有効にする場合に使用します。会話の推論は引き続き Gemini API キーを使います。
                <a
                  href="https://platform.openai.com/api-keys"
                  target="_blank"
                  rel="noopener"
                  class="text-emerald-600 underline hover:text-emerald-700"
                >platform.openai.com</a>
                で発行したキーを登録してください。
                <span class="mt-1 block text-xs text-neutral-500">
                  保存先:
                  <code>users/{あなたの uid}/secrets/openaiApiKey</code>
                </span>
              </p>
            </template>

            <div v-if="openaiLoading" class="text-sm text-neutral-500">
              読み込み中…
            </div>

            <div v-else class="space-y-4">
              <div
                v-if="hasOpenaiKey"
                class="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700"
              >
                ✓ 登録済み ({{ maskedOpenaiKey }})
                <span v-if="openaiUpdatedAt" class="ml-2 text-emerald-600/70">
                  最終更新: {{ formatTs(openaiUpdatedAt) }}
                </span>
              </div>
              <div
                v-else
                class="rounded-md bg-purple-50 px-3 py-2 text-sm text-purple-800"
              >
                ⚠️ 画像生成を使う前に OpenAI API キーを登録してください。
              </div>

              <UFormField
                label="新しい API キー"
                :required="!hasOpenaiKey"
                help="通常 sk- から始まる OpenAI API キー"
              >
                <UInput
                  v-model="newOpenaiKey"
                  type="password"
                  :placeholder="hasOpenaiKey ? '（更新する場合のみ入力）' : 'sk-…'"
                  class="w-full font-mono"
                />
              </UFormField>

              <div class="flex flex-wrap gap-2">
                <EButton
                  label="保存"
                  color="primary"
                  size="md"
                  icon="material-symbols:save"
                  :disabled="!newOpenaiKey || openaiSaving"
                  @click="saveOpenaiKey"
                />
                <EButton
                  v-if="hasOpenaiKey"
                  label="削除"
                  color="neutral"
                  size="md"
                  icon="material-symbols:delete-outline"
                  :disabled="openaiSaving"
                  @click="confirmRemoveOpenaiKey"
                />
              </div>

              <div
                v-if="openaiError"
                class="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700"
              >
                ⚠️ {{ openaiError }}
              </div>
              <div
                v-if="openaiSuccess"
                class="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700"
              >
                ✓ {{ openaiSuccess }}
              </div>
            </div>
          </EnCard>

          <EnCard variant="kpi" padding="spacious">
            <template #header>
              <div class="flex items-center gap-2">
                <UIcon name="material-symbols:psychology" class="h-5 w-5 text-purple-500" />
                <h2 class="text-lg font-semibold text-neutral-900">
                  グローバルシステムプロンプト
                </h2>
              </div>
              <p class="mt-2 text-sm leading-relaxed text-neutral-600">
                毎回のチャットで ADK に渡す共通指示です。役割・口調・回答方針など、
                セッションをまたいで繰り返したくない前提を書いておけます。
                <span class="mt-1 block text-xs text-neutral-500">
                  保存先:
                  <code>users/{あなたの uid}/secrets/globalSystemPrompt</code>
                </span>
              </p>
            </template>

            <div v-if="globalPromptLoading" class="text-sm text-neutral-500">
              読み込み中…
            </div>

            <div v-else class="space-y-4">
              <UFormField
                label="プロンプト本文"
                help="空にして保存すると削除されます"
              >
                <UTextarea
                  v-model="globalSystemPromptDraft"
                  :rows="6"
                  placeholder="例: 私は経営企画担当です。社内資料検索を積極的に使い、結論ファーストで回答してください。"
                  class="w-full font-mono text-sm"
                />
              </UFormField>

              <div class="flex flex-wrap gap-2">
                <EButton
                  label="保存"
                  color="primary"
                  size="md"
                  icon="material-symbols:save"
                  :disabled="globalPromptSaving"
                  @click="saveGlobalSystemPrompt"
                />
              </div>

              <div
                v-if="globalPromptError"
                class="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700"
              >
                ⚠️ {{ globalPromptError }}
              </div>
              <div
                v-if="globalPromptSuccess"
                class="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700"
              >
                ✓ {{ globalPromptSuccess }}
              </div>
            </div>
          </EnCard>

          <EnCard variant="kpi" padding="spacious">
            <template #header>
              <div class="flex items-center gap-2">
                <UIcon name="material-symbols:push-pin" class="h-5 w-5 text-purple-500" />
                <h2 class="text-lg font-semibold text-neutral-900">
                  ピン留め参照知識（常時）
                </h2>
              </div>
              <p class="mt-2 text-sm leading-relaxed text-neutral-600">
                会社概要・商品カタログなど、重要資料をピン留めすると全セッションで
                GCS コンテキストとして ADK に渡されます。Global プロンプトと組み合わせて
                自社基盤に沿った応答を強化できます。
                <span class="mt-1 block text-xs text-neutral-500">
                  保存先:
                  <code>users/{あなたの uid}/secrets/pinnedKnowledge</code>
                </span>
              </p>
            </template>

            <GlobalPinnedKnowledgePanel />
          </EnCard>

          <GlobalPinnedKnowledgePanel />
        </div>
      </template>

      <template #data-integration>
        <div class="space-y-6">
          <GoogleWorkspaceConnectionSettingsCard />

          <EnCard variant="kpi" padding="spacious">
            <template #header>
              <div class="flex items-center gap-2">
                <UIcon name="material-symbols:cloud-sync" class="h-5 w-5 text-primary-500" />
                <h2 class="text-lg font-semibold text-neutral-900">
                  Google クラウド連携の利用範囲
                </h2>
              </div>
              <p class="mt-2 text-sm leading-relaxed text-neutral-600">
                Google Drive / Sheets を VibeControl の素材投入やデータ連携で使うための接続です。
                OAuth クライアント登録後、上のカードから Google アカウントを接続できます。
              </p>
            </template>

            <div class="grid gap-3 md:grid-cols-3">
              <div class="rounded-lg border border-violet-100 bg-violet-50/60 p-4">
                <div class="flex items-center gap-2 text-sm font-bold text-violet-900">
                  <UIcon name="logos:google-drive" class="h-5 w-5" />
                  Drive 読み取り
                </div>
                <p class="mt-2 text-xs leading-relaxed text-violet-900/70">
                  共有フォルダの資料を素材プールへ同期し、AI に教える対象として扱います。
                </p>
              </div>
              <div class="rounded-lg border border-purple-100 bg-purple-50/60 p-4">
                <div class="flex items-center gap-2 text-sm font-bold text-purple-900">
                  <UIcon name="material-symbols:table-chart-outline" class="h-5 w-5" />
                  Sheets 読み書き
                </div>
                <p class="mt-2 text-xs leading-relaxed text-purple-900/70">
                  シート確認、表の整形、分析結果の反映などを本人権限で実行します。
                </p>
              </div>
              <div class="rounded-lg border border-fuchsia-100 bg-fuchsia-50/60 p-4">
                <div class="flex items-center gap-2 text-sm font-bold text-fuchsia-900">
                  <UIcon name="material-symbols:shield-lock-outline" class="h-5 w-5" />
                  個人別 OAuth
                </div>
                <p class="mt-2 text-xs leading-relaxed text-fuchsia-900/70">
                  接続トークンはユーザーごとに保存され、組織の他メンバーとは共有されません。
                </p>
              </div>
            </div>
          </EnCard>
        </div>
      </template>

      <template #oauth-connections>
        <div class="space-y-6">
          <OAuthConnectionGitHubCard />
          <OAuthConnectionSlackCard />

          <EnCard variant="kpi" padding="spacious">
            <template #header>
              <div class="flex items-center gap-2">
                <UIcon name="material-symbols:extension" class="h-5 w-5 text-neutral-500" />
                <h2 class="text-lg font-semibold text-neutral-900">
                  追加予定の OAuth 連携
                </h2>
              </div>
              <p class="mt-2 text-sm leading-relaxed text-neutral-600">
                Jira、Linear、Notion などの外部ツール認証はここに追加していきます。
                ツールごとに接続状態、権限範囲、解除操作を同じ形式で管理します。
              </p>
            </template>

            <div class="grid gap-3 md:grid-cols-3">
              <div
                v-for="service in plannedOAuthServices"
                :key="service.name"
                class="rounded-lg border border-dashed border-neutral-200 bg-neutral-50 px-4 py-3"
              >
                <div class="flex items-center gap-2 text-sm font-semibold text-neutral-700">
                  <UIcon :name="service.icon" class="h-4 w-4" />
                  {{ service.name }}
                </div>
                <p class="mt-2 text-xs leading-relaxed text-neutral-500">
                  {{ service.description }}
                </p>
              </div>
            </div>
          </EnCard>
        </div>
      </template>

      <!-- Godモード (内部オンボーディング) -->
      <template v-if="showGodMode" #god-mode>
        <GodModeOnboardingPanel />
      </template>

      <!-- その他 -->
      <template #more>
        <section class="rounded-lg border border-neutral-200 bg-white p-6 shadow-sm">
          <h2 class="mb-3 text-lg font-semibold">関連設定</h2>
          <ul class="space-y-2 text-sm">
            <li v-if="adminUserStore.isAdminOrAbove">
              <span class="text-neutral-600">
                メンバー管理は上部タブ「メンバー」から利用できます
              </span>
            </li>
            <li>
              <NuxtLink
                to="/admin/settings"
                class="inline-flex items-center gap-2 text-purple-600 underline hover:text-purple-700"
              >
                <UIcon name="material-symbols:settings" class="w-4 h-4" />
                サービス連携設定 (Slack / BigQuery 等)
              </NuxtLink>
            </li>
            <li v-if="showGodMode">
              <span class="inline-flex items-center gap-2 text-violet-600">
                <UIcon name="material-symbols:admin-panel-settings" class="w-4 h-4" />
                Godモードは上部タブ「Godモード」から利用できます
              </span>
            </li>
          </ul>
        </section>
      </template>
    </UTabs>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import GlobalPinnedKnowledgePanel from "@components/preferences/GlobalPinnedKnowledgePanel.vue";
import OAuthConnectionGitHubCard from "@components/preferences/OAuthConnectionGitHubCard.vue";
import OAuthConnectionSlackCard from "@components/preferences/OAuthConnectionSlackCard.vue";
import OrganizationMemberManagementPanel from "@components/admin/members/OrganizationMemberManagementPanel.vue";
import EnCard from "@components/EnCard.vue";
import {
  themeSemanticClasses,
  type ColorThemePresetId,
} from "@composables/useColorTheme";
import { getAuth } from "firebase/auth";
import {
  doc,
  getDoc,
  getFirestore,
  setDoc,
  deleteDoc,
  serverTimestamp,
} from "firebase/firestore";
import type { Timestamp } from "firebase/firestore";
import {
  getStorage,
  ref as storageRef,
  uploadBytes,
  getDownloadURL,
} from "firebase/storage";

defineOptions({
  name: "AdminPreferencesPage",
});

definePageMeta({
  name: "admin-preferences",
  layout: "admin",
  middleware: ["admin-logged-in-check"],
  adminPageStack: false,
});

const organization = useOrganizationStore();
const appearance = useAppAppearance();
// API キー差し替え時に AI 部下のクライアントキャッシュを無効化するため.
const enAiStudioAssistant = useEnAiStudioAssistantStore();
const aiUserSettings = useAiUserSettingsStore();

//#region color-theme
const {
  presets: colorThemePresets,
  currentThemeId: currentColorThemeId,
  selectTheme: selectColorTheme,
} = useColorTheme();
const savingTheme = ref(false);
const themeError = ref<string | null>(null);

const onSelectTheme = async (id: ColorThemePresetId) => {
  if (currentColorThemeId.value === id) return;
  savingTheme.value = true;
  themeError.value = null;
  try {
    await selectColorTheme(id);
  } catch (e) {
    themeError.value =
      e instanceof Error
        ? e.message === "Error Occurred"
          ? "テーマの保存に失敗しました。しばらくしてから再度お試しください。"
          : e.message
        : "テーマの保存に失敗しました。";
  } finally {
    savingTheme.value = false;
  }
};
//#endregion color-theme

const { canAccess: canAccessGodMode } = useGodModeAccess();
const adminUserStore = useAdminUserStore();
const showGodMode = computed(() => canAccessGodMode.value);

const tabItems = computed(() => {
  const base: Array<{ label: string; slot: string; icon: string }> = [];
  if (adminUserStore.isAdminOrAbove) {
    base.push({
      label: "メンバー",
      slot: "members",
      icon: "material-symbols:group",
    });
  }
  base.push(
    { label: "外観", slot: "appearance", icon: "material-symbols:palette" },
    { label: "AI 連携", slot: "ai-integration", icon: "material-symbols:key" },
    {
      label: "Googleクラウド連携",
      slot: "data-integration",
      icon: "material-symbols:cloud-sync",
    },
    {
      label: "OAuth認証",
      slot: "oauth-connections",
      icon: "material-symbols:hub",
    }
  );
  if (canAccessGodMode.value) {
    base.push({
      label: "Godモード",
      slot: "god-mode",
      icon: "material-symbols:admin-panel-settings",
    });
  }
  base.push({
    label: "その他",
    slot: "more",
    icon: "material-symbols:more-horiz",
  });
  return base;
});

const isMac = computed(() => {
  if (typeof navigator === "undefined") return false;
  return navigator.platform.toUpperCase().indexOf("MAC") >= 0;
});

const plannedOAuthServices = [
  {
    name: "Jira",
    icon: "i-simple-icons-jira",
    description: "Issue / Epic / Sprint 情報との連携に利用します。",
  },
  {
    name: "Linear",
    icon: "i-simple-icons-linear",
    description: "Issue とプロダクト開発履歴の参照に利用します。",
  },
  {
    name: "Notion",
    icon: "i-simple-icons-notion",
    description: "仕様書やナレッジベースの参照に利用します。",
  },
];

//#region appearance: logo & avatar
const logoInput = ref<HTMLInputElement | null>(null);
const avatarInput = ref<HTMLInputElement | null>(null);
const uploadingLogo = ref(false);
const uploadingAvatar = ref(false);
const logoError = ref<string | null>(null);
const avatarError = ref<string | null>(null);

const MAX_BRANDING_FILE_SIZE = 2 * 1024 * 1024; // 2MB

const onLogoSelected = async (event: Event) => {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (file) await uploadBranding(file, "logo");
  if (logoInput.value) logoInput.value.value = "";
};

const onAvatarSelected = async (event: Event) => {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (file) await uploadBranding(file, "ai-avatar");
  if (avatarInput.value) avatarInput.value.value = "";
};

const uploadBranding = async (file: File, kind: "logo" | "ai-avatar") => {
  const errorRef = kind === "logo" ? logoError : avatarError;
  const uploadingRef = kind === "logo" ? uploadingLogo : uploadingAvatar;
  errorRef.value = null;

  if (file.size > MAX_BRANDING_FILE_SIZE) {
    errorRef.value = "ファイルサイズは 2MB 以下にしてください";
    return;
  }
  if (!file.type.startsWith("image/")) {
    errorRef.value = "画像ファイルを選んでください";
    return;
  }

  const orgId = organization.getLoggedInOrganizationId;
  if (!orgId) {
    errorRef.value = "組織情報が取得できません";
    return;
  }

  uploadingRef.value = true;
  try {
    const ext = file.name.split(".").pop()?.toLowerCase() || "png";
    const path = `organizations/${orgId}/branding/${kind}-${Date.now()}.${ext}`;
    const ref = storageRef(getStorage(), path);
    await uploadBytes(ref, file, { contentType: file.type });
    const url = await getDownloadURL(ref);

    if (kind === "logo") {
      await organization.updateBranding({ logoUrl: url });
    } else {
      await organization.updateBranding({ aiAvatarUrl: url });
    }
  } catch (e) {
    errorRef.value = e instanceof Error ? e.message : String(e);
  } finally {
    uploadingRef.value = false;
  }
};

const resetLogo = async () => {
  if (!confirm("ヘッダーロゴをリセットします (VibeControl 文字表示に戻ります)。よろしいですか?")) return;
  logoError.value = null;
  uploadingLogo.value = true;
  try {
    // Storage 上の旧ファイル削除は best-effort (URL からパス逆引きは難しいのでスキップ)
    await organization.updateBranding({ logoUrl: null });
  } catch (e) {
    logoError.value = e instanceof Error ? e.message : String(e);
  } finally {
    uploadingLogo.value = false;
  }
};

const resetAvatar = async () => {
  if (!confirm("AI アバターを標準アバターに戻します。よろしいですか?")) return;
  avatarError.value = null;
  uploadingAvatar.value = true;
  try {
    await organization.updateBranding({ aiAvatarUrl: null });
  } catch (e) {
    avatarError.value = e instanceof Error ? e.message : String(e);
  } finally {
    uploadingAvatar.value = false;
  }
};
//#endregion appearance

//#region gemini-api-key (re-implemented from /admin/api-keys.vue で 1 画面集約)
const geminiLoading = ref(true);
const geminiSaving = ref(false);
const hasGeminiKey = ref(false);
const maskedGeminiKey = ref("");
const geminiUpdatedAt = ref<Date | null>(null);
const newGeminiKey = ref("");
const geminiError = ref<string | null>(null);
const geminiSuccess = ref<string | null>(null);

const geminiDocRef = () => {
  const u = getAuth().currentUser;
  if (!u) throw new Error("ログインしていません");
  return doc(getFirestore(), "users", u.uid, "secrets", "geminiApiKey");
};

const loadGeminiKey = async () => {
  geminiLoading.value = true;
  geminiError.value = null;
  try {
    const snap = await getDoc(geminiDocRef());
    if (snap.exists()) {
      const data = snap.data() as { apiKey?: string; updatedAt?: Timestamp };
      const k = data.apiKey ?? "";
      hasGeminiKey.value = !!k;
      maskedGeminiKey.value = k ? `${k.slice(0, 6)}…${k.slice(-4)}` : "";
      geminiUpdatedAt.value = data.updatedAt?.toDate?.() ?? null;
    } else {
      hasGeminiKey.value = false;
      maskedGeminiKey.value = "";
      geminiUpdatedAt.value = null;
    }
  } catch (e) {
    geminiError.value = e instanceof Error ? e.message : String(e);
  } finally {
    geminiLoading.value = false;
  }
};

const saveGeminiKey = async () => {
  if (!newGeminiKey.value) return;
  geminiSaving.value = true;
  geminiError.value = null;
  geminiSuccess.value = null;
  try {
    const key = newGeminiKey.value.trim();
    await setDoc(
      geminiDocRef(),
      { apiKey: key, updatedAt: serverTimestamp() },
      { merge: true },
    );
    newGeminiKey.value = "";
    geminiSuccess.value = "API キーを保存しました";
    await loadGeminiKey();
    await useGeminiByokStore().refreshUserApiKey();
    enAiStudioAssistant.clearUserApiKeyCache();
  } catch (e) {
    geminiError.value = e instanceof Error ? e.message : String(e);
  } finally {
    geminiSaving.value = false;
  }
};

const confirmRemoveGeminiKey = async () => {
  if (!confirm("API キーを削除します。AI 機能が使えなくなりますがよろしいですか?")) return;
  geminiSaving.value = true;
  geminiError.value = null;
  geminiSuccess.value = null;
  try {
    await deleteDoc(geminiDocRef());
    geminiSuccess.value = "API キーを削除しました";
    await loadGeminiKey();
    await useGeminiByokStore().refreshUserApiKey();
    enAiStudioAssistant.clearUserApiKeyCache();
  } catch (e) {
    geminiError.value = e instanceof Error ? e.message : String(e);
  } finally {
    geminiSaving.value = false;
  }
};

const formatTs = (d: Date) =>
  new Intl.DateTimeFormat("ja-JP", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(d);
//#endregion gemini-api-key

//#region openai-api-key
const openaiLoading = ref(true);
const openaiSaving = ref(false);
const hasOpenaiKey = ref(false);
const maskedOpenaiKey = ref("");
const openaiUpdatedAt = ref<Date | null>(null);
const newOpenaiKey = ref("");
const openaiError = ref<string | null>(null);
const openaiSuccess = ref<string | null>(null);

const openaiDocRef = () => {
  const u = getAuth().currentUser;
  if (!u) throw new Error("ログインしていません");
  return doc(getFirestore(), "users", u.uid, "secrets", "openaiApiKey");
};

const loadOpenaiKey = async () => {
  openaiLoading.value = true;
  openaiError.value = null;
  try {
    const snap = await getDoc(openaiDocRef());
    if (snap.exists()) {
      const data = snap.data() as { apiKey?: string; updatedAt?: Timestamp };
      const k = data.apiKey ?? "";
      hasOpenaiKey.value = !!k;
      maskedOpenaiKey.value = k ? `${k.slice(0, 7)}…${k.slice(-4)}` : "";
      openaiUpdatedAt.value = data.updatedAt?.toDate?.() ?? null;
    } else {
      hasOpenaiKey.value = false;
      maskedOpenaiKey.value = "";
      openaiUpdatedAt.value = null;
    }
  } catch (e) {
    openaiError.value = e instanceof Error ? e.message : String(e);
  } finally {
    openaiLoading.value = false;
  }
};

const saveOpenaiKey = async () => {
  if (!newOpenaiKey.value) return;
  openaiSaving.value = true;
  openaiError.value = null;
  openaiSuccess.value = null;
  try {
    const key = newOpenaiKey.value.trim();
    if (!key.startsWith("sk-")) {
      throw new Error(
        'OpenAI API キーは通常 "sk-" から始まります。コピペ漏れが無いか確認してください。'
      );
    }
    await setDoc(
      openaiDocRef(),
      { apiKey: key, updatedAt: serverTimestamp() },
      { merge: true }
    );
    newOpenaiKey.value = "";
    openaiSuccess.value = "OpenAI API キーを保存しました";
    await loadOpenaiKey();
    await useOpenaiByokStore().refreshUserApiKey();
  } catch (e) {
    openaiError.value = e instanceof Error ? e.message : String(e);
  } finally {
    openaiSaving.value = false;
  }
};

const confirmRemoveOpenaiKey = async () => {
  if (
    !confirm(
      "OpenAI API キーを削除します。画像生成が使えなくなりますがよろしいですか?"
    )
  ) {
    return;
  }
  openaiSaving.value = true;
  openaiError.value = null;
  openaiSuccess.value = null;
  try {
    await deleteDoc(openaiDocRef());
    openaiSuccess.value = "OpenAI API キーを削除しました";
    await loadOpenaiKey();
    await useOpenaiByokStore().refreshUserApiKey();
  } catch (e) {
    openaiError.value = e instanceof Error ? e.message : String(e);
  } finally {
    openaiSaving.value = false;
  }
};
//#endregion openai-api-key

//#region global-system-prompt
const globalPromptLoading = ref(true);
const globalPromptSaving = ref(false);
const globalSystemPromptDraft = ref("");
const globalPromptError = ref<string | null>(null);
const globalPromptSuccess = ref<string | null>(null);

const loadGlobalSystemPrompt = async () => {
  globalPromptLoading.value = true;
  globalPromptError.value = null;
  try {
    const prompt = await aiUserSettings.loadGlobalSystemPrompt(true);
    globalSystemPromptDraft.value = prompt;
  } catch (e) {
    globalPromptError.value = e instanceof Error ? e.message : String(e);
  } finally {
    globalPromptLoading.value = false;
  }
};

const saveGlobalSystemPrompt = async () => {
  globalPromptSaving.value = true;
  globalPromptError.value = null;
  globalPromptSuccess.value = null;
  try {
    await aiUserSettings.saveGlobalSystemPrompt(globalSystemPromptDraft.value);
    globalPromptSuccess.value = "グローバルシステムプロンプトを保存しました";
  } catch (e) {
    globalPromptError.value = e instanceof Error ? e.message : String(e);
  } finally {
    globalPromptSaving.value = false;
  }
};
//#endregion global-system-prompt

onMounted(async () => {
  await loadGeminiKey();
  await loadOpenaiKey();
  await loadGlobalSystemPrompt();
});
</script>
