<template>
  <section class="rounded-lg border border-slate-200 bg-white p-4">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div class="flex items-center gap-3">
        <div class="flex h-9 w-9 items-center justify-center rounded-lg bg-primary-50 text-primary-700">
          <UIcon
            name="material-symbols:video-camera-back-outline"
            class="h-5 w-5"
          />
        </div>
        <div>
          <h2 class="text-sm font-semibold text-slate-900">操作動画</h2>
          <p class="mt-0.5 text-xs text-slate-500">
            {{ videos.length }}件
          </p>
        </div>
      </div>
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
          leading-icon="material-symbols:add-circle-outline"
          :loading="isProvisioningFileSpace"
          :disabled="application.fileSpaceProvisioningStatus === 'creating'"
          @click="$emit('create-file-space')"
        >
          専用FileSpace作成
        </EnButton>
      </template>
    </EnAlert>

    <EnModal
      v-model:open="recordingModalOpen"
      title="ザッピング動画を録画"
      subtitle="マイク音声を含めて、操作意図と画面の流れを一緒に残します。"
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
            v-if="previewUrl && !isRecording"
            :src="previewUrl"
            controls
            class="aspect-video max-h-full w-full bg-black object-contain"
          />
          <div
            v-if="!isRecording && !previewUrl"
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

        <div class="mt-3 rounded-lg border border-white/10 bg-white/5 p-3">
          <div class="mb-2 flex items-center justify-between gap-2 text-xs">
            <span class="font-semibold text-slate-100">音声波形</span>
            <span class="text-slate-400">{{ Math.round(audioLevel * 100) }}%</span>
          </div>
          <div class="flex h-16 items-end gap-1">
            <span
              v-for="(bar, index) in waveformBars"
              :key="index"
              class="min-w-0 flex-1 rounded-t bg-primary-400/80 transition-[height]"
              :style="{ height: `${Math.max(6, bar * 100)}%` }"
            />
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

        <div class="mt-3 grid gap-2 text-xs text-slate-300 sm:grid-cols-3">
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
            :disabled="isSaving || isExtractingFrames"
            @click="resetRecording"
          >
            撮り直す
          </EnButton>
          <EnButton
            v-if="recordedBlob && !isRecording"
            variant="ai"
            size="md"
            leading-icon="material-symbols:save-outline"
            :disabled="!canSave"
            :loading="isSaving || isExtractingFrames"
            @click="saveRecording"
          >
            解析して保存
          </EnButton>
        </div>
      </div>
    </EnModal>

    <EnModal
      v-model:open="saveProgressOpen"
      title="ザッピング動画を保存中"
      subtitle="録画データと動画解析メモを保存しています。"
      title-icon="material-symbols:cloud-upload-outline"
      size="sm"
      :close-on-backdrop="false"
      :hide-close="saveProgressPhase !== 'error'"
    >
      <div class="space-y-4">
        <div
          class="rounded-lg border p-3"
          :class="saveProgressPhase === 'error' ? 'border-red-200 bg-red-50' : 'border-primary-100 bg-primary-50'"
        >
          <div class="flex items-start gap-3">
            <UIcon
              :name="saveProgressPhase === 'error' ? 'material-symbols:error-outline' : saveProgressPhase === 'done' ? 'material-symbols:check-circle-outline' : 'material-symbols:sync'"
              class="mt-0.5 h-5 w-5"
              :class="saveProgressPhase === 'error' ? 'text-red-600' : saveProgressPhase === 'done' ? 'text-primary-600' : 'animate-spin text-primary-600'"
            />
            <div class="min-w-0">
              <p class="text-sm font-semibold text-slate-900">
                {{ saveProgressTitle }}
              </p>
              <p class="mt-1 text-xs leading-relaxed text-slate-600">
                {{ saveProgressDescription }}
              </p>
            </div>
          </div>
        </div>

        <ol class="space-y-2">
          <li
            v-for="step in saveProgressSteps"
            :key="step.key"
            class="flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2"
          >
            <span
              class="flex h-6 w-6 items-center justify-center rounded-full text-xs"
              :class="step.status === 'done' ? 'bg-primary-100 text-primary-700' : step.status === 'active' ? 'bg-primary-100 text-primary-700' : step.status === 'error' ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-400'"
            >
              <UIcon
                v-if="step.status === 'done'"
                name="material-symbols:check-small"
                class="h-4 w-4"
              />
              <UIcon
                v-else-if="step.status === 'active'"
                name="material-symbols:progress-activity"
                class="h-4 w-4 animate-spin"
              />
              <UIcon
                v-else-if="step.status === 'error'"
                name="material-symbols:close-small"
                class="h-4 w-4"
              />
              <span v-else>{{ step.index }}</span>
            </span>
            <div class="min-w-0">
              <p class="text-sm font-semibold text-slate-800">
                {{ step.label }}
              </p>
              <p class="mt-0.5 text-xs text-slate-500">
                {{ step.description }}
              </p>
            </div>
          </li>
        </ol>

        <div
          v-if="saveProgressPhase === 'error'"
          class="flex justify-end"
        >
          <EnButton
            variant="outline"
            color="neutral"
            size="sm"
            @click="saveProgressOpen = false"
          >
            閉じる
          </EnButton>
        </div>
      </div>
    </EnModal>

    <EnModal
      v-model:open="quickScanPreviewOpen"
      title="動画解析メモ"
      subtitle="タイトル、説明、操作ステップ、文字起こしをまとめて確認します。"
      title-icon="material-symbols:fact-check-outline"
      size="xl"
      :ui="{ content: 'max-w-[1040px]' }"
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
          class="rounded-xl border border-primary-100 bg-primary-50/60 p-4"
        >
          <div class="mb-3 flex items-center justify-between gap-2">
            <div>
              <p class="text-xs font-semibold uppercase tracking-wide text-primary-700">
                文字起こし要約
              </p>
              <p class="mt-1 text-xs text-primary-700/80">
                音声から読み取れた意図と期待結果を整理しています。
              </p>
            </div>
            <EnBadge color="success" variant="soft">
              {{ quickScanPreviewVideo.transcriptProvider || "aqua-voice" }}
            </EnBadge>
          </div>
          <div class="grid gap-3 md:grid-cols-2">
            <div
              v-for="section in richTranscriptSummarySections(quickScanPreviewVideo)"
              :key="`${quickScanPreviewVideo.id}-summary-${section.title}`"
              class="rounded-lg border border-primary-100 bg-white p-3"
            >
              <p class="text-xs font-semibold text-primary-900">
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
              <span class="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-primary-100 text-xs font-semibold text-primary-700">
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
          v-if="quickScanPreviewVideo.transcriptText"
          class="rounded-xl border border-slate-200 bg-white p-4"
        >
          <summary class="cursor-pointer text-sm font-semibold text-slate-800">
            Aqua Voice 文字起こし全文
          </summary>
          <p class="mt-3 max-h-80 overflow-auto whitespace-pre-line rounded-lg bg-slate-50 p-3 text-xs leading-relaxed text-slate-600">
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
      title="ザッピング動画を削除しますか?"
      subtitle="動画、スクリーンショット、検索用メタデータを削除します。"
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

    <div
      v-if="detailVideo"
      class="mt-5 border-t border-slate-100 pt-4"
    >
      <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div class="flex min-w-0 items-center gap-3">
          <EnButton
            variant="ghost"
            color="neutral"
            size="xs"
            leading-icon="material-symbols:arrow-back"
            @click="detailVideoId = ''"
          >
            一覧へ戻る
          </EnButton>
          <div class="min-w-0">
            <h3 class="truncate text-base font-semibold text-slate-950">
              {{ displayVideoTitle(detailVideo) }}
            </h3>
            <p class="mt-1 text-xs text-slate-500">
              {{ formatRecordedAt(detailVideo.recordedAt) }} / {{ formatDuration(detailVideo.durationMs) }}
            </p>
          </div>
        </div>
        <div class="flex flex-wrap items-center gap-2">
          <EnBadge
            :color="analysisColor(detailVideo.analysisStatus)"
            variant="soft"
          >
            {{ analysisLabel(detailVideo.analysisStatus) }}
          </EnBadge>
          <EnButton
            variant="ai"
            size="xs"
            leading-icon="material-symbols:psychology-outline"
            :loading="isAnalyzing && detailVideo.analysisStatus === 'running'"
            :disabled="!application?.fileSpaceId || detailVideo.analysisStatus === 'queued' || detailVideo.analysisStatus === 'running'"
            @click="$emit('analyze', detailVideo.id)"
          >
            解析を実行
          </EnButton>
        </div>
      </div>

      <div class="mb-5 rounded-xl border border-slate-200 bg-white p-1.5 shadow-sm">
        <div class="grid gap-1 sm:grid-cols-3">
        <button
          type="button"
          class="flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold transition"
          :class="detailTab === 'video' ? 'bg-slate-950 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'"
          @click="detailTab = 'video'"
        >
          <UIcon name="material-symbols:play-circle-outline" class="h-4 w-4" />
          動画
        </button>
        <button
          type="button"
          class="flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold transition"
          :class="detailTab === 'videoAnalysis' ? 'bg-primary-600 text-white shadow-sm' : 'text-slate-500 hover:bg-primary-50 hover:text-primary-700'"
          @click="detailTab = 'videoAnalysis'"
        >
          <UIcon name="material-symbols:auto-awesome-outline" class="h-4 w-4" />
          動画解析
        </button>
        <button
          type="button"
          class="flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold transition"
          :class="detailTab === 'storyAnalysis' ? 'bg-amber-400 text-slate-950 shadow-sm' : 'text-slate-500 hover:bg-amber-50 hover:text-amber-800'"
          @click="detailTab = 'storyAnalysis'"
        >
          <UIcon name="material-symbols:sticky-note-2-outline" class="h-4 w-4" />
          ストーリー解析
        </button>
        </div>
      </div>

      <div
        v-if="detailTab === 'video'"
        class="space-y-4"
      >
        <div class="grid gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
          <aside class="relative overflow-hidden rounded-3xl border border-amber-100 bg-[#fffdf6] p-4 shadow-sm">
            <div class="pointer-events-none absolute inset-0 opacity-[0.45] [background-image:linear-gradient(#eef2f7_1px,transparent_1px),linear-gradient(90deg,#eef2f7_1px,transparent_1px)] [background-size:28px_28px]" />
            <div class="relative space-y-3">
              <div class="rounded-2xl border border-amber-200 bg-amber-50/95 p-4 shadow-sm">
                <p class="text-xs font-semibold text-amber-800">
                  操作で見えた意図
                </p>
                <p class="mt-3 text-sm leading-relaxed text-slate-800">
                  {{ detailVideo.analysisResult?.operationIntent || detailVideo.quickScan?.description || "未生成" }}
                </p>
              </div>
              <div class="rounded-2xl border border-primary-100 bg-primary-50/70 p-4 shadow-sm">
                <p class="text-xs font-semibold text-primary-800">
                  背景として参照した知識
                </p>
                <p class="mt-3 text-sm leading-relaxed text-slate-800">
                  {{ detailVideo.analysisResult?.productContextSummary || "FileSpace文脈は解析後に表示されます" }}
                </p>
              </div>
              <div class="rounded-2xl border border-slate-200 bg-white/95 p-4 shadow-sm">
                <p class="text-xs font-semibold text-slate-700">
                  話していた内容
                </p>
                <p class="mt-3 text-sm leading-relaxed text-slate-800">
                  {{ detailVideo.analysisResult?.transcriptSummary || detailVideo.transcriptSummary || detailVideo.quickScan?.transcriptSummary || "未生成" }}
                </p>
              </div>
            </div>
          </aside>

          <div class="rounded-2xl border border-slate-200 bg-slate-950 p-3 shadow-sm">
            <video
              v-if="videoUrls[detailVideo.id]"
              :src="videoUrls[detailVideo.id]"
              controls
              preload="metadata"
              class="aspect-video w-full rounded-xl bg-slate-950"
            />
          </div>
        </div>

          <div
            v-if="detailVideo.frameCaptures.length > 0"
          class="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
          >
            <div class="mb-2 flex items-center justify-between gap-2">
            <h4 class="flex items-center gap-2 text-sm font-semibold text-slate-900">
              <UIcon name="material-symbols:photo-library-outline" class="h-4 w-4 text-primary-600" />
                操作スクリーンショット
              </h4>
              <EnBadge color="neutral" variant="soft">
                {{ detailVideo.frameCaptures.length }}
              </EnBadge>
            </div>
            <div class="grid grid-cols-3 gap-2 lg:grid-cols-4 xl:grid-cols-5">
              <figure
                v-for="frame in detailVideo.frameCaptures"
                :key="frame.id"
                class="overflow-hidden rounded-md border border-slate-100 bg-slate-50"
              >
                <img
                  :src="savedFrameUrl(detailVideo, frame.id)"
                  class="aspect-video w-full object-cover"
                  :alt="`${formatDuration(frame.timestampMs)} のスクリーンショット`"
                >
              <figcaption class="bg-white px-2 py-1 text-[11px] font-semibold text-slate-500">
                  {{ formatDuration(frame.timestampMs) }}
                </figcaption>
              </figure>
            </div>
          </div>
      </div>

      <div
        v-else-if="detailTab === 'videoAnalysis'"
        class="space-y-4"
      >
        <div class="relative overflow-hidden rounded-3xl border border-amber-100 bg-[#fffdf6] p-5 shadow-sm">
          <div class="pointer-events-none absolute inset-0 opacity-[0.55] [background-image:linear-gradient(#eef2f7_1px,transparent_1px),linear-gradient(90deg,#eef2f7_1px,transparent_1px)] [background-size:28px_28px]" />
          <div class="relative space-y-5">
            <div class="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p class="inline-flex -rotate-1 rounded-full bg-amber-100 px-3 py-1 text-[11px] font-semibold text-amber-800">
                  動画解析ノート
                </p>
                <h4 class="mt-3 text-xl font-semibold text-slate-950">
                  AIの下書きと文字起こしを確認します
                </h4>
              </div>
              <EnBadge color="primary" variant="soft">
                {{ quickScanProviderLabel(detailVideo) }}
              </EnBadge>
            </div>

            <div
              v-if="hasQuickScanSummary(detailVideo)"
              class="rounded-3xl border border-slate-200 bg-white/95 p-5 shadow-sm"
            >
              <div class="mb-4 flex items-center justify-between gap-2">
                <h4 class="flex items-center gap-2 text-sm font-semibold text-slate-900">
                  <UIcon name="material-symbols:draw-outline" class="h-4 w-4 text-primary-600" />
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
                      <span class="mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-primary-100 text-xs font-semibold text-primary-700">
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
              class="rounded-3xl border border-primary-100 bg-primary-50/45 p-5 shadow-sm"
            >
              <h4 class="flex items-center gap-2 text-sm font-semibold text-primary-950">
                <UIcon name="material-symbols:summarize-outline" class="h-4 w-4" />
                文字起こしの読みどころ
              </h4>
              <div class="mt-3 grid gap-3 md:grid-cols-3">
                <div
                  v-for="section in richTranscriptSummarySections(detailVideo).slice(0, 3)"
                  :key="`${detailVideo.id}-detail-summary-${section.title}`"
                  class="rounded-2xl border border-primary-100 bg-white p-3"
                >
                  <p class="text-xs font-semibold text-primary-900">
                    {{ section.title }}
                  </p>
                  <p class="mt-2 text-sm leading-relaxed text-slate-700">
                    {{ section.body }}
                  </p>
                </div>
              </div>
            </div>

            <div
              v-if="detailVideo.transcriptText"
              class="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"
            >
              <div class="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h4 class="flex items-center gap-2 text-sm font-semibold text-slate-900">
                  <UIcon name="material-symbols:article-outline" class="h-4 w-4 text-slate-500" />
                  文字起こし全文
                </h4>
                <EnBadge color="neutral" variant="soft">
                  {{ detailVideo.transcriptProvider || "transcript" }}
                </EnBadge>
              </div>
              <p class="max-h-[420px] overflow-auto whitespace-pre-line rounded-2xl border border-slate-100 bg-slate-50 p-4 text-sm leading-7 text-slate-700">
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
        v-else
        class="space-y-4"
      >
        <div class="relative overflow-hidden rounded-3xl border border-amber-100 bg-[#fffdf6] p-5 shadow-sm">
          <div class="pointer-events-none absolute inset-0 opacity-[0.45] [background-image:linear-gradient(#e9edf3_1px,transparent_1px),linear-gradient(90deg,#e9edf3_1px,transparent_1px)] [background-size:30px_30px]" />
          <div class="pointer-events-none absolute right-4 top-4 h-10 w-24 rotate-12 rounded-sm bg-primary-100/80 shadow-sm" />
          <div class="mb-4 flex flex-wrap items-start justify-between gap-3">
            <div>
              <p class="relative inline-flex -rotate-1 rounded-full bg-amber-100 px-3 py-1 text-[11px] font-semibold text-amber-800">
                ユーザーの「やりたいこと」メモ
              </p>
              <h4 class="relative mt-3 text-xl font-semibold text-slate-950">
                ストーリー解析
              </h4>
              <p class="relative mt-1 text-sm text-slate-500">
                操作動画で見つけたニーズを、付箋と根拠つきで整理します
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
            解析を実行すると、ユーザーのやりたいこと候補と根拠になる動画の場面がここに表示されます
          </div>

          <div v-else class="relative space-y-5">
            <div
              v-if="detailVideo.analysisResult.storyCandidates.length === 0"
              class="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-500"
            >
              ストーリー候補は生成されませんでした。動画や文字起こしから十分な操作意図を確認できなかった可能性があります。
            </div>

            <div
              v-else
              class="grid gap-5 xl:grid-cols-[minmax(320px,0.78fr)_minmax(0,1.22fr)]"
            >
              <section class="rounded-3xl border border-amber-100 bg-white/80 p-4 shadow-sm">
                <div class="mb-3 flex items-center justify-between gap-2">
                  <h5 class="flex items-center gap-2 text-sm font-semibold text-slate-900">
                    <UIcon name="material-symbols:sticky-note-2-outline" class="h-4 w-4 text-amber-600" />
                    見つかったストーリー
                  </h5>
                  <EnBadge color="warning" variant="soft">
                    {{ detailVideo.analysisResult.storyCandidates.length }}
                  </EnBadge>
                </div>
                <div class="space-y-3">
                  <button
                    v-for="story in detailVideo.analysisResult.storyCandidates"
                    :key="story.id"
                    type="button"
                    class="w-full rounded-xl border p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                    :class="selectedAnalysisStory?.id === story.id ? 'rotate-[-0.25deg] border-primary-300 bg-amber-50 ring-2 ring-primary-100' : 'rotate-[0.15deg] border-amber-100 bg-white hover:border-amber-300'"
                    @click="selectedAnalysisStoryId = story.id"
                  >
                    <div class="flex items-start justify-between gap-2">
                      <p class="line-clamp-2 text-sm font-semibold text-slate-900">
                        {{ story.title }}
                      </p>
                      <EnBadge color="warning" variant="soft">
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
                      <EnBadge
                        v-if="story.role"
                        :color="story.role.grounding === 'explicit' ? 'success' : 'warning'"
                        variant="soft"
                      >
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
                        color="primary"
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
                  左の付箋を選ぶと、詳しい内容と根拠の動画が表示されます
                </div>
                <div
                  v-else
                  class="space-y-4"
                >
                  <div class="rounded-3xl border border-amber-100 bg-gradient-to-br from-amber-50 via-white to-primary-50 p-5">
                    <div class="flex flex-wrap items-start justify-between gap-3">
                    <div class="min-w-0">
                        <p class="mb-2 inline-flex rounded-full bg-white/80 px-2.5 py-1 text-[11px] font-semibold text-amber-800">
                          選択中のストーリー
                        </p>
                        <h5 class="text-lg font-semibold text-slate-950">
                        {{ selectedAnalysisStory.title }}
                      </h5>
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
                        :color="selectedAnalysisStory.role.grounding === 'explicit' ? 'success' : 'warning'"
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

                  <div
                    v-if="selectedAnalysisStory.role || selectedAnalysisStory.goal || selectedAnalysisStory.benefit"
                    class="grid gap-3 md:grid-cols-3"
                  >
                    <div class="rounded-2xl border border-amber-100 bg-amber-50/80 p-4 shadow-sm">
                      <p class="text-xs font-semibold text-amber-800">
                        誰が
                      </p>
                      <p class="mt-2 text-sm leading-relaxed text-slate-800">
                        {{ selectedAnalysisStory.role?.value || selectedAnalysisStory.asA || "未生成" }}
                      </p>
                    </div>
                    <div class="rounded-2xl border border-primary-100 bg-primary-50 p-4 shadow-sm">
                      <p class="text-xs font-semibold text-primary-800">
                        何をしたいか
                      </p>
                      <p class="mt-2 text-sm leading-relaxed text-slate-800">
                        {{ selectedAnalysisStory.goal || selectedAnalysisStory.iWant || "未生成" }}
                      </p>
                    </div>
                    <div class="rounded-2xl border border-slate-200 bg-slate-50 p-4 shadow-sm">
                      <p class="text-xs font-semibold text-slate-700">
                        何がうれしいか
                      </p>
                      <p class="mt-2 text-sm leading-relaxed text-slate-800">
                        {{ selectedAnalysisStory.benefit || selectedAnalysisStory.soThat || "未生成" }}
                      </p>
                    </div>
                  </div>

                  <p
                    v-if="selectedAnalysisStory.userStory"
                    class="rounded-lg border border-primary-100 bg-primary-50 p-3 text-sm leading-relaxed text-primary-950"
                  >
                    {{ selectedAnalysisStory.userStory }}
                  </p>

                  <div class="rounded-3xl border border-primary-100 bg-primary-50/60 p-4">
                    <div class="mb-3 flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p class="flex items-center gap-2 text-sm font-semibold text-primary-950">
                          <UIcon name="material-symbols:movie-filter-outline" class="h-4 w-4" />
                          根拠になった動画の場面
                        </p>
                        <p class="mt-1 text-xs text-primary-800">
                          タイムスタンプから、近いスクリーンショットも一緒に確認できます
                        </p>
                      </div>
                      <EnBadge color="primary" variant="soft">
                        {{ selectedAnalysisStory.evidence.length }}
                      </EnBadge>
                    </div>
                    <div class="space-y-3">
                      <div
                        v-for="(item, evidenceIndex) in selectedAnalysisStory.evidence"
                        :key="`${selectedAnalysisStory.id}-timestamp-${evidenceIndex}`"
                        class="rounded-xl border border-primary-100 bg-white p-3 shadow-sm"
                      >
                        <div class="flex flex-wrap items-start justify-between gap-2">
                          <div class="min-w-0">
                            <p class="text-sm font-semibold text-slate-900">
                              {{ item.title || `動画セグメント ${evidenceIndex + 1}` }}
                            </p>
                            <p
                              v-if="item.summary"
                              class="mt-1 text-xs leading-relaxed text-slate-600"
                            >
                              {{ item.summary }}
                            </p>
                          </div>
                          <EnBadge color="primary" variant="soft">
                            {{ formatEvidenceRange(item.tRange) }}
                          </EnBadge>
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
                              :class="item.representativeScreenshotId === frame.id ? 'border-primary-300 ring-2 ring-primary-100' : 'border-slate-200'"
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
                                  class="font-semibold text-primary-700"
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
                    class="rounded-3xl border border-amber-100 bg-amber-50/60 p-4"
                  >
                    <p class="text-sm font-semibold text-amber-950">
                      できたと言える条件
                    </p>
                    <ul class="mt-2 space-y-2">
                      <li
                        v-for="(criterion, index) in selectedAnalysisStory.acceptanceCriteria"
                        :key="criterion"
                        class="flex gap-2 text-sm leading-relaxed text-slate-700"
                      >
                        <span class="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-amber-100 text-[10px] font-semibold text-amber-700">
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
              class="rounded-lg border border-amber-200 bg-amber-50 p-3"
            >
              <p class="text-xs font-semibold text-amber-900">
                補足メモ
              </p>
              <ul class="mt-2 list-disc space-y-1 pl-5 text-xs leading-relaxed text-amber-900">
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
    </div>

    <div
      v-else
      class="mt-5 border-t border-slate-100 pt-4"
    >
      <div class="mb-3 flex items-center justify-between gap-3">
        <div>
          <h3 class="text-xs font-semibold uppercase tracking-wide text-slate-500">
            ザッピング動画一覧
          </h3>
        </div>
        <div class="flex flex-wrap gap-2">
          <EnButton
            variant="outline"
            color="neutral"
            size="xs"
            leading-icon="material-symbols:refresh"
            @click="$emit('refresh')"
          >
            再読込
          </EnButton>
          <EnButton
            variant="ai"
            size="xs"
            leading-icon="material-symbols:batch-prediction-outline"
            :loading="isAnalyzing"
            :disabled="videos.length === 0 || !application?.fileSpaceId"
            @click="$emit('analyze-all', application?.id ?? '')"
          >
            一括解析
          </EnButton>
        </div>
      </div>

      <div
        v-if="videos.length === 0"
        class="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500"
      >
        保存済みのザッピング動画はありません
      </div>

      <div
        v-else
        class="grid gap-4 xl:grid-cols-[minmax(320px,0.78fr)_minmax(520px,1.22fr)]"
      >
        <div class="space-y-3">
          <article
            v-for="video in videos"
            :key="video.id"
            class="overflow-hidden rounded-lg border bg-white transition"
            :class="selectedVideo?.id === video.id ? 'border-primary-300 ring-2 ring-primary-100' : 'border-slate-200'"
          >
            <div
              class="grid w-full grid-cols-[96px_minmax(0,1fr)] text-left"
              @click="selectedVideoId = video.id"
            >
              <video
                v-if="videoUrls[video.id]"
                :src="videoUrls[video.id]"
                preload="metadata"
                muted
                class="aspect-video h-full w-full bg-slate-950 object-cover"
              />
              <div
                v-else
                class="flex aspect-video h-full items-center justify-center bg-slate-950 text-[11px] text-slate-300"
              >
                URL loading
              </div>
              <div class="min-w-0 space-y-2 p-3">
                <div class="flex items-start justify-between gap-2">
                  <div class="min-w-0">
                    <h4 class="truncate text-sm font-semibold text-slate-900">
                      {{ displayVideoTitle(video) }}
                    </h4>
                    <p class="mt-1 text-xs text-slate-500">
                      {{ formatRecordedAt(video.recordedAt) }}
                    </p>
                  </div>
                  <EnBadge
                    :color="analysisColor(video.analysisStatus)"
                    variant="soft"
                  >
                    {{ analysisLabel(video.analysisStatus) }}
                  </EnBadge>
                </div>
                <p
                  v-if="displayVideoDescription(video)"
                  class="line-clamp-2 text-xs leading-relaxed text-slate-600"
                >
                  {{ displayVideoDescription(video) }}
                </p>
                <div
                  v-if="operationSteps(video).length > 0"
                  class="rounded-md bg-slate-50 px-2 py-2"
                >
                  <ol class="space-y-1">
                    <li
	                      v-for="(step, index) in operationSteps(video).slice(0, 3)"
                      :key="`${video.id}-memo-${index}`"
                      class="flex gap-2 text-xs leading-relaxed text-slate-600"
                    >
                      <span class="mt-0.5 flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full bg-primary-100 text-[10px] font-semibold text-primary-700">
                        {{ index + 1 }}
                      </span>
                      <span class="line-clamp-1">{{ step }}</span>
                    </li>
                  </ol>
                </div>
                <div
                  v-if="video.frameCaptures.length > 0"
                  class="grid grid-cols-4 gap-1"
                >
                  <img
                    v-for="frame in video.frameCaptures.slice(0, 4)"
                    :key="frame.id"
                    :src="savedFrameUrl(video, frame.id)"
                    class="aspect-video rounded bg-slate-100 object-cover"
                    :alt="`${formatDuration(frame.timestampMs)} のスクリーンショット`"
                  >
                </div>
                <div class="flex flex-wrap gap-2 text-[11px] text-slate-500">
                  <span>{{ formatDuration(video.durationMs) }}</span>
                  <span>{{ formatBytes(video.sizeBytes) }}</span>
                  <span>{{ displaySurfaceLabel(video.sourceDisplaySurface) }}</span>
                  <span>{{ discoveryLabel(video.discoveryStatus) }}</span>
                </div>
                <div class="flex flex-wrap justify-end gap-2 border-t border-slate-100 pt-2">
                  <EnButton
                    variant="outline"
                    color="neutral"
                    size="xs"
                    leading-icon="material-symbols:open-in-new"
                    @click.stop="detailVideoId = video.id"
                  >
                    詳細を見る
                  </EnButton>
                  <EnButton
                    variant="outline"
                    color="error"
                    size="xs"
                    leading-icon="material-symbols:delete-outline"
                    @click.stop="openDeleteVideoConfirm(video)"
                  >
                    削除
                  </EnButton>
                </div>
              </div>
            </div>
          </article>
        </div>

        <aside class="rounded-lg border border-slate-200 bg-slate-50 p-4">
          <div
            v-if="!selectedVideo"
            class="rounded-lg border border-dashed border-slate-200 bg-white p-4 text-sm text-slate-500"
          >
            ザッピング動画を選択してください
          </div>
          <div
            v-else
            class="space-y-4"
          >
            <div class="flex items-start justify-between gap-3">
              <div>
                <h3 class="text-sm font-semibold text-slate-900">
                  選択中の操作動画
                </h3>
                <p class="mt-1 text-xs text-slate-500">
                  {{ displayVideoTitle(selectedVideo) }}
                </p>
              </div>
              <EnBadge
                :color="analysisColor(selectedVideo.analysisStatus)"
                variant="soft"
              >
                {{ analysisLabel(selectedVideo.analysisStatus) }}
              </EnBadge>
            </div>

            <video
              v-if="videoUrls[selectedVideo.id]"
              :src="videoUrls[selectedVideo.id]"
              controls
              preload="metadata"
              class="aspect-video w-full rounded-lg bg-slate-950"
            />

            <div
              v-if="hasQuickScanSummary(selectedVideo)"
              class="rounded-lg border border-slate-200 bg-white p-3"
            >
              <div class="mb-2 flex items-center justify-between gap-2">
                <h4 class="text-xs font-semibold text-slate-700">
                  動画解析メモ
                </h4>
                <div class="flex items-center gap-2">
                  <EnBadge color="neutral" variant="soft">
                    {{ quickScanProviderLabel(selectedVideo) }}
                  </EnBadge>
                  <EnButton
                    variant="outline"
                    color="neutral"
                    size="xs"
                    leading-icon="material-symbols:open-in-new"
                    @click="openQuickScanPreview(selectedVideo)"
                  >
                    詳細表示
                  </EnButton>
                </div>
              </div>
              <div class="space-y-2">
                <p
                  v-if="selectedVideo.quickScan?.description"
                  class="text-xs leading-relaxed text-slate-600"
                >
                  {{ selectedVideo.quickScan.description }}
                </p>
	                <p
	                  v-if="operationSteps(selectedVideo).length > 0"
	                  class="text-xs leading-relaxed text-slate-600"
	                >
	                  {{ operationSteps(selectedVideo).slice(0, 4).join(" / ") }}
	                </p>
                <div
                  v-if="richTranscriptSummarySections(selectedVideo).length > 0"
                  class="space-y-2"
                >
                  <div
                    v-for="section in richTranscriptSummarySections(selectedVideo).slice(0, 3)"
                    :key="`${selectedVideo.id}-side-summary-${section.title}`"
                    class="rounded-md border border-primary-100 bg-primary-50/60 p-2"
                  >
                    <p class="text-[11px] font-semibold text-primary-900">
                      {{ section.title }}
                    </p>
                    <p class="mt-1 line-clamp-2 text-xs leading-relaxed text-slate-600">
                      {{ section.body }}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div
              v-if="selectedVideo.frameCaptures.length > 0"
              class="rounded-lg border border-slate-200 bg-white p-3"
            >
              <div class="mb-2 flex items-center justify-between gap-2">
                <h4 class="text-xs font-semibold text-slate-700">
                  操作スクリーンショット
                </h4>
                <EnBadge color="neutral" variant="soft">
                  {{ selectedVideo.frameCaptures.length }}
                </EnBadge>
              </div>
              <div class="grid grid-cols-4 gap-2">
                <img
                  v-for="frame in selectedVideo.frameCaptures.slice(0, 8)"
                  :key="frame.id"
                  :src="savedFrameUrl(selectedVideo, frame.id)"
                  class="aspect-video rounded-md bg-slate-100 object-cover"
                  :alt="`${formatDuration(frame.timestampMs)} のスクリーンショット`"
                >
              </div>
            </div>

            <EnAlert
              v-if="selectedVideo.analysisErrorMessage"
              color="error"
              :title="selectedVideo.analysisErrorMessage"
            />

            <div class="flex flex-wrap justify-end gap-2">
              <EnButton
                variant="ai"
                size="xs"
                leading-icon="material-symbols:psychology-outline"
                :loading="isAnalyzing && selectedVideo.analysisStatus === 'running'"
                :disabled="!application?.fileSpaceId || selectedVideo.analysisStatus === 'queued' || selectedVideo.analysisStatus === 'running'"
                @click="$emit('analyze', selectedVideo.id)"
              >
                個別解析
              </EnButton>
            </div>
          </div>
        </aside>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, reactive, ref, watch } from "vue";
