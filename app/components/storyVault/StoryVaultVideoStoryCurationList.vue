<template>
  <section :class="rootClass">
    <EnModal
      v-model:open="mcpTestChatOpen"
      :title="mcpTestTitle"
      subtitle="現在の一覧スコープをMCP JSONとして渡して会話します。"
      title-icon="material-symbols:terminal"
      size="xl"
      fullscreen
    >
      <StoryVaultMcpTestChat
        :application="null"
        :video="mcpTargetVideoGroup?.video ?? null"
        :context-json="mcpTestContextJson"
        :title="mcpTestTitle"
        :description="mcpTestDescription"
        :context-label="mcpTestContextLabel"
      />
    </EnModal>

    <EnModal
      v-model:open="evidencePreviewOpen"
      title="根拠クリップを再生"
      subtitle="発話根拠のタイムスタンプ周辺を字幕と一緒に確認します。"
      title-icon="material-symbols:play-circle-outline"
      size="xl"
    >
      <div v-if="selectedEvidencePreview" class="grid items-start gap-5 lg:grid-cols-[minmax(18rem,0.78fr)_minmax(0,1.62fr)]">
        <aside class="space-y-4 lg:sticky lg:top-0">
          <div class="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <div class="flex flex-wrap items-center gap-2">
              <span class="rounded-md bg-slate-950 px-2 py-1 font-mono text-xs font-bold text-white">
                {{ displayStoryKey(selectedEvidencePreview.story, selectedEvidencePreview.storyIndex) }}
              </span>
              <EnBadge color="neutral" variant="soft" size="xs">
                {{ selectedEvidencePreview.groupDisplayId }}
              </EnBadge>
              <EnBadge color="primary" variant="soft" size="xs">
                {{ formatEvidenceRange(selectedEvidencePreview.evidence.tRange) }}
              </EnBadge>
            </div>
            <h3 class="mt-3 text-lg font-bold leading-snug text-slate-950">
              {{ selectedEvidencePreview.story.title }}
            </h3>
            <p class="mt-2 text-sm leading-relaxed text-slate-500">
              {{ selectedEvidencePreview.evidence.summary || selectedEvidencePreview.evidence.title || displayVideoTitle(selectedEvidencePreview.video) }}
            </p>
            <button
              type="button"
              class="mt-4 inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 shadow-sm transition hover:border-primary-200 hover:bg-primary-50 hover:text-primary-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-300"
              @click="openStoryDetailFromEvidencePreview"
            >
              <UIcon name="material-symbols:open-in-new" class="h-4 w-4" />
              詳細を開く
            </button>
          </div>

          <div class="rounded-lg border border-slate-200 bg-white p-4">
            <div class="flex items-center justify-between gap-2">
              <h4 class="flex items-center gap-1.5 text-sm font-bold text-slate-950">
                <UIcon name="material-symbols:subtitles-outline" class="h-4 w-4 text-primary-600" />
                発話字幕
              </h4>
              <EnBadge variant="tag" size="xs">
                {{ selectedEvidenceTranscriptCues.length }}件
              </EnBadge>
            </div>
            <div class="mt-3 max-h-[28rem] space-y-2 overflow-y-auto pr-1">
              <button
                v-for="cue in selectedEvidenceTranscriptCues"
                :key="cue.id"
                type="button"
                class="grid w-full grid-cols-[4.5rem_minmax(0,1fr)] gap-2 rounded-md border border-teal-100 bg-teal-50/70 px-3 py-2 text-left transition hover:border-teal-200 hover:bg-teal-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-300"
                @click="seekEvidencePreviewCue(cue.startMs)"
              >
                <span class="font-mono text-xs font-bold tabular-nums text-teal-700">
                  {{ formatDuration(cue.startMs) }}
                </span>
                <span class="text-xs leading-relaxed text-slate-700">
                  {{ cue.text }}
                </span>
              </button>
              <div
                v-if="selectedEvidenceTranscriptCues.length === 0"
                class="rounded-md border border-slate-200 bg-slate-50 p-3 text-xs leading-relaxed text-slate-500"
              >
                {{ selectedEvidencePreview.evidence.transcriptQuote || "この根拠に紐づく字幕が見つかりませんでした。" }}
              </div>
            </div>
          </div>
        </aside>

        <div class="overflow-hidden rounded-lg border border-slate-200 bg-slate-950 shadow-sm">
          <video
            v-if="selectedEvidencePreviewUrl"
            :key="selectedEvidencePreviewVideoKey"
            ref="evidencePreviewVideo"
            :src="selectedEvidencePreviewUrl"
            controls
            preload="metadata"
            class="aspect-video w-full bg-slate-950"
            @loadedmetadata="seekEvidencePreviewVideo($event, selectedEvidencePreview.evidence)"
          />
          <div
            v-else
            class="flex aspect-video w-full items-center justify-center text-xs font-semibold text-slate-300"
          >
            クリップURLを取得中
          </div>
          <div class="flex flex-wrap items-center justify-between gap-2 bg-white px-3 py-2 text-xs font-bold text-slate-700">
            <span class="truncate">発話区間の周辺クリップ</span>
            <span class="shrink-0 font-mono text-slate-950">
              {{ formatEvidencePreviewRange(selectedEvidencePreview.evidence.tRange) }}
            </span>
          </div>
        </div>
      </div>
    </EnModal>

    <div :class="toolbarClass">
      <div class="flex min-w-0 flex-1 flex-col gap-3 xl:flex-row xl:items-center">
        <div class="flex min-w-0 items-center gap-2 xl:w-[18rem]">
          <span class="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary-50 text-primary-600">
            <UIcon name="material-symbols:account-tree-outline" class="h-4 w-4" />
          </span>
          <div class="min-w-0">
            <h2 class="truncate text-base font-bold text-slate-950">
              クリップ別ユーザーストーリー
            </h2>
            <p class="truncate text-xs font-medium text-slate-500">
              クリップごとに抽出されたストーリー候補を確認します
            </p>
          </div>
        </div>

        <label class="relative block min-w-0 flex-1 xl:max-w-[34rem]">
          <UIcon
            name="material-symbols:search"
            class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
          />
          <input
            v-model="query"
            type="search"
            class="h-9 w-full rounded-md border border-slate-200 bg-white pl-9 pr-3 text-sm font-medium text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-primary-300 focus:ring-2 focus:ring-primary-100"
            placeholder="クリップタイトル・概要・ストーリー候補で検索"
          >
        </label>
      </div>

      <div class="flex shrink-0 flex-wrap items-center gap-2">
        <div class="hidden items-center gap-1.5 text-xs lg:flex">
          <span class="rounded-md bg-slate-50 px-2.5 py-1 font-bold text-slate-500">
            クリップ <b class="ml-1 tabular-nums text-slate-950">{{ displayedVideoGroups.length }}</b>
          </span>
          <span class="rounded-md bg-slate-50 px-2.5 py-1 font-bold text-slate-500">
            ストーリー <b class="ml-1 tabular-nums text-slate-950">{{ visibleStoryCount }}</b>
          </span>
          <span class="rounded-md bg-slate-50 px-2.5 py-1 font-bold text-slate-500">
            解析済み <b class="ml-1 tabular-nums text-slate-950">{{ analyzedVideoCount }}</b>
          </span>
        </div>

        <div class="flex flex-wrap gap-1.5">
          <button
            v-for="option in statusOptions"
            :key="option.value"
            type="button"
            class="h-8 rounded-md px-2.5 text-xs font-bold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-300"
            :class="statusFilter === option.value ? 'bg-slate-950 text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'"
            @click="statusFilter = option.value"
          >
            {{ option.label }}
          </button>
        </div>

        <button
          type="button"
          class="flex h-8 items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 text-xs font-bold text-slate-600 shadow-sm transition hover:border-primary-200 hover:text-primary-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-300"
          @click="focusMode = !focusMode"
        >
          <UIcon
            :name="focusMode ? 'material-symbols:close-fullscreen' : 'material-symbols:open-in-full'"
            class="h-4 w-4"
          />
          {{ focusMode ? "戻る" : "集中表示" }}
        </button>
      </div>
    </div>

    <div
      v-if="videos.length === 0"
      class="flex min-h-56 flex-col items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-10 text-center"
    >
      <UIcon name="material-symbols:videocam-off-outline" class="h-10 w-10 text-slate-300" />
      <p class="mt-3 text-sm font-bold text-slate-800">
        クリップがまだありません
      </p>
      <p class="mt-1 max-w-md text-xs leading-relaxed text-slate-500">
        ザッピングでクリップを録画すると、クリップごとのストーリー候補をここで確認できます。
      </p>
    </div>

    <div
      v-else-if="filteredVideoGroups.length === 0"
      class="flex min-h-56 flex-col items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-10 text-center"
    >
      <UIcon name="material-symbols:filter-alt-off-outline" class="h-10 w-10 text-slate-300" />
      <p class="mt-3 text-sm font-bold text-slate-800">
        条件に一致するクリップがありません
      </p>
      <p class="mt-1 max-w-md text-xs leading-relaxed text-slate-500">
        検索語または解析ステータスを変更してください。
      </p>
    </div>

    <div
      v-else
      :class="contentGridClass"
    >
      <aside class="border-b border-slate-200 bg-slate-50 lg:border-b-0 lg:border-r">
        <div class="flex items-center justify-between gap-2 border-b border-slate-200 px-4 py-3">
          <div class="min-w-0">
            <p class="text-xs font-bold text-slate-500">クリップグループ</p>
            <p class="text-sm font-bold text-slate-900">クリップ</p>
          </div>
          <EnBadge variant="tag" size="xs">{{ filteredVideoGroups.length }}</EnBadge>
        </div>

        <div :class="epicListClass">
          <button
            type="button"
            class="mb-1 flex w-full items-center justify-between gap-2 rounded-md px-3 py-2 text-left text-sm font-bold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-300"
            :class="selectedVideoId === '' ? 'bg-primary-100 text-primary-900' : 'text-slate-600 hover:bg-white'"
            @click="selectedVideoId = ''"
          >
            <span>すべてのストーリー</span>
            <span class="rounded-full bg-white px-2 py-0.5 text-xs tabular-nums text-slate-600">
              {{ filteredStoryCount }}
            </span>
          </button>

          <button
            v-for="group in filteredVideoGroups"
            :key="group.video.id"
            type="button"
            class="group mb-1 grid w-full gap-2 rounded-md px-3 py-2 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-300"
            :class="selectedVideoId === group.video.id ? 'bg-white text-slate-950 shadow-sm ring-1 ring-primary-100' : 'text-slate-600 hover:bg-white'"
            @click="selectedVideoId = group.video.id"
          >
            <div class="flex min-w-0 items-center justify-between gap-2">
              <div class="flex min-w-0 items-center gap-2">
                <UIcon name="material-symbols:keyboard-arrow-right" class="h-4 w-4 shrink-0 text-slate-400" />
                <span class="truncate text-sm font-bold">
                  {{ displayVideoTitle(group.video) }}
                </span>
              </div>
              <span class="h-2.5 w-2.5 shrink-0 rounded-full" :class="statusDotClass(group.status.color)" />
            </div>
            <div class="ml-6 flex items-center justify-between gap-2">
              <span class="font-mono text-[11px] font-bold text-slate-400">
                {{ group.displayId }}
              </span>
              <span class="text-xs font-bold tabular-nums text-slate-500">
                {{ group.storyCount }}件
              </span>
            </div>
            <div class="ml-6 h-1 overflow-hidden rounded-full bg-slate-200">
              <div
                class="h-full rounded-full bg-primary-500"
                :style="{ width: `${Math.min(group.averageConfidence, 100)}%` }"
              />
            </div>
          </button>
        </div>
      </aside>

      <div class="min-w-0">
        <div class="flex flex-col gap-3 border-b border-slate-200 px-4 py-3 xl:flex-row xl:items-center xl:justify-between">
          <div class="min-w-0">
            <p class="text-xs font-semibold text-slate-500">
              {{ selectedVideoId ? "選択中のクリップ" : "すべてのストーリー候補" }}
            </p>
            <h3 class="mt-1 truncate text-lg font-bold text-slate-950">
              {{ selectedVideoTitle }}
            </h3>
          </div>
          <div class="flex flex-wrap items-center gap-2">
            <button
              type="button"
              class="inline-flex h-8 items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 text-xs font-bold text-slate-700 shadow-sm transition hover:border-primary-200 hover:bg-primary-50 hover:text-primary-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-300"
              @click="mcpTestChatOpen = true"
            >
              <UIcon name="material-symbols:terminal" class="h-4 w-4" />
              テスト会話
            </button>
            <button
              v-if="selectedVideoGroup"
              type="button"
              class="inline-flex h-8 items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 text-xs font-bold text-slate-700 shadow-sm transition hover:border-primary-200 hover:bg-primary-50 hover:text-primary-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-300"
              @click="openSelectedVideoDetail"
            >
              <UIcon name="material-symbols:open-in-new" class="h-4 w-4" />
              詳細を見る
            </button>
            <EnBadge variant="tag" size="xs">
              {{ visibleStoryCount }}件
            </EnBadge>
            <EnBadge color="success" variant="soft" size="xs">
              解析済み {{ displayedAnalyzedCount }}件
            </EnBadge>
          </div>
        </div>

        <div class="overflow-x-auto">
          <table class="min-w-[58rem] w-full border-collapse text-left text-sm">
            <thead class="bg-slate-50 text-[11px] font-bold tracking-normal text-slate-500">
              <tr>
                <th class="w-28 border-b border-slate-200 px-4 py-3">キー</th>
                <th class="border-b border-slate-200 px-4 py-3" colspan="4">ストーリーと価値</th>
              </tr>
            </thead>
            <tbody>
              <template
                v-for="group in displayedVideoGroups"
                :key="group.video.id"
              >
                <tr v-if="!selectedVideoId" class="bg-slate-50/80">
                  <td colspan="5" class="border-b border-slate-200 px-4 py-3">
                    <div class="flex flex-wrap items-center gap-2">
                      <span class="rounded-md border border-slate-200 bg-slate-950 px-2 py-0.5 font-mono text-xs font-bold text-white">
                        {{ group.displayId }}
                      </span>
                      <span class="min-w-0 truncate text-sm font-bold text-slate-900">
                        {{ displayVideoTitle(group.video) }}
                      </span>
                      <EnBadge :color="group.status.color" variant="soft" size="xs">
                        {{ group.status.label }}
                      </EnBadge>
                      <EnBadge variant="tag" size="xs">{{ group.storyCount }}件</EnBadge>
                      <span class="text-xs font-medium text-slate-400">
                        {{ formatRecordedAt(group.video.recordedAt) }}
                      </span>
                    </div>
                    <p
                      v-if="group.video.analysisErrorMessage"
                      class="mt-2 rounded-md bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700"
                    >
                      {{ group.video.analysisErrorMessage }}
                    </p>
                  </td>
                </tr>

                <tr v-if="!isVideoAnalyzed(group.video)">
                  <td colspan="5" class="border-b border-slate-100 px-3 py-8 text-center text-sm text-slate-500">
                    {{ emptyStatusMessage(group.video) }}
                  </td>
                </tr>
                <tr v-else-if="group.stories.length === 0">
                  <td colspan="5" class="border-b border-slate-100 px-3 py-8 text-center text-sm text-slate-500">
                    {{ group.storyCount === 0 ? "このクリップからストーリー候補は生成されませんでした。" : "検索条件に一致するストーリー候補がありません。" }}
                  </td>
                </tr>

                <template v-else>
                  <tr
                    v-for="(story, storyIndex) in group.stories"
                    :key="story.id"
                    class="cursor-pointer border-l-4 border-l-transparent bg-white align-top transition hover:border-l-slate-300 hover:bg-slate-50 focus:outline-none focus-visible:border-l-slate-500 focus-visible:bg-slate-50"
                    tabindex="0"
                    role="button"
                    @click="openStoryDetail(group, story, storyIndex)"
                    @keydown.enter.prevent="openStoryDetail(group, story, storyIndex)"
                    @keydown.space.prevent="openStoryDetail(group, story, storyIndex)"
                  >
                    <td class="border-b border-slate-200 px-4 py-5">
                      <div class="flex flex-col gap-1">
                        <span class="font-mono text-xs font-bold text-slate-700">
                          {{ displayStoryKey(story, storyIndex) }}
                        </span>
                        <span class="text-[11px] font-semibold text-slate-400">
                          #{{ storyIndex + 1 }}
                        </span>
                      </div>
                    </td>
                    <td class="border-b border-slate-200 px-4 py-5" colspan="4">
                      <div class="grid gap-4 xl:grid-cols-[minmax(0,7fr)_minmax(15rem,3fr)]">
                        <div class="space-y-3">
                          <div class="flex min-w-0 items-start gap-3">
                            <span class="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100">
                              <UIcon name="material-symbols:bookmark-outline" class="h-4 w-4" />
                            </span>
                            <div class="min-w-0">
                              <p class="line-clamp-1 text-xl font-bold leading-snug text-slate-950">
                                {{ story.title }}
                              </p>
                              <div
                                v-if="story.acceptanceCriteria.length > 0"
                                class="mt-2 flex min-w-0 items-center gap-2"
                              >
                                <EnBadge color="neutral" variant="soft" size="xs">
                                  完了条件
                                </EnBadge>
                                <p class="line-clamp-1 min-w-0 text-sm leading-relaxed text-slate-500">
                                  {{ story.acceptanceCriteria[0] }}
                                </p>
                              </div>
                            </div>
                          </div>
                          <StoryVaultStoryValueCards
                            :story="story"
                            :video="group.video"
                            compact
                          />
                        </div>
                        <button
                          type="button"
                          class="group/preview flex h-full min-h-[8.25rem] flex-col overflow-hidden rounded-lg border border-slate-200 bg-slate-50 text-left shadow-sm transition hover:border-primary-200 hover:bg-white hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-300"
                          @click.stop="openEvidencePreview(group, story, storyIndex)"
                          @keydown.enter.stop
                          @keydown.space.stop
                        >
                          <div class="relative aspect-video w-full overflow-hidden bg-slate-950">
                            <img
                              v-if="storyThumbnailUrl(group.video, story)"
                              :src="storyThumbnailUrl(group.video, story)"
                              :alt="`${story.title} の根拠クリップサムネイル`"
                              class="h-full w-full object-cover transition duration-200 group-hover/preview:scale-[1.02]"
                            >
                            <video
                              v-else-if="operationVideoUrl(group.video)"
                              :key="`${group.video.id}-${story.id}-preview-video`"
                              :src="operationVideoUrl(group.video)"
                              muted
                              playsinline
                              preload="metadata"
                              class="h-full w-full object-cover transition duration-200 group-hover/preview:scale-[1.02]"
                              @loadedmetadata="seekStoryPreviewVideo($event, story)"
                            />
                            <div
                              v-else
                              class="flex h-full w-full items-center justify-center text-slate-500"
                            >
                              <UIcon name="material-symbols:image-not-supported-outline" class="h-8 w-8" />
                            </div>
                            <span class="absolute inset-0 flex items-center justify-center bg-slate-950/20 transition group-hover/preview:bg-slate-950/10">
                              <span class="flex h-10 w-10 items-center justify-center rounded-full bg-white/95 text-slate-950 shadow-lg">
                                <UIcon name="material-symbols:play-arrow-rounded" class="h-6 w-6" />
                              </span>
                            </span>
                          </div>
                          <div class="flex w-full items-center justify-between gap-2 px-3 py-2">
                            <span class="line-clamp-1 text-xs font-bold text-slate-700">
                              {{ primaryEvidence(story)?.title || "根拠クリップ" }}
                            </span>
                            <span class="shrink-0 rounded-md bg-white px-2 py-1 font-mono text-[11px] font-bold tabular-nums text-slate-700 ring-1 ring-slate-200">
                              {{ formatEvidenceRange(primaryEvidence(story)?.tRange ?? [0, 0]) }}
                            </span>
                          </div>
                        </button>
                      </div>
                    </td>
                  </tr>
                </template>
              </template>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <USlideover
      v-model:open="storyDetailOpen"
      side="right"
      :ui="{ content: 'w-full sm:max-w-[960px]' }"
    >
      <template #content>
        <div v-if="selectedStoryDetail" class="flex h-full flex-col bg-white">
          <div class="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-5">
            <div class="min-w-0">
              <div class="flex flex-wrap items-center gap-2">
                <span class="rounded-md bg-slate-950 px-2 py-1 font-mono text-xs font-bold text-white">
                  {{ displayStoryKey(selectedStoryDetail.story, selectedStoryDetail.storyIndex) }}
                </span>
                <EnBadge color="neutral" variant="soft" size="xs">
                  {{ selectedStoryDetail.groupDisplayId }}
                </EnBadge>
                <EnBadge
                  :color="selectedStoryDetail.story.unverified ? 'warning' : 'success'"
                  variant="soft"
                  size="xs"
                >
                  {{ selectedStoryDetail.story.unverified ? "未検証" : "解析済み" }}
                </EnBadge>
              </div>
              <h3 class="mt-3 text-xl font-bold leading-snug text-slate-950">
                {{ selectedStoryDetail.story.title }}
              </h3>
              <p class="mt-2 line-clamp-2 text-sm leading-relaxed text-slate-500">
                {{ displayVideoTitle(selectedStoryDetail.video) }}
              </p>
            </div>
            <button
              type="button"
              class="rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-bold text-slate-700 shadow-sm transition hover:border-primary-200 hover:bg-primary-50 hover:text-primary-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-300"
              @click="mcpTestChatOpen = true"
            >
              テスト会話
            </button>
            <button
              type="button"
              class="rounded-md p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-300"
              aria-label="詳細を閉じる"
              @click="storyDetailOpen = false"
            >
              <UIcon name="material-symbols:close-rounded" class="h-5 w-5" />
            </button>
          </div>

          <div class="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-5">
            <div class="grid grid-cols-3 gap-2">
              <div class="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <p class="text-[11px] font-bold text-slate-500">信頼度</p>
                <p class="mt-1 text-lg font-bold tabular-nums text-slate-950">
                  {{ storyConfidence(selectedStoryDetail.story) }}%
                </p>
              </div>
              <div class="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <p class="text-[11px] font-bold text-slate-500">根拠</p>
                <p class="mt-1 text-lg font-bold tabular-nums text-slate-950">
                  {{ selectedStoryDetail.story.evidence.length }}件
                </p>
              </div>
              <div class="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <p class="text-[11px] font-bold text-slate-500">録画日時</p>
                <p class="mt-1 truncate text-sm font-bold text-slate-950">
                  {{ formatRecordedAt(selectedStoryDetail.video.recordedAt) }}
                </p>
              </div>
            </div>

            <figure
              v-if="selectedStoryThumbnailUrl"
              class="overflow-hidden rounded-lg border border-slate-200 bg-slate-100"
            >
              <img
                :src="selectedStoryThumbnailUrl"
                class="aspect-video w-full object-cover"
                :alt="`${selectedStoryDetail.story.title} の代表キャプチャ`"
              >
              <figcaption class="flex items-center justify-between gap-2 bg-white px-3 py-2 text-xs font-bold text-slate-700">
                <span class="truncate">
                  {{ selectedStoryPrimaryEvidence?.title || selectedStoryPrimaryEvidence?.summary || "代表キャプチャ" }}
                </span>
                <span class="shrink-0 font-mono text-slate-950">
                  {{ formatEvidenceRange(selectedStoryPrimaryEvidence?.tRange ?? [0, 0]) }}
                </span>
              </figcaption>
            </figure>

            <StoryVaultStoryValueCards
              :story="selectedStoryDetail.story"
              :video="selectedStoryDetail.video"
            />

            <section
              v-if="selectedStoryDetail.story.acceptanceCriteria.length > 0"
              class="rounded-lg border border-slate-200 bg-white p-4"
            >
              <h4 class="text-sm font-bold text-slate-950">受け入れ条件</h4>
              <ol class="mt-3 space-y-2">
                <li
                  v-for="(criterion, criterionIndex) in selectedStoryDetail.story.acceptanceCriteria"
                  :key="`${selectedStoryDetail.story.id}-criterion-${criterionIndex}`"
                  class="flex gap-2 text-sm leading-relaxed text-slate-600"
                >
                  <span class="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[11px] font-bold text-slate-700">
                    {{ criterionIndex + 1 }}
                  </span>
                  <span>{{ criterion }}</span>
                </li>
              </ol>
            </section>

            <section class="rounded-lg border border-slate-200 bg-white p-4">
              <div class="flex items-center justify-between gap-2">
                <h4 class="text-sm font-bold text-slate-950">クリップ上の根拠</h4>
                <EnBadge variant="tag" size="xs">
                  {{ selectedStoryDetail.story.evidence.length }}件
                </EnBadge>
              </div>
              <div class="mt-3 space-y-3">
                <div
                  v-for="(evidence, evidenceIndex) in selectedStoryDetail.story.evidence"
                  :key="`${selectedStoryDetail.story.id}-evidence-${evidenceIndex}`"
                  class="rounded-md border border-slate-200 bg-slate-50 p-3"
                >
                  <div class="flex items-start justify-between gap-3">
                    <div class="min-w-0">
                      <p class="text-sm font-bold text-slate-950">
                        {{ evidence.title || `根拠 ${evidenceIndex + 1}` }}
                      </p>
                      <p
                        v-if="evidence.summary"
                        class="mt-1 text-xs leading-relaxed text-slate-500"
                      >
                        {{ evidence.summary }}
                      </p>
                    </div>
                    <span class="shrink-0 font-mono text-xs font-bold text-slate-950">
                      {{ formatEvidenceRange(evidence.tRange) }}
                    </span>
                  </div>
                  <div
                    v-if="evidence.transcriptQuote || evidence.transcriptCueIds.length > 0"
                    class="mt-3 rounded-md border border-teal-100 bg-teal-50/80 p-3"
                  >
                    <p class="flex flex-wrap items-center gap-2 text-[11px] font-bold text-teal-900">
                      <UIcon name="material-symbols:subtitles-outline" class="h-4 w-4" />
                      発話根拠
                    </p>
                    <p
                      v-if="evidence.transcriptQuote"
                      class="mt-2 text-xs leading-relaxed text-slate-700"
                    >
                      {{ evidence.transcriptQuote }}
                    </p>
                    <p
                      v-if="evidence.transcriptCueIds.length > 0"
                      class="mt-2 font-mono text-[11px] text-teal-700"
                    >
                      {{ evidence.transcriptCueIds.join(", ") }}
                    </p>
                  </div>
                  <div
                    v-if="evidenceCaptureFrames(selectedStoryDetail.video, evidence).length > 0"
                    class="mt-3 rounded-md border border-slate-200 bg-white p-3"
                  >
                    <div class="flex items-center justify-between gap-2">
                      <p class="flex items-center gap-1.5 text-[11px] font-bold text-slate-700">
                        <UIcon name="material-symbols:image-search-outline" class="h-4 w-4 text-slate-500" />
                        関連スクリーンキャプチャ
                      </p>
                      <EnBadge variant="tag" size="xs">
                        {{ evidenceCaptureFrames(selectedStoryDetail.video, evidence).length }}件
                      </EnBadge>
                    </div>
                    <div class="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
                      <figure
                        v-for="frame in evidenceCaptureFrames(selectedStoryDetail.video, evidence)"
                        :key="`${selectedStoryDetail.video.id}-${evidenceIndex}-${frame.id}`"
                        class="overflow-hidden rounded-md border border-slate-200 bg-slate-100"
                      >
                        <img
                          v-if="savedFrameUrl(selectedStoryDetail.video, frame.id)"
                          :src="savedFrameUrl(selectedStoryDetail.video, frame.id)"
                          :alt="`${evidence.title || `根拠 ${evidenceIndex + 1}`} の関連キャプチャ ${formatDuration(frame.timestampMs)}`"
                          class="aspect-video w-full object-cover"
                        >
                        <div
                          v-else
                          class="flex aspect-video w-full items-center justify-center text-slate-300"
                        >
                          <UIcon name="material-symbols:image-outline" class="h-5 w-5" />
                        </div>
                        <figcaption class="flex items-center justify-between gap-2 bg-white px-2 py-1 text-[11px] font-bold text-slate-600">
                          <span class="font-mono tabular-nums text-slate-950">
                            {{ formatDuration(frame.timestampMs) }}
                          </span>
                          <span
                            v-if="frame.id === evidence.representativeScreenshotId"
                            class="rounded bg-primary-50 px-1.5 py-0.5 text-primary-700"
                          >
                            代表
                          </span>
                        </figcaption>
                      </figure>
                    </div>
                  </div>
                  <div class="mt-3 overflow-hidden rounded-lg border border-slate-200 bg-slate-950">
                    <video
                      v-if="operationVideoUrl(selectedStoryDetail.video)"
                      :key="`${selectedStoryDetail.video.id}-${selectedStoryDetail.story.id}-${evidenceIndex}`"
                      :src="operationVideoUrl(selectedStoryDetail.video)"
                      controls
                      preload="metadata"
                      class="aspect-video w-full bg-slate-950"
                      @loadedmetadata="seekEvidencePreviewVideo($event, evidence)"
                    />
                    <div
                      v-else
                      class="flex aspect-video w-full items-center justify-center text-xs font-semibold text-slate-300"
                    >
                      クリップURLを取得中
                    </div>
                    <div class="flex items-center justify-between gap-2 bg-white px-3 py-2 text-xs font-bold text-slate-700">
                      <span class="truncate">発話区間の周辺クリップ</span>
                      <span class="shrink-0 font-mono text-slate-950">
                        {{ formatEvidencePreviewRange(evidence.tRange) }}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </section>
          </div>
        </div>
      </template>
    </USlideover>
  </section>
