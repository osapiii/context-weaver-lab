<template>
  <article class="flex min-h-[36rem] min-w-0 flex-col rounded-lg border border-slate-200 bg-white">
    <div class="border-b border-slate-100 px-4 py-3">
      <template v-if="story">
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0">
            <div class="flex flex-wrap items-center gap-2">
              <span class="font-mono text-xs font-semibold text-slate-500">
                {{ story.applicationKey }} / {{ story.storyKey }}
              </span>
              <EnBadge
                :color="story.reviewState === 'needs_review' ? 'warning' : 'success'"
                size="xs"
              >
                {{ story.reviewState === "needs_review" ? "要レビュー" : "根拠充足" }}
              </EnBadge>
            </div>
            <p class="mt-2 text-sm leading-relaxed text-slate-600">
              {{ story.summary }}
            </p>
          </div>
          <div class="shrink-0 text-right">
            <p class="text-xl font-bold tabular-nums text-slate-900">
              {{ story.confidenceScore }}%
            </p>
            <p class="text-[11px] text-slate-500">confidence</p>
          </div>
        </div>
      </template>
      <template v-else>
        <p class="text-sm font-semibold text-slate-700">ストーリー未選択</p>
        <p class="mt-1 text-xs text-slate-500">左のボードから確認対象を選んでください。</p>
      </template>
    </div>

    <template v-if="story">
      <div class="min-h-0 flex-1 overflow-y-auto p-4">
        <div class="space-y-4">
          <section>
            <h3 class="text-xs font-semibold uppercase tracking-wide text-slate-500">
              User Story
            </h3>
            <p class="mt-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm leading-relaxed text-slate-700">
              {{ story.userStory }}
            </p>
          </section>
          <section>
            <h3 class="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Acceptance Criteria
            </h3>
            <div class="mt-2 space-y-2">
              <div
                v-for="ac in story.acceptanceCriteria"
                :key="ac.id"
                class="flex gap-2 rounded-lg border border-slate-200 p-3"
              >
                <UIcon
                  :name="acIcon(ac.state)"
                  :class="acIconClass(ac.state)"
                  class="mt-0.5 h-4 w-4 shrink-0"
                />
                <div class="min-w-0">
                  <p class="text-sm font-medium text-slate-800">
                    {{ ac.text }}
                  </p>
                  <p class="mt-1 text-[11px] text-slate-500">
                    {{ ac.id }} / {{ ac.state }} / evidence {{ ac.evidenceIds.length }}
                  </p>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </template>
  </article>
</template>

<script setup lang="ts">
import type { DecodedVibeControlStory } from "@models/vibeControl";

defineProps<{
  story: DecodedVibeControlStory | null;
}>();

function acIcon(state: string): string {
  if (state === "covered") return "material-symbols:check-circle-outline";
  if (state === "conflict") return "material-symbols:warning-outline";
  if (state === "missing") return "material-symbols:error-outline";
  return "material-symbols:help-outline";
}

function acIconClass(state: string): string {
  if (state === "covered") return "text-emerald-500";
  if (state === "conflict") return "text-amber-500";
  if (state === "missing") return "text-rose-500";
  return "text-slate-400";
}
</script>
