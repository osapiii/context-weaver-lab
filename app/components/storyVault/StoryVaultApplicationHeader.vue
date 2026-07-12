<template>
  <div
    ref="rootEl"
    class="relative flex min-w-0 items-center gap-2"
  >
      <button
        type="button"
        class="group flex h-10 min-w-0 max-w-[18rem] items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-left text-sm shadow-sm transition hover:border-primary-200 hover:bg-primary-50/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-300"
        aria-label="アプリケーションを切り替える"
        :aria-expanded="isOpen"
        @click="toggleOpen"
      >
        <span class="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-slate-900 text-white">
          <UIcon name="material-symbols:apps" class="h-4 w-4" />
        </span>
        <span class="min-w-0 leading-tight">
          <span class="block text-[10px] font-semibold uppercase text-slate-500">
            Application
          </span>
          <span class="block truncate font-semibold text-slate-900">
            {{ selectedApplication?.name ?? "未選択" }}
          </span>
        </span>
        <UIcon
          name="material-symbols:keyboard-arrow-down-rounded"
          class="h-5 w-5 shrink-0 text-slate-400 transition group-data-[state=open]:rotate-180"
        />
      </button>

        <div
          v-if="isOpen"
          class="absolute left-0 top-full z-50 mt-2 w-[min(26rem,calc(100vw-2rem))] overflow-hidden rounded-lg bg-white shadow-xl ring-1 ring-slate-200"
        >
          <div class="border-b border-slate-100 bg-slate-50/80 p-3">
            <div class="flex min-w-0 items-center gap-2">
              <span class="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary-50 text-primary-600">
                <UIcon name="material-symbols:apps" class="h-5 w-5" />
              </span>
              <div class="min-w-0 flex-1">
                <p class="truncate text-sm font-bold text-slate-950">
                  {{ selectedApplication?.name ?? "アプリケーション未選択" }}
                </p>
                <p class="truncate text-xs text-slate-500">
                  {{ selectedApplication?.domain || selectedApplication?.repoFullName || "接続先未設定" }}
                </p>
              </div>
              <button
                v-if="showEdit"
                type="button"
                class="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-slate-500 transition hover:bg-white hover:text-slate-900"
                aria-label="選択中のアプリケーションを編集"
                :disabled="!selectedApplication"
                @click="editSelected"
              >
                <UIcon name="material-symbols:edit-outline" class="h-5 w-5" />
              </button>
            </div>
            <label class="mt-3 flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 focus-within:border-primary-400 focus-within:ring-2 focus-within:ring-primary-100">
              <UIcon name="material-symbols:search-rounded" class="h-5 w-5 shrink-0 text-slate-400" />
              <input
                v-model="query"
                type="search"
                class="min-w-0 flex-1 bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400"
                placeholder="アプリケーションを検索"
              >
            </label>
          </div>

          <div class="max-h-72 overflow-y-auto py-2">
            <button
              v-for="application in filteredApplications"
              :key="application.id"
              type="button"
              class="flex w-full min-w-0 items-center gap-3 px-4 py-3 text-left transition hover:bg-slate-50"
              :class="
                application.id === selectedApplication?.id
                  ? 'bg-primary-50 text-primary-700'
                  : 'text-slate-700'
              "
              @click="selectApplication(application.id)"
            >
              <span class="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-white text-primary-600 ring-1 ring-slate-200">
                <UIcon name="material-symbols:apps" class="h-4 w-4" />
              </span>
              <span class="min-w-0 flex-1">
                <span class="flex min-w-0 items-center gap-2">
                  <span class="truncate text-sm font-semibold">
                    {{ application.name }}
                  </span>
                  <span class="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] font-bold text-slate-500">
                    {{ application.applicationKey }}
                  </span>
                </span>
                <span class="mt-0.5 block truncate text-xs text-slate-500">
                  {{ application.repoFullName || application.domain || "接続先未設定" }}
                </span>
              </span>
              <UIcon
                v-if="application.id === selectedApplication?.id"
                name="material-symbols:check-rounded"
                class="h-5 w-5 shrink-0 text-primary-600"
              />
            </button>

            <div
              v-if="filteredApplications.length === 0"
              class="px-4 py-8 text-center"
            >
              <UIcon
                name="material-symbols:search-off-rounded"
                class="mx-auto h-8 w-8 text-slate-300"
              />
              <p class="mt-2 text-sm font-semibold text-slate-700">
                一致するアプリがありません
              </p>
              <p class="mt-1 text-xs text-slate-500">
                検索語を変えるか、アプリを追加してください。
              </p>
            </div>
          </div>

          <div class="border-t border-slate-100 bg-slate-50 p-3">
            <button
              v-if="showManage"
              type="button"
              class="flex h-10 w-full items-center justify-between rounded-lg bg-primary-50 px-3 text-left text-sm font-semibold text-primary-700 transition hover:bg-primary-100"
              @click="manageApplications"
            >
              <span class="inline-flex items-center gap-2">
                <UIcon name="material-symbols:dashboard-outline-rounded" class="h-5 w-5" />
                アプリ一覧を管理
              </span>
              <UIcon name="material-symbols:arrow-forward-rounded" class="h-5 w-5" />
            </button>
          </div>
        </div>

    <EnButton
      v-if="showCreate"
      variant="outline"
      color="neutral"
      size="sm"
      class="hidden sm:inline-flex"
      leading-icon="material-symbols:add"
      @click="$emit('create')"
    >
      新規
    </EnButton>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import type { DecodedStoryVaultApplication } from "@models/storyVault";

