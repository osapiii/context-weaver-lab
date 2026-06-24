<template>
  <div>
    <div class="mb-3 flex flex-wrap items-center justify-between gap-3">
      <div>
        <p class="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Scan Profile
        </p>
        <p class="mt-1 text-sm font-bold text-slate-900">
          接続先とログイン情報
        </p>
      </div>
      <EnBadge
        v-if="selectedProfile"
        variant="tag"
      >
        {{ selectedProfileBadgeLabel }}
      </EnBadge>
    </div>

    <div
      class="grid gap-3"
      :class="hideApplicationSelect ? 'lg:grid-cols-[minmax(12rem,16rem)_minmax(0,1fr)_8rem]' : 'lg:grid-cols-[minmax(12rem,16rem)_minmax(12rem,16rem)_minmax(0,1fr)_8rem]'"
    >
      <label
        v-if="!hideApplicationSelect"
        class="block min-w-0"
      >
        <span class="text-xs font-medium text-slate-600">Application</span>
        <select
          :value="selectedApplicationId"
          class="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100"
          @change="emit('selectApplication', ($event.target as HTMLSelectElement).value)"
        >
          <option
            v-for="application in applications"
            :key="application.id"
            :value="application.id"
          >
            {{ application.name }}
          </option>
        </select>
      </label>

      <label class="block min-w-0">
        <span class="text-xs font-medium text-slate-600">Scan Profile</span>
        <select
          :value="draft.scanProfileId"
          class="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100"
          @change="patchDraft('scanProfileId', ($event.target as HTMLSelectElement).value)"
        >
          <option value="">新規/Default</option>
          <option
            v-for="profile in activeScanProfiles"
            :key="profile.id"
            :value="profile.id"
          >
            {{ profile.name }}
          </option>
        </select>
      </label>

      <label class="block min-w-0">
        <span class="text-xs font-medium text-slate-600">FileSpace</span>
        <input
          :value="draft.fileSpaceId"
          type="text"
          class="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100"
          placeholder="w-default"
          @input="patchDraft('fileSpaceId', ($event.target as HTMLInputElement).value)"
        >
      </label>

      <label class="block min-w-0">
        <span class="text-xs font-medium text-slate-600">Max pages</span>
        <input
          :value="draft.maxPages"
          type="number"
          min="1"
          max="50"
          class="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100"
          @input="patchDraft('maxPages', Number(($event.target as HTMLInputElement).value) || 1)"
        >
      </label>
    </div>

    <div class="mt-3 grid gap-3 lg:grid-cols-[minmax(12rem,18rem)_minmax(0,1fr)]">
      <label class="block min-w-0">
        <span class="text-xs font-medium text-slate-600">Profile name</span>
        <input
          :value="draft.scanProfileName"
          type="text"
          class="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100"
          placeholder="Default"
          @input="patchDraft('scanProfileName', ($event.target as HTMLInputElement).value)"
        >
      </label>

      <div class="block min-w-0">
        <span class="text-xs font-medium text-slate-600">認証方式</span>
        <div class="mt-1 grid gap-1 rounded-lg border border-slate-200 bg-slate-50 p-1 sm:grid-cols-3">
          <button
            v-for="option in authModeOptions"
            :key="option.value"
            type="button"
            class="rounded-md px-3 py-2 text-left text-xs font-semibold transition"
            :class="draft.authMode === option.value ? 'bg-white text-slate-900 shadow-sm ring-1 ring-slate-200' : 'text-slate-500 hover:bg-white/70 hover:text-slate-800'"
            @click="setAuthMode(option.value)"
          >
            {{ option.label }}
          </button>
        </div>
      </div>
    </div>

    <div
      v-if="draft.authMode === 'none'"
      class="mt-3 grid gap-3 lg:grid-cols-[minmax(0,1fr)]"
    >
      <label class="block min-w-0">
        <span class="text-xs font-medium text-slate-600">Start URL</span>
        <input
          :value="draft.startUrl"
          type="url"
          class="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100"
          placeholder="https://example.com/"
          @input="patchDraft('startUrl', ($event.target as HTMLInputElement).value)"
        >
      </label>
    </div>

    <div
      v-if="draft.authMode === 'credentials'"
      class="mt-3 grid gap-3 lg:grid-cols-4"
    >
      <label class="block min-w-0">
        <span class="text-xs font-medium text-slate-600">Start URL</span>
        <input
          :value="draft.startUrl"
          type="url"
          class="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100"
          placeholder="https://example.com/"
          @input="patchDraft('startUrl', ($event.target as HTMLInputElement).value)"
        >
      </label>
      <label class="block min-w-0">
        <span class="text-xs font-medium text-slate-600">Login URL</span>
        <input
          :value="draft.loginUrl"
          type="url"
          class="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100"
          placeholder="未指定"
          @input="patchDraft('loginUrl', ($event.target as HTMLInputElement).value)"
        >
      </label>
      <label class="block min-w-0">
        <span class="text-xs font-medium text-slate-600">ID / Email</span>
        <input
          :value="draft.username"
          type="text"
          autocomplete="username"
          class="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100"
          placeholder="未指定"
          @input="patchDraft('username', ($event.target as HTMLInputElement).value)"
        >
      </label>
      <label class="block min-w-0">
        <span class="text-xs font-medium text-slate-600">Password</span>
        <input
          :value="draft.password"
          type="password"
          autocomplete="current-password"
          class="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100"
          placeholder="未指定"
          @input="patchDraft('password', ($event.target as HTMLInputElement).value)"
        >
      </label>
    </div>

    <div
      v-else-if="draft.authMode === 'email_link_manual'"
      class="mt-3 grid gap-3 lg:grid-cols-[minmax(0,1fr)]"
    >
      <label class="block min-w-0">
        <span class="text-xs font-medium text-slate-600">認証済みURL</span>
        <input
          :value="draft.authenticatedUrl"
          type="url"
          class="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100"
          placeholder="メール内のログインリンク、またはログイン完了後のURL"
          @input="patchDraft('authenticatedUrl', ($event.target as HTMLInputElement).value)"
        >
      </label>
    </div>

    <div class="mt-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] leading-relaxed text-slate-600">
      {{ authModeHelpText }}
    </div>

    <div class="mt-3 rounded-lg border border-slate-200">
      <button
        type="button"
        class="flex w-full items-center justify-between gap-3 px-3 py-2 text-left"
        @click="showAdvancedSettings = !showAdvancedSettings"
      >
        <span>
          <span class="block text-sm font-semibold text-slate-800">詳細設定</span>
          <span class="mt-0.5 block text-xs text-slate-500">
            selector、include/exclude patternを必要な時だけ設定します
          </span>
        </span>
        <UIcon
          :name="showAdvancedSettings ? 'material-symbols:expand-less-rounded' : 'material-symbols:expand-more-rounded'"
          class="h-5 w-5 text-slate-400"
        />
      </button>

      <div
        v-if="showAdvancedSettings"
        class="border-t border-slate-100 p-3"
      >
        <div
          v-if="draft.authMode === 'credentials'"
          class="grid gap-3 lg:grid-cols-3"
        >
          <label class="block min-w-0">
            <span class="text-xs font-medium text-slate-600">Username selector</span>
            <input
              :value="draft.usernameSelector"
              type="text"
              class="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100"
              placeholder="input[name=email]"
              @input="patchDraft('usernameSelector', ($event.target as HTMLInputElement).value)"
            >
          </label>
          <label class="block min-w-0">
            <span class="text-xs font-medium text-slate-600">Password selector</span>
            <input
              :value="draft.passwordSelector"
              type="text"
              class="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100"
              placeholder="input[type=password]"
              @input="patchDraft('passwordSelector', ($event.target as HTMLInputElement).value)"
            >
          </label>
          <label class="block min-w-0">
            <span class="text-xs font-medium text-slate-600">Submit selector</span>
            <input
              :value="draft.submitSelector"
              type="text"
              class="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100"
              placeholder="button[type=submit]"
              @input="patchDraft('submitSelector', ($event.target as HTMLInputElement).value)"
            >
          </label>
        </div>

        <div
          :class="draft.authMode === 'credentials' ? 'mt-3' : ''"
          class="grid gap-3 lg:grid-cols-2"
        >
          <label class="block min-w-0">
            <span class="text-xs font-medium text-slate-600">Include patterns</span>
            <textarea
              :value="includePatternsText"
              rows="2"
              class="mt-1 w-full resize-none rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100"
              placeholder="1行に1パターン"
              @input="emit('update:includePatternsText', ($event.target as HTMLTextAreaElement).value)"
            />
          </label>
          <label class="block min-w-0">
            <span class="text-xs font-medium text-slate-600">Exclude patterns</span>
            <textarea
              :value="excludePatternsText"
              rows="2"
              class="mt-1 w-full resize-none rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100"
              placeholder="1行に1パターン"
              @input="emit('update:excludePatternsText', ($event.target as HTMLTextAreaElement).value)"
            />
          </label>
        </div>
      </div>
    </div>

    <div class="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
      <label class="flex items-center gap-2 text-sm font-semibold text-slate-700">
        <input
          :checked="draft.exploreVariants"
          type="checkbox"
          class="h-4 w-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
          @change="patchDraft('exploreVariants', ($event.target as HTMLInputElement).checked)"
        >
        Variant探索
      </label>
      <div class="mt-3 grid gap-3 lg:grid-cols-2">
        <label class="block min-w-0">
          <span class="text-xs font-medium text-slate-600">最大Variant数/画面</span>
          <input
            :value="draft.maxVariantsPerScreen"
            type="number"
            min="0"
            max="10"
            :disabled="!draft.exploreVariants"
            class="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100 disabled:bg-slate-100 disabled:text-slate-400"
            @input="patchDraft('maxVariantsPerScreen', Number(($event.target as HTMLInputElement).value) || 0)"
          >
        </label>
        <label class="block min-w-0">
          <span class="text-xs font-medium text-slate-600">最大操作数/画面</span>
          <input
            :value="draft.maxStepsPerScreen"
            type="number"
            min="1"
            max="30"
            :disabled="!draft.exploreVariants"
            class="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100 disabled:bg-slate-100 disabled:text-slate-400"
            @input="patchDraft('maxStepsPerScreen', Number(($event.target as HTMLInputElement).value) || 1)"
          >
        </label>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import type {
  DecodedVibeControlApplication,
  DecodedVibeControlApplicationScanProfile,
  VibeControlScanAuthMode,
} from "@models/vibeControl";
import type { ApplicationScanFields } from "@utils/applicationScanWorkspaceState";