</template>

<script setup lang="ts">
import { getDownloadURL } from "firebase/storage";
import { storageRefForBucketPath } from "@composables/firebase-storage-operations";
import type {
  DecodedStoryVaultClip,
  StoryVaultTranscriptCue,
  StoryVaultZappingAnalysisStatus,
  StoryVaultZappingAnalysisStoryCandidate,
} from "@models/storyVault";

type StatusFilter = StoryVaultZappingAnalysisStatus | "all";
type BadgeColor = "neutral" | "primary" | "info" | "success" | "warning" | "error";

type VideoGroup = {
  video: DecodedStoryVaultClip;
  displayId: string;
  status: {
    label: string;
    color: BadgeColor;
  };
  stories: StoryVaultZappingAnalysisStoryCandidate[];
  storyCount: number;
  evidenceCount: number;
  averageConfidence: number;
};

type StoryDetailSelection = {
  video: DecodedStoryVaultClip;
  groupDisplayId: string;
  story: StoryVaultZappingAnalysisStoryCandidate;
  storyIndex: number;
};

type EvidencePreviewSelection = StoryDetailSelection & {
  evidence: StoryVaultZappingAnalysisStoryCandidate["evidence"][number];
};

const props = defineProps<{
  applicationId?: string;
  videos: DecodedStoryVaultClip[];
}>();

