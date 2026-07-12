<template>
  <footer
    class="flex-shrink-0 border-t border-neutral-200 bg-white p-2.5"
  >
    <form
      class="flex flex-col gap-2"
      @submit.prevent="onSubmit"
    >
      <UTextarea
        ref="textareaRef"
        v-model="input"
        :rows="3"
        :placeholder="placeholder"
        class="w-full"
        :disabled="store.isStreaming"
        @keydown="onTextareaKeydown"
        @focus="isInputFocused = true"
        @blur="isInputFocused = false"
      />
      <div class="flex items-center gap-2">
        <div class="min-w-0 flex-1" />
        <div class="ml-auto flex shrink-0 items-center gap-2">
          <p
            v-if="isInputFocused && !store.isStreaming"
            class="inline-flex items-center gap-1 text-[10px] text-neutral-500"
            data-testid="ai-studio-send-shortcut-hint"
          >
            <UKbd size="sm" variant="subtle">Shift</UKbd>
            <span aria-hidden="true">+</span>
            <UKbd size="sm" variant="subtle">Enter</UKbd>
            <span>で送信</span>
          </p>
          <EnButton
            v-if="store.isStreaming"
            type="button"
            variant="soft"
            color="error"
            size="sm"
            leading-icon="material-symbols:stop"
            @click="store.cancelStream()"
          >
            中断
          </EnButton>
          <EnButton
            v-else
            type="submit"
            variant="solid"
            color="primary"
            size="sm"
            leading-icon="i-heroicons-paper-airplane"
            title="Shift+Enter で送信"
            :disabled="!input.trim()"
          >
            送信
          </EnButton>
        </div>
      </div>
    </form>
  </footer>
</template>

<script setup lang="ts">
import { computed, nextTick, ref } from "vue";
import { useAiStudioStore } from "@stores/aiStudio";
import EnButton from "@components/EnButton.vue";

const store = useAiStudioStore();
const input = ref("");
const isInputFocused = ref(false);
const textareaRef = ref<{ $el?: HTMLElement } | null>(null);

const placeholder = computed(() => {
  if (store.isStreaming) return "生成中...";
  if (store.activeAgent === "sheet" && !store.spreadsheetId) {
    return "Google スプレッドシートの URL を貼り付けてください";
  }
  switch (store.activeAgent) {
    case "writing":
      return "どんな文章を作りますか?";
    case "image":
      return "どんな画像を生成しますか?";
    case "sheet":
      return "シートに何をしますか?";
    case "consultation":
      return "何を相談しますか?";
    default:
      return "メッセージを入力…";
  }
});

const focusTextarea = (): void => {
  const root = textareaRef.value?.$el;
  const el =
    root instanceof HTMLTextAreaElement
      ? root
      : root?.querySelector?.("textarea");
  if (el instanceof HTMLTextAreaElement) {
    el.focus();
  }
};

const onTextareaKeydown = (event: KeyboardEvent): void => {
  if (event.key === "Enter" && event.shiftKey) {
    event.preventDefault();
    void onSubmit();
  }
};

const onSubmit = async () => {
  const text = input.value.trim();
  if (!text || store.isStreaming) return;
  if (store.activeAgent === "sheet" && !store.spreadsheetId) {
    store.updateSpreadsheetUrl(text);
  }
  input.value = "";
  await store.send(text);
};

const setDraftAndFocus = async (text: string) => {
  input.value = text;
  await nextTick();
  focusTextarea();
};

defineExpose({ setDraftAndFocus });
</script>