const props = defineProps<{
  applications: DecodedVibeControlApplication[];
  scanProfiles?: DecodedVibeControlApplicationScanProfile[];
  selectedApplicationId: string;
  draft: ApplicationScanFields;
  includePatternsText: string;
  excludePatternsText: string;
  hideApplicationSelect?: boolean;
}>();

const emit = defineEmits<{
  "update:includePatternsText": [value: string];
  "update:excludePatternsText": [value: string];
  patchDraft: [patch: Partial<ApplicationScanFields>];
  selectApplication: [applicationId: string];
}>();

const activeScanProfiles = computed(() =>
  (props.scanProfiles ?? []).filter(
    (profile) => profile.applicationId === props.selectedApplicationId
  )
);

const selectedProfile = computed(() =>
  activeScanProfiles.value.find((profile) => profile.id === props.draft.scanProfileId)
);

const authModeOptions: { value: VibeControlScanAuthMode; label: string }[] = [
  { value: "none", label: "認証なし" },
  { value: "credentials", label: "ID/PASS" },
  { value: "email_link_manual", label: "メールリンク" },
];

const selectedProfileBadgeLabel = computed(() => {
  if (!selectedProfile.value) return "";
  const authMode = resolveScanProfileAuthMode(selectedProfile.value);
  if (authMode === "credentials") {
    return selectedProfile.value.passwordConfigured
      ? "ID/PASS保存済み"
      : "ID/PASS未保存";
  }
  if (authMode === "email_link_manual") {
    return "メールリンク認証";
  }
  return "認証なし";
});