const route = useRoute();
const router = useRouter();
const query = ref("");
const statusFilter = ref<StatusFilter>("all");
const selectedVideoId = ref("");
const focusMode = ref(false);
const storyDetailOpen = ref(false);
const mcpTestChatOpen = ref(false);
const selectedStoryDetail = ref<StoryDetailSelection | null>(null);
const evidencePreviewOpen = ref(false);
const selectedEvidencePreview = ref<EvidencePreviewSelection | null>(null);
const evidencePreviewVideo = ref<HTMLVideoElement | null>(null);
const frameUrls = reactive<Record<string, string>>({});
const videoUrls = reactive<Record<string, string>>({});

const statusOptions: Array<{ label: string; value: StatusFilter }> = [
  { label: "すべて", value: "all" },
  { label: "未解析", value: "not_analyzed" },
  { label: "解析中", value: "running" },
  { label: "解析済み", value: "completed" },
  { label: "エラー", value: "error" },
];

const rootClass = computed(() =>
  focusMode.value
    ? "fixed inset-0 z-[70] min-w-0 space-y-3 overflow-auto bg-slate-50 p-3"
    : "min-w-0 space-y-3"
);

const toolbarClass = computed(() =>
  [
    "flex flex-col gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2.5 shadow-sm xl:flex-row xl:items-center xl:justify-between",
    focusMode.value ? "sticky top-0 z-10" : "",
  ].filter(Boolean).join(" ")
);

