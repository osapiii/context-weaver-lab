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
            操作動画
          </h2>
          <p class="mt-1 text-sm text-slate-500">
            {{ videos.length }}件
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

    <div
      v-if="!detailVideo"
      class="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
    >
      <div>
        <div>
          <p class="text-xs font-bold text-slate-500">動画グループ</p>
          <h3 class="mt-1 text-lg font-bold text-slate-950">
            {{ selectedVideoGroup?.name || "動画グループを作成してください" }}
          </h3>
          <p class="mt-1 text-sm text-slate-500">
            {{ selectedVideoGroup?.description || "操作動画はグループを選んでから録画します。" }}
          </p>
        </div>
      </div>
    </div>

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
                グループ作成や動画の割り振りをまとめて相談できます。
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
              :videos="videos"
              :groups="operationVideoGroups"
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
      :title="appendTargetVideoId ? '動画クリップを追加' : 'ザッピング動画を録画'"
      :subtitle="appendTargetVideoId ? '同じ操作セットに短い録画を追加します。' : 'マイク音声を含めて、操作意図と画面の流れを一緒に残します。'"
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
            保存して次へ
          </EnButton>
        </div>
      </div>
    </EnModal>

    <EnModal
      v-model:open="groupCreateModalOpen"
      title="動画グループを作成"
      subtitle="録画をまとめる単位を先に作成します。"
      title-icon="material-symbols:create-new-folder-outline"
      size="sm"
    >
      <form class="space-y-5" @submit.prevent="submitOperationVideoGroup">
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
            placeholder="このグループで扱う操作動画の目的や範囲"
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
      title="動画グループを削除しますか?"
      subtitle="動画が入っていないグループだけ削除できます。"
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
          このグループには操作動画が登録されています。先に動画を別グループへ移動するか削除してください。
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
      title="ザッピング動画を保存中"
      subtitle="録画データと動画解析メモを保存しています。"
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
        >
          <div class="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div class="flex items-start gap-3">
              <span
                class="flex h-11 w-11 shrink-0 items-center justify-center rounded-full"
                :class="saveProgressPhase === 'error' ? 'bg-red-100 text-red-600' : saveProgressPhase === 'done' ? 'bg-emerald-100 text-emerald-700' : 'bg-white text-cyan-700 shadow-sm ring-1 ring-cyan-100'"
              >
                <UIcon
                  :name="saveProgressPhase === 'error' ? 'material-symbols:error-outline' : saveProgressPhase === 'done' ? 'material-symbols:check-circle-outline' : 'material-symbols:smart-toy-outline'"
                  class="h-6 w-6"
                />
              </span>
              <div class="min-w-0">
                <p class="text-base font-bold text-slate-950">
                  {{ saveProgressTitle }}
                </p>
                <p class="mt-1 text-sm leading-relaxed text-slate-600">
                  {{ saveProgressDescription }}
                </p>
              </div>
            </div>
            <div class="min-w-[180px] rounded-lg bg-white/80 p-3 ring-1 ring-white">
              <div class="flex items-center justify-between text-[11px] font-bold uppercase tracking-wide text-slate-400">
                <span>理解中</span>
                <span>{{ saveProgressCompletion }}%</span>
              </div>
              <div class="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
                <div
                  class="h-full rounded-full bg-cyan-500 transition-all duration-500"
                  :style="{ width: `${saveProgressCompletion}%` }"
                />
              </div>
            </div>
          </div>
        </div>

        <div class="grid gap-5 2xl:grid-cols-[minmax(390px,0.78fr)_minmax(680px,1.22fr)]">
          <ol class="space-y-2">
            <li
              v-for="step in saveProgressSteps"
              :key="step.key"
              class="flex items-start gap-3 rounded-xl border bg-white px-3 py-3 transition"
              :class="step.status === 'active' ? 'border-cyan-200 shadow-sm shadow-cyan-100' : step.status === 'done' ? 'border-emerald-100' : step.status === 'error' ? 'border-red-200 bg-red-50' : 'border-slate-200'"
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
                    name="material-symbols:smart-toy-outline"
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
              <span class="rounded-full bg-cyan-50 px-2.5 py-1 text-[11px] font-bold text-cyan-700">
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
      title="動画解析メモ"
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

    <EnModal
      v-model:open="deleteClipConfirmOpen"
      title="動画クリップを削除しますか?"
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
          削除後、このVIDの解析結果は未解析状態に戻ります。必要であれば再解析してください。
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
                動画から生まれた文字起こし、画面証跡、ユーザーストーリー、関連ナレッジをひとつの構造として表示します。
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
      <div class="mb-4 flex flex-wrap items-start justify-between gap-4">
        <div class="flex min-w-0 items-start gap-3">
          <EnButton
            variant="ghost"
            color="neutral"
            size="xs"
            leading-icon="material-symbols:arrow-back"
            class="mt-1"
            @click="detailVideoId = ''"
          >
            一覧へ戻る
          </EnButton>
          <div class="min-w-0">
            <div class="flex min-w-0 flex-wrap items-center gap-3">
              <span class="inline-flex shrink-0 items-center rounded-md bg-slate-950 px-2 py-1 text-xs font-semibold text-white">
                {{ videoDisplayId(detailVideo) }}
              </span>
              <input
                v-if="editingVideoTitleId === detailVideo.id"
                ref="videoTitleInput"
                v-model="editingVideoTitleDraft"
                type="text"
                class="min-w-[18rem] max-w-full rounded-md border border-slate-300 bg-white px-2 py-1 text-[28px] font-bold leading-tight tracking-normal text-slate-950 outline-none transition focus:border-slate-900 focus:ring-2 focus:ring-slate-200"
                :disabled="updatingVideoTitleId === detailVideo.id"
                @blur="commitVideoTitleEdit(detailVideo)"
                @keydown.enter.prevent="commitVideoTitleEdit(detailVideo)"
                @keydown.esc.prevent="cancelVideoTitleEdit"
              >
              <button
                v-else
                type="button"
                class="group/title min-w-0 rounded-md px-1 py-0.5 text-left transition hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-slate-200"
                title="タイトルを編集"
                @click="startVideoTitleEdit(detailVideo)"
              >
                <span class="inline-flex min-w-0 items-center gap-2">
                  <span class="min-w-0 text-[28px] font-bold leading-tight tracking-normal text-slate-950 group-hover/title:text-slate-800">
                    {{ displayVideoTitle(detailVideo) }}
                  </span>
                  <UIcon
                    name="material-symbols:edit-outline"
                    class="h-4 w-4 shrink-0 text-slate-400 opacity-0 transition group-hover/title:opacity-100"
                  />
                </span>
              </button>
              <StoryVaultAnalysisStatusTip :status="detailVideo.analysisStatus" />
              <EnButton
                variant="soft"
                color="info"
                size="xs"
                leading-icon="material-symbols:hub-outline"
                @click="openContextMap(detailVideo)"
              >
                コンテキストマップ
              </EnButton>
            </div>
          </div>
        </div>
        <div class="flex flex-wrap items-center gap-2">
          <EnBadge
            v-if="detailVideo.hasUnanalyzedClip"
            color="warning"
            variant="soft"
          >
            追加あり
          </EnBadge>
          <EnButton
            v-if="canResumeVideoWorkflow(detailVideo)"
            variant="ai"
            size="xs"
            leading-icon="material-symbols:resume-outline"
            :loading="isWorkflowRunningFor(detailVideo)"
            :disabled="props.isSaving || detailVideo.analysisStatus === 'queued' || detailVideo.analysisStatus === 'running'"
            @click="resumeVideoWorkflow(detailVideo)"
          >
            解析を続きから再開
          </EnButton>
          <EnButton
            variant="outline"
            color="neutral"
            size="xs"
            leading-icon="material-symbols:add-photo-alternate-outline"
            :disabled="props.isSaving"
            @click="openAppendRecordingModal(detailVideo)"
          >
            動画を追加
          </EnButton>
          <EnButton
            variant="soft"
            color="error"
            size="xs"
            leading-icon="material-symbols:delete-outline"
            :disabled="props.isSaving"
            @click="openVideoDeleteConfirm(detailVideo)"
          >
            動画を削除
          </EnButton>
          <EnButton
            variant="ai"
            size="xs"
            leading-icon="material-symbols:psychology-outline"
            :loading="isAnalyzing && detailVideo.analysisStatus === 'running'"
            :disabled="!application?.fileSpaceId || detailVideo.analysisStatus === 'queued' || detailVideo.analysisStatus === 'running'"
            @click="$emit('analyze', detailVideo.id)"
          >
            {{ detailVideo.hasUnanalyzedClip ? "まとめて再解析" : "解析を実行" }}
          </EnButton>
        </div>
      </div>

      <div
        v-if="detailVideo.hasUnanalyzedClip"
        class="mb-5 flex flex-col gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 shadow-sm sm:flex-row sm:items-center sm:justify-between"
      >
        <div class="flex min-w-0 items-start gap-3">
          <span class="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-700 ring-1 ring-amber-200">
            <UIcon name="material-symbols:sync-problem-outline" class="h-4 w-4" />
          </span>
          <div class="min-w-0">
            <p class="text-sm font-bold text-slate-950">
              追加されたクリップがあります
            </p>
            <p class="mt-1 text-xs leading-relaxed text-slate-600">
              {{ detailVideo.analysisStaleReason || "まとめて再解析すると最新の操作セットに反映されます。" }}
            </p>
          </div>
        </div>
        <EnButton
          variant="outline"
          color="neutral"
          size="xs"
          leading-icon="material-symbols:psychology-outline"
          :loading="isAnalyzing && detailVideo.analysisStatus === 'running'"
          :disabled="!application?.fileSpaceId || detailVideo.analysisStatus === 'queued' || detailVideo.analysisStatus === 'running'"
          @click="$emit('analyze', detailVideo.id)"
        >
          まとめて再解析
        </EnButton>
      </div>

      <div class="mb-5 rounded-xl border border-slate-200 bg-white p-1.5 shadow-sm">
        <div class="grid gap-1 sm:grid-cols-2 lg:grid-cols-7">
          <button
            type="button"
            class="flex min-h-[44px] items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold transition"
            :class="detailTab === 'video' ? 'bg-slate-950 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'"
            @click="detailTab = 'video'"
          >
            <UIcon name="material-symbols:play-circle-outline" class="h-4 w-4 shrink-0" />
            <span>動画</span>
            <span
              class="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold"
              :class="detailTab === 'video' ? 'bg-white/15 text-white' : 'bg-slate-100 text-slate-600'"
            >
              {{ videoDisplayId(detailVideo) }}
            </span>
          </button>
          <button
            type="button"
            class="flex min-h-[44px] items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold transition"
            :class="detailTab === 'videoAnalysis' ? 'bg-slate-950 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'"
            @click="detailTab = 'videoAnalysis'"
          >
            <UIcon
              :name="isVideoAnalysisCompleted(detailVideo) ? 'material-symbols:check-circle-outline' : 'material-symbols:auto-awesome-outline'"
              class="h-4 w-4 shrink-0"
            />
            <span>動画解析</span>
            <span
              class="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold"
              :class="detailTab === 'videoAnalysis' ? 'bg-white/15 text-white' : isVideoAnalysisCompleted(detailVideo) ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200' : 'bg-slate-100 text-slate-600'"
            >
              {{ videoAnalysisTabStatus(detailVideo) }}
            </span>
          </button>
          <button
            type="button"
            class="flex min-h-[44px] items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold transition"
            :class="detailTab === 'storyAnalysis' ? 'bg-slate-950 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'"
            @click="detailTab = 'storyAnalysis'"
          >
            <UIcon name="material-symbols:sticky-note-2-outline" class="h-4 w-4 shrink-0" />
            <span>ストーリー解析</span>
            <span
              class="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold"
              :class="detailTab === 'storyAnalysis' ? 'bg-white/15 text-white' : storyCandidateCount(detailVideo) > 0 ? 'bg-slate-100 text-slate-700' : 'bg-slate-100 text-slate-600'"
            >
              {{ storyCandidateCount(detailVideo) }}件
            </span>
          </button>
          <button
            type="button"
            class="flex min-h-[44px] items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold transition"
            :class="detailTab === 'videoGeneration' ? 'bg-slate-950 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'"
            @click="detailTab = 'videoGeneration'"
          >
            <UIcon name="material-symbols:movie-edit-outline" class="h-4 w-4 shrink-0" />
            <span>動画生成</span>
            <span
              class="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold"
              :class="detailTab === 'videoGeneration' ? 'bg-white/15 text-white' : 'bg-slate-100 text-slate-700'"
            >
              音声 / 字幕
            </span>
          </button>
          <button
            type="button"
            class="flex min-h-[44px] items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold transition"
            :class="detailTab === 'relatedContext' ? 'bg-slate-950 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'"
            @click="openRelatedContextTab"
          >
            <UIcon name="material-symbols:hub-outline" class="h-4 w-4 shrink-0" />
            <span>関連コンテキスト</span>
            <span
              class="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold"
              :class="detailTab === 'relatedContext' ? 'bg-white/15 text-white' : relatedContextCount(detailVideo) > 0 ? 'bg-slate-200 text-slate-800' : 'bg-slate-100 text-slate-600'"
            >
              {{ relatedContextCount(detailVideo) }}件
            </span>
          </button>
          <button
            type="button"
            class="flex min-h-[44px] items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold transition"
            :class="detailTab === 'report' ? 'bg-slate-950 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'"
            @click="detailTab = 'report'"
          >
            <UIcon name="material-symbols:preview-outline" class="h-4 w-4 shrink-0" />
            <span>レポート</span>
            <span
              class="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold"
              :class="detailTab === 'report' ? 'bg-white/15 text-white' : 'bg-slate-100 text-slate-700'"
            >
              HTML / MD
            </span>
          </button>
          <button
            type="button"
            class="flex min-h-[44px] items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold transition"
            :class="detailTab === 'mcpTest' ? 'bg-slate-950 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'"
            @click="detailTab = 'mcpTest'"
          >
            <UIcon name="material-symbols:terminal" class="h-4 w-4 shrink-0" />
            <span>MCPテスト</span>
            <span
              class="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold"
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
        <div
          class="grid gap-4"
          :class="clipNavigatorCollapsed ? 'xl:grid-cols-[92px_minmax(0,1fr)]' : 'xl:grid-cols-[340px_minmax(0,1fr)]'"
        >
          <aside class="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div class="flex items-center justify-between gap-2 border-b border-slate-100 p-3">
              <div
                v-if="!clipNavigatorCollapsed"
                class="min-w-0"
              >
                <h4 class="flex items-center gap-2 text-sm font-bold text-slate-950">
                  <UIcon name="material-symbols:video-library-outline" class="h-4 w-4 text-slate-500" />
                  動画クリップ
                </h4>
                <p class="mt-1 truncate text-xs text-slate-500">
                  {{ videoClipCount(detailVideo) }}本 / {{ formatDuration(videoTotalDurationMs(detailVideo)) }}
                </p>
              </div>
              <EnButton
                variant="ghost"
                color="neutral"
                size="xs"
                :leading-icon="clipNavigatorCollapsed ? 'material-symbols:keyboard-double-arrow-right' : 'material-symbols:keyboard-double-arrow-left'"
                @click="clipNavigatorCollapsed = !clipNavigatorCollapsed"
              >
                <span class="sr-only">{{ clipNavigatorCollapsed ? "クリップ一覧を開く" : "クリップ一覧を閉じる" }}</span>
              </EnButton>
            </div>

            <div class="max-h-[calc(100vh-18rem)] space-y-2 overflow-auto p-2">
              <article
                v-for="(clip, clipIndex) in detailVideoClips"
                :key="clip.id"
                role="button"
                tabindex="0"
                class="group w-full rounded-xl border text-left transition"
                :class="selectedDetailClip?.id === clip.id ? 'border-slate-950 bg-slate-950 text-white shadow-sm' : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'"
                @click="selectedClipId = clip.id"
                @keydown.enter.prevent="selectedClipId = clip.id"
                @keydown.space.prevent="selectedClipId = clip.id"
              >
                <div
                  class="grid gap-2 p-2"
                  :class="clipNavigatorCollapsed ? 'grid-cols-1' : 'grid-cols-[96px_minmax(0,1fr)]'"
                >
                  <div class="relative overflow-hidden rounded-lg bg-slate-900">
                    <img
                      v-if="clipThumbnailUrl(detailVideo, clip)"
                      :src="clipThumbnailUrl(detailVideo, clip)"
                      class="aspect-video w-full object-cover"
                      :alt="`${clip.fileName} のサムネイル`"
                    >
                    <div
                      v-else
                      class="flex aspect-video w-full items-center justify-center text-slate-300"
                    >
                      <UIcon name="material-symbols:movie-outline" class="h-5 w-5" />
                    </div>
                    <span class="absolute left-1.5 top-1.5 rounded bg-black/65 px-1.5 py-0.5 text-[10px] font-bold text-white">
                      {{ clipIndex + 1 }}
                    </span>
                    <button
                      v-if="clipNavigatorCollapsed"
                      type="button"
                      class="absolute right-1.5 top-1.5 inline-flex h-7 w-7 items-center justify-center rounded-lg bg-black/55 text-white transition hover:bg-red-500"
                      title="このクリップを削除"
                      @click.stop="openClipDeleteConfirm(detailVideo, clip)"
                    >
                      <UIcon name="material-symbols:delete-outline" class="h-4 w-4" />
                    </button>
                  </div>

                  <div
                    v-if="!clipNavigatorCollapsed"
                    class="min-w-0 py-0.5"
                  >
                    <div class="flex items-center justify-between gap-2">
                      <p class="min-w-0 truncate text-xs font-bold" :class="selectedDetailClip?.id === clip.id ? 'text-white' : 'text-slate-950'">
                        {{ clipTitle(clip, clipIndex) }}
                      </p>
                      <div class="flex shrink-0 items-center gap-1">
                        <EnBadge
                          v-if="clipIndex === 0"
                          color="neutral"
                          variant="soft"
                        >
                          メイン
                        </EnBadge>
                        <button
                          type="button"
                          class="inline-flex h-7 w-7 items-center justify-center rounded-lg transition"
                          :class="selectedDetailClip?.id === clip.id ? 'text-slate-300 hover:bg-white/10 hover:text-white' : 'text-slate-400 hover:bg-red-50 hover:text-red-600'"
                          title="このクリップを削除"
                          @click.stop="openClipDeleteConfirm(detailVideo, clip)"
                        >
                          <UIcon name="material-symbols:delete-outline" class="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                    <p class="mt-1 truncate text-[11px]" :class="selectedDetailClip?.id === clip.id ? 'text-slate-300' : 'text-slate-500'">
                      {{ formatRecordedAt(clip.recordedAt) }}
                    </p>
                    <div class="mt-2 flex flex-wrap gap-1 text-[10px] font-bold" :class="selectedDetailClip?.id === clip.id ? 'text-slate-200' : 'text-slate-500'">
                      <span>{{ formatDuration(clip.durationMs) }}</span>
                      <span>{{ clip.frameCaptures.length }}枚</span>
                      <span>{{ formatBytes(clip.sizeBytes) }}</span>
                    </div>
                  </div>
                </div>
              </article>
            </div>
          </aside>

          <section
            v-if="selectedDetailClip"
            class="min-w-0 space-y-4"
          >
            <div class="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <header class="border-b border-slate-100 bg-white p-4">
                <div class="flex flex-wrap items-start justify-between gap-4">
                  <div class="min-w-0 flex-1">
                    <p class="text-xs font-bold uppercase tracking-wide text-slate-500">
                      選択中のクリップ
                    </p>
                    <h4 class="mt-1 text-xl font-black leading-tight text-slate-950">
                      {{ clipTitle(selectedDetailClip, selectedDetailClipIndex) }}
                    </h4>
                    <p class="mt-1 truncate text-xs font-semibold text-slate-500">
                      {{ selectedDetailClip.fileName }}
                    </p>
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
                    {{ selectedDetailClip.quickScan?.description || selectedDetailClip.quickScan?.operationMemo || detailVideo.analysisResult?.operationIntent || detailVideo.quickScan?.description || "未生成" }}
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
                      動画URLを取得中
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
                  動画解析ノート
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
              <div class="mt-3 grid gap-3 md:grid-cols-3">
                <div
                  v-for="section in richTranscriptSummarySections(detailVideo).slice(0, 3)"
                  :key="`${detailVideo.id}-detail-summary-${section.title}`"
                  class="rounded-2xl border border-slate-200 bg-white p-3"
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
                class="max-h-[420px] space-y-2 overflow-auto rounded-2xl border border-slate-100 bg-slate-50 p-3"
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
                class="max-h-[420px] overflow-auto whitespace-pre-line rounded-2xl border border-slate-100 bg-slate-50 p-4 text-sm leading-7 text-slate-700"
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
        class="space-y-3"
      >
        <section class="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div class="mb-3 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h4 class="flex items-center gap-2 text-base font-bold text-slate-950">
                <UIcon name="material-symbols:preview-outline" class="h-4 w-4 text-slate-500" />
                操作動画 Bundle レポート
              </h4>
              <p class="mt-1 text-sm leading-6 text-slate-600">
                1つの操作動画に紐づくユーザーストーリー候補、証跡、スクリーンショットをまとめて確認できます
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
                variant="outline"
                color="neutral"
                size="xs"
                :leading-icon="reportCopied ? 'material-symbols:check' : 'material-symbols:content-copy-outline'"
                @click="copyReportBody"
              >
                {{ reportCopied ? "コピー済み" : "本文をコピー" }}
              </EnButton>
              <EnButton
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
          class="h-[min(780px,calc(100vh-250px))] min-h-[560px] w-full rounded-2xl border border-slate-200 bg-white shadow-sm"
        />
        <textarea
          v-else
          :value="reportBody"
          readonly
          class="h-[min(780px,calc(100vh-250px))] min-h-[560px] w-full rounded-2xl border border-slate-200 bg-slate-950 p-4 font-mono text-xs leading-relaxed text-slate-100 shadow-sm"
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
                  左の付箋を選ぶと、詳しい内容と根拠の動画が表示されます
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

                  <div class="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                    <div class="mb-3 flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p class="flex items-center gap-2 text-base font-bold text-slate-950">
                          <UIcon name="material-symbols:movie-filter-outline" class="h-4 w-4 text-slate-500" />
                          根拠になった動画の場面
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
                              {{ item.title || `動画セグメント ${evidenceIndex + 1}` }}
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
        <aside class="rounded-3xl border border-slate-200 bg-white p-3 shadow-sm xl:sticky xl:top-4 xl:self-start">
          <div class="mb-3 px-2">
            <p class="text-xs font-bold uppercase tracking-wide text-slate-400">
              Context Tools
            </p>
            <p class="mt-1 text-xs leading-5 text-slate-500">
              取得元を選ぶと右側に結果を表示します
            </p>
          </div>
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
              :class="relatedContextProviderTab === 'slack' ? 'bg-slate-950 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-950'"
              @click="relatedContextProviderTab = 'slack'"
            >
              <span
                class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
                :class="relatedContextProviderTab === 'slack' ? 'bg-white/10' : 'bg-slate-100'"
              >
                <UIcon name="i-simple-icons-slack" class="h-4 w-4" />
              </span>
              <span class="min-w-0 flex-1">
                <span class="block text-sm font-bold">Slack</span>
                <span
                  class="mt-0.5 block truncate text-xs"
                  :class="relatedContextProviderTab === 'slack' ? 'text-slate-300' : 'text-slate-500'"
                >
                  会話とスレッド
                </span>
              </span>
              <span
                class="inline-flex min-w-6 shrink-0 items-center justify-center rounded-full px-2 py-0.5 text-[10px] font-semibold"
                :class="relatedContextProviderTab === 'slack' ? 'bg-white/15 text-white' : 'bg-slate-100 text-slate-700'"
              >
                {{ relatedSlackMessageCount(detailVideo) }}
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
                0
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
              {{ detailVideo.relatedContexts?.knowledge ? "ナレッジ再取得" : "ナレッジ取得" }}
            </EnButton>
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
                    Search Store、動画解析、Story候補、投入ファイルのメタデータを照合中
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
            v-else-if="!isRelatedContextProviderRunning(detailVideo, 'knowledge') && !detailVideo.relatedContexts?.knowledge"
            class="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-500"
          >
            ナレッジ取得を実行すると、操作動画に関連する投入ファイルや設計書がここに表示されます
          </div>

          <div v-else-if="detailVideo.relatedContexts?.knowledge" class="space-y-4">
            <div class="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
              <span>{{ detailVideo.relatedContexts.knowledge.fileSpaceId }}</span>
              <span>{{ formatRecordedAt(detailVideo.relatedContexts.knowledge.checkedAt) }}</span>
            </div>

            <div
              v-if="detailVideo.relatedContexts.knowledge.documents.length === 0"
              class="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-500"
            >
              関連するナレッジファイルは見つかりませんでした
            </div>

            <div v-else class="grid gap-3 md:grid-cols-3 2xl:grid-cols-4">
              <article
                v-for="doc in detailVideo.relatedContexts.knowledge.documents"
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
                <UIcon name="material-symbols:confirmation-number-outline" class="h-4 w-4 text-slate-500" />
                Jira チケット
              </h4>
              <p class="mt-1 text-xs text-slate-500">
                チケット管理ツールの関連Issueを表示する枠です
              </p>
            </div>
            <EnBadge color="neutral" variant="soft">
              準備中
            </EnBadge>
          </div>

          <div class="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-500">
            Jira連携を追加すると、操作動画に関連するIssue、要件、ステータス、担当者がここに表示されます
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
                {{ application?.repoFullName || "Repository未設定" }}
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
              {{ detailVideo.relatedContexts?.github ? "PR一覧を再取得" : "PR一覧を取得" }}
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
                    動画メモ、Story候補、PR本文、ラベル、変更ファイルを照合中
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
            v-if="!isRelatedContextProviderRunning(detailVideo, 'github') && !detailVideo.relatedContexts?.github"
            class="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-500"
          >
            GitHub PRを取得すると、操作動画に関連するPRと理由がここに表示されます
          </div>

          <div v-else-if="detailVideo.relatedContexts?.github" class="space-y-4">
            <div class="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
              <span>{{ detailVideo.relatedContexts.github.repoFullName }}</span>
              <span>{{ formatRecordedAt(detailVideo.relatedContexts.github.checkedAt) }}</span>
            </div>

            <div
              v-if="detailVideo.relatedContexts.github.pullRequests.length === 0"
              class="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-500"
            >
              関連するPRは見つかりませんでした
            </div>

            <div v-else class="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
              <article
                v-for="pr in detailVideo.relatedContexts.github.pullRequests"
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
                    動画メモ、Story候補、投稿本文、チャンネル、スレッドを照合中
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
            v-if="!isRelatedContextProviderRunning(detailVideo, 'slack') && !detailVideo.relatedContexts?.slack"
            class="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-500"
          >
            Slack会話を取得すると、操作動画に関連する投稿と理由がここに表示されます
          </div>

          <div v-else-if="detailVideo.relatedContexts?.slack" class="space-y-4">
            <div class="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
              <span>{{ detailVideo.relatedContexts.slack.teamName || detailVideo.relatedContexts.slack.teamId || "Slack" }}</span>
              <span>{{ formatRecordedAt(detailVideo.relatedContexts.slack.checkedAt) }}</span>
            </div>

            <div
              v-if="detailVideo.relatedContexts.slack.messages.length === 0"
              class="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-500"
            >
              関連するSlack会話は見つかりませんでした
            </div>

            <div v-else class="space-y-3">
              <article
                v-for="message in detailVideo.relatedContexts.slack.messages"
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
        v-if="operationVideoGroups.length === 0"
        class="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500"
      >
        最初に動画グループを作成してください。グループを選ぶと新規録画を開始できます。
        <div class="mt-3">
          <EnButton
            variant="ai"
            size="sm"
            leading-icon="material-symbols:create-new-folder-outline"
            :disabled="!application"
            @click="openGroupCreateModal"
          >
            動画グループを作成
          </EnButton>
        </div>
      </div>

      <div
        v-else
        class="grid gap-4 xl:grid-cols-[18rem_minmax(0,1fr)]"
      >
        <aside class="rounded-lg border border-slate-200 bg-white p-2 shadow-sm">
          <div
            v-for="group in operationVideoGroups"
            :key="group.id"
            class="group mb-1 flex items-start gap-2 rounded-md pr-2 transition"
            :class="selectedVideoGroupId === group.id ? 'bg-slate-100 text-slate-950 shadow-sm ring-1 ring-slate-300' : 'text-slate-600 hover:bg-slate-50'"
          >
            <button
              type="button"
              class="grid min-w-0 flex-1 gap-1 rounded-md px-3 py-2 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-300"
              @click="selectedVideoGroupId = group.id"
            >
              <span class="truncate text-sm font-bold">{{ group.name }}</span>
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
                {{ groupVideoCount(group.id) }}件
              </span>
            </button>
            <button
              type="button"
              class="mt-2 grid h-8 w-8 shrink-0 place-items-center rounded-md text-slate-400 opacity-0 transition hover:bg-red-50 hover:text-red-600 focus:opacity-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-200 group-hover:opacity-100 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-slate-300"
              :class="groupVideoCount(group.id) > 0 ? 'text-slate-300' : ''"
              :disabled="groupVideoCount(group.id) > 0"
              :title="groupVideoCount(group.id) > 0 ? '動画があるグループは削除できません' : '動画グループを削除'"
              aria-label="動画グループを削除"
              @click.stop="openGroupDeleteConfirm(group)"
            >
              <UIcon
                name="material-symbols:delete-outline"
                class="h-4 w-4"
              />
            </button>
          </div>
        </aside>

        <div
          v-if="selectedGroupVideos.length === 0"
          class="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500"
        >
          このグループにはまだ操作動画がありません。新規録画を開始してください。
        </div>

        <div
          v-else-if="filteredVideos.length === 0"
          class="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500"
        >
          条件に合うザッピング動画はありません
        </div>

        <div
          v-else
          class="grid gap-4 md:grid-cols-2 2xl:grid-cols-3"
        >
          <article
            v-for="video in filteredVideos"
            :key="video.id"
            class="group cursor-pointer overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:border-slate-400 hover:shadow-md focus-within:border-slate-900 focus-within:ring-2 focus-within:ring-slate-200"
            tabindex="0"
            role="button"
            @click="openVideoDetail(video)"
            @keydown.enter.prevent="openVideoDetail(video)"
            @keydown.space.prevent="openVideoDetail(video)"
          >
            <div class="relative bg-slate-950">
              <video
                v-if="videoUrls[video.id]"
                :src="videoUrls[video.id]"
                preload="metadata"
                muted
                playsinline
                class="aspect-video w-full bg-slate-950 object-contain"
              />
              <div
                v-else
                class="flex aspect-video w-full items-center justify-center bg-slate-950 text-xs text-slate-300"
              >
                動画URLを取得中
              </div>
              <div class="absolute left-3 top-3 flex flex-wrap gap-1">
                <EnBadge
                  :color="analysisColor(video.analysisStatus)"
                  variant="soft"
                >
                  {{ analysisLabel(video.analysisStatus) }}
                </EnBadge>
                <EnBadge
                  v-if="video.hasUnanalyzedClip"
                  color="warning"
                  variant="soft"
                >
                  再解析推奨
                </EnBadge>
              </div>
            </div>

            <div class="space-y-3 p-4">
              <div class="flex min-w-0 items-start gap-2">
                <span class="mt-0.5 inline-flex shrink-0 items-center rounded-md bg-slate-950 px-2 py-1 text-xs font-semibold text-white shadow-sm">
                  {{ videoDisplayId(video) }}
                </span>
                <div class="min-w-0">
                  <h4 class="line-clamp-2 text-base font-bold leading-snug text-slate-950 group-hover:text-slate-700">
                  {{ displayVideoTitle(video) }}
                  </h4>
                  <p class="mt-1 text-xs text-slate-500">
                    {{ formatRecordedAt(video.recordedAt) }}
                  </p>
                </div>
              </div>

              <p
                v-if="displayVideoDescription(video)"
                class="line-clamp-2 text-xs leading-relaxed text-slate-600"
              >
                {{ displayVideoDescription(video) }}
              </p>

              <div class="grid grid-cols-2 gap-2">
                <div class="rounded-md bg-slate-50 px-3 py-2">
                  <p class="text-[11px] font-semibold text-slate-500">
                    User Story
                  </p>
                  <p class="mt-1 text-sm font-semibold text-slate-900">
                    {{ storyCandidateCount(video) }}
                  </p>
                </div>
                <div class="rounded-md bg-slate-50 px-3 py-2">
                  <p class="text-[11px] font-semibold text-slate-500">
                    Context
                  </p>
                  <p class="mt-1 text-sm font-semibold text-slate-900">
                    {{ relatedContextCount(video) }}
                  </p>
                </div>
              </div>

              <div class="flex flex-wrap gap-2 text-[11px] text-slate-500">
                <span>クリップ {{ videoClipCount(video) }}本</span>
                <span>{{ formatDuration(videoTotalDurationMs(video)) }}</span>
                <span>{{ formatBytes(videoTotalSizeBytes(video)) }}</span>
                <span>{{ displaySurfaceLabel(video.sourceDisplaySurface) }}</span>
                <span>{{ discoveryLabel(video.discoveryStatus) }}</span>
              </div>
            </div>
          </article>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, reactive, ref, watch } from "vue";
