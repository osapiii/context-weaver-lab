<template>
  <EnAlert
    v-if="context.helpTextIsActive"
    :title="selectedNote.title"
    :description="selectedNote.description"
    variant="outline"
    custom-class="mb-3 mt-3"
    :icon="businessIcons.note"
    :ui="{
      icon: 'size-11',
      title: 'text-lg font-bold',
      description: 'text-md  text-slate-700',
    }"
  />
</template>

<script lang="ts" setup>
//#region icons
const businessIcons = useBusinessIcons();
//#endregion icons

//#region store
const context = useContextStore();
//#endregion store

//#region props
const props = defineProps<{
  noteKey: keyof typeof notes.value;
}>();

const notes = useNotes();
const selectedNote = ref({
  ...notes.value[props.noteKey],
  description: notes.value[props.noteKey].description.replace(/\n/g, "<br>"),
});
</script>