const contentGridClass = computed(() =>
  [
    "grid min-w-0 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm lg:grid-cols-[18rem_minmax(0,1fr)]",
    focusMode.value ? "min-h-[calc(100vh-5.25rem)]" : "",
  ].filter(Boolean).join(" ")
);

const epicListClass = computed(() =>
  [
    "overflow-y-auto p-2",
    focusMode.value ? "max-h-[calc(100vh-9rem)]" : "max-h-[34rem]",
  ].join(" ")
);

const filteredVideoGroups = computed<VideoGroup[]>(() => {
  const normalizedQuery = query.value.trim().toLowerCase();

  return props.videos
    .map((video, index) => buildVideoGroup(video, index, normalizedQuery))
    .filter((group) => {
      if (statusFilter.value !== "all") {
        const status = normalizedAnalysisStatus(group.video);
        if (statusFilter.value === "running") {
          if (status !== "queued" && status !== "running") return false;
        } else if (status !== statusFilter.value) {
          return false;
        }
      }

      if (!normalizedQuery) return true;
      return videoMatchesQuery(group.video, normalizedQuery) || group.stories.length > 0;
    });
});

const displayedVideoGroups = computed(() => {
  if (!selectedVideoId.value) return filteredVideoGroups.value;
  return filteredVideoGroups.value.filter(
    (group) => group.video.id === selectedVideoId.value
  );
});