import type { ComponentPublicInstance } from "vue";
import { getBlob, getDownloadURL } from "firebase/storage";
import { storageRefForBucketPath } from "@composables/firebase-storage-operations";
import { reportDatadogError } from "@utils/datadogObservability";
import { formatUserStoryKey } from "@utils/storyVaultStoryKeys";
import {
  formatTranscriptTime,
  normalizeTranscriptCues,
  parseSrtTranscript,
  transcriptCuesToSrt,
} from "@utils/transcriptTiming";
import KnowledgeDocumentCompactCard from "@components/knowledge/KnowledgeDocumentCompactCard.vue";
import type {
  DecodedStoryVaultApplication,
  DecodedStoryVaultOperationVideo,
  DecodedStoryVaultOperationVideoGroup,
  StoryVaultRelatedContextKnowledgeDocument,
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
  StoryVaultOperationVideoClipAnalysisInput,
  StoryVaultOperationVideoAppendInput,
  StoryVaultOperationVideoSaveInput,
} from "@stores/storyVault";

type OperationVideoSaveCallbacks = {
  onSuccess?: (video: DecodedStoryVaultOperationVideo) => void;
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

type OperationVideoGroupAssistantPlanGroup = {
  existingGroupId?: string;
  name: string;
  description?: string;
  videoIds: string[];
  reason?: string;
};

type OperationVideoGroupAssistantPlan = {
  summary: string;
  groups: OperationVideoGroupAssistantPlanGroup[];
};

type OperationVideoOrganizationCallbacks = {
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
  | "saving"
  | "extracting"
  | "transcribing"
  | "summarizing"
  | "scanning"
  | "analysisSaving"
  | "storyQueued"
  | "storyRunning"
  | "uploading"
  | "done"
  | "error";

type SaveWorkflowStep = "save" | "videoAnalysis" | "storyAnalysis";

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
type ReportMode = "html" | "markdown" | "json";
type RelatedContextProviderTab = "knowledge" | "github" | "slack" | "jira";
type SelectedClipContentTab = "transcript" | "summary";
type SelectedClipLayoutMode = "split" | "stack";

type RichTranscriptSummarySection = {
  title: string;
  body: string;
};

type ZappingAnalysisEvidence =
  StoryVaultZappingAnalysisStoryCandidate["evidence"][number];
type TranscriptOwner = Pick<
  DecodedStoryVaultOperationVideo,
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

type ContextMapNodePosition = {
  x: number;
  y: number;
};

type ContextMapDragState = {
  nodeId: string;
  moved: boolean;
};

declare global {
  interface Window {
    webkitAudioContext?: typeof AudioContext;
  }
}

const props = defineProps<{
  application: DecodedStoryVaultApplication | null;
  videos: DecodedStoryVaultOperationVideo[];
  operationVideoGroups: DecodedStoryVaultOperationVideoGroup[];
  isSaving: boolean;
  isAnalyzing?: boolean;
  isFetchingRelatedContexts?: boolean;
  isProvisioningFileSpace?: boolean;
}>();

const emit = defineEmits<{
  save: [
    input: StoryVaultOperationVideoSaveInput,
    callbacks?: OperationVideoSaveCallbacks,
  ];
  "append-clip": [
    input: StoryVaultOperationVideoAppendInput,
    callbacks?: OperationVideoSaveCallbacks,
  ];
  "update-clip-analysis": [
    input: StoryVaultOperationVideoClipAnalysisInput,
    callbacks?: OperationVideoSaveCallbacks,
  ];
  analyze: [
    videoId: string,
    options?: OperationVideoAnalyzeOptions,
    callbacks?: OperationVideoAnalyzeCallbacks,
  ];
  "update-title": [
    videoId: string,
    title: string,
    callbacks?: OperationVideoTitleUpdateCallbacks,
  ];
  "fetch-related-context": [videoId: string, provider: "github" | "slack" | "knowledge"];
  "create-group": [input: { applicationId: string; name: string; description?: string }];
  "update-group": [input: { groupId: string; name: string; description?: string }];
  "delete-group": [groupId: string];
  "delete-clip": [videoId: string, clipId: string];
  "apply-organization-plan": [
    plan: OperationVideoGroupAssistantPlan,
    callbacks?: OperationVideoOrganizationCallbacks,
  ];
  "create-file-space": [];
  delete: [videoId: string];
  refresh: [];
}>();

const title = ref("");
const errorMessage = ref("");
const sourceDisplaySurface = ref<StoryVaultOperationVideoDisplaySurface>("unknown");
const isRecording = ref(false);
const recordingModalOpen = ref(false);
const assistantPanelOpen = ref(false);
const appendTargetVideoId = ref("");
const elapsedMs = ref(0);
const recordedDurationMs = ref<number | undefined>();
const recordedBlob = ref<Blob | null>(null);
const recordedAudioBlob = ref<Blob | null>(null);
const previewUrl = ref("");
const livePreviewVideo = ref<HTMLVideoElement | null>(null);
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
const quickScan = ref<DecodedStoryVaultOperationVideo["quickScan"]>();
const transcriptText = ref("");
const transcriptProvider = ref("");
const transcriptSummary = ref("");
const transcriptSegments = ref<StoryVaultTranscriptCue[]>([]);
const transcriptSrt = ref("");
const transcriptTimingStatus = ref<StoryVaultTranscriptTimingStatus>("unavailable");
const transcriptErrorMessage = ref("");
const saveProgressOpen = ref(false);
const saveProgressPhase = ref<SaveProgressPhase>("idle");
const saveWorkflowStep = ref<SaveWorkflowStep>("save");
const workflowVideoId = ref("");
const workflowClipId = ref("");
const workflowStoryRequested = ref(false);
const selectedVideoId = ref("");
const detailVideoId = ref("");
const selectedClipId = ref("");
const selectedClipContentTab = ref<SelectedClipContentTab>("transcript");
const selectedClipLayoutMode = ref<SelectedClipLayoutMode>("split");
const clipNavigatorCollapsed = ref(false);
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
const reportHtmlUrl = ref("");
const reportCopied = ref(false);
const selectedAnalysisStoryId = ref("");
const videoSearchQuery = ref("");
const videoStatusFilter = ref<"all" | StoryVaultZappingAnalysisStatus>("all");
const groupCreateModalOpen = ref(false);
const groupNameDraft = ref("");
const groupDescriptionDraft = ref("");
const isApplyingOrganizationPlan = ref(false);
const pendingCreatedGroupName = ref("");
const quickScanPreviewVideoId = ref("");
const deleteTargetGroup = ref<DecodedStoryVaultOperationVideoGroup | null>(null);
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
let chunks: BlobPart[] = [];
let audioChunks: BlobPart[] = [];
let lastAudioMimeType = "audio/webm";

const selectedVideoGroup = computed(
  () =>
    props.operationVideoGroups.find(
      (group) => group.id === selectedVideoGroupId.value
    ) ?? props.operationVideoGroups[0] ?? null
);
const videoCountByGroup = computed<Record<string, number>>(() => {
  const counts: Record<string, number> = {};
  for (const video of props.videos) {
    if (!video.groupId) continue;
    counts[video.groupId] = (counts[video.groupId] ?? 0) + 1;
  }
  return counts;
});
const selectedGroupVideos = computed(() => {
  const group = selectedVideoGroup.value;
  if (!group) return [];
  return props.videos.filter((video) => video.groupId === group.id);
});
function groupVideoCount(groupId: string): number {
  return videoCountByGroup.value[groupId] ?? 0;
}
const canCapture = computed(
  () => Boolean(props.application?.id && selectedVideoGroup.value) && !props.isSaving
);
const canSave = computed(
  () =>
    Boolean(props.application?.id) &&
    Boolean(selectedVideoGroup.value) &&
    Boolean(recordedBlob.value) &&
    !isRecording.value &&
    !isExtractingFrames.value &&
    !props.isSaving
);

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
const filteredVideos = computed(() => {
  const query = videoSearchQuery.value.trim().toLowerCase();
  return selectedGroupVideos.value.filter((video) => {
    if (
      videoStatusFilter.value !== "all" &&
      video.analysisStatus !== videoStatusFilter.value
    ) {
      return false;
    }
    if (!query) return true;
    return [
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
    ...(video.relatedContexts?.github?.pullRequests.length
      ? video.relatedContexts.github.pullRequests.map((pr) => `- ${video.relatedContexts?.github?.repoFullName || "repo"} PR ${pr.number}: ${pr.title} (${pr.htmlUrl})`)
      : ["- No GitHub pull request refs."]),
    "",
    "## Knowledge Documents",
    ...(video.relatedContexts?.knowledge?.documents.length
      ? video.relatedContexts.knowledge.documents.map((doc) => `- ${doc.displayName || doc.documentId || doc.name || "Knowledge"} (${doc.mimeType || "unknown"}): ${doc.reason || "No reason recorded."}${doc.gcsUrl ? ` ${doc.gcsUrl}` : ""}`)
      : ["- No knowledge document refs."]),
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
      knowledgeDocuments: video.relatedContexts?.knowledge?.documents ?? [],
      githubPullRequests: video.relatedContexts?.github?.pullRequests ?? [],
      slackMessages: video.relatedContexts?.slack?.messages ?? [],
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
          (story, index) => `<article class="panel story"><h3>${index + 1}. ${escapeHtml(story.title)}</h3><p>${escapeHtml(story.goal || story.summary || story.userStory || "No goal recorded.")}</p><div class="chips"><span class="chip">${escapeHtml(story.role?.value || "role n/a")}</span><span class="chip">confidence ${escapeHtml(String(story.confidenceScore ?? "n/a"))}</span></div><h4>Acceptance Criteria</h4><ol>${story.acceptanceCriteria.map((criterion) => `<li>${escapeHtml(criterion)}</li>`).join("") || "<li>No acceptance criteria recorded.</li>"}</ol><h4>Evidence</h4><ul>${story.evidence.map((item) => `<li><strong>${escapeHtml(item.title || "Evidence")}</strong>: ${escapeHtml(item.summary || "No summary recorded.")}<br><span class="muted">${escapeHtml(item.videoId)} / ${escapeHtml(item.representativeScreenshotId || "no representative screenshot")}</span></li>`).join("") || '<li class="muted">No evidence recorded.</li>'}</ul></article>`
        )
        .join("")
    : '<div class="panel"><p class="muted">No user stories are linked to this operation video.</p></div>';
  const frames = video.frameCaptures.length
    ? video.frameCaptures
        .slice(0, 30)
        .map((frame) => `<figure class="frame"><img src="${escapeHtml(savedFrameUrl(video, frame.id) || frame.storagePath || "")}" alt="${escapeHtml(frame.id)}"><figcaption>${escapeHtml(frame.id)} / ${escapeHtml(formatDuration(frame.timestampMs))}</figcaption></figure>`)
        .join("")
    : '<div class="panel"><p class="muted">No screenshots.</p></div>';
  const prs = video.relatedContexts?.github?.pullRequests.length
    ? video.relatedContexts.github.pullRequests
        .map((pr) => `<li>PR ${escapeHtml(String(pr.number))}: <a href="${escapeHtml(pr.htmlUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(pr.title)}</a></li>`)
        .join("")
    : '<li class="muted">No GitHub pull request refs.</li>';
  const knowledge = video.relatedContexts?.knowledge?.documents.length
    ? video.relatedContexts.knowledge.documents
        .map((doc) => `<article class="panel"><h3>${escapeHtml(doc.displayName || doc.documentId || doc.name || "Knowledge")}</h3><p class="muted">${escapeHtml(doc.mimeType || "unknown")} / score ${escapeHtml(String(doc.relevanceScore ?? "n/a"))}</p>${doc.reason ? `<p>${escapeHtml(doc.reason)}</p>` : ""}${doc.gcsUrl ? `<p class="muted">${escapeHtml(doc.gcsUrl)}</p>` : ""}</article>`)
        .join("")
    : '<div class="panel"><p class="muted">No knowledge document refs.</p></div>';
  const videoUrl = videoUrls[video.id] || "";
  return `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(displayVideoTitle(video))} StoryVault Operation Video Bundle</title>
  <style>
    *{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;color:#0f172a;background:#fff;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;line-height:1.65}.layout{display:grid;grid-template-columns:280px minmax(0,1fr);min-height:100vh}.sidebar{position:sticky;top:0;height:100vh;overflow:auto;border-right:1px solid #dbe3ef;background:#f8fafc;padding:22px 18px}.brand{margin:0;color:#64748b;font-size:12px;font-weight:900;letter-spacing:.12em;text-transform:uppercase}.side-title{margin:8px 0 18px;font-size:18px;line-height:1.25}.nav{display:grid;gap:7px;margin-top:18px}.nav a{display:block;border-radius:8px;padding:9px 10px;color:#334155;font-size:13px;font-weight:800;text-decoration:none}.nav a:hover{background:#fff}.content{min-width:0;padding:30px min(5vw,54px) 56px}.hero{border-bottom:1px solid #dbe3ef;padding-bottom:22px}.eyebrow{margin:0 0 6px;color:#0f9aa7;font-size:13px;font-weight:900}h1{margin:0;font-size:clamp(30px,4vw,54px);line-height:1.08}h2{margin:36px 0 12px;padding-top:10px;font-size:24px}h3{margin:0 0 8px;font-size:17px}.summary{margin-top:12px;color:#475569}.grid{display:grid;gap:14px}.cols5{grid-template-columns:repeat(6,minmax(0,1fr))}.metric,.panel{border:1px solid #dbe3ef;border-radius:8px;background:#fff;padding:15px}.metric{background:#f8fafc}.metric span{display:block;color:#64748b;font-size:12px;font-weight:900}.metric strong{display:block;font-size:18px}.chips{display:flex;flex-wrap:wrap;gap:6px;margin-top:10px}.chip{border-radius:999px;background:#ecfeff;color:#0e7490;padding:3px 9px;font-size:12px;font-weight:800}.story{border-left:4px solid #0f9aa7}.muted{color:#64748b}.frames{display:grid;gap:12px;grid-template-columns:repeat(3,minmax(0,1fr))}video,img{width:100%;max-height:560px;border:1px solid #dbe3ef;border-radius:8px;background:#f1f5f9;object-fit:contain}.frame figcaption{margin-top:5px;color:#64748b;font-size:12px}li{overflow-wrap:anywhere}@media(max-width:960px){.layout{grid-template-columns:1fr}.sidebar{position:static;height:auto}.content{padding:22px 16px 44px}.cols5,.frames{grid-template-columns:1fr}}
  </style>
</head>
<body>
  <div class="layout"><aside class="sidebar"><p class="brand">StoryVault Bundle</p><h2 class="side-title">${escapeHtml(displayVideoTitle(video))}</h2><div class="chips"><span class="chip">${stories.length} stories</span><span class="chip">${video.frameCaptures.length} screenshots</span></div><nav class="nav"><a href="#overview">Overview</a><a href="#video">Operation Video</a><a href="#stories">Linked User Stories</a><a href="#knowledge">Knowledge Documents</a><a href="#screenshots">Screenshots</a><a href="#pull-requests">Pull Requests</a></nav></aside><main class="content">
    <header id="overview" class="hero"><p class="eyebrow">Operation video centered context</p><h1>${escapeHtml(displayVideoTitle(video))}</h1><p class="summary">${escapeHtml(displayVideoDescription(video) || video.analysisResult?.operationIntent || "")}</p><div class="panel"><h3>Video Group</h3><p><strong>${escapeHtml(videoGroup.name)}</strong></p><p class="muted">${escapeHtml(videoGroup.description || "No group description.")}</p></div></header>
    <section><h2>Bundle Metrics</h2><div class="grid cols5">${reportMetrics.value.map((metric) => `<div class="metric"><span>${escapeHtml(metric.label)}</span><strong>${escapeHtml(String(metric.value))}</strong></div>`).join("")}</div></section>
    <section id="video"><h2>Operation Video</h2><div class="panel">${videoUrl ? `<video controls preload="metadata" src="${escapeHtml(videoUrl)}"></video>` : ""}<p class="summary">${escapeHtml(video.analysisResult?.transcriptSummary || video.transcriptSummary || video.quickScan?.transcriptSummary || "")}</p></div></section>
    <section id="stories"><h2>Linked User Stories</h2><div class="grid">${storyCards}</div></section>
    <section id="knowledge"><h2>Knowledge Documents</h2><div class="grid">${knowledge}</div></section>
    <section id="screenshots"><h2>Screenshots</h2><div class="frames">${frames}</div></section>
    <section id="pull-requests"><h2>GitHub Pull Requests</h2><div class="panel"><ul>${prs}</ul></div></section>
  </main></div>
</body>
</html>`;
});
const reportBody = computed(() => {
  if (reportMode.value === "html") return reportHtml.value;
  if (reportMode.value === "json") return mcpTestContextJson.value;
  return reportMarkdown.value;
});
const reportMimeType = computed(() => {
  if (reportMode.value === "html") return "text/html;charset=utf-8";
  if (reportMode.value === "json") return "application/json;charset=utf-8";
  return "text/markdown;charset=utf-8";
});
const reportExtension = computed(() => {
  if (reportMode.value === "html") return "html";
  if (reportMode.value === "json") return "json";
  return "md";
});
const detailVideo = computed(
  () => props.videos.find((video) => video.id === detailVideoId.value) ?? null
);
const contextMapVideo = computed(
  () =>
    props.videos.find((video) => video.id === contextMapVideoId.value) ??
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
  { label: "動画", dotClass: "bg-cyan-300" },
  { label: "根拠", dotClass: "bg-emerald-300" },
  { label: "ストーリー", dotClass: "bg-amber-300" },
  { label: "関連情報", dotClass: "bg-violet-300" },
];
const detailVideoClips = computed(() =>
  detailVideo.value ? videoClips(detailVideo.value) : []
);
const selectedDetailClip = computed(() => {
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
const activeSelectedClipCueId = computed(() => {
  const clip = selectedDetailClip.value;
  if (!clip) return "";
  return activeTranscriptCueId(
    transcriptCueRows(clip),
    selectedClipPlaybackMs.value
  );
});
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
const deleteTargetClip = computed(() => {
  const video = props.videos.find((item) => item.id === deleteTargetClipVideoId.value);
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
  () => props.videos.find((video) => video.id === workflowVideoId.value) ?? null
);
const saveWorkflowActiveIndex = computed(() => {
  if (saveWorkflowStep.value === "videoAnalysis") return 1;
  if (saveWorkflowStep.value === "storyAnalysis") return 2;
  return 0;
});
const isSaveWorkflowBusy = computed(() =>
  !["idle", "done", "error"].includes(saveProgressPhase.value)
);
const saveWorkflowStepperItems = computed(() => [
  {
    title: "1. 保存",
    description: workflowVideoId.value ? "動画を保存済み" : "動画本体を先に保存",
    icon: workflowVideoId.value ? "material-symbols:check-circle-outline" : "material-symbols:save-outline",
  },
  {
    title: "2. 動画解析",
    description: hasVideoAnalysis(workflowVideo.value)
      ? "文字起こしと解析メモを保存済み"
      : "スクショ・文字起こし・解析メモ",
    icon: hasVideoAnalysis(workflowVideo.value)
      ? "material-symbols:check-circle-outline"
      : "material-symbols:movie-info-outline",
  },
  {
    title: "3. ストーリー解析",
    description: workflowVideo.value?.analysisStatus === "completed"
      ? "ストーリー候補を反映済み"
      : workflowVideo.value?.analysisStatus === "running" || workflowVideo.value?.analysisStatus === "queued"
        ? "ADKで解析中"
        : "ユーザーのやりたいことを抽出",
    icon: workflowVideo.value?.analysisStatus === "completed"
      ? "material-symbols:check-circle-outline"
      : "material-symbols:psychology-outline",
  },
]);
const saveProgressTitle = computed(() => {
  if (saveProgressPhase.value === "done") return "保存が完了しました";
  if (saveProgressPhase.value === "error") return "保存に失敗しました";
  if (saveProgressPhase.value === "saving") return "ザッピング動画を保存しています";
  if (saveProgressPhase.value === "extracting") return "スクリーンショットを抽出しています";
  if (saveProgressPhase.value === "transcribing") return "Geminiで文字起こししています";
  if (saveProgressPhase.value === "summarizing") return "文字起こしを要約しています";
  if (saveProgressPhase.value === "scanning") return "AIで動画解析しています";
  if (saveProgressPhase.value === "analysisSaving") return "動画解析結果を保存しています";
  if (saveProgressPhase.value === "storyQueued") return "ユーザーストーリー解析を開始しています";
  if (saveProgressPhase.value === "storyRunning") return "ユーザーストーリーを抽出しています";
  return "動画を保存しています";
});
const saveProgressDescription = computed(() => {
  if (saveProgressPhase.value === "done") {
    return "動画・動画解析・ユーザーストーリー解析まで完了しました。";
  }
  if (saveProgressPhase.value === "error") {
    return errorMessage.value || "保存処理を完了できませんでした。";
  }
  if (saveProgressPhase.value === "saving") {
    return "解析に失敗しても録画が残るよう、まず動画本体を保存しています。";
  }
  if (saveProgressPhase.value === "extracting") {
    return "録画動画から約5秒ごとの操作スクリーンショットを作っています。";
  }
  if (saveProgressPhase.value === "transcribing") {
    return "録画音声をGeminiへ送信し、タイムコード付きの文字起こしを取得しています。";
  }
  if (saveProgressPhase.value === "summarizing") {
    return "文字起こし全文から、操作意図をGeminiで短く整理しています。";
  }
  if (saveProgressPhase.value === "scanning") {
    return "動画、スクリーンショット、文字起こし全文、要約からタイトル・説明・操作ステップを生成しています。";
  }
  if (saveProgressPhase.value === "analysisSaving") {
    return "タイムスタンプ付き文字起こしと動画解析メモを保存済み動画へ反映しています。";
  }
  if (saveProgressPhase.value === "storyQueued") {
    return "保存済みの動画解析結果を使って、ADKのユーザーストーリー解析を開始しています。";
  }
  if (saveProgressPhase.value === "storyRunning") {
    return "文字起こしタイムコードと画面根拠から、ユーザーストーリー候補を抽出しています。";
  }
  return "録画データをVIDとして先に登録しています。";
});
const saveProgressCompletion = computed(() => {
  if (saveProgressPhase.value === "done") return 100;
  if (saveProgressPhase.value === "storyRunning") return 92;
  if (saveProgressPhase.value === "storyQueued") return 84;
  if (saveProgressPhase.value === "analysisSaving") return 78;
  if (saveProgressPhase.value === "uploading") return 22;
  if (saveProgressPhase.value === "scanning") return 74;
  if (saveProgressPhase.value === "summarizing") return 56;
  if (saveProgressPhase.value === "transcribing") return 38;
  if (saveProgressPhase.value === "extracting") return 30;
  if (saveProgressPhase.value === "saving") return 14;
  return saveProgressPhase.value === "error" ? 100 : 8;
});
const saveProgressFramePreview = computed(() => frameCaptures.value.slice(0, 6));
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
      subheading: "Geminiの文字起こしをタイムコード付きで受け取り、動画の意図を説明できる材料にしています。",
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
      heading: "動画の意味を組み立てています",
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
      subheading: "動画、スクリーンショット、文字起こし、AI解析メモをあとから検索できる形にしています。",
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
      heading: "動画メモの保存が完了しました",
      subheading: "このあと詳細画面で、動画・文字起こし・操作ステップをまとめて確認できます。",
      badge: "完了",
      noteCount,
      lines: [
        scanTitle ? `保存タイトル: ${scanTitle}` : "保存済みの動画詳細へ移動します。",
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
    heading: "動画の理解を準備しています",
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
  const extractStatus: SaveProgressStepStatus =
    phase === "extracting"
      ? "active"
      : ["transcribing", "summarizing", "scanning", "analysisSaving", "storyQueued", "storyRunning", "done"].includes(phase)
        ? "done"
        : phase === "error" && frameCaptures.value.length === 0
          ? "error"
          : "pending";
  const transcribeStatus: SaveProgressStepStatus =
    phase === "transcribing"
      ? "active"
      : transcriptErrorMessage.value
        ? "error"
      : ["summarizing", "scanning", "analysisSaving", "storyQueued", "storyRunning", "done"].includes(phase)
        ? "done"
        : phase === "error" && frameCaptures.value.length > 0
          ? "error"
          : "pending";
  const summarizeStatus: SaveProgressStepStatus =
    phase === "summarizing"
      ? "active"
      : ["scanning", "analysisSaving", "storyQueued", "storyRunning", "done"].includes(phase)
        ? "done"
        : phase === "error" && Boolean(transcriptText.value)
          ? "error"
          : "pending";
  const scanStatus: SaveProgressStepStatus =
    phase === "scanning"
      ? "active"
      : ["analysisSaving", "storyQueued", "storyRunning", "done"].includes(phase)
        ? "done"
        : phase === "error" && frameCaptures.value.length > 0
          ? "error"
          : "pending";
  const uploadingStatus: SaveProgressStepStatus =
    phase === "saving"
      ? "active"
      : ["extracting", "transcribing", "summarizing", "scanning", "analysisSaving", "storyQueued", "storyRunning", "done"].includes(phase)
        ? "done"
        : phase === "error" && workflowVideoId.value
          ? "done"
          : phase === "error"
            ? "error"
            : "pending";
  return [
    {
      key: "frames",
      index: 1,
      label: "スクリーンショットを抽出",
      description: `${frameCaptures.value.length}枚の操作スクリーンショットを準備しています。`,
      status: extractStatus,
      statusLabel: saveProgressStatusLabel(extractStatus),
    },
    {
      key: "transcript",
      index: 2,
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
      index: 3,
      label: "文字起こしを要約",
      description: transcriptSummary.value
        ? "文字起こしの要約を作成しました。"
        : "Geminiで操作意図を短く整理します。",
      status: summarizeStatus,
      statusLabel: saveProgressStatusLabel(summarizeStatus),
    },
    {
      key: "scan",
      index: 4,
      label: "AI動画解析",
      description: quickScan.value?.errorMessage
        ? "簡易スキャンは失敗しましたが、動画保存は継続します。"
        : "4種類の入力からタイトル、説明、操作ステップをFirebase AI Logicで生成します。",
      status: scanStatus,
      statusLabel: saveProgressStatusLabel(scanStatus),
    },
    {
      key: "upload",
      index: 5,
      label: "動画を保存",
      description: workflowVideoId.value
        ? "動画本体は保存済みです。"
        : "まず動画ファイルを永続化しています。",
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
  () => props.operationVideoGroups,
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
  () => props.videos,
  (videos) => {
    if (!videos.some((video) => video.id === selectedVideoId.value)) {
      selectedVideoId.value = videos[0]?.id ?? "";
    }
    if (detailVideoId.value && !videos.some((video) => video.id === detailVideoId.value)) {
      detailVideoId.value = "";
    }
    const activeDetail = videos.find((video) => video.id === detailVideoId.value);
    const activeClips = activeDetail ? videoClips(activeDetail) : [];
    if (
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
  workflowVideo,
  (video) => {
    if (!saveProgressOpen.value || !video || saveWorkflowStep.value !== "storyAnalysis") {
      return;
    }
    if (video.analysisStatus === "completed") {
      saveProgressPhase.value = "done";
    } else if (video.analysisStatus === "error") {
      errorMessage.value =
        video.analysisErrorMessage || "ユーザーストーリー解析に失敗しました";
      saveProgressPhase.value = "error";
    } else if (video.analysisStatus === "queued" || video.analysisStatus === "running") {
      saveProgressPhase.value = "storyRunning";
    }
  },
  { deep: true }
);

watch(
  [() => route.query.operationVideoId, () => route.query.operationVideoTab],
  () => {
    applyRouteDetailTarget(props.videos);
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

onBeforeUnmount(() => {
  stopElapsedTimer();
  stopTracks();
  stopContextMapNodeDrag();
  revokePreviewUrl();
  revokeFramePreviewUrls();
  revokeReportHtmlUrl();
});

function openRecordingModal(): void {
  errorMessage.value = "";
  appendTargetVideoId.value = "";
  if (!selectedVideoGroup.value) {
    errorMessage.value = "先に動画グループを作成・選択してください";
    return;
  }
  recordingModalOpen.value = true;
}

function openAppendRecordingModal(video: DecodedStoryVaultOperationVideo): void {
  errorMessage.value = "";
  appendTargetVideoId.value = video.id;
  selectedVideoGroupId.value = video.groupId || selectedVideoGroupId.value;
  recordingModalOpen.value = true;
}

function openGroupCreateModal(): void {
  errorMessage.value = "";
  groupNameDraft.value = "";
  groupDescriptionDraft.value = "";
  groupCreateModalOpen.value = true;
}

function submitOperationVideoGroup(): void {
  if (!props.application) return;
  const name = groupNameDraft.value.trim();
  if (!name) return;
  emit("create-group", {
    applicationId: props.application.id,
    name,
    description: groupDescriptionDraft.value.trim() || undefined,
  });
  pendingCreatedGroupName.value = name;
  groupNameDraft.value = "";
  groupDescriptionDraft.value = "";
  groupCreateModalOpen.value = false;
}

function openGroupDeleteConfirm(group: DecodedStoryVaultOperationVideoGroup): void {
  deleteTargetGroup.value = group;
  deleteGroupConfirmOpen.value = true;
}

function deleteConfirmedGroup(): void {
  const group = deleteTargetGroup.value;
  if (!group || groupVideoCount(group.id) > 0) return;
  deleteGroupConfirmOpen.value = false;
  deleteTargetGroup.value = null;
  emit("delete-group", group.id);
}

function openVideoDeleteConfirm(video: DecodedStoryVaultOperationVideo): void {
  deleteTargetVideoId.value = video.id;
  deleteVideoConfirmOpen.value = true;
}

function openClipDeleteConfirm(
  video: DecodedStoryVaultOperationVideo,
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
  plan: OperationVideoGroupAssistantPlan,
  childCallbacks?: OperationVideoOrganizationCallbacks
): void {
  errorMessage.value = "";
  isApplyingOrganizationPlan.value = true;
  emit("apply-organization-plan", plan, {
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
  if (!recordedBlob.value) {
    appendTargetVideoId.value = "";
  }
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

async function saveRecording(): Promise<void> {
  if (!props.application || !recordedBlob.value || !canSave.value) return;
  const group = selectedVideoGroup.value;
  if (!group) {
    errorMessage.value = "動画グループを選択してください";
    return;
  }
  saveProgressOpen.value = true;
  saveWorkflowStep.value = "save";
  workflowVideoId.value = "";
  workflowClipId.value = "";
  workflowStoryRequested.value = false;
  errorMessage.value = "";
  saveProgressPhase.value = "saving";

  try {
    const savedVideo = await persistRecordedVideoShell(group);
    workflowVideoId.value = savedVideo.id;
    workflowClipId.value = savedVideo.clips[0]?.id || "clip-001";
    selectedVideoGroupId.value = savedVideo.groupId || group.id;
    selectedVideoId.value = savedVideo.id;
    detailVideoId.value = savedVideo.id;
    appendTargetVideoId.value = "";

    await runVideoAnalysisWorkflow({
      video: savedVideo,
      videoBlob: recordedBlob.value,
      transcriptionBlob: resolveTranscriptionAudioBlob() || recordedBlob.value,
      durationMs: recordedDurationMs.value ?? elapsedMs.value,
      closeRecordingWhenDone: true,
    });
  } catch (error) {
    errorMessage.value =
      error instanceof Error ? error.message : "ザッピング動画の保存に失敗しました";
    saveProgressPhase.value = "error";
    isExtractingFrames.value = false;
  }
}

function persistRecordedVideoShell(
  group: DecodedStoryVaultOperationVideoGroup
): Promise<DecodedStoryVaultOperationVideo> {
  if (!props.application || !recordedBlob.value) {
    return Promise.reject(new Error("保存する録画がありません"));
  }
  const resolvedTitle = title.value.trim() || buildFallbackRecordingTitle();
  const payload: StoryVaultOperationVideoSaveInput = {
    applicationId: props.application.id,
    groupId: group.id,
    title: resolvedTitle,
    description: undefined,
    blob: recordedBlob.value,
    durationMs: recordedDurationMs.value ?? elapsedMs.value,
    contentType: recordedBlob.value.type || "video/webm",
    sourceDisplaySurface: sourceDisplaySurface.value,
    transcriptTimingStatus: "unavailable",
    frameCaptures: [],
    tags: [],
  };
  const targetVideoId = appendTargetVideoId.value;
  return new Promise((resolve, reject) => {
    const callbacks: OperationVideoSaveCallbacks = {
      onSuccess: resolve,
      onError: (message) => reject(new Error(message)),
    };
    if (targetVideoId) {
      emit("append-clip", { ...payload, videoId: targetVideoId }, callbacks);
    } else {
      emit("save", payload, callbacks);
    }
  });
}

function persistVideoAnalysis(
  input: StoryVaultOperationVideoClipAnalysisInput
): Promise<DecodedStoryVaultOperationVideo> {
  return new Promise((resolve, reject) => {
    emit("update-clip-analysis", input, {
      onSuccess: resolve,
      onError: (message) => reject(new Error(message)),
    });
  });
}

async function runVideoAnalysisWorkflow(params: {
  video: DecodedStoryVaultOperationVideo;
  videoBlob: Blob | null;
  transcriptionBlob: Blob | null;
  transcriptionGcsUri?: string;
  durationMs?: number;
  closeRecordingWhenDone?: boolean;
}): Promise<void> {
  if (!props.application) return;
  saveWorkflowStep.value = "videoAnalysis";
  isExtractingFrames.value = true;
  try {
    saveProgressPhase.value = "extracting";
    frameCaptures.value = params.videoBlob
      ? await extractVideoFrames(
          params.videoBlob,
          params.durationMs ?? params.video.durationMs ?? 0
        )
      : [];
    saveProgressPhase.value = "transcribing";
    const transcription = await transcribeRecordingWithGemini(
      params.transcriptionBlob,
      params.transcriptionGcsUri
        ? {
            gcsUri: params.transcriptionGcsUri,
            contentType: params.video.contentType || "video/webm",
            fileName: params.video.fileName || "zapping-video.webm",
          }
        : undefined
    );
    transcriptText.value = transcription.text;
    transcriptProvider.value = transcription.provider;
    transcriptSegments.value = transcription.segments;
    transcriptSrt.value = transcription.srt;
    transcriptTimingStatus.value = transcription.timingStatus;
    transcriptErrorMessage.value = "";

    saveProgressPhase.value = "summarizing";
    transcriptSummary.value = await summarizeTranscriptWithGemini(
      transcriptText.value
    );
    saveProgressPhase.value = "scanning";
    quickScan.value = await generateQuickScanFromContext({
      frames: frameCaptures.value,
      videoBlob: params.videoBlob,
      transcriptText: transcriptText.value,
      transcriptSummary: transcriptSummary.value,
    });

    saveProgressPhase.value = "analysisSaving";
    const analyzedVideo = await persistVideoAnalysis({
      videoId: params.video.id,
      clipId: workflowClipId.value || params.video.clips[0]?.id,
      title:
        quickScan.value?.title?.trim() ||
        params.video.title ||
        buildFallbackRecordingTitle(),
      description: quickScan.value?.description?.trim(),
      transcriptText: transcriptText.value,
      transcriptProvider: transcriptProvider.value,
      transcriptSummary: transcriptSummary.value,
      transcriptSegments: transcriptSegments.value,
      transcriptSrt: transcriptSrt.value,
      transcriptTimingStatus: "timestamped",
      quickScan: quickScan.value,
      frameCaptures: frameCaptures.value.map((frame) => ({
        timestampMs: frame.timestampMs,
        blob: frame.blob,
        contentType: frame.contentType,
        width: frame.width,
        height: frame.height,
      })),
    });
    workflowVideoId.value = analyzedVideo.id;
    workflowClipId.value = analyzedVideo.clips[0]?.id || workflowClipId.value;
    selectedVideoId.value = analyzedVideo.id;
    detailVideoId.value = analyzedVideo.id;
    isExtractingFrames.value = false;

    await startInlineStoryAnalysis(analyzedVideo.id);
    if (params.closeRecordingWhenDone) {
      window.setTimeout(() => {
        recordingModalOpen.value = false;
        saveProgressOpen.value = false;
        saveProgressPhase.value = "idle";
        saveWorkflowStep.value = "save";
        workflowVideoId.value = "";
        workflowClipId.value = "";
        workflowStoryRequested.value = false;
        resetRecording();
      }, 900);
    }
  } catch (error) {
    isExtractingFrames.value = false;
    errorMessage.value =
      error instanceof Error
        ? `動画解析に失敗しました: ${error.message}`
        : "動画解析に失敗しました";
    saveProgressPhase.value = "error";
    throw error;
  }
}

async function startInlineStoryAnalysis(videoId: string): Promise<void> {
  saveWorkflowStep.value = "storyAnalysis";
  saveProgressPhase.value = "storyQueued";
  workflowStoryRequested.value = true;
  await new Promise<void>((resolve, reject) => {
    emit("analyze", videoId, { inline: true }, {
      onStarted: resolve,
      onError: (message) => reject(new Error(message)),
    });
  });
  const video = props.videos.find((item) => item.id === videoId);
  if (video?.analysisStatus === "completed") {
    saveProgressPhase.value = "done";
    return;
  }
  saveProgressPhase.value = "storyRunning";
}

async function resumeVideoWorkflow(video: DecodedStoryVaultOperationVideo): Promise<void> {
  errorMessage.value = "";
  workflowVideoId.value = video.id;
  workflowClipId.value = video.clips[0]?.id || "clip-001";
  saveProgressOpen.value = true;
  try {
    if (!hasVideoAnalysis(video)) {
      const blob = await fetchSavedVideoBlob(video).catch((error) => {
        reportDatadogError(error, {
          feature: "storyvault_resume_video_workflow_saved_blob_optional",
          videoId: video.id,
        });
        return null;
      });
      await runVideoAnalysisWorkflow({
        video,
        videoBlob: blob,
        transcriptionBlob: blob,
        transcriptionGcsUri: `gs://${video.bucketName}/${video.storagePath}`,
        durationMs: video.durationMs,
        closeRecordingWhenDone: false,
      });
      return;
    }
    await startInlineStoryAnalysis(video.id);
  } catch (error) {
    isExtractingFrames.value = false;
    errorMessage.value =
      error instanceof Error
        ? `途中からの解析再開に失敗しました: ${error.message}`
        : "途中からの解析再開に失敗しました";
    saveProgressPhase.value = "error";
    reportDatadogError(error, {
      feature: "storyvault_resume_video_workflow",
      videoId: video.id,
      clipCount: video.clips.length,
      hasVideoAnalysis: hasVideoAnalysis(video),
    });
  }
}

async function fetchSavedVideoBlob(video: DecodedStoryVaultOperationVideo): Promise<Blob> {
  const primary = videoClips(video)[0];
  const bucketName = primary?.bucketName || video.bucketName;
  const storagePath = primary?.storagePath || video.storagePath;
  if (!bucketName || !storagePath) {
    throw new Error("保存済み動画のStorageパスを取得できませんでした");
  }
  const fileRef = storageRefForBucketPath({
    bucketName,
    filePath: storagePath,
  });
  try {
    const blob = await getBlob(fileRef);
    return blob.type ? blob : new Blob([blob], { type: primary?.contentType || video.contentType || "video/webm" });
  } catch (error) {
    reportDatadogError(error, {
      feature: "storyvault_fetch_saved_video_blob",
      videoId: video.id,
      bucketName,
      storagePath,
    });
    throw new Error(
      error instanceof Error
        ? `保存済み動画の取得に失敗しました: ${error.message}`
        : "保存済み動画の取得に失敗しました"
    );
  }
}

function hasVideoAnalysis(video: DecodedStoryVaultOperationVideo | null): boolean {
  if (!video) return false;
  return (
    video.transcriptTimingStatus === "timestamped" &&
    video.transcriptSegments.length > 0 &&
    Boolean(video.transcriptSrt?.trim()) &&
    Boolean(video.quickScan || video.transcriptSummary)
  );
}

function canResumeVideoWorkflow(video: DecodedStoryVaultOperationVideo): boolean {
  if (video.analysisStatus === "queued" || video.analysisStatus === "running") {
    return false;
  }
  return !hasVideoAnalysis(video) || video.analysisStatus !== "completed";
}

function isWorkflowRunningFor(video: DecodedStoryVaultOperationVideo): boolean {
  return saveProgressOpen.value && workflowVideoId.value === video.id;
}

function displayVideoTitle(video: DecodedStoryVaultOperationVideo): string {
  return video.title?.trim() || video.quickScan?.title?.trim() || "無題の操作動画";
}

function videoGroupForVideo(video: DecodedStoryVaultOperationVideo): {
  id: string;
  name: string;
  description: string;
} {
  const group = props.operationVideoGroups.find(
    (item) => item.id === video.groupId
  );
  return {
    id: group?.id || video.groupId || "",
    name: group?.name || video.groupNameSnapshot || "動画グループ未設定",
    description: group?.description || "",
  };
}

function videoDisplayId(video: DecodedStoryVaultOperationVideo): string {
  const index = props.videos.findIndex((item) => item.id === video.id);
  return `VID${index >= 0 ? index + 1 : 1}`;
}

function startVideoTitleEdit(video: DecodedStoryVaultOperationVideo): void {
  editingVideoTitleId.value = video.id;
  editingVideoTitleDraft.value = displayVideoTitle(video);
  void nextTick(() => {
    videoTitleInput.value?.focus();
    videoTitleInput.value?.select();
  });
}

function cancelVideoTitleEdit(): void {
  editingVideoTitleId.value = "";
  editingVideoTitleDraft.value = "";
}

function commitVideoTitleEdit(video: DecodedStoryVaultOperationVideo): void {
  if (editingVideoTitleId.value !== video.id) return;
  if (updatingVideoTitleId.value === video.id) return;

  const nextTitle = editingVideoTitleDraft.value.trim();
  const currentTitle = displayVideoTitle(video).trim();
  if (!nextTitle || nextTitle === currentTitle) {
    cancelVideoTitleEdit();
    return;
  }

  updatingVideoTitleId.value = video.id;
  emit("update-title", video.id, nextTitle, {
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

function openVideoDetail(video: DecodedStoryVaultOperationVideo): void {
  detailVideoId.value = video.id;
  selectedClipId.value = videoClips(video)[0]?.id ?? "";
  detailTab.value = "video";
}

function openContextMap(video: DecodedStoryVaultOperationVideo): void {
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
  videos: DecodedStoryVaultOperationVideo[]
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

function openReportPreview(): void {
  if (!import.meta.client || typeof URL === "undefined" || typeof Blob === "undefined") return;
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
  const blob = new Blob([reportBody.value], { type: reportMimeType.value });
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
  video: DecodedStoryVaultOperationVideo
): string {
  return video.quickScan?.description?.trim() || video.description || "";
}

function hasQuickScanSummary(
  video: DecodedStoryVaultOperationVideo
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

function openQuickScanPreview(video: DecodedStoryVaultOperationVideo): void {
  quickScanPreviewVideoId.value = video.id;
}

function quickScanProviderLabel(video: DecodedStoryVaultOperationVideo): string {
  return (
    video.quickScan?.provider?.trim() ||
    video.transcriptProvider?.trim() ||
    "scan"
  );
}

function transcriptSummaryText(video: DecodedStoryVaultOperationVideo): string {
  return (
    video.transcriptSummary?.trim() ||
    video.quickScan?.transcriptSummary?.trim() ||
    ""
  );
}

function selectedClipSummaryMarkdown(
  clip: StoryVaultOperationVideoClip,
  video: DecodedStoryVaultOperationVideo
): string {
  return (
    clip.transcriptSummary?.trim() ||
    clip.quickScan?.transcriptSummary?.trim() ||
    video.transcriptSummary?.trim() ||
    video.quickScan?.transcriptSummary?.trim() ||
    "未生成"
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
  video: DecodedStoryVaultOperationVideo
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

function operationSteps(video: DecodedStoryVaultOperationVideo): string[] {
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
  emit("delete-clip", target.video.id, target.clip.id);
}

function openRelatedContextTab(): void {
  detailTab.value = "relatedContext";
  relatedContextProviderTab.value = "knowledge";
}

function analysisResultCount(video: DecodedStoryVaultOperationVideo): string {
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

function storyCandidateCount(video: DecodedStoryVaultOperationVideo): number {
  return video.analysisResult?.storyCandidates.length ?? 0;
}

function isVideoAnalysisCompleted(video: DecodedStoryVaultOperationVideo): boolean {
  return video.analysisStatus === "completed" || Boolean(video.analysisResult);
}

function videoAnalysisTabStatus(video: DecodedStoryVaultOperationVideo): string {
  if (isVideoAnalysisCompleted(video)) return "完了";
  if (video.analysisStatus === "queued") return "待機";
  if (video.analysisStatus === "running") return "実行中";
  if (video.analysisStatus === "error") return "失敗";
  return "未解析";
}

function relatedGithubPullRequestCount(
  video: DecodedStoryVaultOperationVideo
): number {
  return video.relatedContexts?.github?.pullRequests.length ?? 0;
}

function relatedSlackMessageCount(
  video: DecodedStoryVaultOperationVideo
): number {
  return video.relatedContexts?.slack?.messages.length ?? 0;
}

function relatedKnowledgeDocumentCount(
  video: DecodedStoryVaultOperationVideo
): number {
  return video.relatedContexts?.knowledge?.documents.length ?? 0;
}

function relatedContextCount(video: DecodedStoryVaultOperationVideo): number {
  return (
    relatedGithubPullRequestCount(video) +
    relatedSlackMessageCount(video) +
    relatedKnowledgeDocumentCount(video)
  );
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
  video: DecodedStoryVaultOperationVideo
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
      displayVideoDescription(video) || video.analysisResult?.operationIntent || "操作動画の中心ノードです。",
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
    label: "動画解析",
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
        "動画解析の結果がここに集約されます。",
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
        subtitle: story.goal || story.summary || story.benefit || "動画から抽出された価値仮説",
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
      subtitle: "解析を実行するとここに価値仮説が接続されます",
      value: "0件",
      icon: "material-symbols:route-outline",
      x: 50,
      y: 86,
      tone: "amber",
      details: ["この動画にはまだユーザーストーリー候補が紐づいていません。"],
    });
    addEdge("analysis", "story-empty", "amber");
  }

  if (relatedKnowledgeDocumentCount(video) > 0) {
    nodes.push({
      id: "knowledge",
      kind: "knowledge",
      label: "ナレッジ",
      title: "FileSpaceナレッジ",
      subtitle: "動画理解を補強する資料",
      value: `${relatedKnowledgeDocumentCount(video)}件`,
      icon: "material-symbols:folder-managed-outline",
      x: 86,
      y: 66,
      tone: "violet",
      details: (video.relatedContexts?.knowledge?.documents ?? [])
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
      details: (video.relatedContexts?.github?.pullRequests ?? [])
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
  video: DecodedStoryVaultOperationVideo,
  cues: StoryVaultTranscriptCue[]
): string[] {
  const summary = transcriptSummaryText(video);
  if (cues.length === 0) {
    return [summary || "タイムスタンプ付き文字起こしはまだ生成されていません。"];
  }
  return [
    summary || "動画内の発話をタイムスタンプ付きで保持しています。",
    ...cues.slice(0, 4).map((cue) => `${formatTranscriptCueTime(cue.startMs)} ${cue.text}`),
  ];
}

function contextMapFrameDetails(
  video: DecodedStoryVaultOperationVideo
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
  if (node.kind === "knowledge" || node.kind === "github" || node.kind === "slack") {
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
  if (node.kind === "knowledge" || node.kind === "github" || node.kind === "slack") {
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

function isRelatedContextBusy(video: DecodedStoryVaultOperationVideo): boolean {
  return Boolean(
    props.isFetchingRelatedContexts || video.relatedContexts?.status === "running"
  );
}

function isRelatedContextProviderRunning(
  video: DecodedStoryVaultOperationVideo,
  provider: RelatedContextProviderTab
): boolean {
  return Boolean(
    video.relatedContexts?.status === "running" &&
      video.relatedContexts.runningProvider === provider
  );
}

function relatedContextErrorTitle(video: DecodedStoryVaultOperationVideo): string {
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
  video: DecodedStoryVaultOperationVideo,
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
  video: DecodedStoryVaultOperationVideo,
  evidence: ZappingAnalysisEvidence
): DecodedStoryVaultOperationVideo["frameCaptures"] {
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
  video: DecodedStoryVaultOperationVideo,
  timestampMs: number,
  maxCount: number
): DecodedStoryVaultOperationVideo["frameCaptures"] {
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
  videoBlob: Blob | null;
  transcriptText: string;
  transcriptSummary: string;
}): Promise<DecodedStoryVaultOperationVideo["quickScan"] | undefined> {
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
      videoBlob && videoBlob.size <= 7 * 1024 * 1024
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
        "StoryVaultのザッピング動画を動画解析します。",
        "入力には、動画本体、5秒ごとの操作スクリーンショット、Gemini文字起こし全文、文字起こし要約が含まれます。",
        "これらを総合して、タイトル、説明、操作ステップを日本語で作成してください。",
        "操作ステップは実際の操作順序がわかる短い文の配列にしてください。",
        "JSONだけを返してください。",
        '形式: {"title":"短いタイトル","description":"1文の説明","operationSteps":["操作1","操作2"],"operationMemo":"操作1\\n操作2","transcriptSummary":"文字起こし要約"}',
        "",
        "## Gemini文字起こし要約",
        transcriptSummary.trim() || "なし",
        "",
        "## Gemini文字起こし全文",
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
      feature: "storyvault_zapping_quick_scan",
      frameCount: frames.length,
      sampledFrameCount: Math.min(frames.length, 6),
      videoSizeBytes: videoBlob?.size ?? 0,
      transcriptLength: transcriptText.length,
      transcriptSummaryLength: transcriptSummary.length,
      videoIncluded: Boolean(videoBlob && videoBlob.size <= 7 * 1024 * 1024),
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
  NonNullable<DecodedStoryVaultOperationVideo["quickScan"]>,
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
  videos: DecodedStoryVaultOperationVideo[]
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
  video: DecodedStoryVaultOperationVideo
): StoryVaultOperationVideoClip[] {
  const clips = Array.isArray(video.clips) && video.clips.length > 0
    ? video.clips
    : [
        {
          id: "clip-001",
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
  return [...clips].sort((a, b) =>
    (a.recordedAt || "").localeCompare(b.recordedAt || "")
  );
}

function videoClipCount(video: DecodedStoryVaultOperationVideo): number {
  return video.clipCount || videoClips(video).length;
}

function videoTotalDurationMs(video: DecodedStoryVaultOperationVideo): number | undefined {
  return video.totalDurationMs ?? videoClips(video).reduce(
    (sum, clip) => sum + Math.max(0, clip.durationMs ?? 0),
    0
  );
}

function videoTotalSizeBytes(video: DecodedStoryVaultOperationVideo): number {
  const totalClipSize = videoClips(video).reduce(
    (sum, clip) => sum + Math.max(0, clip.sizeBytes ?? 0),
    0
  );
  return totalClipSize || video.sizeBytes || 0;
}

function clipVideoUrl(
  video: DecodedStoryVaultOperationVideo,
  clip: StoryVaultOperationVideoClip
): string {
  return clipVideoUrls[clipKey(video.id, clip.id)] ?? "";
}

function clipTitle(clip: StoryVaultOperationVideoClip, index: number): string {
  return (
    clip.quickScan?.title?.trim() ||
    clip.quickScan?.description?.trim() ||
    `Clip ${String(index + 1).padStart(2, "0")}`
  );
}

function clipThumbnailUrl(
  video: DecodedStoryVaultOperationVideo,
  clip: StoryVaultOperationVideoClip
): string {
  const firstFrame = clip.frameCaptures[0];
  if (!firstFrame) return "";
  return clipSavedFrameUrl(video, clip, firstFrame.id);
}

function clipSavedFrameUrl(
  video: DecodedStoryVaultOperationVideo,
  clip: StoryVaultOperationVideoClip,
  frameId: string
): string {
  return (
    clipFrameUrls[clipFrameKey(video.id, clip.id, frameId)] ??
    frameUrls[frameKey(video.id, frameId)] ??
    ""
  );
}

function savedFrameUrl(
  video: DecodedStoryVaultOperationVideo,
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
