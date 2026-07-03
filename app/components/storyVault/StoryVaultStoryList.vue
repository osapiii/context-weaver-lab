<template>
  <div>
    <div
      v-if="stories.length > 0"
      class="grid grid-cols-1 gap-3 lg:grid-cols-2 2xl:grid-cols-3"
    >
      <StoryVaultStoryCard
        v-for="story in stories"
        :key="story.id"
        :story="story"
        :evidence-count="evidenceCountByStory[story.id] ?? 0"
        :selected="story.id === selectedStoryId"
        @select="$emit('open-story', $event)"
      />
    </div>

    <div
      v-else
      class="flex min-h-48 flex-col items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50 text-center"
    >
      <UIcon
        name="material-symbols:article-outline"
        class="h-9 w-9 text-slate-300"
      />
      <p class="mt-3 text-sm font-semibold text-slate-700">
        ユーザーストーリーはまだありません
      </p>
      <p class="mt-1 text-xs text-slate-500">
        SSOT生成を実行すると、このアプリ配下のストーリーが表示されます。
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { DecodedStoryVaultStory } from "@models/storyVault";

defineProps<{
  stories: DecodedStoryVaultStory[];
  evidenceCountByStory: Record<string, number>;
  selectedStoryId: string;
}>();

defineEmits<{
  "open-story": [storyId: string];
}>();
</script>