import { getDownloadURL } from "firebase/storage";
import { storageRefForBucketPath } from "@composables/firebase-storage-operations";
import { reportDatadogError } from "@utils/datadogObservability";
import type {
  DecodedVibeControlApplication,
  DecodedVibeControlOperationVideo,
  VibeControlOperationVideoDiscoveryStatus,
  VibeControlOperationVideoDisplaySurface,
  VibeControlZappingAnalysisStoryCandidate,
  VibeControlZappingAnalysisStatus,
} from "@models/vibeControl";
import type { VibeControlOperationVideoSaveInput } from "@stores/vibeControl";

type OperationVideoSaveCallbacks = {
  onSuccess?: (video: DecodedVibeControlOperationVideo) => void;
  onError?: (message: string) => void;
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
  | "extracting"
  | "transcribing"
  | "summarizing"
  | "scanning"
  | "uploading"
  | "done"
  | "error";

type SaveProgressStep = {
  key: string;
  index: number;
  label: string;
  description: string;
  status: "pending" | "active" | "done" | "error";
};

type RichTranscriptSummarySection = {
  title: string;
  body: string;
};

type ZappingAnalysisEvidence =
  VibeControlZappingAnalysisStoryCandidate["evidence"][number];

declare global {
  interface Window {
    webkitAudioContext?: typeof AudioContext;
  }
}

const props = defineProps<{
  application: DecodedVibeControlApplication | null;
  videos: DecodedVibeControlOperationVideo[];
  isSaving: boolean;
  isAnalyzing?: boolean;
  isProvisioningFileSpace?: boolean;
}>();

const emit = defineEmits<{
  save: [
    input: VibeControlOperationVideoSaveInput,
    callbacks?: OperationVideoSaveCallbacks,
  ];
  analyze: [videoId: string];
  "analyze-all": [applicationId: string];
  "create-file-space": [];
  delete: [videoId: string];
  refresh: [];
}>();

const title = ref("");
const errorMessage = ref("");
const sourceDisplaySurface = ref<VibeControlOperationVideoDisplaySurface>("unknown");
const isRecording = ref(false);
const recordingModalOpen = ref(false);
const elapsedMs = ref(0);
const recordedDurationMs = ref<number | undefined>();
const recordedBlob = ref<Blob | null>(null);
const recordedAudioBlob = ref<Blob | null>(null);
const previewUrl = ref("");
const livePreviewVideo = ref<HTMLVideoElement | null>(null);
const microphoneActive = ref(false);
const waveformBars = ref(Array.from({ length: 40 }, () => 0.06));
const audioLevel = ref(0);
const isExtractingFrames = ref(false);
const frameCaptures = ref<LocalFrameCapture[]>([]);
const quickScan = ref<DecodedVibeControlOperationVideo["quickScan"]>();
const transcriptText = ref("");
const transcriptProvider = ref("");
const transcriptSummary = ref("");
const transcriptErrorMessage = ref("");
const saveProgressOpen = ref(false);
const saveProgressPhase = ref<SaveProgressPhase>("idle");
const selectedVideoId = ref("");
const detailVideoId = ref("");
const detailTab = ref<"video" | "videoAnalysis" | "storyAnalysis">("video");
const selectedAnalysisStoryId = ref("");
const quickScanPreviewVideoId = ref("");
const deleteTargetVideoId = ref("");
const deleteVideoConfirmOpen = ref(false);
const videoUrls = reactive<Record<string, string>>({});
const frameUrls = reactive<Record<string, string>>({});
const AQUA_AUDIO_MAX_BYTES = 8 * 1024 * 1024;

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
let chunks: BlobPart[] = [];
let audioChunks: BlobPart[] = [];
let lastAudioMimeType = "audio/webm";

const canCapture = computed(
  () => Boolean(props.application?.id) && !props.isSaving
);
const canSave = computed(
  () =>
    Boolean(props.application?.id) &&
    Boolean(recordedBlob.value) &&
    !isRecording.value &&
    !isExtractingFrames.value &&
    !props.isSaving
);

const elapsedLabel = computed(() => formatDuration(elapsedMs.value));
const sourceDisplaySurfaceLabel = computed(() =>
  displaySurfaceLabel(sourceDisplaySurface.value)
);
const selectedVideo = computed(
  () =>
    props.videos.find((video) => video.id === selectedVideoId.value) ??
    props.videos[0] ??
    null
);
const detailVideo = computed(
  () => props.videos.find((video) => video.id === detailVideoId.value) ?? null
);
const quickScanPreviewVideo = computed(
  () => props.videos.find((video) => video.id === quickScanPreviewVideoId.value) ?? null
);
const detailStories = computed(
  () => detailVideo.value?.analysisResult?.storyCandidates ?? []
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
  () => props.videos.find((video) => video.id === deleteTargetVideoId.value) ?? null
);
const surfaceWarning = computed(() => {
  if (!isRecording.value && !recordedBlob.value) return "";
  if (sourceDisplaySurface.value === "window") return "";
  if (sourceDisplaySurface.value === "unknown") return "";
  return "Window以外が選択されている可能性があります";
});
const saveProgressTitle = computed(() => {
  if (saveProgressPhase.value === "done") return "保存が完了しました";
  if (saveProgressPhase.value === "error") return "保存に失敗しました";
  if (saveProgressPhase.value === "extracting") return "スクリーンショットを抽出しています";
  if (saveProgressPhase.value === "transcribing") return "Aqua Voiceで文字起こししています";
  if (saveProgressPhase.value === "summarizing") return "文字起こしを要約しています";
  if (saveProgressPhase.value === "scanning") return "AIで動画解析しています";
  return "動画と動画解析メモを保存しています";
});
const saveProgressDescription = computed(() => {
  if (saveProgressPhase.value === "done") {
    return "詳細画面へ移動します。";
  }
  if (saveProgressPhase.value === "error") {
    return errorMessage.value || "保存処理を完了できませんでした。";
  }
  if (saveProgressPhase.value === "extracting") {
    return "録画動画から約5秒ごとの操作スクリーンショットを作っています。";
  }
  if (saveProgressPhase.value === "transcribing") {
    return "録画音声をAqua Voice APIへ送信し、文字起こし全文を取得しています。";
  }
  if (saveProgressPhase.value === "summarizing") {
    return "文字起こし全文から、操作意図をGeminiで短く整理しています。";
  }
  if (saveProgressPhase.value === "scanning") {
    return "動画、スクリーンショット、文字起こし全文、要約からタイトル・説明・操作ステップを生成しています。";
  }
  return "動画本体、スクリーンショット、文字起こし、AI簡易スキャンの結果をまとめて登録しています。";
});
const saveProgressSteps = computed<SaveProgressStep[]>(() => {
  const phase = saveProgressPhase.value;
  const extractStatus =
    phase === "extracting"
      ? "active"
      : ["transcribing", "summarizing", "scanning", "uploading", "done"].includes(phase)
        ? "done"
        : phase === "error" && frameCaptures.value.length === 0
          ? "error"
          : "done";
  const transcribeStatus =
    phase === "transcribing"
      ? "active"
      : transcriptErrorMessage.value
        ? "error"
      : ["summarizing", "scanning", "uploading", "done"].includes(phase)
        ? "done"
        : phase === "error" && frameCaptures.value.length > 0
          ? "error"
          : "pending";
  const summarizeStatus =
    phase === "summarizing"
      ? "active"
      : ["scanning", "uploading", "done"].includes(phase)
        ? "done"
        : phase === "error" && Boolean(transcriptText.value)
          ? "error"
          : "pending";
  const scanStatus =
    phase === "scanning"
      ? "active"
      : ["uploading", "done"].includes(phase)
        ? "done"
        : phase === "error" && frameCaptures.value.length > 0
          ? "error"
          : "pending";
  const uploadingStatus =
    phase === "uploading" ? "active" : phase === "error" ? "error" : phase === "done" ? "done" : "pending";
  return [
    {
      key: "frames",
      index: 1,
      label: "スクリーンショットを抽出",
      description: `${frameCaptures.value.length}枚の操作スクリーンショットを準備しています。`,
      status: extractStatus,
    },
    {
      key: "transcript",
      index: 2,
      label: "Aqua Voice文字起こし",
      description: transcriptErrorMessage.value
        ? transcriptErrorMessage.value
        : transcriptText.value
        ? `${transcriptText.value.length}文字の文字起こしを取得しました。`
        : "同時録音したマイク音声から文字起こし全文を取得します。",
      status: transcribeStatus,
    },
    {
      key: "summary",
      index: 3,
      label: "文字起こしを要約",
      description: transcriptSummary.value
        ? "文字起こしの要約を作成しました。"
        : "Geminiで操作意図を短く整理します。",
      status: summarizeStatus,
    },
    {
      key: "scan",
      index: 4,
      label: "AI動画解析",
      description: quickScan.value?.errorMessage
        ? "簡易スキャンは失敗しましたが、動画保存は継続します。"
        : "4種類の入力からタイトル、説明、操作ステップをFirebase AI Logicで生成します。",
      status: scanStatus,
    },
    {
      key: "upload",
      index: 5,
      label: "Storage / Firestoreへ保存",
      description: "動画ファイル、スクリーンショット、メタデータを永続化しています。",
      status: uploadingStatus,
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
  () => props.videos,
  (videos) => {
    if (!videos.some((video) => video.id === selectedVideoId.value)) {
      selectedVideoId.value = videos[0]?.id ?? "";
    }
    if (detailVideoId.value && !videos.some((video) => video.id === detailVideoId.value)) {
      detailVideoId.value = "";
    }
    const activeDetail = videos.find((video) => video.id === detailVideoId.value);
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
    void resolveVideoUrls(videos);
  },
  { immediate: true, deep: true }
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

onBeforeUnmount(() => {
  stopElapsedTimer();
  stopTracks();
  revokePreviewUrl();
  revokeFramePreviewUrls();
});

function openRecordingModal(): void {
  errorMessage.value = "";
  recordingModalOpen.value = true;
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
    startAudioOnlyRecorder(microphoneStream);

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
      const durationMs = elapsedMs.value;
      recordedBlob.value = blob;
      recordedDurationMs.value = durationMs;
      previewUrl.value = URL.createObjectURL(blob);
      stopElapsedTimer();
      stopTracks();
      mediaRecorder = null;
      isRecording.value = false;
    };
    startedAt = Date.now();
    elapsedMs.value = 0;
    elapsedTimer = window.setInterval(() => {
      elapsedMs.value = Date.now() - startedAt;
    }, 500);
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

function resolveTranscriptionAudioBlob(): Blob | null {
  if (recordedAudioBlob.value?.size) return recordedAudioBlob.value;
  if (audioChunks.length === 0) return null;
  return new Blob(audioChunks, { type: lastAudioMimeType || "audio/webm" });
}

function resetRecording(): void {
  if (isRecording.value) return;
  revokePreviewUrl();
  recordedBlob.value = null;
  recordedAudioBlob.value = null;
  recordedDurationMs.value = undefined;
  quickScan.value = undefined;
  transcriptText.value = "";
  transcriptProvider.value = "";
  transcriptSummary.value = "";
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

async function saveRecording(): Promise<void> {
  if (!props.application || !recordedBlob.value || !canSave.value) return;
  saveProgressOpen.value = true;
  errorMessage.value = "";
  isExtractingFrames.value = true;
  try {
    saveProgressPhase.value = "extracting";
    frameCaptures.value = await extractVideoFrames(
      recordedBlob.value,
      recordedDurationMs.value ?? elapsedMs.value
    );
    saveProgressPhase.value = "transcribing";
    const transcription = await transcribeRecordingWithAqua(
      resolveTranscriptionAudioBlob()
    );
    transcriptText.value = transcription.text;
    transcriptProvider.value = transcription.provider;
    transcriptErrorMessage.value = transcription.errorMessage || "";
    if (transcription.errorMessage) {
      reportDatadogError(new Error(transcription.errorMessage), {
        feature: "vibe_control_zapping_audio_transcription",
        applicationId: props.application.id,
        audioSizeBytes: recordedAudioBlob.value?.size ?? 0,
        videoSizeBytes: recordedBlob.value.size,
      });
    }
    saveProgressPhase.value = "summarizing";
    transcriptSummary.value = await summarizeTranscriptWithGemini(
      transcriptText.value
    );
    saveProgressPhase.value = "scanning";
    quickScan.value = await generateQuickScanFromContext({
      frames: frameCaptures.value,
      videoBlob: recordedBlob.value,
      transcriptText: transcriptText.value,
      transcriptSummary: transcriptSummary.value,
    });
    if (quickScan.value?.title && title.value.trim().length === 0) {
      title.value = quickScan.value.title;
    }
  } catch (error) {
    errorMessage.value =
      error instanceof Error
        ? `動画解析に失敗しました: ${error.message}`
        : "動画解析に失敗しました";
    saveProgressPhase.value = "error";
    isExtractingFrames.value = false;
    return;
  }
  isExtractingFrames.value = false;
  saveProgressPhase.value = "uploading";
  const resolvedTitle =
    quickScan.value?.title?.trim() ||
    title.value.trim() ||
    buildFallbackRecordingTitle();
  const resolvedDescription = quickScan.value?.description?.trim() || undefined;
  emit(
    "save",
    {
      applicationId: props.application.id,
      title: resolvedTitle,
      description: resolvedDescription,
      blob: recordedBlob.value,
      durationMs: recordedDurationMs.value ?? elapsedMs.value,
      contentType: recordedBlob.value.type || "video/webm",
      sourceDisplaySurface: sourceDisplaySurface.value,
      quickScan: quickScan.value,
      transcriptText: transcriptText.value || undefined,
      transcriptProvider: transcriptProvider.value || undefined,
      transcriptSummary: transcriptSummary.value || undefined,
      frameCaptures: frameCaptures.value.map((frame) => ({
        timestampMs: frame.timestampMs,
        blob: frame.blob,
        contentType: frame.contentType,
        width: frame.width,
        height: frame.height,
      })),
      tags: [],
    },
    {
      onSuccess: (video) => {
        saveProgressPhase.value = "done";
        selectedVideoId.value = video.id;
        detailVideoId.value = video.id;
        window.setTimeout(() => {
          recordingModalOpen.value = false;
          saveProgressOpen.value = false;
          saveProgressPhase.value = "idle";
          resetRecording();
        }, 650);
      },
      onError: (message) => {
        errorMessage.value = message;
        saveProgressPhase.value = "error";
      },
    }
  );
}

function displayVideoTitle(video: DecodedVibeControlOperationVideo): string {
  return video.quickScan?.title?.trim() || video.title;
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
  video: DecodedVibeControlOperationVideo
): string {
  return video.quickScan?.description?.trim() || video.description || "";
}

function hasQuickScanSummary(
  video: DecodedVibeControlOperationVideo
): boolean {
  return Boolean(
    video.quickScan?.title ||
      video.quickScan?.description ||
      video.quickScan?.operationMemo ||
      video.quickScan?.operationSteps?.length ||
      video.transcriptText ||
      video.transcriptSummary ||
      video.quickScan?.transcriptSummary ||
      video.quickScan?.errorMessage
  );
}

function openQuickScanPreview(video: DecodedVibeControlOperationVideo): void {
  quickScanPreviewVideoId.value = video.id;
}

function quickScanProviderLabel(video: DecodedVibeControlOperationVideo): string {
  return (
    video.quickScan?.provider?.trim() ||
    video.transcriptProvider?.trim() ||
    "scan"
  );
}

function transcriptSummaryText(video: DecodedVibeControlOperationVideo): string {
  return (
    video.transcriptSummary?.trim() ||
    video.quickScan?.transcriptSummary?.trim() ||
    ""
  );
}

function richTranscriptSummarySections(
  video: DecodedVibeControlOperationVideo
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
    const title = stripTranscriptSummaryMarkdown(match[1]);
    const body = stripTranscriptSummaryMarkdown(match[2]);
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

function operationSteps(video: DecodedVibeControlOperationVideo): string[] {
  if (video.quickScan?.operationSteps?.length) {
    return video.quickScan.operationSteps.map((step) => step.trim()).filter(Boolean);
  }
  return (video.quickScan?.operationMemo ?? "")
    .split(/\r?\n/)
    .map((line) => line.replace(/^\s*(?:[-・*]|\d+[.)、])\s*/, "").trim())
    .filter(Boolean);
}

function openDeleteVideoConfirm(video: DecodedVibeControlOperationVideo): void {
  deleteTargetVideoId.value = video.id;
  deleteVideoConfirmOpen.value = true;
}

function deleteConfirmedVideo(): void {
  const videoId = deleteTargetVideoId.value;
  if (!videoId) return;
  deleteVideoConfirmOpen.value = false;
  deleteTargetVideoId.value = "";
  emit("delete", videoId);
}

function analysisResultCount(video: DecodedVibeControlOperationVideo): string {
  const stories = video.analysisResult?.storyCandidates.length ?? 0;
  return `${stories} stories`;
}

function formatEvidenceRange(range: number[]): string {
  const start = range[0] ?? 0;
  const end = range[1] ?? start;
  return `${formatDuration(start * 1000)}-${formatDuration(end * 1000)}`;
}

function videoSegmentUrl(
  video: DecodedVibeControlOperationVideo,
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
  video: DecodedVibeControlOperationVideo,
  evidence: ZappingAnalysisEvidence
): DecodedVibeControlOperationVideo["frameCaptures"] {
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
  video: DecodedVibeControlOperationVideo,
  timestampMs: number,
  maxCount: number
): DecodedVibeControlOperationVideo["frameCaptures"] {
  return [...video.frameCaptures]
    .sort(
      (a, b) =>
        Math.abs(a.timestampMs - timestampMs) - Math.abs(b.timestampMs - timestampMs)
    )
    .slice(0, maxCount)
    .sort((a, b) => a.timestampMs - b.timestampMs);
}

async function extractVideoFrames(
  blob: Blob,
  durationMs: number
): Promise<LocalFrameCapture[]> {
  revokeFramePreviewUrls();
  const sourceUrl = URL.createObjectURL(blob);
  const video = document.createElement("video");
  video.src = sourceUrl;
  video.muted = true;
  video.playsInline = true;
  video.preload = "metadata";

  try {
    await waitForVideoEvent(video, "loadedmetadata");
    const resolvedDurationMs =
      Number.isFinite(video.duration) && video.duration > 0
        ? video.duration * 1000
        : durationMs;
    const captureTimes = buildFrameCaptureTimes(resolvedDurationMs);
    const canvas = document.createElement("canvas");
    const width = Math.max(1, video.videoWidth || 1280);
    const height = Math.max(1, video.videoHeight || 720);
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Canvasを初期化できませんでした");

    const frames: LocalFrameCapture[] = [];
    for (const timestampMs of captureTimes) {
      video.currentTime = Math.min(
        Math.max(0, timestampMs / 1000),
        Math.max(0, (resolvedDurationMs - 200) / 1000)
      );
      await waitForVideoEvent(video, "seeked");
      context.drawImage(video, 0, 0, width, height);
      const frameBlob = await canvasToBlob(canvas, "image/jpeg", 0.78);
      const previewUrl = URL.createObjectURL(frameBlob);
      frames.push({
        id: `frame-${String(frames.length + 1).padStart(3, "0")}`,
        timestampMs,
        blob: frameBlob,
        contentType: frameBlob.type || "image/jpeg",
        width,
        height,
        previewUrl,
      });
    }
    return frames;
  } finally {
    URL.revokeObjectURL(sourceUrl);
  }
}

function buildFrameCaptureTimes(durationMs: number): number[] {
  const safeDuration = Math.max(0, Math.round(durationMs));
  if (safeDuration <= 0) return [0];
  const interval = 5000;
  const maxFrames = 24;
  const times: number[] = [];
  for (let timestamp = 0; timestamp <= safeDuration; timestamp += interval) {
    times.push(timestamp);
    if (times.length >= maxFrames) break;
  }
  if (times.length === 0) times.push(0);
  return times;
}

function waitForVideoEvent(
  video: HTMLVideoElement,
  eventName: "loadedmetadata" | "seeked"
): Promise<void> {
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      video.removeEventListener(eventName, onEvent);
      video.removeEventListener("error", onError);
    };
    const onEvent = () => {
      cleanup();
      resolve();
    };
    const onError = () => {
      cleanup();
      reject(new Error("動画フレームを読み込めませんでした"));
    };
    video.addEventListener(eventName, onEvent, { once: true });
    video.addEventListener("error", onError, { once: true });
  });
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality: number
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error("スクリーンショット画像を生成できませんでした"));
      },
      type,
      quality
    );
  });
}