const filteredStoryCount = computed(() =>
  filteredVideoGroups.value.reduce((sum, group) => sum + group.stories.length, 0)
);

const visibleStoryCount = computed(() =>
  displayedVideoGroups.value.reduce((sum, group) => sum + group.stories.length, 0)
);

const analyzedVideoCount = computed(
  () => props.videos.filter((video) => isVideoAnalyzed(video)).length
);

const displayedAnalyzedCount = computed(
  () => displayedVideoGroups.value.filter((group) => isVideoAnalyzed(group.video)).length
);

const selectedVideoGroup = computed(() => {
  if (!selectedVideoId.value) return null;
  return filteredVideoGroups.value.find(
    (item) => item.video.id === selectedVideoId.value
  ) ?? null;
});

const selectedVideoTitle = computed(() => {
  if (!selectedVideoId.value) return "すべてのストーリー候補";
  const group = selectedVideoGroup.value;
  return group ? displayVideoTitle(group.video) : "すべてのストーリー候補";
});

const mcpTargetVideoGroup = computed(() => {
  const storyVideoId = storyDetailOpen.value
    ? selectedStoryDetail.value?.video.id
    : "";
  if (storyVideoId) {
    return (
      filteredVideoGroups.value.find((group) => group.video.id === storyVideoId) ??
      buildVideoGroup(selectedStoryDetail.value!.video, props.videos.findIndex((video) => video.id === storyVideoId), "")
    );
  }
  return selectedVideoGroup.value;
});

