<template>
  <div class="flex flex-wrap items-center gap-2">
    <EnButton
      v-if="!hideEdit"
      color="neutral"
      variant="outline"
      :leading-icon="actionIcons.edit"
      @click="emit('edit')"
    >
      編集
    </EnButton>

    <EnButton
      v-if="hasAi"
      color="primary"
      variant="outline"
      leading-icon="material-symbols:auto-awesome"
      @click="emit('createViaAi')"
    >
      AIで登録
    </EnButton>

    <UPopover v-model:open="isCreatePickerOpen">
      <EnButton
        color="primary"
        variant="hero"
        :leading-icon="actionIcons.add"
      >
        {{ entityLabel }}を登録
      </EnButton>

      <template #content>
        <div class="w-72 p-2">
          <button
            type="button"
            class="flex w-full items-start gap-3 rounded-lg px-3 py-3 text-left transition hover:bg-slate-50"
            @click="selectManual"
          >
            <UIcon
              name="material-symbols:edit-square-outline"
              class="mt-0.5 h-5 w-5 shrink-0 text-teal-600"
            />
            <span class="min-w-0">
              <span class="block text-sm font-semibold text-slate-900">
                {{ manualOptionTitle }}
              </span>
              <span class="mt-0.5 block text-xs leading-relaxed text-slate-500">
                {{ manualOptionDescription }}
              </span>
            </span>
          </button>

          <button
            v-if="hasImport"
            type="button"
            class="flex w-full items-start gap-3 rounded-lg px-3 py-3 text-left transition hover:bg-slate-50"
            @click="selectImport"
          >
            <UIcon
              name="material-symbols:upload-file"
              class="mt-0.5 h-5 w-5 shrink-0 text-purple-600"
            />
            <span class="min-w-0">
              <span class="block text-sm font-semibold text-slate-900">
                {{ importOptionTitle }}
              </span>
              <span class="mt-0.5 block text-xs leading-relaxed text-slate-500">
                {{ importOptionDescription }}
              </span>
            </span>
          </button>
        </div>
      </template>
    </UPopover>
  </div>
</template>

<script setup lang="ts">
type Props = {
  entityLabel: string;
  hideEdit?: boolean;
  hasAi?: boolean;
  hasImport?: boolean;
  manualOptionTitle?: string;
  manualOptionDescription?: string;
  importOptionTitle?: string;
  importOptionDescription?: string;
};

withDefaults(defineProps<Props>(), {
  hideEdit: false,
  hasAi: true,
  hasImport: false,
  manualOptionTitle: "個別登録",
  manualOptionDescription: "フォームから1件ずつ登録します",
  importOptionTitle: "一括登録",
  importOptionDescription: "ファイルからまとめて登録します",
});

const emit = defineEmits<{
  edit: [];
  createViaAi: [];
  createManually: [];
  createViaImport: [];
}>();

const actionIcons = useActionIcons();
const isCreatePickerOpen = ref(false);

const openCreatePicker = () => {
  isCreatePickerOpen.value = true;
};

const selectManual = () => {
  isCreatePickerOpen.value = false;
  emit("createManually");
};

const selectImport = () => {
  isCreatePickerOpen.value = false;
  emit("createViaImport");
};

defineExpose({
  openCreatePicker,
});
</script>