type AquaTranscriptionResult = {
  text: string;
  provider: string;
  errorMessage?: string;
};

async function transcribeRecordingWithAqua(
  blob: Blob | null
): Promise<AquaTranscriptionResult> {
  if (!blob || blob.size <= 0) {
    return {
      text: "",
      provider: "aqua-voice",
      errorMessage: "文字起こし用のマイク音声が保存されていませんでした",
    };
  }
  if (blob.size > AQUA_AUDIO_MAX_BYTES) {
    return {
      text: "",
      provider: "aqua-voice",
      errorMessage: `マイク音声が大きすぎるためAqua Voice文字起こしをスキップしました (${formatBytes(blob.size)})`,
    };
  }
  try {
    const [{ getApp }, { getFunctions, httpsCallable }] = await Promise.all([
      import("firebase/app"),
      import("firebase/functions"),
    ]);
    const callable = httpsCallable<
      { audioBase64: string; contentType: string; fileName: string },
      {
        ok?: boolean;
        provider?: string;
        model?: string;
        text?: string;
        skipped?: boolean;
        error?: string;
      }
    >(
      getFunctions(getApp(), "asia-northeast1"),
      "transcribe_zapping_video_with_aqua"
    );
    const audioBase64 = await blobToBase64(blob);
    const res = await callable({
      audioBase64,
      contentType: blob.type || "audio/webm",
      fileName: `zapping-audio.${audioExtensionForMime(blob.type)}`,
    });
    const provider = res.data.model
      ? `${res.data.provider || "aqua-voice"}:${res.data.model}`
      : res.data.provider || "aqua-voice";
    if (!res.data.ok || res.data.skipped) {
      return {
        text: "",
        provider,
        errorMessage:
          res.data.error ||
          "Aqua Voice文字起こしは未設定のためスキップされました",
      };
    }
    return {
      text: res.data.text?.trim() || "",
      provider,
    };
  } catch (error) {
    return {
      text: "",
      provider: "aqua-voice",
      errorMessage:
        error instanceof Error
          ? `Aqua Voice文字起こしに失敗しました: ${error.message}`
          : "Aqua Voice文字起こしに失敗しました",
    };
  }
}