const mcpTargetGroups = computed(() =>
  mcpTargetVideoGroup.value ? [mcpTargetVideoGroup.value] : displayedVideoGroups.value
);

const mcpTestTitle = computed(() =>
  mcpTargetVideoGroup.value
    ? `${displayVideoTitle(mcpTargetVideoGroup.value.video)} のテスト会話`
    : "すべてのストーリー候補のテスト会話"
);

const mcpTestDescription = computed(() =>
  mcpTargetVideoGroup.value
    ? "選択中のクリップに紐づくストーリー候補と関連コンテキストだけをJSONで渡して会話します"
    : "一覧に表示されている全ストーリー候補と、それぞれに紐づくクリップのJSONを渡して会話します"
);

const mcpTestContextLabel = computed(() =>
  mcpTargetVideoGroup.value
    ? mcpTargetVideoGroup.value.video.id
    : `all-story-candidates:${mcpTargetGroups.value.length}-videos`
);

const mcpTestContextJson = computed(() => {
  const groups = mcpTargetGroups.value;
  const payload = {
    schemaVersion: "storyvault-story-candidates-context-v1",
    tool: mcpTargetVideoGroup.value
      ? "get_operation_video_context"
      : "list_operation_video_story_candidates",
    scope: mcpTargetVideoGroup.value ? "selected_operation_video" : "all_story_candidates",
    application: {
      id: props.applicationId || "",
    },
    counts: {
      clips: groups.length,
      storyCandidates: groups.reduce((sum, group) => sum + group.storyCount, 0),
      visibleStoryCandidates: groups.reduce((sum, group) => sum + group.stories.length, 0),
      analyzedVideos: groups.filter((group) => isVideoAnalyzed(group.video)).length,
    },
    clips: groups.map((group) => buildMcpVideoContext(group)),
  };
  return JSON.stringify(payload, null, 2);
});

const selectedStoryPrimaryEvidence = computed(() => {
  const detail = selectedStoryDetail.value;
  return detail ? primaryEvidence(detail.story) : undefined;
});

const selectedStoryThumbnailUrl = computed(() => {
  const detail = selectedStoryDetail.value;
  return detail ? storyThumbnailUrl(detail.video, detail.story) : "";
});

const selectedEvidencePreviewUrl = computed(() => {
  const detail = selectedEvidencePreview.value;
  return detail ? operationVideoUrl(detail.video) : "";
});

const selectedEvidencePreviewVideoKey = computed(() => {
  const detail = selectedEvidencePreview.value;
  if (!detail) return "evidence-preview-empty";
  const rangeKey = detail.evidence.tRange.join("-");
  return `${detail.video.id}-${detail.story.id}-${rangeKey}`;
});

const selectedEvidenceTranscriptCues = computed<StoryVaultTranscriptCue[]>(() => {
  const detail = selectedEvidencePreview.value;
  return detail ? evidenceTranscriptCues(detail.video, detail.evidence) : [];
});

watch(filteredVideoGroups, (groups) => {
  if (!selectedVideoId.value) return;
  if (groups.some((group) => group.video.id === selectedVideoId.value)) return;
  selectedVideoId.value = "";
});

watch(
  () => props.videos,
  (videos) => {
    void resolveFrameUrls(videos);
    void resolveVideoUrls(videos);
  },
  { immediate: true, deep: true }
);

onMounted(() => {
  window.addEventListener("keydown", handleKeydown);
});

onBeforeUnmount(() => {
  window.removeEventListener("keydown", handleKeydown);
});

function handleKeydown(event: KeyboardEvent): void {
  if (event.key !== "Escape") return;
  if (evidencePreviewOpen.value) {
    evidencePreviewOpen.value = false;
    return;
  }
  if (storyDetailOpen.value) {
    storyDetailOpen.value = false;
    return;
  }
  focusMode.value = false;
}

function openStoryDetail(
  group: VideoGroup,
  story: StoryVaultZappingAnalysisStoryCandidate,
  storyIndex: number
): void {
  selectedStoryDetail.value = {
    video: group.video,
    groupDisplayId: group.displayId,
    story,
    storyIndex,
  };
  storyDetailOpen.value = true;
}

function openEvidencePreview(
  group: VideoGroup,
  story: StoryVaultZappingAnalysisStoryCandidate,
  storyIndex: number
): void {
  const evidence = primaryEvidence(story);
  if (!evidence) return;
  selectedEvidencePreview.value = {
    video: group.video,
    groupDisplayId: group.displayId,
    story,
    storyIndex,
    evidence,
  };
  evidencePreviewOpen.value = true;
}

function openStoryDetailFromEvidencePreview(): void {
  const detail = selectedEvidencePreview.value;
  if (!detail) return;
  selectedStoryDetail.value = {
    video: detail.video,
    groupDisplayId: detail.groupDisplayId,
    story: detail.story,
    storyIndex: detail.storyIndex,
  };
  evidencePreviewOpen.value = false;
  storyDetailOpen.value = true;
}

function openSelectedVideoDetail(): void {
  const group = selectedVideoGroup.value;
  if (!group) return;
  const href = router.resolve({
    path: route.path,
    query: {
      ...route.query,
      view: "application-zapping",
      applicationId: props.applicationId || route.query.applicationId,
      operationVideoId: group.video.id,
      operationVideoTab: "storyAnalysis",
      action: undefined,
    },
  }).href;
  window.open(href, "_blank", "noopener,noreferrer");
}

function buildVideoGroup(
  video: DecodedStoryVaultClip,
  index: number,
  normalizedQuery: string
): VideoGroup {
  const stories = video.analysisResult?.storyCandidates ?? [];
  const videoHit = normalizedQuery
    ? videoMatchesQuery(video, normalizedQuery)
    : true;
  const visibleStories =
    normalizedQuery && !videoHit
      ? stories.filter((story) => storyMatchesQuery(story, normalizedQuery))
      : stories;
  const confidenceValues = visibleStories.map(storyConfidence);
  return {
    video,
    displayId: `VID${index + 1}`,
    status: statusMeta(video),
    stories: visibleStories,
    storyCount: stories.length,
    evidenceCount: visibleStories.reduce(
      (sum, story) => sum + story.evidence.length,
      0
    ),
    averageConfidence:
      confidenceValues.length === 0
        ? 0
        : Math.round(
            confidenceValues.reduce((sum, value) => sum + value, 0) /
              confidenceValues.length
          ),
  };
}

