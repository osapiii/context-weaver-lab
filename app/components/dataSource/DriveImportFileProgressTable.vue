<template>
  <div
    class="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200/80 dark:bg-slate-900/40 dark:ring-white/10"
  >
    <div
      class="flex shrink-0 items-center justify-between gap-3 border-b border-slate-100/80 bg-gradient-to-r from-slate-50/90 to-white px-5 py-3.5 dark:border-white/10 dark:from-slate-900/60 dark:to-slate-900/40"
    >
      <div class="flex items-center gap-2.5">
        <div
          class="flex h-8 w-8 items-center justify-center rounded-lg bg-white shadow-sm ring-1 ring-slate-200/80 dark:bg-slate-800 dark:ring-white/10"
        >
          <UIcon
            name="i-heroicons-queue-list"
            class="h-4 w-4 text-slate-600 dark:text-slate-300"
          />
        </div>
        <div>
          <p class="text-sm font-semibold tracking-tight text-gray-900 dark:text-white">
            ファイルごとの進捗
          </p>
          <p class="text-[11px] text-gray-500">
            各ファイルが 4 段階を順に通過します
          </p>
        </div>
        <EnBadge variant="soft" color="primary" size="xs">
          {{ rows.length }} 件
        </EnBadge>
      </div>
    </div>

    <div class="min-h-0 flex-1 overflow-auto">
      <table class="w-full min-w-[720px] lg:min-w-0 border-collapse text-left">
        <thead class="sticky top-0 z-10 bg-white/95 backdrop-blur dark:bg-slate-900/95">
          <tr class="border-b border-slate-100 dark:border-white/10">
            <th
              scope="col"
              class="px-5 py-3 text-[11px] font-semibold uppercase tracking-wide text-gray-500"
            >
              ファイル
            </th>
            <th
              v-for="col in columns"
              :key="col.id"
              scope="col"
              class="px-2 py-3 text-center text-[10px] font-semibold uppercase tracking-wide text-gray-500"
            >
              {{ col.label }}
            </th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="row in rows"
            :key="row.driveFileId"
            class="group border-b border-slate-100/80 transition-colors last:border-b-0 hover:bg-slate-50/70 dark:border-white/5 dark:hover:bg-white/[0.02]"
            :class="
              driveImportRowIsActive(row)
                ? 'bg-sky-50/40 dark:bg-sky-950/20'
                : ''
            "
          >
            <td class="px-5 py-3.5 align-middle">
              <div class="flex min-w-0 items-start gap-3">
                <div
                  class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ring-1"
                  :class="driveImportFileTypeTone(row.label)"
                >
                  <UIcon
                    :name="driveImportFileTypeIcon(row.label)"
                    class="h-5 w-5"
                  />
                </div>
                <div class="min-w-0 flex-1">
                  <div class="flex flex-wrap items-center gap-1.5">
                    <EnBadge
                      :variant="row.kind === 'remove' ? 'outline' : 'soft'"
                      :color="row.kind === 'remove' ? 'neutral' : 'primary'"
                      size="xs"
                    >
                      {{ row.kind === "remove" ? "削除" : "追加" }}
                    </EnBadge>
                    <p
                      class="min-w-0 truncate text-[13px] font-medium leading-snug text-gray-900 dark:text-gray-100"
                      :title="row.label"
                    >
                      {{ row.label }}
                    </p>
                  </div>
                  <p
                    v-if="!row.label.includes('…')"
                    class="mt-0.5 font-mono text-[10px] text-gray-400"
                    :title="row.driveFileId"
                  >
                    {{ shortDriveFileId(row.driveFileId) }}
                  </p>
                  <p
                    v-if="row.errorMessage"
                    class="mt-1 text-[11px] leading-snug text-rose-600 break-words"
                  >
                    {{ row.errorMessage }}
                  </p>
                </div>
              </div>
            </td>
            <td
              v-for="(col, colIndex) in columns"
              :key="`${row.driveFileId}-${col.id}`"
              class="px-2 py-3.5 text-center align-middle"
            >
              <div class="relative inline-flex items-center justify-center">
                <span
                  v-if="colIndex > 0"
                  class="pointer-events-none absolute right-[calc(50%+1.25rem)] top-1/2 hidden h-px w-4 -translate-y-1/2 bg-slate-200 sm:block"
                  aria-hidden="true"
                />
                <div
                  class="relative inline-flex h-9 w-9 items-center justify-center rounded-full transition-all duration-300"
                  :class="driveImportFileColumnCellClass(row.columns[col.id])"
                  :title="`${col.label}: ${stageStatusLabel(row.columns[col.id])}`"
                >
                  <span
                    v-if="row.columns[col.id] === 'running'"
                    class="absolute inset-0 animate-ping rounded-full bg-sky-200/60"
                    aria-hidden="true"
                  />
                  <UIcon
                    :name="driveImportFileColumnIcon(row.columns[col.id])"
                    class="relative h-4 w-4"
                    :class="[
                      driveImportFileColumnTone(row.columns[col.id]),
                      row.columns[col.id] === 'running' ? 'animate-spin' : '',
                    ]"
                  />
                </div>
              </div>
            </td>
          </tr>
          <tr v-if="rows.length === 0">
            <td
              :colspan="columns.length + 1"
              class="px-5 py-16 text-center"
            >
              <div class="mx-auto flex max-w-sm flex-col items-center gap-2">
                <div
                  class="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400"
                >
                  <UIcon name="i-heroicons-folder-open" class="h-6 w-6" />
                </div>
                <p class="text-sm font-medium text-gray-700">
                  対象ファイルを確認しています
                </p>
                <p class="text-[11px] text-gray-500">
                  取り込み開始後、ここに 1 行 = 1 ファイルで進捗が表示されます
                </p>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup lang="ts">
import EnBadge from "@components/EnBadge.vue";
import {
  DRIVE_IMPORT_FILE_COLUMNS,
  driveImportFileColumnCellClass,
  driveImportFileColumnIcon,
  driveImportFileColumnTone,
  driveImportFileTypeIcon,
  driveImportFileTypeTone,
  driveImportRowIsActive,
  shortDriveFileId,
  type DriveImportFileColumnStatus,
  type DriveImportFileRow,
} from "@utils/driveImportFileRows";

defineProps<{
  rows: DriveImportFileRow[];
}>();

const columns = DRIVE_IMPORT_FILE_COLUMNS;

function stageStatusLabel(status: DriveImportFileColumnStatus): string {
  switch (status) {
    case "completed":
      return "完了";
    case "running":
      return "処理中";
    case "error":
      return "失敗";
    case "skipped":
      return "スキップ";
    default:
      return "待機";
  }
}
</script>
