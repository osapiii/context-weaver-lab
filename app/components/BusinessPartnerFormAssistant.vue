<template>
  <aside
    class="flex h-full min-h-[320px] flex-col overflow-hidden rounded-lg border border-purple-200/80 bg-white"
  >
    <header
      class="relative flex-shrink-0 border-b border-purple-200/60 bg-gradient-to-r from-violet-50 via-purple-50 to-violet-50 px-4 py-3"
    >
      <div class="relative flex items-center gap-2">
        <div
          class="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-purple-500 shadow-sm"
        >
          <UIcon name="i-heroicons-sparkles" class="h-4 w-4 text-white" />
        </div>
        <div class="min-w-0">
          <p class="text-sm font-bold text-slate-900">取引先 AI アシスタント</p>
          <p class="text-[11px] text-purple-800/90 leading-tight">
            空欄を AI で補完
          </p>
        </div>
      </div>
    </header>

    <div
      ref="historyRef"
      class="flex-1 min-h-0 overflow-y-auto px-3 py-3 space-y-3"
    >
      <div v-if="messages.length === 0" class="space-y-2 pt-1">
        <p class="text-xs text-slate-500 leading-relaxed">
          「代表者を調べて」「資本金を補完」など自然文で指示できます。空欄のみ自動で埋めます。
        </p>
        <div class="flex flex-wrap gap-1.5">
          <button
            v-for="sample in quickSamples"
            :key="sample"
            type="button"
            class="rounded-full border border-purple-200 bg-white px-2.5 py-1 text-[11px] font-medium text-purple-800 hover:bg-purple-50 transition-colors"
            @click="submit(sample)"
          >
            {{ sample }}
          </button>
        </div>
      </div>

      <div
        v-for="msg in messages"
        :key="msg.id"
        :class="['flex', msg.role === 'user' ? 'justify-end' : 'justify-start']"
      >
        <div
          :class="[
            'max-w-[92%] rounded-2xl px-3 py-2 text-[13px] leading-relaxed shadow-sm',
            msg.role === 'user'
              ? 'bg-violet-50 text-slate-900 ring-1 ring-violet-100'
              : 'bg-white text-slate-800 ring-1 ring-slate-200',
          ]"
        >
          <span v-if="msg.role === 'user'" class="whitespace-pre-wrap">{{ msg.text }}</span>
          <template v-else>
            <span v-if="msg.status === 'processing'" class="text-slate-500 italic">
              検索・補完中…
            </span>
            <span v-else class="whitespace-pre-wrap">{{ msg.text }}</span>
          </template>
        </div>
      </div>

      <EnAlert
        v-if="assistant.lastError.value"
        color="warning"
        :title="assistant.lastError.value"
        :icon="actionIcons.warning"
      />
    </div>

    <footer class="flex-shrink-0 border-t border-slate-100 p-2.5 space-y-2 bg-gradient-to-b from-white to-purple-50/40">
      <UTextarea
        v-model="input"
        :rows="2"
        placeholder="例: 代表者と資本金を調べて"
        class="w-full"
        :disabled="assistant.isLoading.value"
        @keydown.enter.exact.prevent="submit()"
      />
      <div class="flex justify-end">
        <EnButton
          variant="ai"
          size="sm"
          leading-icon="i-heroicons-paper-airplane"
          :loading="assistant.isLoading.value"
          :disabled="!input.trim()"
          @click="submit()"
        >
          送信
        </EnButton>
      </div>
    </footer>
  </aside>
</template>

<script lang="ts" setup>
import { computed, nextTick, onUnmounted, ref } from "vue";
import type {
  BusinessPartnerAssistantPatch,
  BusinessPartnerFormSnapshot,
} from "@models/businessPartnerFormAssistant";
import type { BusinessPartnerReviewSubStep } from "@composables/useBusinessPartnerFormAssistant";
import { useBusinessPartnerFormAssistant } from "@composables/useBusinessPartnerFormAssistant";
import EnAlert from "@components/EnAlert.vue";
import EnButton from "@components/EnButton.vue";

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
  status?: "processing" | "done";
};

const props = defineProps<{
  snapshot: BusinessPartnerFormSnapshot;
  subStep: BusinessPartnerReviewSubStep;
}>();

const emit = defineEmits<{
  apply: [patch: BusinessPartnerAssistantPatch];
}>();

const assistant = useBusinessPartnerFormAssistant();
const actionIcons = useActionIcons();
const toast = useToast();

onUnmounted(() => {
  assistant.cancelPending();
});

const input = ref("");
const messages = ref<ChatMessage[]>([]);
const historyRef = ref<HTMLElement | null>(null);

const quickSamples = computed(() => {
  switch (props.subStep) {
    case "all":
      return [
        "不足項目をすべて補完",
        "代表者と資本金を調べて",
        "連絡先を調べて",
      ];
    case "required":
      return ["正式商号を調べて", "フリガナを補完"];
    case "addressAndCompany":
      return [
        "本社住所を郵便番号付きで",
        "代表者を調べて",
        "資本金と設立日を補完",
      ];
    case "contact":
      return ["問い合わせ電話とメール", "公式サイト URL"];
    default:
      return [];
  }
});

const scrollToBottom = async () => {
  await nextTick();
  const el = historyRef.value;
  if (el) el.scrollTop = el.scrollHeight;
};

const submit = async (preset?: string) => {
  const text = (preset ?? input.value).trim();
  if (!text || assistant.isLoading.value) return;

  const userId = `u_${Date.now()}`;
  const aiId = `a_${Date.now()}`;
  messages.value.push({ id: userId, role: "user", text });
  messages.value.push({
    id: aiId,
    role: "assistant",
    text: "",
    status: "processing",
  });
  input.value = "";
  await scrollToBottom();

  const result = await assistant.enrichForm({
    userMessage: text,
    snapshot: props.snapshot,
    subStep: props.subStep,
  });

  const idx = messages.value.findIndex((m) => m.id === aiId);
  if (idx < 0) return;

  if (!result) {
    messages.value[idx] = {
      id: aiId,
      role: "assistant",
      text: assistant.lastError.value ?? "補完できませんでした。",
      status: "done",
    };
    await scrollToBottom();
    return;
  }

  emit("apply", result);

  const fieldCount = result.fields
    ? Object.values(result.fields).filter(
        (v) => typeof v === "string" && v.trim().length > 0
      ).length
    : 0;

  messages.value[idx] = {
    id: aiId,
    role: "assistant",
    text:
      result.comment ??
      (fieldCount > 0
        ? `${fieldCount} 件の項目をフォームに反映しました。`
        : "追加で埋められる項目は見つかりませんでした。"),
    status: "done",
  };

  if (fieldCount > 0) {
    toast.add({
      title: "AI がフォームを更新しました",
      description: result.comment,
      color: "success",
      icon: actionIcons.check,
    });
  }

  await scrollToBottom();
};
</script>
