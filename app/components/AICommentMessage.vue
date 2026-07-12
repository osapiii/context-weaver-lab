<template>
  <div v-if="comment" class="w-full">
    <UChatMessage
      :id="computedMessageId"
      role="assistant"
      :parts="[
        {
          type: 'text',
          id: '1',
          text: comment,
        },
      ]"
      :avatar="{
        src: appearance.aiAvatarUrl.value,
      }"
      variant="soft"
      side="left"
      :compact="false"
      :ui="{
        content: 'text-lg font-bold leading-relaxed text-slate-800 px-4 py-3 bg-gradient-to-br from-blue-50 to-slate-50 rounded-lg shadow-sm border border-blue-100/50',
        container: 'gap-3',
        leadingAvatarSize: 'md',
      }"
    />
  </div>
  <div
    v-else
    class="w-full p-4 flex items-center justify-center min-h-[100px] bg-slate-50 rounded-lg border border-slate-200"
  >
    <div class="flex items-center gap-3 text-base text-slate-500">
      <UIcon
        name="i-heroicons-arrow-path"
        class="w-5 h-5 animate-spin"
      />
      <span class="font-medium">解説を生成中...</span>
    </div>
  </div>
</template>

<script lang="ts" setup>
const appearance = useAppAppearance();

const props = defineProps({
  /**
   * AIコメントのテキスト
   */
  comment: {
    type: String,
    default: "",
  },
  /**
   * メッセージID（オプション）
   */
  messageId: {
    type: String,
    default: "",
  },
});

/**
 * メッセージIDを生成（コメントのハッシュベース）
 */
const computedMessageId = computed(() => {
  if (props.messageId) {
    return props.messageId;
  }
  if (props.comment) {
    const hash = props.comment.split('').reduce((acc, char) => {
      const hash = ((acc << 5) - acc) + char.charCodeAt(0);
      return hash & hash;
    }, 0);
    return `ai-comment-${Math.abs(hash)}`;
  }
  return `ai-comment-${Date.now()}`;
});
</script>

