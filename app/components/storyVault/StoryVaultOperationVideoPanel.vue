<template>
  <section class="space-y-5">
    <div
      v-if="!detailVideo"
      class="flex flex-wrap items-center justify-between gap-4"
    >
      <div class="flex items-center gap-3">
        <div class="flex h-12 w-12 items-center justify-center rounded-lg bg-primary-50 text-primary-700">
          <UIcon
            name="material-symbols:video-camera-back-outline"
            class="h-7 w-7"
          />
        </div>
        <div>
          <h2 class="text-3xl font-bold tracking-normal text-slate-950">
            クリップ
          </h2>
          <p class="mt-1 text-sm text-slate-500">
            {{ totalClipCount }}件
          </p>
        </div>
      </div>
      <div class="flex flex-wrap gap-2">
        <EnButton
          variant="outline"
          color="neutral"
          size="sm"
          leading-icon="material-symbols:auto-awesome-outline"
          :disabled="!application"
          @click="assistantPanelOpen = true"
        >
          AI整理
        </EnButton>
        <EnButton
          variant="outline"
          color="neutral"
          size="sm"
          leading-icon="material-symbols:create-new-folder-outline"
          :disabled="!application"
          @click="openGroupCreateModal"
        >
          グループ追加
        </EnButton>
        <EnButton
          variant="ai"
          size="sm"
          leading-icon="material-symbols:video-camera-back-outline"
          :disabled="!canCapture"
          @click="openRecordingModal"
        >
          新規録画
        </EnButton>
      </div>
    </div>

    <section
      v-if="!detailVideo && (isLoadingDrafts || applicationClipDrafts.length > 0)"
      class="border-y border-slate-200 bg-slate-50 py-4"
    >
      <div class="flex flex-wrap items-center justify-between gap-3 px-1">
        <div class="flex items-center gap-2">
          <UIcon name="material-symbols:draft-outline" class="h-5 w-5 text-slate-600" />
          <h3 class="text-sm font-bold text-slate-950">録画の下書き</h3>
          <span class="text-xs text-slate-500">{{ applicationClipDrafts.length }}件</span>
        </div>
        <span v-if="isLoadingDrafts" class="inline-flex items-center gap-1.5 text-xs text-slate-500">
          <UIcon name="material-symbols:progress-activity" class="h-4 w-4 animate-spin" />
          読み込み中
        </span>
      </div>
      <div v-if="applicationClipDrafts.length > 0" class="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
        <article
          v-for="draft in applicationClipDrafts"
          :key="draft.id"
          class="flex min-h-32 flex-col border border-slate-200 bg-white p-3 shadow-sm"
        >
          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0">
              <div class="flex flex-wrap items-center gap-2">
                <span
                  class="rounded px-1.5 py-0.5 text-[10px] font-bold"
                  :class="clipDraftStatusClass(draft)"
                >
                  {{ clipDraftStatusLabel(draft) }}
                </span>
                <span class="text-[11px] text-slate-400">{{ formatClipDraftUpdatedAt(draft.updatedAt) }}</span>
              </div>
              <p class="mt-2 truncate text-sm font-bold text-slate-950">{{ draft.title }}</p>
              <p class="mt-1 line-clamp-2 text-xs leading-relaxed text-slate-500">
                {{ draft.statusMessage || "編集を再開できます" }}
              </p>
            </div>
            <button
              type="button"
              class="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-slate-400 transition hover:bg-red-50 hover:text-red-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-200"
              :aria-label="`${draft.title}を破棄`"
              :title="`${draft.title}を破棄`"
              @click="openDiscardClipDraftConfirm(draft)"
            >
              <UIcon name="material-symbols:delete-outline" class="h-4 w-4" />
            </button>
          </div>
          <div class="mt-auto flex items-center justify-between gap-2 pt-3">
            <span class="text-[11px] text-slate-400">
              {{ draft.source ? `${formatDuration(draft.source.durationMs)} / ${formatBytes(draft.source.sizeBytes)}` : "動画保存待ち" }}
            </span>
            <EnButton
              variant="outline"
              color="neutral"
              size="xs"
              leading-icon="material-symbols:resume"
              :disabled="!draft.source || draft.status === 'saving' || Boolean(resumingClipDraftId)"
              :loading="resumingClipDraftId === draft.id"
              @click="resumeClipDraft(draft)"
            >
              再開
            </EnButton>
          </div>
        </article>
      </div>
    </section>

    <Teleport to="body">
      <Transition
        enter-active-class="transition duration-200 ease-out"
        enter-from-class="opacity-0"
        enter-to-class="opacity-100"
        leave-active-class="transition duration-150 ease-in"
        leave-from-class="opacity-100"
        leave-to-class="opacity-0"
      >
        <div
          v-if="assistantPanelOpen"
          class="fixed inset-0 z-[80] bg-slate-950/25 backdrop-blur-[1px]"
          @click.self="assistantPanelOpen = false"
        />
      </Transition>
      <Transition
        enter-active-class="transition duration-300 ease-out"
        enter-from-class="translate-x-full"
        enter-to-class="translate-x-0"
        leave-active-class="transition duration-200 ease-in"
        leave-from-class="translate-x-0"
        leave-to-class="translate-x-full"
      >
        <aside
          v-if="assistantPanelOpen"
          class="fixed bottom-0 right-0 top-0 z-[90] flex w-full max-w-[560px] flex-col border-l border-slate-200 bg-slate-50 shadow-2xl"
          aria-label="AI整理アシスタント"
        >
          <div class="flex items-start justify-between gap-3 border-b border-slate-200 bg-white px-5 py-4">
            <div>
              <p class="flex items-center gap-2 text-base font-bold text-slate-950">
                <UIcon name="material-symbols:auto-awesome-outline" class="h-4 w-4 text-slate-500" />
                AI整理アシスタント
              </p>
              <p class="mt-1 text-sm leading-6 text-slate-500">
                グループ作成やクリップの割り振りをまとめて相談できます。
              </p>
            </div>
            <button
              type="button"
              class="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-300"
              aria-label="AI整理アシスタントを閉じる"
              @click="assistantPanelOpen = false"
            >
              <UIcon name="material-symbols:close-rounded" class="h-5 w-5" />
            </button>
          </div>
          <div class="min-h-0 flex-1 overflow-y-auto p-4">
            <StoryVaultOperationVideoGroupAssistant
              :application="application"
              :clip-records="clipRecords"
              :groups="clipGroups"
              :is-applying="isApplyingOrganizationPlan"
              @apply="applyOrganizationPlan"
            />
          </div>
        </aside>
      </Transition>
    </Teleport>

    <EnAlert
      v-if="errorMessage"
      class="mt-4"
      color="warning"
      :title="errorMessage"
    />

    <EnAlert
      v-if="surfaceWarning"
      class="mt-4"
      color="warning"
      :title="surfaceWarning"
    />

    <EnAlert
      v-if="application && !application.fileSpaceId"
      class="mt-4"
      color="warning"
      title="アプリ専用FileSpaceが未作成です"
      description="録画と保存はできます。ナレッジを使った後続解析には専用FileSpaceが必要です。"
    >
      <template #actions>
        <EnButton
          variant="ai"
          size="xs"
          :leading-icon="
            application.fileSpaceProvisioningStatus === 'creating'
              ? 'material-symbols:replay'
              : 'material-symbols:add-circle-outline'
          "
          :loading="isProvisioningFileSpace"
          @click="$emit('create-file-space')"
        >
          {{
            application.fileSpaceProvisioningStatus === "creating"
              ? "作成を再実行"
              : "専用FileSpace作成"
          }}
        </EnButton>
      </template>
    </EnAlert>

    <EnModal
      v-model:open="recordingModalOpen"
      :title="selectedGroupClipItems.length > 0 ? 'クリップを追加' : 'ザッピングクリップを録画'"
      :subtitle="selectedGroupClipItems.length > 0 ? '選択中のクリップグループに短い録画を追加します。' : 'マイク音声を含めて、操作意図と画面の流れを一緒に残します。'"
      title-icon="material-symbols:video-camera-back-outline"
      size="full"
      padding="none"
      :ui="{
        content:
          'w-[calc(100vw-24px)] max-w-[1480px] h-[calc(100vh-24px)] sm:w-[calc(100vw-48px)] sm:h-[calc(100vh-48px)]',
      }"
      :close-on-backdrop="!isRecording"
      :hide-close="isRecording"
      @close="handleRecordingModalClose"
    >
      <div
        class="flex h-full min-h-0 flex-col bg-slate-950 p-4 text-white"
      >
        <div class="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div class="flex flex-wrap items-center gap-2 text-xs">
            <span
              class="inline-flex items-center gap-1 rounded-full px-2.5 py-1 font-semibold"
              :class="isRecording ? 'bg-red-500/15 text-red-100 ring-1 ring-red-300/30' : 'bg-white/10 text-slate-200'"
            >
              <span
                class="h-2 w-2 rounded-full"
                :class="isRecording ? 'animate-pulse bg-red-400' : 'bg-slate-400'"
              />
              {{ isRecording ? "録画中" : recordedBlob ? "確認中" : "準備中" }}
            </span>
            <span class="font-semibold text-slate-100">{{ elapsedLabel }}</span>
            <span v-if="sourceDisplaySurfaceLabel" class="text-slate-400">
              {{ sourceDisplaySurfaceLabel }}
            </span>
            <span
              v-if="selectedVideoGroup"
              class="rounded-full bg-white/10 px-2.5 py-1 font-semibold text-slate-100 ring-1 ring-white/10"
            >
              {{ selectedVideoGroup.name }}
            </span>
            <span v-if="recordedBlob" class="text-slate-400">
              {{ formatBytes(recordedBlob.size) }}
            </span>
            <span
              v-if="isExtractingFrames"
              class="rounded-full bg-primary-400/10 px-2.5 py-1 font-semibold text-primary-100 ring-1 ring-primary-300/20"
            >
              スクショ抽出中
            </span>
          </div>
          <div class="flex flex-wrap gap-2">
            <EnButton
              v-if="isRecording"
              variant="soft"
              color="error"
              size="sm"
              leading-icon="material-symbols:stop-circle-outline"
              @click="stopCapture"
            >
              録画を停止
            </EnButton>
          </div>
        </div>

        <div
          v-if="recordedBlob && !isRecording"
          class="mb-3 flex flex-wrap items-center gap-2 border-l-2 px-3 py-2 text-xs"
          :class="clipDraftSaveError ? 'border-red-400 bg-red-400/10 text-red-100' : isSavingClipDraft ? 'border-cyan-400 bg-cyan-400/10 text-cyan-100' : 'border-emerald-400 bg-emerald-400/10 text-emerald-100'"
        >
          <UIcon
            :name="clipDraftSaveError ? 'material-symbols:error-outline' : isSavingClipDraft ? 'material-symbols:progress-activity' : 'material-symbols:cloud-done-outline'"
            class="h-4 w-4 shrink-0"
            :class="isSavingClipDraft ? 'animate-spin' : ''"
          />
          <span class="font-semibold">
            {{ clipDraftSaveError ? "下書き保存に失敗" : isSavingClipDraft ? "録画を下書き保存中" : "下書き保存済み" }}
          </span>
          <span v-if="!clipDraftSaveError && !isSavingClipDraft && clipDraftLastSavedAt" class="opacity-70">
            {{ formatClipDraftUpdatedAt(clipDraftLastSavedAt) }}
          </span>
          <span v-if="clipDraftSaveError" class="min-w-0 flex-1 truncate opacity-80">{{ clipDraftSaveError }}</span>
          <button
            v-if="clipDraftSaveError"
            type="button"
            class="ml-auto inline-flex h-7 items-center gap-1 rounded bg-white/10 px-2 font-bold transition hover:bg-white/15"
            :disabled="isSavingClipDraft"
            @click="retryActiveClipDraftSave"
          >
            <UIcon name="material-symbols:refresh" class="h-4 w-4" />
            再保存
          </button>
        </div>

        <EnAlert
          v-if="errorMessage"
          class="mb-3"
          color="warning"
          :title="errorMessage"
        />
        <EnAlert
          v-if="surfaceWarning"
          class="mb-3"
          color="warning"
          :title="surfaceWarning"
          description="画面全体やブラウザタブでも録画できますが、解析用には対象アプリのWindow選択がおすすめです。"
        />

        <div class="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden rounded-lg border border-white/10 bg-black">
          <video
            v-show="isRecording"
            ref="livePreviewVideo"
            autoplay
            muted
            playsinline
            class="aspect-video max-h-full w-full bg-black object-contain"
          />
          <video
            v-if="editingPreviewUrl && !isRecording"
            ref="recordedPreviewVideo"
            :src="editingPreviewUrl"
            controls
            class="aspect-video max-h-full w-full bg-black object-contain"
            @loadedmetadata="reconcileRecordedPreviewDuration"
            @durationchange="reconcileRecordedPreviewDuration"
            @timeupdate="updateRecordedPreviewTime"
            @play="isRecordedPreviewPlaying = true"
            @pause="isRecordedPreviewPlaying = false"
            @ended="isRecordedPreviewPlaying = false"
          />
          <button
            v-if="editingPreviewUrl && !isRecording"
            type="button"
            class="absolute right-3 top-3 inline-flex h-9 items-center gap-1.5 rounded-md border border-white/20 bg-slate-950/80 px-3 text-xs font-semibold text-white shadow-lg transition hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-cyan-300"
            title="動画を全画面で再生"
            @click="requestRecordedPreviewFullscreen"
          >
            <UIcon name="material-symbols:fullscreen" class="h-4 w-4" />
            全画面
          </button>
          <div
            v-if="!isRecording && !editingPreviewUrl"
            class="flex aspect-video w-full items-center justify-center text-sm text-slate-300"
          >
            <div class="max-w-sm text-center">
              <UIcon
                name="material-symbols:desktop-windows-outline"
                class="mx-auto h-8 w-8 text-slate-500"
              />
              <p class="mt-3 font-semibold text-slate-100">
                録画する Window を選ぶと、ここにライブ画面が表示されます
              </p>
              <p class="mt-2 text-xs leading-relaxed text-slate-400">
                選択ダイアログでは、説明したいアプリ画面とマイク音声の共有を許可してください。
              </p>
            </div>
          </div>
        </div>

        <div
          v-if="recordedBlob && !isRecording"
          class="mt-3 border-y border-white/10 py-4"
        >
          <div class="grid grid-cols-2 overflow-hidden rounded-md ring-1 ring-white/10">
            <button
              type="button"
              class="flex items-center gap-3 px-4 py-3 text-left"
              :class="clipEditingStep === 1 ? 'bg-primary-400/15 text-primary-100' : 'bg-white/5 text-slate-400'"
              @click="clipEditingStep = 1"
            >
              <span class="flex h-7 w-7 items-center justify-center rounded-full bg-white/10 text-xs font-bold">1</span>
              <span>
                <span class="block text-xs font-semibold">無音・ノイズを整理</span>
                <span class="mt-0.5 block text-[11px] opacity-75">待機時間と雑音を軽減</span>
              </span>
            </button>
            <button
              type="button"
              class="flex items-center gap-3 border-l border-white/10 px-4 py-3 text-left"
              :class="[
                clipEditingStep === 2 ? 'bg-primary-400/15 text-primary-100' : 'bg-white/5 text-slate-400',
                hasCurrentPreparedClip ? '' : 'cursor-not-allowed opacity-60',
              ]"
              :disabled="!hasCurrentPreparedClip"
              @click="clipEditingStep = 2"
            >
              <span class="flex h-7 w-7 items-center justify-center rounded-full bg-white/10 text-xs font-bold">2</span>
              <span>
                <span class="block text-xs font-semibold">セクションを分割</span>
                <span class="mt-0.5 block text-[11px] opacity-75">必要な位置で区切る</span>
              </span>
            </button>
          </div>

          <div v-if="clipEditingStep === 1" class="mt-4">
            <div class="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p class="flex items-center gap-2 text-sm font-semibold text-slate-100">
                  <UIcon name="material-symbols:graphic-eq" class="h-5 w-5 text-primary-300" />
                  無音箇所を確認
                </p>
                <p class="mt-1 text-xs text-slate-400">
                  -{{ Math.abs(silenceThresholdDb) }} dB未満が5秒以上続く区間を無音候補にします。
                </p>
              </div>
              <div class="flex flex-wrap items-center justify-end gap-4 text-xs text-slate-200">
                <label class="flex items-center gap-2">
                  <span>無音をカット</span>
                  <USwitch v-model="silenceCutEnabled" :disabled="isPreparingClips" />
                </label>
                <label class="flex items-center gap-2">
                  <span>ノイズを低減</span>
                  <USwitch v-model="noiseReductionEnabled" :disabled="isPreparingClips" />
                </label>
              </div>
            </div>

            <div class="mt-4 rounded-md bg-black/30 p-3 ring-1 ring-white/10">
              <div class="flex flex-wrap items-center justify-between gap-2 text-xs">
                <div class="flex items-center gap-2">
                  <button
                    type="button"
                    class="inline-flex h-8 w-8 items-center justify-center rounded-md bg-white/10 text-slate-100 transition hover:bg-white/15 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-300"
                    :aria-label="isRecordedPreviewPlaying ? '一時停止' : '再生'"
                    @click="toggleRecordedPreviewPlayback"
                  >
                    <UIcon
                      :name="isRecordedPreviewPlaying ? 'material-symbols:pause-rounded' : 'material-symbols:play-arrow-rounded'"
                      class="h-5 w-5"
                    />
                  </button>
                  <span class="font-semibold text-slate-100">音声タイムライン</span>
                  <span class="font-mono text-slate-400">{{ formatDuration(recordedPreviewMs) }}</span>
                </div>
                <div class="flex flex-wrap items-center justify-end gap-2">
                  <span class="text-slate-400">
                    {{ isAnalyzingSilence ? "無音を解析中" : `無音候補 ${silenceRanges.length}箇所 / カット ${selectedCutRanges.length}箇所` }}
                    / 調整後 約{{ formatDuration(editedDurationMs) }}
                  </span>
                  <button
                    type="button"
                    class="inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 font-semibold ring-1 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-300"
                    :class="manualRangeSelectionActive ? 'bg-rose-400/20 text-rose-100 ring-rose-300/50' : 'bg-white/10 text-slate-200 ring-white/10 hover:bg-white/15'"
                    :disabled="isPreparingClips"
                    @click="toggleManualRangeSelection"
                  >
                    <UIcon name="material-symbols:select" class="h-4 w-4" />
                    範囲カット
                  </button>
                </div>
              </div>
              <div
                ref="silenceTimeline"
                class="relative mt-3 h-16 touch-none select-none overflow-hidden rounded bg-slate-800 ring-1 ring-white/10"
                :class="isScrubbingSilenceTimeline || isSelectingManualCutRange ? 'cursor-grabbing' : 'cursor-crosshair'"
                :aria-label="manualRangeSelectionActive ? '音声タイムライン。ドラッグしてカット範囲を選択' : '音声タイムライン。クリックまたはドラッグで再生位置を移動'"
                @pointerdown="handleSilenceTimelinePointerDown"
                @pointermove="handleSilenceTimelinePointerMove"
                @pointerup="handleSilenceTimelinePointerUp"
                @pointercancel="handleSilenceTimelinePointerUp"
                @lostpointercapture="handleSilenceTimelinePointerUp"
              >
                <div class="absolute inset-y-0 left-0 bg-primary-400/25" :style="{ width: `${previewProgressPercent}%` }" />
                <div
                  v-for="(range, index) in silenceRanges"
                  :key="`silence-${index}`"
                  class="absolute inset-y-0 flex min-w-8 items-center justify-center overflow-hidden border-x px-1 text-[10px] font-bold"
                  :class="silenceCutEnabled && !isSilenceRangeKept(index) ? 'border-amber-300/60 bg-amber-300/35 text-amber-50' : 'border-emerald-300/30 bg-emerald-400/10 text-emerald-100'"
                  :style="timelineRangeStyle(range.startMs, range.endMs)"
                >
                  <span class="truncate">{{ isSilenceRangeKept(index) ? "残す" : "無音" }}</span>
                </div>
                <div
                  v-for="(range, index) in manualCutRanges"
                  :key="`manual-cut-${index}`"
                  class="pointer-events-none absolute inset-y-0 z-10 flex min-w-8 items-center justify-center overflow-hidden border-x border-rose-300/70 bg-rose-400/35 px-1 text-[10px] font-bold text-rose-50"
                  :style="timelineRangeStyle(range.startMs, range.endMs)"
                >
                  <span class="truncate">手動</span>
                </div>
                <div
                  v-if="manualRangeSelectionActive && manualCutSelectionRange"
                  class="pointer-events-none absolute inset-y-0 z-20 border-x-2 border-white bg-rose-300/30 shadow-[0_0_14px_rgba(251,113,133,.45)]"
                  :style="timelineRangeStyle(manualCutSelectionRange.startMs, manualCutSelectionRange.endMs)"
                />
                <div
                  class="pointer-events-none absolute inset-y-0 z-20 w-0.5 -translate-x-1/2 bg-white shadow-[0_0_0_1px_rgba(15,23,42,.7),0_0_10px_rgba(255,255,255,.65)]"
                  :style="{ left: `${previewProgressPercent}%` }"
                >
                  <span class="absolute -top-1 left-1/2 h-3 w-3 -translate-x-1/2 rounded-full bg-white ring-2 ring-slate-900" />
                </div>
              </div>

              <div
                v-if="manualRangeSelectionActive"
                class="mt-2 flex flex-wrap items-center gap-2 rounded-md bg-rose-400/10 px-2.5 py-2 text-[11px] text-rose-100 ring-1 ring-rose-300/25"
              >
                <UIcon name="material-symbols:select" class="h-4 w-4 shrink-0" />
                <span class="font-semibold">
                  {{ manualCutSelectionRange ? `${formatDuration(manualCutSelectionRange.startMs)} - ${formatDuration(manualCutSelectionRange.endMs)}` : "タイムライン上をドラッグして範囲を選択" }}
                </span>
                <button
                  type="button"
                  class="ml-auto inline-flex h-7 items-center gap-1 rounded bg-rose-300 px-2 font-bold text-slate-950 transition hover:bg-rose-200 disabled:cursor-not-allowed disabled:opacity-40"
                  :disabled="!canAddManualCutSelection"
                  @click="addManualCutSelection"
                >
                  <UIcon name="material-symbols:content-cut-rounded" class="h-4 w-4" />
                  この範囲をカット
                </button>
                <button
                  v-if="manualCutSelectionRange"
                  type="button"
                  class="inline-flex h-7 w-7 items-center justify-center rounded text-rose-100 transition hover:bg-white/10"
                  title="選択を解除"
                  aria-label="選択を解除"
                  @click="clearManualCutSelection"
                >
                  <UIcon name="material-symbols:close-rounded" class="h-4 w-4" />
                </button>
              </div>

              <div class="mt-3">
                <div class="mb-1.5 flex items-center justify-between text-[11px]">
                  <span class="font-semibold text-slate-200">音声ボリューム</span>
                  <span class="text-amber-200">無音しきい値 {{ silenceThresholdDb }} dB</span>
                </div>
                <div class="relative h-20 overflow-hidden rounded bg-slate-950/80 ring-1 ring-white/10">
                  <div class="absolute inset-0 flex items-end gap-px px-1 pt-1">
                    <span
                      v-for="(sample, index) in displayedAudioLevelSamples"
                      :key="`level-${index}`"
                      class="min-w-0 flex-1 rounded-t-sm"
                      :class="isAudioSampleBelowThreshold(sample) ? 'bg-amber-300/55' : 'bg-primary-300/80'"
                      :style="{ height: `${audioLevelHeightPercent(sample.db)}%` }"
                      :title="`${sample.db.toFixed(1)} dB / ${formatDuration(sample.startMs)}`"
                    />
                  </div>
                  <div
                    class="pointer-events-none absolute inset-x-0 z-10 border-t border-dashed border-amber-200/90"
                    :style="{ bottom: `${thresholdLineBottomPercent(silenceThresholdDb)}%` }"
                  >
                    <span class="absolute right-1 top-1 rounded bg-slate-950/85 px-1 text-[9px] font-bold text-amber-100">
                      {{ silenceThresholdDb }} dB
                    </span>
                  </div>
                  <div
                    class="pointer-events-none absolute inset-y-0 z-20 w-px -translate-x-1/2 bg-white/80"
                    :style="{ left: `${previewProgressPercent}%` }"
                  />
                </div>
              </div>

              <div v-if="silenceRanges.length > 0" class="mt-3 flex flex-wrap gap-2">
                <button
                  v-for="(range, index) in silenceRanges"
                  :key="`silence-choice-${index}`"
                  type="button"
                  class="inline-flex items-center gap-2 rounded-md px-2.5 py-1.5 text-[11px] font-semibold ring-1 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-300"
                  :class="isSilenceRangeKept(index) ? 'bg-emerald-400/10 text-emerald-100 ring-emerald-300/30' : 'bg-amber-300/10 text-amber-100 ring-amber-300/30'"
                  @click="toggleSilenceRangeKept(index)"
                >
                  <UIcon
                    :name="isSilenceRangeKept(index) ? 'material-symbols:volume-up-outline' : 'material-symbols:content-cut-rounded'"
                    class="h-4 w-4"
                  />
                  <span>{{ formatDuration(range.startMs) }} - {{ formatDuration(range.endMs) }}</span>
                  <span class="rounded bg-black/20 px-1.5 py-0.5">{{ isSilenceRangeKept(index) ? "残す" : "カット" }}</span>
                </button>
              </div>
              <div v-if="manualCutRanges.length > 0" class="mt-3 flex flex-wrap items-center gap-2">
                <span class="text-[11px] font-semibold text-rose-200">手動カット</span>
                <span
                  v-for="(range, index) in manualCutRanges"
                  :key="`manual-cut-choice-${index}`"
                  class="inline-flex items-center gap-1.5 rounded-md bg-rose-400/10 py-1 pl-2.5 pr-1 text-[11px] font-semibold text-rose-100 ring-1 ring-rose-300/30"
                >
                  <UIcon name="material-symbols:content-cut-rounded" class="h-4 w-4" />
                  {{ formatDuration(range.startMs) }} - {{ formatDuration(range.endMs) }}
                  <button
                    type="button"
                    class="inline-flex h-6 w-6 items-center justify-center rounded text-rose-100 transition hover:bg-white/10"
                    :title="`${formatDuration(range.startMs)}からの手動カットを削除`"
                    :aria-label="`${formatDuration(range.startMs)}からの手動カットを削除`"
                    @click="removeManualCutRange(index)"
                  >
                    <UIcon name="material-symbols:close-rounded" class="h-4 w-4" />
                  </button>
                </span>
              </div>
              <div class="mt-2 flex items-center justify-between text-[11px] text-slate-400">
                <span>0:00</span>
                <span>{{ selectedCutRanges.length > 0 ? `${selectedCutRanges.length}箇所をカットします` : "カットせず元動画を使います" }}</span>
                <span>{{ formatDuration(recordingDurationMs) }}</span>
              </div>
            </div>

            <div
              v-if="clipPreparationStatus"
              class="mt-3 flex items-start gap-3 rounded-md bg-primary-400/10 px-3 py-3 text-xs text-primary-100 ring-1 ring-primary-300/20"
            >
              <UIcon :name="clipPreparationStatus.icon" class="mt-0.5 h-5 w-5 shrink-0" />
              <div>
                <p class="font-semibold">{{ clipPreparationStatus.title }}</p>
                <p class="mt-1 text-primary-100/70">{{ clipPreparationStatus.description }}</p>
              </div>
            </div>
            <EnAlert
              v-if="clipPreparationPhase === 'error'"
              class="mt-3"
              color="warning"
              title="動画の準備を完了できませんでした"
              :description="clipPreparationError"
            />
          </div>

          <div v-else class="mt-4">
            <div>
              <p class="flex items-center gap-2 text-sm font-semibold text-slate-100">
                <UIcon name="material-symbols:vertical-split" class="h-5 w-5 text-amber-300" />
                区切り位置を決める
              </p>
              <p class="mt-1 text-xs text-slate-400">
                動画を再生し、話題や機能が切り替わる位置で分割します。分割しないままでも取り込めます。
              </p>
            </div>

            <div class="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-slate-300">
              <span class="inline-flex items-center gap-1.5 rounded bg-emerald-400/10 px-2 py-1 font-semibold text-emerald-100 ring-1 ring-emerald-300/20">
                <UIcon name="material-symbols:check-circle-outline" class="h-4 w-4" />
                Gemini文字起こし完了
              </span>
              <span>{{ preparedTranscription?.segments.length ?? 0 }}件の発話</span>
              <span>AI分割案 {{ aiSectionDrafts.length }}件</span>
            </div>

            <div class="mt-4 rounded-md bg-black/30 p-3 ring-1 ring-white/10">
            <div class="flex flex-wrap items-center justify-between gap-2 text-xs">
              <span class="font-semibold text-slate-100">編集タイムライン</span>
              <span class="text-slate-400">
                再生位置 {{ formatDuration(recordedPreviewMs) }} / {{ splitPointsMs.length + 1 }}セクション
              </span>
            </div>
            <div class="relative mt-3 h-14 overflow-hidden rounded bg-slate-800 ring-1 ring-white/10">
              <div class="absolute inset-y-0 left-0 bg-primary-400/25" :style="{ width: `${previewProgressPercent}%` }" />
              <template v-if="!hasCurrentPreparedClip">
                <span
                  v-for="(range, index) in cutSilenceRanges"
                  :key="`cut-${index}`"
                  class="absolute inset-y-0 bg-rose-400/25"
                  :class="silenceCutEnabled ? '' : 'hidden'"
                  :style="timelineRangeStyle(range.startMs, range.endMs)"
                />
              </template>
              <button
                v-for="point in splitPointsMs"
                :key="`split-${point}`"
                type="button"
                class="absolute inset-y-0 z-10 w-1 -translate-x-1/2 bg-amber-300 shadow-[0_0_0_1px_rgba(15,23,42,.8)]"
                :style="{ left: `${timelinePercent(point)}%` }"
                :title="`${formatDuration(point)} の分割点。クリックで削除`"
                @click="removeSplitPoint(point)"
              />
            </div>
            <div class="mt-2 flex items-center justify-between text-[11px] text-slate-400">
              <span>0:00</span>
              <span>黄の分割線はクリックで削除できます</span>
              <span>{{ formatDuration(recordingDurationMs) }}</span>
            </div>
          </div>

          <div class="mt-3 flex flex-wrap items-center gap-2">
            <EnButton
              variant="soft"
              color="neutral"
              size="sm"
              leading-icon="material-symbols:vertical-split"
              :disabled="isPreparingClips || recordedPreviewMs <= 250 || recordedPreviewMs >= recordingDurationMs - 250"
              @click="addSplitAtCurrentTime"
            >
              {{ formatDuration(recordedPreviewMs) }} で分割
            </EnButton>
            <EnButton
              v-if="splitPointsMs.length > 0"
              variant="ghost"
              color="neutral"
              size="sm"
              leading-icon="material-symbols:restart-alt"
              :disabled="isPreparingClips"
              @click="splitPointsMs = []"
            >
              分割を解除
            </EnButton>
            <EnButton
              v-if="aiSectionDrafts.length > 0 && hasChangedAiSplitProposal"
              variant="outline"
              color="neutral"
              size="sm"
              leading-icon="material-symbols:undo"
              :disabled="isPreparingClips"
              @click="restoreAiSplitProposal"
            >
              AI案に戻す
            </EnButton>
            <span class="ml-auto text-xs font-semibold text-slate-200">
              {{ splitPointsMs.length === 0 ? "分割なし" : `${splitPointsMs.length + 1}クリップに分割` }}
            </span>
          </div>

          <div class="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            <div
              v-for="section in preparedSectionSummaries"
              :key="section.index"
              class="rounded-md bg-white/5 px-3 py-2 text-xs ring-1 ring-white/10"
            >
              <div class="flex items-center justify-between gap-2">
                <p class="min-w-0 truncate font-semibold text-slate-100">{{ section.title }}</p>
                <span
                  v-if="section.isAiSuggested"
                  class="shrink-0 rounded bg-primary-400/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary-200"
                >AI提案</span>
              </div>
              <p class="mt-1 text-slate-400">
                {{ formatDuration(section.startMs) }} - {{ formatDuration(section.endMs) }}
                / 約{{ formatDuration(section.editedDurationMs) }}
              </p>
              <p class="mt-1 line-clamp-2 text-[11px] text-slate-500">{{ section.summary }}</p>
            </div>
          </div>
          </div>
        </div>

        <div
          v-if="frameCaptures.length > 0"
          class="mt-3 rounded-lg border border-white/10 bg-white/5 p-3"
        >
          <div class="mb-2 flex items-center justify-between gap-2 text-xs">
            <span class="font-semibold text-slate-100">5秒ごとのスクリーンショット</span>
            <span class="text-slate-400">{{ frameCaptures.length }}枚</span>
          </div>
          <div class="grid grid-cols-4 gap-2 md:grid-cols-6 xl:grid-cols-8">
            <figure
              v-for="frame in frameCaptures"
              :key="frame.id"
              class="overflow-hidden rounded-md bg-black ring-1 ring-white/10"
            >
              <img
                :src="frame.previewUrl"
                class="aspect-video w-full object-cover"
                :alt="`${formatDuration(frame.timestampMs)} のスクリーンショット`"
              >
              <figcaption class="px-1.5 py-1 text-[10px] text-slate-300">
                {{ formatDuration(frame.timestampMs) }}
              </figcaption>
            </figure>
          </div>
        </div>

        <div v-if="!recordedBlob" class="mt-3 grid gap-2 text-xs text-slate-300 sm:grid-cols-3">
          <div class="rounded-lg bg-white/5 p-3 ring-1 ring-white/10">
            <p class="font-semibold text-slate-100">1. マイク必須</p>
            <p class="mt-1 text-slate-400">声で意図や判断を説明します。</p>
          </div>
          <div class="rounded-lg bg-white/5 p-3 ring-1 ring-white/10">
            <p class="font-semibold text-slate-100">2. Window推奨</p>
            <p class="mt-1 text-slate-400">対象アプリだけを選ぶと解析しやすくなります。</p>
          </div>
          <div class="rounded-lg bg-white/5 p-3 ring-1 ring-white/10">
            <p class="font-semibold text-slate-100">3. 停止して保存</p>
            <p class="mt-1 text-slate-400">確認後に保存すると詳細画面に移動します。</p>
          </div>
        </div>

        <div v-if="recordedBlob && !isRecording" class="mt-4 rounded-lg border border-white/10 bg-white/5 p-3">
          <p class="text-xs font-semibold text-slate-100">録画後の処理方法</p>
          <div class="mt-2 grid gap-2 sm:grid-cols-2">
            <button type="button" class="rounded-lg border p-3 text-left text-xs transition" :class="recordingProcessingMode === 'automatic' ? 'border-primary-300 bg-primary-400/15 text-primary-50' : 'border-white/10 text-slate-300 hover:bg-white/5'" @click="recordingProcessingMode = 'automatic'">
              <span class="block font-semibold">バックグラウンド全自動（推奨）</span>
              <span class="mt-1 block opacity-75">AI分割案を自動採用し、ブラウザを閉じてもStory生成と通知まで続けます。</span>
            </button>
            <button type="button" class="rounded-lg border p-3 text-left text-xs transition" :class="recordingProcessingMode === 'manual' ? 'border-primary-300 bg-primary-400/15 text-primary-50' : 'border-white/10 text-slate-300 hover:bg-white/5'" @click="recordingProcessingMode = 'manual'">
              <span class="block font-semibold">手動編集</span>
              <span class="mt-1 block opacity-75">無音候補とAI分割案を確認してから保存します。</span>
            </button>
          </div>
        </div>

        <div class="mt-4 flex flex-wrap justify-end gap-2 border-t border-white/10 pt-4">
          <EnButton
            v-if="!isRecording && !recordedBlob"
            variant="ai"
            size="md"
            leading-icon="material-symbols:present-to-all-outline"
            :disabled="!canCapture"
            @click="startCapture"
          >
            Window とマイクを選んで録画開始
          </EnButton>
          <EnButton
            v-if="isRecording"
            variant="soft"
            color="error"
            size="md"
            leading-icon="material-symbols:stop-circle-outline"
            @click="stopCapture"
          >
            録画を停止
          </EnButton>
          <EnButton
            v-if="recordedBlob && !isRecording"
            variant="ghost"
            color="neutral"
            size="md"
            :disabled="isSaving || isExtractingFrames || isPreparingClips || isSavingClipDraft"
            @click="resetRecording"
          >
            撮り直す
          </EnButton>
          <EnButton
            v-if="recordedBlob && !isRecording && recordingProcessingMode === 'automatic'"
            variant="ai"
            size="md"
            leading-icon="material-symbols:rocket-launch-outline"
            :disabled="isSavingClipDraft || !activeClipDraftIsPersisted || isStartingAutomaticPipeline"
            :loading="isStartingAutomaticPipeline"
            @click="startAutomaticPipeline"
          >
            バックグラウンド解析を開始
          </EnButton>
          <EnButton
            v-if="recordedBlob && !isRecording && recordingProcessingMode === 'manual' && clipEditingStep === 1"
            variant="ghost"
            color="neutral"
            size="md"
            :disabled="isPreparingClips || isSavingClipDraft || !activeClipDraftIsPersisted"
            leading-icon="material-symbols:subtitles-outline"
            @click="prepareTranscriptAndSections(false)"
          >
            {{ noiseReductionEnabled ? "カットせずノイズ低減して文字起こし" : "カットせず文字起こし" }}
          </EnButton>
          <EnButton
            v-if="recordedBlob && !isRecording && recordingProcessingMode === 'manual' && clipEditingStep === 1"
            variant="ai"
            size="md"
            leading-icon="material-symbols:auto-awesome"
            :disabled="isAnalyzingSilence || isPreparingClips || isSavingClipDraft || !activeClipDraftIsPersisted"
            :loading="isPreparingClips"
            @click="prepareTranscriptAndSections(true)"
          >
            {{ manualCutRanges.length > 0 ? "選択範囲をカットして文字起こし" : silenceCutEnabled && cutSilenceRanges.length > 0 ? "無音カットして文字起こし" : noiseReductionEnabled ? "ノイズ低減して分割案を作る" : "文字起こしして分割案を作る" }}
          </EnButton>
          <EnButton
            v-if="recordedBlob && !isRecording && recordingProcessingMode === 'manual' && clipEditingStep === 2"
            variant="ghost"
            color="neutral"
            size="md"
            leading-icon="material-symbols:arrow-back"
            :disabled="isPreparingClips"
            @click="clipEditingStep = 1"
          >
            戻る
          </EnButton>
          <EnButton
            v-if="recordedBlob && !isRecording && recordingProcessingMode === 'manual' && clipEditingStep === 2"
            variant="ai"
            size="md"
            leading-icon="material-symbols:auto-awesome"
            :disabled="!canSave"
            :loading="isSaving || isExtractingFrames || isPreparingClips"
            @click="saveRecording"
          >
            AIタイトルで{{ splitPointsMs.length + 1 }}クリップを取り込む
          </EnButton>
        </div>
      </div>
    </EnModal>

    <EnModal
      v-model:open="continueRecordingPromptOpen"
      title="バックグラウンド解析を開始しました"
      subtitle="解析を待たずに、続けて次の操作クリップを撮影できます。"
      title-icon="material-symbols:playlist-add-check-circle-outline"
      size="lg"
      :close-on-backdrop="false"
      :hide-close="true"
    >
      <div class="space-y-5">
        <div class="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
          <p class="font-semibold">{{ lastSubmittedRecordingTitle }}</p>
          <p class="mt-1">この撮影セッションで {{ submittedPipelineCount }} 本を解析へ投入しました。</p>
        </div>
        <div class="grid gap-3 sm:grid-cols-2">
          <button type="button" class="rounded-xl border border-primary-200 bg-primary-50 p-4 text-left transition hover:bg-primary-100" @click="recordNextClip">
            <span class="flex items-center gap-2 font-semibold text-primary-900"><UIcon name="material-symbols:video-camera-back-outline" class="h-5 w-5" />続けて次を撮影</span>
            <span class="mt-1 block text-xs text-primary-700">録画画面を初期化し、次のWindow・マイク選択へ進みます。</span>
          </button>
          <button type="button" class="rounded-xl border border-slate-200 bg-white p-4 text-left transition hover:bg-slate-50" @click="finishRecordingBatch">
            <span class="flex items-center gap-2 font-semibold text-slate-900"><UIcon name="material-symbols:bedtime-outline" class="h-5 w-5" />いったん撮影を終了</span>
            <span class="mt-1 block text-xs text-slate-600">解析は継続します。ヘッダーの解析ステータスや完了メールで確認できます。</span>
          </button>
        </div>
      </div>
    </EnModal>

    <EnModal
      v-model:open="clipPreparationProgressOpen"
      title="文字起こしとクリップ分割を準備中"
      subtitle="動画調整のRequestDocログと後続処理の進み具合を表示します。"
      title-icon="material-symbols:movie-edit-outline"
      size="2xl"
      :close-on-backdrop="false"
      :hide-close="isClipPreparationBusy"
    >
      <div class="space-y-5">
        <div
          class="border-l-4 px-4 py-3"
          :class="clipPreparationPhase === 'error' ? 'border-red-500 bg-red-50' : clipPreparationPhase === 'done' ? 'border-emerald-500 bg-emerald-50' : 'border-cyan-500 bg-cyan-50'"
        >
          <div class="flex items-start gap-3">
            <span
              class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white shadow-sm ring-1"
              :class="clipPreparationPhase === 'error' ? 'text-red-600 ring-red-100' : clipPreparationPhase === 'done' ? 'text-emerald-700 ring-emerald-100' : 'text-cyan-700 ring-cyan-100'"
            >
              <UIcon
                :name="clipPreparationPhase === 'error' ? 'material-symbols:error-outline' : clipPreparationPhase === 'done' ? 'material-symbols:check-circle-outline' : 'material-symbols:progress-activity'"
                class="h-5 w-5"
                :class="isClipPreparationBusy ? 'animate-spin' : ''"
              />
            </span>
            <div class="min-w-0 flex-1">
              <div class="flex flex-wrap items-center justify-between gap-2">
                <p class="font-bold text-slate-950">{{ clipPreparationProgressTitle }}</p>
                <span class="text-sm font-bold text-slate-700">{{ clipPreparationProgressCompletion }}%</span>
              </div>
              <p class="mt-1 text-sm leading-relaxed text-slate-600">
                {{ clipPreparationProgressDescription }}
              </p>
              <div class="mt-3 h-2 overflow-hidden rounded-full bg-white ring-1 ring-slate-100">
                <div
                  class="h-full rounded-full transition-all duration-500"
                  :class="clipPreparationPhase === 'error' ? 'bg-red-500' : 'bg-cyan-500'"
                  :style="{ width: `${clipPreparationProgressCompletion}%` }"
                />
              </div>
            </div>
          </div>
        </div>

        <ol class="grid gap-2 sm:grid-cols-2">
          <li
            v-for="(step, index) in clipPreparationProgressSteps"
            :key="step.key"
            class="flex min-h-20 items-start gap-3 border px-3 py-3"
            :class="step.status === 'active' ? 'border-cyan-200 bg-cyan-50/60' : step.status === 'done' ? 'border-emerald-100 bg-emerald-50/40' : step.status === 'error' ? 'border-red-200 bg-red-50' : 'border-slate-200 bg-white'"
          >
            <span
              class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold"
              :class="step.status === 'done' ? 'bg-emerald-100 text-emerald-700' : step.status === 'active' ? 'bg-cyan-100 text-cyan-700' : step.status === 'error' ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-400'"
            >
              <UIcon v-if="step.status === 'done'" name="material-symbols:check-small" class="h-4 w-4" />
              <UIcon v-else-if="step.status === 'active'" name="material-symbols:progress-activity" class="h-4 w-4 animate-spin" />
              <UIcon v-else-if="step.status === 'error'" name="material-symbols:close-small" class="h-4 w-4" />
              <span v-else>{{ index + 1 }}</span>
            </span>
            <div class="min-w-0">
              <p class="text-sm font-bold text-slate-900">{{ step.label }}</p>
              <p class="mt-1 text-xs leading-relaxed text-slate-500">{{ step.description }}</p>
            </div>
          </li>
        </ol>

        <div class="border-t border-slate-200 pt-4">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <p class="flex items-center gap-2 text-sm font-bold text-slate-900">
              <UIcon name="material-symbols:receipt-long-outline" class="h-4 w-4 text-slate-500" />
              RequestDocログ
            </p>
            <button
              v-if="clipPreparationProgress?.requestId"
              type="button"
              class="font-mono text-[11px] text-slate-500 transition hover:text-slate-900"
              title="リクエストIDをコピー"
              @click="copyIdToClipboard(clipPreparationProgress.requestId, 'リクエストID')"
            >
              {{ compactId(clipPreparationProgress.requestId) }}
            </button>
          </div>
          <div v-if="clipPreparationRequestLogs.length > 0" class="mt-3 max-h-52 overflow-y-auto border border-slate-200 bg-slate-950">
            <div
              v-for="(log, index) in clipPreparationRequestLogs.slice(-6).reverse()"
              :key="`${String(log.timestamp || '')}-${index}`"
              class="grid grid-cols-[auto_minmax(0,1fr)] gap-3 border-b border-white/10 px-3 py-2.5 last:border-b-0"
            >
              <span class="font-mono text-[10px] text-slate-500">{{ formatClipPreparationLogTime(log.timestamp) }}</span>
              <div class="min-w-0">
                <p class="text-xs font-semibold text-slate-100">{{ clipPreparationLogLabel(log) }}</p>
                <p class="mt-0.5 break-words font-mono text-[10px] leading-relaxed text-slate-400">{{ log.message }}</p>
              </div>
            </div>
          </div>
          <div v-else class="mt-3 flex h-20 items-center justify-center border border-dashed border-slate-300 text-xs text-slate-400">
            RequestDocの更新を待っています
          </div>
        </div>
      </div>
      <template v-if="clipPreparationPhase === 'done' || clipPreparationPhase === 'error'" #footer>
        <EnButton
          variant="ai"
          size="sm"
          :leading-icon="clipPreparationPhase === 'done' ? 'material-symbols:vertical-split' : 'material-symbols:close-rounded'"
          @click="clipPreparationProgressOpen = false"
        >
          {{ clipPreparationPhase === 'done' ? '分割案を確認' : '閉じる' }}
        </EnButton>
      </template>
    </EnModal>

    <EnModal
      v-model:open="discardClipDraftConfirmOpen"
      title="録画の下書きを破棄しますか?"
      subtitle="元動画と途中の編集状態を削除します。"
      title-icon="material-symbols:delete-outline"
      header-variant="warning"
      size="md"
      :close-on-backdrop="!discardingClipDraftId"
      :hide-close="Boolean(discardingClipDraftId)"
    >
      <div v-if="discardClipDraftTarget" class="border border-red-100 bg-red-50 p-3">
        <p class="text-sm font-bold text-slate-950">{{ discardClipDraftTarget.title }}</p>
        <p class="mt-1 text-xs text-slate-600">
          {{ formatClipDraftUpdatedAt(discardClipDraftTarget.updatedAt) }} / {{ discardClipDraftTarget.source ? formatDuration(discardClipDraftTarget.source.durationMs) : "動画保存待ち" }}
        </p>
      </div>
      <template #footer>
        <EnButton
          variant="ghost"
          color="neutral"
          size="sm"
          :disabled="Boolean(discardingClipDraftId)"
          @click="discardClipDraftConfirmOpen = false"
        >
          キャンセル
        </EnButton>
        <EnButton
          variant="soft"
          color="error"
          size="sm"
          leading-icon="material-symbols:delete-outline"
          :loading="discardingClipDraftId === discardClipDraftTarget?.id"
          @click="confirmDiscardClipDraft"
        >
          下書きを破棄
        </EnButton>
      </template>
    </EnModal>

    <EnModal
      v-model:open="groupCreateModalOpen"
      title="クリップグループを作成"
      subtitle="録画をまとめる単位を先に作成します。"
      title-icon="material-symbols:create-new-folder-outline"
      size="sm"
    >
      <form class="space-y-5" @submit.prevent="submitClipGroup">
        <div class="grid gap-2">
          <label class="block text-sm font-bold text-slate-700">グループ名</label>
          <UInput
            v-model="groupNameDraft"
            class="w-full"
            size="md"
            placeholder="例: AIにファイルを取り込ませる"
            autofocus
          />
        </div>
        <div class="grid gap-2">
          <label class="block text-sm font-bold text-slate-700">説明</label>
          <UTextarea
            v-model="groupDescriptionDraft"
            class="w-full"
            :rows="3"
            placeholder="このグループで扱うクリップの目的や範囲"
          />
        </div>
        <div class="flex justify-end gap-2">
          <EnButton
            type="button"
            variant="ghost"
            color="neutral"
            size="sm"
            @click="groupCreateModalOpen = false"
          >
            キャンセル
          </EnButton>
          <EnButton
            type="submit"
            variant="ai"
            size="sm"
            leading-icon="material-symbols:add-rounded"
            :disabled="!groupNameDraft.trim()"
          >
            作成
          </EnButton>
        </div>
      </form>
    </EnModal>

    <EnModal
      v-model:open="deleteGroupConfirmOpen"
      title="クリップグループを削除しますか?"
      subtitle="クリップが入っていないグループだけ削除できます。"
      header-variant="warning"
      title-icon="material-symbols:delete-outline"
      size="md"
    >
      <div
        v-if="deleteTargetGroup"
        class="space-y-3"
      >
        <div class="rounded-lg border border-red-100 bg-red-50 p-3">
          <p class="text-sm font-semibold text-slate-900">
            {{ deleteTargetGroup.name }}
          </p>
          <p class="mt-1 text-xs leading-relaxed text-slate-600">
            {{ deleteTargetGroup.description || "説明なし" }}
          </p>
          <p class="mt-2 w-fit rounded-full bg-white px-2 py-0.5 text-[11px] font-bold text-slate-700 ring-1 ring-red-100">
            {{ groupVideoCount(deleteTargetGroup.id) }}件
          </p>
        </div>
        <p
          v-if="groupVideoCount(deleteTargetGroup.id) > 0"
          class="text-xs leading-relaxed text-red-600"
        >
          このグループにはクリップが登録されています。先にクリップを別グループへ移動するか削除してください。
        </p>
        <p
          v-else
          class="text-xs leading-relaxed text-slate-500"
        >
          削除後、このグループは一覧に表示されなくなります。必要になった場合は新しく作成してください。
        </p>
      </div>
      <template #footer>
        <EnButton
          variant="ghost"
          color="neutral"
          size="sm"
          @click="deleteGroupConfirmOpen = false"
        >
          キャンセル
        </EnButton>
        <EnButton
          variant="soft"
          color="error"
          size="sm"
          leading-icon="material-symbols:delete-outline"
          :disabled="!deleteTargetGroup || groupVideoCount(deleteTargetGroup.id) > 0"
          @click="deleteConfirmedGroup"
        >
          削除
        </EnButton>
      </template>
    </EnModal>

    <EnModal
      v-model:open="saveProgressOpen"
      title="クリップを保存中"
      subtitle="録画データとクリップ解析メモを保存しています。"
      title-icon="material-symbols:cloud-upload-outline"
      size="full"
      :close-on-backdrop="false"
      :hide-close="isSaveWorkflowBusy"
      :ui="{ content: 'w-[92vw] max-w-[1560px]' }"
    >
      <div class="space-y-5">
        <div class="rounded-xl border border-slate-200 bg-white p-4">
          <EnStepper
            :model-value="saveWorkflowActiveIndex"
            :items="saveWorkflowStepperItems"
            size="sm"
            color="primary"
            custom-class="pointer-events-none"
          />
        </div>

        <div
          class="overflow-hidden rounded-xl border"
          :class="saveProgressPhase === 'error' ? 'border-red-200 bg-red-50' : 'border-cyan-100 bg-cyan-50'"
          :aria-busy="isSaveWorkflowBusy"
        >
          <div class="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div class="flex items-start gap-3">
              <span
                class="flex h-11 w-11 shrink-0 items-center justify-center rounded-full"
                :class="saveProgressPhase === 'error' ? 'bg-red-100 text-red-600' : saveProgressPhase === 'done' ? 'bg-emerald-100 text-emerald-700' : 'bg-white text-cyan-700 shadow-sm ring-1 ring-cyan-100'"
              >
                <UIcon
                  :name="saveProgressPhase === 'error' ? 'material-symbols:error-outline' : saveProgressPhase === 'done' ? 'material-symbols:check-circle-outline' : 'material-symbols:progress-activity'"
                  class="h-6 w-6"
                  :class="isSaveWorkflowBusy ? 'animate-spin' : ''"
                />
              </span>
              <div class="min-w-0">
                <p class="text-base font-bold text-slate-950">
                  {{ saveProgressTitle }}
                </p>
                <p class="mt-1 text-sm leading-relaxed text-slate-600">
                  {{ saveProgressDescription }}
                </p>
                <div
                  v-if="isSaveWorkflowBusy"
                  class="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-bold text-cyan-700"
                >
                  <span>{{ saveProgressActivityLabel }}</span>
                  <span class="font-medium text-cyan-600">{{ saveProgressElapsedLabel }}</span>
                </div>
              </div>
            </div>
            <div
              class="min-w-[200px] rounded-lg bg-white/80 p-3 ring-1"
              :class="isSaveWorkflowBusy ? 'ring-cyan-200 shadow-sm shadow-cyan-100' : 'ring-white'"
            >
              <div class="flex items-center justify-between text-[11px] font-bold uppercase text-slate-400">
                <span>{{ saveProgressActivityLabel }}</span>
                <span>{{ saveProgressCompletion }}%</span>
              </div>
              <div
                class="mt-2 h-2 overflow-hidden rounded-full bg-slate-100"
                role="progressbar"
                aria-label="クリップ保存の進捗"
                aria-valuemin="0"
                aria-valuemax="100"
                :aria-valuenow="saveProgressCompletion"
              >
                <div
                  class="h-full rounded-full bg-cyan-500 transition-all duration-500"
                  :class="isSaveWorkflowBusy ? 'animate-pulse' : ''"
                  :style="{ width: `${saveProgressCompletion}%` }"
                />
              </div>
              <p v-if="isSaveWorkflowBusy" class="mt-2 text-[11px] font-medium text-slate-500">
                {{ saveProgressElapsedLabel }}
              </p>
            </div>
          </div>
        </div>

        <div class="grid gap-5 2xl:grid-cols-[minmax(390px,0.78fr)_minmax(680px,1.22fr)]">
          <ol class="space-y-2">
            <li
              v-for="step in saveProgressSteps"
              :key="step.key"
              class="flex items-start gap-3 rounded-xl border bg-white px-3 py-3 transition"
              :class="step.status === 'active' ? 'border-cyan-300 bg-cyan-50/60 shadow-sm shadow-cyan-100' : step.status === 'done' ? 'border-emerald-100' : step.status === 'error' ? 'border-red-200 bg-red-50' : 'border-slate-200'"
            >
              <span
                class="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold"
                :class="step.status === 'done' ? 'bg-emerald-100 text-emerald-700' : step.status === 'active' ? 'bg-cyan-100 text-cyan-700' : step.status === 'error' ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-400'"
              >
                <UIcon
                  v-if="step.status === 'done'"
                  name="material-symbols:check-small"
                  class="h-5 w-5"
                />
                <UIcon
                  v-else-if="step.status === 'active'"
                  name="material-symbols:progress-activity"
                  class="h-5 w-5 animate-spin"
                />
                <UIcon
                  v-else-if="step.status === 'error'"
                  name="material-symbols:close-small"
                  class="h-5 w-5"
                />
                <span v-else>{{ step.index }}</span>
              </span>
              <div class="min-w-0 flex-1">
                <div class="flex items-center justify-between gap-3">
                  <p class="text-sm font-bold text-slate-900">
                    {{ step.label }}
                  </p>
                  <span
                    class="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold"
                    :class="step.status === 'done' ? 'bg-emerald-50 text-emerald-700' : step.status === 'active' ? 'bg-cyan-50 text-cyan-700' : step.status === 'error' ? 'bg-red-100 text-red-700' : 'bg-slate-50 text-slate-400'"
                  >
                    {{ step.statusLabel }}
                  </span>
                </div>
                <p class="mt-1 text-xs leading-relaxed text-slate-500">
                  {{ step.description }}
                </p>
              </div>
            </li>
          </ol>

          <div class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div class="flex items-start justify-between gap-3">
              <div class="flex items-start gap-3">
                <span class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-950 text-white">
                  <UIcon
                    :name="saveProgressPhase === 'done' ? 'material-symbols:check-circle-outline' : 'material-symbols:smart-toy-outline'"
                    class="h-5 w-5"
                  />
                </span>
                <div class="min-w-0">
                  <p class="text-sm font-bold text-slate-950">
                    {{ saveProgressInsight.heading }}
                  </p>
                  <p class="mt-1 text-xs leading-relaxed text-slate-500">
                    {{ saveProgressInsight.subheading }}
                  </p>
                </div>
              </div>
              <span class="inline-flex items-center gap-1.5 rounded-full bg-cyan-50 px-2.5 py-1 text-[11px] font-bold text-cyan-700">
                <UIcon
                  v-if="isSaveWorkflowBusy"
                  name="material-symbols:progress-activity"
                  class="h-3.5 w-3.5 animate-spin"
                />
                {{ saveProgressInsight.badge }}
              </span>
            </div>

            <div class="mt-4 grid gap-3 md:grid-cols-3">
              <div class="rounded-lg bg-slate-50 p-3">
                <p class="text-[11px] font-bold text-slate-400">スクリーンショット</p>
                <p class="mt-1 text-xl font-black text-slate-950">{{ frameCaptures.length }}</p>
              </div>
              <div class="rounded-lg bg-slate-50 p-3">
                <p class="text-[11px] font-bold text-slate-400">文字起こし</p>
                <p class="mt-1 text-xl font-black text-slate-950">{{ transcriptText.length }}</p>
              </div>
              <div class="rounded-lg bg-slate-50 p-3">
                <p class="text-[11px] font-bold text-slate-400">解析メモ</p>
                <p class="mt-1 text-xl font-black text-slate-950">{{ saveProgressInsight.noteCount }}</p>
              </div>
            </div>

            <div class="mt-4 space-y-3">
              <div class="rounded-lg border border-slate-200 p-3">
                <div class="mb-3 flex items-center justify-between">
                  <p class="text-xs font-bold text-slate-500">読み取り中の内容</p>
                  <UIcon
                    name="material-symbols:neurology-outline"
                    class="h-4 w-4 text-cyan-600"
                  />
                </div>
                <template v-if="saveProgressInsight.lines.length > 0">
                  <div class="space-y-2">
                    <p
                      v-for="line in saveProgressInsight.lines"
                      :key="line"
                      class="rounded-md bg-slate-50 px-3 py-2 text-xs leading-relaxed text-slate-700"
                    >
                      {{ line }}
                    </p>
                  </div>
                </template>
                <template v-else>
                  <div class="space-y-2">
                    <div class="h-3 w-11/12 animate-pulse rounded-full bg-slate-100" />
                    <div class="h-3 w-8/12 animate-pulse rounded-full bg-slate-100" />
                    <div class="h-3 w-10/12 animate-pulse rounded-full bg-slate-100" />
                  </div>
                </template>
              </div>

              <div class="grid gap-3 xl:grid-cols-[1fr_1.1fr]">
                <div class="rounded-lg border border-slate-200 p-3">
                  <p class="mb-3 text-xs font-bold text-slate-500">画面の根拠</p>
                  <div
                    v-if="saveProgressFramePreview.length > 0"
                    class="grid grid-cols-3 gap-2"
                  >
                    <img
                      v-for="frame in saveProgressFramePreview"
                      :key="frame.id"
                      :src="frame.previewUrl"
                      class="aspect-video rounded-md object-cover ring-1 ring-slate-200"
                      :alt="`${Math.round(frame.timestampMs / 1000)}秒のスクリーンショット`"
                    >
                  </div>
                  <div
                    v-else
                    class="grid grid-cols-3 gap-2"
                  >
                    <div
                      v-for="i in 6"
                      :key="`frame-skeleton-${i}`"
                      class="aspect-video animate-pulse rounded-md bg-slate-100"
                    />
                  </div>
                </div>

                <div class="rounded-lg border border-slate-200 p-3">
                  <p class="mb-3 text-xs font-bold text-slate-500">作成中のメモ</p>
                  <div class="space-y-2">
                    <div
                      v-for="item in saveProgressInsight.artifacts"
                      :key="item.label"
                      class="flex items-start gap-2 rounded-md bg-slate-50 p-2"
                    >
                      <UIcon
                        :name="item.icon"
                        class="mt-0.5 h-4 w-4 shrink-0 text-cyan-600"
                      />
                      <div class="min-w-0">
                        <p class="text-[11px] font-bold text-slate-500">{{ item.label }}</p>
                        <p class="mt-0.5 line-clamp-2 text-xs leading-relaxed text-slate-700">{{ item.value }}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div
          v-if="saveProgressPhase === 'error' || saveProgressPhase === 'done'"
          class="flex justify-end"
        >
          <EnButton
            variant="outline"
            color="neutral"
            size="sm"
            @click="saveProgressOpen = false"
          >
            {{ saveProgressPhase === 'done' ? '完了して閉じる' : '閉じる' }}
          </EnButton>
        </div>
      </div>
    </EnModal>

    <EnModal
      v-model:open="quickScanPreviewOpen"
      title="クリップ解析メモ"
      subtitle="タイトル、説明、操作ステップ、文字起こしをまとめて確認します。"
      title-icon="material-symbols:fact-check-outline"
      size="full"
      :ui="{ content: 'w-[88vw] max-w-[1360px]' }"
    >
      <div
        v-if="quickScanPreviewVideo"
        class="space-y-5"
      >
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div class="min-w-0">
            <p class="text-xs font-semibold uppercase tracking-wide text-slate-400">
              {{ formatRecordedAt(quickScanPreviewVideo.recordedAt) }}
            </p>
            <h3 class="mt-1 text-lg font-semibold text-slate-950">
              {{ displayVideoTitle(quickScanPreviewVideo) }}
            </h3>
            <p
              v-if="displayVideoDescription(quickScanPreviewVideo)"
              class="mt-2 max-w-3xl text-sm leading-relaxed text-slate-600"
            >
              {{ displayVideoDescription(quickScanPreviewVideo) }}
            </p>
          </div>
          <EnBadge color="neutral" variant="soft">
            {{ quickScanProviderLabel(quickScanPreviewVideo) }}
          </EnBadge>
        </div>

        <div
          v-if="richTranscriptSummarySections(quickScanPreviewVideo).length > 0"
          class="rounded-xl border border-slate-200 bg-slate-50/70 p-4"
        >
          <div class="mb-3 flex items-center justify-between gap-2">
            <div>
              <p class="text-xs font-semibold uppercase tracking-wide text-slate-500">
                文字起こし要約
              </p>
              <p class="mt-1 text-xs text-slate-600">
                音声から読み取れた意図と期待結果を整理しています。
              </p>
            </div>
            <EnBadge color="success" variant="soft">
              {{ quickScanPreviewVideo.transcriptProvider || "gemini-stt" }}
            </EnBadge>
          </div>
          <div class="grid gap-3 md:grid-cols-2">
            <div
              v-for="section in richTranscriptSummarySections(quickScanPreviewVideo)"
              :key="`${quickScanPreviewVideo.id}-summary-${section.title}`"
              class="rounded-lg border border-slate-200 bg-white p-3"
            >
              <p class="text-xs font-semibold text-slate-700">
                {{ section.title }}
              </p>
              <p class="mt-1 whitespace-pre-line text-sm leading-relaxed text-slate-700">
                {{ section.body }}
              </p>
            </div>
          </div>
        </div>

        <div
          v-if="operationSteps(quickScanPreviewVideo).length > 0"
          class="rounded-xl border border-slate-200 bg-white p-4"
        >
          <p class="text-xs font-semibold uppercase tracking-wide text-slate-400">
            操作ステップ
          </p>
          <ol class="mt-3 grid gap-2 md:grid-cols-2">
            <li
              v-for="(step, index) in operationSteps(quickScanPreviewVideo)"
              :key="`${quickScanPreviewVideo.id}-modal-step-${index}`"
              class="flex gap-3 rounded-lg bg-slate-50 p-3 text-sm leading-relaxed text-slate-700"
            >
              <span class="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-700">
                {{ index + 1 }}
              </span>
              <span>{{ step }}</span>
            </li>
          </ol>
        </div>

        <details
          v-if="transcriptSummaryText(quickScanPreviewVideo)"
          class="rounded-xl border border-slate-200 bg-white p-4"
        >
          <summary class="cursor-pointer text-sm font-semibold text-slate-800">
            文字起こし要約の原文
          </summary>
          <p class="mt-3 whitespace-pre-line rounded-lg bg-slate-50 p-3 text-xs leading-relaxed text-slate-600">
            {{ transcriptSummaryText(quickScanPreviewVideo) }}
          </p>
        </details>

        <details
          v-if="hasTranscriptContent(quickScanPreviewVideo)"
          class="rounded-xl border border-slate-200 bg-white p-4"
        >
          <summary class="cursor-pointer text-sm font-semibold text-slate-800">
            Gemini文字起こし全文
          </summary>
          <div
            v-if="transcriptCueRows(quickScanPreviewVideo).length > 0"
            class="mt-3 max-h-80 space-y-2 overflow-auto rounded-lg bg-slate-50 p-3"
          >
            <div
              v-for="cue in transcriptCueRows(quickScanPreviewVideo)"
              :key="`${quickScanPreviewVideo.id}-preview-${cue.id}`"
              class="grid grid-cols-[72px_minmax(0,1fr)] gap-2 rounded-lg bg-white px-2 py-1.5 text-xs"
            >
              <span class="font-mono font-semibold text-teal-700">
                {{ formatTranscriptCueTime(cue.startMs) }}
              </span>
              <span class="leading-relaxed text-slate-600">{{ cue.text }}</span>
            </div>
          </div>
          <p
            v-else
            class="mt-3 max-h-80 overflow-auto whitespace-pre-line rounded-lg bg-slate-50 p-3 text-xs leading-relaxed text-slate-600"
          >
            {{ quickScanPreviewVideo.transcriptText }}
          </p>
        </details>

        <EnAlert
          v-if="quickScanPreviewVideo.quickScan?.errorMessage"
          color="warning"
          :title="quickScanPreviewVideo.quickScan.errorMessage"
        />
      </div>
    </EnModal>

    <EnModal
      v-model:open="deleteVideoConfirmOpen"
      title="クリップを削除しますか?"
      subtitle="クリップ、スクリーンショット、検索用メタデータを削除します。"
      header-variant="warning"
      title-icon="material-symbols:delete-outline"
      size="md"
    >
      <div
        v-if="deleteTargetVideo"
        class="space-y-3"
      >
        <div class="rounded-lg border border-red-100 bg-red-50 p-3">
          <p class="text-sm font-semibold text-slate-900">
            {{ displayVideoTitle(deleteTargetVideo) }}
          </p>
          <p class="mt-1 text-xs text-slate-600">
            {{ formatRecordedAt(deleteTargetVideo.recordedAt) }} / {{ formatDuration(deleteTargetVideo.durationMs) }}
          </p>
        </div>
        <p class="text-xs leading-relaxed text-slate-500">
          削除後は一覧から消えます。必要であれば、再度録画してください。
        </p>
      </div>
      <template #footer>
        <EnButton
          variant="ghost"
          color="neutral"
          size="sm"
          @click="deleteVideoConfirmOpen = false"
        >
          キャンセル
        </EnButton>
        <EnButton
          variant="soft"
          color="error"
          size="sm"
          leading-icon="material-symbols:delete-outline"
          @click="deleteConfirmedVideo"
        >
          削除
        </EnButton>
      </template>
    </EnModal>

    <EnModal
      v-model:open="deleteClipConfirmOpen"
      title="クリップを削除しますか?"
      subtitle="選択したクリップとスクリーンショットを削除します。"
      header-variant="warning"
      title-icon="material-symbols:delete-outline"
      size="md"
    >
      <div
        v-if="deleteTargetClip"
        class="space-y-3"
      >
        <div class="rounded-lg border border-red-100 bg-red-50 p-3">
          <p class="text-sm font-semibold text-slate-900">
            {{ clipTitle(deleteTargetClip.clip, deleteTargetClip.index) }}
          </p>
          <p class="mt-1 text-xs text-slate-600">
            {{ formatRecordedAt(deleteTargetClip.clip.recordedAt) }} / {{ formatDuration(deleteTargetClip.clip.durationMs) }} / {{ formatBytes(deleteTargetClip.clip.sizeBytes) }}
          </p>
        </div>
        <p class="text-xs leading-relaxed text-slate-500">
          このクリップと保存済みのスクリーンショットは元に戻せません。
        </p>
      </div>
      <template #footer>
        <EnButton
          variant="ghost"
          color="neutral"
          size="sm"
          @click="deleteClipConfirmOpen = false"
        >
          キャンセル
        </EnButton>
        <EnButton
          variant="soft"
          color="error"
          size="sm"
          leading-icon="material-symbols:delete-outline"
          @click="deleteConfirmedClip"
        >
          削除
        </EnButton>
      </template>
    </EnModal>

    <Teleport to="body">
      <div
        v-if="contextMapOpen && contextMapVideo"
        class="fixed inset-0 z-[260] bg-slate-950/70 p-4 backdrop-blur-md"
        @click.self="closeContextMap"
      >
        <section class="mx-auto flex h-[calc(100vh-2rem)] max-w-[min(1720px,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border border-white/20 bg-white shadow-2xl">
          <header class="flex shrink-0 flex-wrap items-center justify-between gap-4 border-b border-slate-200 bg-slate-950 px-6 py-5 text-white">
            <div class="min-w-0">
              <div class="flex flex-wrap items-center gap-2">
                <span class="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-400/15 text-cyan-200 ring-1 ring-cyan-300/25">
                  <UIcon
                    name="material-symbols:hub-outline"
                    class="h-5 w-5"
                  />
                </span>
                <p class="text-xs font-black uppercase tracking-[0.2em] text-cyan-200">
                  コンテキストマップ
                </p>
              </div>
              <h2 class="mt-3 truncate text-2xl font-black tracking-normal text-white">
                {{ displayVideoTitle(contextMapVideo) }}
              </h2>
              <p class="mt-1 max-w-3xl text-sm leading-relaxed text-slate-300">
                クリップから生まれた文字起こし、画面証跡、ユーザーストーリー、関連ナレッジをひとつの構造として表示します。
              </p>
            </div>
            <div class="flex items-center gap-2">
              <div
                v-for="stat in contextMapHeroStats"
                :key="stat.label"
                class="inline-flex min-h-12 items-center gap-2 rounded-xl bg-white/10 px-3 py-2 ring-1 ring-white/10"
              >
                <span
                  class="h-2.5 w-2.5 shrink-0 rounded-full"
                  :class="stat.dotClass"
                />
                <span class="text-[11px] font-black tracking-normal text-slate-300">
                  {{ stat.label }}
                </span>
                <span class="text-lg font-black leading-none text-white">
                  {{ stat.value }}
                </span>
              </div>
              <button
                type="button"
                class="ml-2 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 text-slate-200 transition hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-cyan-300"
                aria-label="コンテキストマップを閉じる"
                @click="closeContextMap"
              >
                <UIcon
                  name="material-symbols:close-rounded"
                  class="h-5 w-5"
                />
              </button>
            </div>
          </header>

          <div class="grid min-h-0 flex-1 grid-cols-1 bg-slate-100 lg:grid-cols-[minmax(0,1fr)_390px]">
            <div
              ref="contextMapGraphSurface"
              class="relative min-h-[580px] overflow-hidden bg-slate-950"
              @click="clearContextMapSelection"
              @wheel="handleContextMapWheel"
            >
              <div class="absolute inset-0 opacity-70 [background-image:linear-gradient(rgba(148,163,184,0.13)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.13)_1px,transparent_1px)] [background-size:38px_38px]" />
              <div class="absolute inset-0 bg-[radial-gradient(circle_at_50%_45%,rgba(34,211,238,0.22),transparent_34%),radial-gradient(circle_at_78%_18%,rgba(16,185,129,0.16),transparent_26%),radial-gradient(circle_at_18%_82%,rgba(251,191,36,0.12),transparent_24%)]" />
              <div
                class="absolute left-5 right-5 top-5 z-20 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-xs text-slate-300 shadow-xl backdrop-blur"
                @click.stop
              >
                <div class="flex flex-wrap gap-2">
                  <span
                    v-for="legend in contextMapLegend"
                    :key="legend.label"
                    class="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 font-bold"
                  >
                    <span
                      class="h-2 w-2 rounded-full"
                      :class="legend.dotClass"
                    />
                    {{ legend.label }}
                  </span>
                </div>
                <div class="flex items-center gap-2">
                  <button
                    type="button"
                    class="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-white/10 text-slate-200 transition hover:bg-white/20"
                    aria-label="縮小"
                    @click.stop="zoomContextMap(-0.12)"
                  >
                    <UIcon
                      name="material-symbols:zoom-out"
                      class="h-4 w-4"
                    />
                  </button>
                  <span class="min-w-[3.5rem] text-center font-black text-white">
                    {{ Math.round(contextMapZoom * 100) }}%
                  </span>
                  <button
                    type="button"
                    class="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-white/10 text-slate-200 transition hover:bg-white/20"
                    aria-label="拡大"
                    @click.stop="zoomContextMap(0.12)"
                  >
                    <UIcon
                      name="material-symbols:zoom-in"
                      class="h-4 w-4"
                    />
                  </button>
                  <button
                    type="button"
                    class="inline-flex h-8 items-center gap-1 rounded-lg bg-white/10 px-2 text-slate-200 transition hover:bg-white/20"
                    @click.stop="resetContextMapView"
                  >
                    <UIcon
                      name="material-symbols:center-focus-strong-outline"
                      class="h-4 w-4"
                    />
                    <span class="text-[11px] font-bold">リセット</span>
                  </button>
                </div>
              </div>

              <div
                class="absolute inset-0 transition-transform duration-200"
                :style="{ transform: `scale(${contextMapZoom})`, transformOrigin: '50% 50%' }"
              >
                <svg
                  class="pointer-events-none absolute inset-0 h-full w-full"
                  viewBox="0 0 100 100"
                  preserveAspectRatio="none"
                >
                  <line
                    v-for="edge in contextMapEdgesWithPoints"
                    :key="edge.id"
                    :x1="edge.x1"
                    :y1="edge.y1"
                    :x2="edge.x2"
                    :y2="edge.y2"
                    stroke="currentColor"
                    :stroke-width="contextMapEdgeIsActive(edge) ? 0.5 : 0.22"
                    stroke-linecap="round"
                    :class="contextMapEdgeClass(edge)"
                  />
                </svg>

                <button
                  v-for="node in contextMapData.nodes"
                  :key="node.id"
                  type="button"
                  class="absolute w-[min(190px,16vw)] min-w-[140px] -translate-x-1/2 -translate-y-1/2 cursor-grab rounded-2xl border p-3 text-left shadow-2xl transition duration-200 hover:scale-[1.02] active:cursor-grabbing focus:outline-none focus:ring-2 focus:ring-cyan-300"
                  :class="[
                    contextMapNodeClass(node),
                    contextMapNodeIsActive(node) ? '' : 'opacity-35 grayscale',
                    selectedContextMapNode?.id === node.id ? 'z-10 ring-2 ring-cyan-300 ring-offset-2 ring-offset-slate-950' : ''
                  ]"
                  :style="{ left: `${node.x}%`, top: `${node.y}%` }"
                  @pointerdown.stop="startContextMapNodeDrag($event, node)"
                  @click.stop="selectContextMapNode(node)"
                >
                  <span class="flex items-start gap-3">
                    <span
                      class="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                      :class="contextMapNodeIconClass(node)"
                    >
                      <UIcon
                        :name="node.icon"
                        class="h-5 w-5"
                      />
                    </span>
                    <span class="min-w-0">
                      <span class="block text-[10px] font-black uppercase tracking-[0.14em] opacity-70">
                        {{ node.label }}
                      </span>
                      <span class="mt-1 line-clamp-2 block text-sm font-black leading-snug tracking-normal">
                        {{ node.title }}
                      </span>
                      <span class="mt-1 line-clamp-2 block text-xs leading-relaxed opacity-75">
                        {{ node.subtitle }}
                      </span>
                    </span>
                  </span>
                  <span class="mt-3 inline-flex rounded-full bg-white/75 px-2 py-1 text-[11px] font-black text-slate-800">
                    {{ node.value }}
                  </span>
                </button>
              </div>

              <div
                class="absolute bottom-5 left-5 right-5 z-20 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-xs text-slate-300 shadow-xl backdrop-blur"
                @click.stop
              >
                <p class="font-bold">
                  ノードをドラッグして配置を調整できます。command + スクロールで拡大縮小します。
                </p>
              </div>
            </div>

            <aside class="min-h-0 overflow-y-auto border-l border-slate-200 bg-white">
              <div
                v-if="selectedContextMapNode"
                class="space-y-4 p-5"
              >
                <div class="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div class="flex items-start gap-3">
                    <span
                      class="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
                      :class="contextMapNodeIconClass(selectedContextMapNode)"
                    >
                      <UIcon
                        :name="selectedContextMapNode.icon"
                        class="h-5 w-5"
                      />
                    </span>
                    <div class="min-w-0">
                      <p class="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">
                        {{ selectedContextMapNode.label }}
                      </p>
                      <h3 class="mt-1 text-xl font-black leading-snug tracking-normal text-slate-950">
                        {{ selectedContextMapNode.title }}
                      </h3>
                      <p class="mt-1 text-sm leading-relaxed text-slate-600">
                        {{ selectedContextMapNode.subtitle }}
                      </p>
                    </div>
                  </div>
                  <div class="mt-4 rounded-xl bg-white px-3 py-2 text-sm font-black text-slate-900 ring-1 ring-slate-200">
                    {{ selectedContextMapNode.value }}
                  </div>
                </div>

                <div class="rounded-2xl border border-slate-200 bg-white p-4">
                  <p class="text-xs font-black uppercase tracking-[0.16em] text-slate-500">
                    読み取れる内容
                  </p>
                  <div class="mt-3 space-y-2">
                    <div
                      v-for="detail in selectedContextMapNode.details"
                      :key="detail"
                      class="rounded-xl bg-slate-50 px-3 py-2 text-sm leading-relaxed text-slate-700 ring-1 ring-slate-100"
                    >
                      {{ detail }}
                    </div>
                  </div>
                </div>

                <div class="rounded-2xl border border-slate-200 bg-white p-4">
                  <p class="text-xs font-black uppercase tracking-[0.16em] text-slate-500">
                    周辺ノード
                  </p>
                  <div class="mt-3 grid gap-2">
                    <button
                      v-for="neighbor in selectedContextMapNeighbors"
                      :key="neighbor.id"
                      type="button"
                      class="flex items-center gap-3 rounded-xl border border-slate-200 px-3 py-2 text-left transition hover:border-cyan-200 hover:bg-cyan-50/70"
                      @click="selectedContextMapNodeId = neighbor.id"
                    >
                      <UIcon
                        :name="neighbor.icon"
                        class="h-4 w-4 shrink-0 text-cyan-600"
                      />
                      <span class="min-w-0">
                        <span class="block truncate text-sm font-black text-slate-900">
                          {{ neighbor.title }}
                        </span>
                        <span class="block truncate text-xs text-slate-500">
                          {{ neighbor.label }}
                        </span>
                      </span>
                    </button>
                  </div>
                </div>
              </div>
              <div
                v-else
                class="space-y-4 p-5"
              >
                <div class="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div class="flex items-start gap-3">
                    <span class="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-cyan-500 text-white">
                      <UIcon
                        name="material-symbols:hub-outline"
                        class="h-5 w-5"
                      />
                    </span>
                    <div class="min-w-0">
                      <p class="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">
                        全体表示
                      </p>
                      <h3 class="mt-1 text-xl font-black leading-snug tracking-normal text-slate-950">
                        コンテキスト全体
                      </h3>
                      <p class="mt-1 text-sm leading-relaxed text-slate-600">
                        すべてのノードと接続を表示しています。ノードを選択すると、右側に紐づく情報だけを絞り込みます。
                      </p>
                    </div>
                  </div>
                </div>
                <div class="rounded-2xl border border-slate-200 bg-white p-4">
                  <p class="text-xs font-black uppercase tracking-[0.16em] text-slate-500">
                    ノード一覧
                  </p>
                  <div class="mt-3 grid gap-2">
                    <button
                      v-for="node in contextMapData.nodes"
                      :key="node.id"
                      type="button"
                      class="flex items-center gap-3 rounded-xl border border-slate-200 px-3 py-2 text-left transition hover:border-cyan-200 hover:bg-cyan-50/70"
                      @click="selectedContextMapNodeId = node.id"
                    >
                      <UIcon
                        :name="node.icon"
                        class="h-4 w-4 shrink-0 text-cyan-600"
                      />
                      <span class="min-w-0">
                        <span class="block truncate text-sm font-black text-slate-900">
                          {{ node.title }}
                        </span>
                        <span class="block truncate text-xs text-slate-500">
                          {{ node.label }} / {{ node.value }}
                        </span>
                      </span>
                    </button>
                  </div>
                </div>
              </div>
            </aside>
          </div>
        </section>
      </div>
    </Teleport>

    <div
      v-if="detailVideo"
      class="pt-1"
    >
      <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div class="flex min-w-0 flex-1 flex-wrap items-center gap-2">
          <EnButton
            variant="ghost"
            color="neutral"
            size="xs"
            leading-icon="material-symbols:arrow-back"
            @click="detailVideoId = ''"
          >
            一覧へ戻る
          </EnButton>
          <span class="inline-flex shrink-0 items-center rounded-md bg-slate-950 px-2 py-1 text-xs font-semibold text-white">
            {{ videoDisplayId(detailVideo) }}
          </span>
          <p class="min-w-0 max-w-[320px] truncate text-2xl font-black leading-tight tracking-normal text-slate-950">
            {{ videoGroupForVideo(detailVideo).name }}
          </p>
          <button
            v-if="videoGroupForVideo(detailVideo).id"
            type="button"
            class="inline-flex max-w-[220px] shrink-0 items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 font-mono text-[11px] font-bold text-slate-500 shadow-sm transition hover:border-cyan-200 hover:bg-cyan-50 hover:text-cyan-700 focus:outline-none focus:ring-2 focus:ring-cyan-100"
            :title="`グループIDをコピー: ${videoGroupForVideo(detailVideo).id}`"
            @click.stop="copyIdToClipboard(videoGroupForVideo(detailVideo).id, 'グループID')"
          >
            <UIcon name="material-symbols:content-copy-outline" class="h-3.5 w-3.5 shrink-0" />
            <span class="truncate">ID {{ compactId(videoGroupForVideo(detailVideo).id) }}</span>
          </button>
          <span class="shrink-0 text-sm font-semibold text-slate-400">
            / {{ detailVideoClips.length }} clips
          </span>
          <div
            ref="detailClipPickerRoot"
            class="relative min-w-[280px] max-w-full flex-1 sm:flex-none"
          >
            <button
              type="button"
              class="flex min-h-11 w-full min-w-0 items-center gap-3 rounded-xl border border-cyan-200 bg-white px-2.5 py-2 text-left shadow-sm transition hover:border-cyan-300 hover:bg-cyan-50/60 focus:outline-none focus:ring-2 focus:ring-cyan-100 sm:w-[min(520px,42vw)]"
              aria-haspopup="listbox"
              :aria-expanded="detailClipPickerOpen"
              @click="detailClipPickerOpen = !detailClipPickerOpen"
            >
              <span class="flex h-9 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-slate-950 text-white">
                <img
                  v-if="selectedDetailClip && clipThumbnailUrl(detailVideo, selectedDetailClip)"
                  :src="clipThumbnailUrl(detailVideo, selectedDetailClip)"
                  alt=""
                  class="h-full w-full object-cover"
                />
                <UIcon
                  v-else
                  :name="isAllClipsSelected ? 'material-symbols:grid-view-rounded' : 'material-symbols:movie-outline'"
                  class="h-5 w-5"
                />
              </span>
              <span class="min-w-0 flex-1">
                <span class="block truncate text-sm font-black text-slate-950">
                  {{ selectedDetailClipPickerTitle }}
                </span>
                <span class="block truncate text-xs font-semibold text-slate-500">
                  {{ selectedDetailClipPickerSummary }}
                </span>
              </span>
              <UIcon
                name="i-heroicons-chevron-down-20-solid"
                class="h-5 w-5 shrink-0 text-slate-400"
              />
            </button>
            <div
              v-if="detailClipPickerOpen"
              class="absolute left-0 top-full z-50 mt-2 max-h-[70vh] w-[min(560px,calc(100vw-48px))] overflow-y-auto rounded-2xl border border-slate-200 bg-white p-2 shadow-2xl"
              role="listbox"
              aria-label="フォーカス中のクリップ"
            >
              <button
                type="button"
                class="flex w-full items-center gap-3 rounded-xl border px-3 py-3 text-left transition"
                :class="isAllClipsSelected ? 'border-cyan-300 bg-cyan-50 shadow-sm' : 'border-transparent hover:bg-slate-50'"
                role="option"
                :aria-selected="isAllClipsSelected"
                @click="selectDetailClipFromPicker(ALL_CLIPS_SELECTION_ID)"
              >
                <span class="flex h-14 w-20 shrink-0 items-center justify-center rounded-xl bg-cyan-50 text-cyan-700 ring-1 ring-cyan-100">
                  <UIcon name="material-symbols:grid-view-rounded" class="h-6 w-6" />
                </span>
                <span class="min-w-0 flex-1">
                  <span class="block text-sm font-black text-slate-950">すべてのクリップ</span>
                  <span class="mt-0.5 block text-xs font-semibold text-slate-500">
                    {{ detailVideoClips.length }}本を横断して解析結果を表示します
                  </span>
                </span>
                <EnBadge color="primary" variant="soft">
                  All
                </EnBadge>
              </button>
              <div class="mt-2 space-y-1">
                <button
                  v-for="(clip, clipIndex) in detailVideoClips"
                  :key="`detail-clip-picker-${clip.id}`"
                  type="button"
                  class="flex w-full items-start gap-3 rounded-xl border px-3 py-3 text-left transition"
                  :class="selectedDetailClip?.id === clip.id ? 'border-cyan-300 bg-cyan-50 shadow-sm' : 'border-transparent hover:bg-slate-50'"
                  role="option"
                  :aria-selected="selectedDetailClip?.id === clip.id"
                  @click="selectDetailClipFromPicker(clip.id)"
                >
                  <span class="relative h-16 w-24 shrink-0 overflow-hidden rounded-xl bg-slate-950">
                    <img
                      v-if="clipThumbnailUrl(detailVideo, clip)"
                      :src="clipThumbnailUrl(detailVideo, clip)"
                      alt=""
                      class="h-full w-full object-cover"
                    />
                    <span
                      v-else
                      class="flex h-full w-full items-center justify-center text-white"
                    >
                      <UIcon name="material-symbols:movie-outline" class="h-6 w-6" />
                    </span>
                    <span class="absolute left-1.5 top-1.5 rounded bg-slate-950/85 px-1.5 py-0.5 text-[10px] font-black text-white">
                      {{ String(clipIndex + 1).padStart(2, "0") }}
                    </span>
                  </span>
                  <span class="min-w-0 flex-1">
                    <span class="block truncate text-sm font-black text-slate-950">
                      {{ clipTitle(clip, clipIndex) }}
                    </span>
                    <span class="mt-1 line-clamp-2 text-xs font-semibold leading-relaxed text-slate-600">
                      {{ clipSummaryText(clip, detailVideo) || "要約はまだ生成されていません" }}
                    </span>
                    <span class="mt-2 flex flex-wrap items-center gap-2 text-[11px] font-bold text-slate-400">
                      <span>{{ formatDuration(clip.durationMs) }}</span>
                      <span>{{ clip.frameCaptures.length }}枚</span>
                      <span>{{ formatRecordedAt(clip.recordedAt) }}</span>
                    </span>
                  </span>
                </button>
              </div>
            </div>
          </div>
          <button
            type="button"
            class="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 shadow-sm transition hover:border-cyan-200 hover:bg-cyan-50 hover:text-cyan-700 focus:outline-none focus:ring-2 focus:ring-cyan-100 disabled:cursor-not-allowed disabled:opacity-50"
            title="クリップを追加"
            :disabled="props.isSaving"
            @click="openAppendRecordingModal(detailVideo)"
          >
            <UIcon name="material-symbols:add-rounded" class="h-5 w-5" />
          </button>
          <StoryVaultAnalysisStatusTip
            v-if="detailVideo.analysisStatus !== 'completed'"
            :status="detailVideo.analysisStatus"
          />
          <button
            type="button"
            class="inline-flex min-h-10 shrink-0 items-center gap-2 rounded-xl bg-gradient-to-b from-blue-500 to-blue-700 px-4 py-2 text-sm font-black text-white shadow-[0_5px_0_#1d4ed8,0_14px_24px_rgba(37,99,235,0.28)] transition hover:-translate-y-0.5 hover:shadow-[0_6px_0_#1d4ed8,0_18px_28px_rgba(37,99,235,0.3)] active:translate-y-1 active:shadow-[0_2px_0_#1d4ed8,0_8px_16px_rgba(37,99,235,0.22)] focus:outline-none focus:ring-2 focus:ring-blue-200"
            @click="openContextMap(detailVideo)"
          >
            <UIcon name="material-symbols:hub-outline" class="h-5 w-5" />
            コンテキストマップ
          </button>
        </div>
        <div class="flex flex-wrap items-center gap-2">
          <EnButton
            v-if="detailVideo.analysisStatus !== 'completed' && !detailVideo.analysisResult"
            variant="ai"
            size="xs"
            leading-icon="material-symbols:psychology-outline"
            :loading="isAnalyzing && detailVideo.analysisStatus === 'running'"
            :disabled="!props.application?.fileSpaceId || detailVideo.analysisStatus === 'queued' || detailVideo.analysisStatus === 'running'"
            @click="emit('analyze', detailVideo.id)"
          >
            ユーザーストーリー解析
          </EnButton>
          <UDropdownMenu
            :items="detailMoreActionItems"
            :content="{ align: 'end', side: 'bottom' }"
            :ui="{ content: 'z-[80] min-w-[12rem]' }"
          >
            <button
              type="button"
              class="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-200"
              aria-label="その他の操作"
            >
              <UIcon name="i-heroicons-ellipsis-horizontal-20-solid" class="h-5 w-5" />
            </button>
          </UDropdownMenu>
        </div>
      </div>

      <div class="mb-5 rounded-xl border border-slate-200 bg-white p-1.5 shadow-sm">
        <div class="grid gap-1 sm:grid-cols-2 lg:grid-cols-7">
          <button
            type="button"
            class="flex min-h-[48px] items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition"
            :class="detailTab === 'video' ? 'bg-slate-950 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'"
            @click="detailTab = 'video'"
          >
            <UIcon name="material-symbols:play-circle-outline" class="h-5 w-5 shrink-0" />
            <span>クリップ</span>
            <span
              class="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold"
              :class="detailTab === 'video' ? 'bg-white/15 text-white' : 'bg-slate-100 text-slate-600'"
            >
              {{ videoDisplayId(detailVideo) }}
            </span>
          </button>
          <button
            type="button"
            class="flex min-h-[48px] items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition"
            :class="detailTab === 'videoAnalysis' ? 'bg-slate-950 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'"
            @click="detailTab = 'videoAnalysis'"
          >
            <UIcon
              :name="isVideoAnalysisCompleted(detailVideo) ? 'material-symbols:check-circle-outline' : 'material-symbols:auto-awesome-outline'"
              class="h-5 w-5 shrink-0"
            />
            <span>クリップ解析</span>
            <span
              class="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold"
              :class="detailTab === 'videoAnalysis' ? 'bg-white/15 text-white' : isVideoAnalysisCompleted(detailVideo) ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200' : 'bg-slate-100 text-slate-600'"
            >
              {{ videoAnalysisTabStatus(detailVideo) }}
            </span>
          </button>
          <button
            type="button"
            class="flex min-h-[48px] items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition"
            :class="detailTab === 'storyAnalysis' ? 'bg-slate-950 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'"
            @click="detailTab = 'storyAnalysis'"
          >
            <UIcon name="material-symbols:sticky-note-2-outline" class="h-5 w-5 shrink-0" />
            <span>ストーリー解析</span>
            <span
              class="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold"
              :class="detailTab === 'storyAnalysis' ? 'bg-white/15 text-white' : storyCandidateCount(detailVideo) > 0 ? 'bg-slate-100 text-slate-700' : 'bg-slate-100 text-slate-600'"
            >
              {{ storyCandidateCount(detailVideo) }}件
            </span>
          </button>
          <button
            type="button"
            class="flex min-h-[48px] items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition"
            :class="detailTab === 'videoGeneration' ? 'bg-slate-950 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'"
            @click="detailTab = 'videoGeneration'"
          >
            <UIcon name="material-symbols:movie-edit-outline" class="h-5 w-5 shrink-0" />
            <span>動画生成</span>
            <span
              class="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold"
              :class="detailTab === 'videoGeneration' ? 'bg-white/15 text-white' : 'bg-slate-100 text-slate-700'"
            >
              音声 / 字幕
            </span>
          </button>
          <button
            type="button"
            class="flex min-h-[48px] items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition"
            :class="detailTab === 'relatedContext' ? 'bg-slate-950 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'"
            @click="openRelatedContextTab"
          >
            <UIcon name="material-symbols:hub-outline" class="h-5 w-5 shrink-0" />
            <span>関連コンテキスト</span>
            <span
              class="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold"
              :class="detailTab === 'relatedContext' ? 'bg-white/15 text-white' : relatedContextCount(detailVideo) > 0 ? 'bg-slate-200 text-slate-800' : 'bg-slate-100 text-slate-600'"
            >
              {{ relatedContextCount(detailVideo) }}件
            </span>
          </button>
          <button
            type="button"
            class="flex min-h-[48px] items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition"
            :class="detailTab === 'report' ? 'bg-slate-950 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'"
            @click="detailTab = 'report'"
          >
            <UIcon name="material-symbols:preview-outline" class="h-5 w-5 shrink-0" />
            <span>レポート</span>
            <span
              class="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold"
              :class="detailTab === 'report' ? 'bg-white/15 text-white' : 'bg-slate-100 text-slate-700'"
            >
              HTML / MD
            </span>
          </button>
          <button
            type="button"
            class="flex min-h-[48px] items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition"
            :class="detailTab === 'mcpTest' ? 'bg-slate-950 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'"
            @click="detailTab = 'mcpTest'"
          >
            <UIcon name="material-symbols:terminal" class="h-5 w-5 shrink-0" />
            <span>MCPテスト</span>
            <span
              class="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold"
              :class="detailTab === 'mcpTest' ? 'bg-white/15 text-white' : 'bg-slate-100 text-slate-700'"
            >
              チャット
            </span>
          </button>
        </div>
      </div>

      <div
        v-if="detailTab === 'video'"
        class="space-y-4"
      >
          <section
            v-if="isAllClipsSelected"
            class="min-w-0 space-y-4"
          >
            <div class="rounded-2xl border border-cyan-100 bg-cyan-50 p-4 shadow-sm">
              <p class="text-xs font-bold uppercase tracking-wide text-cyan-700">
                すべてのクリップ
              </p>
              <h4 class="mt-1 text-xl font-black leading-tight text-slate-950">
                {{ selectedVideoGroup?.name || "クリップグループ" }} の横断ビュー
              </h4>
              <p class="mt-2 text-sm leading-relaxed text-slate-600">
                このグループに含まれるクリップを、クリップ名ごとに区切って表示しています。
              </p>
            </div>

            <article
              v-for="(clip, clipIndex) in detailVideoClips"
              :key="`all-${clip.id}`"
              class="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
            >
              <header class="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 p-4">
                <div class="min-w-0">
                  <p class="text-xs font-bold uppercase tracking-wide text-slate-500">
                    Clip {{ String(clipIndex + 1).padStart(2, "0") }}
                  </p>
                  <div class="mt-1">
                    <input
                      v-if="editingVideoTitleId === clip.id"
                      ref="videoTitleInput"
                      v-model="editingVideoTitleDraft"
                      class="w-full rounded-lg border border-slate-200 px-3 py-2 text-lg font-black text-slate-950 shadow-sm focus:border-cyan-400 focus:outline-none focus:ring-2 focus:ring-cyan-100"
                      :disabled="updatingVideoTitleId === clip.id"
                      @click.stop
                      @keydown.enter.prevent.stop="commitClipTitleEdit(clip, clipIndex)"
                      @keydown.esc.prevent.stop="cancelVideoTitleEdit"
                      @blur="commitClipTitleEdit(clip, clipIndex)"
                    >
                    <button
                      v-else
                      type="button"
                      class="rounded-lg px-1 py-0.5 text-left text-lg font-black text-slate-950 transition hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-200"
                      title="クリックして名称を変更"
                      @click.stop="startClipTitleEdit(clip, clipIndex)"
                    >
                      {{ clipTitle(clip, clipIndex) }}
                    </button>
                  </div>
                  <p class="mt-1 truncate text-xs font-semibold text-slate-500">
                    {{ clip.fileName }}
                  </p>
                </div>
                <div class="flex flex-wrap gap-2 text-xs font-bold text-slate-600">
                  <span class="rounded-lg bg-slate-50 px-3 py-2 ring-1 ring-slate-100">{{ formatDuration(clip.durationMs) }}</span>
                  <span class="rounded-lg bg-slate-50 px-3 py-2 ring-1 ring-slate-100">{{ clip.frameCaptures.length }}枚</span>
                  <span class="rounded-lg bg-slate-50 px-3 py-2 ring-1 ring-slate-100">{{ hasTranscriptContent(clip) ? "文字起こしあり" : "文字起こしなし" }}</span>
                </div>
              </header>
              <div class="grid gap-4 p-4 xl:grid-cols-[minmax(0,1fr)_360px]">
                <video
                  v-if="clipVideoUrl(detailVideo, clip)"
                  :src="clipVideoUrl(detailVideo, clip)"
                  controls
                  preload="metadata"
                  class="aspect-video w-full rounded-xl bg-slate-950"
                />
                <div
                  v-else
                  class="flex aspect-video w-full items-center justify-center rounded-xl bg-slate-950 text-xs font-semibold text-slate-300"
                >
                  クリップURLを取得中
                </div>
                <div class="min-w-0 rounded-xl border border-slate-100 bg-slate-50 p-3">
                  <p class="text-xs font-bold uppercase tracking-wide text-slate-500">概要</p>
                  <p class="mt-2 text-sm leading-relaxed text-slate-700">
                    {{ clipSummaryText(clip) || "未生成" }}
                  </p>
                  <div
                    v-if="transcriptCueRows(clip).length > 0"
                    class="mt-3 max-h-64 space-y-2 overflow-auto"
                  >
                    <div
                      v-for="cue in transcriptCueRows(clip).slice(0, 8)"
                      :key="`${clip.id}-all-${cue.id}`"
                      class="rounded-lg bg-white px-3 py-2 text-xs leading-5 text-slate-700"
                    >
                      <span class="font-mono font-bold text-cyan-700">{{ formatTranscriptTime(cue.startMs) }}</span>
                      <span class="ml-2">{{ cue.text }}</span>
                    </div>
                  </div>
                </div>
              </div>
            </article>
          </section>

          <section
            v-else-if="selectedDetailClip"
            class="min-w-0 space-y-4"
          >
            <div class="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <header class="border-b border-slate-100 bg-white p-4">
                <div class="flex flex-wrap items-start justify-between gap-4">
                  <div class="min-w-0 flex-1">
                    <p class="text-xs font-bold uppercase tracking-wide text-slate-500">
                      選択中のクリップ
                    </p>
                    <div class="mt-1">
                      <input
                        v-if="editingVideoTitleId === selectedDetailClip.id"
                        ref="videoTitleInput"
                        v-model="editingVideoTitleDraft"
                        class="w-full rounded-lg border border-slate-200 px-3 py-2 text-xl font-black leading-tight text-slate-950 shadow-sm focus:border-cyan-400 focus:outline-none focus:ring-2 focus:ring-cyan-100"
                        :disabled="updatingVideoTitleId === selectedDetailClip.id"
                        @click.stop
                        @keydown.enter.prevent.stop="commitClipTitleEdit(selectedDetailClip, selectedDetailClipIndex)"
                        @keydown.esc.prevent.stop="cancelVideoTitleEdit"
                        @blur="commitClipTitleEdit(selectedDetailClip, selectedDetailClipIndex)"
                      >
                      <button
                        v-else
                        type="button"
                        class="rounded-lg px-1 py-0.5 text-left text-xl font-black leading-tight text-slate-950 transition hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-200"
                        title="クリックして名称を変更"
                        @click.stop="startClipTitleEdit(selectedDetailClip, selectedDetailClipIndex)"
                      >
                        {{ clipTitle(selectedDetailClip, selectedDetailClipIndex) }}
                      </button>
                    </div>
                    <p class="mt-1 truncate text-xs font-semibold text-slate-500">
                      {{ selectedDetailClip.fileName }}
                    </p>
                    <div class="mt-3 flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        class="inline-flex max-w-full items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 font-mono text-xs font-bold text-slate-500 shadow-sm transition hover:border-cyan-200 hover:bg-cyan-50 hover:text-cyan-700 focus:outline-none focus:ring-2 focus:ring-cyan-100"
                        :title="`クリップIDをコピー: ${selectedDetailClip.id}`"
                        @click.stop="copyIdToClipboard(selectedDetailClip.id, 'クリップID')"
                      >
                        <UIcon name="material-symbols:content-copy-outline" class="h-4 w-4 shrink-0" />
                        <span class="truncate">Clip ID {{ compactId(selectedDetailClip.id) }}</span>
                      </button>
                      <EnButton
                        variant="outline"
                        color="neutral"
                        size="xs"
                        leading-icon="material-symbols:download-rounded"
                        :loading="downloadingClipKey === clipKey(detailVideo.id, selectedDetailClip.id)"
                        :disabled="!selectedDetailClip.bucketName || !selectedDetailClip.storagePath"
                        @click="downloadOperationVideoClip(detailVideo, selectedDetailClip)"
                      >
                        元クリップをダウンロード
                      </EnButton>
                    </div>
                  </div>
                  <dl class="grid w-full grid-cols-2 gap-2 text-xs sm:w-auto sm:min-w-[360px] sm:grid-cols-4">
                    <div class="rounded-lg bg-slate-50 px-3 py-2 ring-1 ring-slate-100">
                      <dt class="font-semibold text-slate-500">時間</dt>
                      <dd class="mt-1 font-bold text-slate-900">{{ formatDuration(selectedDetailClip.durationMs) }}</dd>
                    </div>
                    <div class="rounded-lg bg-slate-50 px-3 py-2 ring-1 ring-slate-100">
                      <dt class="font-semibold text-slate-500">スクショ</dt>
                      <dd class="mt-1 font-bold text-slate-900">{{ selectedDetailClip.frameCaptures.length }}枚</dd>
                    </div>
                    <div class="rounded-lg bg-slate-50 px-3 py-2 ring-1 ring-slate-100">
                      <dt class="font-semibold text-slate-500">文字起こし</dt>
                      <dd class="mt-1 font-bold text-slate-900">{{ hasTranscriptContent(selectedDetailClip) ? "あり" : "なし" }}</dd>
                    </div>
                    <div class="rounded-lg bg-slate-50 px-3 py-2 ring-1 ring-slate-100">
                      <dt class="font-semibold text-slate-500">サイズ</dt>
                      <dd class="mt-1 font-bold text-slate-900">{{ formatBytes(selectedDetailClip.sizeBytes) }}</dd>
                    </div>
                  </dl>
                </div>
                <div class="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <p class="text-xs font-bold uppercase tracking-wide text-slate-500">
                    概要
                  </p>
                  <p class="mt-2 text-sm leading-relaxed text-slate-800">
                    {{ clipSummaryText(selectedDetailClip, detailVideo) || "未生成" }}
                  </p>
                </div>
              </header>

              <div class="bg-slate-950 p-3">
                <div class="mb-3 flex flex-wrap items-center justify-end gap-3">
                  <div class="flex items-center gap-2">
                    <span class="text-xs font-bold text-slate-400">表示</span>
                    <div class="flex rounded-xl bg-white/10 p-1">
                      <button
                        v-for="mode in selectedClipLayoutModes"
                        :key="mode.value"
                        type="button"
                        class="rounded-lg px-3 py-1.5 text-xs font-bold transition"
                        :class="selectedClipLayoutMode === mode.value ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-300 hover:bg-white/10 hover:text-white'"
                        @click="selectedClipLayoutMode = mode.value"
                      >
                        {{ mode.label }}
                      </button>
                    </div>
                  </div>
                  <div class="flex items-center gap-2">
                    <span class="text-xs font-bold text-slate-400">再生速度</span>
                    <div class="flex rounded-xl bg-white/10 p-1">
                      <button
                        v-for="rate in selectedClipPlaybackRates"
                        :key="rate.value"
                        type="button"
                        class="rounded-lg px-3 py-1.5 text-xs font-bold transition"
                        :class="selectedClipPlaybackRate === rate.value ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-300 hover:bg-white/10 hover:text-white'"
                        @click="setSelectedClipPlaybackRate(rate.value)"
                      >
                        {{ rate.label }}
                      </button>
                    </div>
                  </div>
                </div>
                <div
                  class="grid gap-3"
                  :class="selectedClipLayoutMode === 'split' ? 'xl:grid-cols-[minmax(0,1fr)_430px] 2xl:grid-cols-[minmax(0,1fr)_500px]' : 'grid-cols-1'"
                >
                  <div class="min-w-0">
                    <video
                      v-if="clipVideoUrl(detailVideo, selectedDetailClip)"
                      ref="selectedClipVideo"
                      :src="clipVideoUrl(detailVideo, selectedDetailClip)"
                      controls
                      preload="metadata"
                      class="aspect-video w-full rounded-xl bg-slate-950"
                      @timeupdate="updateSelectedClipPlaybackTime"
                      @seeked="updateSelectedClipPlaybackTime"
                      @loadedmetadata="handleSelectedClipVideoLoadedMetadata"
                    />
                    <div
                      v-else
                      class="flex aspect-video w-full items-center justify-center rounded-xl bg-slate-950 text-xs font-semibold text-slate-300"
                    >
                      クリップURLを取得中
                    </div>
                  </div>

                  <div
                    class="min-w-0 rounded-2xl bg-white p-4"
                    :class="selectedClipLayoutMode === 'split' ? 'xl:max-h-[calc(100vh-360px)] xl:min-h-[420px] xl:overflow-hidden' : ''"
                  >
                    <div class="mb-3 flex flex-wrap items-center justify-between gap-2">
                      <div class="flex rounded-xl bg-slate-100 p-1">
                    <button
                      type="button"
                      class="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-bold transition"
                      :class="selectedClipContentTab === 'transcript' ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-500 hover:text-slate-950'"
                      @click="selectedClipContentTab = 'transcript'"
                    >
                      <UIcon name="material-symbols:subtitles-outline" class="h-4 w-4" />
                      字幕一覧
                    </button>
                    <button
                      type="button"
                      class="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-bold transition"
                      :class="selectedClipContentTab === 'summary' ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-500 hover:text-slate-950'"
                      @click="selectedClipContentTab = 'summary'"
                    >
                      <UIcon name="material-symbols:summarize-outline" class="h-4 w-4" />
                      要約
                    </button>
                  </div>
                  <EnBadge
                    v-if="selectedClipContentTab === 'transcript'"
                    color="neutral"
                    variant="soft"
                  >
                    {{ transcriptProviderBadge(selectedDetailClip) }}
                  </EnBadge>
                </div>
                    <div v-if="selectedClipContentTab === 'transcript'">
                      <div
                        v-if="transcriptCueRows(selectedDetailClip).length > 0"
                        ref="selectedClipTranscriptScroller"
                        class="space-y-2 overflow-auto rounded-2xl border border-slate-100 bg-slate-50 p-3"
                        :class="selectedClipLayoutMode === 'split' ? 'max-h-[calc(100vh-450px)] min-h-[340px]' : 'max-h-[520px] min-h-[320px]'"
                      >
                        <button
                          v-for="cue in transcriptCueRows(selectedDetailClip)"
                          :key="`${selectedDetailClip.id}-${cue.id}`"
                          :ref="(element: Element | ComponentPublicInstance | null) => setSelectedClipTranscriptCueElement(cue.id, element)"
                          type="button"
                          class="grid w-full grid-cols-[82px_minmax(0,1fr)] gap-3 rounded-xl border px-3 py-2 text-left text-sm transition focus:outline-none focus:ring-2 focus:ring-teal-200"
                          :class="activeSelectedClipCueId === cue.id ? 'border-teal-300 bg-teal-50 shadow-sm ring-1 ring-teal-100' : 'border-transparent bg-white hover:border-teal-200 hover:bg-teal-50'"
                          @click="seekSelectedClipTo(cue.startMs)"
                        >
                          <span
                            class="font-mono text-xs font-bold"
                            :class="activeSelectedClipCueId === cue.id ? 'text-teal-800' : 'text-teal-700'"
                          >
                            {{ formatTranscriptCueTime(cue.startMs) }}
                          </span>
                          <span
                            class="leading-6"
                            :class="activeSelectedClipCueId === cue.id ? 'font-semibold text-slate-950' : 'text-slate-700'"
                          >{{ cue.text }}</span>
                        </button>
                      </div>
                      <p
                        v-else
                        class="overflow-auto whitespace-pre-line rounded-2xl border border-slate-100 bg-slate-50 p-4 text-sm leading-7 text-slate-700"
                        :class="selectedClipLayoutMode === 'split' ? 'max-h-[calc(100vh-450px)] min-h-[340px]' : 'max-h-[520px] min-h-[320px]'"
                      >
                        {{ selectedDetailClip.transcriptText }}
                      </p>
                    </div>
                    <div
                      v-else
                      class="overflow-auto rounded-2xl border border-slate-100 bg-slate-50 p-4"
                      :class="selectedClipLayoutMode === 'split' ? 'max-h-[calc(100vh-450px)] min-h-[340px]' : ''"
                    >
                      <EnMarkdown
                        class="text-sm leading-relaxed text-slate-800"
                        :markdown-text="selectedClipSummaryMarkdown(selectedDetailClip, detailVideo)"
                        variant="analysis"
                        compact
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div
              v-if="selectedDetailClip.frameCaptures.length > 0"
              class="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
            >
              <div class="mb-2 flex items-center justify-between gap-2">
                <h4 class="flex items-center gap-2 text-base font-bold text-slate-950">
                  <UIcon name="material-symbols:photo-library-outline" class="h-4 w-4 text-slate-500" />
                  選択クリップのスクリーンショット
                </h4>
                <EnBadge color="neutral" variant="soft">
                  {{ selectedDetailClip.frameCaptures.length }}
                </EnBadge>
              </div>
              <div class="grid grid-cols-3 gap-2 lg:grid-cols-4 xl:grid-cols-5">
                <figure
                  v-for="frame in selectedDetailClip.frameCaptures"
                  :key="frame.id"
                  class="overflow-hidden rounded-md border border-slate-100 bg-slate-50"
                >
                  <img
                    :src="clipSavedFrameUrl(detailVideo, selectedDetailClip, frame.id)"
                    class="aspect-video w-full object-cover"
                    :alt="`${formatDuration(frame.timestampMs)} のスクリーンショット`"
                  >
                  <figcaption class="bg-white px-2 py-1 text-[11px] font-semibold text-slate-500">
                    {{ formatDuration(frame.timestampMs) }}
                  </figcaption>
                </figure>
              </div>
            </div>

          </section>
      </div>

      <div
        v-else-if="detailTab === 'videoAnalysis'"
        class="space-y-4"
      >
        <div class="relative overflow-hidden rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div class="pointer-events-none absolute inset-0 opacity-[0.24] [background-image:linear-gradient(#e5e7eb_1px,transparent_1px),linear-gradient(90deg,#e5e7eb_1px,transparent_1px)] [background-size:28px_28px]" />
          <div class="relative space-y-5">
            <div class="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p class="inline-flex rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600 shadow-sm">
                  クリップ解析ノート
                </p>
                <h4 class="mt-3 text-2xl font-bold leading-tight text-slate-950">
                  AIの下書きと文字起こしを確認します
                </h4>
              </div>
              <EnBadge color="neutral" variant="soft">
                {{ quickScanProviderLabel(detailVideo) }}
              </EnBadge>
            </div>

            <div
              v-if="hasQuickScanSummary(detailVideo)"
              class="rounded-3xl border border-slate-200 bg-white/95 p-5 shadow-sm"
            >
              <div class="mb-4 flex items-center justify-between gap-2">
                <h4 class="flex items-center gap-2 text-base font-bold text-slate-950">
                  <UIcon name="material-symbols:draw-outline" class="h-4 w-4 text-slate-500" />
                  AIの下書きメモ
                </h4>
                <div class="flex items-center gap-2">
                  <EnBadge color="neutral" variant="soft">
                    {{ quickScanProviderLabel(detailVideo) }}
                  </EnBadge>
                  <EnButton
                    variant="outline"
                    color="neutral"
                    size="xs"
                    leading-icon="material-symbols:open-in-new"
                    @click="openQuickScanPreview(detailVideo)"
                  >
                    全体を見る
                  </EnButton>
                </div>
              </div>
              <div class="space-y-4">
                <div v-if="detailVideo.quickScan?.title">
                  <p class="text-xs font-semibold text-slate-500">
                    タイトル案
                  </p>
                  <p class="mt-1 text-base font-semibold text-slate-950">
                    {{ detailVideo.quickScan.title }}
                  </p>
                </div>
                <div v-if="detailVideo.quickScan?.description">
                  <p class="text-xs font-semibold text-slate-500">
                    説明
                  </p>
                  <p class="mt-1 text-sm leading-relaxed text-slate-700">
                    {{ detailVideo.quickScan.description }}
                  </p>
                </div>
                <div v-if="operationSteps(detailVideo).length > 0">
                  <p class="text-xs font-semibold text-slate-500">
                    操作の流れ
                  </p>
                  <ol class="mt-3 grid gap-2 md:grid-cols-2">
                    <li
                      v-for="(step, index) in operationSteps(detailVideo).slice(0, 8)"
                      :key="`${detailVideo.id}-detail-step-${index}`"
                      class="flex gap-2 rounded-2xl border border-slate-100 bg-slate-50 p-3 text-sm leading-relaxed text-slate-700"
                    >
                      <span class="mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-700">
                        {{ index + 1 }}
                      </span>
                      <span>{{ step }}</span>
                    </li>
                  </ol>
                </div>
              </div>
            </div>

            <div
              v-if="detailVideo.transcriptSummary || detailVideo.quickScan?.transcriptSummary"
              class="rounded-3xl border border-slate-200 bg-slate-50/70 p-5 shadow-sm"
            >
              <h4 class="flex items-center gap-2 text-base font-bold text-slate-950">
                <UIcon name="material-symbols:summarize-outline" class="h-4 w-4 text-slate-500" />
                文字起こしの読みどころ
              </h4>
              <div class="mt-3 grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
                <div
                  v-for="section in richTranscriptSummarySections(detailVideo).slice(0, 3)"
                  :key="`${detailVideo.id}-detail-summary-${section.title}`"
                  class="rounded-2xl border border-slate-200 bg-white p-3"
                  :class="richTranscriptSummarySections(detailVideo).length === 1 ? 'md:col-span-2 2xl:col-span-3' : ''"
                >
                  <p class="text-xs font-bold uppercase tracking-wide text-slate-500">
                    {{ section.title }}
                  </p>
                  <p class="mt-2 text-sm leading-relaxed text-slate-700">
                    {{ section.body }}
                  </p>
                </div>
              </div>
            </div>

            <div
              v-if="hasTranscriptContent(detailVideo)"
              class="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"
            >
              <div class="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h4 class="flex items-center gap-2 text-sm font-semibold text-slate-900">
                  <UIcon name="material-symbols:article-outline" class="h-4 w-4 text-slate-500" />
                  文字起こし全文
                </h4>
                <EnBadge color="neutral" variant="soft">
                  {{ transcriptProviderBadge(detailVideo) }}
                </EnBadge>
              </div>
              <div
                v-if="transcriptCueRows(detailVideo).length > 0"
                class="min-h-[320px] max-h-[calc(100dvh-18rem)] space-y-2 overflow-auto rounded-2xl border border-slate-100 bg-slate-50 p-3 2xl:min-h-[420px]"
              >
                <div
                  v-for="cue in transcriptCueRows(detailVideo)"
                  :key="`${detailVideo.id}-${cue.id}`"
                  class="grid grid-cols-[80px_minmax(0,1fr)] gap-3 rounded-xl bg-white px-3 py-2 text-sm"
                >
                  <span class="font-mono text-xs font-semibold text-teal-700">
                    {{ formatTranscriptCueTime(cue.startMs) }}
                  </span>
                  <span class="leading-6 text-slate-700">{{ cue.text }}</span>
                </div>
              </div>
              <p
                v-else
                class="min-h-[320px] max-h-[calc(100dvh-18rem)] overflow-auto whitespace-pre-line rounded-2xl border border-slate-100 bg-slate-50 p-4 text-sm leading-7 text-slate-700 2xl:min-h-[420px]"
              >
                {{ detailVideo.transcriptText }}
              </p>
            </div>

            <EnAlert
              v-if="detailVideo.analysisErrorMessage"
              color="error"
              :title="detailVideo.analysisErrorMessage"
            />
          </div>
        </div>
      </div>

      <div
        v-else-if="detailTab === 'report'"
        class="flex min-h-[calc(100dvh-13rem)] flex-col gap-3"
      >
        <section class="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div class="mb-3 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h4 class="flex items-center gap-2 text-base font-bold text-slate-950">
                <UIcon name="material-symbols:preview-outline" class="h-4 w-4 text-slate-500" />
                クリップ Bundle レポート
              </h4>
              <p class="mt-1 text-sm leading-6 text-slate-600">
                クリップグループに紐づくユーザーストーリー候補、証跡、スクリーンショットをまとめて確認できます
              </p>
            </div>
            <div class="flex flex-wrap items-center gap-2">
              <div class="rounded-lg border border-slate-200 bg-slate-50 p-1">
                <button
                  v-for="mode in reportModes"
                  :key="mode.value"
                  type="button"
                  class="rounded-md px-3 py-1.5 text-xs font-semibold transition"
                  :class="reportMode === mode.value ? 'bg-slate-950 text-white' : 'text-slate-600 hover:text-slate-950'"
                  @click="reportMode = mode.value"
                >
                  {{ mode.label }}
                </button>
              </div>
              <EnButton
                v-if="reportMode !== 'excel'"
                variant="outline"
                color="neutral"
                size="xs"
                :leading-icon="reportCopied ? 'material-symbols:check' : 'material-symbols:content-copy-outline'"
                @click="copyReportBody"
              >
                {{ reportCopied ? "コピー済み" : "本文をコピー" }}
              </EnButton>
              <EnButton
                v-if="reportMode !== 'excel'"
                variant="outline"
                color="neutral"
                size="xs"
                leading-icon="material-symbols:open-in-new"
                @click="openReportPreview"
              >
                開く
              </EnButton>
              <EnButton
                variant="outline"
                color="neutral"
                size="xs"
                leading-icon="material-symbols:download"
                @click="downloadReport"
              >
                DL
              </EnButton>
            </div>
          </div>

          <div class="grid gap-3 md:grid-cols-6">
            <div
              v-for="metric in reportMetrics"
              :key="metric.label"
              class="rounded-lg border border-slate-200 bg-slate-50 p-3"
            >
              <p class="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                {{ metric.label }}
              </p>
              <p class="mt-1 text-lg font-bold text-slate-950">
                {{ metric.value }}
              </p>
            </div>
          </div>
        </section>

        <iframe
          v-if="reportMode === 'html' && reportHtmlUrl"
          :src="reportHtmlUrl"
          title="Operation video bundle report preview"
          class="min-h-[680px] w-full flex-1 rounded-2xl border border-slate-200 bg-white shadow-sm"
        />
        <section
          v-else-if="reportMode === 'excel'"
          class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
        >
          <div class="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p class="text-sm font-bold text-slate-950">Excelブック</p>
              <p class="mt-1 text-sm leading-6 text-slate-600">
                SIer開発の進捗共有でそのまま使えるように、一覧・証跡・参照リンクをシート別に整理して保存します。
              </p>
            </div>
            <EnBadge color="success" size="xs">
              .xlsx
            </EnBadge>
          </div>
          <div class="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            <div
              v-for="sheet in reportExcelSheets"
              :key="sheet.name"
              class="rounded-lg border border-slate-200 bg-slate-50 p-3"
            >
              <p class="text-xs font-bold text-slate-950">{{ sheet.name }}</p>
              <p class="mt-1 text-xs leading-5 text-slate-500">{{ sheet.description }}</p>
            </div>
          </div>
        </section>
        <textarea
          v-else
          :value="reportBody"
          readonly
          class="min-h-[680px] w-full flex-1 rounded-2xl border border-slate-200 bg-slate-950 p-4 font-mono text-xs leading-relaxed text-slate-100 shadow-sm"
        />
      </div>

      <div
        v-else-if="detailTab === 'mcpTest'"
        class="space-y-3"
      >
        <StoryVaultMcpTestChat
          :application="application"
          :video="detailVideo"
          :context-json="mcpTestContextJson"
        />
      </div>

      <div
        v-else-if="detailTab === 'videoGeneration'"
        class="space-y-3"
      >
        <StoryVaultVideoGenerationPanel :video="detailVideo" />
      </div>

      <div
        v-else-if="detailTab === 'storyAnalysis'"
        class="space-y-4"
      >
        <div class="relative overflow-hidden rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div class="pointer-events-none absolute inset-0 opacity-[0.28] [background-image:linear-gradient(#e5e7eb_1px,transparent_1px),linear-gradient(90deg,#e5e7eb_1px,transparent_1px)] [background-size:32px_32px]" />
          <div class="mb-4 flex flex-wrap items-start justify-between gap-3">
            <div>
              <p class="relative inline-flex rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600 shadow-sm">
                ユーザーの「やりたいこと」メモ
              </p>
              <h4 class="relative mt-3 text-2xl font-bold leading-tight text-slate-950">
                ストーリー解析
              </h4>
              <p class="relative mt-2 text-sm leading-6 text-slate-600">
                クリップから見つけたニーズを、付箋と根拠つきで整理します
              </p>
            </div>
            <EnBadge color="neutral" variant="soft">
              {{ analysisResultCount(detailVideo) }}
            </EnBadge>
          </div>

          <EnAlert
            v-if="detailVideo.analysisErrorMessage"
            color="error"
            :title="detailVideo.analysisErrorMessage"
            class="mb-4"
          />

          <div
            v-if="!detailVideo.analysisResult"
            class="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-500"
          >
            ユーザーストーリー解析を実行すると、ユーザーのやりたいこと候補と根拠になるクリップの場面がここに表示されます
          </div>

          <div v-else class="relative space-y-5">
            <div
              v-if="detailVideo.analysisResult.storyCandidates.length === 0"
              class="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-500"
            >
              ストーリー候補は生成されませんでした。クリップや文字起こしから十分な操作意図を確認できなかった可能性があります。
            </div>

            <div
              v-else
              class="grid gap-5 xl:grid-cols-[minmax(320px,0.78fr)_minmax(0,1.22fr)]"
            >
              <section class="rounded-3xl border border-slate-200 bg-white/95 p-4 shadow-sm">
                <div class="mb-3 flex items-center justify-between gap-2">
                  <h5 class="flex items-center gap-2 text-base font-bold text-slate-950">
                    <UIcon name="material-symbols:sticky-note-2-outline" class="h-4 w-4 text-slate-500" />
                    見つかったストーリー
                  </h5>
                  <EnBadge color="neutral" variant="soft">
                    {{ detailVideo.analysisResult.storyCandidates.length }}
                  </EnBadge>
                </div>
                <div class="space-y-3">
                  <button
                    v-for="story in detailVideo.analysisResult.storyCandidates"
                    :key="story.id"
                    type="button"
                    class="w-full rounded-xl border p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                    :class="selectedAnalysisStory?.id === story.id ? 'border-slate-900 bg-slate-50 ring-2 ring-slate-200' : 'border-slate-200 bg-white hover:border-slate-400'"
                    @click="selectedAnalysisStoryId = story.id"
                  >
                    <div class="flex items-start justify-between gap-2">
                      <div class="min-w-0">
                        <p class="mb-1 inline-flex rounded-md border border-slate-200 bg-slate-950 px-2 py-0.5 font-mono text-[11px] font-bold text-white shadow-sm">
                          [{{ analysisStoryTicketKey(story) }}]
                        </p>
                        <p class="line-clamp-2 text-base font-bold leading-snug text-slate-950">
                          {{ story.title }}
                        </p>
                      </div>
                      <EnBadge color="neutral" variant="soft">
                        {{ story.confidence ?? story.confidenceScore ?? 0 }}
                      </EnBadge>
                    </div>
                    <p
                      v-if="story.goal"
                      class="mt-2 line-clamp-2 text-xs leading-relaxed text-slate-600"
                    >
                      {{ story.goal }}
                    </p>
                    <div class="mt-3 flex flex-wrap items-center gap-1 text-[11px] text-slate-500">
                      <EnBadge v-if="story.role" color="neutral" variant="soft">
                        {{ story.role.value }}
                      </EnBadge>
                      <EnBadge
                        v-if="story.evidence.length > 0"
                        color="neutral"
                        variant="soft"
                      >
                        根拠 {{ story.evidence.length }}件
                      </EnBadge>
                      <EnBadge
                        v-for="(item, evidenceIndex) in story.evidence.slice(0, 2)"
                        :key="`${story.id}-range-${evidenceIndex}`"
                        color="neutral"
                        variant="soft"
                      >
                        {{ formatEvidenceRange(item.tRange) }}
                      </EnBadge>
                      <span
                        v-if="story.evidence.length > 2"
                        class="text-slate-400"
                      >
                        +{{ story.evidence.length - 2 }}
                      </span>
                    </div>
                  </button>
                </div>
              </section>

              <section class="rounded-3xl border border-slate-200 bg-white/95 p-5 shadow-sm">
                <div
                  v-if="!selectedAnalysisStory"
                  class="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-500"
                >
                  左の付箋を選ぶと、詳しい内容と根拠のクリップが表示されます
                </div>
                <div
                  v-else
                  class="space-y-4"
                >
                  <div class="rounded-3xl border border-slate-200 bg-slate-50/80 p-5">
                    <div class="flex flex-wrap items-start justify-between gap-3">
                      <div class="min-w-0">
                        <p class="mb-2 inline-flex rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-600">
                          選択中のストーリー
                        </p>
                        <div class="flex flex-wrap items-center gap-2">
                          <span class="rounded-md border border-slate-200 bg-slate-950 px-2.5 py-1 font-mono text-xs font-bold text-white shadow-sm">
                            [{{ analysisStoryTicketKey(selectedAnalysisStory) }}]
                          </span>
                          <h5 class="text-xl font-bold leading-snug text-slate-950">
                            {{ selectedAnalysisStory.title }}
                          </h5>
                        </div>
                      <p
                        v-if="selectedAnalysisStory.summary"
                        class="mt-2 text-sm leading-relaxed text-slate-600"
                      >
                        {{ selectedAnalysisStory.summary }}
                      </p>
                    </div>
                    <div class="flex flex-shrink-0 flex-wrap gap-1">
                      <EnBadge
                        v-if="selectedAnalysisStory.role"
                        color="neutral"
                        variant="soft"
                      >
                        {{ selectedAnalysisStory.role.grounding === 'explicit' ? '発話から確認' : '推定' }}
                      </EnBadge>
                      <EnBadge color="neutral" variant="soft">
                        {{ selectedAnalysisStory.confidence ?? selectedAnalysisStory.confidenceScore ?? 0 }}
                      </EnBadge>
                    </div>
                  </div>
                  </div>

                  <StoryVaultStoryValueCards
                    :story="selectedAnalysisStory"
                    :video="detailVideo"
                  />

                  <p
                    v-if="selectedAnalysisStory.userStory"
                    class="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm leading-7 text-slate-800"
                  >
                    {{ selectedAnalysisStory.userStory }}
                  </p>

                  <div
                    v-if="selectedAnalysisStory.detailedSpecifications.length > 0"
                    class="rounded-3xl border border-cyan-100 bg-cyan-50/60 p-4"
                  >
                    <p class="flex items-center gap-2 text-base font-bold text-slate-950">
                      <UIcon name="material-symbols:format-list-bulleted-rounded" class="h-4 w-4 text-cyan-700" />
                      詳細仕様
                    </p>
                    <p class="mt-1 text-sm leading-6 text-slate-600">
                      動画内の補足説明・細かい機能特徴・制約を、このストーリーに紐付けて保持します
                    </p>
                    <ul class="mt-3 space-y-2">
                      <li
                        v-for="(specification, index) in selectedAnalysisStory.detailedSpecifications"
                        :key="`${selectedAnalysisStory.id}-spec-${index}`"
                        class="flex gap-2 text-sm leading-relaxed text-slate-700"
                      >
                        <span class="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-white text-[10px] font-semibold text-cyan-700 ring-1 ring-cyan-100">
                          {{ index + 1 }}
                        </span>
                        <span>{{ specification }}</span>
                      </li>
                    </ul>
                  </div>

                  <div class="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                    <div class="mb-3 flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p class="flex items-center gap-2 text-base font-bold text-slate-950">
                          <UIcon name="material-symbols:movie-filter-outline" class="h-4 w-4 text-slate-500" />
                          根拠になったクリップの場面
                        </p>
                        <p class="mt-1 text-sm leading-6 text-slate-600">
                          タイムスタンプから、近いスクリーンショットも一緒に確認できます
                        </p>
                      </div>
                      <EnBadge color="neutral" variant="soft">
                        {{ selectedAnalysisStory.evidence.length }}
                      </EnBadge>
                    </div>
                    <div class="space-y-3">
                      <div
                        v-for="(item, evidenceIndex) in selectedAnalysisStory.evidence"
                        :key="`${selectedAnalysisStory.id}-timestamp-${evidenceIndex}`"
                        class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
                      >
                        <div class="flex flex-wrap items-start justify-between gap-2">
                          <div class="min-w-0">
                            <p class="text-sm font-semibold text-slate-900">
                              {{ item.title || `クリップセグメント ${evidenceIndex + 1}` }}
                            </p>
                            <p
                              v-if="item.summary"
                              class="mt-1 text-xs leading-relaxed text-slate-600"
                            >
                              {{ item.summary }}
                            </p>
                          </div>
                          <EnBadge color="neutral" variant="soft">
                            {{ formatEvidenceRange(item.tRange) }}
                          </EnBadge>
                        </div>

                        <div
                          v-if="item.transcriptQuote || item.transcriptCueIds.length > 0"
                          class="mt-3 rounded-lg border border-teal-100 bg-teal-50/70 p-3"
                        >
                          <p class="flex flex-wrap items-center gap-2 text-xs font-semibold text-teal-900">
                            <UIcon name="material-symbols:subtitles-outline" class="h-4 w-4" />
                            発話根拠
                          </p>
                          <p
                            v-if="item.transcriptQuote"
                            class="mt-2 text-xs leading-relaxed text-slate-700"
                          >
                            {{ item.transcriptQuote }}
                          </p>
                          <p
                            v-if="item.transcriptCueIds.length > 0"
                            class="mt-2 font-mono text-[11px] text-teal-700"
                          >
                            {{ item.transcriptCueIds.join(", ") }}
                          </p>
                        </div>

                        <video
                          v-if="videoSegmentUrl(detailVideo, item)"
                          :src="videoSegmentUrl(detailVideo, item)"
                          controls
                          preload="metadata"
                          class="mt-3 aspect-video w-full rounded-lg bg-slate-950"
                        />

                        <div
                          v-if="storyEvidenceFrames(detailVideo, item).length > 0"
                          class="mt-3"
                        >
                          <p class="mb-2 text-xs font-semibold text-slate-700">
                            関連キャプチャ
                          </p>
                          <div class="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-4">
                            <figure
                              v-for="frame in storyEvidenceFrames(detailVideo, item)"
                              :key="`${selectedAnalysisStory.id}-${item.videoId}-${frame.id}`"
                              class="overflow-hidden rounded-md border bg-white"
                              :class="item.representativeScreenshotId === frame.id ? 'border-slate-900 ring-2 ring-slate-200' : 'border-slate-200'"
                            >
                              <img
                                :src="savedFrameUrl(detailVideo, frame.id)"
                                class="aspect-video w-full object-cover"
                                :alt="`${formatDuration(frame.timestampMs)} のスクリーンショット`"
                              >
                              <figcaption class="flex items-center justify-between gap-2 px-2 py-1 text-[11px] text-slate-500">
                                <span>{{ formatDuration(frame.timestampMs) }}</span>
                                <span
                                  v-if="item.representativeScreenshotId === frame.id"
                                  class="font-semibold text-slate-900"
                                >
                                  代表
                                </span>
                              </figcaption>
                            </figure>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div
                    v-if="selectedAnalysisStory.acceptanceCriteria.length > 0"
                    class="rounded-3xl border border-slate-200 bg-white p-4"
                  >
                    <p class="text-base font-bold text-slate-950">
                      できたと言える条件
                    </p>
                    <ul class="mt-2 space-y-2">
                      <li
                        v-for="(criterion, index) in selectedAnalysisStory.acceptanceCriteria"
                        :key="criterion"
                        class="flex gap-2 text-sm leading-relaxed text-slate-700"
                      >
                        <span class="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-slate-100 text-[10px] font-semibold text-slate-700">
                          {{ index + 1 }}
                        </span>
                        <span>{{ criterion }}</span>
                      </li>
                    </ul>
                  </div>
                </div>
              </section>
            </div>

            <div
              v-if="detailVideo.analysisResult.notes.length > 0"
              class="rounded-lg border border-slate-200 bg-white p-3"
            >
              <p class="text-xs font-semibold text-slate-700">
                補足メモ
              </p>
              <ul class="mt-2 list-disc space-y-1 pl-5 text-xs leading-relaxed text-slate-600">
                <li
                  v-for="note in detailVideo.analysisResult.notes"
                  :key="note"
                >
                  {{ note }}
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      <div
        v-else
        class="grid gap-4 xl:grid-cols-[240px_minmax(0,1fr)]"
      >
        <EnModal
          v-model:open="bulkContextModalOpen"
          title="コンテキストを一括収集中"
          subtitle="クリップに関係する情報を各サービスから集めています"
          title-icon="material-symbols:auto-awesome"
          size="lg"
          :close-on-backdrop="bulkContextCompleted"
        >
          <div class="space-y-5">
            <div class="overflow-hidden rounded-xl border border-blue-100 bg-gradient-to-br from-blue-50 via-white to-cyan-50 p-5">
              <div class="flex items-center gap-4">
                <span class="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white shadow-lg shadow-blue-600/25">
                  <UIcon
                    :name="bulkContextCompleted ? 'material-symbols:check' : 'material-symbols:autorenew'"
                    class="h-6 w-6"
                    :class="bulkContextCompleted ? '' : 'animate-spin'"
                  />
                </span>
                <div class="min-w-0 flex-1">
                  <p class="text-sm font-black text-slate-950">
                    {{ bulkContextCompleted ? "収集リクエストを送信しました" : "関連情報を探索しています" }}
                  </p>
                  <p class="mt-1 text-xs leading-relaxed text-slate-600">
                    {{ bulkContextCompleted ? "各サービスの解析はバックグラウンドで続きます。結果はこの画面に反映されます。" : "クリップの内容を手がかりに、関連性の高い情報を自動で照合しています。" }}
                  </p>
                </div>
              </div>
              <div class="mt-5 h-2 overflow-hidden rounded-full bg-blue-100">
                <div
                  class="h-full rounded-full bg-gradient-to-r from-blue-600 via-cyan-500 to-teal-400 transition-all duration-700"
                  :class="bulkContextCompleted ? 'w-full' : 'w-2/3 animate-pulse'"
                />
              </div>
            </div>
            <div class="grid gap-3 sm:grid-cols-3">
              <div
                v-for="step in bulkContextSteps"
                :key="step.key"
                class="rounded-xl border p-4 transition"
                :class="step.status === 'done' ? 'border-emerald-200 bg-emerald-50' : step.status === 'running' ? 'border-blue-200 bg-blue-50 shadow-sm' : 'border-slate-200 bg-slate-50'"
              >
                <div class="flex items-center justify-between gap-2">
                  <UIcon :name="step.icon" class="h-5 w-5" :class="step.status === 'done' ? 'text-emerald-600' : step.status === 'running' ? 'text-blue-600' : 'text-slate-400'" />
                  <UIcon v-if="step.status === 'running'" name="material-symbols:progress-activity" class="h-4 w-4 animate-spin text-blue-600" />
                  <UIcon v-else-if="step.status === 'done'" name="material-symbols:check-circle" class="h-4 w-4 text-emerald-600" />
                </div>
                <p class="mt-3 text-xs font-bold text-slate-900">{{ step.label }}</p>
                <p class="mt-1 text-[11px] text-slate-500">{{ step.status === 'done' ? '取得リクエスト送信済み' : step.status === 'running' ? '解析を開始しています' : '待機中' }}</p>
              </div>
            </div>
          </div>
          <template #footer>
            <EnButton v-if="bulkContextCompleted" variant="solid" color="primary" size="sm" @click="bulkContextModalOpen = false">
              閉じる
            </EnButton>
          </template>
        </EnModal>

        <aside class="rounded-3xl border border-slate-200 bg-white p-3 shadow-sm xl:sticky xl:top-4 xl:self-start">
          <div class="mb-3 px-2">
            <p class="text-xs font-bold uppercase tracking-wide text-slate-400">
              Context Tools
            </p>
            <p class="mt-1 text-xs leading-5 text-slate-500">
              取得元を選ぶと右側に結果を表示します
            </p>
          </div>
          <button
            type="button"
            class="mb-3 flex w-full items-center gap-3 rounded-2xl bg-gradient-to-r from-blue-600 to-cyan-500 px-3 py-3 text-left text-white shadow-lg shadow-blue-600/20 transition hover:-translate-y-0.5 hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-60"
            :disabled="!detailVideo || isRelatedContextBusy(detailVideo)"
            @click="startBulkContextCollection"
          >
            <span class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/15">
              <UIcon name="material-symbols:auto-awesome" class="h-5 w-5" />
            </span>
            <span class="min-w-0 flex-1">
              <span class="block text-sm font-bold">コンテキスト一括収集</span>
              <span class="mt-0.5 block text-[11px] text-blue-100">AIで関連情報を自動照合</span>
            </span>
          </button>
          <nav class="space-y-1" aria-label="関連コンテキストツール">
            <button
              type="button"
              class="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left transition"
              :class="relatedContextProviderTab === 'knowledge' ? 'bg-slate-950 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-950'"
              @click="relatedContextProviderTab = 'knowledge'"
            >
              <span
                class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
                :class="relatedContextProviderTab === 'knowledge' ? 'bg-white/10' : 'bg-slate-100'"
              >
                <UIcon name="material-symbols:folder-managed-outline" class="h-4 w-4" />
              </span>
              <span class="min-w-0 flex-1">
                <span class="block text-sm font-bold">ボルトナレッジ</span>
                <span
                  class="mt-0.5 block truncate text-xs"
                  :class="relatedContextProviderTab === 'knowledge' ? 'text-slate-300' : 'text-slate-500'"
                >
                  FileSpace ナレッジ
                </span>
              </span>
              <span
                class="inline-flex min-w-6 shrink-0 items-center justify-center rounded-full px-2 py-0.5 text-[10px] font-semibold"
                :class="relatedContextProviderTab === 'knowledge' ? 'bg-white/15 text-white' : 'bg-slate-100 text-slate-700'"
              >
                {{ relatedKnowledgeDocumentCount(detailVideo) }}
              </span>
            </button>
            <button
              type="button"
              class="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left transition"
              :class="relatedContextProviderTab === 'github' ? 'bg-slate-950 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-950'"
              @click="relatedContextProviderTab = 'github'"
            >
              <span
                class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
                :class="relatedContextProviderTab === 'github' ? 'bg-white/10' : 'bg-slate-100'"
              >
                <UIcon name="i-simple-icons-github" class="h-4 w-4" />
              </span>
              <span class="min-w-0 flex-1">
                <span class="block text-sm font-bold">GitHub</span>
                <span
                  class="mt-0.5 block truncate text-xs"
                  :class="relatedContextProviderTab === 'github' ? 'text-slate-300' : 'text-slate-500'"
                >
                  PR と変更履歴
                </span>
              </span>
              <span
                class="inline-flex min-w-6 shrink-0 items-center justify-center rounded-full px-2 py-0.5 text-[10px] font-semibold"
                :class="relatedContextProviderTab === 'github' ? 'bg-white/15 text-white' : 'bg-slate-100 text-slate-700'"
              >
                {{ relatedGithubPullRequestCount(detailVideo) }}
              </span>
            </button>
            <button
              type="button"
              class="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left transition"
              :class="relatedContextProviderTab === 'jira' ? 'bg-slate-950 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-950'"
              @click="relatedContextProviderTab = 'jira'"
            >
              <span
                class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
                :class="relatedContextProviderTab === 'jira' ? 'bg-white/10' : 'bg-slate-100'"
              >
                <UIcon name="material-symbols:confirmation-number-outline" class="h-4 w-4" />
              </span>
              <span class="min-w-0 flex-1">
                <span class="block text-sm font-bold">Jira</span>
                <span
                  class="mt-0.5 block truncate text-xs"
                  :class="relatedContextProviderTab === 'jira' ? 'text-slate-300' : 'text-slate-500'"
                >
                  チケット管理
                </span>
              </span>
              <span
                class="inline-flex min-w-6 shrink-0 items-center justify-center rounded-full px-2 py-0.5 text-[10px] font-semibold"
                :class="relatedContextProviderTab === 'jira' ? 'bg-white/15 text-white' : 'bg-slate-100 text-slate-700'"
              >
                {{ relatedJiraIssueCount(detailVideo) }}
              </span>
            </button>
          </nav>
        </aside>

        <div class="min-w-0 space-y-4">
          <section
            v-if="relatedContextProviderTab === 'knowledge'"
            class="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"
          >
          <div class="mb-4 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h4 class="flex items-center gap-2 text-base font-bold text-slate-950">
                <UIcon name="material-symbols:folder-managed-outline" class="h-4 w-4 text-slate-500" />
                ボルトナレッジ
              </h4>
              <p class="mt-1 text-xs text-slate-500">
                {{ application?.fileSpaceId || "FileSpace未設定" }}
              </p>
            </div>
            <EnButton
              variant="solid"
              color="neutral"
              size="xs"
              custom-class="!border-slate-950 !bg-slate-950 !text-white shadow-lg shadow-slate-950/15 hover:!bg-slate-800 disabled:!bg-slate-400"
              leading-icon="material-symbols:travel-explore"
              :loading="isRelatedContextProviderRunning(detailVideo, 'knowledge')"
              :global-loading="false"
              :disabled="!application?.fileSpaceId || isRelatedContextProviderRunning(detailVideo, 'knowledge')"
              @click="$emit('fetch-related-context', detailVideo.id, 'knowledge')"
            >
              {{ hasRelatedKnowledgeContext(detailVideo) ? "ナレッジ再取得" : "ナレッジ取得" }}
            </EnButton>
          </div>

          <div class="mb-4 rounded-xl border border-emerald-100 bg-emerald-50/60 p-4">
            <div class="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p class="text-sm font-bold text-slate-900">ナレッジ一覧から手動で紐付け</p>
                <p class="mt-1 text-xs leading-relaxed text-slate-600">
                  自動検索に出ないファイルも、対象FileSpaceから選択してクリップの関連コンテキストへ保存できます。
                </p>
              </div>
              <EnButton
                variant="outline"
                color="neutral"
                size="xs"
                leading-icon="material-symbols:folder-open"
                :loading="isKnowledgeManualLoading"
                :disabled="!application?.fileSpaceId"
                @click="loadKnowledgeDocumentsForManualLink"
              >
                ナレッジ一覧を表示
              </EnButton>
            </div>

            <div v-if="knowledgeFileSpaceStore.documents.length > 0 || isKnowledgeManualLoading" class="mt-3 space-y-3">
              <input
                v-model="knowledgeManualSearchQuery"
                type="search"
                class="h-9 w-full rounded-md border border-emerald-200 bg-white px-3 text-xs text-slate-800 outline-none placeholder:text-slate-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                placeholder="ファイル名・説明で絞り込み"
              >
              <div v-if="isKnowledgeManualLoading" class="rounded-lg border border-emerald-100 bg-white p-4 text-xs text-slate-500">
                FileSpaceのナレッジ一覧を読み込んでいます…
              </div>
              <div v-else class="max-h-[26rem] overflow-y-auto rounded-lg border border-emerald-100 bg-white p-3">
                <label
                  v-for="document in knowledgeManualDocuments"
                  :key="`knowledge-manual-${knowledgeDocumentSelectionKey(document)}`"
                  class="flex cursor-pointer items-start gap-3 border-b border-slate-100 px-2 py-3 last:border-0 hover:bg-emerald-50/50"
                >
                  <input
                    v-model="selectedKnowledgeDocumentIds"
                    type="checkbox"
                    :value="knowledgeDocumentSelectionKey(document)"
                    class="mt-0.5 h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                  >
                  <span class="min-w-0 flex-1">
                    <span class="block truncate text-xs font-bold text-slate-900">{{ document.displayName || document.title || document.name || "名称未設定" }}</span>
                    <span class="mt-1 block line-clamp-2 text-[11px] leading-relaxed text-slate-500">{{ document.description || document.mimeType || document.filePath || "FileSpaceナレッジ" }}</span>
                  </span>
                </label>
                <p v-if="knowledgeManualDocuments.length === 0" class="p-4 text-center text-xs text-slate-500">
                  該当するナレッジファイルはありません
                </p>
              </div>
              <div class="flex flex-wrap items-center justify-between gap-2">
                <p class="text-xs text-slate-500">{{ knowledgeManualDocuments.length }}件表示 / {{ selectedKnowledgeDocumentIds.length }}件選択中</p>
                <EnButton
                  variant="solid"
                  color="neutral"
                  size="xs"
                  custom-class="!border-emerald-600 !bg-emerald-600 !text-white hover:!bg-emerald-700 disabled:!bg-slate-300"
                  leading-icon="material-symbols:link"
                  :disabled="selectedKnowledgeDocumentIds.length === 0"
                  @click="linkSelectedKnowledgeDocuments"
                >
                  選択したナレッジを紐付け
                </EnButton>
              </div>
            </div>
            <EnAlert v-if="knowledgeManualError" class="mt-3" color="warning" :title="knowledgeManualError" />
          </div>

          <div
            v-if="isRelatedContextProviderRunning(detailVideo, 'knowledge')"
            class="mb-4 overflow-hidden rounded-xl border border-slate-900 bg-slate-950 text-white shadow-sm"
          >
            <div class="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
              <div class="flex items-center gap-3">
                <span class="relative flex h-8 w-8 items-center justify-center rounded-full bg-white/10">
                  <UIcon name="material-symbols:travel-explore" class="h-4 w-4" />
                  <span class="absolute inset-0 animate-ping rounded-full border border-white/20" />
                </span>
                <div>
                  <p class="text-sm font-semibold">
                    ナレッジファイルを取得しています
                  </p>
                  <p class="mt-0.5 text-xs text-slate-300">
                    Search Store、クリップ解析、Story候補、投入ファイルのメタデータを照合中
                  </p>
                </div>
              </div>
              <EnBadge color="neutral" variant="soft">
                analyzing
              </EnBadge>
            </div>
            <div class="grid gap-3 bg-white p-4 md:grid-cols-3">
              <div
                v-for="index in 3"
                :key="`related-context-knowledge-skeleton-${index}`"
                class="rounded-lg border border-slate-100 p-3"
              >
                <div class="h-20 animate-pulse rounded-lg bg-slate-100" />
                <div class="mt-3 h-3 w-2/3 animate-pulse rounded-full bg-slate-200" />
                <div class="mt-2 h-3 w-full animate-pulse rounded-full bg-slate-100" />
              </div>
            </div>
          </div>

          <EnAlert
            v-if="!application?.fileSpaceId"
            color="warning"
            title="アプリ専用FileSpaceを作成してください"
            description="投入済みファイルやSearch Storeのナレッジを関連付けるにはFileSpaceが必要です。"
          />

          <div
            v-else-if="!isRelatedContextProviderRunning(detailVideo, 'knowledge') && !hasRelatedKnowledgeContext(detailVideo)"
            class="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-500"
          >
            ナレッジ取得を実行すると、クリップに関連する投入ファイルや設計書がここに表示されます
          </div>

          <div v-else-if="hasRelatedKnowledgeContext(detailVideo)" class="space-y-4">
            <div class="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
              <span>{{ relatedKnowledgeFileSpaceId(detailVideo) }}</span>
              <span>{{ formatRecordedAt(relatedKnowledgeCheckedAt(detailVideo)) }}</span>
            </div>

            <div
              v-if="relatedKnowledgeDocuments(detailVideo).length === 0"
              class="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-500"
            >
              関連するナレッジファイルは見つかりませんでした
            </div>

            <div v-else class="grid gap-3 md:grid-cols-3 2xl:grid-cols-4">
              <article
                v-for="doc in relatedKnowledgeDocuments(detailVideo)"
                :key="`${detailVideo.id}-related-knowledge-${doc.documentId || doc.name}`"
                class="rounded-2xl border border-slate-200 bg-white p-2 shadow-sm"
              >
                <div class="relative">
                  <KnowledgeDocumentCompactCard
                    :document="knowledgeDocumentToFileSpaceDocument(doc)"
                    :show-actions="false"
                  />
                  <EnBadge
                    color="neutral"
                    variant="soft"
                    class="absolute right-2 top-2"
                  >
                    {{ doc.relevanceScore }}
                  </EnBadge>
                  <button
                    v-if="doc.documentId || doc.name"
                    type="button"
                    class="absolute bottom-2 right-2 inline-flex h-7 w-7 items-center justify-center rounded-full bg-white/90 text-slate-500 shadow-sm ring-1 ring-slate-200 hover:text-red-600"
                    :aria-label="`${doc.displayName || doc.name || 'ナレッジ'}の紐付けを解除`"
                    title="紐付けを解除"
                    @click="emit('unlink-knowledge-document', detailVideo.id, doc.documentId || doc.name || '')"
                  >
                    <UIcon name="material-symbols:close" class="h-4 w-4" />
                  </button>
                </div>
                <p
                  v-if="doc.reason"
                  class="mt-2 line-clamp-3 text-xs leading-relaxed text-slate-700"
                >
                  {{ doc.reason }}
                </p>
                <div class="mt-2 flex flex-wrap gap-1">
                  <EnBadge
                    v-for="signal in doc.matchedSignals.slice(0, 3)"
                    :key="`${doc.documentId || doc.name}-${signal}`"
                    color="neutral"
                    variant="soft"
                  >
                    {{ signal }}
                  </EnBadge>
                </div>
              </article>
            </div>
          </div>
          </section>

          <section
            v-if="relatedContextProviderTab === 'jira'"
            class="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"
          >
            <div class="mb-4 flex flex-wrap items-start justify-between gap-3">
              <div>
                <h4 class="flex items-center gap-2 text-base font-bold text-slate-950">
                  <UIcon name="i-simple-icons-jira" class="h-4 w-4 text-[#1868DB]" />
                  Jira Issue
                </h4>
                <p class="mt-1 text-xs text-slate-500">
                  {{ relatedJiraSiteLabel(detailVideo) }}
                </p>
              </div>
              <EnButton
                variant="solid"
                color="neutral"
                size="xs"
                custom-class="!border-[#1868DB] !bg-[#1868DB] !text-white shadow-lg shadow-blue-900/15 hover:!bg-[#1558b7] disabled:!bg-slate-400"
                leading-icon="i-simple-icons-jira"
                :loading="isRelatedContextProviderRunning(detailVideo, 'jira')"
                :global-loading="false"
                :disabled="isRelatedContextBusy(detailVideo)"
                @click="$emit('fetch-related-context', detailVideo.id, 'jira')"
              >
                {{ hasRelatedJiraContext(detailVideo) ? "Issueを再取得" : "Issueを取得" }}
              </EnButton>
            </div>

            <div class="mb-4 rounded-xl border border-blue-100 bg-blue-50/50 p-4">
              <div class="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p class="text-sm font-bold text-slate-900">Issueを検索して手動で紐付け</p>
                  <p class="mt-1 text-xs leading-relaxed text-slate-600">
                    AIの候補にないチケットも、キーやタイトルで検索してクリップに追加できます。
                  </p>
                </div>
                <EnButton
                  v-if="jiraConnections.length === 0"
                  variant="outline"
                  color="neutral"
                  size="xs"
                  leading-icon="i-heroicons-arrow-top-right-on-square"
                  @click="navigateToJiraSettings"
                >
                  Jira接続を設定
                </EnButton>
              </div>

              <div v-if="jiraConnections.length > 0" class="mt-3 space-y-3">
                <div class="grid gap-2 md:grid-cols-[minmax(180px,0.35fr)_minmax(0,1fr)_auto]">
                  <select
                    v-model="jiraSelectedCloudId"
                    class="h-9 min-w-0 rounded-md border border-slate-200 bg-white px-2.5 text-xs text-slate-700 outline-none focus:border-[#1868DB] focus:ring-2 focus:ring-blue-100"
                    aria-label="Jira site"
                  >
                    <option
                      v-for="connection in jiraConnections"
                      :key="connection.cloudId"
                      :value="connection.cloudId"
                    >
                      {{ connection.siteName || connection.siteUrl || "Jira Cloud" }}
                    </option>
                  </select>
                  <input
                    v-model="jiraSearchQuery"
                    type="search"
                    class="h-9 min-w-0 rounded-md border border-slate-200 bg-white px-3 text-xs text-slate-800 outline-none placeholder:text-slate-400 focus:border-[#1868DB] focus:ring-2 focus:ring-blue-100"
                    placeholder="Issueキー、タイトル、語句で検索（空欄で最近のIssue）"
                    @keydown.enter="searchJiraIssues"
                  >
                  <EnButton
                    variant="solid"
                    color="neutral"
                    size="xs"
                    custom-class="!border-[#1868DB] !bg-[#1868DB] !text-white hover:!bg-[#1558b7]"
                    leading-icon="i-heroicons-magnifying-glass"
                    :loading="isJiraSearching"
                    @click="searchJiraIssues"
                  >
                    検索
                  </EnButton>
                </div>

                <EnAlert
                  v-if="jiraSearchError"
                  color="warning"
                  :title="jiraSearchError"
                />

                <div
                  v-if="jiraSearchResults.length > 0"
                  class="max-h-[30rem] overflow-y-auto rounded-lg border border-blue-100 bg-slate-50/70 p-3"
                >
                  <p class="px-2.5 pb-1 text-[11px] font-semibold text-slate-500">
                    {{ jiraListMode === "project" ? "StoryVaultのチケット一覧" : "検索結果" }}
                  </p>
                  <div class="grid gap-3 lg:grid-cols-2">
                  <label
                    v-for="issue in jiraSearchResults"
                    :key="`jira-search-${issue.cloudId}-${issue.key}`"
                    class="flex min-h-36 cursor-pointer items-start gap-3 rounded-lg border bg-white p-3 shadow-sm transition hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-md"
                    :class="isJiraIssueSelected(issue) ? 'border-blue-300 bg-blue-50/70 ring-1 ring-blue-200' : 'border-slate-200'"
                  >
                    <input
                      v-model="selectedJiraIssueKeys"
                      type="checkbox"
                      :value="jiraIssueSelectionKey(issue)"
                      class="mt-1 h-4 w-4 rounded border-slate-300 text-[#1868DB] focus:ring-[#1868DB]"
                    >
                    <span class="min-w-0 flex-1">
                      <span class="flex items-start justify-between gap-2">
                        <span class="block text-xs font-bold leading-relaxed text-slate-900">{{ issue.key }} {{ issue.summary }}</span>
                        <a
                          v-if="issue.htmlUrl"
                          :href="issue.htmlUrl"
                          target="_blank"
                          rel="noopener noreferrer"
                          class="shrink-0 p-1 text-slate-400 hover:text-[#1868DB]"
                          :aria-label="`${issue.key}をJiraで開く`"
                          @click.stop
                        >
                          <UIcon name="i-heroicons-arrow-top-right-on-square" class="h-4 w-4" />
                        </a>
                      </span>
                      <span class="mt-2 inline-flex max-w-full truncate rounded bg-slate-100 px-2 py-1 text-[10px] font-semibold text-slate-600">
                        {{ issue.project.name || "Jira" }} / {{ issue.status.name || "状態未設定" }}
                        <span v-if="issue.assignee.name"> / {{ issue.assignee.name }}</span>
                      </span>
                      <span v-if="issue.description" class="mt-2 block line-clamp-4 text-[11px] leading-relaxed text-slate-600">
                        {{ issue.description }}
                      </span>
                    </span>
                  </label>
                  </div>
                </div>

                <div class="flex flex-wrap items-center justify-between gap-2">
                  <p class="text-xs text-slate-500">
                    {{ jiraSearchResults.length ? `${jiraSearchResults.length}件表示中` : "検索結果はここに表示されます" }}
                    <span v-if="selectedJiraIssueKeys.length"> / {{ selectedJiraIssueKeys.length }}件選択中</span>
                  </p>
                  <EnButton
                    variant="solid"
                    color="neutral"
                    size="xs"
                    custom-class="!border-slate-950 !bg-slate-950 !text-white hover:!bg-slate-800 disabled:!bg-slate-300"
                    leading-icon="material-symbols:link"
                    :disabled="selectedJiraIssueKeys.length === 0"
                    @click="linkSelectedJiraIssues"
                  >
                    選択したIssueを紐付け
                  </EnButton>
                </div>
              </div>
              <p
                v-if="jiraConnections.length > 0 && jiraSearchResults.length === 0"
                class="mt-3 text-xs text-slate-500"
              >
                検索すると、ここにIssueの要約・状態・担当者を確認できます。
              </p>
            </div>

            <div
              v-if="hasRelatedJiraContext(detailVideo) && relatedJiraIssues(detailVideo).length > 0"
              class="mb-4 rounded-xl border border-emerald-100 bg-emerald-50/50 p-3"
            >
              <div class="flex items-center justify-between gap-2">
                <p class="text-xs font-bold text-emerald-900">紐付け済みIssue</p>
                <span class="text-[11px] text-emerald-700">{{ relatedJiraIssueCount(detailVideo) }}件</span>
              </div>
              <div class="mt-2 flex flex-wrap gap-2">
                <span
                  v-for="issue in relatedJiraIssues(detailVideo)"
                  :key="`jira-linked-${detailVideo.id}-${issue.cloudId}-${issue.key}`"
                  class="inline-flex max-w-full items-center gap-1 rounded-md bg-white px-2 py-1 text-xs text-emerald-900 ring-1 ring-emerald-200"
                >
                  <a
                    :href="issue.htmlUrl"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="max-w-[260px] truncate font-semibold hover:underline"
                  >
                    {{ issue.key }} {{ issue.summary }}
                  </a>
                  <button
                    type="button"
                    class="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded text-emerald-600 hover:bg-emerald-100 hover:text-red-600"
                    :aria-label="`${issue.key}の紐付けを解除`"
                    :title="`${issue.key}の紐付けを解除`"
                    @click="unlinkJiraIssue(issue)"
                  >
                    <UIcon name="material-symbols:close" class="h-3.5 w-3.5" />
                  </button>
                </span>
              </div>
            </div>

            <EnAlert
              v-if="detailVideo.relatedContexts?.status === 'error'"
              class="mb-4"
              color="warning"
              :title="relatedContextErrorTitle(detailVideo)"
            />

            <div
              v-if="isRelatedContextProviderRunning(detailVideo, 'jira')"
              class="mb-4 overflow-hidden rounded-xl border border-[#1868DB] bg-[#0C2B4D] text-white shadow-sm"
            >
              <div class="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
                <div class="flex items-center gap-3">
                  <span class="relative flex h-8 w-8 items-center justify-center rounded-full bg-white/10">
                    <UIcon name="i-simple-icons-jira" class="h-4 w-4" />
                    <span class="absolute inset-0 animate-ping rounded-full border border-white/20" />
                  </span>
                  <div>
                    <p class="text-sm font-semibold">Jira Issueを取得しています</p>
                    <p class="mt-0.5 text-xs text-blue-100">
                      Story候補とIssueの要約、説明、ラベル、ステータスを照合中
                    </p>
                  </div>
                </div>
                <EnBadge color="neutral" variant="soft">analyzing</EnBadge>
              </div>
              <div class="grid gap-3 bg-white p-4 md:grid-cols-2">
                <div
                  v-for="index in 4"
                  :key="`related-context-jira-skeleton-${index}`"
                  class="rounded-lg border border-slate-100 p-3"
                >
                  <div class="h-3 w-2/3 animate-pulse rounded-full bg-slate-200" />
                  <div class="mt-3 h-3 w-full animate-pulse rounded-full bg-slate-100" />
                  <div class="mt-2 h-3 w-4/5 animate-pulse rounded-full bg-slate-100" />
                </div>
              </div>
            </div>

            <div
              v-if="!isRelatedContextProviderRunning(detailVideo, 'jira') && !hasRelatedJiraContext(detailVideo)"
              class="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-6 text-center"
            >
              <UIcon name="i-simple-icons-jira" class="mx-auto h-7 w-7 text-[#1868DB]" />
              <p class="mt-3 text-sm font-semibold text-slate-700">
                Jira Issueはまだ紐付いていません
              </p>
              <p class="mt-1 text-xs text-slate-500">
                OAuth接続後、クリップに関連するIssueを理由付きで収集します
              </p>
              <NuxtLink
                to="/admin/preferences?tab=oauth-connections"
                class="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-[#1868DB] hover:underline"
              >
                Jira接続を設定
                <UIcon name="i-heroicons-arrow-top-right-on-square" class="h-3.5 w-3.5" />
              </NuxtLink>
            </div>

            <div v-else-if="hasRelatedJiraContext(detailVideo)" class="space-y-4">
              <div class="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
                <span>{{ relatedJiraSiteLabel(detailVideo) }}</span>
                <span>{{ formatRecordedAt(relatedJiraCheckedAt(detailVideo)) }}</span>
              </div>
              <div
                v-if="relatedJiraIssues(detailVideo).length === 0"
                class="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-500"
              >
                関連するJira Issueは見つかりませんでした
              </div>
              <div v-else class="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
                <article
                  v-for="issue in relatedJiraIssues(detailVideo)"
                  :key="`${detailVideo.id}-related-jira-${issue.cloudId}-${issue.key}`"
                  class="flex min-h-[188px] flex-col rounded-lg border border-slate-200 bg-white p-4 shadow-sm transition hover:border-blue-200 hover:shadow-md"
                >
                  <div class="flex items-start justify-between gap-3">
                    <div class="min-w-0">
                      <a
                        :href="issue.htmlUrl"
                        target="_blank"
                        rel="noopener noreferrer"
                        class="line-clamp-2 text-sm font-bold leading-snug text-slate-950 hover:text-[#1868DB]"
                      >
                        {{ issue.key }} {{ issue.summary }}
                      </a>
                      <p class="mt-1 text-xs text-slate-500">
                        {{ issue.project.name || "Jira" }} / {{ issue.issueType.name || "Issue" }}
                      </p>
                    </div>
                    <EnBadge color="primary" variant="soft" class="shrink-0">
                      {{ issue.relevanceScore }}
                    </EnBadge>
                  </div>
                  <p v-if="issue.reason" class="mt-3 line-clamp-3 text-xs leading-relaxed text-slate-700">
                    {{ issue.reason }}
                  </p>
                  <div class="mt-3 flex flex-wrap gap-1">
                    <EnBadge v-if="issue.status.name" color="neutral" variant="soft">
                      {{ issue.status.name }}
                    </EnBadge>
                    <EnBadge v-if="issue.priority.name" color="warning" variant="soft">
                      {{ issue.priority.name }}
                    </EnBadge>
                    <EnBadge
                      v-for="signal in issue.matchedSignals.slice(0, 2)"
                      :key="`${issue.key}-${signal}`"
                      color="neutral"
                      variant="soft"
                    >
                      {{ signal }}
                    </EnBadge>
                  </div>
                  <div class="mt-auto flex items-center justify-between gap-2 pt-3 text-[11px] text-slate-500">
                    <span>{{ issue.assignee.name || "未割当" }}</span>
                    <span>{{ formatRecordedAt(issue.updatedAt) }}</span>
                  </div>
                </article>
              </div>
            </div>
          </section>

          <section
            v-if="relatedContextProviderTab === 'github'"
            class="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"
          >
          <div class="mb-4 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h4 class="flex items-center gap-2 text-base font-bold text-slate-950">
                <UIcon name="i-simple-icons-github" class="h-4 w-4" />
                GitHub PR
              </h4>
              <p class="mt-1 text-xs text-slate-500">
                {{ relatedGithubRepoFullName(detailVideo) || application?.repoFullName || "Repository未設定" }}
              </p>
            </div>
            <EnButton
              variant="solid"
              color="neutral"
              custom-class="!border-slate-950 !bg-slate-950 !text-white shadow-lg shadow-slate-950/20 hover:!bg-slate-800 disabled:!bg-slate-400"
              size="xs"
              leading-icon="i-simple-icons-github"
              :loading="isRelatedContextProviderRunning(detailVideo, 'github')"
              :global-loading="false"
              :disabled="!application?.repoFullName || isRelatedContextProviderRunning(detailVideo, 'github')"
              @click="$emit('fetch-related-context', detailVideo.id, 'github')"
            >
              {{ hasRelatedGithubContext(detailVideo) ? "PR一覧を再取得" : "PR一覧を取得" }}
            </EnButton>
          </div>

          <EnAlert
            v-if="detailVideo.relatedContexts?.status === 'error'"
            class="mb-4"
            color="warning"
            :title="relatedContextErrorTitle(detailVideo)"
          />

          <div
            v-if="isRelatedContextProviderRunning(detailVideo, 'github')"
            class="mb-4 overflow-hidden rounded-xl border border-slate-900 bg-slate-950 text-white shadow-sm"
          >
            <div class="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
              <div class="flex items-center gap-3">
                <span class="relative flex h-8 w-8 items-center justify-center rounded-full bg-white/10">
                  <UIcon name="i-simple-icons-github" class="h-4 w-4" />
                  <span class="absolute inset-0 animate-ping rounded-full border border-white/20" />
                </span>
                <div>
                  <p class="text-sm font-semibold">
                    GitHub PRを取得しています
                  </p>
                  <p class="mt-0.5 text-xs text-slate-300">
                    クリップメモ、Story候補、PR本文、ラベル、変更ファイルを照合中
                  </p>
                </div>
              </div>
              <EnBadge color="neutral" variant="soft">
                analyzing
              </EnBadge>
            </div>
            <div class="space-y-3 bg-white p-4">
              <div
                v-for="index in 3"
                :key="`related-context-skeleton-${index}`"
                class="rounded-lg border border-slate-100 p-3"
              >
                <div class="flex items-center justify-between gap-3">
                  <div class="h-3 w-2/3 animate-pulse rounded-full bg-slate-200" />
                  <div class="h-5 w-12 animate-pulse rounded-full bg-slate-100" />
                </div>
                <div class="mt-3 h-3 w-full animate-pulse rounded-full bg-slate-100" />
                <div class="mt-2 h-3 w-4/5 animate-pulse rounded-full bg-slate-100" />
              </div>
            </div>
          </div>

          <div
            v-if="!isRelatedContextProviderRunning(detailVideo, 'github') && !hasRelatedGithubContext(detailVideo)"
            class="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-500"
          >
            GitHub PRを取得すると、クリップに関連するPRと理由がここに表示されます
          </div>

          <div v-else-if="hasRelatedGithubContext(detailVideo)" class="space-y-4">
            <div class="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
              <span>{{ relatedGithubRepoFullName(detailVideo) }}</span>
              <span>{{ formatRecordedAt(relatedGithubCheckedAt(detailVideo)) }}</span>
            </div>

            <div
              v-if="relatedGithubPullRequests(detailVideo).length === 0"
              class="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-500"
            >
              関連するPRは見つかりませんでした
            </div>

            <div v-else class="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
              <article
                v-for="pr in relatedGithubPullRequests(detailVideo)"
                :key="`${detailVideo.id}-related-pr-${pr.number}`"
                class="flex min-h-[172px] flex-col rounded-lg border border-slate-200 bg-white p-3 shadow-sm transition hover:border-slate-300 hover:shadow-md"
              >
                <div class="flex items-start justify-between gap-2">
                  <div class="min-w-0">
                    <a
                      :href="pr.htmlUrl"
                      target="_blank"
                      rel="noopener noreferrer"
                      class="line-clamp-2 text-sm font-bold leading-snug text-slate-950 hover:text-slate-700"
                    >
                      #{{ pr.number }} {{ pr.title }}
                    </a>
                    <p class="mt-1 text-xs text-slate-500">
                      {{ pr.author || "unknown" }} / {{ pr.state || "pr" }}
                    </p>
                  </div>
                  <EnBadge color="neutral" variant="soft" class="shrink-0">
                    {{ pr.relevanceScore }}
                  </EnBadge>
                </div>
                <p
                  v-if="pr.reason"
                  class="mt-2 line-clamp-2 text-xs leading-relaxed text-slate-700"
                >
                  {{ pr.reason }}
                </p>
                <div class="mt-2 flex flex-wrap gap-1">
                  <EnBadge
                    v-for="signal in pr.matchedSignals.slice(0, 2)"
                    :key="`${pr.number}-${signal}`"
                    color="neutral"
                    variant="soft"
                  >
                    {{ signal }}
                  </EnBadge>
                  <EnBadge
                    v-for="label in pr.labels.slice(0, 2)"
                    :key="`${pr.number}-label-${label}`"
                    color="neutral"
                    variant="soft"
                  >
                    {{ label }}
                  </EnBadge>
                </div>
                <div class="mt-auto flex flex-wrap items-center justify-between gap-2 pt-3 text-[11px] text-slate-500">
                  <span>{{ formatRecordedAt(pr.updatedAt || pr.mergedAt || "") }}</span>
                  <span class="flex flex-wrap gap-2">
                    <span v-if="pr.changedFiles != null">{{ pr.changedFiles }} files</span>
                    <span v-if="pr.additions != null">+{{ pr.additions }}</span>
                    <span v-if="pr.deletions != null">-{{ pr.deletions }}</span>
                  </span>
                </div>
              </article>
            </div>
          </div>
          </section>

          <section
            v-if="relatedContextProviderTab === 'slack'"
            class="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"
          >
          <div class="mb-4 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h4 class="flex items-center gap-2 text-base font-bold text-slate-950">
                <UIcon name="i-simple-icons-slack" class="h-4 w-4" />
                Slack 会話
              </h4>
              <p class="mt-1 text-xs text-slate-500">
                関連する投稿・スレッドを理由付きで紐付けます
              </p>
            </div>
            <EnButton
              variant="solid"
              color="neutral"
              size="xs"
              custom-class="!border-slate-950 !bg-slate-950 !text-white shadow-lg shadow-slate-950/15 hover:!bg-slate-800 disabled:!bg-slate-400"
              leading-icon="i-simple-icons-slack"
              :loading="isRelatedContextProviderRunning(detailVideo, 'slack')"
              :global-loading="false"
              :disabled="isRelatedContextBusy(detailVideo)"
              @click="$emit('fetch-related-context', detailVideo.id, 'slack')"
            >
              会話を取得
            </EnButton>
          </div>

          <div
            v-if="isRelatedContextProviderRunning(detailVideo, 'slack')"
            class="mb-4 overflow-hidden rounded-xl border border-slate-900 bg-slate-950 text-white shadow-sm"
          >
            <div class="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
              <div class="flex items-center gap-3">
                <span class="relative flex h-8 w-8 items-center justify-center rounded-full bg-white/10">
                  <UIcon name="i-simple-icons-slack" class="h-4 w-4" />
                  <span class="absolute inset-0 animate-ping rounded-full border border-white/20" />
                </span>
                <div>
                  <p class="text-sm font-semibold">
                    Slack会話を取得しています
                  </p>
                  <p class="mt-0.5 text-xs text-slate-300">
                    クリップメモ、Story候補、投稿本文、チャンネル、スレッドを照合中
                  </p>
                </div>
              </div>
              <EnBadge color="neutral" variant="soft">
                analyzing
              </EnBadge>
            </div>
            <div class="space-y-3 bg-white p-4">
              <div
                v-for="index in 3"
                :key="`related-context-slack-skeleton-${index}`"
                class="rounded-lg border border-slate-100 p-3"
              >
                <div class="flex items-center justify-between gap-3">
                  <div class="h-3 w-2/3 animate-pulse rounded-full bg-slate-200" />
                  <div class="h-5 w-12 animate-pulse rounded-full bg-slate-100" />
                </div>
                <div class="mt-3 h-3 w-full animate-pulse rounded-full bg-slate-100" />
                <div class="mt-2 h-3 w-4/5 animate-pulse rounded-full bg-slate-100" />
              </div>
            </div>
          </div>

          <div
            v-if="!isRelatedContextProviderRunning(detailVideo, 'slack') && !hasRelatedSlackContext(detailVideo)"
            class="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-500"
          >
            Slack会話を取得すると、クリップに関連する投稿と理由がここに表示されます
          </div>

          <div v-else-if="hasRelatedSlackContext(detailVideo)" class="space-y-4">
            <div class="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
              <span>{{ relatedSlackTeamLabel(detailVideo) }}</span>
              <span>{{ formatRecordedAt(relatedSlackCheckedAt(detailVideo)) }}</span>
            </div>

            <div
              v-if="relatedSlackMessages(detailVideo).length === 0"
              class="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-500"
            >
              関連するSlack会話は見つかりませんでした
            </div>

            <div v-else class="space-y-3">
              <article
                v-for="message in relatedSlackMessages(detailVideo)"
                :key="`${detailVideo.id}-related-slack-${message.channelId}-${message.messageTs}`"
                class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
              >
                <div class="flex flex-wrap items-start justify-between gap-3">
                  <div class="min-w-0">
                    <a
                      v-if="message.permalink"
                      :href="message.permalink"
                      target="_blank"
                      rel="noopener noreferrer"
                      class="text-sm font-bold text-slate-950 hover:text-slate-700"
                    >
                      #{{ message.channelName || message.channelId || "slack" }}
                    </a>
                    <p v-else class="text-sm font-bold text-slate-950">
                      #{{ message.channelName || message.channelId || "slack" }}
                    </p>
                    <p class="mt-1 text-xs text-slate-500">
                      {{ message.author || "unknown" }} / {{ message.postedAt || message.messageTs }}
                    </p>
                  </div>
                  <EnBadge color="neutral" variant="soft">
                    {{ message.relevanceScore }}
                  </EnBadge>
                </div>
                <p
                  v-if="message.text"
                  class="mt-3 line-clamp-3 whitespace-pre-wrap text-sm leading-relaxed text-slate-700"
                >
                  {{ message.text }}
                </p>
                <p
                  v-if="message.reason"
                  class="mt-3 text-sm leading-relaxed text-slate-700"
                >
                  {{ message.reason }}
                </p>
                <div class="mt-3 flex flex-wrap gap-1">
                  <EnBadge
                    v-for="signal in message.matchedSignals"
                    :key="`${message.messageTs}-${signal}`"
                    color="neutral"
                    variant="soft"
                  >
                    {{ signal }}
                  </EnBadge>
                </div>
              </article>
            </div>
          </div>
          </section>
        </div>

      </div>
    </div>

    <div
      v-else
      class="space-y-4"
    >
      <div class="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-3 shadow-sm md:flex-row md:items-center md:justify-between">
        <UInput
          v-model="videoSearchQuery"
          icon="material-symbols:search"
          size="sm"
          placeholder="タイトル・説明・解析メモで検索"
          class="min-w-0 md:w-[360px]"
        />
        <div class="flex flex-wrap gap-1">
          <button
            v-for="filter in videoStatusFilters"
            :key="filter.value"
            type="button"
            class="rounded-md px-3 py-1.5 text-xs font-semibold transition"
            :class="videoStatusFilter === filter.value ? 'bg-slate-950 text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900'"
            @click="videoStatusFilter = filter.value"
          >
            {{ filter.label }}
          </button>
        </div>
      </div>

      <div
        v-if="clipGroups.length === 0"
        class="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500"
      >
        最初にクリップグループを作成してください。グループを選ぶと新規録画を開始できます。
        <div class="mt-3">
          <EnButton
            variant="ai"
            size="sm"
            leading-icon="material-symbols:create-new-folder-outline"
            :disabled="!application"
            @click="openGroupCreateModal"
          >
            クリップグループを作成
          </EnButton>
        </div>
      </div>

      <div
        v-else
        class="grid gap-4 xl:grid-cols-[20rem_minmax(0,1fr)] 2xl:grid-cols-[22rem_minmax(0,1fr)]"
      >
        <aside class="rounded-lg border border-slate-200 bg-white p-2 shadow-sm">
          <div
            v-for="group in clipGroups"
            :key="group.id"
            class="group mb-1 grid min-w-0 rounded-md p-1 transition"
            :class="selectedVideoGroupId === group.id ? 'bg-slate-100 text-slate-950 shadow-sm ring-1 ring-slate-300' : 'text-slate-600 hover:bg-slate-50'"
          >
            <button
              type="button"
              class="grid min-w-0 gap-1 rounded-md px-3 py-2 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-300"
              @click="selectedVideoGroupId = group.id"
            >
              <span class="line-clamp-2 break-words text-sm font-bold leading-snug">{{ group.name }}</span>
              <span
                class="line-clamp-2 text-xs"
                :class="selectedVideoGroupId === group.id ? 'text-slate-600' : 'text-slate-500'"
              >
                {{ group.description || "説明なし" }}
              </span>
              <span
                class="mt-1 w-fit rounded-full px-2 py-0.5 text-[11px] font-bold"
                :class="selectedVideoGroupId === group.id ? 'bg-white text-slate-700 ring-1 ring-slate-200' : 'bg-slate-100 text-slate-600'"
              >
                {{ groupVideoCount(group.id) }} clips
              </span>
            </button>
            <div class="flex min-w-0 items-center justify-between gap-2 px-3 pb-2">
              <button
                type="button"
                class="inline-flex min-w-0 max-w-full items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 font-mono text-[11px] font-bold text-slate-500 opacity-0 shadow-sm transition hover:border-cyan-200 hover:bg-cyan-50 hover:text-cyan-700 focus:opacity-100 focus:outline-none focus:ring-2 focus:ring-cyan-100 group-hover:opacity-100"
                :title="`グループIDをコピー: ${group.id}`"
                @click.stop="copyIdToClipboard(group.id, 'グループID')"
              >
                <UIcon name="material-symbols:content-copy-outline" class="h-3.5 w-3.5 shrink-0" />
                <span class="truncate">ID {{ compactId(group.id) }}</span>
              </button>
              <button
                type="button"
                class="grid h-8 w-8 shrink-0 place-items-center rounded-md text-slate-400 opacity-0 transition hover:bg-red-50 hover:text-red-600 focus:opacity-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-200 group-hover:opacity-100 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-slate-300"
                :class="groupVideoCount(group.id) > 0 ? 'text-slate-300' : ''"
                :disabled="groupVideoCount(group.id) > 0"
                :title="groupVideoCount(group.id) > 0 ? 'クリップがあるグループは削除できません' : 'クリップグループを削除'"
                aria-label="クリップグループを削除"
                @click.stop="openGroupDeleteConfirm(group)"
              >
                <UIcon
                  name="material-symbols:delete-outline"
                  class="h-4 w-4"
                />
              </button>
            </div>
          </div>
        </aside>

        <div
          v-if="selectedGroupClipItems.length === 0"
          class="flex min-h-[168px] flex-col items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50 p-6 text-center"
        >
          <span class="flex h-11 w-11 items-center justify-center rounded-lg bg-white text-slate-500 shadow-sm ring-1 ring-slate-200">
            <UIcon name="material-symbols:video-camera-back-outline" class="h-5 w-5" />
          </span>
          <p class="mt-3 text-sm font-semibold text-slate-700">
            このグループにはまだクリップがありません
          </p>
          <EnButton
            class="mt-4"
            variant="ai"
            size="sm"
            leading-icon="material-symbols:video-camera-back-outline"
            :disabled="!canCapture"
            @click="openRecordingModal"
          >
            新しいクリップを録画
          </EnButton>
        </div>

        <div
          v-else-if="filteredGroupClipItems.length === 0"
          class="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500"
        >
          条件に合うクリップはありません
        </div>

        <div
          v-else
          class="grid gap-4 md:grid-cols-2 2xl:grid-cols-3"
        >
          <article
            v-for="item in filteredGroupClipItems"
            :key="item.key"
            class="group cursor-pointer overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:border-slate-400 hover:shadow-md focus-within:border-slate-900 focus-within:ring-2 focus-within:ring-slate-200"
            tabindex="0"
            role="button"
            @click="openClipDetail(item)"
            @keydown.enter.prevent="openClipDetail(item)"
            @keydown.space.prevent="openClipDetail(item)"
          >
            <div class="relative bg-slate-950">
              <video
                v-if="clipVideoUrl(item.clip, item.clip)"
                :src="clipVideoUrl(item.clip, item.clip)"
                preload="metadata"
                muted
                playsinline
                class="aspect-video w-full bg-slate-950 object-contain"
              />
              <div
                v-else
                class="flex aspect-video w-full items-center justify-center bg-slate-950 text-xs text-slate-300"
              >
                クリップURLを取得中
              </div>
              <div class="absolute left-3 top-3 flex flex-wrap gap-1">
                <EnBadge
                  v-if="item.clip.analysisStatus !== 'completed'"
                  :color="analysisColor(item.clip.analysisStatus)"
                  variant="soft"
                >
                  {{ analysisLabel(item.clip.analysisStatus) }}
                </EnBadge>
              </div>
              <div class="absolute right-3 top-3" @click.stop>
                <button
                  type="button"
                  class="inline-flex h-8 w-8 items-center justify-center rounded-md border border-white/20 bg-slate-950/80 text-white shadow-sm transition hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-cyan-300"
                  :aria-label="`${clipTitle(item.clip, 0)}の操作メニュー`"
                  title="クリップ操作"
                  @click="toggleClipActionMenu(item.clip.id)"
                >
                  <UIcon name="material-symbols:more-vert" class="h-4 w-4" />
                </button>
                <div
                  v-if="clipActionMenuId === item.clip.id"
                  class="absolute right-0 z-20 mt-2 w-56 rounded-lg border border-slate-200 bg-white p-2 text-left shadow-xl"
                >
                  <p class="px-2 pb-1 text-[10px] font-bold uppercase tracking-wide text-slate-400">グループへ移動</p>
                  <select
                    class="w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-700 focus:border-cyan-400 focus:outline-none focus:ring-2 focus:ring-cyan-100"
                    :value="item.clip.clipGroupId"
                    @change="moveClipToGroup(item.clip.id, ($event.target as HTMLSelectElement).value)"
                  >
                    <option v-for="group in clipGroups" :key="group.id" :value="group.id">{{ group.name }}</option>
                  </select>
                  <div class="my-2 border-t border-slate-100" />
                  <button
                    type="button"
                    class="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs font-semibold text-red-600 transition hover:bg-red-50"
                    @click="openVideoDeleteConfirm(item.clip)"
                  >
                    <UIcon name="material-symbols:delete-outline" class="h-4 w-4" />
                    削除
                  </button>
                </div>
              </div>
            </div>

            <div class="space-y-3 p-4">
              <div class="flex min-w-0 items-start gap-2">
                <span class="mt-0.5 inline-flex shrink-0 items-center rounded-md bg-slate-950 px-2 py-1 text-xs font-semibold text-white shadow-sm">
                  Clip
                </span>
                <div class="min-w-0 flex-1">
                  <input
                    v-if="editingVideoTitleId === item.clip.id"
                    ref="videoTitleInput"
                    v-model="editingVideoTitleDraft"
                    class="w-full rounded-lg border border-slate-200 px-3 py-2 text-base font-bold leading-snug text-slate-950 shadow-sm focus:border-cyan-400 focus:outline-none focus:ring-2 focus:ring-cyan-100"
                    :disabled="updatingVideoTitleId === item.clip.id"
                    @click.stop
                    @keydown.enter.prevent.stop="commitClipTitleEdit(item.clip, 0)"
                    @keydown.esc.prevent.stop="cancelVideoTitleEdit"
                    @blur="commitClipTitleEdit(item.clip, 0)"
                  >
                  <button
                    v-else
                    type="button"
                    class="line-clamp-2 rounded-lg px-1 py-0.5 text-left text-base font-bold leading-snug text-slate-950 transition group-hover:text-slate-700 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-200"
                    title="クリックして名称を変更"
                    @click.stop="startClipTitleEdit(item.clip, 0)"
                  >
                    {{ clipTitle(item.clip, 0) }}
                  </button>
                  <p class="mt-1 text-xs text-slate-500">
                    {{ formatRecordedAt(item.clip.recordedAt) }}
                  </p>
                  <button
                    type="button"
                    class="mt-2 inline-flex max-w-full items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-0.5 font-mono text-[11px] font-bold text-slate-500 shadow-sm transition hover:border-cyan-200 hover:bg-cyan-50 hover:text-cyan-700 focus:outline-none focus:ring-2 focus:ring-cyan-100"
                    :title="`クリップIDをコピー: ${item.clip.id}`"
                    @click.stop="copyIdToClipboard(item.clip.id, 'クリップID')"
                  >
                    <UIcon name="material-symbols:content-copy-outline" class="h-3.5 w-3.5 shrink-0" />
                    <span class="truncate">ID {{ compactId(item.clip.id) }}</span>
                  </button>
                </div>
              </div>

              <div class="rounded-md bg-slate-50 px-3 py-2">
                <p class="text-[11px] font-semibold text-slate-500">
                  要約
                </p>
                <p class="mt-1 line-clamp-2 text-xs leading-relaxed text-slate-600">
                  {{ displayClipDescription(item) || "未生成" }}
                </p>
              </div>

              <ol
                v-if="operationSteps(item.clip).length > 0"
                class="space-y-1 rounded-md bg-slate-50 px-3 py-2"
              >
                <li
                  v-for="(step, index) in operationSteps(item.clip).slice(0, 3)"
                  :key="`${item.clip.id}-card-step-${index}`"
                  class="flex gap-2 text-[11px] leading-5 text-slate-600"
                >
                  <span class="font-mono font-bold text-slate-400">{{ index + 1 }}</span>
                  <span class="line-clamp-1">{{ step }}</span>
                </li>
              </ol>

              <div class="grid grid-cols-2 gap-2">
                <div class="rounded-md bg-slate-50 px-3 py-2">
                  <p class="text-[11px] font-semibold text-slate-500">
                    User Story
                  </p>
                  <p class="mt-1 text-sm font-semibold text-slate-900">
                    {{ storyCandidateCount(item.clip) }}
                  </p>
                </div>
                <div class="rounded-md bg-slate-50 px-3 py-2">
                  <p class="text-[11px] font-semibold text-slate-500">
                    Context
                  </p>
                  <p class="mt-1 text-sm font-semibold text-slate-900">
                    {{ relatedContextCount(item.clip) }}
                  </p>
                </div>
              </div>

              <div class="flex flex-wrap items-center gap-1.5 border-t border-slate-100 pt-3">
                <span
                  v-for="provider in clipCardContextProviders(item.clip)"
                  :key="`${item.clip.id}-context-provider-${provider.id}`"
                  class="inline-flex h-7 min-w-10 items-center justify-center gap-1 rounded-md px-2 text-[11px] font-bold ring-1 ring-inset transition"
                  :class="provider.count > 0 ? provider.activeClass : 'bg-slate-50 text-slate-400 ring-slate-200'"
                  :title="`${provider.label}: ${provider.count}件`"
                >
                  <UIcon :name="provider.icon" class="h-3.5 w-3.5 shrink-0" />
                  <span>{{ provider.count }}</span>
                </span>
              </div>

              <div class="flex flex-wrap gap-2 text-[11px] text-slate-500">
                <span>{{ displayVideoTitle(item.clip) }}</span>
                <span>{{ formatDuration(item.clip.durationMs) }}</span>
                <span>{{ formatBytes(item.clip.sizeBytes) }}</span>
                <span>{{ displaySurfaceLabel(item.clip.sourceDisplaySurface) }}</span>
                <span>{{ discoveryLabel(item.clip.discoveryStatus) }}</span>
              </div>
            </div>
          </article>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { getAuth } from "firebase/auth";
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from "vue";
import type { ComponentPublicInstance } from "vue";
import * as XLSX from "xlsx";
import { getBlob, getDownloadURL } from "firebase/storage";
import { storageRefForBucketPath } from "@composables/firebase-storage-operations";
import { reportDatadogError } from "@utils/datadogObservability";
import { formatUserStoryKey } from "@utils/storyVaultStoryKeys";
import {
  analyzeAudioTimeline,
  editedStoryVaultDurationMs,
  normalizeStoryVaultCutRanges,
  type StoryVaultAudioLevelSample,
  type StoryVaultSilenceRange,
} from "@utils/storyVaultClipEditing";
import type {
  StoryVaultClipPreparationLog,
  StoryVaultClipPreparationProgress,
} from "@composables/useStoryVaultClipPreparation";
import type {
  StoryVaultClipDraft,
  StoryVaultClipDraftTranscription,
} from "@composables/useStoryVaultClipDrafts";
import {
  sectionSplitPointsMs,
  sliceStoryVaultTranscriptCues,
  type StoryVaultClipSectionDraft,
} from "@utils/storyVaultClipSectioning";
import {
  formatTranscriptTime,
  normalizeTranscriptCues,
  parseSrtTranscript,
  transcriptCuesToSrt,
} from "@utils/transcriptTiming";
import KnowledgeDocumentCompactCard from "@components/knowledge/KnowledgeDocumentCompactCard.vue";
import { useJiraOAuth, type JiraIssuePreview } from "@composables/useJiraOAuth";
import { useGeminiFileSpaceOperatorStore } from "@stores/geminiFileSpaceOperator";
import type {
  DecodedStoryVaultApplication,
  DecodedStoryVaultClipGroup,
  DecodedStoryVaultClip,
  StoryVaultRelatedContextKnowledgeDocument,
  StoryVaultRelatedContextJiraIssue,
  StoryVaultOperationVideoDiscoveryStatus,
  StoryVaultOperationVideoDisplaySurface,
  StoryVaultOperationVideoClip,
  StoryVaultTranscriptCue,
  StoryVaultTranscriptTimingStatus,
  StoryVaultZappingAnalysisStoryCandidate,
  StoryVaultZappingAnalysisStatus,
} from "@models/storyVault";
import type { Document } from "@models/document";
import type {
  StoryVaultClipAnalysisInput,
  StoryVaultClipListItem,
  StoryVaultClipSaveInput,
} from "@stores/storyVault";

type OperationVideoSaveCallbacks = {
  onSuccess?: (clip: DecodedStoryVaultClip) => void;
  onError?: (message: string) => void;
};

type OperationVideoTitleUpdateCallbacks = {
  onSuccess?: () => void;
  onError?: (message: string) => void;
};

type OperationVideoAnalyzeOptions = {
  inline?: boolean;
};

type OperationVideoAnalyzeCallbacks = {
  onStarted?: () => void;
  onError?: (message: string) => void;
};

type ClipGroupAssistantPlanGroup = {
  existingGroupId?: string;
  name: string;
  description?: string;
  clipIds: string[];
  reason?: string;
};

type ClipGroupAssistantPlan = {
  summary: string;
  groups: ClipGroupAssistantPlanGroup[];
};

type ClipGroupOrganizationCallbacks = {
  onSuccess?: () => void;
  onError?: (message: string) => void;
  onFinally?: () => void;
};

type LocalFrameCapture = {
  id: string;
  timestampMs: number;
  blob: Blob;
  contentType: string;
  width: number;
  height: number;
  previewUrl: string;
};

type SaveProgressPhase =
  | "idle"
  | "preparing"
  | "parallelAnalysis"
  | "saving"
  | "extracting"
  | "transcribing"
  | "summarizing"
  | "scanning"
  | "analysisSaving"
  | "uploading"
  | "done"
  | "error";

type SaveWorkflowStep = "save" | "videoAnalysis";

type ClipPreparationPhase =
  | "idle"
  | "trimming"
  | "transcribing"
  | "sectioning"
  | "done"
  | "error";

type ClipPreparationStepStatus = "pending" | "active" | "done" | "error";

type ClipPreparationProgressStep = {
  key: string;
  label: string;
  description: string;
  status: ClipPreparationStepStatus;
};

type PreparedRecordingClip = {
  blob: Blob;
  durationMs: number;
  gcsUri: string;
};

type SaveProgressStep = {
  key: string;
  index: number;
  label: string;
  description: string;
  status: SaveProgressStepStatus;
  statusLabel: string;
};

type SaveProgressStepStatus = "pending" | "active" | "done" | "error";

type SaveProgressInsightArtifact = {
  label: string;
  value: string;
  icon: string;
};

type SaveProgressInsight = {
  heading: string;
  subheading: string;
  badge: string;
  noteCount: number;
  lines: string[];
  artifacts: SaveProgressInsightArtifact[];
};
type DetailTab =
  | "video"
  | "videoAnalysis"
  | "storyAnalysis"
  | "videoGeneration"
  | "relatedContext"
  | "report"
  | "mcpTest";
type ReportMode = "html" | "markdown" | "json" | "excel";
type RelatedContextProviderTab = "knowledge" | "github" | "slack" | "jira";
type SelectedClipContentTab = "transcript" | "summary";
type SelectedClipLayoutMode = "split" | "stack";

type ClipCardContextProvider = {
  id: "knowledge" | "github" | "slack" | "jira";
  label: string;
  icon: string;
  count: number;
  activeClass: string;
};

type GroupClipItem = StoryVaultClipListItem;

type RichTranscriptSummarySection = {
  title: string;
  body: string;
};

type ZappingAnalysisEvidence =
  StoryVaultZappingAnalysisStoryCandidate["evidence"][number];
type TranscriptOwner = Pick<
  DecodedStoryVaultClip,
  "transcriptText" | "transcriptProvider" | "transcriptSegments" | "transcriptSrt" | "transcriptTimingStatus"
>;

type ContextMapNodeKind =
  | "video"
  | "transcript"
  | "screen"
  | "analysis"
  | "story"
  | "knowledge"
  | "github"
  | "slack"
  | "jira"
  | "generation";

type ContextMapNode = {
  id: string;
  kind: ContextMapNodeKind;
  label: string;
  title: string;
  subtitle: string;
  value: string;
  icon: string;
  x: number;
  y: number;
  tone: "cyan" | "emerald" | "amber" | "rose" | "violet" | "slate";
  details: string[];
};

type ContextMapEdge = {
  id: string;
  from: string;
  to: string;
  tone: ContextMapNode["tone"];
};

type ContextMapEdgeWithPoints = ContextMapEdge & {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
};

type ContextMapData = {
  nodes: ContextMapNode[];
  edges: ContextMapEdge[];
};

type BulkContextStep = {
  key: "knowledge" | "github" | "jira";
  label: string;
  icon: string;
  status: "pending" | "running" | "done";
};

type ContextMapNodePosition = {
  x: number;
  y: number;
};

type ContextMapDragState = {
  nodeId: string;
  moved: boolean;
};

const ALL_CLIPS_SELECTION_ID = "__all_clips__";

declare global {
  interface Window {
    webkitAudioContext?: typeof AudioContext;
  }
}

const props = defineProps<{
  application: DecodedStoryVaultApplication | null;
  clipRecords: DecodedStoryVaultClip[];
  clips: StoryVaultClipListItem[];
  clipGroups: DecodedStoryVaultClipGroup[];
  isSaving: boolean;
  isAnalyzing?: boolean;
  isFetchingRelatedContexts?: boolean;
  isProvisioningFileSpace?: boolean;
}>();

const emit = defineEmits<{
  save: [
    input: StoryVaultClipSaveInput,
    callbacks?: OperationVideoSaveCallbacks,
  ];
  "update-clip-analysis": [
    input: StoryVaultClipAnalysisInput,
    callbacks?: OperationVideoSaveCallbacks,
  ];
  analyze: [
    clipId: string,
    options?: OperationVideoAnalyzeOptions,
    callbacks?: OperationVideoAnalyzeCallbacks,
  ];
  "update-title": [
    clipId: string,
    title: string,
    callbacks?: OperationVideoTitleUpdateCallbacks,
  ];
  "fetch-related-context": [clipId: string, provider: "github" | "slack" | "knowledge" | "jira"];
  "collect-related-contexts": [clipId: string];
  "link-jira-issues": [
    clipId: string,
    issues: StoryVaultRelatedContextJiraIssue[],
    site?: { name?: string; url?: string },
  ];
  "unlink-jira-issue": [clipId: string, issueKey: string, cloudId?: string];
  "link-knowledge-documents": [
    clipId: string,
    fileSpaceId: string,
    documents: StoryVaultRelatedContextKnowledgeDocument[],
  ];
  "unlink-knowledge-document": [clipId: string, documentId: string];
  "create-clip-group": [input: { applicationId: string; name: string; description?: string }];
  "update-clip-group": [input: { groupId: string; name: string; description?: string }];
  "delete-clip-group": [groupId: string];
  "apply-clip-group-organization-plan": [
    plan: ClipGroupAssistantPlan,
    callbacks?: ClipGroupOrganizationCallbacks,
  ];
  "move-clip": [clipId: string, groupId: string];
  "create-file-space": [];
  delete: [clipId: string];
  refresh: [];
}>();

const toast = useToast();
const jiraOAuth = useJiraOAuth();
const clipPipelineApi = useStoryVaultClipPipelines();
const clipCommandApi = useStoryVaultClipCommands();
const {
  prepare: prepareRecordedClips,
  resume: resumeRecordedClipPreparation,
} = useStoryVaultClipPreparation();
const {
  drafts: clipDrafts,
  isLoadingDrafts,
  fetchDrafts: fetchClipDrafts,
  createDraft: createClipDraft,
  updateDraft: updateClipDraft,
  loadDraftSource,
  loadPreparedDraftVideo,
  discardDraft: discardClipDraft,
} = useStoryVaultClipDrafts();
const { generateSections: generateTranscriptSections } =
  useStoryVaultTranscriptSectioning();
const title = ref("");
const errorMessage = ref("");
const sourceDisplaySurface = ref<StoryVaultOperationVideoDisplaySurface>("unknown");
const isRecording = ref(false);
const recordingModalOpen = ref(false);
const clipActionMenuId = ref("");
const assistantPanelOpen = ref(false);
const elapsedMs = ref(0);
const recordedDurationMs = ref<number | undefined>();
const recordedBlob = ref<Blob | null>(null);
const recordedAudioBlob = ref<Blob | null>(null);
const previewUrl = ref("");
const preparedPreviewUrl = ref("");
const preparedBaseClip = ref<PreparedRecordingClip | null>(null);
const preparedTranscription = ref<GeminiTranscriptionResult | null>(null);
const aiSectionDrafts = ref<StoryVaultClipSectionDraft[]>([]);
const preparedSilenceFingerprint = ref("");
const clipPreparationPhase = ref<ClipPreparationPhase>("idle");
const clipPreparationError = ref("");
const clipPreparationProgressOpen = ref(false);
const clipPreparationProgress = ref<StoryVaultClipPreparationProgress | null>(null);
const activeClipDraftId = ref("");
const isSavingClipDraft = ref(false);
const clipDraftSaveError = ref("");
const clipDraftLastSavedAt = ref("");
const resumingClipDraftId = ref("");
const isRestoringClipDraft = ref(false);
const discardClipDraftTarget = ref<StoryVaultClipDraft | null>(null);
const discardClipDraftConfirmOpen = ref(false);
const discardingClipDraftId = ref("");
const livePreviewVideo = ref<HTMLVideoElement | null>(null);
const recordedPreviewVideo = ref<HTMLVideoElement | null>(null);
const silenceTimeline = ref<HTMLElement | null>(null);
const recordedPreviewMs = ref(0);
const isRecordedPreviewPlaying = ref(false);
const isScrubbingSilenceTimeline = ref(false);
const isSelectingManualCutRange = ref(false);
const manualRangeSelectionActive = ref(false);
const manualCutSelectionAnchorMs = ref<number | null>(null);
const manualCutSelectionCurrentMs = ref<number | null>(null);
const silenceCutEnabled = ref(true);
const noiseReductionEnabled = ref(true);
const silenceRanges = ref<StoryVaultSilenceRange[]>([]);
const manualCutRanges = ref<StoryVaultSilenceRange[]>([]);
const audioLevelSamples = ref<StoryVaultAudioLevelSample[]>([]);
const keptSilenceRangeIndexes = ref<number[]>([]);
const splitPointsMs = ref<number[]>([]);
const clipEditingStep = ref<1 | 2>(1);
const recordingProcessingMode = ref<"automatic" | "manual">("automatic");
const isStartingAutomaticPipeline = ref(false);
const continueRecordingPromptOpen = ref(false);
const submittedPipelineCount = ref(0);
const lastSubmittedRecordingTitle = ref("");
const isAnalyzingSilence = ref(false);
const isPreparingClips = ref(false);
const parallelAnalysisCompleted = ref(0);
const parallelAnalysisTotal = ref(0);
const selectedClipVideo = ref<HTMLVideoElement | null>(null);
const selectedClipPlaybackMs = ref(0);
const selectedClipTranscriptScroller = ref<HTMLElement | null>(null);
const selectedClipTranscriptCueElements = new Map<string, HTMLElement>();
const lastScrolledSelectedClipCueId = ref("");
const microphoneActive = ref(false);
const waveformBars = ref(Array.from({ length: 40 }, () => 0.06));
const audioLevel = ref(0);
const isExtractingFrames = ref(false);
const frameCaptures = ref<LocalFrameCapture[]>([]);
const quickScan = ref<DecodedStoryVaultClip["quickScan"]>();
const transcriptText = ref("");
const transcriptProvider = ref("");
const transcriptSummary = ref("");
const transcriptSegments = ref<StoryVaultTranscriptCue[]>([]);
const transcriptSrt = ref("");
const transcriptTimingStatus = ref<StoryVaultTranscriptTimingStatus>("unavailable");
const transcriptErrorMessage = ref("");
const saveProgressOpen = ref(false);
const saveProgressPhase = ref<SaveProgressPhase>("idle");
const saveProgressFramePreviewIndex = ref(0);
const saveProgressActivitySeconds = ref(0);
const saveWorkflowStep = ref<SaveWorkflowStep>("save");
const workflowVideoId = ref("");
const workflowClipId = ref("");
const selectedVideoId = ref("");
const detailVideoId = ref("");
const selectedClipId = ref("");
const detailClipPickerOpen = ref(false);
const detailClipPickerRoot = ref<HTMLElement | null>(null);
const selectedClipContentTab = ref<SelectedClipContentTab>("transcript");
const selectedClipLayoutMode = ref<SelectedClipLayoutMode>("split");
const downloadingClipKey = ref("");
const contextMapOpen = ref(false);
const contextMapVideoId = ref("");
const selectedContextMapNodeId = ref("");
const contextMapZoom = ref(1);
const contextMapNodePositions = reactive<Record<string, ContextMapNodePosition>>({});
const contextMapGraphSurface = ref<HTMLElement | null>(null);
const contextMapDragState = ref<ContextMapDragState | null>(null);
const selectedVideoGroupId = ref("");
const detailTab = ref<DetailTab>("video");
const reportMode = ref<ReportMode>("html");
const relatedContextProviderTab = ref<RelatedContextProviderTab>("knowledge");
const bulkContextModalOpen = ref(false);
const bulkContextCompleted = ref(false);
const bulkContextTimer = ref<ReturnType<typeof setTimeout> | null>(null);
const bulkContextSteps = ref<BulkContextStep[]>([
  { key: "knowledge", label: "ボルトナレッジ", icon: "material-symbols:folder-managed-outline", status: "pending" },
  { key: "github", label: "GitHub", icon: "i-simple-icons-github", status: "pending" },
  { key: "jira", label: "Jira", icon: "i-simple-icons-jira", status: "pending" },
]);
const jiraConnections = computed(() => jiraOAuth.connections.value);
const knowledgeFileSpaceStore = useGeminiFileSpaceOperatorStore();
const knowledgeManualSearchQuery = ref("");
const selectedKnowledgeDocumentIds = ref<string[]>([]);
const isKnowledgeManualLoading = ref(false);
const knowledgeManualError = ref("");
const knowledgeManualDocuments = computed(() => {
  const query = knowledgeManualSearchQuery.value.trim().toLocaleLowerCase();
  const documents = knowledgeFileSpaceStore.documents ?? [];
  if (!query) return documents;
  return documents.filter((document) =>
    [document.displayName, document.title, document.name, document.description]
      .filter(Boolean)
      .some((value) => String(value).toLocaleLowerCase().includes(query))
  );
});
const jiraSelectedCloudId = ref("");
const jiraSearchQuery = ref("");
const jiraSearchResults = ref<JiraIssuePreview[]>([]);
const jiraSearchError = ref("");
const isJiraSearching = ref(false);
const jiraListMode = ref<"project" | "search">("project");
const selectedJiraIssueKeys = ref<string[]>([]);
const selectedJiraConnection = computed(() =>
  jiraConnections.value.find(
    (connection) => connection.cloudId === jiraSelectedCloudId.value
  ) ?? jiraConnections.value[0]
);
const reportHtmlUrl = ref("");
const reportCopied = ref(false);
const selectedAnalysisStoryId = ref("");
const videoSearchQuery = ref("");
const videoStatusFilter = ref<"all" | StoryVaultZappingAnalysisStatus>("all");
const groupCreateModalOpen = ref(false);
const groupNameDraft = ref("");
const groupDescriptionDraft = ref("");
const isApplyingOrganizationPlan = ref(false);

function compactId(id: string): string {
  if (id.length <= 18) return id;
  return `${id.slice(0, 8)}...${id.slice(-6)}`;
}

async function copyIdToClipboard(id: string, label: string): Promise<void> {
  if (!id) return;
  if (!import.meta.client || !navigator.clipboard?.writeText) {
    toast.add({ title: `${label}をコピーできませんでした`, color: "error" });
    return;
  }
  try {
    await navigator.clipboard.writeText(id);
    toast.add({ title: `${label}をコピーしました`, color: "success" });
  } catch {
    toast.add({ title: `${label}のコピーに失敗しました`, color: "error" });
  }
}
const pendingCreatedGroupName = ref("");
const quickScanPreviewVideoId = ref("");
const deleteTargetGroup = ref<DecodedStoryVaultClipGroup | null>(null);
const deleteGroupConfirmOpen = ref(false);
const deleteTargetVideoId = ref("");
const deleteVideoConfirmOpen = ref(false);
const deleteTargetClipVideoId = ref("");
const deleteTargetClipId = ref("");
const deleteClipConfirmOpen = ref(false);
const editingVideoTitleId = ref("");
const editingVideoTitleDraft = ref("");
const updatingVideoTitleId = ref("");
const videoTitleInput = ref<HTMLInputElement | null>(null);
const selectedClipPlaybackRates = [
  { label: "等速", value: 1 },
  { label: "2倍", value: 2 },
  { label: "3倍", value: 3 },
] as const;
const selectedClipPlaybackRate = ref<(typeof selectedClipPlaybackRates)[number]["value"]>(1);
const selectedClipLayoutModes = [
  { label: "2列", value: "split" },
  { label: "1列", value: "stack" },
] as const;
const videoUrls = reactive<Record<string, string>>({});
const clipVideoUrls = reactive<Record<string, string>>({});
const frameUrls = reactive<Record<string, string>>({});
const clipFrameUrls = reactive<Record<string, string>>({});
const GEMINI_TRANSCRIPTION_AUDIO_MAX_BYTES = 18 * 1024 * 1024;
const route = useRoute();
const reportModes = [
  { value: "html", label: "HTML" },
  { value: "markdown", label: "Markdown" },
  { value: "json", label: "JSON" },
  { value: "excel", label: "Excel" },
] as const;

let mediaRecorder: MediaRecorder | null = null;
let audioRecorder: MediaRecorder | null = null;
let mediaStream: MediaStream | null = null;
let displayStream: MediaStream | null = null;
let microphoneStream: MediaStream | null = null;
let audioContext: AudioContext | null = null;
let analyser: AnalyserNode | null = null;
let waveformRaf: number | null = null;
let startedAt = 0;
let elapsedTimer: number | null = null;
let saveProgressFramePreviewTimer: ReturnType<typeof setInterval> | null = null;
let saveProgressActivityTimer: ReturnType<typeof setInterval> | null = null;
let clipDraftAutosaveTimer: ReturnType<typeof setTimeout> | null = null;
let chunks: BlobPart[] = [];
let audioChunks: BlobPart[] = [];
let lastAudioMimeType = "audio/webm";

const selectedVideoGroup = computed(
  () =>
    props.clipGroups.find(
      (group) => group.id === selectedVideoGroupId.value
    ) ?? props.clipGroups[0] ?? null
);
const totalClipCount = computed(() =>
  props.clips.length
);
const selectedGroupClipItems = computed<GroupClipItem[]>(() => {
  const group = selectedVideoGroup.value;
  if (!group) return [];
  return props.clips.filter((item) => item.clipGroupId === group.id);
});
const applicationClipDrafts = computed(() =>
  clipDrafts.value.filter(
    (draft) =>
      draft.applicationId === (props.application?.id || "") &&
      // A submitted recording belongs to the background pipeline, not the
      // manual-editor draft queue. Pipeline failures restore it as `error`.
      draft.status !== "processing"
  )
);
const activeClipDraft = computed(() =>
  applicationClipDrafts.value.find((draft) => draft.id === activeClipDraftId.value) ?? null
);
const activeClipDraftIsPersisted = computed(
  () => Boolean(activeClipDraft.value?.source) && activeClipDraft.value?.status !== "saving"
);
function groupVideoCount(groupId: string): number {
  return props.clips.filter((item) => item.clipGroupId === groupId).length;
}
const canCapture = computed(
  () => Boolean(props.application?.id && selectedVideoGroup.value) && !props.isSaving
);
const sourceRecordingDurationMs = computed(
  () => recordedDurationMs.value ?? elapsedMs.value
);
const silenceThresholdDb = -38;
const minimumSilenceMs = 5_000;
const cutSilenceRanges = computed(() =>
  silenceRanges.value.filter(
    (_, index) => !keptSilenceRangeIndexes.value.includes(index)
  )
);
const selectedCutRanges = computed(() =>
  normalizeStoryVaultCutRanges(
    [
      ...(silenceCutEnabled.value ? cutSilenceRanges.value : []),
      ...manualCutRanges.value,
    ],
    sourceRecordingDurationMs.value
  )
);
const manualCutSelectionRange = computed<StoryVaultSilenceRange | null>(() => {
  const anchor = manualCutSelectionAnchorMs.value;
  const current = manualCutSelectionCurrentMs.value;
  if (anchor === null || current === null) return null;
  return {
    startMs: Math.min(anchor, current),
    endMs: Math.max(anchor, current),
  };
});
const canAddManualCutSelection = computed(
  () => (manualCutSelectionRange.value?.endMs ?? 0) - (manualCutSelectionRange.value?.startMs ?? 0) >= 250
);
const currentSilenceFingerprint = computed(() =>
  JSON.stringify({
    ranges: selectedCutRanges.value.map((range) => [range.startMs, range.endMs]),
    noiseReductionEnabled: noiseReductionEnabled.value,
  })
);
const hasCurrentPreparedClip = computed(
  () =>
    Boolean(preparedBaseClip.value) &&
    preparedSilenceFingerprint.value === currentSilenceFingerprint.value
);
const canSave = computed(
  () =>
    Boolean(props.application?.id) &&
    Boolean(selectedVideoGroup.value) &&
    Boolean(recordedBlob.value) &&
    activeClipDraftIsPersisted.value &&
    !isRecording.value &&
    hasCurrentPreparedClip.value &&
    Boolean(preparedTranscription.value) &&
    !isExtractingFrames.value &&
    !isPreparingClips.value &&
    !props.isSaving
);
const recordingDurationMs = computed(() =>
  clipEditingStep.value === 2 && hasCurrentPreparedClip.value
    ? preparedBaseClip.value?.durationMs ?? sourceRecordingDurationMs.value
    : sourceRecordingDurationMs.value
);
const editingPreviewUrl = computed(() =>
  clipEditingStep.value === 2 && hasCurrentPreparedClip.value
    ? preparedPreviewUrl.value || previewUrl.value
    : previewUrl.value
);
const clipPreparationStatus = computed(() => {
  if (clipPreparationPhase.value === "trimming") {
    const hasCuts = selectedCutRanges.value.length > 0;
    return {
      title: hasCuts
        ? noiseReductionEnabled.value ? "カットとノイズ低減を実行しています" : "選択した区間をカットしています"
        : noiseReductionEnabled.value ? "音声ノイズを低減しています" : "動画を準備しています",
      description: noiseReductionEnabled.value
        ? "映像と音声の同期を保ったまま、聞き取りやすい文字起こし用動画を生成しています。"
        : "映像と音声の同期を保ったまま、文字起こし用の動画を生成しています。",
      icon: "material-symbols:content-cut-rounded",
    };
  }
  if (clipPreparationPhase.value === "transcribing") {
    return {
      title: "Geminiで文字起こししています",
      description: "タイムコード付きの発話テキストを取得しています。",
      icon: "material-symbols:subtitles-outline",
    };
  }
  if (clipPreparationPhase.value === "sectioning") {
    return {
      title: "話題の区切りを見つけています",
      description: "文字起こしを読み、約1分を目安に意味のまとまりへ分けています。",
      icon: "material-symbols:auto-awesome",
    };
  }
  if (clipPreparationPhase.value === "done") {
    return {
      title: "文字起こしと分割案を準備しました",
      description: `${preparedTranscription.value?.segments.length ?? 0}件の発話から${aiSectionDrafts.value.length}クリップを提案しています。`,
      icon: "material-symbols:check-circle-outline",
    };
  }
  return null;
});
const isClipPreparationBusy = computed(() =>
  ["trimming", "transcribing", "sectioning"].includes(clipPreparationPhase.value)
);
const clipPreparationRequestLogs = computed(
  () => clipPreparationProgress.value?.logs ?? []
);
const latestClipPreparationLog = computed(
  () => clipPreparationRequestLogs.value.at(-1) ?? null
);
const clipPreparationProgressCompletion = computed(() => {
  if (clipPreparationPhase.value === "done") return 100;
  if (clipPreparationPhase.value === "error") return 100;
  if (clipPreparationPhase.value === "sectioning") return 88;
  if (clipPreparationPhase.value === "transcribing") return 68;
  const stage = clipPreparationProgress.value?.stage;
  if (stage === "ready" || stage === "downloading" || stage === "completed") return 48;
  if (stage === "processing") return 32;
  if (stage === "queued") return 18;
  return 8;
});
const clipPreparationProgressTitle = computed(() => {
  if (clipPreparationPhase.value === "done") return "分割案の準備が完了しました";
  if (clipPreparationPhase.value === "error") return "動画の準備を完了できませんでした";
  if (clipPreparationPhase.value === "transcribing") return "Geminiで文字起こし中";
  if (clipPreparationPhase.value === "sectioning") return "クリップの区切りを作成中";
  const currentStep = latestClipPreparationLog.value?.currentStep;
  if (currentStep === "download") return "Cloud Runが録画を取得中";
  if (currentStep === "detect_silence") return "動画タイムラインを調整中";
  if (currentStep === "reduce_noise") return "音声ノイズを低減中";
  if (currentStep === "render") return "カット済み動画を書き出し中";
  if (currentStep === "completed") return "調整済み動画を受信中";
  if (clipPreparationProgress.value?.stage === "queued") return "処理を開始しています";
  return "録画をアップロード中";
});
const clipPreparationProgressDescription = computed(() => {
  if (clipPreparationPhase.value === "done") {
    return `${preparedTranscription.value?.segments.length ?? 0}件の発話から${aiSectionDrafts.value.length}クリップを準備しました。`;
  }
  if (clipPreparationPhase.value === "error") {
    return clipPreparationError.value || "処理ログを確認して再実行してください。";
  }
  if (clipPreparationPhase.value === "transcribing") {
    return "調整済み動画からタイムコード付きの発話を取得しています。";
  }
  if (clipPreparationPhase.value === "sectioning") {
    return "文字起こしを読み、約1分を目安に話題の境界とタイトルを決めています。";
  }
  return latestClipPreparationLog.value?.message || "録画をCloud Runの動画調整処理へ送っています。";
});
const clipPreparationProgressSteps = computed<ClipPreparationProgressStep[]>(() => {
  const stage = clipPreparationProgress.value?.stage;
  let activeIndex = stage === "uploading" || !stage ? 0 : 1;
  if (clipPreparationPhase.value === "transcribing") activeIndex = 2;
  if (clipPreparationPhase.value === "sectioning") activeIndex = 3;
  if (clipPreparationPhase.value === "done") activeIndex = 4;
  if (clipPreparationPhase.value === "error") {
    activeIndex = !preparedBaseClip.value
      ? stage === "uploading" || !stage ? 0 : 1
      : preparedTranscription.value ? 3 : 2;
  }
  const definitions = [
    ["upload", "録画をアップロード", "元動画を一時保存します。"],
    ["trim", "カット・ノイズ低減", "音声を聞き取りやすく整えて動画を書き出します。"],
    ["transcribe", "Gemini文字起こし", "タイムコード付きの発話を生成します。"],
    ["section", "AIクリップ分割", "話題の境界とクリップタイトルを作ります。"],
  ] as const;
  return definitions.map(([key, label, description], index) => ({
    key,
    label,
    description,
    status:
      clipPreparationPhase.value === "error" && index === activeIndex
        ? "error"
        : activeIndex > index
          ? "done"
          : activeIndex === index
            ? "active"
            : "pending",
  }));
});
const displayedAudioLevelSamples = computed(() => {
  const samples = audioLevelSamples.value;
  const maxBars = 240;
  if (samples.length <= maxBars) return samples;
  const groupSize = Math.ceil(samples.length / maxBars);
  const grouped: StoryVaultAudioLevelSample[] = [];
  for (let index = 0; index < samples.length; index += groupSize) {
    const group = samples.slice(index, index + groupSize);
    const first = group[0];
    const last = group[group.length - 1];
    if (!first || !last) continue;
    grouped.push({
      startMs: first.startMs,
      endMs: last.endMs,
      db: Math.max(...group.map((sample) => sample.db)),
    });
  }
  return grouped;
});
const editedDurationMs = computed(() =>
  editedStoryVaultDurationMs(
    sourceRecordingDurationMs.value,
    selectedCutRanges.value,
    true
  )
);
const previewProgressPercent = computed(() =>
  timelinePercent(recordedPreviewMs.value)
);
const aiSuggestedSplitPointsMs = computed(() =>
  sectionSplitPointsMs(aiSectionDrafts.value)
);
const hasChangedAiSplitProposal = computed(() =>
  JSON.stringify(splitPointsMs.value) !==
  JSON.stringify(aiSuggestedSplitPointsMs.value)
);
const preparedSectionSummaries = computed(() => {
  const boundaries = [0, ...splitPointsMs.value, recordingDurationMs.value];
  return boundaries.slice(0, -1).map((startMs, index) => {
    const endMs = boundaries[index + 1] ?? recordingDurationMs.value;
    const sectionSilence = hasCurrentPreparedClip.value
      ? []
      : selectedCutRanges.value
      .map((range) => ({
        startMs: Math.max(startMs, range.startMs),
        endMs: Math.min(endMs, range.endMs),
      }))
      .filter((range) => range.endMs > range.startMs);
    const aiDraft = aiSectionDrafts.value.find(
      (draft) =>
        Math.abs(draft.startMs - startMs) < 500 &&
        Math.abs(draft.endMs - endMs) < 500
    );
    return {
      index,
      startMs,
      endMs,
      title: aiDraft?.title || `クリップ ${index + 1}`,
      summary: aiDraft?.summary || "解析後にタイトルと説明を更新します。",
      isAiSuggested: Boolean(aiDraft),
      editedDurationMs: editedStoryVaultDurationMs(
        endMs - startMs,
        sectionSilence.map((range) => ({
          startMs: range.startMs - startMs,
          endMs: range.endMs - startMs,
        })),
        !hasCurrentPreparedClip.value
      ),
    };
  });
});

const elapsedLabel = computed(() => formatDuration(elapsedMs.value));
const sourceDisplaySurfaceLabel = computed(() =>
  displaySurfaceLabel(sourceDisplaySurface.value)
);
const videoStatusFilters = computed<
  { value: "all" | StoryVaultZappingAnalysisStatus; label: string }[]
>(() => [
  { value: "all", label: "すべて" },
  { value: "not_analyzed", label: "未解析" },
  { value: "running", label: "解析中" },
  { value: "completed", label: "解析済み" },
  { value: "error", label: "エラー" },
]);
const filteredGroupClipItems = computed(() => {
  const query = videoSearchQuery.value.trim().toLowerCase();
  return selectedGroupClipItems.value.filter(({ video, clip, clipIndex }) => {
    if (
      videoStatusFilter.value !== "all" &&
      video.analysisStatus !== videoStatusFilter.value
    ) {
      return false;
    }
    if (!query) return true;
    return [
      clipTitle(clip, clipIndex),
      clip.quickScan?.description,
      clip.quickScan?.operationMemo,
      clip.transcriptSummary,
      clip.transcriptText,
      displayVideoTitle(video),
      displayVideoDescription(video),
      video.quickScan?.operationMemo,
      video.transcriptSummary,
      video.analysisResult?.operationIntent,
    ]
      .filter(Boolean)
      .join("\n")
      .toLowerCase()
      .includes(query);
  });
});

const reportMetrics = computed(() => {
  const video = detailVideo.value;
  if (!video) return [];
  return [
    { label: "Stories", value: video.analysisResult?.storyCandidates.length ?? 0 },
    { label: "Evidence", value: video.analysisResult?.storyCandidates.reduce((sum, story) => sum + story.evidence.length, 0) ?? 0 },
    { label: "Screenshots", value: video.frameCaptures.length },
    { label: "PRs", value: relatedGithubPullRequestCount(video) },
    { label: "Slack", value: relatedSlackMessageCount(video) },
    { label: "Knowledge", value: relatedKnowledgeDocumentCount(video) },
    { label: "Jira", value: relatedJiraIssueCount(video) },
  ];
});

const reportExcelSheets = [
  { name: "サマリー", description: "案件・クリップ・件数・動画URLをまとめた顧客共有用の表紙です。" },
  { name: "ユーザーストーリー一覧", description: "タイトル、ユーザーストーリー、価値、AC、信頼度、代表証跡を一覧化します。" },
  { name: "証跡リンク", description: "各ストーリー候補とスクリーンショット、動画、時間範囲を紐付けます。" },
  { name: "スクリーンショット", description: "画面キャプチャの時刻、保存先、プレビューリンクを一覧化します。" },
  { name: "GitHub PR", description: "関連Pull RequestのURL、状態、差分量、抽出理由をまとめます。" },
  { name: "Slack", description: "関連Slack投稿のチャンネル、投稿者、本文、Permalinkをまとめます。" },
  { name: "Knowledge", description: "関連ナレッジ文書、Drive/Storageリンク、根拠理由をまとめます。" },
  { name: "Jira", description: "関連Issueの状態、担当者、URL、抽出理由をまとめます。" },
] as const;

const detailMoreActionItems = computed(() => {
  const video = detailVideo.value;
  if (!video) return [];
  return [
    [
      {
        label: "グループを削除",
        icon: "material-symbols:delete-outline",
        disabled: props.isSaving,
        onSelect: () => {
          if (props.isSaving) return;
          openVideoDeleteConfirm(video);
        },
      },
    ],
  ];
});

const reportFileStem = computed(() => {
  const video = detailVideo.value;
  return sanitizeFileStem(video?.id || "operation-video-report");
});

const reportMarkdown = computed(() => {
  const video = detailVideo.value;
  if (!video) return "";
  const stories = video.analysisResult?.storyCandidates ?? [];
  const videoGroup = videoGroupForVideo(video);
  const lines = [
    `# StoryVault Operation Video Bundle: ${displayVideoTitle(video)}`,
    "",
    "## Bundle",
    `- Application: ${props.application?.name || video.applicationKey || "n/a"}`,
    `- Application ID: ${props.application?.id || video.applicationId || "n/a"}`,
    `- Video group: ${videoGroup.name}`,
    `- Video group ID: ${videoGroup.id || "n/a"}`,
    `- Video group description: ${videoGroup.description || "n/a"}`,
    `- Operation video ID: ${video.id}`,
    `- Linked stories: ${stories.length}`,
    `- Evidence: ${stories.reduce((sum, story) => sum + story.evidence.length, 0)}`,
    `- Screenshots: ${video.frameCaptures.length}`,
    `- GitHub pull requests: ${relatedGithubPullRequestCount(video)}`,
    `- Knowledge documents: ${relatedKnowledgeDocumentCount(video)}`,
    `- Jira issues: ${relatedJiraIssueCount(video)}`,
    "",
    "## Operation Video",
    `- Title: ${displayVideoTitle(video)}`,
    `- Description: ${displayVideoDescription(video) || "n/a"}`,
    `- Recorded at: ${video.recordedAt || "n/a"}`,
    `- Duration: ${formatDuration(video.durationMs)}`,
    `- Video URL: ${videoUrls[video.id] || "not resolved"}`,
    `- Storage path: ${video.storagePath}`,
    `- Transcript summary: ${video.analysisResult?.transcriptSummary || video.transcriptSummary || video.quickScan?.transcriptSummary || "n/a"}`,
    "",
    "## Linked User Stories",
    ...(stories.length
      ? stories.flatMap((story, index) => [
          `### ${index + 1}. ${story.title}`,
          `- Story candidate ID: ${story.id}`,
          `- Role: ${story.role?.value || "n/a"} (${story.role?.grounding || "n/a"})`,
          `- Goal: ${story.goal || "n/a"}`,
          `- Benefit: ${story.benefit || "n/a"}`,
          `- Confidence: ${story.confidence ?? story.confidenceScore ?? "n/a"}`,
          "",
          "#### Detailed Specifications",
          ...(story.detailedSpecifications.length
            ? story.detailedSpecifications.map((specification, specificationIndex) => `${specificationIndex + 1}. ${specification}`)
            : ["- No detailed specifications recorded."]),
          "",
          "#### Acceptance Criteria",
          ...(story.acceptanceCriteria.length
            ? story.acceptanceCriteria.map((criterion, criterionIndex) => `${criterionIndex + 1}. ${criterion}`)
            : ["- No acceptance criteria recorded."]),
          "",
          "#### Evidence",
          ...(story.evidence.length
            ? story.evidence.map((item) => {
                const frames = item.screenshotIds?.join(", ") || "n/a";
                return `- ${item.title}: ${item.summary} (video: ${item.videoId}, range: ${item.tRange?.join("-") || "n/a"}, representative: ${item.representativeScreenshotId || "n/a"}, screenshots: ${frames})`;
              })
            : ["- No evidence recorded."]),
          "",
        ])
      : ["- No user stories are linked to this operation video.", ""]),
    "## Screenshots",
    ...video.frameCaptures.slice(0, 30).map((frame) => {
      const url = savedFrameUrl(video, frame.id) || frame.storagePath || "n/a";
      return `- Frame ${frame.id} at ${frame.timestampMs}ms: ${url}`;
    }),
    "",
    "## GitHub Pull Requests",
    ...(relatedGithubPullRequests(video).length
      ? relatedGithubPullRequests(video).map((pr) => `- ${relatedGithubRepoFullName(video) || "repo"} PR ${pr.number}: ${pr.title} (${pr.htmlUrl})`)
      : ["- No GitHub pull request refs."]),
    "",
    "## Knowledge Documents",
    ...(relatedKnowledgeDocuments(video).length
      ? relatedKnowledgeDocuments(video).map((doc) => `- ${doc.displayName || doc.documentId || doc.name || "Knowledge"} (${doc.mimeType || "unknown"}): ${doc.reason || "No reason recorded."}${doc.gcsUrl ? ` ${doc.gcsUrl}` : ""}`)
      : ["- No knowledge document refs."]),
    "",
    "## Jira Issues",
    ...(relatedJiraIssues(video).length
      ? relatedJiraIssues(video).map((issue) => `- ${issue.key}: ${issue.summary} [${issue.status.name || "status n/a"}] (${issue.htmlUrl})`)
      : ["- No Jira issue refs."]),
    "",
    "## Agent Instructions",
    "- Treat this as an operation-video bundle report.",
    "- Summarize the operation video first, then use linked user stories as interpretations attached to the video.",
    "- Preserve operationVideoId, story candidate IDs, evidence ranges, and screenshot IDs in implementation plans and release notes.",
  ];
  return lines.join("\n").trim() + "\n";
});

const mcpTestContextJson = computed(() => {
  const video = detailVideo.value;
  if (!video) return "{}";
  const stories = video.analysisResult?.storyCandidates ?? [];
  const payload = {
    schemaVersion: "storyvault-operation-video-context-v1",
    tool: "get_operation_video_context",
    application: {
      id: props.application?.id || video.applicationId || "",
      name: props.application?.name || video.applicationKey || "",
      applicationKey: props.application?.applicationKey || video.applicationKey || "",
      repoFullName: props.application?.repoFullName || "",
      fileSpaceId: props.application?.fileSpaceId || "",
    },
    operationVideo: {
      id: video.id,
      title: displayVideoTitle(video),
      description: displayVideoDescription(video),
      recordedAt: video.recordedAt,
      durationMs: video.durationMs,
      storagePath: video.storagePath,
      videoUrl: videoUrls[video.id] || "",
      analysisStatus: video.analysisStatus,
      analyzedAt: video.analyzedAt,
      operationIntent: video.analysisResult?.operationIntent || "",
      productContextSummary: video.analysisResult?.productContextSummary || "",
      transcriptSummary:
        video.analysisResult?.transcriptSummary ||
        video.transcriptSummary ||
        video.quickScan?.transcriptSummary ||
        "",
      quickScan: video.quickScan ?? null,
    },
    videoGroup: videoGroupForVideo(video),
    counts: {
      storyCandidates: stories.length,
      evidence: stories.reduce((sum, story) => sum + story.evidence.length, 0),
      screenshots: video.frameCaptures.length,
      githubPullRequests: relatedGithubPullRequestCount(video),
      slackMessages: relatedSlackMessageCount(video),
      knowledgeDocuments: relatedKnowledgeDocumentCount(video),
      jiraIssues: relatedJiraIssueCount(video),
    },
    storyCandidates: stories.map((story) => ({
      id: story.id,
      title: story.title,
      role: story.role ?? null,
      goal: story.goal || "",
      benefit: story.benefit || "",
      userStory: story.userStory || "",
      confidence: story.confidence ?? story.confidenceScore ?? null,
      acceptanceCriteria: story.acceptanceCriteria,
      detailedSpecifications: story.detailedSpecifications,
      evidence: story.evidence.map((item) => ({
        id: `${item.videoId}:${item.tRange.join("-")}:${item.representativeScreenshotId || "evidence"}`,
        title: item.title,
        summary: item.summary,
        videoId: item.videoId,
        tRange: item.tRange,
        representativeScreenshotId: item.representativeScreenshotId,
        screenshotIds: item.screenshotIds ?? [],
      })),
    })),
    screenshots: video.frameCaptures.slice(0, 30).map((frame) => ({
      id: frame.id,
      timestampMs: frame.timestampMs,
      width: frame.width,
      height: frame.height,
      storagePath: frame.storagePath,
      url: savedFrameUrl(video, frame.id) || "",
    })),
    relatedContexts: {
      knowledgeDocuments: relatedKnowledgeDocuments(video),
      githubPullRequests: relatedGithubPullRequests(video),
      slackMessages: relatedSlackMessages(video),
      jiraIssues: relatedJiraIssues(video),
    },
  };
  return JSON.stringify(payload, null, 2);
});

const reportHtml = computed(() => {
  const video = detailVideo.value;
  if (!video) return "";
  const stories = video.analysisResult?.storyCandidates ?? [];
  const videoGroup = videoGroupForVideo(video);
  const storyCards = stories.length
    ? stories
        .map(
          (story, index) => `<article class="panel story"><h3>${index + 1}. ${escapeHtml(story.title)}</h3><p>${escapeHtml(story.goal || story.summary || story.userStory || "No goal recorded.")}</p><div class="chips"><span class="chip">${escapeHtml(story.role?.value || "role n/a")}</span><span class="chip">confidence ${escapeHtml(String(story.confidenceScore ?? "n/a"))}</span></div><h4>Detailed Specifications</h4><ul>${story.detailedSpecifications.map((specification) => `<li>${escapeHtml(specification)}</li>`).join("") || '<li class="muted">No detailed specifications recorded.</li>'}</ul><h4>Acceptance Criteria</h4><ol>${story.acceptanceCriteria.map((criterion) => `<li>${escapeHtml(criterion)}</li>`).join("") || "<li>No acceptance criteria recorded.</li>"}</ol><h4>Evidence</h4><ul>${story.evidence.map((item) => `<li><strong>${escapeHtml(item.title || "Evidence")}</strong>: ${escapeHtml(item.summary || "No summary recorded.")}<br><span class="muted">${escapeHtml(item.videoId)} / ${escapeHtml(item.representativeScreenshotId || "no representative screenshot")}</span></li>`).join("") || '<li class="muted">No evidence recorded.</li>'}</ul></article>`
        )
        .join("")
    : '<div class="panel"><p class="muted">No user stories are linked to this operation video.</p></div>';
  const frames = video.frameCaptures.length
    ? video.frameCaptures
        .slice(0, 30)
        .map((frame) => `<figure class="frame"><img src="${escapeHtml(savedFrameUrl(video, frame.id) || frame.storagePath || "")}" alt="${escapeHtml(frame.id)}"><figcaption>${escapeHtml(frame.id)} / ${escapeHtml(formatDuration(frame.timestampMs))}</figcaption></figure>`)
        .join("")
    : '<div class="panel"><p class="muted">No screenshots.</p></div>';
  const prs = relatedGithubPullRequests(video).length
    ? relatedGithubPullRequests(video)
        .map((pr) => `<li>PR ${escapeHtml(String(pr.number))}: <a href="${escapeHtml(pr.htmlUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(pr.title)}</a></li>`)
        .join("")
    : '<li class="muted">No GitHub pull request refs.</li>';
  const knowledge = relatedKnowledgeDocuments(video).length
    ? relatedKnowledgeDocuments(video)
        .map((doc) => `<article class="panel"><h3>${escapeHtml(doc.displayName || doc.documentId || doc.name || "Knowledge")}</h3><p class="muted">${escapeHtml(doc.mimeType || "unknown")} / score ${escapeHtml(String(doc.relevanceScore ?? "n/a"))}</p>${doc.reason ? `<p>${escapeHtml(doc.reason)}</p>` : ""}${doc.gcsUrl ? `<p class="muted">${escapeHtml(doc.gcsUrl)}</p>` : ""}</article>`)
        .join("")
    : '<div class="panel"><p class="muted">No knowledge document refs.</p></div>';
  const jiraIssues = relatedJiraIssues(video).length
    ? relatedJiraIssues(video)
        .map((issue) => `<li><a href="${escapeHtml(issue.htmlUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(issue.key)} ${escapeHtml(issue.summary)}</a> <span class="muted">${escapeHtml(issue.status.name || "status n/a")} / ${escapeHtml(issue.assignee.name || "unassigned")}</span></li>`)
        .join("")
    : '<li class="muted">No Jira issue refs.</li>';
  const videoUrl = videoUrls[video.id] || "";
  return `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(displayVideoTitle(video))} StoryVault Operation Video Bundle</title>
  <style>
    *{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;color:#0f172a;background:#fff;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;line-height:1.65}.layout{display:grid;grid-template-columns:280px minmax(0,1fr);min-height:100vh}.sidebar{position:sticky;top:0;height:100vh;overflow:auto;border-right:1px solid #dbe3ef;background:#f8fafc;padding:22px 18px}.brand{margin:0;color:#64748b;font-size:12px;font-weight:900;letter-spacing:.12em;text-transform:uppercase}.side-title{margin:8px 0 18px;font-size:18px;line-height:1.25}.nav{display:grid;gap:7px;margin-top:18px}.nav a{display:block;border-radius:8px;padding:9px 10px;color:#334155;font-size:13px;font-weight:800;text-decoration:none}.nav a:hover{background:#fff}.content{min-width:0;padding:30px min(5vw,54px) 56px}.hero{border-bottom:1px solid #dbe3ef;padding-bottom:22px}.eyebrow{margin:0 0 6px;color:#0f9aa7;font-size:13px;font-weight:900}h1{margin:0;font-size:clamp(30px,4vw,54px);line-height:1.08}h2{margin:36px 0 12px;padding-top:10px;font-size:24px}h3{margin:0 0 8px;font-size:17px}.summary{margin-top:12px;color:#475569}.grid{display:grid;gap:14px}.cols5{grid-template-columns:repeat(auto-fit,minmax(120px,1fr))}.metric,.panel{border:1px solid #dbe3ef;border-radius:8px;background:#fff;padding:15px}.metric{background:#f8fafc}.metric span{display:block;color:#64748b;font-size:12px;font-weight:900}.metric strong{display:block;font-size:18px}.chips{display:flex;flex-wrap:wrap;gap:6px;margin-top:10px}.chip{border-radius:999px;background:#ecfeff;color:#0e7490;padding:3px 9px;font-size:12px;font-weight:800}.story{border-left:4px solid #0f9aa7}.muted{color:#64748b}.frames{display:grid;gap:12px;grid-template-columns:repeat(3,minmax(0,1fr))}video,img{width:100%;max-height:560px;border:1px solid #dbe3ef;border-radius:8px;background:#f1f5f9;object-fit:contain}.frame figcaption{margin-top:5px;color:#64748b;font-size:12px}li{overflow-wrap:anywhere}@media(max-width:960px){.layout{grid-template-columns:1fr}.sidebar{position:static;height:auto}.content{padding:22px 16px 44px}.cols5,.frames{grid-template-columns:1fr}}
  </style>
</head>
<body>
  <div class="layout"><aside class="sidebar"><p class="brand">StoryVault Bundle</p><h2 class="side-title">${escapeHtml(displayVideoTitle(video))}</h2><div class="chips"><span class="chip">${stories.length} stories</span><span class="chip">${video.frameCaptures.length} screenshots</span></div><nav class="nav"><a href="#overview">Overview</a><a href="#video">Operation Video</a><a href="#stories">Linked User Stories</a><a href="#knowledge">Knowledge Documents</a><a href="#screenshots">Screenshots</a><a href="#pull-requests">Pull Requests</a><a href="#jira-issues">Jira Issues</a></nav></aside><main class="content">
    <header id="overview" class="hero"><p class="eyebrow">Operation video centered context</p><h1>${escapeHtml(displayVideoTitle(video))}</h1><p class="summary">${escapeHtml(displayVideoDescription(video) || video.analysisResult?.operationIntent || "")}</p><div class="panel"><h3>Video Group</h3><p><strong>${escapeHtml(videoGroup.name)}</strong></p><p class="muted">${escapeHtml(videoGroup.description || "No group description.")}</p></div></header>
    <section><h2>Bundle Metrics</h2><div class="grid cols5">${reportMetrics.value.map((metric) => `<div class="metric"><span>${escapeHtml(metric.label)}</span><strong>${escapeHtml(String(metric.value))}</strong></div>`).join("")}</div></section>
    <section id="video"><h2>Operation Video</h2><div class="panel">${videoUrl ? `<video controls preload="metadata" src="${escapeHtml(videoUrl)}"></video>` : ""}<p class="summary">${escapeHtml(video.analysisResult?.transcriptSummary || video.transcriptSummary || video.quickScan?.transcriptSummary || "")}</p></div></section>
    <section id="stories"><h2>Linked User Stories</h2><div class="grid">${storyCards}</div></section>
    <section id="knowledge"><h2>Knowledge Documents</h2><div class="grid">${knowledge}</div></section>
    <section id="screenshots"><h2>Screenshots</h2><div class="frames">${frames}</div></section>
    <section id="pull-requests"><h2>GitHub Pull Requests</h2><div class="panel"><ul>${prs}</ul></div></section>
    <section id="jira-issues"><h2>Jira Issues</h2><div class="panel"><ul>${jiraIssues}</ul></div></section>
  </main></div>
</body>
</html>`;
});
const reportBody = computed(() => {
  if (reportMode.value === "html") return reportHtml.value;
  if (reportMode.value === "json") return mcpTestContextJson.value;
  if (reportMode.value === "excel") {
    return reportExcelSheets
      .map((sheet) => `${sheet.name}: ${sheet.description}`)
      .join("\n");
  }
  return reportMarkdown.value;
});
const reportMimeType = computed(() => {
  if (reportMode.value === "html") return "text/html;charset=utf-8";
  if (reportMode.value === "json") return "application/json;charset=utf-8";
  if (reportMode.value === "excel") {
    return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  }
  return "text/markdown;charset=utf-8";
});
const reportExtension = computed(() => {
  if (reportMode.value === "html") return "html";
  if (reportMode.value === "json") return "json";
  if (reportMode.value === "excel") return "xlsx";
  return "md";
});
const detailVideo = computed(
  () => props.clipRecords.find((video) => video.id === detailVideoId.value) ?? null
);
const contextMapVideo = computed(
  () =>
    props.clipRecords.find((video) => video.id === contextMapVideoId.value) ??
    detailVideo.value
);
const contextMapData = computed<ContextMapData>(() =>
  contextMapVideo.value
    ? applyContextMapNodePositions(buildContextMapData(contextMapVideo.value))
    : { nodes: [], edges: [] }
);
const contextMapEdgesWithPoints = computed<ContextMapEdgeWithPoints[]>(() => {
  const nodes = new Map(contextMapData.value.nodes.map((node) => [node.id, node]));
  return contextMapData.value.edges.flatMap((edge) => {
    const from = nodes.get(edge.from);
    const to = nodes.get(edge.to);
    if (!from || !to) return [];
    return [{ ...edge, x1: from.x, y1: from.y, x2: to.x, y2: to.y }];
  });
});
const selectedContextMapNode = computed(() => {
  if (!selectedContextMapNodeId.value) return null;
  const nodes = contextMapData.value.nodes;
  return nodes.find((node) => node.id === selectedContextMapNodeId.value) ?? null;
});
const selectedContextMapNeighbors = computed(() => {
  const selected = selectedContextMapNode.value;
  if (!selected) return [];
  const neighborIds = new Set<string>();
  for (const edge of contextMapData.value.edges) {
    if (edge.from === selected.id) neighborIds.add(edge.to);
    if (edge.to === selected.id) neighborIds.add(edge.from);
  }
  return contextMapData.value.nodes.filter((node) => neighborIds.has(node.id));
});
const activeContextMapNodeIds = computed(() => {
  const selected = selectedContextMapNode.value;
  if (!selected) return new Set<string>();
  return new Set([selected.id, ...selectedContextMapNeighbors.value.map((node) => node.id)]);
});
const activeContextMapEdgeIds = computed(() => {
  const selected = selectedContextMapNode.value;
  if (!selected) return new Set<string>();
  return new Set(
    contextMapData.value.edges
      .filter((edge) => edge.from === selected.id || edge.to === selected.id)
      .map((edge) => edge.id)
  );
});
const contextMapHeroStats = computed(() => {
  const video = contextMapVideo.value;
  if (!video) return [];
  return [
    { label: "ストーリー", value: storyCandidateCount(video), dotClass: "bg-amber-300" },
    { label: "画面", value: video.frameCaptures.length, dotClass: "bg-emerald-300" },
    { label: "文字起こし", value: transcriptCueRows(video).length, dotClass: "bg-emerald-300" },
    { label: "関連情報", value: relatedContextCount(video), dotClass: "bg-violet-300" },
  ];
});
const contextMapLegend = [
  { label: "クリップ", dotClass: "bg-cyan-300" },
  { label: "根拠", dotClass: "bg-emerald-300" },
  { label: "ストーリー", dotClass: "bg-amber-300" },
  { label: "関連情報", dotClass: "bg-violet-300" },
];
const detailGroupClips = computed(() => {
  const video = detailVideo.value;
  if (!video) return [];
  const groupId = video.clipGroupId;
  return props.clipRecords
    .filter((item) => item.clipGroupId === groupId)
    .sort((a, b) => {
      const recorded = (a.recordedAt || "").localeCompare(b.recordedAt || "");
      if (recorded !== 0) return recorded;
      return a.id.localeCompare(b.id);
    });
});
const detailVideoClips = computed(() =>
  detailGroupClips.value.flatMap((video) => videoClips(video))
);
const isAllClipsSelected = computed(
  () => selectedClipId.value === ALL_CLIPS_SELECTION_ID
);
const selectedDetailClip = computed(() => {
  if (isAllClipsSelected.value) return null;
  const clips = detailVideoClips.value;
  return (
    clips.find((clip) => clip.id === selectedClipId.value) ??
    clips[0] ??
    null
  );
});
const selectedDetailClipIndex = computed(() => {
  const clip = selectedDetailClip.value;
  if (!clip) return 0;
  return Math.max(0, detailVideoClips.value.findIndex((item) => item.id === clip.id));
});
const selectedDetailClipPickerTitle = computed(() => {
  const clip = selectedDetailClip.value;
  if (!clip || isAllClipsSelected.value) return "すべてのクリップ";
  return `${String(selectedDetailClipIndex.value + 1).padStart(2, "0")}. ${clipTitle(clip, selectedDetailClipIndex.value)}`;
});
const selectedDetailClipPickerSummary = computed(() => {
  const clip = selectedDetailClip.value;
  if (!clip || isAllClipsSelected.value) {
    return `${detailVideoClips.value.length}本を横断表示`;
  }
  return (
    clipSummaryText(clip, detailVideo.value ?? undefined) ||
    `${formatDuration(clip.durationMs)} / ${clip.frameCaptures.length}枚`
  );
});
const activeSelectedClipCueId = computed(() => {
  const clip = selectedDetailClip.value;
  if (!clip) return "";
  return activeTranscriptCueId(
    transcriptCueRows(clip),
    selectedClipPlaybackMs.value
  );
});
const quickScanPreviewVideo = computed(
  () => props.clipRecords.find((video) => video.id === quickScanPreviewVideoId.value) ?? null
);
const detailStories = computed(
  () =>
    isAllClipsSelected.value
      ? detailGroupClips.value.flatMap((clip) => clip.analysisResult?.storyCandidates ?? [])
      : detailVideo.value?.analysisResult?.storyCandidates ?? []
);
const selectedAnalysisStory = computed(() => {
  const stories = detailStories.value;
  return (
    stories.find((story) => story.id === selectedAnalysisStoryId.value) ??
    stories[0] ??
    null
  );
});
const quickScanPreviewOpen = computed({
  get: () => Boolean(quickScanPreviewVideo.value),
  set: (open: boolean) => {
    if (!open) quickScanPreviewVideoId.value = "";
  },
});
const deleteTargetVideo = computed(
  () => props.clipRecords.find((video) => video.id === deleteTargetVideoId.value) ?? null
);
const deleteTargetClip = computed(() => {
  const video = props.clipRecords.find((item) => item.id === deleteTargetClipVideoId.value);
  if (!video) return null;
  const clips = videoClips(video);
  const index = clips.findIndex((clip) => clip.id === deleteTargetClipId.value);
  const clip = clips[index];
  return clip ? { video, clip, index } : null;
});
const surfaceWarning = computed(() => {
  if (!isRecording.value && !recordedBlob.value) return "";
  if (sourceDisplaySurface.value === "window") return "";
  if (sourceDisplaySurface.value === "unknown") return "";
  return "Window以外が選択されている可能性があります";
});
const workflowVideo = computed(
  () => props.clipRecords.find((video) => video.id === workflowVideoId.value) ?? null
);
const saveWorkflowActiveIndex = computed(() => {
  if (saveWorkflowStep.value === "videoAnalysis") return 1;
  return 0;
});
const isSaveWorkflowBusy = computed(() =>
  !["idle", "done", "error"].includes(saveProgressPhase.value)
);
const saveProgressActivityLabel = computed(() => {
  if (saveProgressPhase.value === "preparing") return "動画を調整中";
  if (saveProgressPhase.value === "saving") return "クリップを保存中";
  if (saveProgressPhase.value === "parallelAnalysis") return "並列解析中";
  if (saveProgressPhase.value === "extracting") return "画面を抽出中";
  if (saveProgressPhase.value === "transcribing") return "文字起こし中";
  if (saveProgressPhase.value === "summarizing") return "要約を作成中";
  if (saveProgressPhase.value === "scanning") return "AI解析中";
  if (saveProgressPhase.value === "analysisSaving") return "解析結果を保存中";
  if (saveProgressPhase.value === "uploading") return "データを保存中";
  return "処理中";
});
const saveProgressElapsedLabel = computed(() =>
  saveProgressActivitySeconds.value > 0
    ? `${formatDuration(saveProgressActivitySeconds.value * 1000)} 経過・処理は継続中です`
    : "処理を開始しました"
);
const saveWorkflowStepperItems = computed(() => [
  {
    title: "1. 保存",
    description: workflowVideoId.value ? "クリップを保存済み" : "クリップ本体を先に保存",
    icon: workflowVideoId.value ? "material-symbols:check-circle-outline" : "material-symbols:save-outline",
  },
  {
    title: "2. クリップ解析",
    description: hasVideoAnalysis(workflowVideo.value)
      ? "文字起こしと解析メモを保存済み"
      : "スクショ・文字起こし・解析メモ",
    icon: hasVideoAnalysis(workflowVideo.value)
      ? "material-symbols:check-circle-outline"
      : "material-symbols:movie-info-outline",
  },
]);
const saveProgressTitle = computed(() => {
  if (saveProgressPhase.value === "done") return "クリップ解析まで完了しました";
  if (saveProgressPhase.value === "error") return "保存に失敗しました";
  if (saveProgressPhase.value === "preparing") return "無音カットと分割を実行しています";
  if (saveProgressPhase.value === "saving") return "ザッピングクリップを保存しています";
  if (saveProgressPhase.value === "parallelAnalysis") {
    return `${parallelAnalysisTotal.value}クリップを並列解析しています`;
  }
  if (saveProgressPhase.value === "extracting") return "スクリーンショットを抽出しています";
  if (saveProgressPhase.value === "transcribing") return "Geminiで文字起こししています";
  if (saveProgressPhase.value === "summarizing") return "文字起こしを要約しています";
  if (saveProgressPhase.value === "scanning") return "AIでクリップ解析しています";
  if (saveProgressPhase.value === "analysisSaving") return "クリップ解析結果を保存しています";
  return "クリップを保存しています";
});
const saveProgressDescription = computed(() => {
  if (saveProgressPhase.value === "done") {
    return "クリップ、文字起こし、スクリーンショット、クリップ解析メモを保存しました。必要に応じて右上のユーザーストーリー解析を開始してください。";
  }
  if (saveProgressPhase.value === "error") {
    return errorMessage.value || "保存処理を完了できませんでした。";
  }
  if (saveProgressPhase.value === "preparing") {
    return "無音区間を除き、指定した分割点ごとに独立したクリップを生成しています。";
  }
  if (saveProgressPhase.value === "saving") {
    return "解析に失敗しても録画が残るよう、まずクリップ本体を保存しています。";
  }
  if (saveProgressPhase.value === "parallelAnalysis") {
    return `先に取得した文字起こしを再利用し、スクリーンショット・要約・クリップ解析を並行しています。${parallelAnalysisCompleted.value}/${parallelAnalysisTotal.value}件完了`;
  }
  if (saveProgressPhase.value === "extracting") {
    return "録画クリップから約5秒ごとの操作スクリーンショットを作っています。";
  }
  if (saveProgressPhase.value === "transcribing") {
    return "録画音声をGeminiへ送信し、タイムコード付きの文字起こしを取得しています。";
  }
  if (saveProgressPhase.value === "summarizing") {
    return "文字起こし全文から、操作意図をGeminiで短く整理しています。";
  }
  if (saveProgressPhase.value === "scanning") {
    return "クリップ、スクリーンショット、文字起こし全文、要約からタイトル・説明・操作ステップを生成しています。";
  }
  if (saveProgressPhase.value === "analysisSaving") {
    return "タイムスタンプ付き文字起こしとクリップ解析メモを保存済みクリップへ反映しています。";
  }
  return "録画データをクリップグループへ登録しています。";
});
const saveProgressCompletion = computed(() => {
  if (saveProgressPhase.value === "done") return 100;
  if (saveProgressPhase.value === "parallelAnalysis") {
    const ratio = parallelAnalysisTotal.value > 0
      ? parallelAnalysisCompleted.value / parallelAnalysisTotal.value
      : 0;
    return Math.round(58 + ratio * 34);
  }
  if (saveProgressPhase.value === "analysisSaving") return 78;
  if (saveProgressPhase.value === "uploading") return 22;
  if (saveProgressPhase.value === "scanning") return 74;
  if (saveProgressPhase.value === "summarizing") return 56;
  if (saveProgressPhase.value === "transcribing") return 38;
  if (saveProgressPhase.value === "extracting") return 30;
  if (saveProgressPhase.value === "saving") return 14;
  if (saveProgressPhase.value === "preparing") return 8;
  return saveProgressPhase.value === "error" ? 100 : 8;
});
const saveProgressFramePreview = computed(() => {
  const frames = frameCaptures.value;
  if (frames.length <= 6) return frames;
  return Array.from({ length: 6 }, (_, offset) => {
    const index = (saveProgressFramePreviewIndex.value + offset) % frames.length;
    return frames[index]!;
  });
});
const saveProgressInsight = computed<SaveProgressInsight>(() => {
  const scanTitle = quickScan.value?.title?.trim();
  const scanDescription = quickScan.value?.description?.trim();
  const operationMemo = quickScan.value?.operationMemo?.trim();
  const operationSteps = (quickScan.value?.operationSteps ?? [])
    .map((step) => String(step).trim())
    .filter(Boolean);
  const transcriptSnippet = compactPreviewText(transcriptText.value, 130);
  const summarySnippet = compactPreviewText(transcriptSummary.value, 150);
  const noteCount = [
    scanTitle,
    scanDescription,
    operationMemo,
    summarySnippet,
    ...operationSteps,
  ].filter(Boolean).length;
  const artifacts: SaveProgressInsightArtifact[] = [
    {
      label: "操作タイトル",
      value: scanTitle || "画面遷移と発話内容からタイトル候補を組み立てています。",
      icon: "material-symbols:title",
    },
    {
      label: "理解メモ",
      value:
        operationMemo ||
        scanDescription ||
        summarySnippet ||
        "ユーザーの操作意図、確認対象、結果の変化を照合しています。",
      icon: "material-symbols:psychology-outline",
    },
    {
      label: "操作ステップ",
      value:
        operationSteps[0] ||
        "スクリーンショット列と音声文脈から、再現できる手順へ分解しています。",
      icon: "material-symbols:format-list-numbered",
    },
  ];

  if (saveProgressPhase.value === "preparing") {
    return {
      heading: "扱いやすい長さへ整えています",
      subheading: "音声と映像の同期を保ったまま、無音除去とセクション分割を行っています。",
      badge: "動画調整",
      noteCount: splitPointsMs.value.length + cutSilenceRanges.value.length,
      lines: [
        silenceCutEnabled.value
          ? `無音候補 ${cutSilenceRanges.value.length}箇所をカット対象にしています。`
          : "無音カットはオフです。",
        `${splitPointsMs.value.length + 1}本のクリップを生成します。`,
      ],
      artifacts,
    };
  }

  if (saveProgressPhase.value === "parallelAnalysis") {
    return {
      heading: "クリップごとの解析を同時に進めています",
      subheading: "文字起こしは再実行せず、各区間の画面と発話を合わせてタイトル・説明・操作手順を作っています。",
      badge: "並列解析",
      noteCount: parallelAnalysisCompleted.value,
      lines: [
        `${parallelAnalysisCompleted.value}/${parallelAnalysisTotal.value}クリップの後続解析が完了しました。`,
        `${preparedTranscription.value?.segments.length ?? 0}件のタイムコード付き発話を区間ごとに再利用しています。`,
      ],
      artifacts,
    };
  }

  if (saveProgressPhase.value === "extracting") {
    return {
      heading: "画面の流れを読み取っています",
      subheading: "5秒ごとのスクリーンショットから、どの画面で何が起きたかを並べています。",
      badge: "視覚解析",
      noteCount,
      lines:
        frameCaptures.value.length > 0
          ? [
              `${frameCaptures.value.length}枚の操作画面を抽出済みです。`,
              "後続のAI解析で画面変化と発話を照合します。",
            ]
          : [],
      artifacts,
    };
  }

  if (saveProgressPhase.value === "transcribing") {
    return {
      heading: "発話内容を聞き取っています",
      subheading: "Geminiの文字起こしをタイムコード付きで受け取り、クリップの意図を説明できる材料にしています。",
      badge: "音声理解",
      noteCount,
      lines: transcriptSnippet
        ? [transcriptSnippet, `${transcriptText.value.length}文字の発話テキストを処理中です。`]
        : transcriptSegments.value.length > 0
          ? [`${transcriptSegments.value.length}件のタイムスタンプ付き発話を取得しました。`]
        : [],
      artifacts,
    };
  }

  if (saveProgressPhase.value === "summarizing") {
    return {
      heading: "話していた意図を短く整理しています",
      subheading: "長い文字起こしから、操作目的、確認した対象、結果の変化を抽出しています。",
      badge: "要約中",
      noteCount,
      lines: summarySnippet
        ? [summarySnippet]
        : transcriptSnippet
          ? [transcriptSnippet, "この発話から操作意図の骨子を作っています。"]
          : [],
      artifacts,
    };
  }

  if (saveProgressPhase.value === "scanning") {
    return {
      heading: "クリップの意味を組み立てています",
      subheading: "映像、スクリーンショット、発話、要約を合わせて、タイトル・説明・手順へ変換しています。",
      badge: "AI解析",
      noteCount,
      lines: [
        scanTitle ? `タイトル候補: ${scanTitle}` : "",
        scanDescription || operationMemo || summarySnippet,
        operationSteps[0] ? `最初の操作: ${operationSteps[0]}` : "",
      ].filter(Boolean),
      artifacts,
    };
  }

  if (saveProgressPhase.value === "uploading") {
    return {
      heading: "理解した内容を保存しています",
      subheading: "クリップ、スクリーンショット、文字起こし、AI解析メモをあとから検索できる形にしています。",
      badge: "保存中",
      noteCount,
      lines: [
        `${frameCaptures.value.length}枚のスクリーンショットを保存対象に含めています。`,
        summarySnippet || scanDescription || "解析メモとメタデータをFirestoreへ登録しています。",
      ].filter(Boolean),
      artifacts,
    };
  }

  if (saveProgressPhase.value === "done") {
    return {
      heading: "クリップメモの保存が完了しました",
      subheading: "このあと詳細画面で、クリップ・文字起こし・操作ステップをまとめて確認できます。",
      badge: "完了",
      noteCount,
      lines: [
        scanTitle ? `保存タイトル: ${scanTitle}` : "保存済みのクリップ詳細へ移動します。",
        summarySnippet || scanDescription || "",
      ].filter(Boolean),
      artifacts,
    };
  }

  if (saveProgressPhase.value === "error") {
    return {
      heading: "保存処理を確認しています",
      subheading: errorMessage.value || "途中結果を確認し、再実行できる状態に戻しています。",
      badge: "要確認",
      noteCount,
      lines: [errorMessage.value || transcriptErrorMessage.value].filter(Boolean),
      artifacts,
    };
  }

  return {
    heading: "クリップの理解を準備しています",
    subheading: "録画データを受け取り、画面と発話を合わせて読める形に整えています。",
    badge: "準備中",
    noteCount,
    lines: [],
    artifacts,
  };
});
function compactPreviewText(text: string, maxLength: number): string {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (!normalized) return "";
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength - 1)}…`;
}

function saveProgressStatusLabel(status: SaveProgressStepStatus): string {
  if (status === "done") return "完了";
  if (status === "active") return "実行中";
  if (status === "error") return "確認";
  return "待機";
}

const saveProgressSteps = computed<SaveProgressStep[]>(() => {
  const phase = saveProgressPhase.value;
  const prepareStatus: SaveProgressStepStatus =
    phase === "preparing"
      ? "active"
      : phase === "idle"
        ? "pending"
        : phase === "error" && !workflowVideoId.value
          ? "error"
          : "done";
  const extractStatus: SaveProgressStepStatus =
    phase === "extracting" || phase === "parallelAnalysis"
      ? "active"
      : ["transcribing", "summarizing", "scanning", "analysisSaving", "done"].includes(phase)
        ? "done"
        : phase === "error" && frameCaptures.value.length === 0
          ? "error"
          : "pending";
  const transcribeStatus: SaveProgressStepStatus =
    phase === "transcribing"
      ? "active"
      : phase === "parallelAnalysis" && Boolean(preparedTranscription.value)
        ? "done"
      : transcriptErrorMessage.value
        ? "error"
      : ["summarizing", "scanning", "analysisSaving", "done"].includes(phase)
        ? "done"
        : phase === "error" && frameCaptures.value.length > 0
          ? "error"
          : "pending";
  const summarizeStatus: SaveProgressStepStatus =
    phase === "summarizing" || phase === "parallelAnalysis"
      ? "active"
      : ["scanning", "analysisSaving", "done"].includes(phase)
        ? "done"
        : phase === "error" && Boolean(transcriptText.value)
          ? "error"
          : "pending";
  const scanStatus: SaveProgressStepStatus =
    phase === "scanning" || phase === "parallelAnalysis"
      ? "active"
      : ["analysisSaving", "done"].includes(phase)
        ? "done"
        : phase === "error" && frameCaptures.value.length > 0
          ? "error"
          : "pending";
  const uploadingStatus: SaveProgressStepStatus =
    phase === "saving"
      ? "active"
      : ["extracting", "transcribing", "summarizing", "scanning", "analysisSaving", "parallelAnalysis", "done"].includes(phase)
        ? "done"
        : phase === "error" && workflowVideoId.value
          ? "done"
          : phase === "error"
            ? "error"
            : "pending";
  return [
    {
      key: "prepare",
      index: 1,
      label: "無音カット・分割",
      description:
        phase === "preparing"
          ? `無音候補 ${cutSilenceRanges.value.length}箇所を整理し、${splitPointsMs.value.length + 1}本へ分割しています。`
          : "無音区間と分割位置を反映し、解析しやすい動画へ整えます。",
      status: prepareStatus,
      statusLabel: saveProgressStatusLabel(prepareStatus),
    },
    {
      key: "frames",
      index: 2,
      label: "スクリーンショットを抽出",
      description: `${frameCaptures.value.length}枚の操作スクリーンショットを準備しています。`,
      status: extractStatus,
      statusLabel: saveProgressStatusLabel(extractStatus),
    },
    {
      key: "transcript",
      index: 3,
      label: "Gemini文字起こし",
      description: transcriptErrorMessage.value
        ? transcriptErrorMessage.value
        : transcriptText.value
        ? `${transcriptText.value.length}文字 / ${transcriptSegments.value.length}件のタイムコードを取得しました。`
        : "同時録音したマイク音声から文字起こし全文を取得します。",
      status: transcribeStatus,
      statusLabel: saveProgressStatusLabel(transcribeStatus),
    },
    {
      key: "summary",
      index: 4,
      label: "文字起こしを要約",
      description: transcriptSummary.value
        ? "文字起こしの要約を作成しました。"
        : "Geminiで操作意図を短く整理します。",
      status: summarizeStatus,
      statusLabel: saveProgressStatusLabel(summarizeStatus),
    },
    {
      key: "scan",
      index: 5,
      label: "AIクリップ解析",
      description: quickScan.value?.errorMessage
        ? "簡易スキャンは失敗しましたが、クリップ保存は継続します。"
        : "4種類の入力からタイトル、説明、操作ステップをFirebase AI Logicで生成します。",
      status: scanStatus,
      statusLabel: saveProgressStatusLabel(scanStatus),
    },
    {
      key: "upload",
      index: 6,
      label: "クリップを保存",
      description: workflowVideoId.value
        ? "クリップ本体は保存済みです。"
        : "まずクリップファイルを永続化しています。",
      status: uploadingStatus,
      statusLabel: saveProgressStatusLabel(uploadingStatus),
    },
  ];
});

watch(
  () => props.application,
  (application) => {
    if (!application) return;
    title.value = `${application.name} ザッピング`;
  },
  { immediate: true }
);

watch(
  () => props.clipGroups,
  (groups) => {
    if (pendingCreatedGroupName.value) {
      const created = groups.find(
        (group) => group.name === pendingCreatedGroupName.value
      );
      if (created) {
        selectedVideoGroupId.value = created.id;
        pendingCreatedGroupName.value = "";
        return;
      }
    }
    if (groups.some((group) => group.id === selectedVideoGroupId.value)) return;
    selectedVideoGroupId.value = groups[0]?.id ?? "";
  },
  { immediate: true, deep: true }
);

watch(
  () => props.clipRecords,
  (videos) => {
    if (!videos.some((video) => video.id === selectedVideoId.value)) {
      selectedVideoId.value = videos[0]?.id ?? "";
    }
    if (detailVideoId.value && !videos.some((video) => video.id === detailVideoId.value)) {
      detailVideoId.value = "";
    }
    const activeDetail = videos.find((video) => video.id === detailVideoId.value);
    const activeClips = activeDetail
      ? videos
          .filter((video) => video.clipGroupId === activeDetail.clipGroupId)
          .flatMap((video) => videoClips(video))
      : [];
    if (
      selectedClipId.value !== ALL_CLIPS_SELECTION_ID &&
      activeClips.length > 0 &&
      !activeClips.some((clip) => clip.id === selectedClipId.value)
    ) {
      selectedClipId.value = activeClips[0]?.id ?? "";
    }
    if (activeClips.length === 0) {
      selectedClipId.value = "";
    }
    const activeStories = activeDetail?.analysisResult?.storyCandidates ?? [];
    if (
      selectedAnalysisStoryId.value &&
      !activeStories.some((story) => story.id === selectedAnalysisStoryId.value)
    ) {
      selectedAnalysisStoryId.value = activeStories[0]?.id ?? "";
    }
    if (
      quickScanPreviewVideoId.value &&
      !videos.some((video) => video.id === quickScanPreviewVideoId.value)
    ) {
      quickScanPreviewVideoId.value = "";
    }
    if (
      deleteTargetVideoId.value &&
      !videos.some((video) => video.id === deleteTargetVideoId.value)
    ) {
      deleteTargetVideoId.value = "";
      deleteVideoConfirmOpen.value = false;
    }
    if (deleteTargetClipVideoId.value) {
      const deleteTargetVideo = videos.find((video) => video.id === deleteTargetClipVideoId.value);
      const deleteTargetClips = deleteTargetVideo ? videoClips(deleteTargetVideo) : [];
      if (!deleteTargetVideo || !deleteTargetClips.some((clip) => clip.id === deleteTargetClipId.value)) {
        deleteTargetClipVideoId.value = "";
        deleteTargetClipId.value = "";
        deleteClipConfirmOpen.value = false;
      }
    }
    applyRouteDetailTarget(videos);
    void resolveVideoUrls(videos);
  },
  { immediate: true, deep: true }
);

watch(
  [() => route.query.operationVideoId, () => route.query.operationVideoTab],
  () => {
    applyRouteDetailTarget(props.clipRecords);
  }
);

watch(
  detailStories,
  (stories) => {
    if (!stories.some((story) => story.id === selectedAnalysisStoryId.value)) {
      selectedAnalysisStoryId.value = stories[0]?.id ?? "";
    }
  },
  { immediate: true }
);

watch(
  contextMapData,
  (data) => {
    if (!contextMapOpen.value) return;
    if (!selectedContextMapNodeId.value) return;
    if (data.nodes.some((node) => node.id === selectedContextMapNodeId.value)) return;
    selectedContextMapNodeId.value =
      data.nodes.find((node) => node.kind === "video")?.id ?? data.nodes[0]?.id ?? "";
  },
  { deep: true }
);

watch(
  () => selectedDetailClip.value?.id ?? "",
  () => {
    selectedClipPlaybackMs.value = 0;
    selectedClipContentTab.value = "transcript";
    lastScrolledSelectedClipCueId.value = "";
    selectedClipTranscriptCueElements.clear();
  }
);

watch(
  activeSelectedClipCueId,
  (cueId) => {
    if (!cueId || cueId === lastScrolledSelectedClipCueId.value) return;
    lastScrolledSelectedClipCueId.value = cueId;
    void nextTick(() => {
      const element = selectedClipTranscriptCueElements.get(cueId);
      const scroller = selectedClipTranscriptScroller.value;
      if (!element || !scroller) return;
      element.scrollIntoView({ block: "nearest", behavior: "smooth" });
    });
  }
);

watch(
  reportHtml,
  () => {
    refreshReportHtmlUrl();
  },
  { immediate: true }
);

watch(reportMode, () => {
  reportCopied.value = false;
});

watch(
  () => props.application?.id || "",
  (applicationId) => {
    void fetchClipDrafts(applicationId);
  },
  { immediate: true }
);

watch(
  [
    title,
    selectedVideoGroupId,
    silenceCutEnabled,
    noiseReductionEnabled,
    silenceRanges,
    keptSilenceRangeIndexes,
    manualCutRanges,
    splitPointsMs,
    aiSectionDrafts,
  ],
  () => scheduleActiveClipDraftSave(),
  { deep: true }
);

watch(
  [recordedBlob, recordedAudioBlob],
  ([videoBlob, audioBlob]) => {
    if (!videoBlob) {
      silenceRanges.value = [];
      manualCutRanges.value = [];
      audioLevelSamples.value = [];
      keptSilenceRangeIndexes.value = [];
      return;
    }
    if (!audioBlob) return;
    void analyzeRecordedSilence(audioBlob);
  }
);

watch(
  [
    saveProgressOpen,
    () => saveProgressPhase.value,
    () => frameCaptures.value.length,
  ],
  ([isOpen, phase, frameCount]) => {
    stopSaveProgressFramePreviewTimer();
    saveProgressFramePreviewIndex.value = 0;
    if (
      !isOpen ||
      frameCount <= 1 ||
      !["extracting", "summarizing", "scanning", "analysisSaving"].includes(phase)
    ) {
      return;
    }
    saveProgressFramePreviewTimer = setInterval(() => {
      saveProgressFramePreviewIndex.value =
        (saveProgressFramePreviewIndex.value + 1) % frameCount;
    }, 1000);
  },
  { immediate: true }
);

watch(
  [saveProgressOpen, () => saveProgressPhase.value],
  ([isOpen, phase]) => {
    stopSaveProgressActivityTimer();
    saveProgressActivitySeconds.value = 0;
    if (!isOpen || ["idle", "done", "error"].includes(phase)) return;
    const startedAt = Date.now();
    saveProgressActivityTimer = setInterval(() => {
      saveProgressActivitySeconds.value = Math.max(
        1,
        Math.floor((Date.now() - startedAt) / 1000)
      );
    }, 1000);
  },
  { immediate: true }
);

watch(relatedContextProviderTab, (tab) => {
  if (tab === "jira") void ensureJiraConnections();
});

watch(detailVideoId, () => {
  jiraSearchResults.value = [];
  jiraListMode.value = "project";
  selectedJiraIssueKeys.value = [];
  jiraSearchError.value = "";
});

function startBulkContextCollection(): void {
  if (!detailVideo.value || isRelatedContextBusy(detailVideo.value)) return;
  if (bulkContextTimer.value) clearTimeout(bulkContextTimer.value);
  bulkContextCompleted.value = false;
  bulkContextSteps.value = bulkContextSteps.value.map((step, index) => ({
    ...step,
    status: index === 0 ? "running" : "pending",
  }));
  bulkContextModalOpen.value = true;
  emit("collect-related-contexts", detailVideo.value.id);

  bulkContextTimer.value = setTimeout(() => {
    bulkContextSteps.value = bulkContextSteps.value.map((step) => ({
      ...step,
      status: "done",
    }));
    bulkContextCompleted.value = true;
    bulkContextTimer.value = null;
  }, 1800);
}

function handleClipDraftBeforeUnload(event: BeforeUnloadEvent): void {
  const hasUnsavedRecording = Boolean(
    recordedBlob.value && !activeClipDraftIsPersisted.value
  );
  if (
    !isRecording.value &&
    !isSavingClipDraft.value &&
    !hasUnsavedRecording
  ) {
    return;
  }
  event.preventDefault();
  event.returnValue = "";
}

onMounted(() => {
  document.addEventListener("click", handleDetailClipPickerDocumentClick);
  window.addEventListener("beforeunload", handleClipDraftBeforeUnload);
});

onBeforeUnmount(() => {
  document.removeEventListener("click", handleDetailClipPickerDocumentClick);
  window.removeEventListener("beforeunload", handleClipDraftBeforeUnload);
  stopSaveProgressFramePreviewTimer();
  stopSaveProgressActivityTimer();
  if (clipDraftAutosaveTimer) clearTimeout(clipDraftAutosaveTimer);
  if (bulkContextTimer.value) clearTimeout(bulkContextTimer.value);
  stopElapsedTimer();
  stopTracks();
  stopContextMapNodeDrag();
  revokePreviewUrl();
  revokePreparedPreviewUrl();
  revokeFramePreviewUrls();
  revokeReportHtmlUrl();
});

function openRecordingModal(): void {
  errorMessage.value = "";
  if (!selectedVideoGroup.value) {
    errorMessage.value = "先にクリップグループを作成・選択してください";
    return;
  }
  recordingModalOpen.value = true;
}

function stopSaveProgressFramePreviewTimer(): void {
  if (!saveProgressFramePreviewTimer) return;
  clearInterval(saveProgressFramePreviewTimer);
  saveProgressFramePreviewTimer = null;
}

function stopSaveProgressActivityTimer(): void {
  if (!saveProgressActivityTimer) return;
  clearInterval(saveProgressActivityTimer);
  saveProgressActivityTimer = null;
}

function currentClipDraftEditorState() {
  return {
    silenceCutEnabled: silenceCutEnabled.value,
    noiseReductionEnabled: noiseReductionEnabled.value,
    silenceRanges: [...silenceRanges.value],
    keptSilenceRangeIndexes: [...keptSilenceRangeIndexes.value],
    manualCutRanges: [...manualCutRanges.value],
    splitPointsMs: [...splitPointsMs.value],
    aiSectionDrafts: [...aiSectionDrafts.value],
  };
}

async function persistActiveClipDraft(
  patch: Partial<StoryVaultClipDraft> = {}
): Promise<void> {
  const draftId = activeClipDraftId.value;
  if (!draftId || isRestoringClipDraft.value) return;
  try {
    const updated = await updateClipDraft(draftId, {
      clipGroupId: selectedVideoGroupId.value || activeClipDraft.value?.clipGroupId || "",
      title: title.value.trim() || activeClipDraft.value?.title || "録画下書き",
      editorState: currentClipDraftEditorState(),
      ...patch,
    });
    clipDraftSaveError.value = "";
    clipDraftLastSavedAt.value = updated.updatedAt;
  } catch (error) {
    clipDraftSaveError.value =
      error instanceof Error ? error.message : "録画下書きの更新に失敗しました";
    reportDatadogError(error, {
      feature: "storyvault_clip_draft_autosave",
      draftId,
    });
  }
}

function scheduleActiveClipDraftSave(): void {
  if (!activeClipDraftId.value || isRestoringClipDraft.value) return;
  if (clipDraftAutosaveTimer) clearTimeout(clipDraftAutosaveTimer);
  clipDraftAutosaveTimer = setTimeout(() => {
    clipDraftAutosaveTimer = null;
    void persistActiveClipDraft();
  }, 450);
}

async function saveRecordedBlobAsDraft(
  blob: Blob,
  durationMs: number
): Promise<void> {
  const application = props.application;
  const group = selectedVideoGroup.value;
  if (!application || !group || blob.size <= 0) return;
  isSavingClipDraft.value = true;
  clipDraftSaveError.value = "";
  const previousDraft = activeClipDraft.value;
  try {
    const draft = await createClipDraft({
      applicationId: application.id,
      clipGroupId: group.id,
      blob,
      durationMs,
      sourceDisplaySurface: sourceDisplaySurface.value,
      title: title.value.trim() || undefined,
    });
    activeClipDraftId.value = draft.id;
    clipDraftLastSavedAt.value = draft.updatedAt;
    if (previousDraft && previousDraft.id !== draft.id && !previousDraft.source) {
      void discardClipDraft(previousDraft);
    }
    await persistActiveClipDraft({
      status: "editing",
      statusMessage: "編集を再開できます",
    });
  } catch (error) {
    const failedDraft = applicationClipDrafts.value.find(
      (draft) => draft.status === "error" && !draft.source
    );
    if (failedDraft) activeClipDraftId.value = failedDraft.id;
    clipDraftSaveError.value =
      error instanceof Error ? error.message : "録画下書きの保存に失敗しました";
  } finally {
    isSavingClipDraft.value = false;
  }
}

async function retryActiveClipDraftSave(): Promise<void> {
  if (!recordedBlob.value) return;
  await saveRecordedBlobAsDraft(
    recordedBlob.value,
    sourceRecordingDurationMs.value
  );
}

function openAppendRecordingModal(video: DecodedStoryVaultClip): void {
  errorMessage.value = "";
  selectedVideoGroupId.value = video.clipGroupId || selectedVideoGroupId.value;
  recordingModalOpen.value = true;
}

function clipDraftStatusLabel(draft: StoryVaultClipDraft): string {
  if (draft.status === "saving") return "保存中";
  if (draft.status === "processing") return "処理中";
  if (draft.status === "ready") return "分割案あり";
  if (draft.status === "error") return "要確認";
  return "編集中";
}

function clipDraftStatusClass(draft: StoryVaultClipDraft): string {
  if (draft.status === "ready") return "bg-emerald-50 text-emerald-700";
  if (draft.status === "processing" || draft.status === "saving") {
    return "bg-cyan-50 text-cyan-700";
  }
  if (draft.status === "error") return "bg-red-50 text-red-700";
  return "bg-amber-50 text-amber-700";
}

function formatClipDraftUpdatedAt(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("ja-JP", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function openDiscardClipDraftConfirm(draft: StoryVaultClipDraft): void {
  discardClipDraftTarget.value = draft;
  discardClipDraftConfirmOpen.value = true;
}

async function confirmDiscardClipDraft(): Promise<void> {
  const draft = discardClipDraftTarget.value;
  if (!draft || discardingClipDraftId.value) return;
  discardingClipDraftId.value = draft.id;
  try {
    await discardClipDraft(draft);
    if (activeClipDraftId.value === draft.id) {
      resetRecording();
      recordingModalOpen.value = false;
    }
    discardClipDraftConfirmOpen.value = false;
    discardClipDraftTarget.value = null;
  } catch (error) {
    errorMessage.value =
      error instanceof Error ? error.message : "録画下書きの破棄に失敗しました";
  } finally {
    discardingClipDraftId.value = "";
  }
}

function openGroupCreateModal(): void {
  errorMessage.value = "";
  groupNameDraft.value = "";
  groupDescriptionDraft.value = "";
  groupCreateModalOpen.value = true;
}

function submitClipGroup(): void {
  if (!props.application) return;
  const name = groupNameDraft.value.trim();
  if (!name) return;
  emit("create-clip-group", {
    applicationId: props.application.id,
    name,
    description: groupDescriptionDraft.value.trim() || undefined,
  });
  pendingCreatedGroupName.value = name;
  groupNameDraft.value = "";
  groupDescriptionDraft.value = "";
  groupCreateModalOpen.value = false;
}

function openGroupDeleteConfirm(group: DecodedStoryVaultClipGroup): void {
  deleteTargetGroup.value = group;
  deleteGroupConfirmOpen.value = true;
}

function deleteConfirmedGroup(): void {
  const group = deleteTargetGroup.value;
  if (!group || groupVideoCount(group.id) > 0) return;
  deleteGroupConfirmOpen.value = false;
  deleteTargetGroup.value = null;
  emit("delete-clip-group", group.id);
}

function openVideoDeleteConfirm(video: DecodedStoryVaultClip): void {
  deleteTargetVideoId.value = video.id;
  deleteVideoConfirmOpen.value = true;
}

function openClipDeleteConfirm(
  video: DecodedStoryVaultClip,
  clip: StoryVaultOperationVideoClip
): void {
  if (videoClips(video).length <= 1) {
    openVideoDeleteConfirm(video);
    return;
  }
  deleteTargetClipVideoId.value = video.id;
  deleteTargetClipId.value = clip.id;
  deleteClipConfirmOpen.value = true;
}

function applyOrganizationPlan(
  plan: ClipGroupAssistantPlan,
  childCallbacks?: ClipGroupOrganizationCallbacks
): void {
  errorMessage.value = "";
  isApplyingOrganizationPlan.value = true;
  emit("apply-clip-group-organization-plan", plan, {
    onSuccess: () => {
      errorMessage.value = "";
      childCallbacks?.onSuccess?.();
    },
    onError: (message) => {
      errorMessage.value = message;
      childCallbacks?.onError?.(message);
    },
    onFinally: () => {
      isApplyingOrganizationPlan.value = false;
      childCallbacks?.onFinally?.();
    },
  });
}

function handleRecordingModalClose(): void {
  if (isRecording.value) return;
  errorMessage.value = "";
}

async function startCapture(): Promise<void> {
  errorMessage.value = "";
  if (!navigator.mediaDevices?.getDisplayMedia) {
    errorMessage.value = "このブラウザでは画面録画を開始できません";
    return;
  }
  if (!navigator.mediaDevices?.getUserMedia) {
    errorMessage.value = "このブラウザではマイク録音を開始できません";
    return;
  }

  try {
    resetRecording();
    microphoneStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      } as MediaTrackConstraints,
    });
    microphoneActive.value = microphoneStream.getAudioTracks().some(
      (track) => track.readyState === "live"
    );
    setupAudioAnalyser(microphoneStream);

    displayStream = await navigator.mediaDevices.getDisplayMedia({
      video: { displaySurface: "window" } as MediaTrackConstraints,
      audio: false,
    });
    const stream = new MediaStream([
      ...displayStream.getVideoTracks(),
      ...microphoneStream.getAudioTracks(),
    ]);
    mediaStream = stream;
    await attachLivePreview(stream);
    const track = displayStream.getVideoTracks()[0];
    const settings = (track?.getSettings() ?? {}) as MediaTrackSettings & {
      displaySurface?: string;
    };
    sourceDisplaySurface.value = parseDisplaySurface(settings.displaySurface);
    track?.addEventListener("ended", () => {
      if (isRecording.value) stopCapture();
    });

    const mimeType = resolveRecorderMimeType();
    mediaRecorder = new MediaRecorder(
      stream,
      mimeType ? { mimeType } : undefined
    );
    chunks = [];
    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunks.push(event.data);
    };
    mediaRecorder.onstop = () => {
      const blobType = mediaRecorder?.mimeType || mimeType || "video/webm";
      const blob = new Blob(chunks, { type: blobType });
      // The interval display is intentionally coarse and can be up to 500 ms
      // behind the actual recording. Persist the shared recorder clock instead.
      const durationMs = Math.max(0, Date.now() - startedAt);
      elapsedMs.value = durationMs;
      recordedBlob.value = blob;
      recordedDurationMs.value = durationMs;
      previewUrl.value = URL.createObjectURL(blob);
      void saveRecordedBlobAsDraft(blob, durationMs);
      stopElapsedTimer();
      stopTracks();
      mediaRecorder = null;
      isRecording.value = false;
    };
    // Start both MediaRecorders from the same origin. Starting the audio-only
    // recorder before getDisplayMedia() included time spent in the browser's
    // screen picker and shifted silence/waveform data ahead of the video.
    startedAt = Date.now();
    elapsedMs.value = 0;
    elapsedTimer = window.setInterval(() => {
      elapsedMs.value = Date.now() - startedAt;
    }, 500);
    startAudioOnlyRecorder(microphoneStream);
    mediaRecorder.start(1000);
    isRecording.value = true;
  } catch (error) {
    errorMessage.value =
      error instanceof Error ? error.message : "録画開始に失敗しました";
    stopElapsedTimer();
    stopTracks();
    mediaRecorder = null;
    audioRecorder = null;
    isRecording.value = false;
  }
}

function stopCapture(): void {
  if (audioRecorder && audioRecorder.state !== "inactive") {
    audioRecorder.stop();
  }
  if (mediaRecorder && mediaRecorder.state !== "inactive") {
    mediaRecorder.stop();
    return;
  }
  stopElapsedTimer();
  stopTracks();
  isRecording.value = false;
}

function startAudioOnlyRecorder(stream: MediaStream): void {
  const audioTracks = stream.getAudioTracks();
  if (audioTracks.length === 0) {
    recordedAudioBlob.value = null;
    return;
  }
  const audioStream = new MediaStream(audioTracks);
  const mimeType = resolveAudioRecorderMimeType();
  audioChunks = [];
  audioRecorder = new MediaRecorder(
    audioStream,
    mimeType ? { mimeType } : undefined
  );
  lastAudioMimeType = audioRecorder.mimeType || mimeType || "audio/webm";
  audioRecorder.ondataavailable = (event) => {
    if (event.data.size > 0) audioChunks.push(event.data);
  };
  audioRecorder.onstop = () => {
    recordedAudioBlob.value = new Blob(audioChunks, { type: lastAudioMimeType });
    audioRecorder = null;
  };
  audioRecorder.start(1000);
}

function resetRecording(): void {
  if (isRecording.value) return;
  if (clipDraftAutosaveTimer) {
    clearTimeout(clipDraftAutosaveTimer);
    clipDraftAutosaveTimer = null;
  }
  revokePreviewUrl();
  revokePreparedPreviewUrl();
  recordedBlob.value = null;
  recordedAudioBlob.value = null;
  recordedDurationMs.value = undefined;
  recordedPreviewMs.value = 0;
  isRecordedPreviewPlaying.value = false;
  isScrubbingSilenceTimeline.value = false;
  isSelectingManualCutRange.value = false;
  manualRangeSelectionActive.value = false;
  manualCutSelectionAnchorMs.value = null;
  manualCutSelectionCurrentMs.value = null;
  silenceCutEnabled.value = true;
  noiseReductionEnabled.value = true;
  silenceRanges.value = [];
  manualCutRanges.value = [];
  audioLevelSamples.value = [];
  keptSilenceRangeIndexes.value = [];
  splitPointsMs.value = [];
  preparedBaseClip.value = null;
  preparedTranscription.value = null;
  aiSectionDrafts.value = [];
  preparedSilenceFingerprint.value = "";
  clipPreparationPhase.value = "idle";
  clipPreparationError.value = "";
  clipPreparationProgressOpen.value = false;
  clipPreparationProgress.value = null;
  activeClipDraftId.value = "";
  isSavingClipDraft.value = false;
  clipDraftSaveError.value = "";
  clipDraftLastSavedAt.value = "";
  clipEditingStep.value = 1;
  recordingProcessingMode.value = "automatic";
  isAnalyzingSilence.value = false;
  isPreparingClips.value = false;
  parallelAnalysisCompleted.value = 0;
  parallelAnalysisTotal.value = 0;
  quickScan.value = undefined;
  transcriptText.value = "";
  transcriptProvider.value = "";
  transcriptSummary.value = "";
  transcriptSegments.value = [];
  transcriptSrt.value = "";
  transcriptTimingStatus.value = "unavailable";
  transcriptErrorMessage.value = "";
  revokeFramePreviewUrls();
  elapsedMs.value = 0;
  chunks = [];
  audioChunks = [];
  lastAudioMimeType = "audio/webm";
  sourceDisplaySurface.value = "unknown";
  microphoneActive.value = false;
  resetWaveform();
}

async function analyzeRecordedSilence(blob: Blob): Promise<void> {
  isAnalyzingSilence.value = true;
  try {
    const analysis = await analyzeAudioTimeline(blob, {
      thresholdDb: silenceThresholdDb,
      minSilenceMs: minimumSilenceMs,
      keepPaddingMs: 180,
    });
    silenceRanges.value = analysis.silenceRanges;
    audioLevelSamples.value = analysis.levelSamples;
    keptSilenceRangeIndexes.value = [];
  } catch (error) {
    silenceRanges.value = [];
    audioLevelSamples.value = [];
    keptSilenceRangeIndexes.value = [];
    reportDatadogError(error, {
      feature: "storyvault_clip_silence_preview",
      blobSize: blob.size,
    });
  } finally {
    isAnalyzingSilence.value = false;
  }
}

function updateRecordedPreviewTime(event: Event): void {
  recordedPreviewMs.value = Math.max(
    0,
    Math.round((event.currentTarget as HTMLVideoElement).currentTime * 1000)
  );
}

function reconcileRecordedPreviewDuration(event: Event): void {
  if (clipEditingStep.value !== 1 || isRecording.value) return;
  const video = event.currentTarget as HTMLVideoElement;
  const mediaDurationMs = Math.round(video.duration * 1000);
  if (!Number.isFinite(mediaDurationMs) || mediaDurationMs <= 0) return;
  const previousDurationMs = sourceRecordingDurationMs.value;
  if (Math.abs(mediaDurationMs - previousDurationMs) < 20) return;

  recordedDurationMs.value = mediaDurationMs;
  elapsedMs.value = mediaDurationMs;
  silenceRanges.value = normalizeStoryVaultCutRanges(
    silenceRanges.value,
    mediaDurationMs
  );
  manualCutRanges.value = normalizeStoryVaultCutRanges(
    manualCutRanges.value,
    mediaDurationMs
  );
  splitPointsMs.value = splitPointsMs.value.filter(
    (point) => point > 250 && point < mediaDurationMs - 250
  );

  const draft = activeClipDraft.value;
  if (draft?.source && draft.source.durationMs !== mediaDurationMs) {
    void persistActiveClipDraft({
      source: { ...draft.source, durationMs: mediaDurationMs },
    });
  }
}

function timelinePercent(timeMs: number): number {
  if (recordingDurationMs.value <= 0) return 0;
  return Math.max(0, Math.min(100, timeMs / recordingDurationMs.value * 100));
}

function timelineRangeStyle(startMs: number, endMs: number): Record<string, string> {
  return {
    left: `${timelinePercent(startMs)}%`,
    width: `${Math.max(0.2, timelinePercent(endMs) - timelinePercent(startMs))}%`,
  };
}

function seekRecordedPreview(timeMs: number): void {
  if (!recordedPreviewVideo.value) return;
  recordedPreviewVideo.value.currentTime = Math.max(0, timeMs / 1000);
  recordedPreviewMs.value = Math.max(0, Math.round(timeMs));
}

function audioLevelHeightPercent(db: number): number {
  return Math.max(3, Math.min(100, (db + 60) / 60 * 100));
}

function thresholdLineBottomPercent(db: number): number {
  return Math.max(0, Math.min(100, (db + 60) / 60 * 100));
}

function isAudioSampleBelowThreshold(sample: StoryVaultAudioLevelSample): boolean {
  return sample.db < silenceThresholdDb;
}

function isSilenceRangeKept(index: number): boolean {
  return keptSilenceRangeIndexes.value.includes(index);
}

function toggleSilenceRangeKept(index: number): void {
  keptSilenceRangeIndexes.value = isSilenceRangeKept(index)
    ? keptSilenceRangeIndexes.value.filter((item) => item !== index)
    : [...keptSilenceRangeIndexes.value, index].sort((a, b) => a - b);
}

function silenceTimelineTimeFromPointer(event: PointerEvent): number | null {
  const element = silenceTimeline.value;
  if (!element || recordingDurationMs.value <= 0) return null;
  const rect = element.getBoundingClientRect();
  if (rect.width <= 0) return null;
  const ratio = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
  return ratio * recordingDurationMs.value;
}

function seekSilenceTimelineFromPointer(event: PointerEvent): void {
  const timeMs = silenceTimelineTimeFromPointer(event);
  if (timeMs === null) return;
  seekRecordedPreview(timeMs);
}

function clearManualCutSelection(): void {
  manualCutSelectionAnchorMs.value = null;
  manualCutSelectionCurrentMs.value = null;
  isSelectingManualCutRange.value = false;
}

function toggleManualRangeSelection(): void {
  manualRangeSelectionActive.value = !manualRangeSelectionActive.value;
  clearManualCutSelection();
}

function updateManualCutSelectionFromPointer(event: PointerEvent): void {
  const timeMs = silenceTimelineTimeFromPointer(event);
  if (timeMs === null) return;
  manualCutSelectionCurrentMs.value = Math.round(timeMs);
  seekRecordedPreview(timeMs);
}

function addManualCutSelection(): void {
  const range = manualCutSelectionRange.value;
  if (!range || !canAddManualCutSelection.value) return;
  manualCutRanges.value = normalizeStoryVaultCutRanges(
    [...manualCutRanges.value, range],
    sourceRecordingDurationMs.value
  );
  clearManualCutSelection();
}

function removeManualCutRange(index: number): void {
  manualCutRanges.value = manualCutRanges.value.filter((_, itemIndex) => itemIndex !== index);
}

function handleSilenceTimelinePointerDown(event: PointerEvent): void {
  silenceTimeline.value?.setPointerCapture(event.pointerId);
  if (manualRangeSelectionActive.value) {
    const timeMs = silenceTimelineTimeFromPointer(event);
    if (timeMs === null) return;
    isSelectingManualCutRange.value = true;
    manualCutSelectionAnchorMs.value = Math.round(timeMs);
    manualCutSelectionCurrentMs.value = Math.round(timeMs);
    seekRecordedPreview(timeMs);
    return;
  }
  isScrubbingSilenceTimeline.value = true;
  seekSilenceTimelineFromPointer(event);
}

function handleSilenceTimelinePointerMove(event: PointerEvent): void {
  if (isSelectingManualCutRange.value) {
    updateManualCutSelectionFromPointer(event);
    return;
  }
  if (!isScrubbingSilenceTimeline.value) return;
  seekSilenceTimelineFromPointer(event);
}

function handleSilenceTimelinePointerUp(event: PointerEvent): void {
  if (isSelectingManualCutRange.value) {
    updateManualCutSelectionFromPointer(event);
    isSelectingManualCutRange.value = false;
  }
  isScrubbingSilenceTimeline.value = false;
  if (silenceTimeline.value?.hasPointerCapture(event.pointerId)) {
    silenceTimeline.value.releasePointerCapture(event.pointerId);
  }
}

async function toggleRecordedPreviewPlayback(): Promise<void> {
  const video = recordedPreviewVideo.value;
  if (!video) return;
  if (video.paused) {
    await video.play().catch(() => undefined);
  } else {
    video.pause();
  }
}

async function requestRecordedPreviewFullscreen(): Promise<void> {
  const video = recordedPreviewVideo.value;
  if (!video) return;
  await video.requestFullscreen?.().catch(() => undefined);
}

function toggleClipActionMenu(clipId: string): void {
  clipActionMenuId.value = clipActionMenuId.value === clipId ? "" : clipId;
}

function moveClipToGroup(clipId: string, groupId: string): void {
  clipActionMenuId.value = "";
  const clip = props.clips.find((item) => item.id === clipId);
  if (!clip || !groupId || clip.clipGroupId === groupId) return;
  emit("move-clip", clipId, groupId);
}

function addSplitPoint(timeMs: number): void {
  const point = Math.round(timeMs);
  if (point <= 250 || point >= recordingDurationMs.value - 250) return;
  if (splitPointsMs.value.some((existing) => Math.abs(existing - point) < 500)) return;
  splitPointsMs.value = [...splitPointsMs.value, point].sort((a, b) => a - b);
}

function addSplitAtCurrentTime(): void {
  addSplitPoint(recordedPreviewMs.value);
}

function removeSplitPoint(point: number): void {
  splitPointsMs.value = splitPointsMs.value.filter((item) => item !== point);
}

function restoreAiSplitProposal(): void {
  if (aiSectionDrafts.value.length === 0) return;
  splitPointsMs.value = [...aiSuggestedSplitPointsMs.value];
}

function applyTranscriptionToPanel(transcription: GeminiTranscriptionResult): void {
  transcriptText.value = transcription.text;
  transcriptProvider.value = transcription.provider;
  transcriptSegments.value = transcription.segments;
  transcriptSrt.value = transcription.srt;
  transcriptTimingStatus.value = transcription.timingStatus;
  transcriptErrorMessage.value = "";
}

async function handleClipPreparationProgress(
  progress: StoryVaultClipPreparationProgress
): Promise<void> {
  clipPreparationProgress.value = progress;
  await persistActiveClipDraft({
    status: "processing",
    statusMessage: "動画を調整しています",
    preparationState: {
      phase: "trimming",
      requestId: progress.requestId,
      requestPath: progress.requestPath,
      errorMessage: "",
    },
  });
}

function clipPreparationLogLabel(log: StoryVaultClipPreparationLog): string {
  const labels: Record<string, string> = {
    download: "元動画を取得",
    detect_silence: "動画タイムラインを解析",
    render: "調整済み動画を書き出し",
    upload: "生成物をアップロード",
    completed: "Cloud Run処理完了",
    error: "処理エラー",
  };
  return labels[log.currentStep || ""] || "処理ログ";
}

function formatClipPreparationLogTime(value: unknown): string {
  let date: Date | null = null;
  if (typeof value === "string") {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) date = parsed;
  } else if (value && typeof value === "object" && "toDate" in value) {
    const toDate = (value as { toDate?: () => Date }).toDate;
    if (typeof toDate === "function") date = toDate.call(value);
  }
  return date
    ? new Intl.DateTimeFormat("ja-JP", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      }).format(date)
    : "";
}

function clipDraftTranscription(
  transcription: GeminiTranscriptionResult
): StoryVaultClipDraftTranscription {
  return {
    text: transcription.text,
    provider: transcription.provider,
    segments: transcription.segments,
    srt: transcription.srt,
    timingStatus: transcription.timingStatus,
  };
}

async function completeSectioningPreparation(
  prepared: PreparedRecordingClip,
  transcription: GeminiTranscriptionResult
): Promise<void> {
  preparedTranscription.value = transcription;
  applyTranscriptionToPanel(transcription);
  clipPreparationPhase.value = "sectioning";
  await persistActiveClipDraft({
    status: "processing",
    statusMessage: "AIで分割案を作成しています",
    preparationState: {
      phase: "sectioning",
      transcription: clipDraftTranscription(transcription),
      errorMessage: "",
    },
  });
  const sections = await generateTranscriptSections({
    cues: transcription.segments,
    durationMs: prepared.durationMs,
  });
  aiSectionDrafts.value = sections;
  splitPointsMs.value = sectionSplitPointsMs(sections);
  preparedSilenceFingerprint.value = currentSilenceFingerprint.value;
  recordedPreviewMs.value = 0;
  clipEditingStep.value = 2;
  clipPreparationPhase.value = "done";
  await persistActiveClipDraft({
    status: "ready",
    statusMessage: "分割案を確認できます",
    preparationState: {
      phase: "done",
      preparedGcsUri: prepared.gcsUri,
      preparedDurationMs: prepared.durationMs,
      transcription: clipDraftTranscription(transcription),
      errorMessage: "",
    },
  });
}

async function completeTranscriptAndSectionPreparation(
  prepared: PreparedRecordingClip
): Promise<void> {
  const normalizedPrepared: PreparedRecordingClip = {
    ...prepared,
    durationMs: prepared.durationMs || sourceRecordingDurationMs.value,
  };
  preparedBaseClip.value = normalizedPrepared;
  revokePreparedPreviewUrl();
  preparedPreviewUrl.value = URL.createObjectURL(normalizedPrepared.blob);

  clipPreparationPhase.value = "transcribing";
  await persistActiveClipDraft({
    status: "processing",
    statusMessage: "Geminiで文字起こししています",
    preparationState: {
      phase: "transcribing",
      preparedGcsUri: normalizedPrepared.gcsUri,
      preparedDurationMs: normalizedPrepared.durationMs,
      errorMessage: "",
    },
  });
  const transcription = await transcribeRecordingWithGemini(
    normalizedPrepared.blob,
    {
      gcsUri: normalizedPrepared.gcsUri,
      contentType: normalizedPrepared.blob.type || "video/mp4",
      fileName: "storyvault-prepared-video.mp4",
    }
  );
  await completeSectioningPreparation(normalizedPrepared, transcription);
}

async function prepareTranscriptAndSections(applySelectedCuts: boolean): Promise<void> {
  if (!props.application || !recordedBlob.value || isPreparingClips.value) return;
  if (!activeClipDraftIsPersisted.value || !activeClipDraft.value?.source) {
    clipDraftSaveError.value = "録画下書きの保存完了後に文字起こしを開始できます";
    return;
  }
  if (!applySelectedCuts) {
    silenceCutEnabled.value = false;
    manualCutRanges.value = [];
    manualRangeSelectionActive.value = false;
    clearManualCutSelection();
  }
  const cutRangesToApply = applySelectedCuts ? [...selectedCutRanges.value] : [];
  isPreparingClips.value = true;
  clipPreparationError.value = "";
  clipPreparationPhase.value = "trimming";
  clipPreparationProgressOpen.value = true;
  clipPreparationProgress.value = null;
  splitPointsMs.value = [];
  aiSectionDrafts.value = [];
  preparedTranscription.value = null;
  preparedBaseClip.value = null;
  preparedSilenceFingerprint.value = "";
  revokePreparedPreviewUrl();

  try {
    await persistActiveClipDraft({
      status: "processing",
      statusMessage: "動画調整を開始しています",
      preparationState: {
        phase: "trimming",
        errorMessage: "",
      },
    });
    const preparedClips = await prepareRecordedClips({
      applicationId: props.application.id,
      blob: recordedBlob.value,
      durationMs: sourceRecordingDurationMs.value,
      silenceCutEnabled: cutRangesToApply.length > 0,
      noiseReductionEnabled: noiseReductionEnabled.value,
      silenceRanges: cutRangesToApply,
      splitPointsMs: [],
      sourceGcsUri: activeClipDraft.value.source.gcsUri,
      onProgress: handleClipPreparationProgress,
    });
    const prepared = preparedClips[0];
    if (!prepared) throw new Error("文字起こし用の動画を生成できませんでした");
    await completeTranscriptAndSectionPreparation(prepared);
  } catch (error) {
    clipPreparationError.value =
      error instanceof Error ? error.message : "動画の準備に失敗しました";
    clipPreparationPhase.value = "error";
    await persistActiveClipDraft({
      status: "error",
      statusMessage: clipPreparationError.value,
      preparationState: {
        phase: "error",
        errorMessage: clipPreparationError.value,
      },
    });
    reportDatadogError(error, {
      feature: "storyvault_prepare_transcript_sections",
      applicationId: props.application.id,
      cutRangeCount: cutRangesToApply.length,
    });
  } finally {
    isPreparingClips.value = false;
  }
}

function transcriptionFromClipDraft(
  transcription: StoryVaultClipDraftTranscription
): GeminiTranscriptionResult {
  return {
    text: transcription.text,
    provider: transcription.provider,
    segments: transcription.segments,
    srt: transcription.srt,
    timingStatus: transcription.timingStatus,
  };
}

async function resumeClipDraft(draft: StoryVaultClipDraft): Promise<void> {
  if (!draft.source || resumingClipDraftId.value) return;
  resumingClipDraftId.value = draft.id;
  isRestoringClipDraft.value = true;
  try {
    resetRecording();
    isRestoringClipDraft.value = true;
    const sourceBlob = await loadDraftSource(draft);
    activeClipDraftId.value = draft.id;
    title.value = draft.title;
    selectedVideoGroupId.value = props.clipGroups.some(
      (group) => group.id === draft.clipGroupId
    )
      ? draft.clipGroupId
      : selectedVideoGroupId.value;
    recordedBlob.value = sourceBlob;
    recordedDurationMs.value = draft.source.durationMs;
    elapsedMs.value = draft.source.durationMs;
    sourceDisplaySurface.value = draft.source.sourceDisplaySurface;
    previewUrl.value = URL.createObjectURL(sourceBlob);
    silenceCutEnabled.value = draft.editorState.silenceCutEnabled;
    noiseReductionEnabled.value = draft.editorState.noiseReductionEnabled !== false;
    silenceRanges.value = [...draft.editorState.silenceRanges];
    keptSilenceRangeIndexes.value = [
      ...draft.editorState.keptSilenceRangeIndexes,
    ];
    manualCutRanges.value = [...draft.editorState.manualCutRanges];
    splitPointsMs.value = [...draft.editorState.splitPointsMs];
    aiSectionDrafts.value = [...draft.editorState.aiSectionDrafts];
    clipDraftLastSavedAt.value = draft.updatedAt;
    clipDraftSaveError.value = "";
    recordingModalOpen.value = true;

    const preparation = draft.preparationState;
    const preparedBlob = preparation?.preparedGcsUri
      ? await loadPreparedDraftVideo(draft)
      : null;
    const prepared = preparedBlob && preparation?.preparedGcsUri
      ? {
          blob: preparedBlob,
          durationMs:
            preparation.preparedDurationMs || draft.source.durationMs,
          gcsUri: preparation.preparedGcsUri,
        }
      : null;

    isRestoringClipDraft.value = false;
    if (prepared && preparation?.transcription) {
      preparedBaseClip.value = prepared;
      preparedPreviewUrl.value = URL.createObjectURL(prepared.blob);
      const transcription = transcriptionFromClipDraft(
        preparation.transcription
      );
      preparedTranscription.value = transcription;
      applyTranscriptionToPanel(transcription);
      preparedSilenceFingerprint.value = currentSilenceFingerprint.value;
      if (
        preparation.phase === "done" &&
        draft.editorState.aiSectionDrafts.length > 0
      ) {
        clipEditingStep.value = 2;
        clipPreparationPhase.value = "done";
        return;
      }
      isPreparingClips.value = true;
      clipPreparationProgressOpen.value = true;
      await completeSectioningPreparation(prepared, transcription);
      return;
    }

    if (prepared) {
      isPreparingClips.value = true;
      clipPreparationProgressOpen.value = true;
      await completeTranscriptAndSectionPreparation(prepared);
      return;
    }

    if (preparation?.requestPath && preparation.phase !== "error") {
      isPreparingClips.value = true;
      clipPreparationPhase.value = "trimming";
      clipPreparationProgressOpen.value = true;
      const clips = await resumeRecordedClipPreparation({
        requestPath: preparation.requestPath,
        onProgress: handleClipPreparationProgress,
      });
      const resumedPrepared = clips[0];
      if (!resumedPrepared) {
        throw new Error("調整済み動画を復元できませんでした");
      }
      await completeTranscriptAndSectionPreparation(resumedPrepared);
      return;
    }

    clipEditingStep.value = 1;
    clipPreparationPhase.value = preparation?.phase === "error" ? "error" : "idle";
    clipPreparationError.value = preparation?.errorMessage || "";
  } catch (error) {
    isRestoringClipDraft.value = false;
    clipPreparationError.value =
      error instanceof Error ? error.message : "録画下書きの再開に失敗しました";
    clipPreparationPhase.value = "error";
    clipPreparationProgressOpen.value = false;
    await persistActiveClipDraft({
      status: "error",
      statusMessage: clipPreparationError.value,
      preparationState: {
        phase: "error",
        errorMessage: clipPreparationError.value,
      },
    });
  } finally {
    isRestoringClipDraft.value = false;
    isPreparingClips.value = false;
    resumingClipDraftId.value = "";
  }
}

async function startAutomaticPipeline(): Promise<void> {
  if (!props.application || !recordedBlob.value || !activeClipDraft.value?.source) return;
  const group = selectedVideoGroup.value;
  if (!group) {
    errorMessage.value = "クリップグループを選択してください";
    return;
  }
  isStartingAutomaticPipeline.value = true;
  errorMessage.value = "";
  try {
    const submittedTitle = title.value.trim() || buildFallbackRecordingTitle();
    const pipelineId = await clipPipelineApi.createPipeline({
      applicationId: props.application.id,
      applicationName: props.application.name,
      clipGroupId: group.id,
      clipGroupName: group.name,
      title: submittedTitle,
      sourceDraftId: activeClipDraft.value.id,
      sourceGcsUri: activeClipDraft.value.source.gcsUri,
      sourceContentType: activeClipDraft.value.source.contentType,
      durationMs: activeClipDraft.value.source.durationMs,
      notificationEmail: getAuth().currentUser?.email || undefined,
    });
    submittedPipelineCount.value += 1;
    lastSubmittedRecordingTitle.value = submittedTitle;
    await persistActiveClipDraft({
      status: "processing",
      statusMessage: `バックグラウンド解析中 (${pipelineId})`,
    });
    toast.add({
      title: "バックグラウンド解析を開始しました",
      description: "ヘッダーの「解析ステータス」から進捗を確認できます。",
      color: "success",
    });
    recordingModalOpen.value = false;
    continueRecordingPromptOpen.value = true;
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : "バックグラウンド解析を開始できませんでした";
    reportDatadogError(error, {
      feature: "storyvault_clip_pipeline_start",
      applicationId: props.application.id,
    });
  } finally {
    isStartingAutomaticPipeline.value = false;
  }
}

async function recordNextClip(): Promise<void> {
  continueRecordingPromptOpen.value = false;
  resetRecording();
  title.value = "";
  recordingModalOpen.value = true;
  await nextTick();
  await startCapture();
}

function finishRecordingBatch(): void {
  continueRecordingPromptOpen.value = false;
  resetRecording();
  title.value = "";
  toast.add({
    title: `${submittedPipelineCount.value}本のバックグラウンド解析を実行中です`,
    description: "ヘッダーの「解析ステータス」または完了メールから確認できます。",
    color: "success",
  });
  submittedPipelineCount.value = 0;
  lastSubmittedRecordingTitle.value = "";
}

async function saveRecording(): Promise<void> {
  if (!props.application || !recordedBlob.value || !canSave.value) return;
  const preparedBase = preparedBaseClip.value;
  const transcription = preparedTranscription.value;
  if (!preparedBase || !transcription || !hasCurrentPreparedClip.value) {
    errorMessage.value = "先に文字起こしと分割案を準備してください";
    clipEditingStep.value = 1;
    return;
  }
  const group = selectedVideoGroup.value;
  if (!group) {
    errorMessage.value = "クリップグループを選択してください";
    return;
  }
  saveProgressOpen.value = true;
  saveWorkflowStep.value = "save";
  workflowVideoId.value = "";
  workflowClipId.value = "";
  errorMessage.value = "";
  saveProgressPhase.value = "saving";

  try {
    isPreparingClips.value = true;
    await persistActiveClipDraft({
      status: "processing",
      statusMessage: "クリップを確定保存しています",
    });
    let preparedClips: PreparedRecordingClip[] = [preparedBase];
    if (splitPointsMs.value.length > 0) {
      saveProgressPhase.value = "preparing";
      preparedClips = await prepareRecordedClips({
        applicationId: props.application.id,
        blob: preparedBase.blob,
        durationMs: preparedBase.durationMs,
        silenceCutEnabled: false,
        noiseReductionEnabled: false,
        silenceRanges: [],
        splitPointsMs: splitPointsMs.value,
      });
    }

    const boundaries = [0, ...splitPointsMs.value, preparedBase.durationMs];
    const baseTitle = title.value.trim() || buildFallbackRecordingTitle();
    const analysisJobs: Array<{
      video: DecodedStoryVaultClip;
      blob: Blob;
      durationMs: number;
      transcription: GeminiTranscriptionResult;
    }> = [];

    saveProgressPhase.value = "saving";
    for (const [index, prepared] of preparedClips.entries()) {
      const startMs = boundaries[index] ?? 0;
      const endMs = boundaries[index + 1] ?? preparedBase.durationMs;
      const section = preparedSectionSummaries.value[index];
      const clipTranscription = transcriptionForClipRange(
        transcription,
        startMs,
        endMs
      );
      const clipTitle = section?.isAiSuggested
        ? section.title
        : preparedClips.length > 1
          ? `${baseTitle} ${index + 1}/${preparedClips.length}`
          : baseTitle;
      const savedVideo = await persistRecordedVideoShell(group, {
        blob: prepared.blob,
        durationMs: prepared.durationMs,
        title: clipTitle,
        description: section?.isAiSuggested ? section.summary : undefined,
        transcription: clipTranscription,
      });
      analysisJobs.push({
        video: savedVideo,
        blob: prepared.blob,
        durationMs: prepared.durationMs,
        transcription: clipTranscription,
      });
      workflowVideoId.value ||= savedVideo.id;
      workflowClipId.value ||= savedVideo.id;
      selectedVideoGroupId.value = savedVideo.clipGroupId || group.id;
    }

    saveWorkflowStep.value = "videoAnalysis";
    saveProgressPhase.value = "parallelAnalysis";
    parallelAnalysisCompleted.value = 0;
    parallelAnalysisTotal.value = analysisJobs.length;
    isExtractingFrames.value = true;
    const command = await clipCommandApi.execute({
      operation: "quickScan",
      applicationId: props.application.id,
      clipGroupId: group.id,
      clipIds: analysisJobs.map((job) => job.video.id),
    });
    const failedClipIds = Array.isArray(command.output?.failedClipIds)
      ? command.output.failedClipIds
      : [];
    if (failedClipIds.length > 0) {
      throw new Error(`${failedClipIds.length}件のクリップ解析に失敗しました`);
    }
    emit("refresh");
    const analyzedVideos = analysisJobs.map((job) => job.video);
    const selected = analyzedVideos[0];
    if (selected) {
      workflowVideoId.value = selected.id;
      workflowClipId.value = selected.id;
      selectedVideoId.value = selected.id;
      detailVideoId.value = selected.id;
      selectedClipId.value = selected.id;
    }
    completePreparedRecordingWorkflow();
  } catch (error) {
    errorMessage.value =
      error instanceof Error ? error.message : "ザッピングクリップの保存に失敗しました";
    saveProgressPhase.value = "error";
    isExtractingFrames.value = false;
    await persistActiveClipDraft({
      status: "error",
      statusMessage: errorMessage.value,
    });
  } finally {
    isPreparingClips.value = false;
    isExtractingFrames.value = false;
  }
}

function persistRecordedVideoShell(
  group: DecodedStoryVaultClipGroup,
  override?: {
    blob: Blob;
    durationMs: number;
    title: string;
    description?: string;
    transcription?: GeminiTranscriptionResult;
  }
): Promise<DecodedStoryVaultClip> {
  if (!props.application || !recordedBlob.value) {
    return Promise.reject(new Error("保存する録画がありません"));
  }
  const blob = override?.blob ?? recordedBlob.value;
  const resolvedTitle = override?.title || title.value.trim() || buildFallbackRecordingTitle();
  const payload: StoryVaultClipSaveInput = {
    applicationId: props.application.id,
    clipGroupId: group.id,
    title: resolvedTitle,
    description: override?.description,
    blob,
    durationMs: override?.durationMs ?? recordedDurationMs.value ?? elapsedMs.value,
    contentType: blob.type || "video/webm",
    sourceDisplaySurface: sourceDisplaySurface.value,
    transcriptText: override?.transcription?.text,
    transcriptProvider: override?.transcription?.provider,
    transcriptSegments: override?.transcription?.segments,
    transcriptSrt: override?.transcription?.srt,
    transcriptTimingStatus: override?.transcription?.timingStatus ?? "unavailable",
    frameCaptures: [],
    tags: [],
  };
  return new Promise((resolve, reject) => {
    const callbacks: OperationVideoSaveCallbacks = {
      onSuccess: resolve,
      onError: (message) => reject(new Error(message)),
    };
    emit("save", payload, callbacks);
  });
}

function completePreparedRecordingWorkflow(): void {
  saveProgressPhase.value = "done";
  const committedDraft = activeClipDraft.value;
  if (committedDraft) {
    void discardClipDraft(committedDraft).catch((error) => {
      reportDatadogError(error, {
        feature: "storyvault_clip_draft_finalize_cleanup",
        draftId: committedDraft.id,
      });
    });
  }
  window.setTimeout(() => {
    recordingModalOpen.value = false;
    saveProgressOpen.value = false;
    saveProgressPhase.value = "idle";
    saveWorkflowStep.value = "save";
    workflowVideoId.value = "";
    workflowClipId.value = "";
    resetRecording();
  }, 900);
}

function transcriptionForClipRange(
  transcription: GeminiTranscriptionResult,
  startMs: number,
  endMs: number
): GeminiTranscriptionResult {
  const slicedSegments = sliceStoryVaultTranscriptCues(
    transcription.segments,
    startMs,
    endMs
  );
  const segments: StoryVaultTranscriptCue[] = slicedSegments.length > 0
    ? slicedSegments
    : [{
        id: "cue-0001",
        index: 1,
        startMs: 0,
        endMs: Math.max(1, endMs - startMs),
        text: "（発話なし）",
      }];
  return {
    text: segments.map((segment) => segment.text.trim()).filter(Boolean).join("\n"),
    provider: transcription.provider,
    segments,
    srt: transcriptCuesToSrt(segments),
    timingStatus: "timestamped",
  };
}

async function downloadOperationVideoClip(
  video: DecodedStoryVaultClip,
  clip: StoryVaultOperationVideoClip
): Promise<void> {
  if (!import.meta.client || downloadingClipKey.value) return;
  const bucketName = clip.bucketName || video.bucketName;
  const storagePath = clip.storagePath || video.storagePath;
  if (!bucketName || !storagePath) {
    errorMessage.value = "元クリップのStorageパスを取得できませんでした";
    return;
  }

  const key = clipKey(video.id, clip.id);
  downloadingClipKey.value = key;
  try {
    const fileRef = storageRefForBucketPath({
      bucketName,
      filePath: storagePath,
    });
    const blob = await getBlob(fileRef);
    const downloadBlob = blob.type ? blob : new Blob([blob], { type: clip.contentType || video.contentType || "video/webm" });
    const url = URL.createObjectURL(downloadBlob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = clipDownloadFileName(clip, storagePath);
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch (error) {
    errorMessage.value =
      error instanceof Error
        ? `元クリップのダウンロードに失敗しました: ${error.message}`
        : "元クリップのダウンロードに失敗しました";
    reportDatadogError(error, {
      feature: "storyvault_download_operation_video_clip",
      videoId: video.id,
      clipId: clip.id,
      bucketName,
      storagePath,
    });
  } finally {
    downloadingClipKey.value = "";
  }
}

function clipDownloadFileName(
  clip: StoryVaultOperationVideoClip,
  storagePath: string
): string {
  const fallbackName = storagePath.split("/").pop() || `clip-${clip.id}.webm`;
  const rawName = clip.fileName?.trim() || fallbackName;
  const match = rawName.match(/^(.*?)(\.[A-Za-z0-9]{1,8})$/);
  if (!match) return `${sanitizeFileStem(rawName || `clip-${clip.id}`)}.webm`;
  const [, stem, extension] = match;
  return `${sanitizeFileStem(stem || `clip-${clip.id}`)}${extension.toLowerCase()}`;
}

function hasVideoAnalysis(video: DecodedStoryVaultClip | null): boolean {
  if (!video) return false;
  return (
    video.transcriptTimingStatus === "timestamped" &&
    video.transcriptSegments.length > 0 &&
    Boolean(video.transcriptSrt?.trim()) &&
    Boolean(video.quickScan || video.transcriptSummary)
  );
}

function displayVideoTitle(video: DecodedStoryVaultClip): string {
  return video.title?.trim() || video.quickScan?.title?.trim() || "無題のクリップグループ";
}

function videoGroupForVideo(video: DecodedStoryVaultClip): {
  id: string;
  name: string;
  description: string;
} {
  const group = props.clipGroups.find(
    (item) => item.id === video.clipGroupId
  );
  return {
    id: group?.id || video.clipGroupId || "",
    name: group?.name || video.clipGroupNameSnapshot || "クリップグループ未設定",
    description: group?.description || "",
  };
}

function videoDisplayId(video: DecodedStoryVaultClip): string {
  const index = props.clipGroups.findIndex((item) => item.id === video.clipGroupId);
  return `Group ${index >= 0 ? index + 1 : 1}`;
}

function startClipTitleEdit(
  clip: Pick<StoryVaultOperationVideoClip, "id"> & Partial<StoryVaultOperationVideoClip>,
  index: number
): void {
  editingVideoTitleId.value = clip.id;
  editingVideoTitleDraft.value = clipTitle(clip as StoryVaultOperationVideoClip, index);
  void nextTick(() => {
    videoTitleInput.value?.focus();
    videoTitleInput.value?.select();
  });
}

function cancelVideoTitleEdit(): void {
  editingVideoTitleId.value = "";
  editingVideoTitleDraft.value = "";
}

function commitClipTitleEdit(
  clip: StoryVaultOperationVideoClip,
  index: number
): void {
  if (editingVideoTitleId.value !== clip.id) return;
  if (updatingVideoTitleId.value === clip.id) return;

  const nextTitle = editingVideoTitleDraft.value.trim();
  const currentTitle = clipTitle(clip, index).trim();
  if (!nextTitle || nextTitle === currentTitle) {
    cancelVideoTitleEdit();
    return;
  }

  updatingVideoTitleId.value = clip.id;
  emit("update-title", clip.id, nextTitle, {
    onSuccess: () => {
      updatingVideoTitleId.value = "";
      cancelVideoTitleEdit();
    },
    onError: (message) => {
      updatingVideoTitleId.value = "";
      errorMessage.value = message;
      void nextTick(() => videoTitleInput.value?.focus());
    },
  });
}

function openVideoDetail(video: DecodedStoryVaultClip): void {
  detailVideoId.value = video.id;
  selectedClipId.value = videoClips(video)[0]?.id ?? "";
  detailTab.value = "video";
}

function openClipDetail(item: GroupClipItem): void {
  detailVideoId.value = item.clip.id;
  selectedClipId.value = item.clip.id;
  detailTab.value = "video";
}

function selectDetailClip(clipId: string): void {
  selectedClipId.value = clipId;
  const clip = props.clipRecords.find((item) => item.id === clipId);
  if (clip) {
    detailVideoId.value = clip.id;
    selectedVideoId.value = clip.id;
  }
}

function selectDetailClipFromPicker(clipId: string): void {
  if (clipId === ALL_CLIPS_SELECTION_ID) {
    selectedClipId.value = ALL_CLIPS_SELECTION_ID;
  } else if (clipId) {
    selectDetailClip(clipId);
  }
  detailClipPickerOpen.value = false;
}

function handleDetailClipPickerDocumentClick(event: MouseEvent): void {
  if (!detailClipPickerOpen.value) return;
  const target = event.target;
  if (!(target instanceof Node)) return;
  if (detailClipPickerRoot.value?.contains(target)) return;
  detailClipPickerOpen.value = false;
}

function openContextMap(video: DecodedStoryVaultClip): void {
  contextMapVideoId.value = video.id;
  resetContextMapView();
  const data = buildContextMapData(video);
  selectedContextMapNodeId.value =
    data.nodes.find((node) => node.kind === "video")?.id ?? data.nodes[0]?.id ?? "";
  contextMapOpen.value = true;
}

function closeContextMap(): void {
  contextMapOpen.value = false;
  stopContextMapNodeDrag();
}

function applyRouteDetailTarget(
  videos: DecodedStoryVaultClip[]
): void {
  const videoId =
    typeof route.query.operationVideoId === "string"
      ? route.query.operationVideoId
      : "";
  if (!videoId) return;
  if (!videos.some((video) => video.id === videoId)) return;
  selectedVideoId.value = videoId;
  detailVideoId.value = videoId;
  detailTab.value = routeDetailTab();
}

function routeDetailTab(): DetailTab {
  const tab = route.query.operationVideoTab;
  if (
    tab === "video" ||
    tab === "videoAnalysis" ||
    tab === "storyAnalysis" ||
    tab === "videoGeneration" ||
    tab === "relatedContext" ||
    tab === "report" ||
    tab === "mcpTest"
  ) {
    return tab;
  }
  return "video";
}

function refreshReportHtmlUrl(): void {
  revokeReportHtmlUrl();
  if (!import.meta.client || typeof URL === "undefined" || typeof Blob === "undefined") return;
  if (!reportHtml.value) return;
  reportHtmlUrl.value = URL.createObjectURL(
    new Blob([reportHtml.value], { type: "text/html;charset=utf-8" })
  );
}

function revokeReportHtmlUrl(): void {
  if (!import.meta.client || typeof URL === "undefined") {
    reportHtmlUrl.value = "";
    return;
  }
  if (!reportHtmlUrl.value) return;
  URL.revokeObjectURL(reportHtmlUrl.value);
  reportHtmlUrl.value = "";
}

type ExcelCellValue = string | number | boolean;
type ExcelRow = Record<string, ExcelCellValue>;

function excelCell(value: unknown): ExcelCellValue {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "boolean") return value;
  if (Array.isArray(value)) return value.map((item) => excelCell(item)).join("\n");
  if (value === null || value === undefined) return "";
  return String(value);
}

function appendExcelSheet(
  workbook: XLSX.WorkBook,
  name: string,
  rows: ExcelRow[],
  linkColumns: string[] = []
): void {
  const data = rows.length ? rows : [{ メモ: "該当データなし" }];
  const sheet = XLSX.utils.json_to_sheet(data);
  const headers = Object.keys(data[0] ?? {});
  sheet["!cols"] = headers.map((header) => ({
    wch: Math.min(Math.max(header.length + 6, 14), 48),
  }));
  for (const linkColumn of linkColumns) {
    const columnIndex = headers.indexOf(linkColumn);
    if (columnIndex < 0) continue;
    data.forEach((row, rowIndex) => {
      const target = String(row[linkColumn] ?? "").trim();
      if (!/^https?:\/\//i.test(target)) return;
      const address = XLSX.utils.encode_cell({ r: rowIndex + 1, c: columnIndex });
      const cell = sheet[address];
      if (!cell) return;
      cell.l = { Target: target, Tooltip: target };
    });
  }
  XLSX.utils.book_append_sheet(workbook, sheet, name.slice(0, 31));
}

function buildOperationVideoReportWorkbook(): XLSX.WorkBook {
  const workbook = XLSX.utils.book_new();
  const video = detailVideo.value;
  if (!video) {
    appendExcelSheet(workbook, "サマリー", [{ メモ: "クリップが選択されていません" }]);
    return workbook;
  }
  const stories = video.analysisResult?.storyCandidates ?? [];
  const videoGroup = videoGroupForVideo(video);
  const videoUrl = videoUrls[video.id] || "";
  appendExcelSheet(
    workbook,
    "サマリー",
    [
      { 項目: "Application", 値: excelCell(props.application?.name || video.applicationKey), リンク: "" },
      { 項目: "Application ID", 値: excelCell(props.application?.id || video.applicationId), リンク: "" },
      { 項目: "クリップグループ", 値: excelCell(videoGroup.name), リンク: "" },
      { 項目: "クリップグループID", 値: excelCell(videoGroup.id), リンク: "" },
      { 項目: "クリップID", 値: excelCell(video.id), リンク: "" },
      { 項目: "タイトル", 値: excelCell(displayVideoTitle(video)), リンク: "" },
      { 項目: "説明", 値: excelCell(displayVideoDescription(video)), リンク: "" },
      { 項目: "録画日時", 値: excelCell(video.recordedAt), リンク: "" },
      { 項目: "時間", 値: excelCell(formatDuration(video.durationMs)), リンク: "" },
      { 項目: "動画URL", 値: excelCell(videoUrl), リンク: excelCell(videoUrl) },
      { 項目: "Storage path", 値: excelCell(video.storagePath), リンク: "" },
      { 項目: "ユーザーストーリー候補", 値: stories.length, リンク: "" },
      { 項目: "証跡", 値: stories.reduce((sum, story) => sum + story.evidence.length, 0), リンク: "" },
      { 項目: "スクリーンショット", 値: video.frameCaptures.length, リンク: "" },
      { 項目: "GitHub PR", 値: relatedGithubPullRequestCount(video), リンク: "" },
      { 項目: "Slack", 値: relatedSlackMessageCount(video), リンク: "" },
      { 項目: "Knowledge", 値: relatedKnowledgeDocumentCount(video), リンク: "" },
      { 項目: "Jira", 値: relatedJiraIssueCount(video), リンク: "" },
    ],
    ["リンク"]
  );
  appendExcelSheet(
    workbook,
    "ユーザーストーリー一覧",
    stories.map((story, index) => ({
      No: index + 1,
      StoryID: excelCell(story.id),
      タイトル: excelCell(story.title),
      ユーザーストーリー: excelCell(story.userStory),
      役割: excelCell(story.role?.value),
      ゴール: excelCell(story.goal),
      価値: excelCell(story.benefit),
      信頼度: excelCell(story.confidence ?? story.confidenceScore),
      詳細仕様: excelCell(story.detailedSpecifications),
      受け入れ条件: excelCell(story.acceptanceCriteria),
      証跡数: story.evidence.length,
      代表スクリーンショット: excelCell(story.evidence[0]?.representativeScreenshotId),
      関連クリップID: excelCell(video.id),
      動画URL: excelCell(videoUrl),
      備考: excelCell(story.summary),
    })),
    ["動画URL"]
  );
  appendExcelSheet(
    workbook,
    "証跡リンク",
    stories.flatMap((story) =>
      story.evidence.map((item) => {
        const screenshotUrl =
          item.videoId === video.id && item.representativeScreenshotId
            ? savedFrameUrl(video, item.representativeScreenshotId)
            : "";
        return {
          StoryID: excelCell(story.id),
          StoryTitle: excelCell(story.title),
          EvidenceTitle: excelCell(item.title),
          Summary: excelCell(item.summary),
          ClipID: excelCell(item.videoId),
          TimeRange: excelCell(item.tRange.join(" - ")),
          TranscriptQuote: excelCell(item.transcriptQuote),
          RepresentativeScreenshotID: excelCell(item.representativeScreenshotId),
          ScreenshotIDs: excelCell(item.screenshotIds),
          動画URL: excelCell(item.videoId === video.id ? videoUrl : ""),
          ScreenshotURL: excelCell(screenshotUrl),
        };
      })
    ),
    ["動画URL", "ScreenshotURL"]
  );
  appendExcelSheet(
    workbook,
    "スクリーンショット",
    video.frameCaptures.map((frame) => ({
      FrameID: excelCell(frame.id),
      Timestamp: excelCell(formatDuration(frame.timestampMs)),
      TimestampMs: excelCell(frame.timestampMs),
      URL: excelCell(savedFrameUrl(video, frame.id)),
      StoragePath: excelCell(frame.storagePath),
      Width: excelCell(frame.width),
      Height: excelCell(frame.height),
    })),
    ["URL"]
  );
  appendExcelSheet(
    workbook,
    "GitHub PR",
    relatedGithubPullRequests(video).map((pr) => ({
      Repository: excelCell(relatedGithubRepoFullName(video)),
      Number: excelCell(pr.number),
      Title: excelCell(pr.title),
      URL: excelCell(pr.htmlUrl),
      Author: excelCell(pr.author),
      State: excelCell(pr.state),
      MergedAt: excelCell(pr.mergedAt),
      UpdatedAt: excelCell(pr.updatedAt),
      Labels: excelCell(pr.labels),
      ChangedFiles: excelCell(pr.changedFiles),
      Additions: excelCell(pr.additions),
      Deletions: excelCell(pr.deletions),
      Relevance: excelCell(pr.relevanceScore),
      Reason: excelCell(pr.reason),
      MatchedSignals: excelCell(pr.matchedSignals),
    })),
    ["URL"]
  );
  appendExcelSheet(
    workbook,
    "Slack",
    relatedSlackMessages(video).map((message) => ({
      Team: excelCell(relatedSlackTeamLabel(video)),
      Channel: excelCell(message.channelName || message.channelId),
      Author: excelCell(message.author),
      PostedAt: excelCell(message.postedAt),
      MessageTs: excelCell(message.messageTs),
      ThreadTs: excelCell(message.threadTs),
      Text: excelCell(message.text),
      Permalink: excelCell(message.permalink),
      Relevance: excelCell(message.relevanceScore),
      Reason: excelCell(message.reason),
      MatchedSignals: excelCell(message.matchedSignals),
    })),
    ["Permalink"]
  );
  appendExcelSheet(
    workbook,
    "Knowledge",
    relatedKnowledgeDocuments(video).map((doc) => ({
      DocumentID: excelCell(doc.documentId),
      Name: excelCell(doc.displayName || doc.name),
      SourceKind: excelCell(doc.sourceKind),
      MimeType: excelCell(doc.mimeType),
      Description: excelCell(doc.description),
      DownloadURL: excelCell(doc.downloadUrl),
      GCSURL: excelCell(doc.gcsUrl),
      BucketName: excelCell(doc.bucketName),
      FilePath: excelCell(doc.filePath),
      Relevance: excelCell(doc.relevanceScore),
      Reason: excelCell(doc.reason),
      MatchedSignals: excelCell(doc.matchedSignals),
    })),
    ["DownloadURL"]
  );
  appendExcelSheet(
    workbook,
    "Jira",
    relatedJiraIssues(video).map((issue) => ({
      Site: excelCell(relatedJiraSiteLabel(video)),
      Key: excelCell(issue.key),
      Summary: excelCell(issue.summary),
      URL: excelCell(issue.htmlUrl),
      Project: excelCell(issue.project.name),
      Type: excelCell(issue.issueType.name),
      Status: excelCell(issue.status.name),
      Priority: excelCell(issue.priority.name),
      Assignee: excelCell(issue.assignee.name),
      Labels: excelCell(issue.labels),
      UpdatedAt: excelCell(issue.updatedAt),
      Relevance: excelCell(issue.relevanceScore),
      Reason: excelCell(issue.reason),
      MatchedSignals: excelCell(issue.matchedSignals),
    })),
    ["URL"]
  );
  return workbook;
}

function openReportPreview(): void {
  if (!import.meta.client || typeof URL === "undefined" || typeof Blob === "undefined") return;
  if (reportMode.value === "excel") {
    downloadReport();
    return;
  }
  if (reportMode.value === "html" && reportHtmlUrl.value) {
    window.open(reportHtmlUrl.value, "_blank", "noopener,noreferrer");
    return;
  }
  const url = URL.createObjectURL(
    new Blob([reportBody.value], { type: reportMimeType.value })
  );
  window.open(url, "_blank", "noopener,noreferrer");
  window.setTimeout(() => URL.revokeObjectURL(url), 5000);
}

async function copyReportBody(): Promise<void> {
  if (!import.meta.client || typeof navigator === "undefined") return;
  const body = reportBody.value;
  if (!body) return;
  try {
    await navigator.clipboard.writeText(body);
    reportCopied.value = true;
    window.setTimeout(() => {
      reportCopied.value = false;
    }, 1800);
  } catch (err) {
    errorMessage.value =
      err instanceof Error ? `本文のコピーに失敗しました: ${err.message}` : "本文のコピーに失敗しました";
  }
}

function downloadReport(): void {
  if (!import.meta.client || typeof URL === "undefined" || typeof Blob === "undefined") return;
  const blob =
    reportMode.value === "excel"
      ? new Blob(
          [
            XLSX.write(buildOperationVideoReportWorkbook(), {
              bookType: "xlsx",
              type: "array",
            }) as ArrayBuffer,
          ],
          { type: reportMimeType.value }
        )
      : new Blob([reportBody.value], { type: reportMimeType.value });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${reportFileStem.value}-operation-video-bundle.${reportExtension.value}`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function sanitizeFileStem(value: string): string {
  return (
    value
      .trim()
      .replace(/[^\w.-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 120) || "operation-video-report"
  );
}

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function buildFallbackRecordingTitle(): string {
  const appName = props.application?.name?.trim() || "ザッピング";
  const recordedAt = new Date();
  const month = String(recordedAt.getMonth() + 1).padStart(2, "0");
  const day = String(recordedAt.getDate()).padStart(2, "0");
  const hours = String(recordedAt.getHours()).padStart(2, "0");
  const minutes = String(recordedAt.getMinutes()).padStart(2, "0");
  return `${appName} ザッピング ${month}/${day} ${hours}:${minutes}`;
}

function displayVideoDescription(
  video: DecodedStoryVaultClip
): string {
  return video.quickScan?.description?.trim() || video.description || "";
}

function displayClipDescription(item: GroupClipItem): string {
  return clipSummaryText(item.clip);
}

function hasQuickScanSummary(
  video: DecodedStoryVaultClip
): boolean {
  return Boolean(
    video.quickScan?.title ||
      video.quickScan?.description ||
      video.quickScan?.operationMemo ||
      video.quickScan?.operationSteps?.length ||
      video.transcriptText ||
      video.transcriptSegments?.length ||
      video.transcriptSrt ||
      video.transcriptSummary ||
      video.quickScan?.transcriptSummary ||
      video.quickScan?.errorMessage
  );
}

function openQuickScanPreview(video: DecodedStoryVaultClip): void {
  quickScanPreviewVideoId.value = video.id;
}

function quickScanProviderLabel(video: DecodedStoryVaultClip): string {
  return (
    video.quickScan?.provider?.trim() ||
    video.transcriptProvider?.trim() ||
    "scan"
  );
}

function transcriptSummaryText(video: DecodedStoryVaultClip): string {
  return (
    video.transcriptSummary?.trim() ||
    video.quickScan?.transcriptSummary?.trim() ||
    ""
  );
}

function selectedClipSummaryMarkdown(
  clip: StoryVaultOperationVideoClip,
  video: DecodedStoryVaultClip
): string {
  return clipSummaryText(clip, video) || "未生成";
}

function clipSummaryText(
  clip: StoryVaultOperationVideoClip,
  fallbackVideo?: DecodedStoryVaultClip
): string {
  return (
    clip.transcriptSummary?.trim() ||
    clip.quickScan?.transcriptSummary?.trim() ||
    clip.quickScan?.description?.trim() ||
    clip.quickScan?.operationMemo?.trim() ||
    fallbackVideo?.transcriptSummary?.trim() ||
    fallbackVideo?.quickScan?.transcriptSummary?.trim() ||
    fallbackVideo?.quickScan?.description?.trim() ||
    fallbackVideo?.quickScan?.operationMemo?.trim() ||
    compactPreviewText(clip.transcriptText || fallbackVideo?.transcriptText || "", 420)
  );
}

function transcriptCueRows(owner: TranscriptOwner): StoryVaultTranscriptCue[] {
  const fromSegments = normalizeTranscriptCues(owner.transcriptSegments ?? []);
  const cues = fromSegments.length > 0
    ? fromSegments
    : parseSrtTranscript(owner.transcriptSrt);
  return cues as StoryVaultTranscriptCue[];
}

function hasTranscriptContent(owner: TranscriptOwner): boolean {
  return transcriptCueRows(owner).length > 0;
}

function transcriptProviderBadge(owner: TranscriptOwner): string {
  const timing = owner.transcriptTimingStatus === "timestamped" ? "SRT" : "";
  return [owner.transcriptProvider?.trim() || "transcript", timing]
    .filter(Boolean)
    .join(" / ");
}

function formatTranscriptCueTime(ms: number): string {
  return formatTranscriptTime(ms);
}

function activeTranscriptCueId(
  cues: StoryVaultTranscriptCue[],
  playbackMs: number
): string {
  if (cues.length === 0) return "";
  const normalizedPlaybackMs = Math.max(0, playbackMs);
  const containingCue = cues.find((cue) => {
    const endMs = Math.max(cue.endMs, cue.startMs + 500);
    return normalizedPlaybackMs >= cue.startMs && normalizedPlaybackMs < endMs;
  });
  if (containingCue) return containingCue.id;
  const firstCue = cues[0];
  if (!firstCue || normalizedPlaybackMs < firstCue.startMs) return "";

  const previousCue = [...cues]
    .reverse()
    .find((cue) => cue.startMs <= normalizedPlaybackMs);
  return previousCue?.id ?? "";
}

function updateSelectedClipPlaybackTime(event?: Event): void {
  const video = event?.currentTarget instanceof HTMLVideoElement
    ? event.currentTarget
    : selectedClipVideo.value;
  if (!video) return;
  selectedClipPlaybackMs.value = Math.max(0, video.currentTime * 1000);
}

function handleSelectedClipVideoLoadedMetadata(event?: Event): void {
  updateSelectedClipPlaybackTime(event);
  applySelectedClipPlaybackRate();
}

function applySelectedClipPlaybackRate(): void {
  const video = selectedClipVideo.value;
  if (!video) return;
  video.playbackRate = selectedClipPlaybackRate.value;
}

function setSelectedClipPlaybackRate(
  rate: (typeof selectedClipPlaybackRates)[number]["value"]
): void {
  selectedClipPlaybackRate.value = rate;
  applySelectedClipPlaybackRate();
}

function setSelectedClipTranscriptCueElement(
  cueId: string,
  element: Element | ComponentPublicInstance | null
): void {
  if (!element) {
    selectedClipTranscriptCueElements.delete(cueId);
    return;
  }
  const htmlElement = "$el" in element ? element.$el : element;
  if (htmlElement instanceof HTMLElement) {
    selectedClipTranscriptCueElements.set(cueId, htmlElement);
  }
}

function seekSelectedClipTo(startMs: number): void {
  const video = selectedClipVideo.value;
  if (!video) return;
  video.currentTime = Math.max(0, startMs / 1000);
  selectedClipPlaybackMs.value = Math.max(0, startMs);
  void video.play().catch(() => undefined);
}

function richTranscriptSummarySections(
  video: DecodedStoryVaultClip
): RichTranscriptSummarySection[] {
  const text = transcriptSummaryText(video);
  if (!text) return [];

  const normalized = text
    .replace(/\r\n/g, "\n")
    .replace(/^#{1,6}\s+.+$/gm, "")
    .trim();
  const sections: RichTranscriptSummarySection[] = [];
  const labelRegex =
    /\*\*([^*\n：:]{1,32})[：:]\*\*\s*([\s\S]*?)(?=\n?\s*\*\*[^*\n：:]{1,32}[：:]\*\*|$)/g;

  for (const match of normalized.matchAll(labelRegex)) {
    const title = stripTranscriptSummaryMarkdown(match[1] ?? "");
    const body = stripTranscriptSummaryMarkdown(match[2] ?? "");
    if (title && body) sections.push({ title, body });
  }

  if (sections.length > 0) return sections;

  return normalized
    .split(/\n{2,}/)
    .map((paragraph) => stripTranscriptSummaryMarkdown(paragraph))
    .filter(Boolean)
    .slice(0, 6)
    .map((body, index) => ({
      title: index === 0 ? "要約" : `補足 ${index + 1}`,
      body,
    }));
}

function stripTranscriptSummaryMarkdown(value: string): string {
  return value
    .replace(/\*\*/g, "")
    .replace(/^[-・*]\s+/gm, "")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function operationSteps(video: DecodedStoryVaultClip): string[] {
  if (video.quickScan?.operationSteps?.length) {
    return video.quickScan.operationSteps.map((step) => step.trim()).filter(Boolean);
  }
  return (video.quickScan?.operationMemo ?? "")
    .split(/\r?\n/)
    .map((line) => line.replace(/^\s*(?:[-・*]|\d+[.)、])\s*/, "").trim())
    .filter(Boolean);
}

function deleteConfirmedVideo(): void {
  const videoId = deleteTargetVideoId.value;
  if (!videoId) return;
  deleteVideoConfirmOpen.value = false;
  deleteTargetVideoId.value = "";
  emit("delete", videoId);
}

function deleteConfirmedClip(): void {
  const target = deleteTargetClip.value;
  if (!target) return;
  deleteClipConfirmOpen.value = false;
  deleteTargetClipVideoId.value = "";
  deleteTargetClipId.value = "";
  emit("delete", target.clip.id);
}

function openRelatedContextTab(): void {
  detailTab.value = "relatedContext";
  relatedContextProviderTab.value = "knowledge";
}

async function ensureJiraConnections(): Promise<void> {
  jiraSearchError.value = "";
  try {
    await jiraOAuth.refreshConnections();
    if (
      !jiraConnections.value.some(
        (connection) => connection.cloudId === jiraSelectedCloudId.value
      )
    ) {
      jiraSelectedCloudId.value = jiraConnections.value[0]?.cloudId || "";
    }
    await loadStoryVaultJiraIssues();
  } catch (error) {
    jiraSearchError.value =
      error instanceof Error ? error.message : "Jira接続状態の取得に失敗しました";
  }
}

async function loadStoryVaultJiraIssues(): Promise<void> {
  const cloudId = jiraSelectedCloudId.value || jiraConnections.value[0]?.cloudId || "";
  if (!cloudId) return;
  jiraSelectedCloudId.value = cloudId;
  isJiraSearching.value = true;
  jiraSearchError.value = "";
  try {
    jiraSearchResults.value = await jiraOAuth.listIssues({
      cloudId,
      jql: 'project = "STOR" ORDER BY updated DESC',
      limit: 50,
    });
    jiraListMode.value = "project";
    selectedJiraIssueKeys.value = [];
  } catch (error) {
    jiraSearchResults.value = [];
    jiraSearchError.value =
      error instanceof Error ? error.message : "StoryVaultのIssue一覧取得に失敗しました";
  } finally {
    isJiraSearching.value = false;
  }
}

async function searchJiraIssues(): Promise<void> {
  if (jiraConnections.value.length === 0) {
    await ensureJiraConnections();
  }
  const cloudId = jiraSelectedCloudId.value || jiraConnections.value[0]?.cloudId || "";
  if (!cloudId) {
    jiraSearchError.value = "Jira Cloud siteを先に接続してください";
    return;
  }
  jiraSelectedCloudId.value = cloudId;
  isJiraSearching.value = true;
  jiraSearchError.value = "";
  try {
    jiraSearchResults.value = await jiraOAuth.listIssues({
      cloudId,
      query: jiraSearchQuery.value,
      limit: 30,
    });
    jiraListMode.value = "search";
    selectedJiraIssueKeys.value = [];
  } catch (error) {
    jiraSearchResults.value = [];
    jiraSearchError.value =
      error instanceof Error ? error.message : "Jira Issueの検索に失敗しました";
  } finally {
    isJiraSearching.value = false;
  }
}

function jiraIssueSelectionKey(issue: JiraIssuePreview): string {
  return `${issue.cloudId}:${issue.key}`;
}

function isJiraIssueSelected(issue: JiraIssuePreview): boolean {
  return selectedJiraIssueKeys.value.includes(jiraIssueSelectionKey(issue));
}

function jiraIssueToContextIssue(issue: JiraIssuePreview): StoryVaultRelatedContextJiraIssue {
  return {
    ...issue,
    relevanceScore: 100,
    reason: "ユーザーが検索結果から手動でクリップに紐付けました",
    matchedSignals: ["手動紐付け"],
  };
}

function linkSelectedJiraIssues(): void {
  const selected = jiraSearchResults.value
    .filter((issue) => selectedJiraIssueKeys.value.includes(jiraIssueSelectionKey(issue)))
    .map(jiraIssueToContextIssue);
  if (selected.length === 0) return;
  emit(
    "link-jira-issues",
    detailVideoId.value,
    selected,
    selectedJiraConnection.value
      ? {
          name: selectedJiraConnection.value.siteName,
          url: selectedJiraConnection.value.siteUrl,
        }
      : undefined
  );
  selectedJiraIssueKeys.value = [];
}

function unlinkJiraIssue(issue: StoryVaultRelatedContextJiraIssue): void {
  emit("unlink-jira-issue", detailVideoId.value, issue.key, issue.cloudId);
}

function knowledgeDocumentSelectionKey(document: Document): string {
  return document.id || document.name || "";
}

async function loadKnowledgeDocumentsForManualLink(): Promise<void> {
  const fileSpaceId = props.application?.fileSpaceId;
  if (!fileSpaceId) return;
  isKnowledgeManualLoading.value = true;
  knowledgeManualError.value = "";
  try {
    await knowledgeFileSpaceStore.fetchDocumentsFromFirestore(fileSpaceId);
    selectedKnowledgeDocumentIds.value = [];
  } catch (error) {
    knowledgeManualError.value =
      error instanceof Error ? error.message : "ナレッジ一覧の取得に失敗しました";
  } finally {
    isKnowledgeManualLoading.value = false;
  }
}

function knowledgeDocumentToRelatedContext(
  document: Document
): StoryVaultRelatedContextKnowledgeDocument {
  return {
    documentId: knowledgeDocumentSelectionKey(document),
    name: document.name ?? undefined,
    displayName: document.displayName,
    description: document.description,
    mimeType: document.mimeType,
    sourceKind: document.sourceKind,
    gcsUrl: document.gcsUrl,
    bucketName: document.bucketName,
    filePath: document.filePath,
    relevanceScore: 100,
    reason: "ユーザーがナレッジ一覧から手動でクリップに紐付けました",
    matchedSignals: ["手動紐付け"],
    downloadUrl: document.driveWebViewLink ?? document.entryUrl ?? document.url,
  };
}

function linkSelectedKnowledgeDocuments(): void {
  const fileSpaceId = props.application?.fileSpaceId;
  if (!fileSpaceId) return;
  const documents = (knowledgeFileSpaceStore.documents ?? [])
    .filter((document) => selectedKnowledgeDocumentIds.value.includes(knowledgeDocumentSelectionKey(document)))
    .map(knowledgeDocumentToRelatedContext);
  if (!documents.length) return;
  emit("link-knowledge-documents", detailVideoId.value, fileSpaceId, documents);
  selectedKnowledgeDocumentIds.value = [];
}

function navigateToJiraSettings(): void {
  void navigateTo("/admin/preferences?tab=oauth-connections");
}

function analysisResultCount(video: DecodedStoryVaultClip): string {
  const stories = video.analysisResult?.storyCandidates.length ?? 0;
  return `${stories} stories`;
}

function analysisStoryTicketKey(
  story: StoryVaultZappingAnalysisStoryCandidate
): string {
  if (story.storyKey?.trim()) return story.storyKey.trim();
  const index = detailStories.value.findIndex((item) => item.id === story.id);
  return formatUserStoryKey(index + 1);
}

function storyCandidateCount(video: DecodedStoryVaultClip): number {
  if (
    detailVideo.value?.clipGroupId === video.clipGroupId &&
    isAllClipsSelected.value
  ) {
    return props.clipRecords
      .filter((item) => item.clipGroupId === video.clipGroupId)
      .reduce((sum, item) => sum + (item.analysisResult?.storyCandidates.length ?? 0), 0);
  }
  if (
    detailVideo.value?.clipGroupId === video.clipGroupId &&
    selectedDetailClip.value
  ) {
    return selectedDetailClip.value.id === video.id
      ? video.analysisResult?.storyCandidates.length ?? 0
      : props.clipRecords.find((item) => item.id === selectedDetailClip.value?.id)
        ?.analysisResult?.storyCandidates.length ?? 0;
  }
  return video.analysisResult?.storyCandidates.length ?? 0;
}

function isVideoAnalysisCompleted(video: DecodedStoryVaultClip): boolean {
  const clips = props.clipRecords.filter((item) => item.clipGroupId === video.clipGroupId);
  const targets = clips.length ? clips : [video];
  return targets.some(
    (item) => item.analysisStatus === "completed" || Boolean(item.analysisResult)
  );
}

function videoAnalysisTabStatus(video: DecodedStoryVaultClip): string {
  const clips = props.clipRecords.filter((item) => item.clipGroupId === video.clipGroupId);
  if (clips.some((item) => item.analysisStatus === "running")) return "実行中";
  if (clips.some((item) => item.analysisStatus === "queued")) return "待機";
  if (clips.some((item) => item.analysisStatus === "error")) return "失敗";
  if (isVideoAnalysisCompleted(video)) return "完了";
  return "未解析";
}

function relatedContextGroupClips(
  video: DecodedStoryVaultClip
): DecodedStoryVaultClip[] {
  if (!video.clipGroupId) return [video];
  return props.clipRecords.filter(
    (item) => item.clipGroupId === video.clipGroupId
  );
}

function relatedGithubPullRequests(video: DecodedStoryVaultClip) {
  const seen = new Set<string>();
  return relatedContextGroupClips(video)
    .flatMap((item) => item.relatedContexts?.github?.pullRequests ?? [])
    .filter((pullRequest) => {
      const key = pullRequest.htmlUrl || String(pullRequest.number);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function relatedSlackMessages(video: DecodedStoryVaultClip) {
  const seen = new Set<string>();
  return relatedContextGroupClips(video)
    .flatMap((item) => item.relatedContexts?.slack?.messages ?? [])
    .filter((message) => {
      const key = message.permalink || `${message.channelId || ""}:${message.messageTs}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function relatedKnowledgeDocuments(video: DecodedStoryVaultClip) {
  const seen = new Set<string>();
  return relatedContextGroupClips(video)
    .flatMap((item) => item.relatedContexts?.knowledge?.documents ?? [])
    .filter((document) => {
      const key =
        document.documentId ||
        document.gcsUrl ||
        document.downloadUrl ||
        document.displayName ||
        document.name ||
        "knowledge";
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function relatedJiraIssues(video: DecodedStoryVaultClip) {
  const seen = new Set<string>();
  return relatedContextGroupClips(video)
    .flatMap((item) => item.relatedContexts?.jira?.issues ?? [])
    .filter((issue) => {
      const key = `${issue.cloudId}:${issue.key}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function hasRelatedGithubContext(video: DecodedStoryVaultClip): boolean {
  return relatedContextGroupClips(video).some(
    (item) => Boolean(item.relatedContexts?.github)
  );
}

function hasRelatedSlackContext(video: DecodedStoryVaultClip): boolean {
  return relatedContextGroupClips(video).some(
    (item) => Boolean(item.relatedContexts?.slack)
  );
}

function hasRelatedKnowledgeContext(video: DecodedStoryVaultClip): boolean {
  return relatedContextGroupClips(video).some(
    (item) => Boolean(item.relatedContexts?.knowledge)
  );
}

function hasRelatedJiraContext(video: DecodedStoryVaultClip): boolean {
  return relatedContextGroupClips(video).some(
    (item) => Boolean(item.relatedContexts?.jira)
  );
}

function relatedGithubRepoFullName(video: DecodedStoryVaultClip): string {
  return (
    relatedContextGroupClips(video).find(
      (item) => item.relatedContexts?.github?.repoFullName
    )?.relatedContexts?.github?.repoFullName ?? ""
  );
}

function relatedSlackTeamLabel(video: DecodedStoryVaultClip): string {
  const context = relatedContextGroupClips(video).find(
    (item) => item.relatedContexts?.slack
  )?.relatedContexts?.slack;
  return context?.teamName || context?.teamId || "Slack";
}

function relatedKnowledgeFileSpaceId(video: DecodedStoryVaultClip): string {
  return (
    relatedContextGroupClips(video).find(
      (item) => item.relatedContexts?.knowledge?.fileSpaceId
    )?.relatedContexts?.knowledge?.fileSpaceId ?? ""
  );
}

function relatedJiraSiteLabel(video: DecodedStoryVaultClip): string {
  const context = relatedContextGroupClips(video).find(
    (item) => item.relatedContexts?.jira
  )?.relatedContexts?.jira;
  return context?.siteName || context?.siteUrl || context?.cloudId || "Jira Cloud";
}

function relatedGithubCheckedAt(video: DecodedStoryVaultClip): string {
  return relatedContextGroupClips(video).reduce((latest, item) => {
    const checkedAt = item.relatedContexts?.github?.checkedAt ?? "";
    return checkedAt > latest ? checkedAt : latest;
  }, "");
}

function relatedSlackCheckedAt(video: DecodedStoryVaultClip): string {
  return relatedContextGroupClips(video).reduce((latest, item) => {
    const checkedAt = item.relatedContexts?.slack?.checkedAt ?? "";
    return checkedAt > latest ? checkedAt : latest;
  }, "");
}

function relatedKnowledgeCheckedAt(video: DecodedStoryVaultClip): string {
  return relatedContextGroupClips(video).reduce((latest, item) => {
    const checkedAt = item.relatedContexts?.knowledge?.checkedAt ?? "";
    return checkedAt > latest ? checkedAt : latest;
  }, "");
}

function relatedJiraCheckedAt(video: DecodedStoryVaultClip): string {
  return relatedContextGroupClips(video).reduce((latest, item) => {
    const checkedAt = item.relatedContexts?.jira?.checkedAt ?? "";
    return checkedAt > latest ? checkedAt : latest;
  }, "");
}

function relatedGithubPullRequestCount(
  video: DecodedStoryVaultClip
): number {
  return relatedGithubPullRequests(video).length;
}

function relatedSlackMessageCount(
  video: DecodedStoryVaultClip
): number {
  return relatedSlackMessages(video).length;
}

function relatedKnowledgeDocumentCount(
  video: DecodedStoryVaultClip
): number {
  return relatedKnowledgeDocuments(video).length;
}

function relatedJiraIssueCount(video: DecodedStoryVaultClip): number {
  return relatedJiraIssues(video).length;
}

function relatedContextCount(video: DecodedStoryVaultClip): number {
  return (
    relatedGithubPullRequestCount(video) +
    relatedSlackMessageCount(video) +
    relatedKnowledgeDocumentCount(video) +
    relatedJiraIssueCount(video)
  );
}

function clipCardContextProviders(
  video: DecodedStoryVaultClip
): ClipCardContextProvider[] {
  return [
    {
      id: "knowledge",
      label: "Vault Knowledge",
      icon: "material-symbols:folder-managed-outline",
      count: relatedKnowledgeDocumentCount(video),
      activeClass: "bg-violet-50 text-violet-700 ring-violet-200",
    },
    {
      id: "github",
      label: "GitHub",
      icon: "i-simple-icons-github",
      count: relatedGithubPullRequestCount(video),
      activeClass: "bg-slate-950 text-white ring-slate-950",
    },
    {
      id: "slack",
      label: "Slack",
      icon: "i-simple-icons-slack",
      count: relatedSlackMessageCount(video),
      activeClass: "bg-fuchsia-50 text-fuchsia-700 ring-fuchsia-200",
    },
    {
      id: "jira",
      label: "Jira",
      icon: "i-simple-icons-jira",
      count: relatedJiraIssueCount(video),
      activeClass: "bg-blue-50 text-blue-700 ring-blue-200",
    },
  ];
}

function applyContextMapNodePositions(data: ContextMapData): ContextMapData {
  return {
    edges: data.edges,
    nodes: data.nodes.map((node) => {
      const position = contextMapNodePositions[node.id];
      return position ? { ...node, x: position.x, y: position.y } : node;
    }),
  };
}

function selectContextMapNode(node: ContextMapNode): void {
  if (contextMapDragState.value?.moved) return;
  selectedContextMapNodeId.value = node.id;
}

function clearContextMapSelection(): void {
  if (contextMapDragState.value?.moved) return;
  selectedContextMapNodeId.value = "";
}

function contextMapNodeIsActive(node: ContextMapNode): boolean {
  return activeContextMapNodeIds.value.size === 0 || activeContextMapNodeIds.value.has(node.id);
}

function contextMapEdgeIsActive(edge: ContextMapEdge): boolean {
  return activeContextMapEdgeIds.value.size === 0 || activeContextMapEdgeIds.value.has(edge.id);
}

function zoomContextMap(delta: number): void {
  contextMapZoom.value = Math.min(1.8, Math.max(0.72, Number((contextMapZoom.value + delta).toFixed(2))));
}

function handleContextMapWheel(event: WheelEvent): void {
  if (!event.metaKey && !event.ctrlKey) return;
  event.preventDefault();
  zoomContextMap(event.deltaY > 0 ? -0.08 : 0.08);
}

function resetContextMapView(): void {
  contextMapZoom.value = 1;
  for (const key of Object.keys(contextMapNodePositions)) {
    delete contextMapNodePositions[key];
  }
}

function startContextMapNodeDrag(
  event: PointerEvent,
  node: ContextMapNode
): void {
  selectedContextMapNodeId.value = node.id;
  contextMapDragState.value = { nodeId: node.id, moved: false };
  window.addEventListener("pointermove", handleContextMapNodeDrag);
  window.addEventListener("pointerup", stopContextMapNodeDrag, { once: true });
}

function handleContextMapNodeDrag(event: PointerEvent): void {
  const nodeId = contextMapDragState.value?.nodeId;
  if (!nodeId) return;
  const dragState = contextMapDragState.value;
  if (!dragState) return;
  dragState.moved = true;
  moveContextMapNode(event, nodeId);
}

function stopContextMapNodeDrag(): void {
  window.removeEventListener("pointermove", handleContextMapNodeDrag);
  contextMapDragState.value = null;
}

function moveContextMapNode(event: PointerEvent, nodeId: string): void {
  const surface = contextMapGraphSurface.value;
  if (!surface) return;
  const rect = surface.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return;
  const visibleX = ((event.clientX - rect.left) / rect.width) * 100;
  const visibleY = ((event.clientY - rect.top) / rect.height) * 100;
  const zoom = contextMapZoom.value || 1;
  const x = 50 + (visibleX - 50) / zoom;
  const y = 50 + (visibleY - 50) / zoom;
  contextMapNodePositions[nodeId] = {
    x: Math.min(94, Math.max(6, x)),
    y: Math.min(92, Math.max(10, y)),
  };
}

function buildContextMapData(
  video: DecodedStoryVaultClip
): ContextMapData {
  const nodes: ContextMapNode[] = [];
  const edges: ContextMapEdge[] = [];
  const transcriptCues = transcriptCueRows(video);
  const stories = video.analysisResult?.storyCandidates ?? [];
  const quickScanSteps = operationSteps(video);
  const videoGroup = videoGroupForVideo(video);
  const addEdge = (
    from: string,
    to: string,
    tone: ContextMapNode["tone"] = "cyan"
  ): void => {
    edges.push({ id: `${from}:${to}`, from, to, tone });
  };

  nodes.push({
    id: "video",
    kind: "video",
    label: videoDisplayId(video),
    title: displayVideoTitle(video),
    subtitle: `${videoGroup.name} / ${videoClipCount(video)}本 / ${formatDuration(videoTotalDurationMs(video))}`,
    value: video.analysisStatus === "completed" ? "解析済み" : videoAnalysisTabStatus(video),
    icon: "material-symbols:play-circle-outline",
    x: 50,
    y: 50,
    tone: "cyan",
    details: [
      displayVideoDescription(video) || video.analysisResult?.operationIntent || "クリップグループの中心ノードです。",
      `録画時間: ${formatDuration(videoTotalDurationMs(video))}`,
      `登録クリップ: ${videoClipCount(video)}本`,
    ],
  });

  nodes.push({
    id: "transcript",
    kind: "transcript",
    label: "文字起こし",
    title: "発話と字幕の根拠",
    subtitle: transcriptCues.length > 0
      ? `${transcriptCues.length}件のタイムスタンプ付き発話`
      : "文字起こしはまだありません",
    value: transcriptCues.length > 0 ? `${transcriptCues.length} cues` : "未生成",
    icon: "material-symbols:subtitles-outline",
    x: 24,
    y: 21,
    tone: "emerald",
    details: contextMapTranscriptDetails(video, transcriptCues),
  });
  addEdge("video", "transcript", "emerald");

  nodes.push({
    id: "screens",
    kind: "screen",
    label: "画面証跡",
    title: "スクリーンショット",
    subtitle: "操作の見た目と変化を時系列で保持",
    value: `${video.frameCaptures.length}枚`,
    icon: "material-symbols:image-outline",
    x: 74,
    y: 20,
    tone: "emerald",
    details: contextMapFrameDetails(video),
  });
  addEdge("video", "screens", "emerald");

  nodes.push({
    id: "analysis",
    kind: "analysis",
    label: "クリップ解析",
    title: contextMapCompactTitle(video.analysisResult?.operationIntent || video.quickScan?.title || "操作意図の整理", 34),
    subtitle: "要点を短く整理",
    value: quickScanSteps.length > 0 ? `${quickScanSteps.length} steps` : "要約",
    icon: "material-symbols:psychology-outline",
    x: 22,
    y: 68,
    tone: "cyan",
    details: [
      video.analysisResult?.productContextSummary ||
        video.quickScan?.operationMemo ||
        video.transcriptSummary ||
        "クリップ解析の結果がここに集約されます。",
      ...quickScanSteps.slice(0, 4).map((step, index) => `${index + 1}. ${step}`),
    ],
  });
  addEdge("video", "analysis", "cyan");
  addEdge("analysis", "transcript", "cyan");
  addEdge("analysis", "screens", "cyan");

  if (stories.length > 0) {
    const storyPositions = [
      [50, 13],
      [83, 42],
      [70, 84],
      [35, 86],
      [15, 43],
      [50, 86],
    ];
    stories.slice(0, 6).forEach((story, index) => {
      const position = storyPositions[index] ?? [50, 50];
      const storyId = `story:${story.id || index}`;
      const evidenceRange = story.evidence[0]?.tRange
        ? formatEvidenceRange(story.evidence[0].tRange)
        : "根拠範囲なし";
      nodes.push({
        id: storyId,
        kind: "story",
        label: contextMapStoryKey(story, index),
        title: story.title || story.userStory || "ユーザーストーリー候補",
        subtitle: story.goal || story.summary || story.benefit || "クリップから抽出された価値仮説",
        value: `${story.confidenceScore ?? story.confidence ?? 0}`,
        icon: "material-symbols:route-outline",
        x: position[0] ?? 0,
        y: position[1] ?? 0,
        tone: "amber",
        details: [
          story.userStory || story.summary || story.goal || "ストーリー本文は未設定です。",
          story.role?.value ? `誰が: ${story.role.value}` : "",
          story.goal ? `何をしたいか: ${story.goal}` : "",
          story.benefit ? `うれしいこと: ${story.benefit}` : "",
          `根拠シーン: ${evidenceRange}`,
          ...story.acceptanceCriteria.slice(0, 3).map((criterion) => `受入条件: ${criterion}`),
        ].filter(Boolean),
      });
      addEdge("analysis", storyId, "amber");
      addEdge(storyId, "transcript", "amber");
      addEdge(storyId, "screens", "amber");
    });
  } else {
    nodes.push({
      id: "story-empty",
      kind: "story",
      label: "Story",
      title: "ストーリー候補は未生成",
      subtitle: "ユーザーストーリー解析を実行するとここに価値仮説が接続されます",
      value: "0件",
      icon: "material-symbols:route-outline",
      x: 50,
      y: 86,
      tone: "amber",
      details: ["このクリップにはまだユーザーストーリー候補が紐づいていません。"],
    });
    addEdge("analysis", "story-empty", "amber");
  }

  if (relatedKnowledgeDocumentCount(video) > 0) {
    nodes.push({
      id: "knowledge",
      kind: "knowledge",
      label: "ナレッジ",
      title: "FileSpaceナレッジ",
      subtitle: "クリップ理解を補強する資料",
      value: `${relatedKnowledgeDocumentCount(video)}件`,
      icon: "material-symbols:folder-managed-outline",
      x: 86,
      y: 66,
      tone: "violet",
      details: relatedKnowledgeDocuments(video)
        .slice(0, 5)
        .map((doc) => `${doc.displayName || doc.documentId || doc.name || "Knowledge"}: ${doc.reason || doc.description || "関連資料"}`),
    });
    addEdge("analysis", "knowledge", "violet");
    addEdge("video", "knowledge", "violet");
  }

  if (relatedGithubPullRequestCount(video) > 0) {
    nodes.push({
      id: "github",
      kind: "github",
      label: "GitHub",
      title: "関連Pull Request",
      subtitle: video.relatedContexts?.github?.repoFullName || "コード変更との接続",
      value: `${relatedGithubPullRequestCount(video)}件`,
      icon: "mdi:github",
      x: 81,
      y: 82,
      tone: "violet",
      details: relatedGithubPullRequests(video)
        .slice(0, 5)
        .map((pr) => `#${pr.number} ${pr.title}`),
    });
    addEdge("analysis", "github", "violet");
    addEdge("video", "github", "violet");
  }

  if (relatedSlackMessageCount(video) > 0) {
    nodes.push({
      id: "slack",
      kind: "slack",
      label: "Slack",
      title: "関連会話",
      subtitle: "意思決定や背景の会話ログ",
      value: `${relatedSlackMessageCount(video)}件`,
      icon: "mdi:slack",
      x: 65,
      y: 90,
      tone: "violet",
      details: (video.relatedContexts?.slack?.messages ?? [])
        .slice(0, 5)
        .map((message) => `${message.channelName || "channel"}: ${message.text || message.reason || "関連メッセージ"}`),
    });
    addEdge("analysis", "slack", "violet");
    addEdge("video", "slack", "violet");
  }

  if (relatedJiraIssueCount(video) > 0) {
    nodes.push({
      id: "jira",
      kind: "jira",
      label: "Jira",
      title: "関連Issue",
      subtitle: relatedJiraSiteLabel(video),
      value: `${relatedJiraIssueCount(video)}件`,
      icon: "i-simple-icons-jira",
      x: 88,
      y: 48,
      tone: "violet",
      details: relatedJiraIssues(video)
        .slice(0, 5)
        .map((issue) => `${issue.key} ${issue.summary}: ${issue.reason || issue.status.name || "関連Issue"}`),
    });
    addEdge("analysis", "jira", "violet");
    addEdge("video", "jira", "violet");
  }

  return { nodes, edges };
}

function contextMapCompactTitle(value: string, maxLength: number): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength)}...`;
}

function contextMapStoryKey(
  story: StoryVaultZappingAnalysisStoryCandidate,
  index: number
): string {
  return story.storyKey?.trim() || formatUserStoryKey(index + 1);
}

function contextMapTranscriptDetails(
  video: DecodedStoryVaultClip,
  cues: StoryVaultTranscriptCue[]
): string[] {
  const summary = transcriptSummaryText(video);
  if (cues.length === 0) {
    return [summary || "タイムスタンプ付き文字起こしはまだ生成されていません。"];
  }
  return [
    summary || "クリップ内の発話をタイムスタンプ付きで保持しています。",
    ...cues.slice(0, 4).map((cue) => `${formatTranscriptCueTime(cue.startMs)} ${cue.text}`),
  ];
}

function contextMapFrameDetails(
  video: DecodedStoryVaultClip
): string[] {
  if (video.frameCaptures.length === 0) {
    return ["スクリーンショットはまだ抽出されていません。"];
  }
  return video.frameCaptures
    .slice(0, 5)
    .map((frame) => `${formatDuration(frame.timestampMs)} の画面キャプチャ`);
}

function contextMapNodeClass(node: ContextMapNode): string {
  if (node.kind === "video") return "border-cyan-200/70 bg-cyan-50/95 text-slate-950";
  if (node.kind === "story") return "border-amber-200/80 bg-amber-50/95 text-slate-950";
  if (node.kind === "knowledge" || node.kind === "github" || node.kind === "slack" || node.kind === "jira") {
    return "border-violet-200/80 bg-violet-50/95 text-slate-950";
  }
  if (node.kind === "transcript" || node.kind === "screen") {
    return "border-emerald-200/80 bg-emerald-50/95 text-slate-950";
  }
  return "border-slate-200/80 bg-white/95 text-slate-950";
}

function contextMapNodeIconClass(node: ContextMapNode): string {
  if (node.kind === "video") return "bg-cyan-500 text-white";
  if (node.kind === "story") return "bg-amber-400 text-slate-950";
  if (node.kind === "knowledge" || node.kind === "github" || node.kind === "slack" || node.kind === "jira") {
    return "bg-violet-500 text-white";
  }
  if (node.kind === "transcript" || node.kind === "screen") {
    return "bg-emerald-500 text-white";
  }
  return "bg-slate-900 text-white";
}

function contextMapEdgeClass(edge: ContextMapEdge): string {
  if (!contextMapEdgeIsActive(edge)) return "text-slate-500/15";
  const tone = edge.tone;
  if (tone === "emerald") return "text-emerald-300/65";
  if (tone === "amber") return "text-amber-300/65";
  if (tone === "rose") return "text-rose-300/65";
  if (tone === "violet") return "text-violet-300/65";
  if (tone === "slate") return "text-slate-300/45";
  return "text-cyan-300/70";
}

function isRelatedContextBusy(video: DecodedStoryVaultClip): boolean {
  return Boolean(
    props.isFetchingRelatedContexts || video.relatedContexts?.status === "running"
  );
}

function isRelatedContextProviderRunning(
  video: DecodedStoryVaultClip,
  provider: RelatedContextProviderTab
): boolean {
  return Boolean(
    video.relatedContexts?.status === "running" &&
      video.relatedContexts.runningProvider === provider
  );
}

function relatedContextErrorTitle(video: DecodedStoryVaultClip): string {
  const message =
    video.relatedContexts?.notes?.[0] ||
    video.relatedContexts?.github?.errorMessage ||
    video.relatedContexts?.slack?.errorMessage ||
    video.relatedContexts?.knowledge?.errorMessage ||
    "";
  if (
    message.includes("Unknown agent mode: storyvault_related_context") ||
    message.includes("ADK invoke HTTP 404")
  ) {
    return "関連コンテキスト用ADKがまだデプロイに反映されていません。unified ADKを再デプロイしてください。";
  }
  return message || "関連コンテキストの取得に失敗しました";
}

function knowledgeDocumentToFileSpaceDocument(
  doc: StoryVaultRelatedContextKnowledgeDocument
): Document {
  return {
    id: doc.documentId || doc.name || "",
    name: doc.name || doc.documentId || "",
    displayName: doc.displayName || doc.documentId || doc.name || "Knowledge",
    description: doc.description || doc.reason || null,
    createTime: null,
    updateTime: null,
    state: "STATE_ACTIVE",
    sizeBytes: null,
    mimeType: doc.mimeType || "application/octet-stream",
    bucketName: doc.bucketName || null,
    filePath: doc.filePath || null,
    status: null,
    subCategory: null,
    originalFileInfo: null,
    gcsUrl: doc.gcsUrl || null,
    sourceKind: doc.sourceKind ?? undefined,
  };
}

function formatEvidenceRange(range: number[]): string {
  const start = range[0] ?? 0;
  const end = range[1] ?? start;
  return `${formatDuration(start * 1000)}-${formatDuration(end * 1000)}`;
}

function videoSegmentUrl(
  video: DecodedStoryVaultClip,
  evidence: ZappingAnalysisEvidence
): string {
  const url = videoUrls[video.id];
  if (!url) return "";
  const start = Math.max(0, evidence.tRange[0] ?? 0);
  const end = Math.max(start, evidence.tRange[1] ?? start);
  if (end <= start) return `${url}#t=${start.toFixed(1)}`;
  return `${url}#t=${start.toFixed(1)},${end.toFixed(1)}`;
}

function storyEvidenceFrames(
  video: DecodedStoryVaultClip,
  evidence: ZappingAnalysisEvidence
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
  return withinRange.length > 0 ? withinRange : nearestFrames(video, startMs, 4);
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

type GeminiTranscriptionResult = {
  text: string;
  provider: string;
  segments: StoryVaultTranscriptCue[];
  srt: string;
  timingStatus: StoryVaultTranscriptTimingStatus;
  errorMessage?: string;
};

async function transcribeRecordingWithGemini(
  blob: Blob | null,
  options?: { gcsUri?: string; contentType?: string; fileName?: string }
): Promise<GeminiTranscriptionResult> {
  const gcsUri = options?.gcsUri?.trim() || "";
  if (!gcsUri && (!blob || blob.size <= 0)) {
    throw new Error("文字起こし用のマイク音声が保存されていませんでした");
  }
  if (!gcsUri && blob && blob.size > GEMINI_TRANSCRIPTION_AUDIO_MAX_BYTES) {
    throw new Error(
      `マイク音声が大きすぎるためGemini文字起こしを実行できません (${formatBytes(blob.size)})`
    );
  }
  try {
    const [{ getApp }, { getFunctions, httpsCallable }] = await Promise.all([
      import("firebase/app"),
      import("firebase/functions"),
    ]);
    const callable = httpsCallable<
      { audioBase64?: string; gcsUri?: string; contentType: string; fileName: string },
      {
        ok?: boolean;
        provider?: string;
        model?: string;
        text?: string;
        segments?: Array<Partial<StoryVaultTranscriptCue>>;
        srt?: string;
        timingStatus?: StoryVaultTranscriptTimingStatus;
        skipped?: boolean;
        error?: string;
      }
    >(
      getFunctions(getApp(), "asia-northeast1"),
      "transcribe_zapping_video_with_aqua"
    );
    const audioBase64 = gcsUri || !blob ? undefined : await blobToBase64(blob);
    const contentType = options?.contentType || blob?.type || "audio/webm";
    const res = await callable({
      audioBase64,
      gcsUri: gcsUri || undefined,
      contentType,
      fileName: options?.fileName || `zapping-audio.${audioExtensionForMime(contentType)}`,
    });
    const provider = res.data.model
      ? `${res.data.provider || "gemini-stt"}:${res.data.model}`
      : res.data.provider || "gemini-stt";
    if (!res.data.ok || res.data.skipped) {
      throw new Error(res.data.error || "Gemini文字起こしを実行できませんでした");
    }
    const srt = res.data.srt?.trim() || "";
    const segments = normalizeTranscriptCues(
      res.data.segments?.length ? res.data.segments : parseSrtTranscript(srt)
    ) as StoryVaultTranscriptCue[];
    const normalizedSrt = srt || transcriptCuesToSrt(segments);
    if (res.data.timingStatus !== "timestamped" || segments.length === 0 || !normalizedSrt) {
      throw new Error("Gemini文字起こしでタイムスタンプ付きセグメントを取得できませんでした");
    }
    return {
      text: res.data.text?.trim() || "",
      provider,
      segments,
      srt: normalizedSrt,
      timingStatus: "timestamped",
    };
  } catch (error) {
    throw new Error(
      error instanceof Error
        ? `Gemini文字起こしに失敗しました: ${error.message}`
        : "Gemini文字起こしに失敗しました"
    );
  }
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error ?? new Error("Blob read failed"));
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      resolve(result.split(",")[1] ?? "");
    };
    reader.readAsDataURL(blob);
  });
}

function setupAudioAnalyser(stream: MediaStream): void {
  cleanupAudioAnalyser();
  const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextCtor) return;
  audioContext = new AudioContextCtor();
  analyser = audioContext.createAnalyser();
  analyser.fftSize = 128;
  analyser.smoothingTimeConstant = 0.75;
  const source = audioContext.createMediaStreamSource(stream);
  source.connect(analyser);
  updateWaveform();
}

function updateWaveform(): void {
  if (!analyser) return;
  const data = new Uint8Array(analyser.frequencyBinCount);
  analyser.getByteFrequencyData(data);
  const nextBars = Array.from({ length: 40 }, (_, index) => {
    const start = Math.floor((index / 40) * data.length);
    const end = Math.max(start + 1, Math.floor(((index + 1) / 40) * data.length));
    const slice = data.slice(start, end);
    const avg = slice.reduce((sum, value) => sum + value, 0) / slice.length;
    return Math.min(1, Math.max(0.04, avg / 255));
  });
  waveformBars.value = nextBars;
  audioLevel.value =
    nextBars.reduce((sum, value) => sum + value, 0) / nextBars.length;
  waveformRaf = window.requestAnimationFrame(updateWaveform);
}

function resetWaveform(): void {
  waveformBars.value = Array.from({ length: 40 }, () => 0.06);
  audioLevel.value = 0;
}

function cleanupAudioAnalyser(): void {
  if (waveformRaf !== null) {
    window.cancelAnimationFrame(waveformRaf);
    waveformRaf = null;
  }
  analyser = null;
  void audioContext?.close().catch(() => undefined);
  audioContext = null;
  resetWaveform();
}

async function attachLivePreview(stream: MediaStream): Promise<void> {
  await nextTick();
  if (!livePreviewVideo.value) return;
  livePreviewVideo.value.srcObject = stream;
  try {
    await livePreviewVideo.value.play();
  } catch {
    // Browsers may delay autoplay until metadata is ready; muted + playsinline keeps this best-effort.
  }
}

async function resolveVideoUrls(
  videos: DecodedStoryVaultClip[]
): Promise<void> {
  await Promise.all(
    videos.map(async (video) => {
      const clips = videoClips(video);
      const primary = clips[0];
      try {
        if (primary && !clipVideoUrls[clipKey(video.id, primary.id)]) {
          const storageRef = storageRefForBucketPath({
            bucketName: primary.bucketName,
            filePath: primary.storagePath,
          });
          const url = await getDownloadURL(storageRef);
          clipVideoUrls[clipKey(video.id, primary.id)] = url;
          videoUrls[video.id] = url;
        } else if (primary) {
          videoUrls[video.id] = clipVideoUrls[clipKey(video.id, primary.id)] || "";
        }
      } catch {
        videoUrls[video.id] = "";
      }
      await Promise.all(
        clips.flatMap((clip) => [
          (async () => {
            const key = clipKey(video.id, clip.id);
            if (clipVideoUrls[key]) return;
            try {
              const storageRef = storageRefForBucketPath({
                bucketName: clip.bucketName,
                filePath: clip.storagePath,
              });
              clipVideoUrls[key] = await getDownloadURL(storageRef);
            } catch {
              clipVideoUrls[key] = "";
            }
          })(),
          ...clip.frameCaptures.map(async (frame) => {
            if (!frame.storagePath || !frame.bucketName) return;
            const key = clipFrameKey(video.id, clip.id, frame.id);
            if (clipFrameUrls[key]) return;
            try {
              const storageRef = storageRefForBucketPath({
                bucketName: frame.bucketName,
                filePath: frame.storagePath,
              });
              const url = await getDownloadURL(storageRef);
              clipFrameUrls[key] = url;
              if (clip.id === primary?.id) {
                frameUrls[frameKey(video.id, frame.id)] = url;
              }
            } catch {
              clipFrameUrls[key] = "";
            }
          }),
        ])
      );
    })
  );
}

function clipKey(videoId: string, clipId: string): string {
  return `${videoId}:${clipId}`;
}

function frameKey(videoId: string, frameId: string): string {
  return `${videoId}:${frameId}`;
}

function clipFrameKey(videoId: string, clipId: string, frameId: string): string {
  return `${videoId}:${clipId}:${frameId}`;
}

function videoClips(
  video: DecodedStoryVaultClip
): StoryVaultOperationVideoClip[] {
  return [
    {
      id: video.id,
      title: video.title,
      fileName: video.fileName,
      bucketName: video.bucketName,
      storagePath: video.storagePath,
      contentType: video.contentType,
      sizeBytes: video.sizeBytes,
      durationMs: video.durationMs,
      transcriptText: video.transcriptText,
      transcriptProvider: video.transcriptProvider,
      transcriptSummary: video.transcriptSummary,
      transcriptSegments: video.transcriptSegments ?? [],
      transcriptSrt: video.transcriptSrt,
      transcriptTimingStatus: video.transcriptTimingStatus ?? "unavailable",
      quickScan: video.quickScan,
      frameCaptures: video.frameCaptures ?? [],
      metadataFileName: video.metadataFileName,
      metadataStoragePath: video.metadataStoragePath,
      journeyFileName: video.journeyFileName,
      journeyStoragePath: video.journeyStoragePath,
      fileSpaceRequestId: video.fileSpaceRequestId,
      journeyFileSpaceRequestId: video.journeyFileSpaceRequestId,
      sourceAssetId: video.sourceAssetId,
      journeySourceAssetId: video.journeySourceAssetId,
      sourceDisplaySurface: video.sourceDisplaySurface,
      recordedAt: video.recordedAt,
    },
  ];
}

function videoClipCount(video: DecodedStoryVaultClip): number {
  return props.clipRecords.filter((item) => item.clipGroupId === video.clipGroupId).length || 1;
}

function videoTotalDurationMs(video: DecodedStoryVaultClip): number | undefined {
  const groupClips = props.clipRecords.filter((item) => item.clipGroupId === video.clipGroupId);
  return groupClips.reduce(
    (sum, clip) => sum + Math.max(0, clip.durationMs ?? 0),
    0
  );
}

function videoTotalSizeBytes(video: DecodedStoryVaultClip): number {
  const groupClips = props.clipRecords.filter((item) => item.clipGroupId === video.clipGroupId);
  const totalClipSize = groupClips.reduce(
    (sum, clip) => sum + Math.max(0, clip.sizeBytes ?? 0),
    0
  );
  return totalClipSize || video.sizeBytes || 0;
}

function clipVideoUrl(
  video: DecodedStoryVaultClip,
  clip: StoryVaultOperationVideoClip
): string {
  return (
    clipVideoUrls[clipKey(clip.id, clip.id)] ??
    clipVideoUrls[clipKey(video.id, clip.id)] ??
    ""
  );
}

function clipTitle(clip: StoryVaultOperationVideoClip, index: number): string {
  const storedTitle = (clip as StoryVaultOperationVideoClip & { title?: string }).title?.trim();
  return (
    storedTitle ||
    clip.quickScan?.title?.trim() ||
    clip.quickScan?.description?.trim() ||
    `Clip ${String(index + 1).padStart(2, "0")}`
  );
}

function clipThumbnailUrl(
  video: DecodedStoryVaultClip,
  clip: StoryVaultOperationVideoClip
): string {
  const firstFrame = clip.frameCaptures[0];
  if (!firstFrame) return "";
  return clipSavedFrameUrl(video, clip, firstFrame.id);
}

function clipSavedFrameUrl(
  video: DecodedStoryVaultClip,
  clip: StoryVaultOperationVideoClip,
  frameId: string
): string {
  return (
    clipFrameUrls[clipFrameKey(clip.id, clip.id, frameId)] ??
    clipFrameUrls[clipFrameKey(video.id, clip.id, frameId)] ??
    frameUrls[frameKey(video.id, frameId)] ??
    ""
  );
}

function savedFrameUrl(
  video: DecodedStoryVaultClip,
  frameId: string
): string {
  return frameUrls[frameKey(video.id, frameId)] ?? "";
}

function resolveRecorderMimeType(): string {
  const candidates = [
    "video/webm;codecs=vp9",
    "video/webm;codecs=vp8",
    "video/webm",
  ];
  return candidates.find((item) => MediaRecorder.isTypeSupported(item)) ?? "";
}

function resolveAudioRecorderMimeType(): string {
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4",
  ];
  return candidates.find((item) => MediaRecorder.isTypeSupported(item)) ?? "";
}

function audioExtensionForMime(mimeType: string): string {
  const normalized = mimeType.toLowerCase();
  if (normalized.includes("mp4")) return "m4a";
  if (normalized.includes("mpeg") || normalized.includes("mp3")) return "mp3";
  if (normalized.includes("wav")) return "wav";
  if (normalized.includes("ogg")) return "ogg";
  return "webm";
}

function parseDisplaySurface(
  value: string | undefined
): StoryVaultOperationVideoDisplaySurface {
  if (value === "browser" || value === "monitor" || value === "window") {
    return value;
  }
  return "unknown";
}

function stopElapsedTimer(): void {
  if (elapsedTimer === null) return;
  window.clearInterval(elapsedTimer);
  elapsedTimer = null;
}

function stopTracks(): void {
  cleanupAudioAnalyser();
  if (livePreviewVideo.value) {
    livePreviewVideo.value.srcObject = null;
  }
  mediaStream?.getTracks().forEach((track) => track.stop());
  displayStream?.getTracks().forEach((track) => track.stop());
  microphoneStream?.getTracks().forEach((track) => track.stop());
  mediaStream = null;
  displayStream = null;
  microphoneStream = null;
  microphoneActive.value = false;
}

function revokePreviewUrl(): void {
  if (!previewUrl.value) return;
  URL.revokeObjectURL(previewUrl.value);
  previewUrl.value = "";
}

function revokePreparedPreviewUrl(): void {
  if (!preparedPreviewUrl.value) return;
  URL.revokeObjectURL(preparedPreviewUrl.value);
  preparedPreviewUrl.value = "";
}

function revokeFramePreviewUrls(): void {
  frameCaptures.value.forEach((frame) => URL.revokeObjectURL(frame.previewUrl));
  frameCaptures.value = [];
}

function formatDuration(durationMs?: number): string {
  const totalSeconds = Math.max(0, Math.floor((durationMs ?? 0) / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function formatBytes(bytes?: number): string {
  const value = bytes ?? 0;
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

function formatRecordedAt(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("ja-JP");
}

function displaySurfaceLabel(
  value?: StoryVaultOperationVideoDisplaySurface
): string {
  if (value === "window") return "Window";
  if (value === "browser") return "Tab";
  if (value === "monitor") return "Screen";
  return "Unknown";
}

function discoveryLabel(
  status: StoryVaultOperationVideoDiscoveryStatus
): string {
  if (status === "queued") return "Queued";
  if (status === "completed") return "Indexed";
  if (status === "error") return "Error";
  return "Local";
}

function analysisLabel(status?: StoryVaultZappingAnalysisStatus): string {
  if (status === "queued") return "解析待ち";
  if (status === "running") return "解析中";
  if (status === "completed") return "解析済み";
  if (status === "error") return "失敗";
  return "未解析";
}

function analysisColor(
  status?: StoryVaultZappingAnalysisStatus
): "neutral" | "success" | "warning" | "error" {
  if (status === "queued" || status === "running") return "warning";
  if (status === "completed") return "success";
  if (status === "error") return "error";
  return "neutral";
}
</script>