const props = withDefaults(defineProps<{
  applications: DecodedStoryVaultApplication[];
  selectedApplication: DecodedStoryVaultApplication | null;
  showCreate?: boolean;
  showEdit?: boolean;
  showManage?: boolean;
}>(), {
  showCreate: true,
  showEdit: true,
  showManage: true,
});

const showCreate = computed(() => props.showCreate !== false);
const showEdit = computed(() => props.showEdit !== false);
const showManage = computed(() => props.showManage !== false);

const emit = defineEmits<{
  select: [applicationId: string];
  create: [];
  edit: [];
  manage: [];
}>();

const rootEl = ref<HTMLElement | null>(null);
const isOpen = ref(false);
const query = ref("");

const filteredApplications = computed(() => {
  const normalizedQuery = query.value.trim().toLowerCase();
  if (!normalizedQuery) return props.applications;
  return props.applications.filter((application) =>
    [
      application.applicationKey,
      application.name,
      application.summary,
      application.domain,
      application.owner,
      application.fileSpaceId,
      application.repoFullName,
      ...application.labels,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase()
      .includes(normalizedQuery)
  );
});

watch(isOpen, (open) => {
  if (!open) {
    query.value = "";
  }
});

onMounted(() => {
  window.addEventListener("click", closeOnOutsideClick);
  window.addEventListener("keydown", closeOnEscape);
});

onBeforeUnmount(() => {
  window.removeEventListener("click", closeOnOutsideClick);
  window.removeEventListener("keydown", closeOnEscape);
});

function toggleOpen(): void {
  isOpen.value = !isOpen.value;
}

function closeOnOutsideClick(event: MouseEvent): void {
  if (!isOpen.value) return;
  const target = event.target;
  if (!(target instanceof Node)) return;
  if (rootEl.value?.contains(target)) return;
  isOpen.value = false;
}

function closeOnEscape(event: KeyboardEvent): void {
  if (event.key !== "Escape") return;
  isOpen.value = false;
}

function selectApplication(applicationId: string): void {
  emit("select", applicationId);
  isOpen.value = false;
}

function editSelected(): void {
  if (!props.selectedApplication) return;
  emit("edit");
  isOpen.value = false;
}

function manageApplications(): void {
  emit("manage");
  isOpen.value = false;
}
</script>