async function summarizeTranscriptWithGemini(text: string): Promise<string> {
  const transcript = text.trim();
  if (!transcript) return "";
  try {
    const [{ getApp }, { getAI, getGenerativeModel, VertexAIBackend }] =
      await Promise.all([import("firebase/app"), import("firebase/ai")]);
    const ai = getAI(getApp(), { backend: new VertexAIBackend("us-central1") });
    const model = getGenerativeModel(ai, {
      model: "gemini-2.5-flash-lite",
      generationConfig: {
        temperature: 0.15,
        maxOutputTokens: 512,
      },
    });
    const result = await model.generateContent([
      [
        "以下はプロダクト担当者が操作動画を説明しながら話した文字起こし全文です。",
        "動画解析の補助文脈として使うため、操作意図、確認した対象、期待結果、気づいた差分を日本語で簡潔に要約してください。",
        "",
        transcript.slice(0, 12000),
      ].join("\n"),
    ]);
    return result.response.text().trim();
  } catch {
    return "";
  }
}

async function generateQuickScanFromContext(params: {
  frames: LocalFrameCapture[];
  videoBlob: Blob;
  transcriptText: string;
  transcriptSummary: string;
}): Promise<DecodedVibeControlOperationVideo["quickScan"] | undefined> {
  const { frames, videoBlob, transcriptText, transcriptSummary } = params;
  if (frames.length === 0 && !transcriptText.trim() && !transcriptSummary.trim()) {
    return undefined;
  }
  try {
    const [{ getApp }, { getAI, getGenerativeModel, VertexAIBackend }] =
      await Promise.all([import("firebase/app"), import("firebase/ai")]);
    const ai = getAI(getApp(), { backend: new VertexAIBackend("us-central1") });
    const model = getGenerativeModel(ai, {
      model: "gemini-2.5-flash-lite",
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 900,
        responseMimeType: "application/json",
      },
    });
    const sampled = sampleFramesForQuickScan(frames, 6);
    const imageParts = await Promise.all(
      sampled.map(async (frame) => ({
        inlineData: {
          mimeType: frame.contentType,
          data: await blobToBase64(frame.blob),
        },
      }))
    );
    const videoParts =
      videoBlob.size <= 7 * 1024 * 1024
        ? [
            {
              inlineData: {
                mimeType: videoBlob.type || "video/webm",
                data: await blobToBase64(videoBlob),
              },
            },
          ]
        : [];
    const result = await model.generateContent([
      [
        "VibeControlのザッピング動画を動画解析します。",
        "入力には、動画本体、5秒ごとの操作スクリーンショット、Aqua Voice文字起こし全文、文字起こし要約が含まれます。",
        "これらを総合して、タイトル、説明、操作ステップを日本語で作成してください。",
        "操作ステップは実際の操作順序がわかる短い文の配列にしてください。",
        "JSONだけを返してください。",
        '形式: {"title":"短いタイトル","description":"1文の説明","operationSteps":["操作1","操作2"],"operationMemo":"操作1\\n操作2","transcriptSummary":"文字起こし要約"}',
        "",
        "## Aqua Voice 文字起こし要約",
        transcriptSummary.trim() || "なし",
        "",
        "## Aqua Voice 文字起こし全文",
        transcriptText.trim().slice(0, 14000) || "なし",
      ].join("\n"),
      ...videoParts,
      ...imageParts,
    ]);
    const parsed = parseQuickScanJson(result.response.text());
    return {
      ...parsed,
      transcriptSummary: parsed.transcriptSummary || transcriptSummary || undefined,
      provider: "firebase-ai-vertex",
      generatedAt: new Date().toISOString(),
    };
  } catch (error) {
    reportDatadogError(error, {
      feature: "vibe_control_zapping_quick_scan",
      frameCount: frames.length,
      sampledFrameCount: Math.min(frames.length, 6),
      videoSizeBytes: videoBlob.size,
      transcriptLength: transcriptText.length,
      transcriptSummaryLength: transcriptSummary.length,
      videoIncluded: videoBlob.size <= 7 * 1024 * 1024,
    });
    return {
      provider: "firebase-ai-vertex",
      generatedAt: new Date().toISOString(),
      operationSteps: [],
      errorMessage:
        error instanceof Error ? error.message : "簡易スキャンに失敗しました",
    };
  }
}