function buildMcpVideoContext(group: VideoGroup): Record<string, unknown> {
  const video = group.video;
  const stories = video.analysisResult?.storyCandidates ?? [];
  return {
    id: video.id,
    displayId: group.displayId,
    title: displayVideoTitle(video),
    description: displayVideoDescription(video),
    clipGroup: {
      id: video.clipGroupId || "",
      name: video.clipGroupNameSnapshot || "クリップグループ未設定",
      description: "",
    },
    recordedAt: video.recordedAt,
    durationMs: video.durationMs,
    storagePath: video.storagePath,
    analysisStatus: normalizedAnalysisStatus(video),
    analyzedAt: video.analyzedAt,
    operationIntent: video.analysisResult?.operationIntent || "",
    productContextSummary: video.analysisResult?.productContextSummary || "",
    transcriptSummary:
      video.analysisResult?.transcriptSummary ||
      video.transcriptSummary ||
      video.quickScan?.transcriptSummary ||
      "",
    quickScan: video.quickScan ?? null,
    counts: {
      storyCandidates: stories.length,
      visibleStoryCandidates: group.stories.length,
      evidence: stories.reduce((sum, story) => sum + story.evidence.length, 0),
      screenshots: video.frameCaptures.length,
      githubPullRequests: video.relatedContexts?.github?.pullRequests.length ?? 0,
      slackMessages: video.relatedContexts?.slack?.messages.length ?? 0,
      knowledgeDocuments: video.relatedContexts?.knowledge?.documents.length ?? 0,
    },
    storyCandidates: group.stories.map((story) => ({
      id: story.id,
      key: story.storyKey || "",
      title: story.title,
      role: story.role ?? null,
      goal: story.goal || story.iWant || "",
      benefit: story.benefit || story.soThat || "",
      userStory: story.userStory || "",
      confidence: story.confidence ?? story.confidenceScore ?? null,
      acceptanceCriteria: story.acceptanceCriteria,
      evidence: story.evidence.map((item, evidenceIndex) => ({
        id: `${story.id}-evidence-${evidenceIndex + 1}`,
        title: item.title,
        summary: item.summary,
        videoId: item.videoId,
        tRange: item.tRange,
        representativeScreenshotId: item.representativeScreenshotId,
        screenshotIds: item.screenshotIds ?? [],
        transcriptCueIds: item.transcriptCueIds ?? [],
        transcriptQuote: item.transcriptQuote,
      })),
    })),
    screenshots: video.frameCaptures.slice(0, 30).map((frame) => ({
      id: frame.id,
      timestampMs: frame.timestampMs,
      width: frame.width,
      height: frame.height,
      storagePath: frame.storagePath,
      url: savedFrameUrl(video, frame.id),
    })),
    relatedContexts: {
      knowledgeDocuments: video.relatedContexts?.knowledge?.documents ?? [],
      githubPullRequests: video.relatedContexts?.github?.pullRequests ?? [],
      slackMessages: video.relatedContexts?.slack?.messages ?? [],
    },
  };
}

function normalizedAnalysisStatus(
  video: DecodedStoryVaultClip
): StoryVaultZappingAnalysisStatus {
  if (video.analysisStatus === "completed" || video.analysisResult) {
    return "completed";
  }
  return video.analysisStatus;
}

function isVideoAnalyzed(video: DecodedStoryVaultClip): boolean {
  return normalizedAnalysisStatus(video) === "completed";
}

function statusMeta(video: DecodedStoryVaultClip): {
  label: string;
  color: BadgeColor;
} {
  const status = normalizedAnalysisStatus(video);
  if (status === "completed") return { label: "解析済み", color: "success" };
  if (status === "queued") return { label: "待機中", color: "info" };
  if (status === "running") return { label: "解析中", color: "warning" };
  if (status === "error") return { label: "エラー", color: "error" };
  return { label: "未解析", color: "neutral" };
}

function emptyStatusMessage(video: DecodedStoryVaultClip): string {
  const status = normalizedAnalysisStatus(video);
  if (status === "queued") return "解析リクエストは待機中です。";
  if (status === "running") return "クリップとナレッジを照合して解析しています。";
  if (status === "error") return "解析に失敗しました。";
  return "このクリップはまだ解析されていません。";
}

function displayVideoTitle(video: DecodedStoryVaultClip): string {
  return video.quickScan?.title?.trim() || video.title;
}

function displayVideoDescription(video: DecodedStoryVaultClip): string {
  return video.quickScan?.description?.trim() || video.description || "";
}

function displayStoryKey(
  story: StoryVaultZappingAnalysisStoryCandidate,
  index: number
): string {
  return story.storyKey?.trim() || `US-${String(index + 1).padStart(3, "0")}`;
}

function storyConfidence(
  story: StoryVaultZappingAnalysisStoryCandidate
): number {
  return Math.round(story.confidence ?? story.confidenceScore ?? 0);
}

function confidenceTextClass(confidence: number): string {
  if (confidence >= 85) return "text-emerald-700";
  if (confidence >= 70) return "text-sky-700";
  if (confidence >= 50) return "text-amber-700";
  return "text-rose-700";
}

function confidenceBarClass(confidence: number): string {
  if (confidence >= 85) return "bg-emerald-500";
  if (confidence >= 70) return "bg-sky-500";
  if (confidence >= 50) return "bg-amber-500";
  return "bg-rose-500";
}

function statusDotClass(color: BadgeColor): string {
  if (color === "success") return "bg-emerald-500";
  if (color === "info") return "bg-sky-500";
  if (color === "warning") return "bg-amber-500";
  if (color === "error") return "bg-rose-500";
  if (color === "primary") return "bg-primary-500";
  return "bg-slate-300";
}

function primaryEvidence(
  story: StoryVaultZappingAnalysisStoryCandidate
): StoryVaultZappingAnalysisStoryCandidate["evidence"][number] | undefined {
  return story.evidence[0];
}

function frameKey(videoId: string, frameId: string): string {
  return `${videoId}:${frameId}`;
}

function savedFrameUrl(
  video: DecodedStoryVaultClip,
  frameId?: string
): string {
  if (!frameId) return "";
  return frameUrls[frameKey(video.id, frameId)] ?? "";
}

function operationVideoUrl(video: DecodedStoryVaultClip): string {
  return videoUrls[video.id] ?? "";
}

function storyThumbnailFrame(
  video: DecodedStoryVaultClip,
  story: StoryVaultZappingAnalysisStoryCandidate
): DecodedStoryVaultClip["frameCaptures"][number] | undefined {
  const evidence = primaryEvidence(story);
  if (!evidence) return undefined;
  return storyEvidenceFrames(video, evidence)[0];
}

function storyThumbnailUrl(
  video: DecodedStoryVaultClip,
  story: StoryVaultZappingAnalysisStoryCandidate
): string {
  return savedFrameUrl(video, storyThumbnailFrame(video, story)?.id);
}