const authModeHelpText = computed(() => {
  if (props.draft.authMode === "credentials") {
    return "Profileは静的解析とVariant探索で共通利用されます。保存済みpasswordは入力欄には再表示されません。変更する場合だけ再入力してください。";
  }
  if (props.draft.authMode === "email_link_manual") {
    return "メールリンク送信はユーザー側で実行し、受信したログインリンクを認証済みURLに貼り付けてください。メールアドレスは保存せず、このURLも今回のScan実行にだけ使います。";
  }
  return "公開画面やログイン不要の画面を解析します。必要になったら認証方式を切り替えてください。";
});

const showAdvancedSettings = ref(false);

function patchDraft<K extends keyof ApplicationScanFields>(
  key: K,
  value: ApplicationScanFields[K]
): void {
  if (props.draft[key] === value) return;
  emit("patchDraft", { [key]: value } as Partial<ApplicationScanFields>);
}

function setAuthMode(authMode: VibeControlScanAuthMode): void {
  const patch: Partial<ApplicationScanFields> = { authMode };
  if (authMode !== "credentials") {
    patch.username = "";
    patch.password = "";
    patch.startUrl = "";
    patch.usernameSelector = "";
    patch.passwordSelector = "";
    patch.submitSelector = "";
  }
  if (authMode !== "email_link_manual") {
    patch.authenticatedUrl = "";
  }
  emit("patchDraft", patch);
}

function resolveScanProfileAuthMode(
  profile: DecodedVibeControlApplicationScanProfile
): VibeControlScanAuthMode {
  if (profile.authMode !== "none") return profile.authMode;
  if (profile.loginUrl || profile.username || profile.passwordConfigured) {
    return "credentials";
  }
  return "none";
}
</script>
