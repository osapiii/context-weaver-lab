<template>
  <div>
    <div
      class="grid gap-3"
      :class="hideApplicationSelect ? 'lg:grid-cols-[minmax(0,1fr)_10rem_8rem]' : 'lg:grid-cols-[minmax(14rem,18rem)_minmax(0,1fr)_10rem_8rem]'"
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

    <div class="mt-3 grid gap-3 lg:grid-cols-3">
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
        <span class="text-xs font-medium text-slate-600">Username</span>
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

    <div class="mt-3 grid gap-3 lg:grid-cols-3">
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

    <div class="mt-3 grid gap-3 lg:grid-cols-2">
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
</template>

<script setup lang="ts">
import type { DecodedVibeControlApplication } from "@models/vibeControl";
import type { ApplicationScanFields } from "@utils/applicationScanWorkspaceState";

const props = defineProps<{
  applications: DecodedVibeControlApplication[];
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

function patchDraft<K extends keyof ApplicationScanFields>(
  key: K,
  value: ApplicationScanFields[K]
): void {
  if (props.draft[key] === value) return;
  emit("patchDraft", { [key]: value } as Partial<ApplicationScanFields>);
}
</script>