function storyEvidenceFrames(
  video: DecodedStoryVaultClip,
  evidence: StoryVaultZappingAnalysisStoryCandidate["evidence"][number]
): DecodedStoryVaultClip["frameCaptures"] {
  const evidenceIds = new Set(
    [
      evidence.representativeScreenshotId,
      ...evidence.screenshotIds,
    ].filter(Boolean)
  );
  const byId = video.frameCaptures.filter((frame) => evidenceIds.has(frame.id));
  if (byId.length > 0) {
    return byId.sort((a, b) => {
      const aRepresentative = a.id === evidence.representativeScreenshotId ? 0 : 1;
      const bRepresentative = b.id === evidence.representativeScreenshotId ? 0 : 1;
      return aRepresentative - bRepresentative || a.timestampMs - b.timestampMs;
    });
  }

  const startMs = Math.max(0, (evidence.tRange[0] ?? 0) * 1000);
  const endMs = Math.max(startMs, (evidence.tRange[1] ?? evidence.tRange[0] ?? 0) * 1000);
  const withinRange = video.frameCaptures.filter(
    (frame) => frame.timestampMs >= startMs && frame.timestampMs <= endMs
  );
  return withinRange.length > 0 ? withinRange : nearestFrames(video, startMs, 3);
}

function evidenceCaptureFrames(
  video: DecodedStoryVaultClip,
  evidence: StoryVaultZappingAnalysisStoryCandidate["evidence"][number]
): DecodedStoryVaultClip["frameCaptures"] {
  return storyEvidenceFrames(video, evidence).slice(0, 6);
}

function nearestFrames(
  video: DecodedStoryVaultClip,
  timestampMs: number,
  maxCount: number
): DecodedStoryVaultClip["frameCaptures"] {
  return [...video.frameCaptures]
    .sort(
      (a, b) =>
        Math.abs(a.timestampMs - timestampMs) - Math.abs(b.timestampMs - timestampMs)
    )
    .slice(0, maxCount)
    .sort((a, b) => a.timestampMs - b.timestampMs);
}

async function resolveFrameUrls(
  videos: DecodedStoryVaultClip[]
): Promise<void> {
  await Promise.all(
    videos.flatMap((video) =>
      video.frameCaptures.map(async (frame) => {
        if (!frame.storagePath || !frame.bucketName) return;
        const key = frameKey(video.id, frame.id);
        if (frameUrls[key] !== undefined) return;
        try {
          const storageRef = storageRefForBucketPath({
            bucketName: frame.bucketName,
            filePath: frame.storagePath,
          });
          frameUrls[key] = await getDownloadURL(storageRef);
        } catch {
          frameUrls[key] = "";
        }
      })
    )
  );
}

async function resolveVideoUrls(
  videos: DecodedStoryVaultClip[]
): Promise<void> {
  await Promise.all(
    videos.map(async (video) => {
      if (!video.storagePath || !video.bucketName) return;
      if (videoUrls[video.id] !== undefined) return;
      try {
        const storageRef = storageRefForBucketPath({
          bucketName: video.bucketName,
          filePath: video.storagePath,
        });
        videoUrls[video.id] = await getDownloadURL(storageRef);
      } catch {
        videoUrls[video.id] = "";
      }
    })
  );
}

function videoMatchesQuery(
  video: DecodedStoryVaultClip,
  normalizedQuery: string
): boolean {
  return [
    video.title,
    video.description,
    video.transcriptSummary,
    video.quickScan?.title,
    video.quickScan?.description,
    video.quickScan?.operationMemo,
    video.quickScan?.transcriptSummary,
    ...(video.quickScan?.operationSteps ?? []),
    video.analysisResult?.operationIntent,
    video.analysisResult?.productContextSummary,
    video.analysisResult?.transcriptSummary,
    ...(video.tags ?? []),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
    .includes(normalizedQuery);
}

function storyMatchesQuery(
  story: StoryVaultZappingAnalysisStoryCandidate,
  normalizedQuery: string
): boolean {
  return [
    story.id,
    story.storyKey,
    story.title,
    story.role?.value,
    story.goal,
    story.benefit,
    story.summary,
    story.userStory,
    story.asA,
    story.iWant,
    story.soThat,
    ...story.acceptanceCriteria,
    ...story.evidence.flatMap((item) => [item.title, item.summary]),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
    .includes(normalizedQuery);
}

function formatEvidenceRange(range: [number, number] | number[]): string {
  const [start, end] = range;
  return `${formatDuration(start * 1000)} - ${formatDuration(end * 1000)}`;
}

function formatEvidencePreviewRange(range: [number, number] | number[]): string {
  const [start, end] = evidencePreviewRangeSeconds(range);
  return `${formatDuration(start * 1000)} - ${formatDuration(end * 1000)}`;
}

function evidencePreviewRangeSeconds(range: [number, number] | number[]): [number, number] {
  const start = Math.max(0, (range[0] ?? 0) - 2);
  const end = Math.max(start, (range[1] ?? range[0] ?? 0) + 2);
  return [start, end];
}

function seekEvidencePreviewVideo(
  event: Event,
  evidence: StoryVaultZappingAnalysisStoryCandidate["evidence"][number]
): void {
  if (!(event.currentTarget instanceof HTMLVideoElement)) return;
  const [start] = evidencePreviewRangeSeconds(evidence.tRange);
  event.currentTarget.currentTime = start;
}

function seekStoryPreviewVideo(
  event: Event,
  story: StoryVaultZappingAnalysisStoryCandidate
): void {
  if (!(event.currentTarget instanceof HTMLVideoElement)) return;
  const evidence = primaryEvidence(story);
  if (!evidence) return;
  const [start] = evidencePreviewRangeSeconds(evidence.tRange);
  event.currentTarget.currentTime = start;
}

function seekEvidencePreviewCue(startMs: number): void {
  const video = evidencePreviewVideo.value;
  if (!video) return;
  video.currentTime = Math.max(0, startMs / 1000);
  void video.play().catch(() => undefined);
}

function evidenceTranscriptCues(
  video: DecodedStoryVaultClip,
  evidence: StoryVaultZappingAnalysisStoryCandidate["evidence"][number]
): StoryVaultTranscriptCue[] {
  const cues = video.transcriptSegments ?? [];
  if (cues.length === 0) return [];

  const evidenceCueIds = new Set(evidence.transcriptCueIds ?? []);
  const matchedById = cues.filter((cue) => evidenceCueIds.has(cue.id));
  if (matchedById.length > 0) return matchedById;

  const [startSeconds, endSeconds] = evidence.tRange;
  const startMs = Math.max(0, (startSeconds ?? 0) * 1000);
  const endMs = Math.max(startMs, (endSeconds ?? startSeconds ?? 0) * 1000);
  return cues.filter((cue) => cue.endMs >= startMs && cue.startMs <= endMs);
}

function formatDuration(durationMs?: number): string {
  if (!durationMs || durationMs <= 0) return "0:00";
  const totalSeconds = Math.max(0, Math.round(durationMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function formatRecordedAt(value?: string): string {
  if (!value) return "録画日時なし";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}
</script>