function sampleFramesForQuickScan(
  frames: LocalFrameCapture[],
  maxCount: number
): LocalFrameCapture[] {
  if (frames.length <= maxCount) return frames;
  return Array.from({ length: maxCount }, (_, index) => {
    const frameIndex = Math.round((index / (maxCount - 1)) * (frames.length - 1));
    return frames[frameIndex]!;
  });
}

function parseQuickScanJson(
  text: string
): Pick<
  NonNullable<DecodedVibeControlOperationVideo["quickScan"]>,
  "title" | "description" | "operationMemo" | "operationSteps" | "transcriptSummary"
> {
  const normalized = text.trim().replace(/^```json\s*/i, "").replace(/```$/i, "");
  const data = JSON.parse(normalized) as Record<string, unknown>;
  const operationSteps = Array.isArray(data.operationSteps)
    ? data.operationSteps
        .map((item) => (typeof item === "string" ? item.trim() : ""))
        .filter(Boolean)
    : [];
  const operationMemo =
    typeof data.operationMemo === "string"
      ? data.operationMemo.trim()
      : operationSteps.join("\n");
  return {
    title: typeof data.title === "string" ? data.title.trim() : undefined,
    description:
      typeof data.description === "string" ? data.description.trim() : undefined,
    operationMemo: operationMemo || undefined,
    operationSteps,
    transcriptSummary:
      typeof data.transcriptSummary === "string"
        ? data.transcriptSummary.trim()
        : undefined,
  };
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
  videos: DecodedVibeControlOperationVideo[]
): Promise<void> {
  await Promise.all(
    videos.map(async (video) => {
      if (videoUrls[video.id]) return;
      try {
        const storageRef = storageRefForBucketPath({
          bucketName: video.bucketName,
          filePath: video.storagePath,
        });
        videoUrls[video.id] = await getDownloadURL(storageRef);
      } catch {
        videoUrls[video.id] = "";
      }
      await Promise.all(
        (video.frameCaptures ?? []).map(async (frame) => {
          if (!frame.storagePath || !frame.bucketName) return;
          const key = frameKey(video.id, frame.id);
          if (frameUrls[key]) return;
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
      );
    })
  );
}

function frameKey(videoId: string, frameId: string): string {
  return `${videoId}:${frameId}`;
}

function savedFrameUrl(
  video: DecodedVibeControlOperationVideo,
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
): VibeControlOperationVideoDisplaySurface {
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
  value?: VibeControlOperationVideoDisplaySurface
): string {
  if (value === "window") return "Window";
  if (value === "browser") return "Tab";
  if (value === "monitor") return "Screen";
  return "Unknown";
}

function discoveryLabel(
  status: VibeControlOperationVideoDiscoveryStatus
): string {
  if (status === "queued") return "Queued";
  if (status === "completed") return "Indexed";
  if (status === "error") return "Error";
  return "Local";
}

function analysisLabel(status?: VibeControlZappingAnalysisStatus): string {
  if (status === "queued") return "解析待ち";
  if (status === "running") return "解析中";
  if (status === "completed") return "解析済み";
  if (status === "error") return "失敗";
  return "未解析";
}

function analysisColor(
  status?: VibeControlZappingAnalysisStatus
): "neutral" | "success" | "warning" | "error" {
  if (status === "queued" || status === "running") return "warning";
  if (status === "completed") return "success";
  if (status === "error") return "error";
  return "neutral";
}
</script>
