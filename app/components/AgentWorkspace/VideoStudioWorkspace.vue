<template>
  <section :class="embedded ? 'vohance-workspace text-slate-900' : 'vohance-workspace min-h-[calc(100vh-5.5rem)] bg-[#f8f7ff] px-6 py-7 text-slate-900'">
    <div v-if="store.errorMessage" class="mb-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
      {{ store.errorMessage }}
    </div>

    <div v-if="embedded && !(store.view === 'editor' && store.selectedProject)" class="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
      <UIcon name="i-heroicons-arrow-path" class="mx-auto h-8 w-8 animate-spin text-teal-500" />
      <p class="mt-3 text-sm font-bold text-slate-900">動画エディターを準備しています</p>
      <p class="mt-1 text-xs text-slate-500">解析済みの字幕とセクションを読み込んでいます。</p>
    </div>

    <div v-else-if="!embedded && store.view === 'list'">
      <div class="mb-8 flex items-center justify-between gap-4">
        <div class="flex items-center gap-3">
          <h1 class="text-4xl font-extrabold tracking-tight text-gray-900">動画管理</h1>
        </div>
        <button
          type="button"
          class="inline-flex items-center gap-2 rounded-xl bg-gray-900 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-60"
          @click="isRegisterModalOpen = true"
        >
          <UIcon name="i-heroicons-plus" class="h-5 w-5" />
          動画を登録
        </button>
      </div>

      <div v-if="store.isLoading" class="flex h-64 items-center justify-center">
        <div class="relative">
          <div class="absolute inset-0 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 opacity-50 blur-lg" />
          <UIcon name="i-heroicons-arrow-path" class="relative h-12 w-12 animate-spin text-purple-600" />
        </div>
      </div>

      <div v-else class="space-y-8">
        <section class="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <div class="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 class="text-xl font-bold text-gray-900">スクリーン撮影</h2>
              <p class="mt-1 text-sm text-gray-500">編集前に画面録画をストックして、必要な素材から動画編集を開始します。</p>
            </div>
            <div class="flex items-center gap-3">
              <span class="rounded-full bg-gray-100 px-3 py-1 text-xs font-bold text-gray-600">{{ screenRecordingVideos.length }}件</span>
              <button
                type="button"
                class="inline-flex items-center gap-2 rounded-xl bg-gray-950 px-4 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-gray-800"
                @click="openScreenRecordingModal"
              >
                <UIcon name="i-heroicons-video-camera" class="h-4 w-4" />
                新しいスクリーンを録画
              </button>
            </div>
          </div>

          <Teleport to="body">
            <div v-if="isScreenRecordingModalOpen" class="fixed inset-0 z-[210] overflow-y-auto bg-slate-950/60 p-4 backdrop-blur-sm">
              <div class="mx-auto my-6 w-full max-w-7xl overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl">
                <div class="flex items-center justify-between gap-4 border-b border-gray-200 px-5 py-4">
                  <div>
                    <h3 class="text-lg font-extrabold text-gray-900">新しいスクリーンを録画</h3>
                    <p class="mt-1 text-sm text-gray-500">画面とマイク音声をまとめて保存し、あとから動画編集素材として使えます。</p>
                  </div>
                  <button
                    type="button"
                    class="rounded-xl p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-900"
                    @click="closeScreenRecordingModal"
                  >
                    <UIcon name="i-heroicons-x-mark" class="h-5 w-5" />
                  </button>
                </div>
                <div class="grid gap-5 p-5 xl:grid-cols-[minmax(0,1.1fr)_minmax(340px,0.9fr)]">
            <div class="space-y-4">
              <div class="relative overflow-hidden rounded-xl border border-gray-200 bg-gray-950 shadow-sm">
                <video
                  v-if="screenRecorder.previewUrl.value"
                  :src="screenRecorder.previewUrl.value"
                  class="aspect-video w-full bg-gray-950 object-contain"
                  controls
                  playsinline
                />
                <video
                  v-else-if="screenRecorder.isRecording.value"
                  ref="screenRecordingLiveVideo"
                  class="aspect-video w-full bg-gray-950 object-contain"
                  muted
                  autoplay
                  playsinline
                />
                <div v-else class="flex aspect-video items-center justify-center p-5 text-center text-sm text-gray-300">
                  <div>
                    <div
                      class="mx-auto mb-4 grid max-w-[300px] place-items-center rounded-xl border-2 border-dashed border-purple-300/80 bg-purple-400/10 text-xs font-bold text-purple-100"
                      :style="{ aspectRatio: `${screenRecorder.selectedAspectPreset.value.width} / ${screenRecorder.selectedAspectPreset.value.height}`, width: screenRecorder.selectedAspectPreset.value.id === '9:16' ? '120px' : 'min(300px, 80%)' }"
                    >
                      {{ screenRecorder.selectedAspectPreset.value.id }}
                    </div>
                    <p class="font-bold text-white">
                      {{ screenRecorder.isRecording.value ? `録画中 ${screenRecorder.elapsedLabel.value}` : "録画ガイド" }}
                    </p>
                    <p class="mt-1 text-xs leading-relaxed text-gray-400">
                      共有するウィンドウを推奨比率に近づけてから開始してください。
                    </p>
                  </div>
                </div>
                <div
                  v-if="screenRecorder.isRecording.value"
                  class="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_15%,rgba(168,85,247,0.22),transparent_28%),radial-gradient(circle_at_80%_20%,rgba(16,185,129,0.16),transparent_26%)]"
                />
                <div
                  v-if="screenRecorder.isRecording.value"
                  class="pointer-events-none absolute left-4 top-4 flex max-w-[calc(100%-2rem)] flex-wrap items-center gap-2"
                >
                  <span class="inline-flex items-center gap-2 rounded-full bg-white/95 px-3 py-1.5 text-xs font-extrabold text-purple-700 shadow-sm ring-1 ring-purple-100">
                    <span class="h-2 w-2 rounded-full bg-purple-500 shadow-[0_0_16px_rgba(168,85,247,0.9)]" />
                    音声理解ライブ
                  </span>
                  <span class="rounded-full bg-emerald-50/95 px-3 py-1.5 text-xs font-bold text-emerald-700 shadow-sm ring-1 ring-emerald-100">
                    音声 {{ Math.round(screenRecorder.audioLevel.value * 100) }}%
                  </span>
                  <span class="rounded-full bg-slate-900/80 px-3 py-1.5 text-xs font-bold text-white shadow-sm">
                    {{ screenRecorder.elapsedLabel.value }}
                  </span>
                </div>
                <div
                  v-if="screenRecorder.isRecording.value"
                  class="pointer-events-none absolute bottom-4 left-4 right-4 rounded-2xl border border-white/25 bg-white/95 p-3 shadow-xl backdrop-blur"
                >
                  <div class="mb-2 flex items-center justify-between gap-3 text-xs">
                    <span class="font-extrabold text-gray-900">音声波形を解析中</span>
                    <span class="font-bold text-gray-500">マイクと画面音声を一緒に記録</span>
                  </div>
                  <div class="flex h-12 items-center gap-1 overflow-hidden rounded-xl bg-slate-950 px-3">
                    <span
                      v-for="(bar, index) in screenRecorder.waveformBars.value"
                      :key="`screen-wave-${index}`"
                      class="flex-1 rounded-full bg-gradient-to-t from-emerald-400 via-cyan-300 to-purple-300 transition-all duration-100"
                      :style="{ height: `${Math.max(10, Math.round(bar * 100))}%`, opacity: 0.48 + Math.min(0.5, bar) }"
                    />
                  </div>
                </div>
              </div>

              <div v-if="screenRecorder.isRecording.value" class="grid gap-3 md:grid-cols-3">
                <div
                  v-for="item in screenRecordingUnderstandingCards"
                  :key="item.label"
                  class="rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-sm"
                >
                  <div class="flex items-center gap-2 text-xs font-extrabold text-gray-500">
                    <UIcon :name="item.icon" class="h-4 w-4" :class="item.iconClass" />
                    {{ item.label }}
                  </div>
                  <p class="mt-1 text-sm font-extrabold text-gray-900">{{ item.value }}</p>
                  <p class="mt-0.5 text-xs font-medium text-gray-500">{{ item.caption }}</p>
                </div>
              </div>

              <div class="grid grid-cols-2 gap-2 md:grid-cols-4">
                <button
                  v-for="preset in screenVideoAspectPresets"
                  :key="preset.id"
                  type="button"
                  class="rounded-xl border px-3 py-2 text-left text-xs font-semibold transition"
                  :class="screenRecorder.selectedAspectPresetId.value === preset.id ? 'border-gray-900 bg-gray-950 text-white' : 'border-gray-200 bg-white text-gray-700 hover:border-purple-200'"
                  @click="screenRecorder.selectedAspectPresetId.value = preset.id"
                >
                  <span class="block text-sm">{{ preset.label }}</span>
                  <span class="mt-0.5 block opacity-75">{{ preset.width }} x {{ preset.height }}</span>
                </button>
              </div>

              <div class="flex flex-wrap items-center justify-between gap-3">
                <div class="flex flex-wrap items-center gap-3 text-xs text-gray-500">
                  <span class="font-bold text-gray-800">{{ screenRecorder.elapsedLabel.value }}</span>
                  <span v-if="screenRecorder.metadata.value">{{ screenRecorder.metadata.value.width }} x {{ screenRecorder.metadata.value.height }}</span>
                  <span v-if="screenRecorder.blob.value">{{ formatBytes(screenRecorder.blob.value.size) }}</span>
                </div>
                <div class="flex flex-wrap gap-2">
                  <button
                    v-if="!screenRecorder.isRecording.value"
                    type="button"
                    class="inline-flex items-center gap-2 rounded-xl bg-gray-900 px-4 py-2 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
                    :disabled="!screenRecorder.isSupported.value || store.isUploading"
                    @click="void startScreenRecordingSession()"
                  >
                    <UIcon name="i-heroicons-video-camera" class="h-4 w-4" />
                    録画開始
                  </button>
                  <button
                    v-else
                    type="button"
                    class="inline-flex items-center gap-2 rounded-xl bg-red-500 px-4 py-2 text-sm font-bold text-white"
                    @click="stopScreenRecordingSession"
                  >
                    <UIcon name="i-heroicons-stop-circle" class="h-4 w-4" />
                    停止
                  </button>
                  <button
                    type="button"
                    class="rounded-xl px-3 py-2 text-sm font-bold text-gray-500 hover:bg-gray-100 disabled:opacity-50"
                    :disabled="screenRecorder.isRecording.value || !screenRecorder.hasRecording.value"
                    @click="resetScreenRecordingSession"
                  >
                    クリア
                  </button>
                </div>
              </div>
            </div>

            <div class="space-y-4 rounded-xl border border-gray-200 bg-gray-50 p-4">
              <div
                v-if="screenRecorder.isRecording.value"
                class="overflow-hidden rounded-2xl border border-purple-100 bg-white shadow-sm"
              >
                <div class="border-b border-purple-50 bg-gradient-to-r from-purple-50 via-white to-emerald-50 px-4 py-3">
                  <div class="flex items-center justify-between gap-3">
                    <div>
                      <p class="text-xs font-extrabold uppercase tracking-[0.18em] text-purple-500">Live Understanding</p>
                      <h3 class="mt-1 text-sm font-extrabold text-gray-900">録画内容を理解中</h3>
                    </div>
                    <UIcon name="i-heroicons-sparkles" class="h-5 w-5 text-purple-500" />
                  </div>
                </div>
                <div class="space-y-3 p-4">
                  <div class="rounded-xl border border-emerald-100 bg-emerald-50/70 px-3 py-3">
                    <div class="flex items-center justify-between gap-3">
                      <div class="flex items-center gap-2">
                        <UIcon name="i-heroicons-microphone" class="h-4 w-4 text-emerald-600" />
                        <p class="text-xs font-extrabold text-emerald-900">リアルタイム文字起こし</p>
                      </div>
                      <span
                        class="rounded-full px-2 py-0.5 text-[10px] font-extrabold"
                        :class="screenRecordingTranscriptBadgeClass"
                      >
                        {{ screenRecordingTranscriptBadgeLabel }}
                      </span>
                    </div>
                    <p class="mt-1 text-xs leading-5 text-emerald-700">{{ screenRecordingTranscriptStatusLabel }}</p>
                    <div class="mt-3 max-h-36 overflow-y-auto rounded-lg border border-emerald-100 bg-white px-3 py-2 text-xs leading-6 text-gray-700">
                      <div v-if="screenRecordingTranscriptLines.length > 0" class="space-y-2">
                        <p
                          v-for="(line, index) in screenRecordingTranscriptLines"
                          :key="`screen-transcript-${index}`"
                          :class="index === screenRecordingTranscriptLines.length - 1 && screenRecordingTranscriptInterim ? 'text-gray-500' : 'text-gray-800'"
                        >
                          {{ line }}
                        </p>
                      </div>
                      <p v-else class="text-gray-400">録画中に話すと、ここに発話内容が逐次表示されます。</p>
                    </div>
                    <p v-if="screenRecordingTranscriptError" class="mt-2 text-xs font-semibold text-red-600">
                      {{ screenRecordingTranscriptError }}
                    </p>
                  </div>
                  <div
                    v-for="line in screenRecordingLiveInterpretationLines"
                    :key="line.title"
                    class="rounded-xl border border-gray-100 bg-gray-50 px-3 py-2"
                  >
                    <div class="flex items-start gap-2">
                      <span class="mt-1 h-2 w-2 shrink-0 rounded-full" :class="line.dotClass" />
                      <div>
                        <p class="text-xs font-extrabold text-gray-900">{{ line.title }}</p>
                        <p class="mt-0.5 text-xs leading-5 text-gray-500">{{ line.body }}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div class="grid grid-cols-2 gap-2 text-xs font-semibold text-gray-700">
                <label class="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2">
                  <input v-model="screenRecorder.includeSystemAudio.value" type="checkbox" class="h-4 w-4 rounded border-gray-300 text-purple-600">
                  システム音声
                </label>
                <label class="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2">
                  <input v-model="screenRecorder.includeMicrophone.value" type="checkbox" class="h-4 w-4 rounded border-gray-300 text-purple-600">
                  マイク
                </label>
              </div>
              <label class="block text-sm font-bold text-gray-800">
                撮影タイトル <span class="text-red-500">*</span>
                <input v-model="screenRecordingTitle" class="mt-2 w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none focus:border-purple-300 focus:ring-4 focus:ring-purple-100" placeholder="例: 管理画面の初回設定フロー">
              </label>
              <label class="block text-sm font-bold text-gray-800">
                メモ <span class="text-xs font-normal text-gray-400">(任意)</span>
                <textarea v-model="screenRecordingDescription" rows="3" class="mt-2 w-full resize-none rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none focus:border-purple-300 focus:ring-4 focus:ring-purple-100" placeholder="あとで選ぶ時に分かる用途や操作内容" />
              </label>
              <label class="block text-sm font-bold text-gray-800">
                タグ <span class="text-xs font-normal text-gray-400">(カンマ区切り)</span>
                <input v-model="screenRecordingTagsText" class="mt-2 w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none focus:border-purple-300 focus:ring-4 focus:ring-purple-100" placeholder="demo, onboarding">
              </label>
              <div
                class="rounded-xl border px-3 py-2 text-xs font-semibold"
                :class="screenRecorder.aspectCheck.value.status === 'matched' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : screenRecorder.aspectCheck.value.status === 'near' ? 'border-amber-200 bg-amber-50 text-amber-700' : screenRecorder.aspectCheck.value.status === 'mismatch' ? 'border-red-200 bg-red-50 text-red-700' : 'border-gray-200 bg-white text-gray-600'"
              >
                <div class="font-bold">{{ screenRecorder.aspectCheck.value.label }}</div>
                <div class="mt-0.5 font-medium">{{ screenRecorder.aspectCheck.value.detail }}</div>
              </div>
              <p v-if="screenRecorder.errorMessage.value" class="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">
                {{ screenRecorder.errorMessage.value }}
              </p>
              <div v-if="store.isUploading || isScreenRecordingSaving">
                <div class="h-2 overflow-hidden rounded-full bg-gray-200">
                  <div class="h-full bg-purple-500" :style="{ width: `${store.isUploading ? store.uploadProgress : 100}%` }" />
                </div>
                <p class="mt-1 text-xs text-gray-500">
                  {{ store.isUploading ? `スクリーン撮影を保存中 ${store.uploadProgress}%` : "サムネイルとシーンを生成中" }}
                </p>
              </div>
              <button
                type="button"
                class="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-purple-600 px-4 py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
                :disabled="screenRecordingSaveDisabled"
                @click="void saveScreenRecordingAsset()"
              >
                <UIcon name="i-heroicons-archive-box-arrow-down" class="h-5 w-5" />
                スクリーン撮影として保存
              </button>
            </div>
          </div>
              </div>
            </div>
          </Teleport>

          <div class="mt-6">
            <div v-if="screenRecordingVideos.length === 0" class="rounded-xl border border-dashed border-gray-200 bg-gray-50 px-4 py-8 text-center text-sm text-gray-500">
              保存済みのスクリーン撮影はありません。
            </div>
            <div v-else class="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              <article
                v-for="video in screenRecordingVideos"
                :key="video.id"
                class="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm"
              >
                <button class="relative flex aspect-video w-full items-center justify-center overflow-hidden bg-gray-950 text-gray-300" type="button" @click="void openScreenRecordingDetail(video.id)">
                  <img v-if="video.thumbnailUrl" :src="video.thumbnailUrl" alt="" class="h-full w-full object-cover">
                  <UIcon v-else name="i-heroicons-video-camera" class="h-10 w-10" />
                  <span v-if="video.sceneThumbnails.length" class="absolute bottom-2 right-2 rounded-full bg-black/65 px-2 py-0.5 text-[10px] font-bold text-white">
                    {{ video.sceneThumbnails.length }} scenes
                  </span>
                </button>
                <div class="space-y-3 p-4">
                  <div>
                    <h3 class="truncate text-sm font-bold text-gray-900">{{ video.title }}</h3>
                    <p class="mt-1 line-clamp-2 text-xs leading-5 text-gray-500">{{ video.description || "説明なし" }}</p>
                  </div>
                  <div class="flex flex-wrap items-center gap-2 text-xs text-gray-500">
                    <span v-if="video.duration">{{ formatDuration(video.duration) }}</span>
                    <span v-for="tag in video.tags.slice(0, 3)" :key="tag" class="rounded-full bg-gray-100 px-2 py-0.5 font-semibold text-gray-600">{{ tag }}</span>
                  </div>
                  <div class="flex gap-2">
                    <button class="flex-1 rounded-lg bg-gray-100 px-3 py-2 text-xs font-bold text-gray-700 hover:bg-gray-200" type="button" @click="void openScreenRecordingDetail(video.id)">
                      詳細
                    </button>
                    <button class="flex-1 rounded-lg bg-emerald-500 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-600" type="button" @click="void startEditorFromScreenRecording(video.id)">
                      この録画で編集
                    </button>
                  </div>
                </div>
              </article>
            </div>
          </div>
        </section>

        <section class="space-y-4">
          <div class="flex items-center justify-between gap-3">
            <div>
              <h2 class="text-xl font-bold text-gray-900">素材動画</h2>
              <p class="mt-1 text-sm text-gray-500">アップロードまたは YouTube から登録した編集素材です。</p>
            </div>
            <span class="rounded-full bg-white px-3 py-1 text-xs font-bold text-gray-600 shadow-sm">{{ sourceVideos.length }}件</span>
          </div>
          <div v-if="sourceVideos.length === 0" class="rounded-[1.5rem] border border-purple-100 bg-white/60 py-12 text-center shadow-sm backdrop-blur">
            <UIcon name="i-heroicons-film" class="mx-auto mb-4 h-16 w-16 text-purple-400" />
            <p class="mb-2 text-base font-bold text-gray-600">素材動画がまだありません</p>
            <p class="text-sm text-gray-500">右上のボタンからアップロードまたは YouTube 動画を登録しましょう</p>
          </div>
          <div v-else class="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          <article
            v-for="video in sourceVideos"
            :key="video.id"
            class="group cursor-pointer overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm transition hover:border-purple-200 hover:shadow-lg"
            @click="void store.openVideo(video.id)"
          >
            <div class="relative aspect-video bg-gray-100">
              <img v-if="video.thumbnailUrl" :src="video.thumbnailUrl" alt="" class="h-full w-full object-cover">
              <div v-else class="flex h-full items-center justify-center">
                <UIcon name="i-heroicons-film" class="h-12 w-12 text-gray-400" />
              </div>
              <span class="absolute right-3 top-3 z-20 rounded-full px-2.5 py-1 text-xs font-bold shadow" :class="statusClass(video.transcriptionStatus)">
                {{ statusLabel(video.transcriptionStatus) }}
              </span>
              <div class="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 transition group-hover:opacity-100">
                <div class="rounded-full bg-white/90 p-4">
                  <UIcon name="i-heroicons-play-solid" class="h-8 w-8 text-purple-600" />
                </div>
              </div>
            </div>
            <div class="p-4">
              <h3 class="truncate text-base font-bold text-gray-900">{{ video.title }}</h3>
              <p class="mt-1 line-clamp-2 min-h-[2.5rem] text-sm text-gray-500">{{ video.description || "説明なし" }}</p>
              <div class="mt-3 flex flex-wrap items-center gap-2 text-xs text-gray-500">
                <span class="inline-flex items-center gap-1">
                  <UIcon :name="sourceIcon(video.sourceType)" class="h-3.5 w-3.5" />
                  {{ sourceLabel(video.sourceType) }}
                </span>
                <span v-if="video.duration">/ {{ formatDuration(video.duration) }}</span>
              </div>
            </div>
          </article>
          </div>
        </section>
        </div>
      </div>

    <div v-else-if="!embedded && store.view === 'detail' && store.selectedVideo" class="space-y-6">
      <div class="text-sm text-gray-500">
        <button class="font-semibold text-purple-700 hover:text-purple-900" @click="store.view = 'list'">動画管理</button>
        <span class="mx-2">/</span>
        <span>{{ store.selectedVideo.title }}</span>
      </div>

      <div class="flex items-center justify-between gap-4">
        <div class="flex min-w-0 items-center gap-3">
          <button class="rounded-xl p-2 text-gray-600 hover:bg-white" @click="store.view = 'list'">
            <UIcon name="i-heroicons-arrow-left" class="h-5 w-5" />
          </button>
          <div class="min-w-0">
            <h1 class="truncate text-2xl font-bold text-gray-900">{{ store.selectedVideo.title }}</h1>
            <div class="mt-1 flex flex-wrap items-center gap-3 text-sm text-gray-500">
              <span>{{ sourceLabel(store.selectedVideo.sourceType) }}</span>
              <span v-if="store.selectedVideo.duration">• {{ formatDuration(store.selectedVideo.duration) }}</span>
            </div>
            <p v-if="store.selectedVideo.description" class="mt-2 text-sm leading-relaxed text-gray-600">
              {{ store.selectedVideo.description }}
            </p>
          </div>
        </div>
        <button class="inline-flex items-center gap-2 rounded-xl bg-red-500 px-4 py-2 text-sm font-bold text-white shadow-md hover:bg-red-600" @click="void store.deleteVideo(store.selectedVideo!.id)">
          <UIcon name="i-heroicons-trash" class="h-4 w-4" />
          削除
        </button>
      </div>

      <div class="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <section class="lg:col-span-8">
          <div v-if="store.selectedVideo.sourceType !== 'youtube'" class="mb-3 flex gap-2">
            <button class="rounded-lg bg-purple-600 px-3 py-1.5 text-sm font-bold text-white">元動画</button>
            <button class="rounded-lg bg-gray-100 px-3 py-1.5 text-sm font-bold text-gray-500" disabled>圧縮版</button>
            <button class="rounded-lg bg-gray-100 px-3 py-1.5 text-sm font-bold text-gray-500" disabled>MP4変換版</button>
          </div>
          <div class="aspect-video overflow-hidden rounded-xl bg-gray-900">
            <iframe v-if="youtubeEmbedUrl" :src="youtubeEmbedUrl" class="h-full w-full" allowfullscreen />
            <video v-else-if="store.selectedVideoUrl" ref="detailVideoPlayer" :src="store.selectedVideoUrl" class="h-full w-full" controls />
            <div v-else class="flex h-full items-center justify-center">
              <UIcon name="i-heroicons-film" class="h-20 w-20 text-gray-600" />
            </div>
          </div>
          <div v-if="store.selectedVideo.sourceType === 'screen_recording' && store.selectedVideo.sceneThumbnails.length" class="mt-5 rounded-xl border border-gray-200 bg-white p-4">
            <div class="mb-3 flex items-center justify-between gap-3">
              <div>
                <h3 class="text-sm font-extrabold text-gray-900">シーン一覧</h3>
                <p class="mt-0.5 text-xs text-gray-500">録画保存時に約5秒ごとに切り出したプレビューです。</p>
              </div>
              <span class="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-bold text-gray-600">{{ store.selectedVideo.sceneThumbnails.length }}件</span>
            </div>
            <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <button
                v-for="scene in store.selectedVideo.sceneThumbnails"
                :key="`${scene.timestampSeconds}-${scene.imageUrl}`"
                type="button"
                class="group overflow-hidden rounded-lg border border-gray-200 bg-gray-50 text-left transition hover:border-purple-200 hover:shadow-sm"
                @click="seekDetailVideo(scene.timestampSeconds)"
              >
                <div class="relative aspect-video bg-gray-950">
                  <img :src="scene.imageUrl" alt="" class="h-full w-full object-cover">
                  <span class="absolute bottom-2 left-2 rounded-full bg-black/70 px-2 py-0.5 text-[10px] font-bold text-white">{{ formatDuration(scene.timestampSeconds) }}</span>
                  <span class="absolute inset-0 grid place-items-center bg-black/0 transition group-hover:bg-black/25">
                    <UIcon name="i-heroicons-play-solid" class="h-7 w-7 text-white opacity-0 transition group-hover:opacity-100" />
                  </span>
                </div>
              </button>
            </div>
          </div>
        </section>

        <aside class="lg:col-span-4">
          <div class="sticky top-6 rounded-lg border border-gray-200 bg-white p-6">
            <div class="mb-6 flex items-center justify-between">
              <div class="flex items-center gap-3">
                <div class="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-100">
                  <UIcon name="i-heroicons-folder" class="h-6 w-6 text-indigo-600" />
                </div>
                <div>
                  <h2 class="text-xl font-bold text-gray-900">プロジェクト一覧</h2>
                  <p class="text-sm text-gray-500">{{ store.projects.length }}件のプロジェクト</p>
                </div>
              </div>
            </div>

            <button class="mb-6 inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2 text-sm font-bold text-white shadow hover:bg-emerald-600" @click="isProjectCreateModalOpen = true">
              <UIcon name="i-heroicons-plus" class="h-5 w-5" />
              新規作成
            </button>

            <div v-if="store.isLoading" class="flex justify-center py-12">
              <UIcon name="i-heroicons-arrow-path" class="h-8 w-8 animate-spin text-indigo-600" />
            </div>
            <div v-else-if="store.projects.length > 0" class="max-h-[calc(100vh-20rem)] space-y-3 overflow-y-auto pr-2">
              <div
                v-for="project in store.projects"
                :key="project.id"
                class="cursor-pointer rounded-lg border border-gray-200 bg-white p-4 transition hover:border-indigo-300 hover:shadow-md"
                @click="void openEditor(project.id)"
              >
                <div class="mb-3 flex items-start justify-between gap-3">
                  <h4 class="truncate font-bold text-gray-900">{{ project.name }}</h4>
                  <span class="rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-bold text-indigo-700">{{ projectStatusLabel(project.status) }}</span>
                </div>
                <p v-if="project.description" class="mb-3 line-clamp-2 text-sm text-gray-600">{{ project.description }}</p>
                <div class="mb-3 flex items-center gap-2 text-xs text-gray-500">
                  <UIcon name="i-heroicons-calendar" class="h-3.5 w-3.5" />
                  <span>{{ formatTimestamp(project.updatedAt) }}</span>
                </div>
                <div class="grid gap-1" :class="projectProgressStepKeys(project).length === 4 ? 'grid-cols-4' : 'grid-cols-5'">
                  <span v-for="step in projectProgressStepKeys(project)" :key="step" class="h-1.5 rounded-full" :class="projectStepIndex(project.currentStep, projectProgressStepKeys(project)) >= projectStepIndex(step, projectProgressStepKeys(project)) ? 'bg-indigo-500' : 'bg-gray-200'" />
                </div>
              </div>
            </div>
            <div v-else class="rounded-lg bg-gray-50 py-12 text-center">
              <UIcon name="i-heroicons-folder-open" class="mx-auto mb-3 h-12 w-12 text-gray-400" />
              <p class="mb-1 font-bold text-gray-600">プロジェクトがまだありません</p>
              <p class="text-sm text-gray-500">上のボタンから新しいプロジェクトを作成しましょう</p>
            </div>
          </div>
        </aside>
      </div>
    </div>

    <div
      v-else-if="store.view === 'editor' && store.selectedProject"
      class="video-editor-light fixed inset-0 z-[90] flex h-dvh min-h-0 w-screen flex-col overflow-hidden bg-gray-900 text-white"
      data-testid="video-studio-fullscreen-editor"
    >
      <header class="flex items-center justify-between border-b border-gray-700 bg-gray-800 px-4 py-2">
        <div class="flex min-w-0 items-center gap-4">
          <h2 class="truncate font-bold text-white">{{ store.selectedVideo?.title || store.selectedProject.editorState.video.title }}</h2>
          <div class="flex min-w-0 items-center gap-2 text-sm text-gray-300">
            <UIcon name="i-heroicons-folder-solid" class="h-4 w-4 text-gray-400" />
            <span class="truncate">{{ store.selectedProject.name }}</span>
          </div>
        </div>
        <div class="flex items-center gap-2">
          <div class="flex items-center gap-1 rounded-lg border border-gray-600 bg-gray-700/50 px-1.5 py-1">
            <button class="rounded p-1 text-white hover:bg-gray-600" @click="editorZoom = Math.max(50, editorZoom - 10)">
              <UIcon name="i-heroicons-minus" class="h-4 w-4" />
            </button>
            <span class="min-w-[2.5rem] text-center text-xs text-gray-300">{{ editorZoom }}%</span>
            <button class="rounded p-1 text-white hover:bg-gray-600" @click="editorZoom = Math.min(150, editorZoom + 10)">
              <UIcon name="i-heroicons-plus" class="h-4 w-4" />
            </button>
          </div>
          <button class="inline-flex items-center gap-2 rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-bold text-white shadow hover:bg-emerald-600" @click="void saveEditorSections()">
            <span class="rounded bg-white/20 px-1">⌘</span><span class="rounded bg-white/20 px-1">S</span>
            保存
          </button>
          <button class="rounded-lg bg-gray-700 px-3 py-1.5 text-xs font-bold text-gray-100 hover:bg-gray-600" @click="showDebugInfo = !showDebugInfo">
            Debug
          </button>
          <button class="rounded-lg bg-gray-700 px-3 py-1.5 text-xs font-bold text-gray-100 hover:bg-gray-600" @click="void saveAndCloseEditor()">
            保存して閉じる
          </button>
        </div>
      </header>

      <div class="border-b border-gray-700 bg-gray-800 px-4 py-1.5">
        <div class="flex items-center gap-3">
          <div class="flex flex-1 items-center gap-2">
            <div
              v-for="(step, index) in workflowSteps"
              :key="step.key"
              class="flex min-w-0 flex-1 items-center gap-2 rounded-lg px-3 py-2 transition"
              :class="workflowStepClass(step.key, index)"
            >
              <span class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ring-1 ring-inset" :class="workflowStepBadgeClass(step.key, index)">
                <UIcon v-if="isWorkflowStepCompleted(step.key)" name="i-heroicons-check-solid" class="h-4 w-4" />
                <span v-else>{{ index + 1 }}</span>
              </span>
              <span class="truncate text-sm font-bold">{{ step.title }}</span>
              <span v-if="isWorkflowStepCompleted(step.key)" class="ml-auto hidden rounded-full bg-emerald-400/15 px-2 py-0.5 text-[10px] font-bold text-emerald-200 ring-1 ring-inset ring-emerald-400/25 xl:inline">
                完了
              </span>
            </div>
          </div>
          <button v-if="currentWorkflowIndex > 0" type="button" class="rounded-lg bg-gray-700 px-3 py-1.5 text-xs font-bold text-gray-200 hover:bg-gray-600" :disabled="Boolean(activeRequest)" @click.stop.prevent="setWorkflowIndex(currentWorkflowIndex - 1)">
            前へ
          </button>
          <button v-if="currentWorkflowIndex < workflowSteps.length - 1" type="button" class="rounded-lg bg-indigo-500 px-3 py-1.5 text-xs font-bold text-white hover:bg-indigo-600 disabled:opacity-50" :disabled="Boolean(activeRequest)" @click.stop.prevent="handleWorkflowNext">
            {{ activeRequest === "transcription" ? "文字起こし中..." : "次へ" }}
          </button>
        </div>
      </div>

      <div class="flex min-h-0 flex-1 overflow-hidden" :style="{ zoom: editorZoom / 100 }">
        <aside v-if="!isExportStep && !isSubtitleStep && isSectionSidebarOpen" class="flex w-72 shrink-0 flex-col border-r border-gray-700 bg-gray-850">
          <div class="flex items-center justify-between border-b border-gray-700 px-3 py-2">
            <h3 class="text-sm font-bold text-gray-100">セクション</h3>
            <button
              type="button"
              class="inline-flex h-8 w-8 items-center justify-center rounded bg-gray-700 text-gray-200 hover:bg-gray-600"
              title="セクション一覧を隠す"
              @click="isSectionSidebarOpen = false"
            >
              <UIcon name="i-heroicons-chevron-left" class="h-4 w-4" />
            </button>
          </div>
          <div class="min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
            <article
              v-for="(section, index) in editorSections"
              :key="section.id"
              role="button"
              tabindex="0"
              class="w-full rounded-lg border p-2 text-left transition"
              :class="[
                selectedSectionIndex === index ? 'border-indigo-400 bg-indigo-500/15' : 'border-gray-700 bg-gray-800 hover:bg-gray-750',
                section.isFixed ? 'ring-1 ring-emerald-400/40' : ''
              ]"
              @click="selectSection(index)"
              @keydown.enter.prevent="selectSection(index)"
              @keydown.space.prevent="selectSection(index)"
            >
              <div class="relative aspect-video overflow-hidden rounded bg-gray-950">
                <img v-if="timelineThumbnail(section.id, 'start')?.kind === 'image'" :src="timelineThumbnail(section.id, 'start')?.url" alt="" class="h-full w-full object-cover">
                <video v-else-if="timelineThumbnail(section.id, 'start')?.kind === 'video'" :src="timelineThumbnail(section.id, 'start')?.url" class="h-full w-full object-cover" muted playsinline preload="metadata" @loadedmetadata="handleTimelineThumbnailVideoReady($event, timelineThumbnail(section.id, 'start'), 'loadedmetadata')" @loadeddata="handleTimelineThumbnailVideoReady($event, timelineThumbnail(section.id, 'start'), 'loadeddata')" @canplay="handleTimelineThumbnailVideoReady($event, timelineThumbnail(section.id, 'start'), 'canplay')" @error="handleTimelineThumbnailVideoError($event, section.id, 'start')" />
                <div v-else class="flex h-full items-center justify-center">
                  <UIcon name="i-heroicons-film" class="h-8 w-8 text-gray-600" />
                </div>
                <div v-if="section.isFixed" class="absolute inset-0 flex items-center justify-center bg-gray-950/65 backdrop-grayscale">
                  <div class="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-400 text-gray-950 shadow-lg shadow-emerald-500/30">
                    <UIcon name="i-heroicons-check-solid" class="h-7 w-7" />
                  </div>
                </div>
              </div>
              <div class="mt-2 flex items-center justify-between gap-2">
                <span class="truncate text-sm font-bold text-gray-100">{{ section.title || `セクション ${index + 1}` }}</span>
                <span class="rounded bg-gray-700 px-1.5 py-0.5 text-[10px] text-gray-300">{{ formatDuration(section.startTime) }}</span>
              </div>
              <div class="mt-2 grid grid-cols-2 gap-1 text-[10px] font-bold">
                <span class="rounded bg-gray-950 px-2 py-1 text-gray-300">
                  文字 {{ sectionTranscriptionCompleted(section) ? "完了" : "未完了" }}
                </span>
                <span class="rounded px-2 py-1" :class="sectionHasGeneratedAudio(section) ? 'bg-emerald-500/15 text-emerald-200' : 'bg-gray-950 text-gray-400'">
                  AI音声 {{ generatedNarrationCount(section) }}/{{ section.finalyNarrations.length }}
                </span>
              </div>
              <div class="mt-2 flex items-center justify-between gap-2">
                <span class="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold" :class="section.isFixed ? 'bg-emerald-500/15 text-emerald-200' : sectionFixable(section) ? 'bg-indigo-500/15 text-indigo-200' : 'bg-gray-700 text-gray-400'">
                  <UIcon :name="section.isFixed ? 'i-heroicons-check-circle-solid' : 'i-heroicons-lock-open'" class="h-3 w-3" />
                  {{ section.isFixed ? "確定済" : sectionFixable(section) ? "確定可能" : "未確定" }}
                </span>
                <button
                  type="button"
                  class="rounded px-2 py-1 text-[10px] font-bold transition disabled:cursor-not-allowed disabled:opacity-50"
                  :class="section.isFixed ? 'bg-emerald-500/20 text-emerald-100 hover:bg-emerald-500/30' : 'bg-gray-700 text-gray-100 hover:bg-gray-600'"
                  :disabled="!section.isFixed && !sectionFixable(section)"
                  @click.stop="toggleSectionFixed(index)"
                >
                  {{ section.isFixed ? "解除" : "確定" }}
                </button>
              </div>
              <p class="mt-1 text-xs text-gray-400">{{ formatDuration(section.startTime) }} - {{ formatDuration(section.endTime) }}</p>
              <div v-if="sectionRecordingWaveformBars(section, 42).length > 0" class="mt-2 rounded-md bg-gray-950 p-1.5">
                <div class="audio-waveform-mini flex h-10 items-end gap-0.5 overflow-hidden rounded bg-gray-950 px-1">
                  <span
                    v-for="bar in sectionRecordingWaveformBars(section, 42)"
                    :key="bar.key"
                    class="w-0.5 rounded-sm bg-emerald-400"
                    :style="{ height: `${bar.height}%` }"
                  />
                </div>
              </div>
            </article>
            <div v-if="editorSections.length === 0" class="rounded-lg border border-dashed border-gray-600 p-4 text-sm leading-6 text-gray-400">
              自動セクション化の結果がここに表示されます。
            </div>
          </div>
        </aside>
        <aside v-else-if="!isExportStep && !isSubtitleStep" class="flex w-12 shrink-0 flex-col items-center border-r border-gray-700 bg-gray-850 py-2">
          <button
            type="button"
            class="inline-flex h-8 w-8 items-center justify-center rounded bg-gray-700 text-gray-200 hover:bg-gray-600"
            title="セクション一覧を表示"
            @click="isSectionSidebarOpen = true"
          >
            <UIcon name="i-heroicons-bars-3" class="h-4 w-4" />
          </button>
          <span class="mt-3 text-[10px] font-bold tracking-widest text-gray-500" style="writing-mode: vertical-rl;">セクション</span>
        </aside>

        <main class="flex min-w-0 flex-1 flex-col overflow-hidden">
          <div v-if="!isAiNarrationStep && !isExportStep && !isSubtitleStep" class="flex min-h-[260px] flex-[0_0_46%] items-center justify-center bg-black">
            <iframe v-if="youtubeEmbedUrl" :src="youtubeEmbedUrl" class="h-full w-full" allowfullscreen />
            <div v-else-if="store.selectedVideoUrl" class="relative h-full w-full">
              <video
                ref="editorVideo"
                :src="store.selectedVideoUrl"
                class="h-full w-full object-contain"
                controls
                @timeupdate="syncCurrentTime"
                @loadedmetadata="syncDuration"
                @play="handleEditorVideoPlay"
                @pause="handleEditorVideoPause"
                @ended="handleEditorVideoEnded"
              />
              <div
                v-if="recordingCountdown !== null"
                class="pointer-events-none absolute inset-0 z-30 flex items-center justify-center bg-black/35"
                aria-live="polite"
              >
                <div class="flex h-28 w-28 items-center justify-center rounded-full border-4 border-white/70 bg-gray-950/80 text-6xl font-black text-white shadow-[0_0_40px_rgba(99,102,241,0.65)]">
                  {{ recordingCountdown }}
                </div>
              </div>
              <audio ref="recordingPlaybackAudio" preload="auto" />
            </div>
            <div v-else class="flex flex-col items-center gap-2 text-gray-400">
              <UIcon name="i-heroicons-arrow-path" class="h-8 w-8 animate-spin" />
              <span class="text-sm">動画を読み込み中...</span>
            </div>
          </div>

          <div v-if="isAiNarrationStep" class="min-h-0 flex-1 overflow-auto bg-gray-900 p-4">
            <div class="mb-3 flex flex-wrap items-center justify-between gap-3">
              <div class="flex min-w-0 flex-wrap items-center gap-3">
                <h3 class="shrink-0 text-lg font-bold">AIナレーション</h3>
                <div class="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    class="inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-bold transition"
                    :class="aiNarrationSubStep === 'transcription' ? 'border-indigo-300 bg-indigo-500 text-white' : 'border-emerald-500/40 bg-emerald-500/10 text-emerald-100'"
                    @click="aiNarrationMode = 'narration'"
                  >
                    <span class="flex h-5 w-5 items-center justify-center rounded-full bg-white/20 text-[11px]">1</span>
                    文字起こし
                    <span class="text-[11px] opacity-80">{{ completedTranscriptionSections }}/{{ transcribableSectionsCount }}</span>
                  </button>
                  <button
                    type="button"
                    class="inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-bold transition disabled:cursor-not-allowed disabled:opacity-50"
                    :class="aiNarrationSubStep === 'adjustment' ? 'border-indigo-300 bg-indigo-500 text-white' : 'border-gray-700 bg-gray-850 text-gray-400'"
                    :disabled="aiNarrationSubStep === 'transcription'"
                    @click="aiNarrationMode = 'narration'"
                  >
                    <span class="flex h-5 w-5 items-center justify-center rounded-full bg-white/20 text-[11px]">2</span>
                    ナレーション調整
                  </button>
                </div>
              </div>
              <div v-if="aiNarrationSubStep === 'adjustment'" class="flex items-center gap-2">
                <div class="flex rounded-lg border border-gray-700 bg-gray-850 p-1">
                  <button class="rounded-md px-3 py-1.5 text-xs font-bold" :class="aiNarrationMode === 'narration' ? 'bg-indigo-500 text-white' : 'text-gray-300 hover:bg-gray-700'" @click="aiNarrationMode = 'narration'">
                    ナレーション調整
                  </button>
                  <button class="rounded-md px-3 py-1.5 text-xs font-bold" :class="aiNarrationMode === 'timing' ? 'bg-indigo-500 text-white' : 'text-gray-300 hover:bg-gray-700'" @click="aiNarrationMode = 'timing'">
                    時刻微調整
                  </button>
                </div>
                <button class="inline-flex items-center gap-2 rounded-lg border border-gray-600 px-3 py-1.5 text-xs font-bold text-gray-200 hover:bg-gray-700" @click.stop.prevent="openVoiceSelectorModal">
                  <UIcon name="i-heroicons-speaker-wave" class="h-4 w-4" />
                  読み上げ音声
                  <span class="rounded bg-gray-700 px-1.5 py-0.5 text-[10px] text-gray-300">{{ currentVoiceInfo.displayName }}</span>
                </button>
                <button
                  v-if="aiNarrationMode === 'narration'"
                  type="button"
                  class="inline-flex items-center gap-2 rounded-lg bg-purple-500 px-3 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-purple-600 disabled:cursor-not-allowed disabled:opacity-50"
                  :disabled="isBulkTtsProcessing || pendingTtsSegmentsCount === 0 || activeRequest === 'export'"
                  @click="void requestBulkTts()"
                >
                  <UIcon :name="isBulkTtsProcessing ? 'i-heroicons-arrow-path' : 'i-heroicons-sparkles'" class="h-4 w-4" :class="isBulkTtsProcessing ? 'animate-spin' : ''" />
                  全セクションAI音声
                  <span class="rounded bg-white/20 px-1.5 py-0.5 text-[10px]">{{ pendingTtsSegmentsCount }}</span>
                </button>
                <button v-if="aiNarrationMode === 'narration'" class="rounded-lg border border-gray-600 px-3 py-1.5 text-xs font-bold text-gray-200 hover:bg-gray-700" @click="void addNarrationSegment(selectedSectionIndex)">
                  セクションを追加
                </button>
              </div>
            </div>

            <div v-if="requestNotice" class="mb-4 rounded-lg border px-3 py-2 text-sm" :class="requestNotice.kind === 'error' ? 'border-red-500/40 bg-red-500/10 text-red-200' : 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200'">
              {{ requestNotice.message }}
            </div>

            <div v-if="selectedSectionForRecording" class="mb-4 flex flex-wrap items-center gap-2">
              <span class="rounded-full border border-gray-600 px-3 py-1 text-xs font-bold text-gray-200">
                {{ selectedSectionForRecording.title || `セクション ${selectedSectionIndex + 1}` }} を選択中
              </span>
              <span class="text-xs text-gray-500">{{ transcriptionStatusLabel(selectedSectionForRecording) }}</span>
              <span class="rounded-full bg-gray-800 px-3 py-1 text-xs font-bold text-gray-300">
                確定 {{ fixedSectionsCount }}/{{ editorSections.length }}
              </span>
              <button
                v-if="aiNarrationSubStep === 'adjustment'"
                type="button"
                class="inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-bold transition disabled:cursor-not-allowed disabled:opacity-50"
                :class="selectedSectionForRecording.isFixed ? 'bg-emerald-500 text-white hover:bg-emerald-600' : 'bg-indigo-500 text-white hover:bg-indigo-600'"
                :disabled="!selectedSectionForRecording.isFixed && !sectionFixable(selectedSectionForRecording)"
                :title="selectedSectionFixHelp"
                @click="toggleSectionFixed(selectedSectionIndex)"
              >
                <UIcon :name="selectedSectionForRecording.isFixed ? 'i-heroicons-check-circle-solid' : 'i-heroicons-check'" class="h-4 w-4" />
                {{ selectedSectionForRecording.isFixed ? "編集確定済み" : "編集を確定" }}
              </button>
              <span v-if="aiNarrationSubStep === 'adjustment' && !selectedSectionForRecording.isFixed && !sectionFixable(selectedSectionForRecording)" class="text-xs text-amber-200">
                {{ selectedSectionFixHelp }}
              </span>
            </div>

            <div v-if="aiNarrationSubStep === 'transcription'" class="flex h-[calc(100%-8rem)] min-h-[520px] flex-col rounded-xl border border-gray-700 bg-gray-850">
              <div class="flex items-center justify-between border-b border-gray-700 px-4 py-3">
                <h4 class="flex items-center gap-2 text-lg font-bold text-gray-100">
                  <UIcon name="i-heroicons-arrow-path" class="h-5 w-5 animate-spin text-indigo-300" />
                  文字起こし進捗
                </h4>
                <span class="rounded-full bg-indigo-500/15 px-3 py-1 text-xs font-bold text-indigo-200">
                  {{ completedTranscriptionSections }}/{{ transcribableSectionsCount }} 完了
                </span>
              </div>
              <div class="min-h-0 flex-1 overflow-auto p-4">
                <div class="mb-4 flex justify-end">
                  <button class="rounded-xl bg-gray-700 px-4 py-2 text-sm font-bold text-gray-100 hover:bg-gray-600 disabled:opacity-50" :disabled="Boolean(activeRequest)" @click="requestBulkTranscription">
                    一括で音声書き起こし
                  </button>
                </div>
                <div class="space-y-3">
                  <article
                    v-for="item in transcriptionProgressItems"
                    :key="item.section.id"
                    class="rounded-lg border border-gray-700 bg-gray-900 p-4"
                  >
                    <div class="flex items-center justify-between gap-3">
                      <div class="min-w-0">
                        <p class="truncate text-sm font-bold text-gray-100">{{ item.section.title || `セクション ${item.index + 1}` }}</p>
                        <p class="mt-1 text-xs text-gray-500">{{ formatDuration(item.section.startTime) }} - {{ formatDuration(item.section.endTime) }}</p>
                      </div>
                      <span class="shrink-0 rounded-full px-3 py-1 text-xs font-bold" :class="transcriptionProgressBadgeClass(item.section)">
                        {{ transcriptionStatusLabel(item.section) }}
                      </span>
                    </div>
                    <div class="mt-3 h-2 overflow-hidden rounded-full bg-gray-800">
                      <div class="h-full rounded-full transition-all" :class="item.isCompleted ? 'bg-emerald-400' : item.isError ? 'bg-red-400' : 'bg-indigo-400'" :style="{ width: `${item.progress}%` }" />
                    </div>
                    <div v-if="item.isError" class="mt-3 flex justify-end">
                      <button class="rounded-lg bg-red-500/15 px-3 py-1.5 text-xs font-bold text-red-100 hover:bg-red-500/25 disabled:opacity-50" :disabled="Boolean(activeRequest)" @click="requestSectionTranscription(item.index)">
                        再実行
                      </button>
                    </div>
                  </article>
                </div>
              </div>
            </div>

            <div v-else-if="aiNarrationMode === 'narration'" class="flex h-[calc(100%-6.5rem)] min-h-[520px] min-w-0 flex-col">
              <div class="min-h-0 flex-1 overflow-auto">
                <div v-if="selectedSectionForRecording?.finalyNarrations.length" class="grid gap-3 xl:grid-cols-2">
                    <article v-for="(segment, segmentIndex) in selectedSectionForRecording.finalyNarrations" :key="segment.id || segmentIndex" class="min-w-0 rounded-lg border border-gray-700 bg-gray-900 p-3">
                      <div class="mb-2 flex flex-wrap items-center justify-between gap-2">
                        <div class="flex min-w-0 items-center gap-2">
                          <span class="font-mono text-xs text-gray-500">{{ segment.start || formatDuration(segment.startSeconds ?? selectedSectionForRecording.startTime) }}</span>
                          <span class="rounded-full bg-indigo-500/20 px-2 py-0.5 text-xs font-bold text-indigo-100">AIナレーション{{ segmentIndex + 1 }}</span>
                        </div>
                        <div class="flex shrink-0 items-center gap-2">
                          <span v-if="isTtsSegmentProcessing(selectedSectionForRecording.id, segmentIndex)" class="inline-flex items-center gap-1 rounded-lg bg-indigo-500/15 px-2 py-1 text-xs font-bold text-indigo-100">
                            <UIcon name="i-heroicons-arrow-path" class="h-3.5 w-3.5 animate-spin" />
                            音声生成中
                          </span>
                          <button class="rounded-lg bg-purple-500 px-3 py-1.5 text-xs font-bold text-white hover:bg-purple-600 disabled:opacity-50" :disabled="isTtsSegmentProcessing(selectedSectionForRecording.id, segmentIndex) || activeRequest === 'export' || !(segment.rewrittenText || segment.originalText)" @click="requestSingleTts(selectedSectionForRecording.id, segmentIndex)">
                            {{ segment.isTtsGenerated ? "音声再生成" : "AI音声" }}
                          </button>
                          <button class="rounded-lg bg-red-500/15 px-2 py-1 text-xs font-bold text-red-200 hover:bg-red-500/25 disabled:opacity-50" :disabled="selectedSectionForRecording.finalyNarrations.length <= 1" @click="deleteNarrationSegment(selectedSectionIndex, segmentIndex)">
                            削除
                          </button>
                        </div>
                      </div>
                      <textarea
                        v-model="segment.rewrittenText"
                        rows="4"
                        class="w-full resize-y rounded-lg border border-gray-600 bg-gray-950 px-3 py-2 text-base font-bold leading-7 text-gray-100 outline-none focus:border-indigo-400"
                        :placeholder="segment.originalText"
                        @focus="handleNarrationEditFocus(selectedSectionIndex, segmentIndex)"
                        @blur="void saveEditorSections()"
                      />
                      <div class="mt-2 flex items-center justify-between text-xs text-gray-500">
                        <span>元のナレーション: {{ segment.originalText.length }}文字</span>
                        <span>AIナレーション: {{ (segment.rewrittenText || segment.originalText).length }}文字</span>
                      </div>
                      <div v-if="segment.isTtsGenerated && ttsSegmentOutputPath(segment)" class="mt-3 rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3">
                        <div class="mb-2 flex items-center justify-between gap-3">
                          <div class="flex items-center gap-2 text-xs font-bold text-emerald-100">
                            <UIcon name="i-heroicons-speaker-wave" class="h-4 w-4" />
                            生成済み音声
                            <span class="font-mono text-emerald-200/70">{{ formatTtsDuration(segment) }}</span>
                          </div>
                          <button class="inline-flex items-center gap-1 rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-600" @click="toggleTtsPreview(selectedSectionForRecording.id, segmentIndex, segment)">
                            <UIcon :name="playingTtsKey === ttsSegmentKey(selectedSectionForRecording.id, segmentIndex) ? 'i-heroicons-stop-solid' : 'i-heroicons-play-solid'" class="h-3.5 w-3.5" />
                            {{ playingTtsKey === ttsSegmentKey(selectedSectionForRecording.id, segmentIndex) ? "停止" : "試聴" }}
                          </button>
                        </div>
                        <div class="flex h-12 items-center gap-0.5 overflow-hidden rounded bg-gray-950 px-2">
                          <span
                            v-for="bar in ttsWaveformBars(selectedSectionForRecording.id, segmentIndex, segment, 48)"
                            :key="bar.key"
                            class="min-w-[2px] flex-1 rounded-sm bg-emerald-400"
                            :style="{ height: `${bar.height}%` }"
                          />
                          <span v-if="ttsWaveformBars(selectedSectionForRecording.id, segmentIndex, segment, 48).length === 0" class="text-xs text-gray-500">
                            波形を読み込み中...
                          </span>
                        </div>
                      </div>
                    </article>
                </div>
                <div v-else class="flex h-full flex-col items-center justify-center text-center text-gray-500">
                  <UIcon name="i-heroicons-sparkles" class="mb-3 h-10 w-10" />
                  <p class="text-sm font-bold">AIナレーションがありません</p>
                  <p class="mt-1 text-xs">文字起こし完了後に表示されます。</p>
                </div>
              </div>
            </div>

            <div v-else class="flex h-[calc(100%-6rem)] min-h-[560px] min-w-0 flex-col overflow-hidden rounded-xl border border-gray-700 bg-gray-850">
              <div class="grid min-h-0 flex-1 grid-rows-[minmax(220px,42%)_minmax(0,1fr)]">
                <section class="min-h-0 border-b border-gray-700 bg-black">
                  <div class="relative h-full">
                    <iframe v-if="youtubeEmbedUrl" :src="youtubeEmbedUrl" class="h-full w-full" allowfullscreen />
                    <video
                      v-else-if="store.selectedVideoUrl"
                      ref="editorVideo"
                      :src="store.selectedVideoUrl"
                      class="h-full w-full object-contain"
                      controls
                      @timeupdate="syncCurrentTime"
                      @loadedmetadata="syncDuration"
                      @play="handleEditorVideoPlay"
                      @pause="handleEditorVideoPause"
                      @ended="handleEditorVideoEnded"
                    />
                    <div v-else class="flex h-full items-center justify-center text-gray-500">
                      <UIcon name="i-heroicons-film" class="mr-2 h-6 w-6" />
                      動画を読み込み中...
                    </div>
                    <audio ref="timingPlaybackAudio" preload="auto" />
                    <div class="pointer-events-none absolute bottom-3 left-3 rounded-lg bg-gray-950/80 px-3 py-1.5 text-xs font-bold text-gray-100">
                      {{ selectedSectionForRecording?.title || "セクション未選択" }} / {{ formatDuration(timingRelativeCurrentTime) }}
                    </div>
                  </div>
                </section>

                <section class="flex min-h-0 flex-col">
                  <div class="flex items-center justify-between border-b border-gray-700 px-4 py-2">
                    <div class="flex min-w-0 items-center gap-3">
                      <h4 class="shrink-0 text-base font-bold text-gray-100">音声タイムライン</h4>
                      <span class="truncate text-xs text-gray-500">動画を再生しながらAI音声の開始位置を合わせます</span>
                    </div>
                    <div class="flex items-center gap-2">
                      <button class="rounded bg-gray-700 p-2 hover:bg-gray-600" @click="seekTimingTo(0)">
                        <UIcon name="i-heroicons-arrow-uturn-left" class="h-4 w-4" />
                      </button>
                      <button class="rounded bg-gray-700 p-2 hover:bg-gray-600" @click="timelineZoom = Math.max(4, timelineZoom - 10)">
                        <UIcon name="i-heroicons-magnifying-glass-minus-solid" class="h-4 w-4" />
                      </button>
                      <span class="min-w-[3rem] text-center text-xs text-gray-400">{{ timelineZoom }}px/s</span>
                      <button class="rounded bg-gray-700 p-2 hover:bg-gray-600" @click="timelineZoom = Math.min(500, timelineZoom + 10)">
                        <UIcon name="i-heroicons-magnifying-glass-plus-solid" class="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                  <div class="min-h-0 flex-1 overflow-auto p-4">
                    <div
                      v-if="selectedNarrationTimingSegments.length > 0"
                      ref="timingTimelineContainer"
                      class="relative min-h-[260px] rounded-lg border border-gray-700 bg-gray-950"
                      :style="{ width: `${selectedTimingTimelineWidth}px`, minWidth: '100%' }"
                      @click="handleTimingTimelineClick"
                    >
                      <div class="sticky top-0 z-20 h-10 border-b border-gray-700 bg-gray-900">
                        <span v-for="tick in selectedTimingTicks" :key="tick" class="absolute top-0 h-full border-l border-gray-700 text-[10px] text-gray-500" :style="{ left: `${timingTrackLabelWidth + tick * safeTimelineZoom}px` }">
                          <span class="ml-1">{{ formatDuration(tick) }}</span>
                        </span>
                      </div>
                      <div
                        class="pointer-events-none absolute bottom-0 top-10 z-30 w-0.5 bg-rose-400 shadow-[0_0_18px_rgba(251,113,133,0.7)]"
                        :style="{ left: `${timingTrackLabelWidth + timingRelativeCurrentTime * safeTimelineZoom}px` }"
                      >
                        <span class="absolute -top-3 left-1/2 h-4 w-4 -translate-x-1/2 rounded-full border-2 border-rose-200 bg-rose-400" />
                      </div>
                      <div v-for="segment in selectedNarrationTimingSegments" :key="segment.key" class="relative h-24 border-b border-gray-800 last:border-b-0">
                        <button class="absolute left-0 top-0 flex h-full w-40 flex-col justify-center border-r border-gray-700 bg-gray-900 px-3 text-left hover:bg-gray-800" @click.stop="seekTimingTo(segment.startSeconds)">
                          <span class="truncate text-xs font-bold text-gray-200">AIナレーション{{ segment.index + 1 }}</span>
                          <span class="font-mono text-[10px] text-gray-500">{{ formatDuration(segment.startSeconds) }} / {{ formatTtsDuration(segment.model) }}</span>
                        </button>
                        <button
                          class="audio-timing-segment absolute top-4 flex h-16 cursor-move flex-col justify-center overflow-hidden rounded-lg border px-3 text-left text-xs font-bold shadow transition"
                          :class="selectedTimingSegmentIndex === segment.index ? 'border-indigo-200 bg-indigo-500 text-white shadow-indigo-500/25' : 'border-indigo-400/70 bg-indigo-500/80 text-white hover:bg-indigo-500'"
                          :style="timingSegmentStyle(segment)"
                          @click.stop="selectTimingSegment(segment.index)"
                          @pointerdown="startTimingSegmentDrag($event, segment.index, segment.startSeconds)"
                        >
                          <span class="truncate">{{ segment.text }}</span>
                          <div class="mt-2 flex h-5 items-center gap-0.5 overflow-hidden rounded bg-gray-950/40 px-1">
                            <span
                              v-for="bar in ttsWaveformBars(selectedSectionForRecording?.id || '', segment.index, segment.model, 32)"
                              :key="bar.key"
                              class="min-w-[2px] flex-1 rounded-sm bg-emerald-300"
                              :style="{ height: `${bar.height}%` }"
                            />
                          </div>
                        </button>
                        <div class="absolute right-3 top-3 flex flex-col items-end gap-2">
                          <div class="flex items-center gap-1">
                            <button v-for="delta in [-1, -0.5, 0.5, 1]" :key="delta" class="rounded bg-gray-800 px-2 py-1 text-[10px] font-bold text-gray-200 hover:bg-gray-700" @click="adjustNarrationTiming(selectedSectionIndex, segment.index, delta)">
                              {{ delta > 0 ? `+${delta}` : delta }}s
                            </button>
                          </div>
                          <label class="flex items-center gap-2 text-xs text-gray-500">
                            <input :value="segment.startSeconds" type="number" min="0" step="0.1" class="w-20 rounded border border-gray-600 bg-gray-950 px-2 py-1 text-xs text-gray-100 outline-none focus:border-indigo-400" @change="updateNarrationTiming(selectedSectionIndex, segment.index, Number(($event.target as HTMLInputElement).value))">
                            秒
                          </label>
                        </div>
                      </div>
                    </div>
                    <div v-else class="flex h-full flex-col items-center justify-center text-center text-gray-500">
                      <UIcon name="i-heroicons-clock" class="mb-3 h-10 w-10" />
                      <p class="text-sm font-bold">調整できるAI音声がありません</p>
                      <p class="mt-1 text-xs">ナレーション調整でAI音声を生成してください。</p>
                    </div>
                  </div>
                </section>
              </div>
            </div>
          </div>

          <div v-else-if="isExportStep" class="min-h-0 flex-1 overflow-auto bg-gray-900 p-6">
            <div class="space-y-4">
              <section class="rounded-xl border border-gray-700 bg-gray-800">
                <div class="flex flex-wrap items-center justify-between gap-4 border-b border-gray-700 px-5 py-4">
                  <div class="min-w-0">
                    <h3 class="text-xl font-bold">動画出力</h3>
                    <p class="mt-1 text-sm text-gray-400">完成動画の確認、セクション確認、素材保存を切り替えて進めます。</p>
                  </div>
                  <div class="flex flex-wrap items-center gap-3">
                    <div class="flex rounded-lg border border-gray-700 bg-gray-900 p-1">
                      <button
                        v-for="tab in exportReviewTabs"
                        :key="tab"
                        type="button"
                        class="inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-xs font-bold transition"
                        :class="exportReviewTabClass(tab)"
                        @click="exportReviewTab = tab"
                      >
                        <UIcon :name="exportReviewTabIcon(tab)" class="h-4 w-4" />
                        {{ exportReviewTabLabel(tab) }}
                      </button>
                    </div>
                    <button class="inline-flex items-center gap-2 rounded-xl bg-indigo-500 px-5 py-3 text-sm font-bold text-white hover:bg-indigo-600 disabled:opacity-50" :disabled="Boolean(activeRequest) || editorSections.length === 0" @click="requestExport">
                      <UIcon name="i-heroicons-film" class="h-5 w-5" />
                      {{ activeRequest === "export" ? "書き出し中" : "最終動画を書き出す" }}
                    </button>
                  </div>
                </div>

                <div class="p-5">
                  <div v-if="requestNotice" class="rounded-lg border px-3 py-2 text-sm" :class="requestNotice.kind === 'error' ? 'border-red-500/40 bg-red-500/10 text-red-200' : 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200'">
                    {{ requestNotice.message }}
                  </div>
                </div>
              </section>

              <div v-if="exportReviewTab === 'overview'" class="grid gap-4 xl:grid-cols-[minmax(0,1fr)_34rem]">
                <section class="rounded-xl border border-gray-700 bg-gray-800 p-5">
                  <div class="rounded-xl border border-gray-700 bg-gray-900 p-4">
                    <div class="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <h4 class="text-base font-bold text-gray-100">書き出し進捗</h4>
                        <p class="mt-1 text-xs text-gray-500">{{ exportProgress.message }}</p>
                      </div>
                      <span class="rounded-full bg-indigo-500/15 px-3 py-1 text-xs font-bold text-indigo-200">
                        {{ exportProgressPercent }}%
                      </span>
                    </div>
                    <div class="mt-4 h-2 overflow-hidden rounded-full bg-gray-800">
                      <div class="h-full rounded-full bg-indigo-400 transition-all duration-300" :style="{ width: `${exportProgressPercent}%` }" />
                    </div>
                    <div class="mt-4 grid gap-2 md:grid-cols-2">
                      <div
                        v-for="item in exportProgressItems"
                        :key="item.key"
                        class="flex items-center gap-2 rounded-lg border px-3 py-2 text-xs"
                        :class="exportProgressItemClass(item.status)"
                      >
                        <UIcon :name="exportProgressIcon(item.status)" class="h-4 w-4 shrink-0" :class="item.status === 'running' ? 'animate-spin' : ''" />
                        <span class="min-w-0 flex-1 truncate">{{ item.label }}</span>
                        <span class="shrink-0 font-bold">{{ exportProgressStatusLabel(item.status) }}</span>
                      </div>
                    </div>
                  </div>
                </section>

                <section class="rounded-xl border border-gray-700 bg-gray-800 p-4">
                  <div class="mb-3 flex items-center justify-between gap-3">
                    <h4 class="text-sm font-bold text-gray-200">出力済み動画</h4>
                    <button
                      v-if="finalVideoExportAsset"
                      class="inline-flex items-center gap-1 rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-600 disabled:opacity-50"
                      :disabled="Boolean(downloadingAssetKey)"
                      @click="downloadExportAsset(finalVideoExportAsset)"
                    >
                      <UIcon name="i-heroicons-arrow-down-tray" class="h-4 w-4" />
                      ダウンロード
                    </button>
                  </div>
                  <video v-if="store.selectedProjectOutputUrl" :src="store.selectedProjectOutputUrl" class="aspect-video w-full rounded bg-black" controls />
                  <div v-else class="flex aspect-video items-center justify-center rounded bg-gray-950 text-sm text-gray-500">
                    書き出し後にここへ表示されます。
                  </div>
                  <div class="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
                    <div class="rounded-lg bg-gray-900 p-2">
                      <div class="font-bold text-gray-100">{{ exportProgressPercent }}%</div>
                      <div class="mt-0.5 text-gray-500">進捗</div>
                    </div>
                    <div class="rounded-lg bg-gray-900 p-2">
                      <div class="font-bold text-gray-100">{{ fixedSectionsCount }}/{{ editorSections.length }}</div>
                      <div class="mt-0.5 text-gray-500">確定</div>
                    </div>
                    <div class="rounded-lg bg-gray-900 p-2">
                      <div class="font-bold text-gray-100">{{ exportAssetCounts.ready }}/{{ exportAssetCounts.total }}</div>
                      <div class="mt-0.5 text-gray-500">素材</div>
                    </div>
                  </div>
                </section>
              </div>

              <div v-else-if="exportReviewTab === 'sections'" class="grid gap-4 xl:grid-cols-[minmax(0,1fr)_34rem]">
                <section class="rounded-xl border border-gray-700 bg-gray-800 p-5">
                  <div class="mb-3 flex items-center justify-between">
                    <h4 class="text-base font-bold text-gray-100">セクション最終確認</h4>
                    <span class="text-xs text-gray-500">{{ fixedSectionsCount }}/{{ editorSections.length }} 確定済み</span>
                  </div>
                  <div class="grid gap-3 lg:grid-cols-2">
                    <button
                      v-for="(section, index) in editorSections"
                      :key="section.id"
                      type="button"
                      class="min-w-0 rounded-lg border p-3 text-left transition"
                      :class="selectedExportSectionIndex === index ? 'border-indigo-300 bg-indigo-500/15' : 'border-gray-700 bg-gray-900 hover:bg-gray-850'"
                      @click="selectExportSection(index)"
                    >
                      <div class="flex gap-3">
                        <div class="aspect-video w-32 shrink-0 overflow-hidden rounded bg-gray-950">
                          <img v-if="timelineThumbnail(section.id, 'start')?.kind === 'image'" :src="timelineThumbnail(section.id, 'start')?.url" alt="" class="h-full w-full object-cover">
                          <video v-else-if="timelineThumbnail(section.id, 'start')?.kind === 'video'" :src="timelineThumbnail(section.id, 'start')?.url" class="h-full w-full object-cover" muted playsinline preload="metadata" @loadedmetadata="handleTimelineThumbnailVideoReady($event, timelineThumbnail(section.id, 'start'), 'loadedmetadata')" @loadeddata="handleTimelineThumbnailVideoReady($event, timelineThumbnail(section.id, 'start'), 'loadeddata')" @canplay="handleTimelineThumbnailVideoReady($event, timelineThumbnail(section.id, 'start'), 'canplay')" @error="handleTimelineThumbnailVideoError($event, section.id, 'start')" />
                          <div v-else class="flex h-full items-center justify-center">
                            <UIcon name="i-heroicons-film" class="h-7 w-7 text-gray-600" />
                          </div>
                        </div>
                        <div class="min-w-0 flex-1">
                          <div class="flex items-start justify-between gap-2">
                            <p class="line-clamp-2 text-sm font-bold text-gray-100">{{ section.title || `セクション ${index + 1}` }}</p>
                            <span class="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold" :class="section.isFixed ? 'bg-emerald-500/15 text-emerald-200' : 'bg-amber-500/15 text-amber-200'">
                              {{ section.isFixed ? "確定済" : "未確定" }}
                            </span>
                          </div>
                          <p class="mt-1 text-xs text-gray-500">{{ formatDuration(section.startTime) }} - {{ formatDuration(section.endTime) }}</p>
                          <div class="mt-2 flex flex-wrap gap-1">
                            <span class="rounded bg-gray-800 px-2 py-0.5 text-[10px] text-gray-300">AI音声 {{ section.finalyNarrations.length }}</span>
                            <span class="rounded bg-gray-800 px-2 py-0.5 text-[10px] text-gray-300">{{ section.mergedVideoOutput?.resultFilePath ? "合成済み" : "未合成" }}</span>
                          </div>
                        </div>
                      </div>
                    </button>
                  </div>
                </section>

                <section class="rounded-xl border border-gray-700 bg-gray-800 p-4">
                  <div class="mb-3 flex items-center justify-between gap-3">
                    <h4 class="text-sm font-bold text-gray-200">選択セクション確認</h4>
                    <span class="truncate text-xs text-gray-500">{{ selectedExportSection?.title || "セクション未選択" }}</span>
                  </div>
                  <video v-if="selectedExportSectionPreviewUrl" :src="selectedExportSectionPreviewUrl" class="aspect-video w-full rounded bg-black" controls />
                  <div v-else class="flex aspect-video items-center justify-center rounded bg-gray-950 text-sm text-gray-500">
                    セクションを選択するとプレビューします。
                  </div>
                </section>
              </div>

              <section v-else class="rounded-xl border border-gray-700 bg-gray-800 p-5">
                <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h4 class="text-base font-bold text-gray-100">書き出し素材</h4>
                    <p class="mt-1 text-sm text-gray-500">完成動画、セクション動画、音声素材を個別に保存できます。</p>
                  </div>
                  <div class="flex flex-wrap items-center justify-end gap-2">
                    <span class="rounded-full bg-gray-900 px-3 py-1 text-xs font-bold text-gray-300">
                      {{ exportAssetCounts.ready }}/{{ exportAssetCounts.total }}
                    </span>
                    <button
                      class="inline-flex items-center gap-2 rounded-lg bg-emerald-500 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
                      :disabled="readyExportAssets.length === 0 || isBulkDownloadingAssets || Boolean(downloadingAssetKey)"
                      @click="downloadAllExportAssetsAsZip"
                    >
                      <UIcon :name="isBulkDownloadingAssets ? 'i-heroicons-arrow-path' : 'i-heroicons-archive-box-arrow-down'" class="h-4 w-4" :class="isBulkDownloadingAssets ? 'animate-spin' : ''" />
                      ZIPで一括保存
                    </button>
                  </div>
                </div>
                <div v-if="bulkDownloadMessage" class="mb-4 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs font-bold text-emerald-100">
                  {{ bulkDownloadMessage }}
                </div>
                <div v-if="exportAssets.length" class="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
                  <div
                    v-for="asset in exportAssets"
                    :key="asset.key"
                    class="flex min-w-0 items-center gap-3 rounded-lg border border-gray-700 bg-gray-900 p-3"
                  >
                    <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gray-800 text-gray-200">
                      <UIcon :name="assetKindIcon(asset.kind)" class="h-5 w-5" />
                    </div>
                    <div class="min-w-0 flex-1">
                      <div class="flex items-center gap-2">
                        <span class="truncate text-xs font-bold text-gray-100">{{ asset.label }}</span>
                        <span class="shrink-0 rounded bg-gray-800 px-1.5 py-0.5 text-[10px] text-gray-400">{{ assetKindLabel(asset.kind) }}</span>
                      </div>
                      <p class="mt-0.5 truncate text-[11px] text-gray-500">{{ asset.description }}</p>
                    </div>
                    <button
                      class="inline-flex shrink-0 items-center gap-1 rounded-lg bg-gray-700 px-2.5 py-1.5 text-xs font-bold text-gray-100 hover:bg-gray-600 disabled:cursor-not-allowed disabled:opacity-50"
                      :disabled="!asset.ready || Boolean(downloadingAssetKey) || isBulkDownloadingAssets"
                      @click="downloadExportAsset(asset)"
                    >
                      <UIcon :name="downloadingAssetKey === asset.key ? 'i-heroicons-arrow-path' : 'i-heroicons-arrow-down-tray'" class="h-4 w-4" :class="downloadingAssetKey === asset.key ? 'animate-spin' : ''" />
                      保存
                    </button>
                  </div>
                </div>
                <div v-else class="rounded-lg border border-dashed border-gray-700 bg-gray-900 p-6 text-center text-sm text-gray-500">
                  最終動画を書き出すと、ここにダウンロード可能な素材が表示されます。
                </div>
              </section>
            </div>
          </div>

          <div v-else-if="isSubtitleStep" class="min-h-0 flex-1 overflow-auto bg-gray-900 p-6">
            <div class="space-y-4">
              <section class="rounded-xl border border-gray-700 bg-gray-800">
                <div class="flex flex-wrap items-center justify-between gap-4 border-b border-gray-700 px-5 py-4">
                  <div class="min-w-0">
                    <h3 class="text-xl font-bold">動画調整</h3>
                    <p class="mt-1 text-sm text-gray-400">無音カットと字幕生成を、必要なものだけ設定して実行します。</p>
                  </div>
                  <div class="flex flex-wrap items-center gap-2">
                    <button
                      v-for="(step, index) in videoAdjustmentSubStepOptions"
                      :key="step.key"
                      type="button"
                      class="min-w-[9.5rem] rounded-xl border px-3 py-2 text-left transition disabled:cursor-not-allowed disabled:opacity-50"
                      :class="videoAdjustmentSubStep === step.key ? 'border-indigo-300 bg-indigo-500 text-white' : 'border-gray-700 bg-gray-900 text-gray-300 hover:bg-gray-850'"
                      :disabled="Boolean(activeRequest) || (step.key !== 'silence_settings' && !finalVideoExportAsset)"
                      @click="setVideoAdjustmentSubStep(step.key)"
                    >
                      <span class="flex items-center gap-2 text-sm font-bold">
                        <span class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/15 text-xs">{{ index + 1 }}</span>
                        {{ step.title }}
                      </span>
                      <span class="mt-1 block truncate text-[11px] opacity-70">{{ step.description }}</span>
                    </button>
                  </div>
                </div>
                <div class="space-y-3 p-5">
                  <div v-if="requestNotice" class="rounded-lg border px-3 py-2 text-sm" :class="requestNotice.kind === 'error' ? 'border-red-500/40 bg-red-500/10 text-red-200' : 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200'">
                    {{ requestNotice.message }}
                  </div>
                  <div v-else-if="!finalVideoExportAsset" class="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
                    動画調整は最終動画の書き出し完了後に実行できます。
                  </div>
                  <div class="grid gap-3 md:grid-cols-4">
                    <div class="rounded-xl border border-gray-700 bg-gray-900 p-3">
                      <p class="text-[11px] font-bold text-gray-500">入力動画</p>
                      <p class="mt-1 text-sm font-bold text-gray-100">{{ finalVideoExportAsset?.ready ? "最終動画" : "書き出し待ち" }}</p>
                    </div>
                    <div class="rounded-xl border border-gray-700 bg-gray-900 p-3">
                      <p class="text-[11px] font-bold text-gray-500">無音カット</p>
                      <p class="mt-1 text-sm font-bold" :class="isSilenceCutEnabled ? 'text-teal-200' : 'text-gray-400'">
                        {{ isSilenceCutEnabled ? "実行する" : "実行しない" }}
                      </p>
                    </div>
                    <div class="rounded-xl border border-gray-700 bg-gray-900 p-3">
                      <p class="text-[11px] font-bold text-gray-500">字幕生成</p>
                      <p class="mt-1 text-sm font-bold" :class="isSubtitleGenerationEnabled ? 'text-indigo-200' : 'text-gray-400'">
                        {{ isSubtitleGenerationEnabled ? `${subtitleCaptionSegments.length} cues` : "実行しない" }}
                      </p>
                    </div>
                    <div class="rounded-xl border border-gray-700 bg-gray-900 p-3">
                      <p class="text-[11px] font-bold text-gray-500">プレビュー</p>
                      <p class="mt-1 text-sm font-bold text-gray-100">{{ videoAdjustmentPreviewLabel }}</p>
                    </div>
                  </div>
                </div>
              </section>

              <section v-if="videoAdjustmentSubStep === 'silence_settings'" class="grid gap-4 xl:grid-cols-[minmax(0,1fr)_28rem]">
                <div class="rounded-xl border border-gray-700 bg-gray-800 p-5">
                  <div class="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h4 class="text-lg font-bold text-gray-100">無音カット設定</h4>
                      <p class="mt-1 text-sm text-gray-500">長い無音だけを自然に詰めます。不要な場合はOFFのまま進めます。</p>
                    </div>
                    <button
                      type="button"
                      class="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold transition disabled:opacity-50"
                      :class="isSilenceCutEnabled ? 'bg-teal-500 text-white hover:bg-teal-600' : 'bg-gray-700 text-gray-200 hover:bg-gray-600'"
                      :disabled="Boolean(activeRequest)"
                      @click="updateSilenceCutEnabled(!isSilenceCutEnabled)"
                    >
                      <UIcon :name="isSilenceCutEnabled ? 'i-heroicons-check-circle-solid' : 'i-heroicons-no-symbol'" class="h-5 w-5" />
                      {{ isSilenceCutEnabled ? "無音カット ON" : "無音カット OFF" }}
                    </button>
                  </div>
                  <div class="mt-5 rounded-xl border border-gray-700 bg-gray-900 p-4">
                    <p class="text-sm font-bold text-gray-100">自然優先プリセット</p>
                    <p class="mt-1 text-xs leading-5 text-gray-500">話し出しと語尾を残すため、強すぎるカットを避ける初期値です。</p>
                    <div class="mt-4 grid gap-3 md:grid-cols-2">
                      <label
                        v-for="control in silenceCutSettingControls"
                        :key="control.key"
                        class="rounded-lg border border-gray-700 bg-gray-950 p-3"
                        :class="!isSilenceCutEnabled ? 'opacity-50' : ''"
                      >
                        <span class="flex items-center justify-between gap-3 text-xs font-bold text-gray-300">
                          {{ control.label }}
                          <span class="text-gray-500">{{ control.unit }}</span>
                        </span>
                        <input
                          type="number"
                          class="mt-2 w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm font-bold text-gray-100 outline-none focus:border-teal-400 disabled:cursor-not-allowed"
                          :min="control.min"
                          :max="control.max"
                          :step="control.step"
                          :value="silenceCutSettings[control.key]"
                          :disabled="Boolean(activeRequest) || !isSilenceCutEnabled"
                          @change="updateSilenceCutNumberSetting(control.key, $event)"
                        >
                        <span class="mt-2 block text-[11px] leading-4 text-gray-500">{{ control.description }}</span>
                      </label>
                    </div>
                  </div>
                  <div class="mt-5 flex flex-wrap justify-end gap-2">
                    <button
                      type="button"
                      class="rounded-xl bg-gray-700 px-4 py-2 text-sm font-bold text-gray-100 hover:bg-gray-600 disabled:opacity-50"
                      :disabled="Boolean(activeRequest)"
                      @click="updateSilenceCutEnabled(false)"
                    >
                      無音カットなし
                    </button>
                    <button
                      type="button"
                      class="rounded-xl bg-indigo-500 px-5 py-2 text-sm font-bold text-white hover:bg-indigo-600 disabled:opacity-50"
                      :disabled="Boolean(activeRequest) || !finalVideoExportAsset"
                      @click="moveToSubtitleSettings"
                    >
                      字幕設定へ
                    </button>
                  </div>
                </div>

                <aside class="rounded-xl border border-gray-700 bg-gray-800 p-4">
                  <h4 class="text-sm font-bold text-gray-200">入力元確認</h4>
                  <video v-if="store.selectedProjectOutputUrl" :src="store.selectedProjectOutputUrl" class="mt-3 aspect-video w-full rounded bg-black" controls />
                  <div v-else class="mt-3 flex aspect-video items-center justify-center rounded bg-gray-950 text-sm text-gray-500">最終動画待ち</div>
                  <p class="mt-3 text-xs leading-5 text-gray-500">無音カットを実行する場合は、この最終動画から無音区間を検出します。</p>
                  <p v-if="silenceCutStatistics" class="mt-3 rounded-lg border border-teal-500/20 bg-teal-500/10 px-3 py-2 text-xs font-bold text-teal-100">
                    {{ silenceCutCutCount }} 箇所カット
                    <span v-if="silenceCutRemovedSeconds > 0"> / {{ silenceCutRemovedSeconds.toFixed(1) }}秒短縮</span>
                  </p>
                </aside>
              </section>

              <section v-else-if="videoAdjustmentSubStep === 'subtitle_settings'" class="space-y-4">
                <div class="rounded-xl border border-gray-700 bg-gray-800 p-5">
                  <div class="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h4 class="text-lg font-bold text-gray-100">字幕設定</h4>
                      <p class="mt-1 text-sm text-gray-500">字幕を生成する場合だけ、スタイルとサイズを選びます。</p>
                    </div>
                    <button
                      type="button"
                      class="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold transition disabled:opacity-50"
                      :class="isSubtitleGenerationEnabled ? 'bg-indigo-500 text-white hover:bg-indigo-600' : 'bg-gray-700 text-gray-200 hover:bg-gray-600'"
                      :disabled="Boolean(activeRequest)"
                      @click="updateSubtitleEnabled(!isSubtitleGenerationEnabled)"
                    >
                      <UIcon :name="isSubtitleGenerationEnabled ? 'i-heroicons-check-circle-solid' : 'i-heroicons-no-symbol'" class="h-5 w-5" />
                      {{ isSubtitleGenerationEnabled ? "字幕生成 ON" : "字幕生成 OFF" }}
                    </button>
                  </div>
                  <div class="mt-4 grid gap-3 md:grid-cols-3">
                    <div class="rounded-lg border border-gray-700 bg-gray-900 p-3">
                      <p class="text-[11px] font-bold text-gray-500">字幕入力</p>
                      <p class="mt-1 text-sm font-bold text-gray-100">{{ isSilenceCutEnabled ? "無音カット後の動画" : subtitleSourceLabel }}</p>
                    </div>
                    <div class="rounded-lg border border-gray-700 bg-gray-900 p-3">
                      <p class="text-[11px] font-bold text-gray-500">字幕本文</p>
                      <p class="mt-1 text-sm font-bold text-gray-100">{{ subtitleCaptionSegments.length }} cues</p>
                    </div>
                    <div class="rounded-lg border border-gray-700 bg-gray-900 p-3">
                      <p class="text-[11px] font-bold text-gray-500">選択中</p>
                      <p class="mt-1 text-sm font-bold text-gray-100">{{ selectedSubtitlePreset.label }} / {{ selectedSubtitleSize.label }}</p>
                    </div>
                  </div>
                  <div v-if="isSubtitleGenerationEnabled && subtitleCaptionSegments.length === 0" class="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
                    字幕に使えるAIナレーション本文がありません。字幕をOFFにすると次へ進めます。
                  </div>
                </div>

                <div class="rounded-xl border border-gray-700 bg-gray-800 p-5" :class="!isSubtitleGenerationEnabled ? 'opacity-50' : ''">
                  <div class="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-700 bg-gray-900 p-3">
                    <div>
                      <p class="text-sm font-bold text-gray-100">字幕サイズ</p>
                      <p class="mt-1 text-xs text-gray-500">動画の見え方に合わせて、大きさだけを調整できます。</p>
                    </div>
                    <div class="inline-flex rounded-lg border border-gray-700 bg-gray-950 p-1">
                      <button
                        v-for="option in subtitleSizeOptions"
                        :key="option.key"
                        type="button"
                        class="rounded-md px-3 py-1.5 text-xs font-bold transition"
                        :class="selectedSubtitleSize.key === option.key ? 'bg-indigo-500 text-white' : 'text-gray-400 hover:bg-gray-800 hover:text-gray-100'"
                        :disabled="Boolean(activeRequest) || !isSubtitleGenerationEnabled"
                        @click="selectSubtitleSize(option.key)"
                      >
                        {{ option.label }}
                      </button>
                    </div>
                  </div>
                  <div class="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
                    <button
                      v-for="option in subtitleStyleOptions"
                      :key="option.key"
                      type="button"
                      class="rounded-xl border p-4 text-left transition"
                      :class="selectedSubtitlePreset.key === option.key ? 'border-indigo-300 bg-indigo-500/15' : 'border-gray-700 bg-gray-900 hover:bg-gray-850'"
                      :disabled="Boolean(activeRequest) || !isSubtitleGenerationEnabled"
                      @click="selectSubtitlePreset(option.key)"
                    >
                      <div class="flex items-start justify-between gap-3">
                        <div>
                          <p class="text-sm font-bold text-gray-100">{{ option.label }}</p>
                          <p class="mt-1 text-xs leading-5 text-gray-500">{{ option.description }}</p>
                        </div>
                        <UIcon v-if="selectedSubtitlePreset.key === option.key" name="i-heroicons-check-circle-solid" class="h-5 w-5 shrink-0 text-indigo-300" />
                      </div>
                      <div class="mt-4 flex aspect-video items-end justify-center rounded-lg bg-gray-950 p-4">
                        <span class="text-center text-sm font-bold leading-6" :class="option.previewClass">
                          例：請求書の一覧を確認できます
                        </span>
                      </div>
                    </button>
                  </div>
                  <div class="mt-5 flex flex-wrap justify-between gap-2">
                    <button type="button" class="rounded-xl bg-gray-700 px-4 py-2 text-sm font-bold text-gray-100 hover:bg-gray-600 disabled:opacity-50" :disabled="Boolean(activeRequest)" @click="setVideoAdjustmentSubStep('silence_settings')">戻る</button>
                    <button type="button" class="rounded-xl bg-indigo-500 px-5 py-2 text-sm font-bold text-white hover:bg-indigo-600 disabled:opacity-50" :disabled="Boolean(activeRequest) || (isSubtitleGenerationEnabled && subtitleCaptionSegments.length === 0)" @click="moveToRunSettings">実行内容を確認</button>
                  </div>
                </div>
              </section>

              <section v-else-if="videoAdjustmentSubStep === 'run'" class="grid gap-4 xl:grid-cols-[minmax(0,1fr)_26rem]">
                <div class="space-y-4">
                  <div class="rounded-xl border border-gray-700 bg-gray-800 p-5">
                    <div class="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <h4 class="text-lg font-bold text-gray-100">実行内容</h4>
                        <p class="mt-1 text-sm text-gray-500">ONにした処理だけを実行します。両方ONの場合は無音カット後に字幕を生成します。</p>
                      </div>
                      <button
                        type="button"
                        class="inline-flex items-center gap-2 rounded-xl bg-indigo-500 px-5 py-2.5 text-sm font-bold text-white hover:bg-indigo-600 disabled:cursor-not-allowed disabled:opacity-50"
                        :disabled="!videoAdjustmentCanRun"
                        :title="videoAdjustmentRunDisabledReason"
                        @click="requestVideoAdjustmentGeneration"
                      >
                        <UIcon :name="activeRequest ? 'i-heroicons-arrow-path' : 'i-heroicons-play-solid'" class="h-5 w-5" :class="activeRequest ? 'animate-spin' : ''" />
                        {{ activeRequest ? "実行中" : "動画調整を実行" }}
                      </button>
                    </div>
                    <p v-if="videoAdjustmentRunDisabledReason" class="mt-3 text-xs text-amber-200">{{ videoAdjustmentRunDisabledReason }}</p>
                    <div class="mt-5 grid gap-3 md:grid-cols-2">
                      <div class="rounded-xl border border-gray-700 bg-gray-900 p-4">
                        <div class="flex items-center justify-between gap-3">
                          <div class="flex items-center gap-2">
                            <span class="flex h-8 w-8 items-center justify-center rounded-full bg-teal-500/20 text-sm font-bold text-teal-100">1</span>
                            <p class="text-sm font-bold text-gray-100">無音カット</p>
                          </div>
                          <span class="rounded-full px-3 py-1 text-xs font-bold" :class="isSilenceCutEnabled ? 'bg-teal-500/20 text-teal-100' : 'bg-gray-800 text-gray-400'">{{ isSilenceCutEnabled ? "実行" : "スキップ" }}</span>
                        </div>
                        <p class="mt-3 text-xs leading-5 text-gray-500">閾値 {{ silenceCutSettings.thresholdDb }}dB / 無音 {{ silenceCutSettings.minSilenceMs }}ms 以上 / 前後 {{ silenceCutSettings.keepPaddingMs }}ms</p>
                      </div>
                      <div class="rounded-xl border border-gray-700 bg-gray-900 p-4">
                        <div class="flex items-center justify-between gap-3">
                          <div class="flex items-center gap-2">
                            <span class="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-500/20 text-sm font-bold text-indigo-100">2</span>
                            <p class="text-sm font-bold text-gray-100">字幕生成</p>
                          </div>
                          <span class="rounded-full px-3 py-1 text-xs font-bold" :class="isSubtitleGenerationEnabled ? 'bg-indigo-500/20 text-indigo-100' : 'bg-gray-800 text-gray-400'">{{ isSubtitleGenerationEnabled ? "実行" : "スキップ" }}</span>
                        </div>
                        <p class="mt-3 text-xs leading-5 text-gray-500">{{ selectedSubtitlePreset.label }} / サイズ {{ selectedSubtitleSize.label }} / {{ subtitleCaptionSegments.length }} cues</p>
                      </div>
                    </div>
                  </div>

                  <div class="rounded-xl border border-gray-700 bg-gray-800 p-5">
                    <h4 class="text-base font-bold text-gray-100">処理進捗</h4>
                    <div class="mt-4 space-y-4">
                      <div>
                        <div class="flex items-center justify-between gap-3">
                          <p class="text-sm font-bold text-gray-200">無音カット</p>
                          <span class="rounded-full bg-teal-500/15 px-3 py-1 text-xs font-bold text-teal-100">{{ silenceCutProgressPercent }}%</span>
                        </div>
                        <p class="mt-1 text-xs text-gray-500">{{ silenceCutProgress.message }}</p>
                        <div class="mt-2 h-2 overflow-hidden rounded-full bg-gray-900">
                          <div class="h-full rounded-full bg-teal-400 transition-all duration-300" :style="{ width: `${silenceCutProgressPercent}%` }" />
                        </div>
                        <div class="mt-3 grid gap-2 md:grid-cols-3">
                          <div v-for="item in silenceCutProgressItems" :key="item.key" class="flex items-center gap-2 rounded-lg border px-3 py-2 text-xs" :class="exportProgressItemClass(item.status)">
                            <UIcon :name="exportProgressIcon(item.status)" class="h-4 w-4 shrink-0" :class="item.status === 'running' ? 'animate-spin' : ''" />
                            <span class="min-w-0 flex-1 truncate">{{ item.label }}</span>
                            <span class="shrink-0 font-bold">{{ exportProgressStatusLabel(item.status) }}</span>
                          </div>
                        </div>
                      </div>
                      <div>
                        <div class="flex items-center justify-between gap-3">
                          <p class="text-sm font-bold text-gray-200">字幕生成</p>
                          <span class="rounded-full bg-indigo-500/15 px-3 py-1 text-xs font-bold text-indigo-100">{{ subtitleProgressPercent }}%</span>
                        </div>
                        <p class="mt-1 text-xs text-gray-500">{{ subtitleProgress.message }}</p>
                        <div class="mt-2 h-2 overflow-hidden rounded-full bg-gray-900">
                          <div class="h-full rounded-full bg-indigo-400 transition-all duration-300" :style="{ width: `${subtitleProgressPercent}%` }" />
                        </div>
                        <div class="mt-3 grid gap-2 md:grid-cols-3">
                          <div v-for="item in subtitleProgressItems" :key="item.key" class="flex items-center gap-2 rounded-lg border px-3 py-2 text-xs" :class="exportProgressItemClass(item.status)">
                            <UIcon :name="exportProgressIcon(item.status)" class="h-4 w-4 shrink-0" :class="item.status === 'running' ? 'animate-spin' : ''" />
                            <span class="min-w-0 flex-1 truncate">{{ item.label }}</span>
                            <span class="shrink-0 font-bold">{{ exportProgressStatusLabel(item.status) }}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div class="mt-5 flex flex-wrap justify-between gap-2">
                      <button type="button" class="rounded-xl bg-gray-700 px-4 py-2 text-sm font-bold text-gray-100 hover:bg-gray-600 disabled:opacity-50" :disabled="Boolean(activeRequest)" @click="setVideoAdjustmentSubStep('subtitle_settings')">戻る</button>
                      <button type="button" class="rounded-xl bg-gray-700 px-4 py-2 text-sm font-bold text-gray-100 hover:bg-gray-600 disabled:opacity-50" :disabled="Boolean(activeRequest)" @click="skipSubtitleStep">調整なしで完了</button>
                    </div>
                  </div>
                </div>

                <aside class="rounded-xl border border-gray-700 bg-gray-800 p-4">
                  <h4 class="text-sm font-bold text-gray-200">入力元確認</h4>
                  <video v-if="videoAdjustmentPreviewUrl" :src="videoAdjustmentPreviewUrl" class="mt-3 aspect-video w-full rounded bg-black" controls />
                  <div v-else class="mt-3 flex aspect-video items-center justify-center rounded bg-gray-950 text-sm text-gray-500">プレビュー待ち</div>
                  <p class="mt-3 text-xs leading-5 text-gray-500">現在の表示: {{ videoAdjustmentPreviewLabel }}</p>
                </aside>
              </section>

              <section v-else class="grid gap-4 xl:grid-cols-[minmax(0,1fr)_34rem]">
                <div class="rounded-xl border border-gray-700 bg-gray-800 p-5">
                  <div class="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h4 class="text-lg font-bold text-gray-100">ダウンロード</h4>
                      <p class="mt-1 text-sm text-gray-500">生成済みの動画と素材を確認して保存できます。</p>
                    </div>
                    <button
                      class="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
                      :disabled="videoAdjustmentReadyDownloadAssets.length === 0 || isBulkDownloadingAssets || Boolean(downloadingAssetKey)"
                      @click="downloadAllExportAssetsAsZip"
                    >
                      <UIcon :name="isBulkDownloadingAssets ? 'i-heroicons-arrow-path' : 'i-heroicons-archive-box-arrow-down'" class="h-5 w-5" :class="isBulkDownloadingAssets ? 'animate-spin' : ''" />
                      ZIPで一括保存
                    </button>
                  </div>
                  <div class="mt-5 grid gap-3 md:grid-cols-3">
                    <div class="rounded-xl border border-gray-700 bg-gray-900 p-3">
                      <p class="text-[11px] font-bold text-gray-500">無音カット</p>
                      <p class="mt-1 text-sm font-bold" :class="silenceCutVideoExportAsset?.ready ? 'text-teal-200' : 'text-gray-400'">{{ silenceCutVideoExportAsset?.ready ? "生成済み" : "未生成" }}</p>
                    </div>
                    <div class="rounded-xl border border-gray-700 bg-gray-900 p-3">
                      <p class="text-[11px] font-bold text-gray-500">字幕</p>
                      <p class="mt-1 text-sm font-bold" :class="subtitledVideoExportAsset?.ready ? 'text-indigo-200' : 'text-gray-400'">{{ subtitledVideoExportAsset?.ready ? "生成済み" : "未生成" }}</p>
                    </div>
                    <div class="rounded-xl border border-gray-700 bg-gray-900 p-3">
                      <p class="text-[11px] font-bold text-gray-500">素材</p>
                      <p class="mt-1 text-sm font-bold text-gray-100">{{ videoAdjustmentReadyDownloadAssets.length }}/{{ videoAdjustmentDownloadAssets.length }}</p>
                    </div>
                  </div>
                  <div class="mt-5 grid gap-3 lg:grid-cols-2">
                    <div
                      v-for="asset in videoAdjustmentDownloadAssets"
                      :key="asset.key"
                      class="flex min-w-0 items-center gap-3 rounded-lg border p-3"
                      :class="asset.ready ? 'border-gray-700 bg-gray-900' : 'border-gray-800 bg-gray-900/50 opacity-60'"
                    >
                      <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gray-800 text-gray-200">
                        <UIcon :name="assetKindIcon(asset.kind)" class="h-5 w-5" />
                      </div>
                      <div class="min-w-0 flex-1">
                        <div class="flex items-center gap-2">
                          <span class="truncate text-xs font-bold text-gray-100">{{ asset.label }}</span>
                          <span class="rounded bg-gray-800 px-1.5 py-0.5 text-[10px] text-gray-400">{{ assetKindLabel(asset.kind) }}</span>
                        </div>
                        <p class="mt-0.5 truncate text-[11px] text-gray-500">{{ asset.description }}</p>
                      </div>
                      <button class="inline-flex shrink-0 items-center gap-1 rounded-lg bg-gray-700 px-2.5 py-1.5 text-xs font-bold text-gray-100 hover:bg-gray-600 disabled:cursor-not-allowed disabled:opacity-50" :disabled="!asset.ready || Boolean(downloadingAssetKey) || isBulkDownloadingAssets" @click="downloadExportAsset(asset)">
                        <UIcon :name="downloadingAssetKey === asset.key ? 'i-heroicons-arrow-path' : 'i-heroicons-arrow-down-tray'" class="h-4 w-4" :class="downloadingAssetKey === asset.key ? 'animate-spin' : ''" />
                        保存
                      </button>
                    </div>
                  </div>
                  <div class="mt-5 flex flex-wrap justify-between gap-2">
                    <button type="button" class="rounded-xl bg-gray-700 px-4 py-2 text-sm font-bold text-gray-100 hover:bg-gray-600 disabled:opacity-50" :disabled="Boolean(activeRequest)" @click="setVideoAdjustmentSubStep('silence_settings')">設定を変更</button>
                    <button type="button" class="rounded-xl bg-indigo-500 px-4 py-2 text-sm font-bold text-white hover:bg-indigo-600 disabled:opacity-50" :disabled="Boolean(activeRequest)" @click="setVideoAdjustmentSubStep('run')">もう一度実行</button>
                  </div>
                </div>

                <aside class="rounded-xl border border-gray-700 bg-gray-800 p-4">
                  <h4 class="text-sm font-bold text-gray-200">結果プレビュー</h4>
                  <video v-if="videoAdjustmentPreviewUrl" :src="videoAdjustmentPreviewUrl" class="mt-3 aspect-video w-full rounded bg-black" controls />
                  <div v-else class="mt-3 flex aspect-video items-center justify-center rounded bg-gray-950 text-sm text-gray-500">プレビュー待ち</div>
                  <p class="mt-3 text-xs leading-5 text-gray-500">優先表示: 字幕付き動画 → 無音カット版動画 → 字幕なし最終動画。現在は {{ videoAdjustmentPreviewLabel }} を表示しています。</p>
                </aside>
              </section>
            </div>
          </div>

          <div v-if="!isAiNarrationStep && !isExportStep && !isSubtitleStep" class="flex h-[500px] shrink-0 flex-col bg-gray-800">
            <div class="border-b border-gray-700 bg-gray-850 px-4 py-2">
              <div class="flex items-center gap-3 text-sm">
                <div v-if="!isRecording" class="flex items-center gap-1 border-r border-gray-600 pr-3">
                  <button v-for="jump in [-5, -1, -0.5, 0.5, 1, 5]" :key="jump" class="flex flex-col items-center rounded p-1 text-gray-200 hover:bg-gray-700" @click="seekBy(jump)">
                    <UIcon :name="jump < 0 ? 'i-heroicons-backward-solid' : 'i-heroicons-forward-solid'" class="h-5 w-5" />
                    <span class="mt-0.5 text-[8px] opacity-60">{{ Math.abs(jump) }}s</span>
                  </button>
                </div>
                <div class="flex flex-1 items-center justify-center gap-3">
                  <template v-if="isRecording">
                    <button class="inline-flex items-center gap-2 rounded-lg bg-amber-500/20 px-4 py-2 font-bold text-amber-200 ring-1 ring-amber-500/50 hover:bg-amber-500/30" :disabled="isSavingRecording" @click="isRecordingPaused ? resumeRecording() : pauseRecording()">
                      <UIcon :name="isRecordingPaused ? 'i-heroicons-play-solid' : 'i-heroicons-pause-solid'" class="h-5 w-5" />
                      {{ isRecordingPaused ? "再開" : "一時停止" }}
                    </button>
                    <button class="inline-flex items-center gap-2 rounded-lg bg-red-500/20 px-4 py-2 font-bold text-red-200 ring-1 ring-red-500/50 hover:bg-red-500/30" :disabled="isSavingRecording" @click="retakeRecording">
                      <UIcon name="i-heroicons-arrow-path-solid" class="h-5 w-5" />
                      撮り直し
                    </button>
                    <div class="audio-level-meter flex items-center gap-1">
                      <span
                        v-for="i in 10"
                        :key="i"
                        class="w-1 rounded-sm transition-all duration-75"
                        :class="meterBarClass(i)"
                        :style="{ height: meterBarActive(i) ? '16px' : '8px', opacity: meterBarActive(i) ? 1 : 0.3 }"
                      />
                    </div>
                    <div class="flex items-center gap-2 rounded-lg border border-red-500/50 bg-red-500/20 px-4 py-2">
                      <UIcon name="i-heroicons-clock-solid" class="h-5 w-5 text-red-300" />
                      <span class="text-lg font-bold text-red-200">残り {{ formattedRecordingRemaining }}</span>
                    </div>
                    <button class="rounded-lg bg-emerald-500 px-4 py-2 font-bold text-white hover:bg-emerald-600 disabled:opacity-60" :disabled="isSavingRecording" @click="stopRecording">
                      {{ isSavingRecording ? "保存中" : "完了" }}
                    </button>
                  </template>
                  <template v-else>
                  <button class="inline-flex items-center gap-2 rounded-lg bg-gray-700 px-3 py-2 font-bold text-gray-100 hover:bg-gray-600" @click="seekTo(0)">
                    <UIcon name="i-heroicons-backward-solid" class="h-5 w-5" />
                    先頭から再生
                    <span class="rounded bg-white/10 px-1 text-xs">A</span>
                  </button>
                  <button class="inline-flex items-center gap-2 rounded-lg bg-indigo-500 px-3 py-2 font-bold text-white hover:bg-indigo-600" @click="togglePlay">
                    <UIcon :name="isPlaying ? 'i-heroicons-pause-solid' : 'i-heroicons-play-solid'" class="h-5 w-5" />
                    {{ isPlaying ? "一時停止" : "再生" }}
                    <span class="rounded bg-white/20 px-1 text-xs">Space</span>
                  </button>
                  <span class="px-2 font-mono text-base font-bold text-white">{{ formatDuration(currentTime) }} / {{ formatDuration(duration) }}</span>
                  <button v-if="isSectionSplitStep" class="inline-flex items-center gap-2 rounded-lg bg-gray-700 px-3 py-2 font-bold text-gray-100 hover:bg-gray-600" @click="splitAtCurrentPosition">
                    <UIcon name="i-heroicons-scissors-solid" class="h-5 w-5" />
                    現在地点で分割
                    <span class="rounded bg-white/10 px-1 text-xs">C</span>
                  </button>
                  <button v-if="isRecordingStep && requiresRecordingFlow" class="inline-flex items-center gap-2 rounded-lg bg-red-500 px-3 py-2 font-bold text-white hover:bg-red-600 disabled:opacity-50" :disabled="!selectedSectionForRecording || !mediaDevicesSupport.supported || isSavingRecording || isPreparingRecording" @click="startRecording">
                    <UIcon name="i-heroicons-microphone-solid" class="h-5 w-5" />
                    録音開始
                    <span class="rounded bg-white/20 px-1 text-xs">R</span>
                  </button>
                  </template>
                </div>
                <div v-if="!isRecording" class="flex items-center gap-2 border-l border-gray-600 pl-3">
                  <button class="rounded bg-gray-700 p-2 hover:bg-gray-600" @click="timelineZoom = Math.max(1, timelineZoom - 10)">
                    <UIcon name="i-heroicons-magnifying-glass-minus-solid" class="h-4 w-4" />
                  </button>
                  <span class="min-w-[3rem] text-center text-xs text-gray-400">{{ timelineZoom }}px/s</span>
                  <button class="rounded bg-gray-700 p-2 hover:bg-gray-600" @click="timelineZoom = Math.min(500, timelineZoom + 10)">
                    <UIcon name="i-heroicons-magnifying-glass-plus-solid" class="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>

            <div class="min-h-0 flex-1 overflow-auto p-4">
              <div
                ref="timelineContainer"
                class="relative h-44 min-w-full rounded-lg border border-gray-700 bg-gray-900 select-none"
                :class="isDraggingPlayhead ? 'cursor-grabbing' : 'cursor-crosshair'"
                :style="{ width: `${timelineWidth}px` }"
                @pointerdown="handleTimelinePointerDown"
                @pointermove="handleTimelinePointerMove"
                @pointerup="handleTimelinePointerUp"
                @pointercancel="handleTimelinePointerUp"
                @lostpointercapture="handleTimelinePointerUp"
              >
                <div class="absolute left-0 right-0 top-0 h-8 border-b border-gray-700 bg-gray-850">
                  <span v-for="tick in timelineTicks" :key="tick" class="absolute top-0 h-full border-l border-gray-700 text-[10px] text-gray-500" :style="{ left: `${tick * safeTimelineZoom}px` }">
                    <span class="ml-1">{{ formatDuration(tick) }}</span>
                  </span>
                </div>
                <button
                  v-for="(section, index) in editorSections"
                  :key="section.id"
                  class="absolute top-12 h-24 overflow-hidden rounded border text-left text-xs font-bold shadow-sm transition"
                  :class="selectedSectionIndex === index ? 'border-indigo-300 bg-indigo-500 text-white' : 'border-gray-600 bg-gray-700 text-gray-200'"
                  :style="{ left: `${sectionStartSeconds(section) * safeTimelineZoom}px`, width: `${Math.max(48, sectionDurationSeconds(section) * safeTimelineZoom)}px` }"
                  @click="selectSection(index)"
                >
                  <div class="flex h-14 border-b border-white/10 bg-gray-950">
                    <div class="relative min-w-0 flex-1 overflow-hidden border-r border-white/10">
                      <img v-if="timelineThumbnail(section.id, 'start')?.kind === 'image'" :src="timelineThumbnail(section.id, 'start')?.url" alt="" class="h-full w-full object-cover">
                      <video v-else-if="timelineThumbnail(section.id, 'start')?.kind === 'video'" :src="timelineThumbnail(section.id, 'start')?.url" class="h-full w-full object-cover" muted playsinline preload="metadata" @loadedmetadata="handleTimelineThumbnailVideoReady($event, timelineThumbnail(section.id, 'start'), 'loadedmetadata')" @loadeddata="handleTimelineThumbnailVideoReady($event, timelineThumbnail(section.id, 'start'), 'loadeddata')" @canplay="handleTimelineThumbnailVideoReady($event, timelineThumbnail(section.id, 'start'), 'canplay')" @error="handleTimelineThumbnailVideoError($event, section.id, 'start')" />
                      <div v-else class="flex h-full items-center justify-center bg-gray-950 text-[10px] text-gray-500">
                        {{ formatDuration(section.startTime) }}
                      </div>
                      <span class="absolute bottom-1 left-1 rounded bg-black/60 px-1 text-[9px] font-bold text-white">IN</span>
                    </div>
                    <div class="relative min-w-0 flex-1 overflow-hidden">
                      <img v-if="timelineThumbnail(section.id, 'end')?.kind === 'image'" :src="timelineThumbnail(section.id, 'end')?.url" alt="" class="h-full w-full object-cover">
                      <video v-else-if="timelineThumbnail(section.id, 'end')?.kind === 'video'" :src="timelineThumbnail(section.id, 'end')?.url" class="h-full w-full object-cover" muted playsinline preload="metadata" @loadedmetadata="handleTimelineThumbnailVideoReady($event, timelineThumbnail(section.id, 'end'), 'loadedmetadata')" @loadeddata="handleTimelineThumbnailVideoReady($event, timelineThumbnail(section.id, 'end'), 'loadeddata')" @canplay="handleTimelineThumbnailVideoReady($event, timelineThumbnail(section.id, 'end'), 'canplay')" @error="handleTimelineThumbnailVideoError($event, section.id, 'end')" />
                      <div v-else class="flex h-full items-center justify-center bg-gray-950 text-[10px] text-gray-500">
                        {{ formatDuration(section.endTime) }}
                      </div>
                      <span class="absolute bottom-1 right-1 rounded bg-black/60 px-1 text-[9px] font-bold text-white">OUT</span>
                    </div>
                  </div>
                  <div class="flex h-10 flex-col justify-center px-2">
                    <span class="block truncate">{{ section.title || `Section ${index + 1}` }}</span>
                    <span class="mt-0.5 truncate text-[10px] font-semibold opacity-70">{{ formatDuration(section.startTime) }} - {{ formatDuration(section.endTime) }}</span>
                  </div>
                </button>
                <div
                  class="absolute bottom-0 top-0 z-20 w-1 -translate-x-1/2 cursor-grab rounded-full bg-red-400 shadow-[0_0_0_1px_rgba(255,255,255,0.35),0_0_18px_rgba(248,113,113,0.75)] active:cursor-grabbing"
                  :style="{ left: `${safeNonNegativeSeconds(currentTime) * safeTimelineZoom}px` }"
                  @pointerdown.stop="handlePlayheadPointerDown"
                >
                  <div class="absolute -top-1 left-1/2 h-3 w-3 -translate-x-1/2 rounded-full bg-red-300 ring-2 ring-red-100/80" />
                </div>
              </div>
              <div v-if="timelineWaveformSegments.length > 0" class="mt-4 rounded-lg border border-gray-700 bg-gray-900 p-3">
                <div class="mb-2 flex items-center justify-between">
                  <span class="text-xs font-bold text-gray-300">録音波形</span>
                  <span class="text-xs text-gray-500">{{ timelineWaveformSegments.length }} tracks</span>
                </div>
                <div class="overflow-x-auto">
                  <div class="relative h-20 rounded bg-gray-950" :style="{ width: `${timelineWidth}px` }">
                    <div
                      v-for="segment in timelineWaveformSegments"
                      :key="segment.key"
                      class="absolute top-0 flex h-full items-center gap-0.5 overflow-hidden rounded border px-1"
                      :class="segment.selected ? 'border-emerald-300/70 bg-emerald-500/10' : 'border-emerald-500/20 bg-emerald-500/5'"
                      :style="{ left: `${segment.left}px`, width: `${segment.width}px` }"
                    >
                      <span
                        v-for="bar in segment.bars"
                        :key="bar.key"
                        class="min-w-[2px] flex-1 rounded-sm bg-emerald-400"
                        :style="{ height: `${bar.height}%` }"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>

      <footer class="flex h-7 items-center justify-between border-t border-gray-700 bg-[#111827] px-3 text-xs text-gray-400">
        <div class="flex items-center gap-4">
          <span>縮小 ⌘+-</span>
          <span>{{ editorZoom }}%</span>
          <span>拡大 ⌘++</span>
          <span>動画編集エディタ</span>
        </div>
        <div class="flex items-center gap-4">
          <span>Default</span>
          <span>Super</span>
          <span>{{ store.selectedProject.voiceName }}</span>
        </div>
      </footer>

      <div v-if="showDebugInfo" class="fixed bottom-12 right-4 z-50 max-w-sm rounded-lg bg-black/80 p-4 text-xs text-white">
        <div class="mb-2 flex items-center justify-between">
          <h4 class="font-bold">{{ debugPanelTitle }}</h4>
          <button class="text-gray-400 hover:text-white" @click="showDebugInfo = false">x</button>
        </div>
        <div class="space-y-1">
          <template v-if="isSectionSplitStep">
            <div class="font-semibold text-blue-300">分割ポイント情報</div>
            <div>分割ポイント数: {{ editorSections.length }}</div>
            <div class="font-semibold text-green-300 mt-2">セクション情報</div>
            <div>セクション数: {{ editorSections.length }}</div>
            <div v-if="editorSections.length">総時間: {{ (editorSections.at(-1)?.endTime || 0).toFixed(2) }}s</div>
            <div>選択中セクション: {{ selectedSectionIndex }}</div>
            <div class="font-semibold text-purple-300 mt-2">動画情報</div>
            <div>現在時刻: {{ currentTime.toFixed(2) }}s</div>
            <div>動画長: {{ duration.toFixed(2) }}s</div>
            <div>再生中: {{ isPlaying ? "OK" : "NO" }}</div>
          </template>
          <template v-else-if="isRecordingStep">
            <div class="font-semibold text-blue-300">録音状態</div>
            <div>録音中: {{ isRecording ? "OK" : "NO" }}</div>
            <div>一時停止: {{ isRecordingPaused ? "YES" : "NO" }}</div>
            <div>オーディオレベル: {{ (audioLevel * 100).toFixed(1) }}%</div>
            <div>録音データ: {{ recordedWaveformData.length ? "OK" : "NO" }}</div>
            <div class="font-semibold text-green-300 mt-2">セクション情報</div>
            <div v-if="selectedSectionForRecording">アクティブセクション: {{ selectedSectionIndex }} ({{ selectedSectionForRecording.startTime.toFixed(2) }}s - {{ selectedSectionForRecording.endTime.toFixed(2) }}s)</div>
            <div v-if="selectedSectionForRecording">終了まで: {{ recordingRemaining.toFixed(2) }}s</div>
            <div class="font-semibold text-purple-300 mt-2">マイク権限</div>
            <div>サポート: {{ mediaDevicesSupport.supported ? "OK" : "NO" }}</div>
            <div>プロトコル: {{ mediaDevicesSupport.protocol }}</div>
            <div>ホスト: {{ mediaDevicesSupport.hostname }}</div>
            <div>セキュア: {{ mediaDevicesSupport.isSecureContext ? "OK" : "NO" }}</div>
          </template>
          <template v-else-if="isAiNarrationStep">
            <div class="font-semibold text-blue-300">文字起こし状態</div>
            <div>完了セクション: {{ completedNarrationSections }}/{{ editorSections.length }}</div>
            <div class="font-semibold text-green-300 mt-2">TTS状態</div>
            <div>完了セクション: {{ completedTtsSections }}/{{ editorSections.length }}</div>
            <div class="font-semibold text-emerald-300 mt-2">編集確定</div>
            <div>確定セクション: {{ fixedSectionsCount }}/{{ editorSections.length }}</div>
            <div class="font-semibold text-purple-300 mt-2">セクション詳細</div>
            <div v-for="(section, index) in editorSections" :key="section.id" class="flex justify-between gap-3">
              <span>セクション{{ index }}:</span>
              <span>text {{ section.finalyNarrations.length ? "OK" : "NO" }} / tts {{ sectionHasGeneratedAudio(section) ? "OK" : "NO" }} / fixed {{ section.isFixed ? "OK" : "NO" }}</span>
            </div>
          </template>
          <template v-else>
            <div class="font-semibold text-blue-300">エクスポート状態</div>
            <div>エクスポート中: {{ activeRequest === "export" ? "OK" : "NO" }}</div>
            <div>ステータス: {{ requestNotice?.message || "待機中" }}</div>
            <div class="font-semibold text-green-300 mt-2">ファイル情報</div>
            <div>ダウンロードURL: {{ store.selectedProjectOutputUrl ? "OK" : "NO" }}</div>
          </template>
        </div>
      </div>
    </div>

    <div v-if="!embedded && isRegisterModalOpen" class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <form class="w-full max-w-3xl overflow-hidden rounded-3xl bg-white shadow-2xl" @submit.prevent="registerVideo">
        <div class="border-b border-gray-100 px-6 py-5">
          <h2 class="text-2xl font-bold text-gray-900">動画を登録</h2>
          <p class="mt-1 text-sm text-gray-500">Vohance に取り込む素材動画を登録します。</p>
        </div>
        <div class="grid gap-6 p-6 lg:grid-cols-[1fr_1.2fr]">
          <div class="space-y-4">
            <label class="block text-sm font-bold text-gray-800">
              動画タイトル <span class="text-red-500">*</span>
              <input v-model="registerForm.title" class="mt-2 w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-purple-300 focus:ring-4 focus:ring-purple-100" placeholder="動画のタイトルを入力してください">
            </label>
            <label class="block text-sm font-bold text-gray-800">
              動画説明 <span class="text-xs font-normal text-gray-400">(任意)</span>
              <textarea v-model="registerForm.description" rows="4" class="mt-2 w-full resize-none rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-purple-300 focus:ring-4 focus:ring-purple-100" placeholder="動画の説明を入力してください" />
            </label>
            <label class="block text-sm font-bold text-gray-800">
              タグ <span class="text-xs font-normal text-gray-400">(カンマ区切り)</span>
              <input v-model="registerForm.tagsText" class="mt-2 w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-purple-300 focus:ring-4 focus:ring-purple-100" placeholder="demo, product">
            </label>
          </div>
          <div class="space-y-4">
            <div class="grid grid-cols-2 gap-2 rounded-xl bg-gray-100 p-1">
              <button type="button" class="rounded-lg px-4 py-2 text-sm font-bold" :class="registerForm.sourceType === 'upload' ? 'bg-gray-950 text-white' : 'text-gray-600'" @click="registerForm.sourceType = 'upload'">
                アップロード
              </button>
              <button type="button" class="rounded-lg px-4 py-2 text-sm font-bold" :class="registerForm.sourceType === 'youtube' ? 'bg-gray-950 text-white' : 'text-gray-600'" @click="registerForm.sourceType = 'youtube'">
                YouTube
              </button>
            </div>
            <div v-if="registerForm.sourceType === 'upload'">
              <label class="block text-sm font-bold text-gray-800">動画ファイル <span class="text-red-500">*</span></label>
              <label class="mt-2 flex aspect-video cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-purple-200 bg-purple-50/50 text-center hover:bg-purple-50">
                <UIcon name="i-heroicons-arrow-up-tray" class="mb-3 h-10 w-10 text-purple-500" />
                <span class="font-bold text-gray-700">ファイルを選択</span>
                <span class="mt-1 max-w-full truncate px-6 text-sm text-gray-500">{{ selectedFile?.name || "MP4 / MOV など" }}</span>
                <input ref="fileInput" type="file" accept="video/*" class="hidden" @change="onFileChange">
              </label>
              <div v-if="store.isUploading" class="mt-3">
                <div class="h-2 overflow-hidden rounded-full bg-gray-200">
                  <div class="h-full bg-purple-500" :style="{ width: `${store.uploadProgress}%` }" />
                </div>
                <p class="mt-1 text-xs text-gray-500">アップロード中 {{ store.uploadProgress }}%</p>
              </div>
            </div>
            <label v-else class="block text-sm font-bold text-gray-800">
              YouTube URL <span class="text-red-500">*</span>
              <input v-model="registerForm.sourceUrl" class="mt-2 w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-purple-300 focus:ring-4 focus:ring-purple-100" placeholder="https://youtu.be/...">
            </label>
          </div>
        </div>
        <div class="flex justify-end gap-3 border-t border-gray-100 px-6 py-4">
          <button type="button" class="rounded-xl px-4 py-2 text-sm font-bold text-gray-500 hover:bg-gray-100" @click="isRegisterModalOpen = false">
            キャンセル
          </button>
          <button type="submit" class="rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 px-5 py-2 text-sm font-bold text-white disabled:opacity-50" :disabled="registerDisabled">
            動画を登録
          </button>
        </div>
      </form>
    </div>

    <div v-if="!embedded && isProjectCreateModalOpen" class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div class="w-full max-w-6xl overflow-hidden rounded-lg bg-white shadow-2xl">
        <div class="border-b border-gray-200 bg-slate-800 px-6 py-4 text-white">
          <h2 class="text-lg font-bold">{{ showAutoSectionPreview ? "セクション分割の確認" : "新規プロジェクト作成" }}</h2>
        </div>

        <div v-if="isAutoSectionProcessing || autoSectionStatusText === 'エラー'" class="bg-slate-900 p-6 text-white">
          <div class="mb-4 flex items-center justify-between">
            <div>
              <h3 class="text-xl font-bold">動画の自動セクション化処理中</h3>
              <p class="mt-1 text-sm text-slate-300">動画を解析し、シーンごとに動画と音声をカットしています。</p>
            </div>
            <span class="rounded-full px-3 py-1 text-xs font-bold" :class="autoSectionStatusClass">{{ autoSectionStatusText }}</span>
          </div>
          <div class="h-[420px] overflow-hidden rounded-lg border border-slate-700 bg-black font-mono text-sm">
            <div class="border-b border-slate-800 px-4 py-2 text-slate-400">Terminal</div>
            <div class="h-[380px] space-y-2 overflow-y-auto p-4">
              <div v-for="log in autoSectionLogs" :key="log.id" class="flex gap-3">
                <span class="shrink-0 text-slate-500">{{ log.time }}</span>
                <span :class="log.type === 'error' ? 'text-red-300' : log.type === 'warning' ? 'text-yellow-300' : 'text-emerald-300'">{{ log.message }}</span>
              </div>
              <div v-if="autoSectionLogs.length === 0" class="text-slate-500">RequestDoc の進捗ログを待機しています...</div>
            </div>
          </div>
        </div>

        <div v-else-if="showAutoSectionPreview" class="grid max-h-[72vh] grid-cols-1 gap-6 overflow-y-auto p-6 lg:grid-cols-2">
          <div class="space-y-4">
            <p class="text-sm text-gray-600">
              自動セクション化の結果を確認してください。行をクリックしてセクション動画をプレビューできます。問題なければOKを、やり直す場合はプロンプトを編集して「やり直し」をクリックしてください。
            </p>
            <div class="max-h-[320px] overflow-y-auto rounded-lg border border-gray-200">
              <table class="w-full text-sm">
                <thead class="sticky top-0 bg-gray-100 text-left text-gray-700">
                  <tr>
                    <th class="px-3 py-2">#</th>
                    <th class="px-3 py-2">タイトル</th>
                    <th class="px-3 py-2 text-right">開始</th>
                    <th class="px-3 py-2 text-right">終了</th>
                    <th class="px-3 py-2 text-right">長さ</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-gray-100">
                  <tr
                    v-for="(section, index) in autoSectionPreviewSections"
                    :key="section.id"
                    class="cursor-pointer"
                    :class="autoSectionPreviewIndex === index ? 'bg-orange-100' : 'hover:bg-gray-50'"
                    @click="selectAutoSectionPreview(index)"
                  >
                    <td class="px-3 py-2">{{ index + 1 }}</td>
                    <td class="px-3 py-2">{{ section.title || `セクション ${index + 1}` }}</td>
                    <td class="px-3 py-2 text-right">{{ formatDuration(section.startTime) }}</td>
                    <td class="px-3 py-2 text-right">{{ formatDuration(section.endTime) }}</td>
                    <td class="px-3 py-2 text-right">{{ formatDuration(section.endTime - section.startTime) }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div>
              <label class="mb-1 block text-sm font-bold text-gray-900">セクション分割の指示（やり直し時に使用）</label>
              <textarea v-model="projectForm.sectioningPrompt" rows="2" class="w-full resize-none rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-purple-300 focus:ring-4 focus:ring-purple-100" placeholder="例: 30秒ごとに区切ってください / シーンの切り替わりで分割してください" />
            </div>
          </div>
          <div class="space-y-2">
            <p class="text-sm font-bold text-gray-700">
              プレビュー
              <span v-if="selectedAutoSectionPreview" class="font-normal text-gray-500">— {{ selectedAutoSectionPreview.title }}</span>
            </p>
            <div class="flex aspect-video min-h-[240px] items-center justify-center overflow-hidden rounded-lg bg-gray-900">
              <video v-if="autoSectionPreviewVideoUrl" :src="autoSectionPreviewVideoUrl" class="h-full w-full object-contain" controls muted playsinline />
              <div v-else class="flex flex-col items-center text-gray-500">
                <UIcon name="i-heroicons-film" class="mb-2 h-12 w-12" />
                <span class="text-sm">セクションを選択してプレビュー</span>
              </div>
            </div>
          </div>
        </div>

        <form v-else class="grid grid-cols-1 gap-6 p-6 lg:grid-cols-2" @submit.prevent="createProject">
          <div class="space-y-5">
            <div>
              <label class="mb-1 block text-sm font-bold text-gray-900">プロジェクト名 <span class="text-red-600">*</span></label>
              <input v-model="projectForm.name" class="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-purple-300 focus:ring-4 focus:ring-purple-100" placeholder="例: マーケティング動画 v1">
            </div>
            <div>
              <label class="mb-1 block text-sm font-bold text-gray-900">説明 <span class="text-red-600">*</span></label>
              <textarea v-model="projectForm.description" rows="3" class="w-full resize-none rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-purple-300 focus:ring-4 focus:ring-purple-100" placeholder="このプロジェクトの用途や目的を入力" />
            </div>
            <div>
              <label class="mb-2 block text-sm font-bold text-gray-900">動画音声タイプ <span class="text-red-600">*</span></label>
              <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <button type="button" class="relative rounded-md border bg-white p-4 text-left transition hover:bg-gray-50" :class="projectForm.videoAudioType === 'without_audio' ? 'border-black ring-1 ring-black/20' : 'border-gray-200'" @click="projectForm.videoAudioType = 'without_audio'">
                  <span class="absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full" :class="projectForm.videoAudioType === 'without_audio' ? 'bg-black text-white' : 'bg-gray-200 text-gray-600'"><UIcon name="i-heroicons-check" class="h-4 w-4" /></span>
                  <div class="flex gap-3">
                    <div class="rounded-md bg-gray-100 p-2"><UIcon name="i-heroicons-microphone" class="h-6 w-6" /></div>
                    <div><div class="font-bold text-black">音声なし動画</div><div class="mt-1 text-xs text-gray-600">セクション分割後、録音ステップで音声を追加します</div></div>
                  </div>
                </button>
                <button type="button" class="relative rounded-md border bg-white p-4 text-left transition hover:bg-gray-50" :class="projectForm.videoAudioType === 'with_audio' ? 'border-black ring-1 ring-black/20' : 'border-gray-200'" @click="projectForm.videoAudioType = 'with_audio'">
                  <span class="absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full" :class="projectForm.videoAudioType === 'with_audio' ? 'bg-black text-white' : 'bg-gray-200 text-gray-600'"><UIcon name="i-heroicons-check" class="h-4 w-4" /></span>
                  <div class="flex gap-3">
                    <div class="rounded-md bg-gray-100 p-2"><UIcon name="i-heroicons-speaker-wave" class="h-6 w-6" /></div>
                    <div><div class="font-bold text-black">音声付き動画</div><div class="mt-1 text-xs text-gray-600">作成時にAIで自動セクション化してからエディタに進みます</div></div>
                  </div>
                </button>
              </div>
            </div>
            <div v-if="projectForm.videoAudioType === 'with_audio'">
              <label class="mb-1 block text-sm font-bold text-gray-900">セクション分割の指示 <span class="text-xs font-normal text-gray-500">(任意)</span></label>
              <textarea v-model="projectForm.sectioningPrompt" rows="3" class="w-full resize-none rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-purple-300 focus:ring-4 focus:ring-purple-100" placeholder="例: 30秒ごとに区切ってください / シーンの切り替わりで分割してください" />
            </div>
            <select v-model="projectForm.voiceName" class="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-purple-300 focus:ring-4 focus:ring-purple-100">
              <option value="Puck">Puck / 明るめ</option>
              <option value="Kore">Kore / 落ち着き</option>
              <option value="Charon">Charon / 低め</option>
              <option value="Aoede">Aoede / 柔らかめ</option>
            </select>
          </div>
          <div class="space-y-2">
            <p class="text-sm font-bold text-gray-700">プレビュー</p>
            <div class="flex aspect-video min-h-[240px] items-center justify-center overflow-hidden rounded-lg bg-gray-900">
              <iframe v-if="youtubeEmbedUrl" :src="youtubeEmbedUrl" class="h-full w-full" allowfullscreen />
              <video v-else-if="store.selectedVideoUrl" :src="store.selectedVideoUrl" class="h-full w-full object-contain" controls playsinline />
              <UIcon v-else name="i-heroicons-film" class="h-16 w-16 text-gray-600" />
            </div>
          </div>
        </form>

        <div class="flex justify-end gap-3 border-t border-gray-200 px-6 py-4">
          <template v-if="showAutoSectionPreview">
            <button class="rounded-xl border border-gray-200 px-4 py-2 text-sm font-bold text-gray-700 hover:bg-gray-50" :disabled="isAutoSectionProcessing" @click="retryAutoSection">
              やり直し
            </button>
            <button class="rounded-xl bg-gray-950 px-5 py-2 text-sm font-bold text-white" @click="confirmAutoSectionPreview">
              OK
            </button>
          </template>
          <template v-else-if="autoSectionStatusText === 'エラー'">
            <button type="button" class="rounded-xl px-4 py-2 text-sm font-bold text-gray-500 hover:bg-gray-100" @click="closeProjectCreateModal">
              キャンセル
            </button>
            <button class="rounded-xl bg-gray-950 px-5 py-2 text-sm font-bold text-white" @click="retryAutoSection">
              やり直し
            </button>
          </template>
          <template v-else-if="!isAutoSectionProcessing">
            <button type="button" class="rounded-xl px-4 py-2 text-sm font-bold text-gray-500 hover:bg-gray-100" @click="closeProjectCreateModal">
              キャンセル
            </button>
            <button type="button" class="rounded-xl bg-emerald-500 px-5 py-2 text-sm font-bold text-white disabled:opacity-50" :disabled="!projectForm.name.trim() || !projectForm.description.trim()" @click="createProject">
              作成
            </button>
          </template>
        </div>
      </div>
    </div>

    <div v-if="narrationEditConfirm.open" class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div class="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div class="flex items-center justify-between bg-slate-800 px-5 py-4 text-white">
          <div class="flex items-center gap-3">
            <UIcon name="i-heroicons-exclamation-triangle" class="h-6 w-6" />
            <div>
              <h3 class="text-lg font-bold">音声が初期化されます</h3>
              <p class="text-sm opacity-80">テキスト編集により音声が削除されます</p>
            </div>
          </div>
          <button class="rounded p-1 hover:bg-white/10" @click="narrationEditConfirm.open = false">
            <UIcon name="i-heroicons-x-mark" class="h-5 w-5" />
          </button>
        </div>
        <div class="space-y-6 p-5">
          <div class="flex items-start gap-3 rounded-lg border border-yellow-200 bg-yellow-50 p-4">
            <UIcon name="i-heroicons-exclamation-triangle" class="mt-0.5 h-5 w-5 shrink-0 text-yellow-600" />
            <div>
              <p class="text-sm font-bold text-yellow-800">このセクションには音声が生成されています</p>
              <p class="mt-1 text-sm text-yellow-700">テキストを編集すると、既存の音声が初期化されます。再度「音声生成」ボタンを押して音声を生成し直す必要があります。</p>
            </div>
          </div>
          <div class="flex items-center gap-2 text-sm text-gray-700">
            <UIcon name="i-heroicons-document-text" class="h-4 w-4 text-gray-500" />
            <span class="font-bold">対象セクション:</span>
            <span class="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-bold">{{ narrationEditConfirm.sectionTitle }}</span>
          </div>
        </div>
        <div class="flex justify-end gap-3 border-t border-gray-100 px-5 py-4">
          <button class="rounded-xl bg-gray-100 px-4 py-2 text-sm font-bold text-gray-700 hover:bg-gray-200" @click="narrationEditConfirm.open = false">
            キャンセル
          </button>
          <button class="rounded-xl bg-yellow-500 px-4 py-2 text-sm font-bold text-white hover:bg-yellow-600" @click="void confirmNarrationEdit()">
            編集を続ける
          </button>
        </div>
      </div>
    </div>

    <Teleport to="body">
      <div v-if="isVoiceSelectorModalOpen" class="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div class="w-full max-w-3xl overflow-hidden rounded-2xl border border-gray-700 bg-gray-900 text-gray-100 shadow-2xl">
        <div class="flex items-center justify-between border-b border-gray-700 px-5 py-4">
          <div>
            <h3 class="text-lg font-bold">読み上げ音声を変更</h3>
            <p class="mt-1 text-xs text-gray-400">丸アイコンに触れるとサンプルを再生します。選択した音声は次回のAI音声生成から使われます。</p>
          </div>
          <button class="rounded p-1 text-gray-400 hover:bg-gray-800 hover:text-white" @click="closeVoiceSelectorModal">
            <UIcon name="i-heroicons-x-mark" class="h-5 w-5" />
          </button>
        </div>
        <div class="grid gap-3 p-5 sm:grid-cols-2 lg:grid-cols-3">
          <button
            v-for="voice in ttsVoiceOptions"
            :key="voice.name"
            type="button"
            class="group flex items-center gap-3 rounded-xl border p-3 text-left transition"
            :class="store.selectedProject?.voiceName === voice.name ? 'border-indigo-300 bg-indigo-500/20 shadow-lg shadow-indigo-500/10' : 'border-gray-700 bg-gray-850 hover:border-gray-500 hover:bg-gray-800'"
            @click="selectVoiceName(voice.name)"
            @mouseenter="void playVoicePreview(voice.name)"
          >
            <span class="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-lg font-black transition group-hover:scale-105" :class="voiceAvatarClass(voice.color)">
              {{ voice.displayName.slice(0, 1) }}
              <span v-if="voicePreviewLoadingMap[voice.name]" class="absolute inset-0 flex items-center justify-center rounded-full bg-black/45">
                <UIcon name="i-heroicons-arrow-path" class="h-5 w-5 animate-spin text-white" />
              </span>
              <span v-else-if="playingVoiceName === voice.name" class="absolute inset-0 flex items-center justify-center rounded-full bg-black/45">
                <UIcon name="i-heroicons-speaker-wave" class="h-5 w-5 text-white" />
              </span>
            </span>
            <span class="min-w-0 flex-1">
              <span class="flex items-center gap-2">
                <span class="font-bold">{{ voice.displayName }}</span>
                <span class="rounded-full bg-gray-800 px-2 py-0.5 text-[10px] text-gray-400">{{ voice.genderLabel }}</span>
              </span>
              <span class="mt-1 block text-xs text-gray-400">{{ voice.description }}</span>
              <span class="mt-1 block font-mono text-[10px] text-gray-500">{{ voice.name }}</span>
            </span>
            <UIcon v-if="store.selectedProject?.voiceName === voice.name" name="i-heroicons-check-circle-solid" class="h-5 w-5 shrink-0 text-indigo-300" />
          </button>
        </div>
        <div class="flex items-center justify-between border-t border-gray-700 px-5 py-3 text-xs text-gray-400">
          <span>選択中: {{ currentVoiceInfo.displayName }} / {{ store.selectedProject?.voiceName || "Puck" }}</span>
          <button class="rounded-lg bg-gray-700 px-3 py-1.5 font-bold text-gray-100 hover:bg-gray-600" @click="stopVoicePreview">
            サンプル停止
          </button>
        </div>
      </div>
      </div>
    </Teleport>

    <div v-if="isLanguageModalOpen" class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div class="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
        <h2 class="text-2xl font-bold text-gray-900">新しい言語を追加</h2>
        <p class="mt-1 text-sm text-gray-500">日本語のナレーションを選択した言語に翻訳します</p>
        <div class="mt-5 space-y-3">
          <button
            v-for="lang in availableLanguages"
            :key="lang.code"
            class="flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left text-sm font-bold"
            :class="selectedLanguage === lang.code ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-gray-200 text-gray-700 hover:bg-gray-50'"
            @click="selectedLanguage = lang.code"
          >
            <UIcon name="i-heroicons-language" class="h-5 w-5" />
            {{ lang.name }}
            <span v-if="addedLanguages.includes(lang.code)" class="ml-auto rounded-full bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700">追加済み</span>
          </button>
        </div>
        <div class="mt-6 flex justify-end gap-2">
          <button class="rounded-xl px-4 py-2 text-sm font-bold text-gray-500 hover:bg-gray-100" @click="isLanguageModalOpen = false">
            キャンセル
          </button>
          <button class="rounded-xl bg-indigo-500 px-4 py-2 text-sm font-bold text-white disabled:opacity-50" :disabled="!selectedLanguage" @click="addLanguage">
            翻訳を開始
          </button>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { doc, getDoc, getFirestore, onSnapshot, Timestamp } from "firebase/firestore";
import { getBytes, getDownloadURL, getStorage, ref as storageRef, uploadBytes } from "firebase/storage";
import { computed, onMounted, onUnmounted, reactive, ref, watch } from "vue";
import { useVideoStudioStore } from "@stores/videoStudio";
import { useContextStore } from "@stores/context";
import { screenVideoAspectPresets, useScreenVideoRecorder } from "@composables/useScreenVideoRecorder";
import { useMasterEditorAIFileSpace } from "@composables/useMasterEditorAIFileSpace";
import { useVoiceInput } from "@composables/useVoiceInput";
import type { VideoStudioSection, VideoStudioVideo } from "@models/videoStudio";
import { reportDatadogError, reportDatadogInfo } from "@utils/datadogObservability";
import appLog from "@utils/logger";
import {
  getMergedVideoStoragePath,
  getNarrationRecordingStoragePath,
  getTtsAudioStoragePath,
  getVideoThumbnailStoragePath,
  getVideoExportStoragePath,
} from "@utils/videoStudioStoragePaths";

defineProps<{
  embedded?: boolean;
}>();

const store = useVideoStudioStore();
const contextStore = useContextStore();
const toast = useToast();
const screenRecorder = useScreenVideoRecorder();
const screenRecordingKnowledge = useMasterEditorAIFileSpace();
const screenRecordingVoiceInput = useVoiceInput();
type WorkflowStepKey = "section_split" | "recording" | "voice_generation" | "export" | "subtitle";
type VideoAudioType = "with_audio" | "without_audio";
type RegisterSourceType = "upload" | "youtube";
type TimelineThumbnailEdge = "start" | "end";
type TimelineThumbnail = {
  kind: "image" | "video";
  url: string;
  time?: number;
};
type TimelineThumbnailPair = Partial<Record<TimelineThumbnailEdge, TimelineThumbnail>>;
type TimelineThumbnailSource = {
  url: string;
  startTime: number;
  endTime: number;
  sourceKind: "selected_video" | "section_segment";
  sourcePath?: string;
};
type WaveformBar = {
  key: string;
  height: number;
};
type TimelineWaveformSegment = {
  key: string;
  left: number;
  width: number;
  selected: boolean;
  bars: WaveformBar[];
};
type AiNarrationSubStep = "transcription" | "adjustment";
type RequestDocType =
  | "videoTranscriptionRequests"
  | "textToSpeechRequests"
  | "mergeVideoAudioNarrationRequests"
  | "concatenateSectionVideosRequests"
  | "addVideoSubtitleRequests"
  | "trimSilenceVideoRequests";
type RequestDocSnapshot = {
  status?: string;
  output?: Record<string, unknown>;
  errorMessage?: string;
};
type StorageOutputPath = {
  bucketName: string;
  filePath: string;
};
type TranscriptionParagraph = {
  text: string;
  start: string;
  startSeconds: number;
};
type AudioSegmentInput = {
  sourceBucketName: string;
  sourceFilePath: string;
  timestampMs: number;
};
type TtsVoiceOption = {
  name: string;
  displayName: string;
  description: string;
  genderLabel: string;
  color: "blue" | "gray" | "green" | "pink" | "purple" | "yellow" | "indigo";
};
type ExportProgressStatus = "pending" | "running" | "completed" | "error" | "skipped";
type ExportProgressItem = {
  key: string;
  label: string;
  status: ExportProgressStatus;
};
type ExportReviewTab = "overview" | "sections" | "assets";
type VideoAdjustmentSubStep = "silence_settings" | "subtitle_settings" | "run" | "download";
type SilenceCutSettingKey = "thresholdDb" | "minSilenceMs" | "keepPaddingMs" | "minSegmentMs";
type ExportAssetKind = "final_video" | "silence_cut_video" | "silence_cut_manifest" | "subtitled_video" | "subtitle_srt" | "subtitle_ass" | "section_video" | "ai_audio" | "recording_audio";
type ExportAsset = {
  key: string;
  kind: ExportAssetKind;
  label: string;
  description: string;
  bucketName: string;
  filePath: string;
  fileName: string;
  ready: boolean;
  sectionIndex?: number;
  segmentIndex?: number;
};
type SubtitlePresetKey = "clear_standard" | "business_emphasis" | "cinema_bottom" | "shorts_pop" | "soft_gray_panel";
type SubtitleSizeKey = "small" | "medium" | "large";
type SubtitleSizeOption = {
  key: SubtitleSizeKey;
  label: string;
  multiplier: number;
};
type SubtitleStyleOption = {
  key: SubtitlePresetKey;
  label: string;
  description: string;
  previewClass: string;
  style: {
    position: "top" | "bottom";
    fontScale: number;
    fontColor: string;
    outlineColor: string;
    backColor: string;
    bold: boolean;
  };
};
type SubtitleSegmentInput = {
  startMs: number;
  endMs: number;
  text: string;
};
type SubtitleCueDraft = {
  text: string;
  weight: number;
};
type SectionTranscriptionSource = {
  kind: "recording" | "source_video";
  mode: "audioFile" | "videoFile";
  bucketName: string;
  filePath: string;
  contentType: string;
  sourceId: string;
  durationSeconds: number;
  waveform?: number[];
};

const fileInput = ref<HTMLInputElement | null>(null);
const screenRecordingLiveVideo = ref<HTMLVideoElement | null>(null);
const detailVideoPlayer = ref<HTMLVideoElement | null>(null);
const editorVideo = ref<HTMLVideoElement | null>(null);
const recordingPlaybackAudio = ref<HTMLAudioElement | null>(null);
const timingPlaybackAudio = ref<HTMLAudioElement | null>(null);
const timelineContainer = ref<HTMLDivElement | null>(null);
const timingTimelineContainer = ref<HTMLDivElement | null>(null);
const selectedFile = ref<File | null>(null);
const screenRecordingTitle = ref("");
const screenRecordingDescription = ref("");
const screenRecordingTagsText = ref("");
const screenRecordingTranscriptFinalSegments = ref<string[]>([]);
const screenRecordingTranscriptInterim = ref("");
const screenRecordingTranscriptError = ref("");
const selectedSectionIndex = ref(0);
const isScreenRecordingModalOpen = ref(false);
const isScreenRecordingSaving = ref(false);
const isRegisterModalOpen = ref(false);
const isProjectCreateModalOpen = ref(false);
const editorZoom = ref(100);
const timelineZoom = ref(10);
const currentTime = ref(0);
const duration = ref(0);
const isPlaying = ref(false);
const isDraggingPlayhead = ref(false);
const isRecording = ref(false);
const isRecordingPaused = ref(false);
const isSavingRecording = ref(false);
const isPreparingRecording = ref(false);
const audioLevel = ref(0);
const recordedWaveformData = ref<number[]>([]);
const recordingElapsed = ref(0);
const recordingTimer = ref<number | null>(null);
const recordingCountdown = ref<number | null>(null);
const recordingMimeType = ref("");
const recordingStartedAt = ref<number | null>(null);
const recordingPausedStartedAt = ref<number | null>(null);
const recordingPausedTotalMs = ref(0);
const activeRecordingSectionIndex = ref<number | null>(null);
const showDebugInfo = ref(false);
const isLanguageModalOpen = ref(false);
const isVoiceSelectorModalOpen = ref(false);
const aiNarrationMode = ref<"narration" | "timing">("narration");
const videoAdjustmentSubStep = ref<VideoAdjustmentSubStep>("silence_settings");
const selectedLanguage = ref<"en" | "zh" | "de" | null>(null);
const addedLanguages = ref<string[]>([]);
const activeRequest = ref<"section" | "transcription" | "tts" | "export" | "subtitle" | "silenceCut" | null>(null);
const requestNotice = ref<{ kind: "success" | "error"; message: string } | null>(null);
const activeTtsRequestKeys = ref<Record<string, boolean>>({});
const isBulkTtsProcessing = ref(false);
const ttsAudioUrlCache = ref<Record<string, string>>({});
const ttsWaveformCache = ref<Record<string, number[]>>({});
const playingTtsKey = ref<string | null>(null);
const playingVoiceName = ref<string | null>(null);
const voicePreviewUrlCache = ref<Record<string, string>>({});
const voicePreviewLoadingMap = ref<Record<string, boolean>>({});
const isSectionSidebarOpen = ref(true);
const selectedExportSectionIndex = ref(0);
const selectedExportSectionPreviewUrl = ref("");
const exportProgressItems = ref<ExportProgressItem[]>([]);
const exportReviewTab = ref<ExportReviewTab>("overview");
const downloadingAssetKey = ref<string | null>(null);
const isBulkDownloadingAssets = ref(false);
const bulkDownloadMessage = ref("");
const subtitleProgressItems = ref<ExportProgressItem[]>([]);
const silenceCutProgressItems = ref<ExportProgressItem[]>([]);
const exportProgress = reactive({
  message: "書き出し待機中です。",
});
const subtitleProgress = reactive({
  message: "字幕生成待機中です。",
});
const silenceCutProgress = reactive({
  message: "無音カット待機中です。",
});
const selectedTimingSegmentIndex = ref<number | null>(null);
const createdProjectIdForAutoSection = ref<string | null>(null);
const autoSectionRequestId = ref<string | null>(null);
const isAutoSectionProcessing = ref(false);
const showAutoSectionPreview = ref(false);
const autoSectionPreviewIndex = ref(0);
const autoSectionPreviewVideoUrl = ref("");
const autoSectionPreviewOutput = ref<{ sections?: Array<Record<string, unknown>> } | null>(null);
const autoSectionLogs = ref<Array<{ id: string; time: string; type: "info" | "warning" | "error"; message: string }>>([]);
const autoSectionStatusText = ref("待機中");
let unsubscribeAutoSection: (() => void) | null = null;
const timelineThumbnails = ref<Record<string, TimelineThumbnailPair>>({});
const recordingAudioUrlCache = ref<Record<string, string>>({});
const recordingWaveformCache = ref<Record<string, number[]>>({});
let thumbnailGenerationToken = 0;
let recordingWaveformHydrationToken = 0;
let recordingPlaybackSyncToken = 0;
let ttsWaveformHydrationToken = 0;
let ttsPreviewAudio: HTMLAudioElement | null = null;
let voicePreviewAudio: HTMLAudioElement | null = null;
let timingPlaybackSyncToken = 0;
let timingPlaybackActiveKey: string | null = null;
let timingPlaybackLastCorrectionAt = 0;
let transcriptionRecoveryToken = 0;
const watchedTranscriptionRequestIds = new Set<string>();
let transcriptionProjectUpdateQueue = Promise.resolve();
let mediaRecorder: MediaRecorder | null = null;
let recordingStream: MediaStream | null = null;
let recordingAudioContext: AudioContext | null = null;
let recordingAnalyser: AnalyserNode | null = null;
let recordingChunks: Blob[] = [];
let recordingDiscardRequested = false;
let recordingCountdownTimer: number | null = null;
const narrationEditConfirm = reactive({
  open: false,
  sectionIndex: 0,
  paragraphIndex: 0,
  sectionTitle: "",
});
const timingSegmentDrag = reactive({
  segmentIndex: null as number | null,
  startX: 0,
  startSeconds: 0,
  deltaX: 0,
});
let bodyOverflowBeforeEditor: string | null = null;
let focusModeBeforeEditor: boolean | null = null;

const safeFiniteNumber = (value: unknown, fallback = 0): number => {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : fallback;
};

const safeNonNegativeSeconds = (value: unknown, fallback = 0): number =>
  Math.max(0, safeFiniteNumber(value, fallback));

const safeTimelineZoom = computed(() =>
  Math.max(1, Math.min(500, safeFiniteNumber(timelineZoom.value, 10)))
);

const sectionStartSeconds = (section: Pick<VideoStudioSection, "startTime">): number =>
  safeNonNegativeSeconds(section.startTime);

const sectionEndSeconds = (section: Pick<VideoStudioSection, "startTime" | "endTime">): number => {
  const start = sectionStartSeconds(section);
  return Math.max(start, safeNonNegativeSeconds(section.endTime, start));
};

const sectionDurationSeconds = (section: Pick<VideoStudioSection, "startTime" | "endTime">): number =>
  Math.max(0, sectionEndSeconds(section) - sectionStartSeconds(section));

const buildBoundedTicks = (totalSeconds: number, minimumSeconds: number, maxTicks = 2000): number[] => {
  const total = Math.min(
    Math.max(safeNonNegativeSeconds(totalSeconds, minimumSeconds), minimumSeconds),
    24 * 60 * 60
  );
  const step = total > 600 ? 60 : total > 180 ? 30 : total > 60 ? 10 : 5;
  const ticks: number[] = [];
  for (let tick = 0; tick <= total && ticks.length < maxTicks; tick += step) {
    ticks.push(tick);
  }
  return ticks;
};

const workflowStepDefinitions: Record<WorkflowStepKey, { key: WorkflowStepKey; title: string }> = {
  section_split: { key: "section_split", title: "セクション分割" },
  recording: { key: "recording", title: "録音・文字起こし" },
  voice_generation: { key: "voice_generation", title: "AIナレーション" },
  export: { key: "export", title: "動画出力" },
  subtitle: { key: "subtitle", title: "動画調整" },
};
const progressStepKeys = (projectAudioType: VideoAudioType): WorkflowStepKey[] =>
  projectAudioType === "with_audio"
    ? ["section_split", "voice_generation", "export", "subtitle"]
    : ["section_split", "recording", "voice_generation", "export", "subtitle"];
const projectProgressStepKeys = (project: { videoAudioType?: VideoAudioType }): WorkflowStepKey[] =>
  progressStepKeys(project.videoAudioType ?? "without_audio");
const selectedProjectAudioType = computed<VideoAudioType>(
  () =>
    store.selectedProject?.videoAudioType ??
    store.selectedVideo?.videoAudioType ??
    "without_audio"
);
const usesOriginalVideoAudio = computed(() => selectedProjectAudioType.value === "with_audio");
const requiresRecordingFlow = computed(() => !usesOriginalVideoAudio.value);
const activeWorkflowStepKeys = computed(() => progressStepKeys(selectedProjectAudioType.value));
const workflowSteps = computed(() =>
  activeWorkflowStepKeys.value.map((key) => workflowStepDefinitions[key])
);
const normalizedCurrentWorkflowStep = computed<WorkflowStepKey>(() => {
  const current = store.selectedProject?.currentStep ?? "section_split";
  if (usesOriginalVideoAudio.value && current === "recording") return "voice_generation";
  return current;
});
const activeWorkflowStep = computed<WorkflowStepKey>(
  () => activeWorkflowStepKeys.value.includes(normalizedCurrentWorkflowStep.value)
    ? normalizedCurrentWorkflowStep.value
    : activeWorkflowStepKeys.value[0] ?? "section_split"
);
const currentWorkflowIndex = computed(() =>
  Math.max(0, activeWorkflowStepKeys.value.findIndex((step) => step === activeWorkflowStep.value))
);
const isSectionSplitStep = computed(() => activeWorkflowStep.value === "section_split");
const isRecordingStep = computed(() => activeWorkflowStep.value === "recording");
const isAiNarrationStep = computed(() => activeWorkflowStep.value === "voice_generation");
const isExportStep = computed(() => activeWorkflowStep.value === "export");
const isSubtitleStep = computed(() => activeWorkflowStep.value === "subtitle");
const exportReviewTabs: ExportReviewTab[] = ["overview", "sections", "assets"];
const videoAdjustmentSubStepOptions: Array<{
  key: VideoAdjustmentSubStep;
  title: string;
  description: string;
}> = [
  { key: "silence_settings", title: "無音カット設定", description: "使う/使わないと検出条件" },
  { key: "subtitle_settings", title: "字幕設定", description: "スタイルとサイズ" },
  { key: "run", title: "実行", description: "選択した処理を連続実行" },
  { key: "download", title: "ダウンロード", description: "成果物の確認と保存" },
];
const silenceCutSettingControls: Array<{
  key: SilenceCutSettingKey;
  label: string;
  unit: string;
  min: number;
  max: number;
  step: number;
  description: string;
}> = [
  {
    key: "thresholdDb",
    label: "無音判定",
    unit: "dB",
    min: -70,
    max: -20,
    step: 1,
    description: "小さいほど静かな箇所だけをカットします。",
  },
  {
    key: "minSilenceMs",
    label: "最小無音長",
    unit: "ms",
    min: 200,
    max: 3000,
    step: 50,
    description: "この長さ以上の無音だけを対象にします。",
  },
  {
    key: "keepPaddingMs",
    label: "前後余白",
    unit: "ms",
    min: 0,
    max: 1000,
    step: 20,
    description: "カット前後に残す余白です。",
  },
  {
    key: "minSegmentMs",
    label: "最小クリップ",
    unit: "ms",
    min: 200,
    max: 3000,
    step: 50,
    description: "短すぎる断片を作らないための下限です。",
  },
];
const subtitleSizeOptions: SubtitleSizeOption[] = [
  { key: "small", label: "小", multiplier: 0.86 },
  { key: "medium", label: "中", multiplier: 1 },
  { key: "large", label: "大", multiplier: 1.16 },
];
const subtitleStyleOptions: SubtitleStyleOption[] = [
  {
    key: "clear_standard",
    label: "クリア標準",
    description: "白文字と強めの縁取りで、業務動画に自然に馴染みます。",
    previewClass: "text-white [text-shadow:0_2px_8px_rgba(0,0,0,0.85)]",
    style: {
      position: "bottom",
      fontScale: 1,
      fontColor: "#FFFFFF",
      outlineColor: "#111827",
      backColor: "rgba(0,0,0,0.35)",
      bold: true,
    },
  },
  {
    key: "business_emphasis",
    label: "ビジネス強調",
    description: "濃色の帯背景で説明文を読みやすく固定します。",
    previewClass: "rounded bg-slate-950/80 px-3 py-1 text-white",
    style: {
      position: "bottom",
      fontScale: 1.02,
      fontColor: "#FFFFFF",
      outlineColor: "#020617",
      backColor: "rgba(15,23,42,0.82)",
      bold: true,
    },
  },
  {
    key: "cinema_bottom",
    label: "シネマ下部",
    description: "やや小さめの映画字幕風。画面の情報を邪魔しません。",
    previewClass: "text-amber-50 [text-shadow:0_2px_8px_rgba(0,0,0,0.9)]",
    style: {
      position: "bottom",
      fontScale: 0.92,
      fontColor: "#FFF7ED",
      outlineColor: "#000000",
      backColor: "rgba(0,0,0,0.15)",
      bold: false,
    },
  },
  {
    key: "shorts_pop",
    label: "ショート動画風",
    description: "太字と大きめサイズで、スマホ視聴でも目に入りやすい字幕です。",
    previewClass: "text-yellow-100 [text-shadow:0_3px_0_rgba(0,0,0,0.9),0_0_14px_rgba(0,0,0,0.7)]",
    style: {
      position: "bottom",
      fontScale: 1.18,
      fontColor: "#FEF3C7",
      outlineColor: "#0F172A",
      backColor: "rgba(0,0,0,0)",
      bold: true,
    },
  },
  {
    key: "soft_gray_panel",
    label: "ソフトグレー",
    description: "薄いグレーの帯背景で、白い業務画面でも上品に読みやすくします。",
    previewClass: "rounded bg-slate-100/90 px-3 py-1 text-slate-950 shadow-sm",
    style: {
      position: "bottom",
      fontScale: 1,
      fontColor: "#111827",
      outlineColor: "#F8FAFC",
      backColor: "rgba(248,250,252,0.88)",
      bold: true,
    },
  },
];

const registerForm = reactive({
  title: "",
  description: "",
  tagsText: "",
  sourceType: "upload" as RegisterSourceType,
  sourceUrl: "",
});

const projectForm = reactive({
  name: "",
  description: "",
  videoAudioType: "with_audio" as "with_audio" | "without_audio",
  voiceName: "Puck",
  sectioningPrompt: "",
});

const availableLanguages = [
  { code: "en" as const, name: "英語" },
  { code: "zh" as const, name: "中国語（簡体字）" },
  { code: "de" as const, name: "ドイツ語" },
];

const ttsVoiceOptions: TtsVoiceOption[] = [
  {
    name: "Zephyr",
    displayName: "ゼファー",
    description: "プロフェッショナルで信頼感のある声",
    genderLabel: "男性",
    color: "blue",
  },
  {
    name: "Charon",
    displayName: "カロン",
    description: "落ち着いた深みのある声",
    genderLabel: "男性",
    color: "gray",
  },
  {
    name: "Puck",
    displayName: "パック",
    description: "明るく親しみやすい声",
    genderLabel: "中性",
    color: "green",
  },
  {
    name: "Kore",
    displayName: "コレ",
    description: "若々しく活発な声",
    genderLabel: "女性",
    color: "pink",
  },
  {
    name: "Fenrir",
    displayName: "フェンリル",
    description: "力強く重厚な声",
    genderLabel: "男性",
    color: "purple",
  },
  {
    name: "Aoede",
    displayName: "アオイデ",
    description: "優しく柔らかい声",
    genderLabel: "女性",
    color: "yellow",
  },
  {
    name: "Perse",
    displayName: "ペルセ",
    description: "穏やかで聞き取りやすい声",
    genderLabel: "女性",
    color: "indigo",
  },
];

const registerDisabled = computed(() => {
  if (store.isUploading) return true;
  if (!registerForm.title.trim()) return true;
  if (registerForm.sourceType === "upload") return !selectedFile.value;
  return !registerForm.sourceUrl.trim();
});
const screenRecordingSaveDisabled = computed(() => {
  if (isScreenRecordingSaving.value) return true;
  if (store.isUploading) return true;
  if (screenRecorder.isRecording.value) return true;
  if (!screenRecorder.hasRecording.value) return true;
  return !screenRecordingTitle.value.trim();
});

const youtubeEmbedUrl = computed(() => {
  const url = store.selectedVideo?.sourceUrl;
  if (!url || store.selectedVideo?.sourceType !== "youtube") return "";
  const match = url.match(
    /(?:youtube\.com\/(?:.*[?&]v=|embed\/)|youtu\.be\/)([^"&?/\\s]{11})/
  );
  return match?.[1] ? `https://www.youtube.com/embed/${match[1]}` : "";
});

const editorSections = computed(() => store.selectedProject?.sections ?? []);
const screenRecordingVideos = computed(() =>
  store.videos.filter((video) => video.sourceType === "screen_recording")
);
const sourceVideos = computed(() =>
  store.videos.filter((video) => video.sourceType !== "screen_recording")
);
const screenRecordingKnowledgeLabel = computed(() => {
  if (screenRecordingKnowledge.isLoadingFileSpace.value) return "社内ナレッジを接続中";
  if (!screenRecordingKnowledge.isFileSpaceConnected.value) return "ナレッジ未接続";
  return `${screenRecordingKnowledge.documentCount.value}件の知識を参照`;
});
const screenRecordingUnderstandingCards = computed(() => [
  {
    label: "画面理解",
    value: screenRecorder.displaySurface.value === "window" ? "Windowを追跡中" : "操作画面を解析中",
    caption: "画面遷移とクリック前後の流れを素材化します",
    icon: "i-heroicons-computer-desktop",
    iconClass: "text-purple-500",
  },
  {
    label: "音声理解",
    value:
      screenRecorder.audioLevel.value > 0.05
        ? "発話を検知中"
        : screenRecorder.includeMicrophone.value
          ? "発話待機中"
          : "画面音声のみ",
    caption: "説明音声を後続の動画解釈に渡します",
    icon: "i-heroicons-microphone",
    iconClass: "text-emerald-500",
  },
  {
    label: "ナレッジ接続",
    value: screenRecordingKnowledgeLabel.value,
    caption: "保存後の編集で文脈理解に使います",
    icon: "i-heroicons-circle-stack",
    iconClass: "text-indigo-500",
  },
]);
const screenRecordingTranscriptText = computed(() =>
  [...screenRecordingTranscriptFinalSegments.value, screenRecordingTranscriptInterim.value]
    .map((line) => line.trim())
    .filter(Boolean)
    .join("\n")
);
const screenRecordingTranscriptLines = computed(() =>
  screenRecordingTranscriptText.value
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
);
const screenRecordingTranscriptBadgeLabel = computed(() => {
  if (!screenRecorder.includeMicrophone.value) return "マイクOFF";
  if (!screenRecordingVoiceInput.isSupported.value) return "未対応";
  if (screenRecordingVoiceInput.isListening.value) return "取得中";
  if (screenRecordingTranscriptText.value) return "保存対象";
  return "待機中";
});
const screenRecordingTranscriptBadgeClass = computed(() => {
  if (screenRecordingVoiceInput.isListening.value) return "bg-emerald-600 text-white";
  if (!screenRecorder.includeMicrophone.value || !screenRecordingVoiceInput.isSupported.value) {
    return "bg-amber-100 text-amber-700";
  }
  if (screenRecordingTranscriptText.value) return "bg-purple-100 text-purple-700";
  return "bg-emerald-100 text-emerald-700";
});
const screenRecordingTranscriptStatusLabel = computed(() => {
  if (!screenRecorder.includeMicrophone.value) {
    return "マイクがOFFのため、録画音声は画面音声のみです。";
  }
  if (!screenRecordingVoiceInput.isSupported.value) {
    return "このブラウザではリアルタイム文字起こしに対応していません。Chromeでの利用を推奨します。";
  }
  if (screenRecordingVoiceInput.isListening.value) {
    return "マイク音声を録画しながら、発話内容を逐次テキスト化しています。";
  }
  if (screenRecordingTranscriptText.value) {
    return "録画中に取得した文字起こしを、このスクリーン撮影のメタ情報として保存します。";
  }
  return "録画開始後、ブラウザ音声認識で発話を拾います。";
});
const screenRecordingLiveInterpretationLines = computed(() => {
  const title = screenRecordingTitle.value.trim() || "タイトル未入力";
  const memo = screenRecordingDescription.value.trim();
  const audioPercent = Math.round(screenRecorder.audioLevel.value * 100);
  return [
    {
      title: "撮影意図",
      body: `「${title}」として録画を整理しています。`,
      dotClass: "bg-purple-500",
    },
    {
      title: "説明音声",
      body:
        audioPercent > 8
          ? `音声入力を検知しています。現在の入力レベルは ${audioPercent}% です。`
          : "マイク音声を待機しています。話し始めると波形と解析状態が反応します。",
      dotClass: "bg-emerald-500",
    },
    {
      title: "解釈メモ",
      body: memo || "録画前にメモを書いておくと、後で候補から選ぶ時に意図が伝わりやすくなります。",
      dotClass: "bg-indigo-500",
    },
  ];
});
const lastSectionEndSeconds = computed(() =>
  editorSections.value.reduce((maxEnd, section) => Math.max(maxEnd, sectionEndSeconds(section)), 0)
);
const timelineDurationSeconds = computed(() =>
  Math.max(safeNonNegativeSeconds(duration.value), lastSectionEndSeconds.value)
);
const timelineWidth = computed(() =>
  Math.max(900, timelineDurationSeconds.value * safeTimelineZoom.value)
);
const timingTrackLabelWidth = 160;
const timelineTicks = computed(() => buildBoundedTicks(timelineDurationSeconds.value, 60));
const timelineWaveformSegments = computed<TimelineWaveformSegment[]>(() =>
  editorSections.value
    .map((section, index) => {
      const width = Math.max(48, sectionDurationSeconds(section) * safeTimelineZoom.value);
      const bars = sectionRecordingWaveformBars(
        section,
        Math.max(8, Math.min(360, Math.floor(width / 5)))
      );
      if (bars.length === 0) return null;
      return {
        key: section.id,
        left: sectionStartSeconds(section) * safeTimelineZoom.value,
        width,
        selected: selectedSectionIndex.value === index,
        bars,
      };
    })
    .filter((segment): segment is TimelineWaveformSegment => Boolean(segment))
);
const selectedSectionForRecording = computed(
  () => editorSections.value[selectedSectionIndex.value] ?? null
);
const selectedExportSection = computed(
  () => editorSections.value[selectedExportSectionIndex.value] ?? null
);
const exportAssets = computed<ExportAsset[]>(() => buildExportAssets());
const readyExportAssets = computed(() => exportAssets.value.filter((asset) => asset.ready));
const finalVideoExportAsset = computed(
  () => exportAssets.value.find((asset) => asset.kind === "final_video") ?? null
);
const subtitledVideoExportAsset = computed(
  () => exportAssets.value.find((asset) => asset.kind === "subtitled_video") ?? null
);
const silenceCutVideoExportAsset = computed(
  () => exportAssets.value.find((asset) => asset.kind === "silence_cut_video") ?? null
);
const subtitleSourceVideoExportAsset = computed(
  () => silenceCutVideoExportAsset.value ?? finalVideoExportAsset.value
);
const exportAssetCounts = computed(() => ({
  ready: readyExportAssets.value.length,
  total: exportAssets.value.length,
}));
const currentVoiceInfo = computed<TtsVoiceOption>(() => {
  const voiceName = store.selectedProject?.voiceName || "Puck";
  return (
    ttsVoiceOptions.find((voice) => voice.name === voiceName) ??
    ttsVoiceOptions.find((voice) => voice.name === "Puck") ??
    ttsVoiceOptions[0]!
  );
});

const sectionVideoSourceInfo = (
  section: VideoStudioSection
): { bucketName: string; filePath: string } | null => {
  const info = [section.splitVideoConverted, section.videoSegment, section.splitVideo].find(
    (candidate) => Boolean(candidate?.gcsFilePath)
  );
  const parsed = parseGcsPath(info?.gcsFilePath);
  const filePath = parsed?.filePath ?? "";
  if (!filePath) return null;
  return {
    bucketName: info?.bucketName || parsed?.bucketName || store.defaultBucket,
    filePath,
  };
};

const selectedVideoStorageSourceInfo = (): { bucketName: string; filePath: string } | null => {
  const video = store.selectedVideo;
  const rawPath = video?.convertedStoragePath || video?.originalStoragePath || video?.storagePath || "";
  const parsed = parseGcsPath(rawPath);
  const filePath = parsed?.filePath ?? "";
  if (!filePath) return null;
  return {
    bucketName:
      video?.convertedStorageBucket ||
      video?.originalStorageBucket ||
      video?.storageBucket ||
      parsed?.bucketName ||
      store.defaultBucket,
    filePath,
  };
};

const sectionAudioSourceInfo = (
  section: VideoStudioSection
): { bucketName: string; filePath: string } | null => {
  const info = section.audioSegment;
  const parsed = parseGcsPath(info?.gcsFilePath);
  const filePath = parsed?.filePath ?? "";
  if (!filePath) return null;
  return {
    bucketName: info?.bucketName || parsed?.bucketName || store.defaultBucket,
    filePath,
  };
};

const sectionTranscriptionSource = (
  section: VideoStudioSection
): SectionTranscriptionSource | null => {
  if (usesOriginalVideoAudio.value) {
    const audioSource = sectionAudioSourceInfo(section);
    if (audioSource) {
      return {
        kind: "source_video",
        mode: "audioFile",
        bucketName: audioSource.bucketName,
        filePath: audioSource.filePath,
        contentType: "audio/mp4",
        sourceId: `source-audio-${section.id}`,
        durationSeconds: sectionDurationSeconds(section),
        waveform: sectionRecordingWaveform(section),
      };
    }
    const videoSource = sectionVideoSourceInfo(section) ?? selectedVideoStorageSourceInfo();
    if (!videoSource) return null;
    return {
      kind: "source_video",
      mode: "videoFile",
      bucketName: videoSource.bucketName,
      filePath: videoSource.filePath,
      contentType: "video/mp4",
      sourceId: `source-video-${section.id}`,
      durationSeconds: sectionDurationSeconds(section),
      waveform: sectionRecordingWaveform(section),
    };
  }
  const recording = section.recording;
  if (!recording?.audioFilePath) return null;
  return {
    kind: "recording",
    mode: "audioFile",
    bucketName: recording.audioBucketName || store.defaultBucket,
    filePath: recording.audioFilePath,
    contentType: recording.audioContentType || "audio/webm",
    sourceId: recording.recordingId,
    durationSeconds: safeNonNegativeSeconds(recording.durationSeconds, sectionDurationSeconds(section)),
    waveform: recording.waveform,
  };
};

const sectionHasTranscriptionSource = (section: VideoStudioSection): boolean =>
  Boolean(sectionTranscriptionSource(section));

const isSectionTranscriptionInFlight = (section: VideoStudioSection): boolean => {
  const recording = section.recording;
  return (
    recording?.transcriptionStatus === "processing" ||
    (recording?.transcriptionStatus === "pending" &&
      Boolean(recording.transcriptionRequestId))
  );
};
const hasIncompleteRecordingTranscriptions = computed(
  () =>
    activeRequest.value === "transcription" ||
    editorSections.value.some(
      (section) =>
        sectionHasTranscriptionSource(section) &&
        section.recording?.transcriptionStatus !== "completed"
    )
);
const aiNarrationSubStep = computed<AiNarrationSubStep>(() =>
  hasIncompleteRecordingTranscriptions.value ? "transcription" : "adjustment"
);
const transcribableSectionsCount = computed(
  () => editorSections.value.filter((section) => sectionHasTranscriptionSource(section)).length
);
const completedTranscriptionSections = computed(
  () =>
    editorSections.value.filter(
      (section) =>
        sectionHasTranscriptionSource(section) &&
        section.recording?.transcriptionStatus === "completed"
    ).length
);
const transcriptionProgressItems = computed(() =>
  editorSections.value
    .map((section, index) => {
      const status = section.recording?.transcriptionStatus;
      const isCompleted = status === "completed";
      const isError = status === "error";
      const isProcessing = isSectionTranscriptionInFlight(section);
      return {
        section,
        index,
        isCompleted,
        isError,
        progress: isCompleted ? 100 : isError ? 100 : isProcessing ? 65 : 12,
      };
    })
    .filter((item) => sectionHasTranscriptionSource(item.section))
);
const selectedTimingTimelineWidth = computed(() => {
  const section = selectedSectionForRecording.value;
  const sectionDuration = section ? sectionDurationSeconds(section) : 0;
  return Math.max(900, timingTrackLabelWidth + sectionDuration * safeTimelineZoom.value);
});
const timingRelativeCurrentTime = computed(() => {
  const section = selectedSectionForRecording.value;
  if (!section) return 0;
  const sectionStart = sectionStartSeconds(section);
  const sectionDuration = sectionDurationSeconds(section);
  return Math.max(
    0,
    Math.min(sectionDuration, safeNonNegativeSeconds(currentTime.value) - sectionStart)
  );
});
const selectedTimingTicks = computed(() => {
  const section = selectedSectionForRecording.value;
  const sectionDuration = section ? sectionDurationSeconds(section) : 0;
  return buildBoundedTicks(sectionDuration, 10);
});
const selectedNarrationTimingSegments = computed(() => {
  const section = selectedSectionForRecording.value;
  if (!section) return [];
  return section.finalyNarrations
    .map((segment, index) => {
      const startSeconds = safeNonNegativeSeconds(segment.startSeconds, index * 0.1);
      const durationSeconds = narrationDurationSeconds(segment);
      return {
        key: segment.id || `${section.id}-${index}`,
        index,
        model: segment,
        startSeconds,
        durationSeconds,
        width: Math.max(48, durationSeconds * safeTimelineZoom.value),
        text: (segment.rewrittenText || segment.originalText || `AIナレーション${index + 1}`).trim(),
      };
    })
    .filter((segment) => segment.text);
});
const activeRecordingSection = computed(() => {
  const index = activeRecordingSectionIndex.value;
  return typeof index === "number" ? editorSections.value[index] ?? null : null;
});
const recordingRemaining = computed(() => {
  const section = activeRecordingSection.value ?? selectedSectionForRecording.value;
  if (!section) return 0;
  return Math.max(0, sectionDurationSeconds(section) - safeNonNegativeSeconds(recordingElapsed.value));
});
const formattedRecordingRemaining = computed(() =>
  formatDuration(recordingRemaining.value)
);
const mediaDevicesSupport = computed(() => {
  if (!import.meta.client) {
    return {
      supported: false,
      reason: "client only",
      protocol: "",
      hostname: "",
      isSecureContext: false,
    };
  }
  const supported = Boolean(navigator.mediaDevices?.getUserMedia) && typeof MediaRecorder !== "undefined";
  return {
    supported,
    reason: supported ? "" : "mediaDevices.getUserMedia or MediaRecorder is unavailable",
    protocol: window.location.protocol,
    hostname: window.location.hostname,
    isSecureContext: window.isSecureContext,
  };
});
const completedNarrationSections = computed(
  () => editorSections.value.filter((section) => section.finalyNarrations.length > 0).length
);
const completedTtsSections = computed(
  () => editorSections.value.filter((section) => sectionHasGeneratedAudio(section)).length
);
const pendingTtsSegmentsCount = computed(() =>
  editorSections.value.reduce(
    (total, section) =>
      total +
      section.finalyNarrations.filter((segment) => {
        const text = (segment.rewrittenText || segment.originalText || "").trim();
        return text && (!segment.isTtsGenerated || !ttsSegmentOutputPath(segment));
      }).length,
    0
  )
);
const fixedSectionsCount = computed(
  () => editorSections.value.filter((section) => section.isFixed).length
);
const allNarrationSectionsFixed = computed(
  () => editorSections.value.length > 0 && fixedSectionsCount.value === editorSections.value.length
);
const exportProgressPercent = computed(() => {
  const items = exportProgressItems.value;
  if (items.length === 0) return activeRequest.value === "export" ? 5 : store.selectedProjectOutputUrl ? 100 : 0;
  const completedWeight = items.reduce((total, item) => {
    if (item.status === "completed" || item.status === "skipped") return total + 1;
    if (item.status === "running") return total + 0.45;
    return total;
  }, 0);
  return Math.min(100, Math.max(0, Math.round((completedWeight / items.length) * 100)));
});
const selectedSubtitlePreset = computed<SubtitleStyleOption>(() => {
  const key = store.selectedProject?.subtitleSettings?.preset as SubtitlePresetKey | undefined;
  return subtitleStyleOptions.find((option) => option.key === key) ?? subtitleStyleOptions[0]!;
});
const selectedSubtitleSize = computed<SubtitleSizeOption>(() => {
  const key = store.selectedProject?.subtitleSettings?.size as SubtitleSizeKey | undefined;
  return subtitleSizeOptions.find((option) => option.key === key) ?? subtitleSizeOptions[1]!;
});
const selectedSubtitleFontScale = computed(() =>
  Number((selectedSubtitlePreset.value.style.fontScale * selectedSubtitleSize.value.multiplier).toFixed(2))
);
const subtitleOutput = computed(() => store.selectedProject?.subtitleOutput ?? null);
const silenceCutOutput = computed(() => store.selectedProject?.silenceCutOutput ?? null);
const silenceCutSettings = computed(() => ({
  enabled: Boolean(store.selectedProject?.silenceCutSettings?.enabled),
  preset: "natural" as const,
  thresholdDb: Number(store.selectedProject?.silenceCutSettings?.thresholdDb ?? -38),
  minSilenceMs: Number(store.selectedProject?.silenceCutSettings?.minSilenceMs ?? 700),
  keepPaddingMs: Number(store.selectedProject?.silenceCutSettings?.keepPaddingMs ?? 180),
  minSegmentMs: Number(store.selectedProject?.silenceCutSettings?.minSegmentMs ?? 450),
  skipped: Boolean(store.selectedProject?.silenceCutSettings?.skipped),
}));
const subtitleSettings = computed(() => ({
  enabled: store.selectedProject?.subtitleSettings?.enabled !== false,
  preset: (store.selectedProject?.subtitleSettings?.preset ?? "clear_standard") as SubtitlePresetKey,
  size: (store.selectedProject?.subtitleSettings?.size ?? "medium") as SubtitleSizeKey,
  position: store.selectedProject?.subtitleSettings?.position ?? "bottom",
  fontScale: Number(store.selectedProject?.subtitleSettings?.fontScale ?? 1),
  skipped: Boolean(store.selectedProject?.subtitleSettings?.skipped),
}));
const isSilenceCutEnabled = computed(() => silenceCutSettings.value.enabled);
const isSubtitleGenerationEnabled = computed(() => subtitleSettings.value.enabled);
const silenceCutStatistics = computed<Record<string, unknown> | null>(() => {
  const statistics = silenceCutOutput.value?.statistics;
  return isRecord(statistics) ? statistics : null;
});
const silenceCutCutCount = computed(() => {
  const value = Number(silenceCutStatistics.value?.cutCount ?? 0);
  return Number.isFinite(value) ? value : 0;
});
const silenceCutRemovedSeconds = computed(() => {
  const value = Number(silenceCutStatistics.value?.removedDurationSeconds ?? 0);
  return Number.isFinite(value) ? value : 0;
});
const subtitleSourceLabel = computed(() => {
  if (silenceCutVideoExportAsset.value?.ready) return "無音カット版動画";
  if (finalVideoExportAsset.value?.ready) return "字幕なし最終動画";
  return "最終動画の書き出し待ち";
});
const videoAdjustmentPreviewUrl = computed(() => {
  if (store.selectedProjectSubtitleOutputUrl) return store.selectedProjectSubtitleOutputUrl;
  if (store.selectedProjectSilenceCutOutputUrl) return store.selectedProjectSilenceCutOutputUrl;
  return store.selectedProjectOutputUrl;
});
const videoAdjustmentPreviewLabel = computed(() => {
  if (store.selectedProjectSubtitleOutputUrl) return "字幕付き動画";
  if (store.selectedProjectSilenceCutOutputUrl) return "無音カット版動画";
  if (store.selectedProjectOutputUrl) return "字幕なし最終動画";
  return "プレビュー待ち";
});
const videoAdjustmentDownloadAssets = computed(() =>
  exportAssets.value.filter((asset) =>
    [
      "final_video",
      "silence_cut_video",
      "silence_cut_manifest",
      "subtitled_video",
      "subtitle_srt",
      "subtitle_ass",
    ].includes(asset.kind)
  )
);
const videoAdjustmentReadyDownloadAssets = computed(() =>
  videoAdjustmentDownloadAssets.value.filter((asset) => asset.ready)
);
const subtitleCaptionSegments = computed<SubtitleSegmentInput[]>(() => buildSubtitleCaptionSegments());
const videoAdjustmentCanRun = computed(() => {
  if (!finalVideoExportAsset.value?.ready) return false;
  if (activeRequest.value) return false;
  if (!isSilenceCutEnabled.value && !isSubtitleGenerationEnabled.value) return true;
  if (isSubtitleGenerationEnabled.value && subtitleCaptionSegments.value.length === 0) return false;
  return true;
});
const videoAdjustmentRunDisabledReason = computed(() => {
  if (!finalVideoExportAsset.value?.ready) return "最終動画の書き出し完了後に実行できます。";
  if (activeRequest.value) return "処理中です。完了まで設定変更はできません。";
  if (isSubtitleGenerationEnabled.value && subtitleCaptionSegments.value.length === 0) {
    return "字幕に使えるAIナレーション本文がありません。字幕をOFFにするか、AIナレーションを確認してください。";
  }
  return "";
});
const subtitleProgressPercent = computed(() => {
  const items = subtitleProgressItems.value;
  if (items.length === 0) {
    if (activeRequest.value === "subtitle") return 8;
    return subtitledVideoExportAsset.value?.ready ? 100 : 0;
  }
  const completedWeight = items.reduce((total, item) => {
    if (item.status === "completed" || item.status === "skipped") return total + 1;
    if (item.status === "running") return total + 0.45;
    return total;
  }, 0);
  return Math.min(100, Math.max(0, Math.round((completedWeight / items.length) * 100)));
});
const silenceCutProgressPercent = computed(() => {
  const items = silenceCutProgressItems.value;
  if (items.length === 0) {
    if (activeRequest.value === "silenceCut") return 8;
    return silenceCutVideoExportAsset.value?.ready ? 100 : 0;
  }
  const completedWeight = items.reduce((total, item) => {
    if (item.status === "completed" || item.status === "skipped") return total + 1;
    if (item.status === "running") return total + 0.45;
    return total;
  }, 0);
  return Math.min(100, Math.max(0, Math.round((completedWeight / items.length) * 100)));
});
const selectedSectionFixHelp = computed(() => {
  const section = selectedSectionForRecording.value;
  return section ? sectionFixBlockingReason(section) : "";
});
const debugPanelTitle = computed(() => {
  switch (activeWorkflowStep.value) {
    case "recording":
      return "録音デバッグ";
    case "voice_generation":
      return "AIナレーションデバッグ";
    case "export":
      return "出力確認デバッグ";
    case "subtitle":
      return "動画調整デバッグ";
    default:
      return "セクション分割デバッグ";
  }
});

watch(
  () => store.view,
  (view) => {
    if (!import.meta.client) return;
    if (view === "editor") {
      if (bodyOverflowBeforeEditor === null) {
        bodyOverflowBeforeEditor = document.body.style.overflow;
      }
      if (focusModeBeforeEditor === null) {
        focusModeBeforeEditor = contextStore.focusModeIsActive;
      }
      contextStore.focusModeIsActive = true;
      contextStore.setVideoEditorActive(true);
      document.body.style.overflow = "hidden";
      return;
    }

    if (bodyOverflowBeforeEditor !== null) {
      document.body.style.overflow = bodyOverflowBeforeEditor;
      bodyOverflowBeforeEditor = null;
    }
    if (focusModeBeforeEditor !== null) {
      contextStore.focusModeIsActive = focusModeBeforeEditor;
      focusModeBeforeEditor = null;
    }
    contextStore.setVideoEditorActive(false);
  },
  { immediate: true }
);

watch(
  () => ({
    step: activeWorkflowStep.value,
    projectId: store.selectedProject?.id ?? "",
    hasSubtitleOutput: Boolean(subtitledVideoExportAsset.value?.ready),
    hasSilenceCutOutput: Boolean(silenceCutVideoExportAsset.value?.ready),
    hasFinalOutput: Boolean(finalVideoExportAsset.value?.ready),
  }),
  (state, previous) => {
    if (activeRequest.value || state.step !== "subtitle") return;
    if (state.projectId !== previous?.projectId) {
      videoAdjustmentSubStep.value = state.hasSubtitleOutput || state.hasSilenceCutOutput ? "download" : "silence_settings";
      return;
    }
    if (!state.hasFinalOutput) {
      videoAdjustmentSubStep.value = "silence_settings";
      return;
    }
    if (
      (state.hasSubtitleOutput && !previous?.hasSubtitleOutput) ||
      (state.hasSilenceCutOutput && !previous?.hasSilenceCutOutput)
    ) {
      videoAdjustmentSubStep.value = "download";
    }
  },
  { immediate: true }
);

watch(
  () => [aiNarrationMode.value, selectedSectionIndex.value, isAiNarrationStep.value] as const,
  ([mode, _sectionIndex, isNarrationStep]) => {
    if (mode !== "timing" || !isNarrationStep) {
      pauseTimingNarrationAudio();
      selectedTimingSegmentIndex.value = null;
      return;
    }
    seekTimingTo(timingRelativeCurrentTime.value);
  }
);

const autoSectionStatusClass = computed(() => {
  switch (autoSectionStatusText.value) {
    case "完了":
      return "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200";
    case "エラー":
      return "bg-red-50 text-red-700 ring-1 ring-inset ring-red-200";
    case "処理中":
      return "bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-200";
    default:
      return "bg-slate-100 text-slate-600 ring-1 ring-inset ring-slate-200";
  }
});
const autoSectionPreviewSections = computed<VideoStudioSection[]>(() =>
  (autoSectionPreviewOutput.value?.sections ?? []).map((raw, index) =>
    normalizeAutoSection(raw, index)
  )
);
const selectedAutoSectionPreview = computed(
  () => autoSectionPreviewSections.value[autoSectionPreviewIndex.value] ?? null
);

const isWorkflowStepCompleted = (step: WorkflowStepKey): boolean => {
  if (step === "voice_generation" && allNarrationSectionsFixed.value) return true;
  if (step === "subtitle" && subtitleOutput.value) return true;
  return Boolean(store.selectedProject?.completedSteps?.includes(step));
};

const workflowStepClass = (step: WorkflowStepKey, index: number): string => {
  if (isWorkflowStepCompleted(step)) {
    return "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200";
  }
  if (currentWorkflowIndex.value === index) {
    return "bg-white text-gray-900 shadow-sm ring-1 ring-inset ring-indigo-200";
  }
  return "text-gray-500 hover:bg-white/70";
};

const workflowStepBadgeClass = (step: WorkflowStepKey, index: number): string => {
  if (isWorkflowStepCompleted(step)) {
    return "bg-emerald-500 text-white ring-emerald-200";
  }
  if (currentWorkflowIndex.value >= index) {
    return "bg-indigo-500 text-white ring-indigo-200";
  }
  return "bg-gray-100 text-gray-500 ring-gray-200";
};

const timelineThumbnail = (
  sectionId: string,
  edge: TimelineThumbnailEdge
): TimelineThumbnail | null =>
  timelineThumbnails.value[sectionId]?.[edge] ?? null;

const videoStudioVerboseDebugEnabled = (): boolean => {
  if (!import.meta.client) return false;
  return window.localStorage.getItem("videoStudioVerboseDebug") === "true";
};

const thumbnailDebugLog = (
  stage: string,
  payload: Record<string, unknown> = {},
  level: "info" | "warn" | "error" = "info"
): void => {
  if (!import.meta.client) return;
  if (level === "info" && !videoStudioVerboseDebugEnabled()) return;
  const payloadWithContext = {
    projectId: store.selectedProject?.id,
    videoId: store.selectedProject?.videoId ?? store.selectedVideo?.id,
    view: store.view,
    videoAudioType: selectedProjectAudioType.value,
    selectedVideoUrlReady: Boolean(store.selectedVideoUrl),
    ...payload,
  };
  if (level === "error") {
    appLog("ERROR", `[VideoStudio][thumbnail] ${stage}`, payloadWithContext);
    reportDatadogError(new Error(`video_studio.thumbnail.${stage}`), {
      feature: "video_studio",
      debugArea: "thumbnail",
      ...payloadWithContext,
    });
    return;
  }
  appLog(level === "warn" ? "WARN" : "INFO", `[VideoStudio][thumbnail] ${stage}`, payloadWithContext);
  reportDatadogInfo(`video_studio.thumbnail.${stage}`, {
    feature: "video_studio",
    debugArea: "thumbnail",
    ...payloadWithContext,
  });
};

const workflowDebugLog = (
  stage: string,
  payload: Record<string, unknown> = {},
  level: "info" | "warn" | "error" = "info"
): void => {
  if (!import.meta.client) return;
  if (level === "info" && !videoStudioVerboseDebugEnabled()) return;
  const payloadWithContext = {
    projectId: store.selectedProject?.id,
    videoId: store.selectedProject?.videoId ?? store.selectedVideo?.id,
    view: store.view,
    currentStep: store.selectedProject?.currentStep ?? "",
    activeWorkflowStep: activeWorkflowStep.value,
    activeWorkflowStepKeys: activeWorkflowStepKeys.value,
    videoAudioType: selectedProjectAudioType.value,
    usesOriginalVideoAudio: usesOriginalVideoAudio.value,
    activeRequest: activeRequest.value ?? "",
    ...payload,
  };
  if (level === "error") {
    appLog("ERROR", `[VideoStudio][workflow] ${stage}`, payloadWithContext);
    reportDatadogError(new Error(`video_studio.workflow.${stage}`), {
      feature: "video_studio",
      debugArea: "workflow",
      ...payloadWithContext,
    });
    return;
  }
  appLog(level === "warn" ? "WARN" : "INFO", `[VideoStudio][workflow] ${stage}`, payloadWithContext);
  reportDatadogInfo(`video_studio.workflow.${stage}`, {
    feature: "video_studio",
    debugArea: "workflow",
    ...payloadWithContext,
  });
};

const handleTimelineThumbnailVideoReady = (
  event: Event,
  thumbnail: TimelineThumbnail | null,
  phase: "loadedmetadata" | "loadeddata" | "canplay"
): void => {
  if (!thumbnail || thumbnail.kind !== "video" || typeof thumbnail.time !== "number") return;
  const video = event.currentTarget;
  if (!(video instanceof HTMLVideoElement)) return;
  const safeTime = Math.min(
    Math.max(0, thumbnail.time),
    Number.isFinite(video.duration) ? Math.max(0, video.duration - 0.05) : thumbnail.time
  );
  try {
    video.currentTime = safeTime;
    thumbnailDebugLog("fallback_video:ready", {
      phase,
      requestedTime: thumbnail.time,
      safeTime,
      duration: video.duration,
      readyState: video.readyState,
      networkState: video.networkState,
      videoWidth: video.videoWidth,
      videoHeight: video.videoHeight,
      currentSrcReady: Boolean(video.currentSrc),
    });
  } catch (error) {
    thumbnailDebugLog("fallback_video:seek_error", {
      phase,
      requestedTime: thumbnail.time,
      safeTime,
      duration: video.duration,
      readyState: video.readyState,
      networkState: video.networkState,
      error: error instanceof Error ? error.message : String(error),
    }, "warn");
    // Browser-managed video fallback; ignore seek errors and keep the placeholder frame.
  }
};

const handleTimelineThumbnailVideoError = (
  event: Event,
  sectionId: string,
  edge: TimelineThumbnailEdge
): void => {
  const video = event.currentTarget;
  if (!(video instanceof HTMLVideoElement)) return;
  thumbnailDebugLog("fallback_video:error", {
    sectionId,
    edge,
    mediaErrorCode: video.error?.code ?? null,
    mediaErrorMessage: video.error?.message ?? "",
    networkState: video.networkState,
    readyState: video.readyState,
    currentSrcReady: Boolean(video.currentSrc),
  }, "error");
};

const exportProgressIcon = (status: ExportProgressStatus): string => {
  switch (status) {
    case "running":
      return "i-heroicons-arrow-path";
    case "completed":
      return "i-heroicons-check-circle-solid";
    case "error":
      return "i-heroicons-exclamation-triangle-solid";
    case "skipped":
      return "i-heroicons-forward-solid";
    default:
      return "i-heroicons-clock";
  }
};

const exportProgressStatusLabel = (status: ExportProgressStatus): string => {
  switch (status) {
    case "running":
      return "処理中";
    case "completed":
      return "完了";
    case "error":
      return "エラー";
    case "skipped":
      return "元動画";
    default:
      return "待機";
  }
};

const exportReviewTabLabel = (tab: ExportReviewTab): string => {
  switch (tab) {
    case "overview":
      return "概要";
    case "sections":
      return "セクション確認";
    case "assets":
      return "素材ダウンロード";
    default:
      return "概要";
  }
};

const exportReviewTabIcon = (tab: ExportReviewTab): string => {
  switch (tab) {
    case "overview":
      return "i-heroicons-chart-bar";
    case "sections":
      return "i-heroicons-rectangle-stack";
    case "assets":
      return "i-heroicons-arrow-down-tray";
    default:
      return "i-heroicons-chart-bar";
  }
};

const exportReviewTabClass = (tab: ExportReviewTab): string =>
  exportReviewTab.value === tab
    ? "bg-white text-indigo-700 shadow-sm ring-1 ring-inset ring-indigo-100"
    : "text-gray-500 hover:bg-white/80 hover:text-gray-800";

const exportProgressItemClass = (status: ExportProgressStatus): string => {
  switch (status) {
    case "running":
      return "border-indigo-200 bg-indigo-50 text-indigo-700";
    case "completed":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "error":
      return "border-red-200 bg-red-50 text-red-700";
    case "skipped":
      return "border-gray-200 bg-gray-50 text-gray-500";
    default:
      return "border-gray-200 bg-white text-gray-500";
  }
};

function extensionFromPath(filePath: string, fallback = "bin"): string {
  const cleanPath = filePath.split("?")[0] ?? "";
  const match = cleanPath.match(/\.([a-zA-Z0-9]+)$/);
  return match?.[1]?.toLowerCase() || fallback;
}

function sanitizeDownloadName(value: string): string {
  return value
    .trim()
    .replace(/[\\/:*?"<>|]+/g, "-")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80) || "asset";
}

const uniqueZipPath = (path: string, usedPaths: Set<string>): string => {
  if (!usedPaths.has(path)) {
    usedPaths.add(path);
    return path;
  }
  const extensionMatch = path.match(/(\.[^./]+)$/);
  const extension = extensionMatch?.[1] ?? "";
  const basePath = extension ? path.slice(0, -extension.length) : path;
  let counter = 2;
  let nextPath = `${basePath}-${counter}${extension}`;
  while (usedPaths.has(nextPath)) {
    counter += 1;
    nextPath = `${basePath}-${counter}${extension}`;
  }
  usedPaths.add(nextPath);
  return nextPath;
};

const assetKindLabel = (kind: ExportAssetKind): string => {
  switch (kind) {
    case "final_video":
      return "最終動画";
    case "silence_cut_video":
      return "無音カット動画";
    case "silence_cut_manifest":
      return "無音カットJSON";
    case "subtitled_video":
      return "字幕付き動画";
    case "subtitle_srt":
      return "SRT";
    case "subtitle_ass":
      return "ASS";
    case "section_video":
      return "セクション動画";
    case "ai_audio":
      return "AI音声";
    case "recording_audio":
      return "録音音声";
    default:
      return "素材";
  }
};

const assetKindIcon = (kind: ExportAssetKind): string => {
  switch (kind) {
    case "final_video":
    case "silence_cut_video":
    case "subtitled_video":
      return "i-heroicons-film-solid";
    case "silence_cut_manifest":
      return "i-heroicons-code-bracket-square";
    case "subtitle_srt":
    case "subtitle_ass":
      return "i-heroicons-document-text";
    case "section_video":
      return "i-heroicons-video-camera-solid";
    case "ai_audio":
      return "i-heroicons-speaker-wave";
    case "recording_audio":
      return "i-heroicons-microphone";
    default:
      return "i-heroicons-document-arrow-down";
  }
};

const exportAssetZipFolder = (kind: ExportAssetKind): string => {
  switch (kind) {
    case "final_video":
      return "01-final-video";
    case "silence_cut_video":
      return "02-silence-cut-video";
    case "subtitled_video":
      return "03-subtitled-final-video";
    case "section_video":
      return "04-section-videos";
    case "recording_audio":
      return "05-recording-audio";
    case "ai_audio":
      return "06-ai-narration-audio";
    case "silence_cut_manifest":
      return "07-silence-cut-manifest";
    case "subtitle_srt":
    case "subtitle_ass":
      return "08-subtitles";
    default:
      return "assets";
  }
};

function buildExportAsset(params: Omit<ExportAsset, "ready">): ExportAsset {
  return {
    ...params,
    ready: Boolean(params.bucketName && params.filePath),
  };
}

function buildExportAssets(finalPathOverride?: StorageOutputPath | null): ExportAsset[] {
  const project = store.selectedProject;
  const projectOutput = project?.mergedVideoOutput;
  const finalPath = finalPathOverride ?? (isRecord(projectOutput)
    ? extractStorageOutputPath(projectOutput, { preferredNestedKey: "mergedVideoPath" })
    : null);
  const assets: ExportAsset[] = [];

  if (finalPath) {
    assets.push(
      buildExportAsset({
        key: "final-video",
        kind: "final_video",
        label: "最終動画",
        description: "全セクションとAI音声を結合した完成版です。",
        bucketName: finalPath.bucketName,
        filePath: finalPath.filePath,
        fileName: `final-video.${extensionFromPath(finalPath.filePath, "mp4")}`,
      })
    );
  }

  const silenceCutOutputRecord = isRecord(project?.silenceCutOutput) ? project.silenceCutOutput : null;
  if (silenceCutOutputRecord) {
    const trimmedVideoPath = extractStorageOutputPath(silenceCutOutputRecord, {
      preferredNestedKey: "trimmedVideo",
    });
    const manifestPath = extractStorageOutputPath(silenceCutOutputRecord, {
      preferredNestedKey: "manifest",
    });
    if (trimmedVideoPath) {
      assets.push(
        buildExportAsset({
          key: "silence-cut-video",
          kind: "silence_cut_video",
          label: "無音カット版動画",
          description: "無音区間を自然に詰めた動画です。",
          bucketName: trimmedVideoPath.bucketName,
          filePath: trimmedVideoPath.filePath,
          fileName: `final-video-silence-cut.${extensionFromPath(trimmedVideoPath.filePath, "mp4")}`,
        })
      );
    }
    if (manifestPath) {
      assets.push(
        buildExportAsset({
          key: "silence-cut-manifest",
          kind: "silence_cut_manifest",
          label: "無音カット manifest",
          description: "カット区間、保持区間、タイムライン変換を含むJSONです。",
          bucketName: manifestPath.bucketName,
          filePath: manifestPath.filePath,
          fileName: `silence-cut-manifest.${extensionFromPath(manifestPath.filePath, "json")}`,
        })
      );
    }
  }

  const subtitleOutputRecord = isRecord(project?.subtitleOutput) ? project.subtitleOutput : null;
  if (subtitleOutputRecord) {
    const subtitledVideoPath = extractStorageOutputPath(subtitleOutputRecord, {
      preferredNestedKey: "subtitledVideo",
    });
    const srtPath = extractStorageOutputPath(subtitleOutputRecord, {
      preferredNestedKey: "srt",
    });
    const assPath = extractStorageOutputPath(subtitleOutputRecord, {
      preferredNestedKey: "ass",
    });
    if (subtitledVideoPath) {
      assets.push(
        buildExportAsset({
          key: "subtitled-final-video",
          kind: "subtitled_video",
          label: "字幕付き最終動画",
          description: "選択した字幕スタイルを焼き込んだ完成版です。",
          bucketName: subtitledVideoPath.bucketName,
          filePath: subtitledVideoPath.filePath,
          fileName: `final-video-with-subtitles.${extensionFromPath(subtitledVideoPath.filePath, "mp4")}`,
        })
      );
    }
    if (srtPath) {
      assets.push(
        buildExportAsset({
          key: "subtitle-srt",
          kind: "subtitle_srt",
          label: "字幕ファイル SRT",
          description: "一般的な動画編集ソフトで読み込める字幕ファイルです。",
          bucketName: srtPath.bucketName,
          filePath: srtPath.filePath,
          fileName: `captions.${extensionFromPath(srtPath.filePath, "srt")}`,
        })
      );
    }
    if (assPath) {
      assets.push(
        buildExportAsset({
          key: "subtitle-ass",
          kind: "subtitle_ass",
          label: "字幕スタイル ASS",
          description: "字幕スタイルとタイミングを含む編集用ファイルです。",
          bucketName: assPath.bucketName,
          filePath: assPath.filePath,
          fileName: `captions.${extensionFromPath(assPath.filePath, "ass")}`,
        })
      );
    }
  }

  for (const [sectionIndex, section] of editorSections.value.entries()) {
    const sectionPath = section.mergedVideoOutput
      ? extractStorageOutputPath(section.mergedVideoOutput)
      : null;
    if (sectionPath) {
      const sectionName = sanitizeDownloadName(section.title || `section-${sectionIndex + 1}`);
      assets.push(
        buildExportAsset({
          key: `section-video-${section.id}`,
          kind: "section_video",
          label: `${section.title || `セクション ${sectionIndex + 1}`} / 音声付き動画`,
          description: `${formatDuration(section.startTime)} - ${formatDuration(section.endTime)} の動画パーツです。`,
          bucketName: sectionPath.bucketName,
          filePath: sectionPath.filePath,
          fileName: `section-${String(sectionIndex + 1).padStart(2, "0")}-${sectionName}-with-audio.${extensionFromPath(sectionPath.filePath, "mp4")}`,
          sectionIndex,
        })
      );
    }

    if (section.recording?.audioBucketName && section.recording.audioFilePath) {
      assets.push(
        buildExportAsset({
          key: `recording-audio-${section.id}`,
          kind: "recording_audio",
          label: `${section.title || `セクション ${sectionIndex + 1}`} / 録音音声`,
          description: "録音ステップで収録した肉声音声です。",
          bucketName: section.recording.audioBucketName,
          filePath: section.recording.audioFilePath,
          fileName: `section-${String(sectionIndex + 1).padStart(2, "0")}-recording.${extensionFromPath(section.recording.audioFilePath, "webm")}`,
          sectionIndex,
        })
      );
    }

    for (const [segmentIndex, segment] of section.finalyNarrations.entries()) {
      const outputPath = ttsSegmentOutputPath(segment);
      const parsed = parseGcsPath(outputPath);
      if (!segment.isTtsGenerated || !parsed) continue;
      assets.push(
        buildExportAsset({
          key: `ai-audio-${section.id}-${segmentIndex}`,
          kind: "ai_audio",
          label: `${section.title || `セクション ${sectionIndex + 1}`} / AI音声 ${segmentIndex + 1}`,
          description: `${formatDuration(Number(segment.startSeconds ?? 0))} 開始のナレーション音声です。`,
          bucketName: parsed.bucketName,
          filePath: parsed.filePath,
          fileName: `section-${String(sectionIndex + 1).padStart(2, "0")}-ai-narration-${String(segmentIndex + 1).padStart(2, "0")}.${extensionFromPath(parsed.filePath, "mp3")}`,
          sectionIndex,
          segmentIndex,
        })
      );
    }
  }

  return assets;
}

const downloadExportAsset = async (asset: ExportAsset): Promise<void> => {
  if (!asset.ready || downloadingAssetKey.value || isBulkDownloadingAssets.value) return;
  downloadingAssetKey.value = asset.key;
  try {
    const url = await getDownloadURL(
      storageRef(getStorage(), `gs://${asset.bucketName}/${asset.filePath}`)
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = asset.fileName;
    link.target = "_blank";
    link.rel = "noopener";
    document.body.appendChild(link);
    link.click();
    link.remove();
    toast.add({
      title: "ダウンロードを開始しました",
      description: asset.label,
      color: "success",
    });
  } catch (error) {
    reportDatadogError(error, {
      feature: "video_studio",
      operation: "download_export_asset",
      assetKey: asset.key,
      assetKind: asset.kind,
    });
    toast.add({
      title: "ダウンロードに失敗しました",
      description: asset.label,
      color: "error",
    });
  } finally {
    downloadingAssetKey.value = null;
  }
};

const downloadAllExportAssetsAsZip = async (): Promise<void> => {
  const assets = readyExportAssets.value;
  if (assets.length === 0 || isBulkDownloadingAssets.value || downloadingAssetKey.value) return;

  isBulkDownloadingAssets.value = true;
  bulkDownloadMessage.value = `ZIPを準備中です... 0/${assets.length}`;

  try {
    const { default: JSZip } = await import("jszip");
    const zip = new JSZip();
    const usedPaths = new Set<string>();
    const maxDownloadSizeBytes = 1024 * 1024 * 1024;
    const manifestAssets: Array<Record<string, unknown>> = [];

    for (const [index, asset] of assets.entries()) {
      bulkDownloadMessage.value = `素材を取得中です... ${index + 1}/${assets.length}`;
      const bytes = await getBytes(
        storageRef(getStorage(), `gs://${asset.bucketName}/${asset.filePath}`),
        maxDownloadSizeBytes
      );
      const zipPath = uniqueZipPath(
        `${exportAssetZipFolder(asset.kind)}/${asset.fileName}`,
        usedPaths
      );
      zip.file(zipPath, bytes);
      manifestAssets.push({
        key: asset.key,
        kind: asset.kind,
        label: asset.label,
        description: asset.description,
        zipPath,
        bucketName: asset.bucketName,
        filePath: asset.filePath,
        sectionIndex: asset.sectionIndex,
        segmentIndex: asset.segmentIndex,
      });
    }

    zip.file(
      "manifest.json",
      JSON.stringify(
        removeUndefinedFields({
          exportedAt: new Date().toISOString(),
          assetCount: assets.length,
          assets: manifestAssets.map((asset) => removeUndefinedFields(asset)),
        }),
        null,
        2
      )
    );

    bulkDownloadMessage.value = "ZIPを生成中です...";
    const zipBlob = await zip.generateAsync(
      { type: "blob", compression: "DEFLATE", compressionOptions: { level: 6 } },
      (metadata) => {
        bulkDownloadMessage.value = `ZIPを生成中です... ${Math.floor(metadata.percent)}%`;
      }
    );

    const objectUrl = URL.createObjectURL(zipBlob);
    const link = document.createElement("a");
    link.href = objectUrl;
    link.download = `en-aistudio-export-${new Date().toISOString().replace(/[:.]/g, "-")}.zip`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 30000);

    toast.add({
      title: "ZIPのダウンロードを開始しました",
      description: `${assets.length}件の素材をまとめました。`,
      color: "success",
    });
    bulkDownloadMessage.value = "";
  } catch (error) {
    reportDatadogError(error, {
      feature: "video_studio",
      operation: "download_export_assets_zip",
      assetCount: assets.length,
    });
    toast.add({
      title: "ZIPの作成に失敗しました",
      description: "素材の取得に失敗した可能性があります。個別保存も確認してください。",
      color: "error",
    });
    bulkDownloadMessage.value = "";
  } finally {
    isBulkDownloadingAssets.value = false;
  }
};

const setExportProgressItemStatus = (
  key: string,
  status: ExportProgressStatus
): void => {
  exportProgressItems.value = exportProgressItems.value.map((item) =>
    item.key === key ? { ...item, status } : item
  );
};

const resetExportProgress = (): void => {
  exportProgressItems.value = [
    ...editorSections.value.map((section, index) => ({
      key: `section-${index}`,
      label: section.title || `セクション ${index + 1}`,
      status: "pending" as const,
    })),
    {
      key: "final",
      label: "最終動画を連結",
      status: "pending" as const,
    },
  ];
  exportProgress.message = "書き出し準備中です。";
};

const setSubtitleProgressItemStatus = (
  key: string,
  status: ExportProgressStatus
): void => {
  subtitleProgressItems.value = subtitleProgressItems.value.map((item) =>
    item.key === key ? { ...item, status } : item
  );
};

const resetSubtitleProgress = (): void => {
  subtitleProgressItems.value = [
    { key: "data", label: "字幕データ生成", status: "pending" },
    { key: "burn", label: "字幕焼き込み", status: "pending" },
    { key: "upload", label: "アップロード", status: "pending" },
  ];
  subtitleProgress.message = "字幕生成準備中です。";
};

const setSilenceCutProgressItemStatus = (
  key: string,
  status: ExportProgressStatus
): void => {
  silenceCutProgressItems.value = silenceCutProgressItems.value.map((item) =>
    item.key === key ? { ...item, status } : item
  );
};

const resetSilenceCutProgress = (): void => {
  silenceCutProgressItems.value = [
    { key: "detect", label: "無音検出", status: "pending" },
    { key: "render", label: "動画再構成", status: "pending" },
    { key: "upload", label: "アップロード", status: "pending" },
  ];
  silenceCutProgress.message = "無音カット準備中です。";
};

const selectSubtitlePreset = async (preset: SubtitlePresetKey): Promise<void> => {
  const project = store.selectedProject;
  if (!project) return;
  const option = subtitleStyleOptions.find((item) => item.key === preset) ?? subtitleStyleOptions[0]!;
  const size = selectedSubtitleSize.value;
  await store.updateProject(project.videoId, project.id, {
    subtitleSettings: {
      ...(project.subtitleSettings ?? {}),
      enabled: true,
      preset: option.key,
      size: size.key,
      position: option.style.position,
      fontScale: Number((option.style.fontScale * size.multiplier).toFixed(2)),
      skipped: false,
    },
  });
};

const selectSubtitleSize = async (sizeKey: SubtitleSizeKey): Promise<void> => {
  const project = store.selectedProject;
  if (!project) return;
  const size = subtitleSizeOptions.find((item) => item.key === sizeKey) ?? subtitleSizeOptions[1]!;
  const preset = selectedSubtitlePreset.value;
  await store.updateProject(project.videoId, project.id, {
    subtitleSettings: {
      ...(project.subtitleSettings ?? {}),
      enabled: true,
      preset: preset.key,
      size: size.key,
      position: preset.style.position,
      fontScale: Number((preset.style.fontScale * size.multiplier).toFixed(2)),
      skipped: false,
    },
  });
};

const setVideoAdjustmentSubStep = (step: VideoAdjustmentSubStep): void => {
  if (activeRequest.value) return;
  if (step !== "silence_settings" && !finalVideoExportAsset.value?.ready) return;
  videoAdjustmentSubStep.value = step;
};

const updateSilenceCutSettings = async (
  updates: Partial<{
    enabled: boolean;
    thresholdDb: number;
    minSilenceMs: number;
    keepPaddingMs: number;
    minSegmentMs: number;
    skipped: boolean;
  }>
): Promise<void> => {
  const project = store.selectedProject;
  if (!project || activeRequest.value) return;
  await store.updateProject(project.videoId, project.id, {
    silenceCutSettings: {
      ...(project.silenceCutSettings ?? {}),
      preset: "natural",
      thresholdDb: silenceCutSettings.value.thresholdDb,
      minSilenceMs: silenceCutSettings.value.minSilenceMs,
      keepPaddingMs: silenceCutSettings.value.keepPaddingMs,
      minSegmentMs: silenceCutSettings.value.minSegmentMs,
      skipped: false,
      ...updates,
    },
  });
};

const updateSilenceCutEnabled = async (enabled: boolean): Promise<void> => {
  await updateSilenceCutSettings({
    enabled,
    skipped: !enabled,
  });
};

const updateSilenceCutNumberSetting = async (
  key: SilenceCutSettingKey,
  event: Event
): Promise<void> => {
  const input = event.target as HTMLInputElement | null;
  const rawValue = Number(input?.value);
  if (!Number.isFinite(rawValue)) return;
  const control = silenceCutSettingControls.find((item) => item.key === key);
  const min = control?.min ?? rawValue;
  const max = control?.max ?? rawValue;
  const value = Math.min(max, Math.max(min, rawValue));
  await updateSilenceCutSettings({
    enabled: true,
    skipped: false,
    [key]: value,
  });
};

const updateSubtitleEnabled = async (enabled: boolean): Promise<void> => {
  const project = store.selectedProject;
  if (!project || activeRequest.value) return;
  const preset = selectedSubtitlePreset.value;
  const size = selectedSubtitleSize.value;
  await store.updateProject(project.videoId, project.id, {
    subtitleSettings: {
      ...(project.subtitleSettings ?? {}),
      enabled,
      preset: preset.key,
      size: size.key,
      position: preset.style.position,
      fontScale: selectedSubtitleFontScale.value,
      skipped: !enabled,
    },
  });
};

const moveToSubtitleSettings = async (): Promise<void> => {
  if (!isSilenceCutEnabled.value) await updateSilenceCutEnabled(false);
  setVideoAdjustmentSubStep("subtitle_settings");
};

const moveToRunSettings = async (): Promise<void> => {
  if (!isSubtitleGenerationEnabled.value) await updateSubtitleEnabled(false);
  setVideoAdjustmentSubStep("run");
};

const SUBTITLE_TARGET_CHARS_PER_SECOND = 7;
const SUBTITLE_MIN_CUE_SECONDS = 1.8;
const SUBTITLE_MAX_CUE_SECONDS = 6.2;
const SUBTITLE_VISUAL_MAX_CHARS = 42;
const SUBTITLE_VISUAL_MIN_CHARS = 18;
const SUBTITLE_CUE_GAP_MS = 80;
const SUBTITLE_MIN_CUE_MS = 1300;
const SUBTITLE_SENTENCE_END_PATTERN = /[^。！？!?]+[。！？!?]?/g;
const SUBTITLE_SOFT_BREAK_CHARS = new Set(["、", "，", ",", "・", "／", "/", " "]);
const SUBTITLE_PARTICLE_BREAK_CHARS = new Set([
  "は",
  "が",
  "を",
  "に",
  "で",
  "と",
  "も",
  "へ",
  "や",
]);

const normalizeSubtitleText = (text: string): string => text.replace(/\s+/g, " ").trim();

const findSubtitleBreakIndex = (text: string, maxChars: number): number => {
  const searchEnd = Math.min(maxChars, text.length - 1);
  const searchStart = Math.max(SUBTITLE_VISUAL_MIN_CHARS, searchEnd - 12);
  for (let index = searchEnd; index >= searchStart; index -= 1) {
    if (SUBTITLE_SOFT_BREAK_CHARS.has(text[index]!)) {
      return index + 1;
    }
  }
  for (let index = searchEnd; index >= searchStart; index -= 1) {
    if (SUBTITLE_PARTICLE_BREAK_CHARS.has(text[index]!) && !SUBTITLE_SOFT_BREAK_CHARS.has(text[index + 1] ?? "")) {
      return index + 1;
    }
  }
  return Math.min(maxChars, text.length);
};

const splitSubtitlePhrase = (text: string, maxChars = SUBTITLE_VISUAL_MAX_CHARS): string[] => {
  const result: string[] = [];
  let remaining = normalizeSubtitleText(text);
  while (remaining.length > maxChars) {
    const breakIndex = findSubtitleBreakIndex(remaining, maxChars);
    const chunk = remaining.slice(0, breakIndex).trim();
    if (chunk) result.push(chunk);
    remaining = remaining.slice(breakIndex).trim();
  }
  if (remaining) result.push(remaining);
  return result;
};

const packSubtitleChunks = (parts: string[], maxChars: number): string[] => {
  const chunks: string[] = [];
  let current = "";
  for (const part of parts.map(normalizeSubtitleText).filter(Boolean)) {
    const candidate = `${current}${part}`;
    if (!current || candidate.length <= maxChars || current.length < SUBTITLE_VISUAL_MIN_CHARS) {
      current = candidate;
      continue;
    }
    chunks.push(current.trim());
    current = part;
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks;
};

const mergeSubtitleChunksToLimit = (chunks: string[], maxCueCount: number): string[] => {
  if (chunks.length <= maxCueCount) return chunks;
  const merged: string[] = [];
  const bucketCount = Math.max(1, maxCueCount);
  for (let bucketIndex = 0; bucketIndex < bucketCount; bucketIndex += 1) {
    const start = Math.floor((bucketIndex * chunks.length) / bucketCount);
    const end = Math.floor(((bucketIndex + 1) * chunks.length) / bucketCount);
    const bucketText = chunks.slice(start, Math.max(start + 1, end)).join("");
    if (bucketText.trim()) merged.push(bucketText.trim());
  }
  return merged.filter(Boolean);
};

const splitSubtitleText = (text: string, availableSeconds = 0): string[] => {
  const normalized = normalizeSubtitleText(text);
  if (!normalized) return [];
  const durationMaxCueCount = availableSeconds > 0
    ? Math.max(1, Math.floor(availableSeconds / SUBTITLE_MIN_CUE_SECONDS))
    : normalized.length;
  const visualCueCount = Math.max(1, Math.ceil(normalized.length / SUBTITLE_VISUAL_MAX_CHARS));
  const cueCount = Math.max(1, Math.min(durationMaxCueCount, visualCueCount));
  const targetMaxChars = Math.min(
    SUBTITLE_VISUAL_MAX_CHARS,
    Math.max(SUBTITLE_VISUAL_MIN_CHARS, Math.ceil(normalized.length / cueCount))
  );
  const sentenceParts = normalized.match(SUBTITLE_SENTENCE_END_PATTERN) ?? [normalized];
  const phraseParts = sentenceParts.flatMap((part) => splitSubtitlePhrase(part, targetMaxChars));
  const packed = packSubtitleChunks(phraseParts, targetMaxChars);
  return mergeSubtitleChunksToLimit(packed, durationMaxCueCount);
};

const allocateSubtitleCueDrafts = (
  chunks: string[],
  startSeconds: number,
  endSeconds: number
): SubtitleSegmentInput[] => {
  const availableSeconds = Math.max(0, endSeconds - startSeconds);
  if (chunks.length === 0 || availableSeconds <= 0) return [];
  const drafts: SubtitleCueDraft[] = chunks.map((chunk) => ({
    text: chunk,
    weight: Math.max(SUBTITLE_MIN_CUE_SECONDS, chunk.length / SUBTITLE_TARGET_CHARS_PER_SECOND),
  }));
  const totalWeight = drafts.reduce((total, draft) => total + draft.weight, 0) || 1;
  let cursor = startSeconds;
  const segments: SubtitleSegmentInput[] = [];
  drafts.forEach((draft, index) => {
    const isLast = index === drafts.length - 1;
    const proportionalSeconds = (availableSeconds * draft.weight) / totalWeight;
    const cueSeconds = isLast
      ? endSeconds - cursor
      : Math.min(SUBTITLE_MAX_CUE_SECONDS, Math.max(SUBTITLE_MIN_CUE_SECONDS, proportionalSeconds));
    const cueEnd = isLast ? endSeconds : Math.min(endSeconds, cursor + cueSeconds);
    if (cueEnd - cursor >= 0.35) {
      segments.push({
        startMs: Math.round(cursor * 1000),
        endMs: Math.round(cueEnd * 1000),
        text: draft.text,
      });
    }
    cursor = cueEnd;
  });
  return segments;
};

const normalizeSubtitleSegmentTimeline = (segments: SubtitleSegmentInput[]): SubtitleSegmentInput[] => {
  const sorted = [...segments].sort((a, b) => a.startMs - b.startMs || a.endMs - b.endMs);
  for (let index = 0; index < sorted.length - 1; index += 1) {
    const current = sorted[index]!;
    const next = sorted[index + 1]!;
    const latestEnd = next.startMs - SUBTITLE_CUE_GAP_MS;
    if (current.endMs > latestEnd) {
      const croppedEnd = Math.max(current.startMs + SUBTITLE_MIN_CUE_MS, latestEnd);
      if (croppedEnd <= next.startMs - 20) {
        current.endMs = croppedEnd;
      } else {
        next.startMs = Math.max(next.startMs, current.endMs + SUBTITLE_CUE_GAP_MS);
      }
    }
  }
  return sorted.filter((segment) => segment.text.trim() && segment.endMs > segment.startMs);
};

const buildSubtitleCaptionSegments = (): SubtitleSegmentInput[] => {
  const segments: SubtitleSegmentInput[] = [];
  let sectionOffsetSeconds = 0;
  for (const section of editorSections.value) {
    const sectionDuration = Math.max(0.1, section.endTime - section.startTime);
    for (const [segmentIndex, narration] of section.finalyNarrations.entries()) {
      const text = (narration.rewrittenText || narration.originalText || "").trim();
      if (!text) continue;
      const startSeconds = sectionOffsetSeconds + Math.max(
        0,
        Number(narration.startSeconds ?? segmentIndex * 0.1)
      );
      const durationSeconds = Math.max(
        1,
        Number(narration.requestOutput?.durationSeconds ?? narration.endSeconds ?? 0) ||
          Math.min(8, Math.max(1.8, text.length / 9))
      );
      const endLimit = sectionOffsetSeconds + sectionDuration;
      const endSeconds = Math.min(endLimit, startSeconds + durationSeconds);
      if (endSeconds <= startSeconds) continue;
      const chunks = splitSubtitleText(text, endSeconds - startSeconds);
      segments.push(...allocateSubtitleCueDrafts(chunks, startSeconds, endSeconds));
    }
    sectionOffsetSeconds += sectionDuration;
  }
  return normalizeSubtitleSegmentTimeline(segments);
};

const skipSubtitleStep = async (): Promise<void> => {
  const project = store.selectedProject;
  if (!project) return;
  await store.updateProject(project.videoId, project.id, {
    currentStep: "subtitle",
    subtitleSettings: {
      ...(project.subtitleSettings ?? {}),
      enabled: false,
      skipped: true,
    },
    completedSteps: Array.from(new Set([...project.completedSteps, "subtitle"])),
  });
  requestNotice.value = {
    kind: "success",
    message: "動画調整をスキップしました。最終動画はそのまま保存できます。",
  };
  videoAdjustmentSubStep.value = "download";
  toast.add({
    title: "動画調整をスキップしました",
    color: "success",
  });
};

const requestSilenceCutGeneration = async (
  options: { managedByAdjustment?: boolean; showToast?: boolean; rethrow?: boolean } = {}
): Promise<void> => {
  const project = store.selectedProject;
  const video = store.selectedVideo;
  const finalVideoPath = finalVideoExportAsset.value;
  if (!project || !video || !finalVideoPath) return;
  if (!options.managedByAdjustment) activeRequest.value = "silenceCut";
  resetSilenceCutProgress();
  requestNotice.value = { kind: "success", message: "無音カット動画の生成を開始しています..." };
  try {
    const now = Date.now();
    const settings = {
      enabled: true,
      preset: "natural" as const,
      thresholdDb: Number(project.silenceCutSettings?.thresholdDb ?? -38),
      minSilenceMs: Number(project.silenceCutSettings?.minSilenceMs ?? 700),
      keepPaddingMs: Number(project.silenceCutSettings?.keepPaddingMs ?? 180),
      minSegmentMs: Number(project.silenceCutSettings?.minSegmentMs ?? 450),
      skipped: false,
    };
    const outputFilePath = getVideoExportStoragePath({
      organizationId: store.organizationId,
      spaceId: store.spaceId,
      videoId: video.id,
      projectId: project.id,
      fileName: `silence-cut/final_silence_cut_${now}.mp4`,
    });
    const manifestOutputFilePath = getVideoExportStoragePath({
      organizationId: store.organizationId,
      spaceId: store.spaceId,
      videoId: video.id,
      projectId: project.id,
      fileName: `silence-cut/manifest_${now}.json`,
    });
    const requestId = `silence_cut_${project.id}_${now}`;
    setSilenceCutProgressItemStatus("detect", "running");
    silenceCutProgress.message = "音声の無音区間を検出しています。";
    await createWorkflowRequestDoc(
      "trimSilenceVideoRequests",
      {
        videoBucketName: finalVideoPath.bucketName,
        videoFilePath: finalVideoPath.filePath,
        outputBucketName: store.defaultBucket,
        outputFilePath,
        manifestOutputFilePath,
        settings,
        videoId: video.id,
        projectId: project.id,
        projectName: project.name,
        videoTitle: video.title,
      },
      requestId
    );
    setSilenceCutProgressItemStatus("detect", "completed");
    setSilenceCutProgressItemStatus("render", "running");
    silenceCutProgress.message = "動画と音声を同期したまま再構成しています。";
    const result = await waitForRequestDoc("trimSilenceVideoRequests", requestId, 1000 * 60 * 15);
    const output = result.output ?? {};
    setSilenceCutProgressItemStatus("render", "completed");
    setSilenceCutProgressItemStatus("upload", "running");
    const trimmedVideo = extractStorageOutputPath(output, { preferredNestedKey: "trimmedVideo" }) ?? {
      bucketName: store.defaultBucket,
      filePath: outputFilePath,
    };
    const manifest = extractStorageOutputPath(output, { preferredNestedKey: "manifest" }) ?? {
      bucketName: store.defaultBucket,
      filePath: manifestOutputFilePath,
    };
    await store.updateProject(project.videoId, project.id, {
      silenceCutSettings: settings,
      silenceCutOutput: removeUndefinedFields({
        trimmedVideo: {
          resultBucketName: trimmedVideo.bucketName,
          resultFilePath: trimmedVideo.filePath,
        },
        manifest: {
          resultBucketName: manifest.bucketName,
          resultFilePath: manifest.filePath,
        },
        requestId,
        generatedAt: Timestamp.now(),
        settings,
        statistics: isRecord(output.statistics) ? output.statistics : undefined,
      }) as Record<string, unknown>,
    });
    await store.resolveSelectedProjectSilenceCutOutputUrl();
    setSilenceCutProgressItemStatus("upload", "completed");
    silenceCutProgress.message = "無音カット動画の生成が完了しました。";
    requestNotice.value = {
      kind: "success",
      message: "無音カット版動画と manifest を生成しました。字幕生成はこの動画を入力にします。",
    };
    if (options.showToast !== false) {
      toast.add({
        title: "無音カットが完了しました",
        color: "success",
      });
    }
  } catch (error) {
    silenceCutProgress.message = error instanceof Error ? error.message : "無音カットに失敗しました。";
    silenceCutProgressItems.value = silenceCutProgressItems.value.map((item) =>
      item.status === "running" ? { ...item, status: "error" } : item
    );
    requestNotice.value = {
      kind: "error",
      message: error instanceof Error ? error.message : "無音カットに失敗しました。",
    };
    reportDatadogError(error, {
      feature: "video_studio",
      operation: "trim_silence",
      projectId: project.id,
      videoId: video.id,
    });
    if (options.rethrow) throw error;
  } finally {
    if (!options.managedByAdjustment) activeRequest.value = null;
  }
};

const requestSubtitleGeneration = async (
  options: { managedByAdjustment?: boolean; showToast?: boolean; rethrow?: boolean } = {}
): Promise<void> => {
  const project = store.selectedProject;
  const video = store.selectedVideo;
  const finalVideoPath = subtitleSourceVideoExportAsset.value;
  if (!project || !video || !finalVideoPath) return;
  const captionSegments = subtitleCaptionSegments.value;
  if (captionSegments.length === 0) {
    requestNotice.value = {
      kind: "error",
      message: "字幕に使えるAIナレーション本文がありません。",
    };
    return;
  }
  if (!options.managedByAdjustment) activeRequest.value = "subtitle";
  resetSubtitleProgress();
  requestNotice.value = { kind: "success", message: "字幕付き動画の生成を開始しています..." };
  try {
    setSubtitleProgressItemStatus("data", "running");
    const now = Date.now();
    const subtitledVideoFilePath = getVideoExportStoragePath({
      organizationId: store.organizationId,
      spaceId: store.spaceId,
      videoId: video.id,
      projectId: project.id,
      fileName: `subtitles/final_subtitled_${now}.mp4`,
    });
    const srtFilePath = getVideoExportStoragePath({
      organizationId: store.organizationId,
      spaceId: store.spaceId,
      videoId: video.id,
      projectId: project.id,
      fileName: `subtitles/captions_${now}.srt`,
    });
    const assFilePath = getVideoExportStoragePath({
      organizationId: store.organizationId,
      spaceId: store.spaceId,
      videoId: video.id,
      projectId: project.id,
      fileName: `subtitles/captions_${now}.ass`,
    });
    const preset = selectedSubtitlePreset.value;
    const subtitleSize = selectedSubtitleSize.value;
    const subtitleFontScale = selectedSubtitleFontScale.value;
    const requestId = `subtitle_${project.id}_${now}`;
    setSubtitleProgressItemStatus("data", "completed");
    setSubtitleProgressItemStatus("burn", "running");
    subtitleProgress.message = `${preset.label} で字幕を焼き込んでいます。`;
    await createWorkflowRequestDoc(
      "addVideoSubtitleRequests",
      {
        videoBucketName: finalVideoPath.bucketName,
        videoFilePath: finalVideoPath.filePath,
        outputBucketName: store.defaultBucket,
        outputFilePath: subtitledVideoFilePath,
        subtitleSrtOutputFilePath: srtFilePath,
        subtitleAssOutputFilePath: assFilePath,
        videoId: video.id,
        projectId: project.id,
        projectName: project.name,
        videoTitle: video.title,
        preset: preset.key,
        presetLabel: preset.label,
        subtitleSize: subtitleSize.key,
        captionSegments,
        captionStyle: {
          preset: preset.key,
          position: preset.style.position,
          fontScale: subtitleFontScale,
          fontColor: preset.style.fontColor,
          outlineColor: preset.style.outlineColor,
          backColor: preset.style.backColor,
          bold: preset.style.bold,
        },
      },
      requestId
    );
    const result = await waitForRequestDoc("addVideoSubtitleRequests", requestId, 1000 * 60 * 15);
    setSubtitleProgressItemStatus("burn", "completed");
    setSubtitleProgressItemStatus("upload", "running");
    const output = result.output ?? {};
    const subtitledVideo = extractStorageOutputPath(output, { preferredNestedKey: "subtitledVideo" }) ?? {
      bucketName: store.defaultBucket,
      filePath: subtitledVideoFilePath,
    };
    const srt = extractStorageOutputPath(output, { preferredNestedKey: "srt" }) ?? {
      bucketName: store.defaultBucket,
      filePath: srtFilePath,
    };
    const ass = extractStorageOutputPath(output, { preferredNestedKey: "ass" }) ?? {
      bucketName: store.defaultBucket,
      filePath: assFilePath,
    };
    await store.updateProject(project.videoId, project.id, {
      currentStep: "subtitle",
      subtitleSettings: {
        ...(project.subtitleSettings ?? {}),
        enabled: true,
        preset: preset.key,
        size: subtitleSize.key,
        position: preset.style.position,
        fontScale: subtitleFontScale,
        skipped: false,
      },
      subtitleOutput: removeUndefinedFields({
        subtitledVideo: {
          resultBucketName: subtitledVideo.bucketName,
          resultFilePath: subtitledVideo.filePath,
        },
        srt: {
          resultBucketName: srt.bucketName,
          resultFilePath: srt.filePath,
        },
        ass: {
          resultBucketName: ass.bucketName,
          resultFilePath: ass.filePath,
        },
        requestId,
        generatedAt: Timestamp.now(),
        preset: preset.key,
        statistics: isRecord(output.statistics) ? output.statistics : undefined,
      }) as Record<string, unknown>,
      completedSteps: Array.from(new Set([...project.completedSteps, "subtitle"])),
    });
    await store.resolveSelectedProjectSubtitleOutputUrl();
    setSubtitleProgressItemStatus("upload", "completed");
    subtitleProgress.message = "字幕付き動画の生成が完了しました。";
    requestNotice.value = {
      kind: "success",
      message: "字幕付き動画、SRT、ASS の生成が完了しました。",
    };
    if (options.showToast !== false) {
      toast.add({
        title: "字幕付き動画を生成しました",
        description: preset.label,
        color: "success",
      });
    }
  } catch (error) {
    subtitleProgress.message = error instanceof Error ? error.message : "字幕生成に失敗しました。";
    subtitleProgressItems.value = subtitleProgressItems.value.map((item) =>
      item.status === "running" ? { ...item, status: "error" } : item
    );
    requestNotice.value = {
      kind: "error",
      message: error instanceof Error ? error.message : "字幕生成に失敗しました。",
    };
    reportDatadogError(error, {
      feature: "video_studio",
      operation: "generate_subtitle",
      projectId: project.id,
      videoId: video.id,
    });
    if (options.rethrow) throw error;
  } finally {
    if (!options.managedByAdjustment) activeRequest.value = null;
  }
};

const requestVideoAdjustmentGeneration = async (): Promise<void> => {
  const project = store.selectedProject;
  if (!project || activeRequest.value) return;
  if (!videoAdjustmentCanRun.value) {
    requestNotice.value = {
      kind: "error",
      message: videoAdjustmentRunDisabledReason.value || "動画調整を実行できません。",
    };
    return;
  }

  if (!isSilenceCutEnabled.value && !isSubtitleGenerationEnabled.value) {
    await skipSubtitleStep();
    videoAdjustmentSubStep.value = "download";
    return;
  }

  requestNotice.value = {
    kind: "success",
    message: "動画調整を開始しています。選択した処理を順番に実行します。",
  };

  try {
    if (isSilenceCutEnabled.value) {
      activeRequest.value = "silenceCut";
      await requestSilenceCutGeneration({
        managedByAdjustment: true,
        showToast: false,
        rethrow: true,
      });
    } else {
      resetSilenceCutProgress();
      silenceCutProgressItems.value = silenceCutProgressItems.value.map((item) => ({
        ...item,
        status: "skipped",
      }));
      silenceCutProgress.message = "無音カットはスキップします。";
      await updateSilenceCutEnabled(false);
    }

    if (isSubtitleGenerationEnabled.value) {
      activeRequest.value = "subtitle";
      await requestSubtitleGeneration({
        managedByAdjustment: true,
        showToast: false,
        rethrow: true,
      });
    } else {
      resetSubtitleProgress();
      subtitleProgressItems.value = subtitleProgressItems.value.map((item) => ({
        ...item,
        status: "skipped",
      }));
      subtitleProgress.message = "字幕生成はスキップします。";
      await updateSubtitleEnabled(false);
      await store.updateProject(project.videoId, project.id, {
        currentStep: "subtitle",
        completedSteps: Array.from(new Set([...project.completedSteps, "subtitle"])),
      });
    }

    requestNotice.value = {
      kind: "success",
      message: "動画調整が完了しました。成果物を確認して保存できます。",
    };
    toast.add({
      title: "動画調整が完了しました",
      color: "success",
    });
    videoAdjustmentSubStep.value = "download";
  } catch (error) {
    requestNotice.value = {
      kind: "error",
      message: error instanceof Error ? error.message : "動画調整に失敗しました。",
    };
  } finally {
    activeRequest.value = null;
  }
};

const sectionPreviewStoragePath = (
  section: VideoStudioSection
): string => {
  const mergedPath = section.mergedVideoOutput?.resultFilePath;
  if (mergedPath) return mergedPath;
  return (
    getSectionVideoForMerge(section)?.filePath ??
    section.videoSegment?.gcsFilePath ??
    section.splitVideo?.gcsFilePath ??
    ""
  );
};

const refreshExportSectionPreview = async (): Promise<void> => {
  const section = selectedExportSection.value;
  if (!section) {
    selectedExportSectionPreviewUrl.value = "";
    return;
  }
  const path = sectionPreviewStoragePath(section);
  if (!path) {
    selectedExportSectionPreviewUrl.value = "";
    return;
  }
  try {
    selectedExportSectionPreviewUrl.value = await store.resolveStorageUrl(path);
  } catch (error) {
    selectedExportSectionPreviewUrl.value = "";
    reportDatadogError(error, {
      feature: "video_studio",
      operation: "resolve_export_section_preview",
      sectionId: section.id,
    });
  }
};

const selectExportSection = (index: number): void => {
  selectedExportSectionIndex.value = index;
  void refreshExportSectionPreview();
};

watch(
  () => [isExportStep.value, editorSections.value.length] as const,
  ([exportStep]) => {
    if (!exportStep) return;
    if (selectedExportSectionIndex.value >= editorSections.value.length) {
      selectedExportSectionIndex.value = 0;
    }
    if (exportProgressItems.value.length === 0) {
      resetExportProgress();
    }
    void refreshExportSectionPreview();
  },
  { immediate: true }
);

watch(
  () =>
    editorSections.value.map((section) => section.mergedVideoOutput?.resultFilePath ?? "").join("|"),
  () => {
    if (isExportStep.value) void refreshExportSectionPreview();
  }
);

watch(
  () => [screenRecorder.liveStream.value, screenRecordingLiveVideo.value] as const,
  ([stream, video]) => {
    if (!video) return;
    if (video.srcObject === stream) return;
    video.srcObject = stream;
    if (stream) {
      void video.play().catch(() => undefined);
    }
  },
  { immediate: true }
);

watch(
  () => [screenRecordingVoiceInput.transcript.value, screenRecordingVoiceInput.isFinal.value] as const,
  ([transcript, isFinal]) => {
    const text = transcript.trim().replace(/\s+/g, " ");
    if (!text) return;
    if (isFinal) {
      const last = screenRecordingTranscriptFinalSegments.value.at(-1);
      if (last !== text) screenRecordingTranscriptFinalSegments.value.push(text);
      screenRecordingTranscriptInterim.value = "";
      return;
    }
    screenRecordingTranscriptInterim.value = text;
  }
);

watch(
  () => screenRecordingVoiceInput.error.value,
  (error) => {
    if (!error) return;
    const errorRecord = error as { error?: string };
    const errorCode = errorRecord.error || "unknown";
    screenRecordingTranscriptError.value = `音声認識でエラーが発生しました: ${errorCode}`;
    reportDatadogError(new Error(`screen_recording_transcript.${errorCode}`), {
      feature: "video_studio_screen_recording",
      provider: "browser_speech_recognition",
      errorCode,
    });
  }
);

watch(
  () => screenRecorder.isRecording.value,
  (isRecordingNow, wasRecording) => {
    if (!isRecordingNow && wasRecording) stopScreenRecordingTranscript();
  }
);

const onFileChange = (event: Event): void => {
  const target = event.target as HTMLInputElement;
  selectedFile.value = target.files?.[0] ?? null;
};

const parseTags = (value: string): string[] =>
  value
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);

const resetScreenRecordingTranscript = (): void => {
  screenRecordingTranscriptFinalSegments.value = [];
  screenRecordingTranscriptInterim.value = "";
  screenRecordingTranscriptError.value = "";
};

const startScreenRecordingTranscript = (): void => {
  if (!screenRecorder.includeMicrophone.value) {
    reportDatadogInfo("screen_recording_transcript.microphone_disabled", {
      feature: "video_studio_screen_recording",
      provider: "browser_speech_recognition",
    });
    return;
  }
  if (!screenRecordingVoiceInput.isSupported.value) {
    reportDatadogInfo("screen_recording_transcript.unsupported", {
      feature: "video_studio_screen_recording",
      provider: "browser_speech_recognition",
      userAgent: import.meta.client ? navigator.userAgent : "",
    });
    return;
  }
  screenRecordingTranscriptError.value = "";
  try {
    screenRecordingVoiceInput.start();
    reportDatadogInfo("screen_recording_transcript.started", {
      feature: "video_studio_screen_recording",
      provider: "browser_speech_recognition",
    });
  } catch (error) {
    screenRecordingTranscriptError.value =
      error instanceof Error ? error.message : "音声認識の開始に失敗しました。";
    reportDatadogError(error, {
      feature: "video_studio_screen_recording",
      provider: "browser_speech_recognition",
      phase: "start",
    });
  }
};

const stopScreenRecordingTranscript = (): void => {
  if (!screenRecordingVoiceInput.isListening.value) return;
  screenRecordingVoiceInput.stop();
  reportDatadogInfo("screen_recording_transcript.stopped", {
    feature: "video_studio_screen_recording",
    provider: "browser_speech_recognition",
    characterCount: screenRecordingTranscriptText.value.length,
    segmentCount: screenRecordingTranscriptLines.value.length,
  });
};

const startScreenRecordingSession = async (): Promise<void> => {
  resetScreenRecordingTranscript();
  await screenRecorder.start();
  if (screenRecorder.isRecording.value) startScreenRecordingTranscript();
};

const stopScreenRecordingSession = (): void => {
  stopScreenRecordingTranscript();
  screenRecorder.stop();
};

const resetScreenRecordingSession = (): void => {
  stopScreenRecordingTranscript();
  screenRecorder.reset();
  resetScreenRecordingTranscript();
};

const openScreenRecordingModal = (): void => {
  isScreenRecordingModalOpen.value = true;
};

const closeScreenRecordingModal = (): void => {
  if (screenRecorder.isRecording.value || store.isUploading || isScreenRecordingSaving.value) return;
  isScreenRecordingModalOpen.value = false;
};

const seekDetailVideo = (timestampSeconds: number): void => {
  const video = detailVideoPlayer.value;
  if (!video) return;
  video.currentTime = Math.max(0, timestampSeconds);
  void video.play().catch(() => undefined);
};

type ScreenRecordingSceneThumbnail = NonNullable<VideoStudioVideo["sceneThumbnails"]>[number];

const blobToJpegFile = (blob: Blob, fileName: string): File =>
  new File([blob], fileName, { type: "image/jpeg" });

const canvasToJpegBlob = (canvas: HTMLCanvasElement): Promise<Blob> =>
  new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("サムネイル画像の生成に失敗しました。"));
          return;
        }
        resolve(blob);
      },
      "image/jpeg",
      0.82
    );
  });

const captureScreenRecordingFrame = async (
  sourceUrl: string,
  timestampSeconds: number
): Promise<Blob> => {
  const video = document.createElement("video");
  video.src = sourceUrl;
  video.muted = true;
  video.playsInline = true;
  video.preload = "auto";

  await new Promise<void>((resolve, reject) => {
    video.onloadedmetadata = () => resolve();
    video.onerror = () => reject(new Error("録画動画を読み込めませんでした。"));
  });

  const durationSeconds = Number.isFinite(video.duration) ? video.duration : 0;
  const targetTime = Math.min(
    Math.max(0.2, timestampSeconds),
    Math.max(0.2, durationSeconds - 0.2)
  );

  await new Promise<void>((resolve, reject) => {
    video.onseeked = () => resolve();
    video.onerror = () => reject(new Error("録画動画のフレーム取得に失敗しました。"));
    video.currentTime = targetTime;
  });

  const canvas = document.createElement("canvas");
  canvas.width = video.videoWidth || 1280;
  canvas.height = video.videoHeight || 720;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("サムネイル描画用 canvas を作成できませんでした。");
  context.drawImage(video, 0, 0, canvas.width, canvas.height);
  video.removeAttribute("src");
  video.load();
  return canvasToJpegBlob(canvas);
};

const screenRecordingSceneTimestamps = (durationSeconds: number): number[] => {
  const duration = Math.max(0, durationSeconds);
  if (duration <= 0) return [0.2];
  const intervalSeconds = 5;
  const heroTimestamp = Math.min(
    Math.max(1, duration * 0.15),
    Math.max(0.2, duration - 0.2)
  );
  const timestamps = new Set<number>([Number(heroTimestamp.toFixed(1))]);
  for (let time = intervalSeconds; time < duration; time += intervalSeconds) {
    timestamps.add(Math.round(time));
  }
  return Array.from(timestamps)
    .filter((time) => time < duration || duration < 1)
    .sort((a, b) => a - b)
    .slice(0, 18);
};

const uploadScreenRecordingScenes = async (params: {
  videoId: string;
  sourceUrl: string;
  durationSeconds: number;
}): Promise<ScreenRecordingSceneThumbnail[]> => {
  const timestamps = screenRecordingSceneTimestamps(params.durationSeconds);
  const storage = getStorage();
  const scenes: ScreenRecordingSceneThumbnail[] = [];

  for (const [index, timestampSeconds] of timestamps.entries()) {
    const imageBlob = await captureScreenRecordingFrame(params.sourceUrl, timestampSeconds);
    const fileName = `scene-${String(index + 1).padStart(2, "0")}-${Math.round(timestampSeconds)}s.jpg`;
    const filePath = getVideoThumbnailStoragePath({
      organizationId: store.organizationId,
      spaceId: store.spaceId,
      videoId: params.videoId,
      fileName,
    });
    const storageReference = storageRef(storage, filePath);
    await uploadBytes(storageReference, blobToJpegFile(imageBlob, fileName), {
      contentType: "image/jpeg",
    });
    const imageUrl = await getDownloadURL(storageReference);
    scenes.push({
      timestampSeconds,
      imageUrl,
      storageBucket: store.defaultBucket,
      storagePath: filePath,
    });
  }

  return scenes;
};

const saveScreenRecordingAsset = async (): Promise<void> => {
  if (screenRecordingSaveDisabled.value) return;
  const recordedFile = screenRecorder.createFile(screenRecordingTitle.value);
  if (!recordedFile) return;
  isScreenRecordingSaving.value = true;
  try {
    const previewUrl = screenRecorder.previewUrl.value;
    const durationSeconds = screenRecorder.metadata.value?.durationSeconds ?? 0;
    const videoId = await store.createUploadedVideo({
      title: screenRecordingTitle.value,
      description: screenRecordingDescription.value,
      tags: parseTags(screenRecordingTagsText.value),
      file: recordedFile,
      sourceType: "screen_recording",
      transcriptionResult: screenRecordingTranscriptText.value,
      openAfterCreate: false,
    });

    const updates: {
      duration?: number;
      thumbnailUrl?: string;
      sceneThumbnails?: VideoStudioVideo["sceneThumbnails"];
    } = {};
    if (durationSeconds) updates.duration = durationSeconds;

    if (previewUrl) {
      try {
        const sceneThumbnails = await uploadScreenRecordingScenes({
          videoId,
          sourceUrl: previewUrl,
          durationSeconds,
        });
        updates.sceneThumbnails = sceneThumbnails;
        updates.thumbnailUrl = sceneThumbnails[0]?.imageUrl;
      } catch (error) {
        reportDatadogError(error, {
          feature: "video_studio_screen_recording",
          phase: "scene_thumbnail_generation",
          videoId,
        });
      }
    }

    if (Object.keys(updates).length > 0) {
      await store.updateVideo(videoId, updates);
    }

    screenRecorder.reset();
    screenRecordingTitle.value = "";
    screenRecordingDescription.value = "";
    screenRecordingTagsText.value = "";
    resetScreenRecordingTranscript();
    isScreenRecordingModalOpen.value = false;
    toast.add({
      title: "スクリーン撮影を保存しました",
      color: "success",
    });
  } finally {
    isScreenRecordingSaving.value = false;
  }
};

const openScreenRecordingDetail = async (videoId: string): Promise<void> => {
  await store.openVideo(videoId);
};

const startEditorFromScreenRecording = async (videoId: string): Promise<void> => {
  await store.openVideo(videoId);
  const video = store.selectedVideo;
  projectForm.name = video ? `${video.title} 編集` : "スクリーン撮影編集";
  projectForm.description = video?.description || "保存済みスクリーン撮影から作成した編集プロジェクト";
  projectForm.videoAudioType = "with_audio";
  projectForm.voiceName = "Puck";
  projectForm.sectioningPrompt = "";
  isProjectCreateModalOpen.value = true;
};

const registerVideo = async (): Promise<void> => {
  if (registerDisabled.value) return;
  const payload = {
    title: registerForm.title,
    description: registerForm.description,
    tags: parseTags(registerForm.tagsText),
  };
  if (registerForm.sourceType === "upload") {
    if (!selectedFile.value) return;
    await store.createUploadedVideo({ ...payload, file: selectedFile.value });
  } else {
    await store.createYoutubeVideo({ ...payload, sourceUrl: registerForm.sourceUrl });
  }
  registerForm.title = "";
  registerForm.description = "";
  registerForm.tagsText = "";
  registerForm.sourceUrl = "";
  selectedFile.value = null;
  if (fileInput.value) fileInput.value.value = "";
  isRegisterModalOpen.value = false;
};

const createProject = async (): Promise<void> => {
  if (!store.selectedVideo || !projectForm.name.trim() || !projectForm.description.trim()) return;
  const projectId = await store.createProject({
    video: store.selectedVideo,
    name: projectForm.name,
    description: projectForm.description,
    videoAudioType: projectForm.videoAudioType,
    voiceName: projectForm.voiceName,
    openAfterCreate: projectForm.videoAudioType !== "with_audio",
  });
  if (projectForm.videoAudioType === "with_audio") {
    createdProjectIdForAutoSection.value = projectId;
    await startAutoSection(projectId);
    return;
  }
  resetProjectCreateState();
  isProjectCreateModalOpen.value = false;
};

const resetProjectCreateState = (): void => {
  projectForm.name = "";
  projectForm.description = "";
  projectForm.videoAudioType = "with_audio";
  projectForm.voiceName = "Puck";
  projectForm.sectioningPrompt = "";
  createdProjectIdForAutoSection.value = null;
  autoSectionRequestId.value = null;
  isAutoSectionProcessing.value = false;
  showAutoSectionPreview.value = false;
  autoSectionPreviewIndex.value = 0;
  autoSectionPreviewVideoUrl.value = "";
  autoSectionPreviewOutput.value = null;
  autoSectionLogs.value = [];
  autoSectionStatusText.value = "待機中";
};

const closeProjectCreateModal = (): void => {
  cleanupAutoSectionWatcher();
  resetProjectCreateState();
  isProjectCreateModalOpen.value = false;
};

const startAutoSection = async (projectId: string): Promise<void> => {
  const video = store.selectedVideo;
  if (!video) return;
  const sourceFilePath =
    video.convertedStoragePath ||
    video.originalStoragePath ||
    video.storagePath;
  const sourceBucketName =
    video.convertedStorageBucket ||
    video.originalStorageBucket ||
    video.storageBucket ||
    store.defaultBucket;
  if (!sourceFilePath || !sourceBucketName) {
    requestNotice.value = {
      kind: "error",
      message: "自動セクション化にはアップロード動画の Storage パスが必要です。",
    };
    return;
  }
  isAutoSectionProcessing.value = true;
  showAutoSectionPreview.value = false;
  autoSectionLogs.value = [
    makeAutoSectionLog("info", "🎬 音声付き動画の自動セクション化処理を開始します"),
    makeAutoSectionLog("info", "📥 RequestDoc を作成しています"),
  ];
  autoSectionStatusText.value = "待機中";
  const requestId = await store.createRequestDoc({
    type: "autoSectionVideoRequests",
    input: {
      sourceBucketName,
      sourceFilePath,
      outputBucketName: sourceBucketName,
      videoId: video.id,
      projectId,
      projectName: projectForm.name.trim(),
      videoTitle: video.title,
      sectioningPrompt: projectForm.sectioningPrompt.trim() || undefined,
    },
  });
  autoSectionRequestId.value = requestId;
  autoSectionLogs.value = [
    ...autoSectionLogs.value,
    makeAutoSectionLog("info", `🧾 RequestDoc: ${requestId}`),
  ];
  watchAutoSectionRequest(requestId);
};

const retryAutoSection = async (): Promise<void> => {
  const projectId = createdProjectIdForAutoSection.value;
  if (!projectId) return;
  cleanupAutoSectionWatcher();
  await startAutoSection(projectId);
};

const watchAutoSectionRequest = (requestId: string): void => {
  cleanupAutoSectionWatcher();
  const { organizationId, spaceId } = store.requireScope();
  const db = getFirestore();
  const requestRef = doc(
    db,
    `organizations/${organizationId}/spaces/${spaceId}/requests/autoSectionVideoRequests/logs/${requestId}`
  );
  unsubscribeAutoSection = onSnapshot(requestRef, async (snapshot) => {
    if (!snapshot.exists()) return;
    const data = snapshot.data() as {
      status?: string;
      logs?: Array<{ timestamp?: Timestamp; message?: string; type?: string }>;
      output?: { sections?: Array<Record<string, unknown>> };
      errorMessage?: string;
    };
    autoSectionStatusText.value = statusText(data.status);
    const requestLogs = (data.logs ?? []).map((entry, index) =>
      makeAutoSectionLog(
        entry.type === "error" ? "error" : entry.type === "warning" ? "warning" : "info",
        entry.message || "",
        entry.timestamp,
        index
      )
    );
    autoSectionLogs.value = requestLogs.length > 0 ? requestLogs : autoSectionLogs.value;

    if (data.status === "completed" && data.output?.sections?.length) {
      isAutoSectionProcessing.value = false;
      autoSectionPreviewOutput.value = data.output;
      showAutoSectionPreview.value = true;
      autoSectionPreviewIndex.value = 0;
      await selectAutoSectionPreview(0);
      cleanupAutoSectionWatcher();
    } else if (data.status === "error") {
      isAutoSectionProcessing.value = false;
      autoSectionLogs.value = [
        ...autoSectionLogs.value,
        makeAutoSectionLog("error", data.errorMessage || "自動セクション化に失敗しました"),
      ];
    }
  });
};

const cleanupAutoSectionWatcher = (): void => {
  if (unsubscribeAutoSection) {
    unsubscribeAutoSection();
    unsubscribeAutoSection = null;
  }
};

const confirmAutoSectionPreview = async (): Promise<void> => {
  const projectId = createdProjectIdForAutoSection.value;
  const video = store.selectedVideo;
  if (!projectId || !video || autoSectionPreviewSections.value.length === 0) return;
  await store.openProject(video.id, projectId);
  await store.saveSections(autoSectionPreviewSections.value);
  await store.updateProject(video.id, projectId, {
    currentStep: "section_split",
    completedSteps: ["section_split"],
  });
  resetProjectCreateState();
  isProjectCreateModalOpen.value = false;
};

const selectAutoSectionPreview = async (index: number): Promise<void> => {
  autoSectionPreviewIndex.value = index;
  const section = autoSectionPreviewSections.value[index];
  const filePath = section?.videoSegment?.gcsFilePath || section?.splitVideo?.gcsFilePath;
  autoSectionPreviewVideoUrl.value = filePath ? await store.resolveStorageUrl(filePath) : "";
};

const openEditor = async (projectId: string): Promise<void> => {
  if (!store.selectedVideo) return;
  await store.openProject(store.selectedVideo.id, projectId);
  duration.value = safeNonNegativeSeconds(
    store.selectedProject?.editorState.timeline.duration,
    safeNonNegativeSeconds(store.selectedVideo.duration)
  );
};

const setWorkflowIndex = async (index: number): Promise<void> => {
  if (!store.selectedProject) return;
  const step = workflowSteps.value[index]?.key;
  if (!step) return;
  await store.updateProject(store.selectedProject.videoId, store.selectedProject.id, {
    currentStep: step,
  });
};

const handleWorkflowNext = async (): Promise<void> => {
  editorVideo.value?.pause();
  isPlaying.value = false;
  pauseRecordingPlaybackAudio();
  workflowDebugLog("next_clicked", {
    sectionCount: editorSections.value.length,
    transcribableSectionsCount: transcribableSectionsCount.value,
    completedTranscriptionSections: completedTranscriptionSections.value,
    currentWorkflowIndex: currentWorkflowIndex.value,
  });
  if (activeWorkflowStep.value === "section_split" && usesOriginalVideoAudio.value) {
    const advanced = await requestBulkTranscription({ advanceToAiStep: true });
    workflowDebugLog(advanced ? "next_with_audio_transcription_started" : "next_with_audio_transcription_blocked");
    return;
  }
  if (activeWorkflowStep.value === "recording") {
    const advanced = await requestBulkTranscription({ advanceToAiStep: true });
    workflowDebugLog(advanced ? "next_recording_transcription_started" : "next_recording_transcription_blocked");
    return;
  }
  if (activeWorkflowStep.value === "voice_generation") {
    const project = store.selectedProject;
    if (!project) return;
    if (!allNarrationSectionsFixed.value) {
      const firstUnfixedIndex = editorSections.value.findIndex((section) => !section.isFixed);
      if (firstUnfixedIndex >= 0) selectSection(firstUnfixedIndex);
      requestNotice.value = {
        kind: "error",
        message: "すべてのセクションで文字起こし完了とAI音声生成を確認し、編集を確定してください。",
      };
      return;
    }
    await store.updateProject(project.videoId, project.id, {
      currentStep: "export",
      completedSteps: Array.from(new Set([...project.completedSteps, "voice_generation"])),
    });
    workflowDebugLog("next_to_export_completed");
    return;
  }
  if (activeWorkflowStep.value === "export") {
    const project = store.selectedProject;
    if (!project) return;
    if (!finalVideoExportAsset.value) {
      requestNotice.value = {
        kind: "error",
        message: "字幕追加へ進む前に、最終動画を書き出してください。",
      };
      return;
    }
    await store.updateProject(project.videoId, project.id, {
      currentStep: "subtitle",
      completedSteps: Array.from(new Set([...project.completedSteps, "export"])),
    });
    return;
  }
  await setWorkflowIndex(currentWorkflowIndex.value + 1);
  workflowDebugLog("next_default_step_completed", {
    nextWorkflowIndex: currentWorkflowIndex.value + 1,
  });
};

const addNarrationSegment = async (sectionIndex = selectedSectionIndex.value): Promise<void> => {
  const section = editorSections.value[sectionIndex];
  if (!section) return;
  const nextSections = editorSections.value.map((item, index) => {
    if (index !== sectionIndex) return item;
    return {
      ...item,
      isFixed: false,
      finalyNarrations: [
        ...item.finalyNarrations,
        {
          id: createNarrationSegmentId(),
          originalText: "",
          rewrittenText: "",
          start: formatDuration(sectionStartSeconds(item)),
          startSeconds: 0,
          characterCount: 0,
          isTtsGenerated: false,
        },
      ],
    };
  });
  await store.saveSections(nextSections);
};

const deleteNarrationSegment = async (
  sectionIndex: number,
  segmentIndex: number
): Promise<void> => {
  const sections = editorSections.value.map((section, index) => {
    if (index !== sectionIndex || section.finalyNarrations.length <= 1) return section;
    return {
      ...section,
      isFixed: false,
      finalyNarrations: section.finalyNarrations.filter(
        (_segment, itemIndex) => itemIndex !== segmentIndex
      ),
    };
  });
  await store.saveSections(sections);
};

function narrationDurationSeconds(
  segment: VideoStudioSection["finalyNarrations"][number]
): number {
  const duration = Number(
    segment.requestOutput?.durationSeconds ??
      (typeof segment.endSeconds === "number" && typeof segment.startSeconds === "number"
        ? segment.endSeconds - segment.startSeconds
        : 0)
  );
  return Number.isFinite(duration) && duration > 0 ? duration : 4;
}

function clampNarrationStart(
  section: VideoStudioSection,
  segment: VideoStudioSection["finalyNarrations"][number],
  startSeconds: number
): number {
  const sectionDuration = sectionDurationSeconds(section);
  const maxStart = Math.max(0, sectionDuration - narrationDurationSeconds(segment));
  return Math.max(0, Math.min(safeNonNegativeSeconds(startSeconds), maxStart));
}

const updateNarrationTiming = async (
  sectionIndex: number,
  segmentIndex: number,
  startSeconds: number
): Promise<void> => {
  const section = editorSections.value[sectionIndex];
  if (!section) return;
  const targetSegment = section.finalyNarrations[segmentIndex];
  if (!targetSegment) return;
  const nextStart = clampNarrationStart(section, targetSegment, startSeconds);
  const sections = editorSections.value.map((item, index) => {
    if (index !== sectionIndex) return item;
    return {
      ...item,
      isFixed: false,
      finalyNarrations: item.finalyNarrations.map((segment, itemIndex) =>
        itemIndex === segmentIndex
          ? {
              ...segment,
              startSeconds: nextStart,
              start: formatDuration(nextStart),
            }
          : segment
      ),
    };
  });
  await store.saveSections(sections);
};

const adjustNarrationTiming = (
  sectionIndex: number,
  segmentIndex: number,
  deltaSeconds: number
): void => {
  const section = editorSections.value[sectionIndex];
  const segment = section?.finalyNarrations[segmentIndex];
  if (!section || !segment) return;
  selectedTimingSegmentIndex.value = segmentIndex;
  const currentStart = safeNonNegativeSeconds(segment.startSeconds);
  void updateNarrationTiming(sectionIndex, segmentIndex, currentStart + deltaSeconds);
};

const selectTimingSegment = (segmentIndex: number): void => {
  selectedTimingSegmentIndex.value = segmentIndex;
  const segment = selectedNarrationTimingSegments.value.find(
    (item) => item.index === segmentIndex
  );
  if (segment) seekTimingTo(segment.startSeconds);
};

const timingSegmentStyle = (
  segment: {
    index: number;
    startSeconds: number;
    width: number;
  }
): Record<string, string | number> => {
  const dragOffset =
    timingSegmentDrag.segmentIndex === segment.index ? timingSegmentDrag.deltaX : 0;
  return {
    left: `${timingTrackLabelWidth + segment.startSeconds * safeTimelineZoom.value}px`,
    width: `${segment.width}px`,
    transform: dragOffset ? `translateX(${dragOffset}px)` : "translateX(0)",
    transition: dragOffset ? "none" : "transform 120ms ease, left 120ms ease",
    zIndex: timingSegmentDrag.segmentIndex === segment.index ? 40 : 10,
  };
};

const seekTimingTo = (relativeSeconds: number): void => {
  const section = selectedSectionForRecording.value;
  if (!section) return;
  const sectionDuration = sectionDurationSeconds(section);
  seekTo(sectionStartSeconds(section) + Math.max(0, Math.min(safeNonNegativeSeconds(relativeSeconds), sectionDuration)));
};

const timingSecondsFromPointer = (event: MouseEvent | PointerEvent): number | null => {
  const element = timingTimelineContainer.value;
  const section = selectedSectionForRecording.value;
  if (!element || !section) return null;
  const rect = element.getBoundingClientRect();
  const sectionDuration = sectionDurationSeconds(section);
  const localX = event.clientX - rect.left + element.scrollLeft - timingTrackLabelWidth;
  return Math.max(
    0,
    Math.min(localX / safeTimelineZoom.value, sectionDuration)
  );
};

const handleTimingTimelineClick = (event: MouseEvent): void => {
  if ((event.target as HTMLElement | null)?.closest(".audio-timing-segment")) return;
  selectedTimingSegmentIndex.value = null;
  const seconds = timingSecondsFromPointer(event);
  if (seconds !== null) seekTimingTo(seconds);
};

const startTimingSegmentDrag = (
  event: PointerEvent,
  segmentIndex: number,
  startSeconds: number
): void => {
  if (event.button !== 0) return;
  event.preventDefault();
  selectedTimingSegmentIndex.value = segmentIndex;
  timingSegmentDrag.segmentIndex = segmentIndex;
  timingSegmentDrag.startX = event.clientX;
  timingSegmentDrag.startSeconds = startSeconds;
  timingSegmentDrag.deltaX = 0;
  document.body.style.cursor = "move";
  window.addEventListener("pointermove", handleTimingSegmentDragMove);
  window.addEventListener("pointerup", stopTimingSegmentDrag);
};

const handleTimingSegmentDragMove = (event: PointerEvent): void => {
  if (timingSegmentDrag.segmentIndex === null) return;
  timingSegmentDrag.deltaX = event.clientX - timingSegmentDrag.startX;
};

const stopTimingSegmentDrag = (event?: PointerEvent): void => {
  const segmentIndex = timingSegmentDrag.segmentIndex;
  if (segmentIndex !== null && event) {
    const deltaSeconds = timingSegmentDrag.deltaX / safeTimelineZoom.value;
    void updateNarrationTiming(
      selectedSectionIndex.value,
      segmentIndex,
      timingSegmentDrag.startSeconds + deltaSeconds
    );
  }
  timingSegmentDrag.segmentIndex = null;
  timingSegmentDrag.startX = 0;
  timingSegmentDrag.startSeconds = 0;
  timingSegmentDrag.deltaX = 0;
  document.body.style.cursor = "";
  window.removeEventListener("pointermove", handleTimingSegmentDragMove);
  window.removeEventListener("pointerup", stopTimingSegmentDrag);
};

const handleNarrationEditFocus = (
  sectionIndex: number,
  paragraphIndex: number
): void => {
  const section = editorSections.value[sectionIndex];
  const segment = section?.finalyNarrations[paragraphIndex];
  if (!section || !segment?.isTtsGenerated) return;
  narrationEditConfirm.open = true;
  narrationEditConfirm.sectionIndex = sectionIndex;
  narrationEditConfirm.paragraphIndex = paragraphIndex;
  narrationEditConfirm.sectionTitle = section.title || `AIナレーション${sectionIndex + 1}`;
};

const confirmNarrationEdit = async (): Promise<void> => {
  const sectionIndex = narrationEditConfirm.sectionIndex;
  const paragraphIndex = narrationEditConfirm.paragraphIndex;
  const nextSections = editorSections.value.map((section, index) => {
    if (index !== sectionIndex) return section;
    return {
      ...section,
      isFixed: false,
      finalyNarrations: section.finalyNarrations.map((segment, itemIndex) => {
        if (itemIndex !== paragraphIndex) return segment;
        clearTtsSegmentPreview(section.id, itemIndex, segment);
        return {
          ...segment,
          isTtsGenerated: false,
          requestOutput: undefined,
        };
      }),
    };
  });
  await store.saveSections(nextSections);
  narrationEditConfirm.open = false;
};

const addLanguage = (): void => {
  if (!selectedLanguage.value) return;
  if (!addedLanguages.value.includes(selectedLanguage.value)) {
    addedLanguages.value = [...addedLanguages.value, selectedLanguage.value];
  }
  selectedLanguage.value = null;
  isLanguageModalOpen.value = false;
};

const saveEditorSections = async (): Promise<void> => {
  const sections = editorSections.value.map((section, index) => ({
    ...section,
    index,
    finalyNarrations: section.finalyNarrations.map((segment) => ({
      ...segment,
      characterCount: segment.rewrittenText.length,
    })),
  }));
  await store.saveSections(sections);
};

const saveAndCloseEditor = async (): Promise<void> => {
  await saveEditorSections();
  store.view = "detail";
};

const isTypingTarget = (target: EventTarget | null): boolean => {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return (
    tag === "INPUT" ||
    tag === "TEXTAREA" ||
    tag === "SELECT" ||
    target.isContentEditable
  );
};

const onEditorKeydown = (event: KeyboardEvent): void => {
  if (store.view !== "editor") return;

  if (event.key === "Escape") {
    event.preventDefault();
    event.stopImmediatePropagation();
    return;
  }

  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
    event.preventDefault();
    void saveEditorSections();
    return;
  }

  if ((event.metaKey || event.ctrlKey) && (event.key === "-" || event.key === "_")) {
    event.preventDefault();
    editorZoom.value = Math.max(50, editorZoom.value - 10);
    return;
  }

  if (
    (event.metaKey || event.ctrlKey) &&
    (event.key === "+" || event.key === "=")
  ) {
    event.preventDefault();
    editorZoom.value = Math.min(150, editorZoom.value + 10);
    return;
  }

  if (isTypingTarget(event.target)) return;

  if (isTimingPreviewActive() && selectedTimingSegmentIndex.value !== null) {
    const keyToDelta: Record<string, number> = {
      KeyD: -0.5,
      KeyK: 0.5,
      KeyF: -1,
      KeyJ: 1,
    };
    const delta = keyToDelta[event.code];
    if (delta !== undefined) {
      event.preventDefault();
      adjustNarrationTiming(
        selectedSectionIndex.value,
        selectedTimingSegmentIndex.value,
        delta
      );
      return;
    }
    if (event.code === "Enter") {
      event.preventDefault();
      selectedTimingSegmentIndex.value = null;
      return;
    }
  }

  if (event.code === "Space") {
    event.preventDefault();
    if (isRecording.value) {
      if (isRecordingPaused.value) resumeRecording();
      else pauseRecording();
      return;
    }
    togglePlay();
  }
};

const splitAtCurrentPosition = async (): Promise<void> => {
  if (!store.selectedProject) return;
  const sections = [...editorSections.value];
  const split = safeNonNegativeSeconds(currentTime.value);
  const selected = sections[selectedSectionIndex.value];
  if (selected && split > sectionStartSeconds(selected) && split < sectionEndSeconds(selected)) {
    const first: VideoStudioSection = { ...selected, endTime: split };
    const second: VideoStudioSection = {
      ...store.createDraftSection({
        index: selectedSectionIndex.value + 1,
        startTime: split,
        endTime: sectionEndSeconds(selected),
      }),
      title: `セクション ${selectedSectionIndex.value + 2}`,
    };
    sections.splice(selectedSectionIndex.value, 1, first, second);
  } else {
    sections.push(
      store.createDraftSection({
        index: sections.length,
        startTime: split,
        endTime: Math.max(split + 30, timelineDurationSeconds.value || split + 30),
      })
    );
  }
  await store.saveSections(sections.map((section, index) => ({ ...section, index })));
};

const normalizeAutoSection = (
  raw: Record<string, unknown>,
  index: number
): VideoStudioSection => {
  const startTime = Number(raw.startTime ?? raw.start_time ?? 0);
  const endTime = Number(raw.endTime ?? raw.end_time ?? startTime + 1);
  const sectionId = String(raw.sectionId || raw.section_id || raw.id || `section_${index + 1}`);
  const fallback = {
    segmentNumber: Number(raw.index ?? index),
    startTime,
    endTime,
    duration: Math.max(0, endTime - startTime),
  };
  const videoSegment = normalizeSegmentInfo(raw.videoSegment ?? raw.video_segment, fallback);
  const splitVideo = normalizeSegmentInfo(
    raw.splitVideo ?? raw.split_video ?? raw.videoSegment ?? raw.video_segment,
    fallback
  );
  const splitVideoConverted = normalizeSegmentInfo(
    raw.splitVideoConverted ??
      raw.split_video_converted ??
      raw.convertedSplitVideo ??
      raw.converted_split_video,
    fallback
  );
  const audioSegment = normalizeSegmentInfo(raw.audioSegment ?? raw.audio_segment, fallback);
  return {
    id: sectionId,
    index,
    title: String(raw.title || `セクション ${index + 1}`),
    startTime,
    endTime,
    videoSegment,
    splitVideo,
    splitVideoConverted,
    audioSegment,
    finalyNarrations: [],
    isFixed: false,
  };
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

const toFiniteNumber = (value: unknown, fallback = 0): number => {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : fallback;
};

const normalizeSegmentInfo = (
  raw: unknown,
  fallback: {
    segmentNumber: number;
    startTime: number;
    endTime: number;
    duration: number;
  }
): NonNullable<VideoStudioSection["videoSegment"]> => {
  const value = isRecord(raw) ? raw : {};
  const rawPath =
    typeof raw === "string"
      ? raw
      : value.gcsFilePath ??
        value.gcs_file_path ??
        value.gcsPath ??
        value.gcs_path ??
        value.filePath ??
        value.file_path ??
        value.storagePath ??
        value.storage_path ??
        value.path ??
        value.uri ??
        "";
  const parsedPath = parseGcsPath(rawPath);
  return {
    bucketName: String(
      value.bucketName ??
        value.bucket_name ??
        value.gcsBucketName ??
        value.gcs_bucket_name ??
        value.storageBucket ??
        value.storage_bucket ??
        parsedPath?.bucketName ??
        ""
    ),
    gcsFilePath: parsedPath?.filePath ?? "",
    segmentNumber: toFiniteNumber(value.segmentNumber ?? value.segment_number, fallback.segmentNumber),
    startTime: toFiniteNumber(value.startTime ?? value.start_time, fallback.startTime),
    endTime: toFiniteNumber(value.endTime ?? value.end_time, fallback.endTime),
    duration: toFiniteNumber(value.duration ?? value.duration_seconds, fallback.duration),
    sizeBytes: toFiniteNumber(value.sizeBytes ?? value.size_bytes, 0),
  };
};

const makeAutoSectionLog = (
  type: "info" | "warning" | "error",
  message: string,
  timestamp?: Timestamp,
  index = Date.now()
): { id: string; time: string; type: "info" | "warning" | "error"; message: string } => {
  const date = timestamp?.toDate?.() ?? new Date();
  return {
    id: `${index}-${date.getTime()}-${message}`,
    time: date.toLocaleTimeString("ja-JP", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }),
    type,
    message,
  };
};

const statusText = (status?: string): string => {
  switch (status) {
    case "processing":
      return "処理中";
    case "completed":
      return "完了";
    case "error":
      return "エラー";
    default:
      return "待機中";
  }
};

function parseGcsPath(value: unknown): { bucketName: string; filePath: string } | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const match = value.match(/^gs:\/\/([^/]+)\/(.+)$/);
  if (match?.[1] && match[2]) {
    return { bucketName: match[1], filePath: match[2] };
  }
  return { bucketName: store.defaultBucket, filePath: value };
}

const createWorkflowRequestDoc = async (
  type: RequestDocType,
  input: Record<string, unknown>,
  requestId?: string
): Promise<string> =>
  store.createRequestDoc({
    type,
    input,
    requestId,
  });

const waitForRequestDoc = (
  type: RequestDocType,
  requestId: string,
  timeoutMs = 1000 * 60 * 20
): Promise<RequestDocSnapshot> =>
  new Promise((resolve, reject) => {
    const db = getFirestore();
    const path = `organizations/${store.organizationId}/spaces/${store.spaceId}/requests/${type}/logs/${requestId}`;
    const timeout = window.setTimeout(() => {
      unsubscribe();
      reject(new Error(`${type} ${requestId} がタイムアウトしました。`));
    }, timeoutMs);
    const unsubscribe = onSnapshot(
      doc(db, path),
      (snapshot) => {
        const data = snapshot.data() as RequestDocSnapshot | undefined;
        if (!data) return;
        if (data.status === "completed") {
          window.clearTimeout(timeout);
          unsubscribe();
          resolve(data);
          return;
        }
        if (data.status === "error") {
          window.clearTimeout(timeout);
          unsubscribe();
          reject(new Error(data.errorMessage || `${type} ${requestId} が失敗しました。`));
        }
      },
      (error) => {
        window.clearTimeout(timeout);
        reject(error);
      }
    );
  });

function extractStorageOutputPath(
  output: Record<string, unknown> | undefined,
  options: {
    preferredNestedKey?: string;
    bucketKeys?: string[];
    filePathKeys?: string[];
  } = {}
): StorageOutputPath | null {
  if (!output) return null;
  const nestedKey = options.preferredNestedKey;
  const nested = nestedKey ? output[nestedKey] : null;
  if (isRecord(nested)) {
    const bucketName = String(nested.bucketName ?? nested.resultBucketName ?? "");
    const filePath = String(nested.filePath ?? nested.resultFilePath ?? "");
    if (bucketName && filePath) return { bucketName, filePath };
  }

  const wrappedOutput = output.output;
  if (isRecord(wrappedOutput)) {
    const wrapped = extractStorageOutputPath(wrappedOutput, options);
    if (wrapped) return wrapped;
  }

  const bucketKeys = options.bucketKeys ?? ["resultBucketName", "bucketName", "outputBucketName"];
  const filePathKeys = options.filePathKeys ?? ["resultFilePath", "filePath", "outputFilePath"];
  const bucketName = bucketKeys.map((key) => output[key]).find((value) => typeof value === "string" && value);
  const filePath = filePathKeys.map((key) => output[key]).find((value) => typeof value === "string" && value);
  if (typeof bucketName === "string" && typeof filePath === "string") {
    return { bucketName, filePath };
  }
  return null;
}

const removeUndefinedFields = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map((item) => removeUndefinedFields(item));
  }
  if (!isRecord(value)) return value;
  return Object.fromEntries(
    Object.entries(value)
      .filter(([, itemValue]) => itemValue !== undefined)
      .map(([key, itemValue]) => [key, removeUndefinedFields(itemValue)])
  );
};

const updateProjectOutput = async (output: Record<string, unknown>): Promise<void> => {
  const project = store.selectedProject;
  if (!project) return;
  await store.updateProject(project.videoId, project.id, {
    mergedVideoOutput: removeUndefinedFields(output) as Record<string, unknown>,
    latestExportedAt: Timestamp.now(),
    currentStep: "subtitle",
    completedSteps: Array.from(new Set([...project.completedSteps, "export"])),
  });
};

const getSectionVideoForMerge = (
  section: VideoStudioSection
): { bucketName: string; filePath: string } | null => {
  return sectionVideoSourceInfo(section);
};

const buildAudioSegmentsForEditorSection = (
  section: VideoStudioSection
): AudioSegmentInput[] =>
  section.finalyNarrations.flatMap((narration, index) => {
    const outputPath = narration.requestOutput?.outputPath;
    const parsed = parseGcsPath(outputPath);
    if (!parsed) return [];
    const startSeconds =
      typeof narration.startSeconds === "number" ? narration.startSeconds : index === 0 ? 0 : null;
    const previousSegments = section.finalyNarrations.slice(0, index);
    const fallbackStart = previousSegments.reduce((total, item) => {
      const duration = Number(item.requestOutput?.durationSeconds ?? 0);
      return total + (Number.isFinite(duration) ? duration : 0);
    }, 0);
    return [
      {
        sourceBucketName: parsed.bucketName,
        sourceFilePath: parsed.filePath,
        timestampMs: Math.max(0, Math.round((startSeconds ?? fallbackStart) * 1000)),
      },
    ];
  });

const persistNarrationTtsOutput = async (
  sectionId: string,
  segmentIndex: number,
  output: Record<string, unknown>
): Promise<void> => {
  const previousSegment = editorSections.value
    .find((section) => section.id === sectionId)
    ?.finalyNarrations[segmentIndex];
  clearTtsSegmentPreview(sectionId, segmentIndex, previousSegment);
  const sections = editorSections.value.map((section) => {
    if (section.id !== sectionId) return section;
    return {
      ...section,
      isFixed: false,
      finalyNarrations: section.finalyNarrations.map((segment, index) =>
        index === segmentIndex
          ? {
              ...segment,
              requestOutput: output,
              isTtsGenerated: true,
            }
          : segment
      ),
    };
  });
  await store.saveSections(sections);
  void hydrateTtsWaveforms();
};

const ttsSegmentKey = (sectionId: string, segmentIndex: number): string =>
  `${sectionId}:${segmentIndex}`;

const setTtsSegmentProcessing = (
  sectionId: string,
  segmentIndex: number,
  isProcessing: boolean
): void => {
  const key = ttsSegmentKey(sectionId, segmentIndex);
  activeTtsRequestKeys.value = isProcessing
    ? { ...activeTtsRequestKeys.value, [key]: true }
    : Object.fromEntries(
        Object.entries(activeTtsRequestKeys.value).filter(([itemKey]) => itemKey !== key)
      );
};

const isTtsSegmentProcessing = (
  sectionId: string,
  segmentIndex: number
): boolean => Boolean(activeTtsRequestKeys.value[ttsSegmentKey(sectionId, segmentIndex)]);

function ttsSegmentOutputPath(
  segment: VideoStudioSection["finalyNarrations"][number]
): string {
  return String(segment.requestOutput?.outputPath ?? "");
}

const formatTtsDuration = (
  segment: VideoStudioSection["finalyNarrations"][number]
): string => {
  const durationSeconds = Number(segment.requestOutput?.durationSeconds ?? segment.endSeconds ?? 0);
  return durationSeconds > 0 ? formatDuration(durationSeconds) : "0:00";
};

const clearTtsSegmentPreview = (
  sectionId: string,
  segmentIndex: number,
  segment?: VideoStudioSection["finalyNarrations"][number]
): void => {
  const key = ttsSegmentKey(sectionId, segmentIndex);
  if (playingTtsKey.value === key) {
    ttsPreviewAudio?.pause();
    playingTtsKey.value = null;
  }
  const outputPath = segment ? ttsSegmentOutputPath(segment) : "";
  if (!outputPath) return;
  ttsAudioUrlCache.value = Object.fromEntries(
    Object.entries(ttsAudioUrlCache.value).filter(([itemKey]) => itemKey !== outputPath)
  );
  ttsWaveformCache.value = Object.fromEntries(
    Object.entries(ttsWaveformCache.value).filter(([itemKey]) => itemKey !== outputPath)
  );
};

const voicePreviewPath = (voiceName: string): string => {
  const project = store.selectedProject;
  const video = store.selectedVideo;
  if (!project || !video) return "";
  return `organizations/${store.organizationId}/spaces/${store.spaceId}/videos/${video.id}/narrationProjects/${project.id}/voicePreviews/ja/${voiceName}.mp3`;
};

const voiceAvatarClass = (color: TtsVoiceOption["color"]): string => {
  const classes: Record<TtsVoiceOption["color"], string> = {
    blue: "bg-blue-500/20 text-blue-200 ring-1 ring-blue-400/30",
    gray: "bg-gray-500/20 text-gray-200 ring-1 ring-gray-400/30",
    green: "bg-emerald-500/20 text-emerald-200 ring-1 ring-emerald-400/30",
    pink: "bg-pink-500/20 text-pink-200 ring-1 ring-pink-400/30",
    purple: "bg-purple-500/20 text-purple-200 ring-1 ring-purple-400/30",
    yellow: "bg-yellow-500/20 text-yellow-100 ring-1 ring-yellow-300/30",
    indigo: "bg-indigo-500/20 text-indigo-200 ring-1 ring-indigo-400/30",
  };
  return classes[color];
};

const setVoicePreviewLoading = (voiceName: string, isLoading: boolean): void => {
  voicePreviewLoadingMap.value = isLoading
    ? { ...voicePreviewLoadingMap.value, [voiceName]: true }
    : Object.fromEntries(
        Object.entries(voicePreviewLoadingMap.value).filter(([key]) => key !== voiceName)
      );
};

const stopVoicePreview = (): void => {
  voicePreviewAudio?.pause();
  voicePreviewAudio = null;
  playingVoiceName.value = null;
};

const openVoiceSelectorModal = (): void => {
  isVoiceSelectorModalOpen.value = true;
};

const closeVoiceSelectorModal = (): void => {
  stopVoicePreview();
  isVoiceSelectorModalOpen.value = false;
};

const ensureVoicePreviewUrl = async (voiceName: string): Promise<string | null> => {
  const cached = voicePreviewUrlCache.value[voiceName];
  if (cached) return cached;
  const path = voicePreviewPath(voiceName);
  if (!path) return null;

  try {
    const existingUrl = await store.resolveStorageUrl(path);
    voicePreviewUrlCache.value = {
      ...voicePreviewUrlCache.value,
      [voiceName]: existingUrl,
    };
    return existingUrl;
  } catch {
    // Missing previews are generated on demand.
  }

  const project = store.selectedProject;
  if (!project) return null;
  setVoicePreviewLoading(voiceName, true);
  try {
    const requestId = `voice_preview_${project.id}_${voiceName}_${Date.now()}`;
    await createWorkflowRequestDoc(
      "textToSpeechRequests",
      {
        text: "こんにちは。EN AI Studioの読み上げ音声サンプルです。",
        voiceName,
        outputBucketName: store.defaultBucket,
        outputFilePath: path,
        projectId: project.id,
        purpose: "voice_preview",
      },
      requestId
    );
    await waitForRequestDoc("textToSpeechRequests", requestId, 1000 * 60 * 3);
    const url = await store.resolveStorageUrl(path);
    voicePreviewUrlCache.value = {
      ...voicePreviewUrlCache.value,
      [voiceName]: url,
    };
    return url;
  } catch (error) {
    reportDatadogError(error, {
      feature: "video_studio",
      operation: "voice_preview",
      voiceName,
    });
    toast.add({
      title: "音声サンプルの生成に失敗しました",
      color: "error",
    });
    return null;
  } finally {
    setVoicePreviewLoading(voiceName, false);
  }
};

const playVoicePreview = async (voiceName: string): Promise<void> => {
  const url = await ensureVoicePreviewUrl(voiceName);
  if (!url) return;
  stopVoicePreview();
  const audio = new Audio(url);
  audio.volume = 0.85;
  voicePreviewAudio = audio;
  playingVoiceName.value = voiceName;
  audio.addEventListener("ended", stopVoicePreview, { once: true });
  audio.addEventListener("error", stopVoicePreview, { once: true });
  await audio.play().catch((error) => {
    stopVoicePreview();
    reportDatadogError(error, {
      feature: "video_studio",
      operation: "play_voice_preview",
      voiceName,
    });
  });
};

const selectVoiceName = async (voiceName: string): Promise<void> => {
  const project = store.selectedProject;
  if (!project || project.voiceName === voiceName) {
    isVoiceSelectorModalOpen.value = false;
    return;
  }
  stopVoicePreview();
  await store.updateProject(project.videoId, project.id, { voiceName });
  toast.add({
    title: "読み上げ音声を変更しました",
    description: `${voiceName} は次回のAI音声生成から反映されます。`,
    color: "success",
  });
  isVoiceSelectorModalOpen.value = false;
};

const requestSingleTts = async (
  sectionId: string,
  segmentIndex: number
): Promise<boolean> => {
  const project = store.selectedProject;
  const video = store.selectedVideo;
  const section = editorSections.value.find((item) => item.id === sectionId);
  const segment = section?.finalyNarrations[segmentIndex];
  const text = (segment?.rewrittenText || segment?.originalText || "").trim();
  if (!project || !video || !section || !segment || !text) return false;
  if (isTtsSegmentProcessing(section.id, segmentIndex)) return false;
  await saveEditorSections();
  setTtsSegmentProcessing(section.id, segmentIndex, true);
  requestNotice.value = null;
  toast.add({
    title: "AI音声生成を開始しました",
    description: `${section.title || "選択中セクション"} / AIナレーション${segmentIndex + 1}`,
    color: "info",
  });
  try {
    const requestId = `tts_${project.id}_${section.id}_${segmentIndex}_${Date.now()}`;
    const outputFilePath = getTtsAudioStoragePath({
      organizationId: store.organizationId,
      spaceId: store.spaceId,
      videoId: video.id,
      projectId: project.id,
      sectionId: section.id,
      segmentIndex,
    });
    await createWorkflowRequestDoc(
      "textToSpeechRequests",
      {
        text,
        voiceName: project.voiceName || "Puck",
        outputBucketName: store.defaultBucket,
        outputFilePath,
        projectId: project.id,
        projectName: project.name,
        videoId: video.id,
        videoTitle: video.title,
        sectionId: section.id,
        sectionTitle: section.title,
        segmentIndex,
      },
      requestId
    );
    const result = await waitForRequestDoc("textToSpeechRequests", requestId);
    if (!result.output?.outputPath || Number(result.output.durationSeconds ?? 0) <= 0) {
      throw new Error(`AI音声生成の出力が不完全です: ${requestId}`);
    }
    await persistNarrationTtsOutput(section.id, segmentIndex, result.output);
    toast.add({
      title: "AI音声生成が完了しました",
      description: `${section.title || "選択中セクション"} / AIナレーション${segmentIndex + 1}`,
      color: "success",
    });
    return true;
  } catch (error) {
    toast.add({
      title: "AI音声生成に失敗しました",
      description: error instanceof Error ? error.message : undefined,
      color: "error",
    });
    return false;
  } finally {
    setTtsSegmentProcessing(section.id, segmentIndex, false);
  }
};

const requestBulkTts = async (): Promise<void> => {
  if (isBulkTtsProcessing.value) return;
  const targets = editorSections.value.flatMap((section) =>
    section.finalyNarrations
      .map((segment, segmentIndex) => ({
        sectionId: section.id,
        segmentIndex,
        text: (segment.rewrittenText || segment.originalText || "").trim(),
        hasOutput: segment.isTtsGenerated && Boolean(ttsSegmentOutputPath(segment)),
      }))
      .filter((target) => target.text && !target.hasOutput)
  );
  if (targets.length === 0) {
    requestNotice.value = {
      kind: "success",
      message: "すべてのAI音声が生成済みです。",
    };
    return;
  }
  isBulkTtsProcessing.value = true;
  requestNotice.value = {
    kind: "success",
    message: `${targets.length}件のAI音声生成を開始しました。`,
  };
  try {
    let successCount = 0;
    for (const target of targets) {
      const succeeded = await requestSingleTts(target.sectionId, target.segmentIndex);
      if (succeeded) successCount += 1;
    }
    requestNotice.value = {
      kind: successCount === targets.length ? "success" : "error",
      message:
        successCount === targets.length
          ? "未生成だったAI音声をすべて生成しました。"
          : `${successCount}/${targets.length}件のAI音声生成が完了しました。失敗した項目は個別に再実行してください。`,
    };
  } finally {
    isBulkTtsProcessing.value = false;
  }
};

const requestExport = async (): Promise<void> => {
  const project = store.selectedProject;
  const video = store.selectedVideo;
  if (!project || !video) return;
  if (!allNarrationSectionsFixed.value) {
    requestNotice.value = {
      kind: "error",
      message: "動画出力前に、すべてのセクションのAIナレーション編集を確定してください。",
    };
    return;
  }
  await saveEditorSections();
  activeRequest.value = "export";
  resetExportProgress();
  requestNotice.value = { kind: "success", message: "動画出力を開始しています..." };
  exportProgress.message = "セクション動画の合成準備をしています。";
  try {
    const sectionOutputs: Array<{ bucketName: string; filePath: string }> = [];
    for (const [sectionIndex, section] of editorSections.value.entries()) {
      const progressKey = `section-${sectionIndex}`;
      setExportProgressItemStatus(progressKey, "running");
      exportProgress.message = `${section.title || `セクション ${sectionIndex + 1}`} を合成しています。`;
      const sectionVideo = getSectionVideoForMerge(section);
      if (!sectionVideo) {
        setExportProgressItemStatus(progressKey, "error");
        throw new Error(`セクション${sectionIndex + 1}の分割動画が見つかりません。`);
      }
      const audioSegments = buildAudioSegmentsForEditorSection(section);
      if (audioSegments.length === 0) {
        sectionOutputs.push(sectionVideo);
        setExportProgressItemStatus(progressKey, "skipped");
        continue;
      }

      const requestId = `merge_${project.id}_section_${sectionIndex}_${Date.now()}`;
      const outputFilePath = getMergedVideoStoragePath({
        organizationId: store.organizationId,
        spaceId: store.spaceId,
        videoId: video.id,
        projectId: project.id,
        fileName: `section_${sectionIndex}_merged_${Date.now()}.mp4`,
      });
      await createWorkflowRequestDoc(
        "mergeVideoAudioNarrationRequests",
        {
          videoBucketName: sectionVideo.bucketName,
          videoFilePath: sectionVideo.filePath,
          videoId: video.id,
          projectId: project.id,
          projectName: project.name,
          videoTitle: video.title,
          sectionId: section.id,
          sectionIndex,
          sectionTitle: section.title,
          audioSegments,
          outputBucketName: store.defaultBucket,
          outputFilePath,
        },
        requestId
      );
      requestNotice.value = {
        kind: "success",
        message: `セクション動画を合成中... ${sectionIndex + 1}/${editorSections.value.length}`,
      };
      const result = await waitForRequestDoc("mergeVideoAudioNarrationRequests", requestId);
      const output = result.output ?? {};
      const mergedOutput = extractStorageOutputPath(output, {
        preferredNestedKey: "mergedVideoPath",
      });
      if (!mergedOutput) {
        setExportProgressItemStatus(progressKey, "error");
        throw new Error(`セクション${sectionIndex + 1}の合成出力が不完全です。`);
      }
      sectionOutputs.push(mergedOutput);
      const nextSections = editorSections.value.map((item, index) =>
        index === sectionIndex
          ? {
              ...item,
              mergedVideoOutput: {
                resultBucketName: mergedOutput.bucketName,
                resultFilePath: mergedOutput.filePath,
                processingTime: Number(output.processingTime ?? 0),
                ...(isRecord(output.statistics) ? { statistics: output.statistics } : {}),
                requestId,
              },
            }
          : item
      );
      await store.saveSections(nextSections);
      setExportProgressItemStatus(progressKey, "completed");
      if (selectedExportSectionIndex.value === sectionIndex) {
        void refreshExportSectionPreview();
      }
    }

    setExportProgressItemStatus("final", "running");
    exportProgress.message = "すべてのセクションを最終動画へ連結しています。";
    const concatenateRequestId = `concatenate_${video.id}_${Date.now()}`;
    const finalOutputFilePath = getMergedVideoStoragePath({
      organizationId: store.organizationId,
      spaceId: store.spaceId,
      videoId: video.id,
      projectId: project.id,
      fileName: `final_merged_${Date.now()}.mp4`,
    });
    await createWorkflowRequestDoc(
      "concatenateSectionVideosRequests",
      {
        sectionVideoPaths: sectionOutputs,
        outputBucketName: store.defaultBucket,
        outputFilePath: finalOutputFilePath,
        videoId: video.id,
        projectId: project.id,
        projectName: project.name,
        videoTitle: video.title,
      },
      concatenateRequestId
    );
    requestNotice.value = {
      kind: "success",
      message: "最終動画を連結中...",
    };
    const finalResult = await waitForRequestDoc(
      "concatenateSectionVideosRequests",
      concatenateRequestId
    );
    const finalStoragePath = extractStorageOutputPath(finalResult.output, {
      preferredNestedKey: "mergedVideoPath",
    });
    if (!finalStoragePath) {
      setExportProgressItemStatus("final", "error");
      throw new Error("最終動画の出力パスが返ってきませんでした。");
    }
    const finalOutput = {
      resultBucketName: finalStoragePath.bucketName,
      resultFilePath: finalStoragePath.filePath,
      processingTime: Number(finalResult.output?.processingTime ?? 0),
      requestId: concatenateRequestId,
      assets: buildExportAssets(finalStoragePath).map((asset) => ({
        key: asset.key,
        kind: asset.kind,
        label: asset.label,
        description: asset.description,
        bucketName: asset.bucketName,
        filePath: asset.filePath,
        fileName: asset.fileName,
        ...(typeof asset.sectionIndex === "number" ? { sectionIndex: asset.sectionIndex } : {}),
        ...(typeof asset.segmentIndex === "number" ? { segmentIndex: asset.segmentIndex } : {}),
      })),
    };
    if (!finalOutput.resultBucketName || !finalOutput.resultFilePath) {
      setExportProgressItemStatus("final", "error");
      throw new Error("最終動画の出力情報が不完全です。");
    }
    await updateProjectOutput(finalOutput);
    setExportProgressItemStatus("final", "completed");
    exportProgress.message = "最終動画の書き出しが完了しました。";
    exportReviewTab.value = "assets";
    requestNotice.value = {
      kind: "success",
      message: "最終動画の書き出しが完了しました。",
    };
  } catch (error) {
    exportProgress.message = error instanceof Error ? error.message : "最終動画の書き出しに失敗しました。";
    requestNotice.value = {
      kind: "error",
      message: error instanceof Error ? error.message : "最終動画の書き出しに失敗しました。",
    };
  } finally {
    activeRequest.value = null;
  }
};

const syncCurrentTime = (): void => {
  currentTime.value = safeNonNegativeSeconds(editorVideo.value?.currentTime);
  isPlaying.value = !editorVideo.value?.paused;
  if (isTimingPreviewActive()) {
    void syncTimingNarrationAudio({ play: isPlaying.value });
    return;
  }
  if (isPlaying.value && !isRecording.value && !isPreparingRecording.value) {
    void syncRecordingPlaybackAudio({ play: true });
  }
};

const syncDuration = (): void => {
  const videoDuration = editorVideo.value?.duration;
  if (Number.isFinite(videoDuration) && Number(videoDuration) > 0) {
    duration.value = Number(videoDuration);
  }
};

const handleEditorVideoPlay = (): void => {
  syncCurrentTime();
  if (isTimingPreviewActive()) {
    void syncTimingNarrationAudio({ play: true, force: true });
    return;
  }
  if (
    isRecording.value &&
    isRecordingPaused.value &&
    mediaRecorder?.state === "paused"
  ) {
    resumeRecording();
    return;
  }
  void syncRecordingPlaybackAudio({ play: true });
};

const handleEditorVideoPause = (): void => {
  syncCurrentTime();
  if (isTimingPreviewActive()) {
    pauseTimingNarrationAudio();
    return;
  }
  pauseRecordingPlaybackAudio();
  if (
    isRecording.value &&
    !isSavingRecording.value &&
    !isRecordingPaused.value &&
    mediaRecorder?.state === "recording"
  ) {
    mediaRecorder.pause();
    isRecordingPaused.value = true;
    recordingPausedStartedAt.value = Date.now();
    audioLevel.value = 0;
  }
};

const handleEditorVideoEnded = (): void => {
  syncCurrentTime();
  pauseTimingNarrationAudio();
  pauseRecordingPlaybackAudio();
  if (isRecording.value && !isSavingRecording.value) {
    void stopRecording();
  }
};

const isTimingPreviewActive = (): boolean =>
  store.view === "editor" &&
  isAiNarrationStep.value &&
  aiNarrationMode.value === "timing";

const pauseTimingNarrationAudio = (): void => {
  timingPlaybackAudio.value?.pause();
};

const syncTimingNarrationAudio = async (
  options: { play?: boolean; force?: boolean } = {}
): Promise<void> => {
  const video = editorVideo.value;
  const audio = timingPlaybackAudio.value;
  const section = selectedSectionForRecording.value;
  if (!video || !audio || !section || !isTimingPreviewActive()) return;

  const relativeTime = Math.max(0, safeNonNegativeSeconds(video.currentTime) - sectionStartSeconds(section));
  const segment = selectedNarrationTimingSegments.value.find((item) => {
    const end = item.startSeconds + item.durationSeconds;
    return relativeTime >= item.startSeconds && relativeTime < end;
  });

  if (!segment || !segment.model.isTtsGenerated) {
    if (timingPlaybackActiveKey !== null) {
      audio.pause();
      audio.removeAttribute("src");
      timingPlaybackActiveKey = null;
    }
    return;
  }

  const segmentKey = ttsSegmentKey(section.id, segment.index);
  const token = ++timingPlaybackSyncToken;
  const url = await resolveTtsAudioUrl(segment.model);
  if (token !== timingPlaybackSyncToken || !url) return;
  const segmentChanged = timingPlaybackActiveKey !== segmentKey;
  if (segmentChanged || audio.src !== url) {
    audio.src = url;
    audio.preload = "auto";
    audio.load();
    timingPlaybackActiveKey = segmentKey;
  }

  const targetTime = Math.max(
    0,
    Math.min(segment.durationSeconds, relativeTime - segment.startSeconds)
  );
  const now = performance.now();
  const drift = Math.abs(audio.currentTime - targetTime);
  const shouldCorrect =
    options.force ||
    segmentChanged ||
    audio.paused ||
    (drift > 0.65 && now - timingPlaybackLastCorrectionAt > 900);
  if (shouldCorrect) {
    audio.currentTime = targetTime;
    timingPlaybackLastCorrectionAt = now;
  }

  if (options.play && !video.paused) {
    await audio.play().catch(() => {
      // The video preview remains useful even if the browser blocks auxiliary audio.
    });
  }
};

const seekTo = (time: number): void => {
  if (!editorVideo.value) return;
  const safeTime = safeNonNegativeSeconds(time);
  const maxDuration = safeNonNegativeSeconds(editorVideo.value.duration, timelineDurationSeconds.value || safeTime);
  editorVideo.value.currentTime = Math.max(0, Math.min(safeTime, maxDuration || safeTime));
  currentTime.value = safeNonNegativeSeconds(editorVideo.value.currentTime, safeTime);
  if (isTimingPreviewActive()) {
    void syncTimingNarrationAudio({ play: !editorVideo.value.paused, force: true });
  } else {
    void syncRecordingPlaybackAudio({ play: !editorVideo.value.paused });
  }
};

const seekBy = (delta: number): void => {
  seekTo(safeNonNegativeSeconds(currentTime.value) + safeFiniteNumber(delta));
};

const selectSection = (index: number): void => {
  const section = editorSections.value[index];
  if (!section) return;
  selectedSectionIndex.value = index;
  if (isRecording.value || isPreparingRecording.value) return;
  seekTo(sectionStartSeconds(section));
};

const timelineTimeFromPointer = (event: PointerEvent): number | null => {
  const element = timelineContainer.value;
  if (!element) return null;
  const rect = element.getBoundingClientRect();
  if (rect.width <= 0) return null;
  const localX = Math.max(0, Math.min(event.clientX - rect.left, rect.width));
  const unscaledX = (localX / rect.width) * timelineWidth.value;
  const maxTime = timelineDurationSeconds.value;
  return Math.max(0, Math.min(unscaledX / safeTimelineZoom.value, maxTime || 0));
};

const selectSectionAtTime = (time: number): void => {
  const safeTime = safeNonNegativeSeconds(time);
  const index = editorSections.value.findIndex(
    (section) => safeTime >= sectionStartSeconds(section) && safeTime <= sectionEndSeconds(section)
  );
  if (index >= 0) selectedSectionIndex.value = index;
};

const sectionAtPlaybackTime = (time: number): VideoStudioSection | null =>
  editorSections.value.find(
    (section) => safeNonNegativeSeconds(time) >= sectionStartSeconds(section) && safeNonNegativeSeconds(time) < sectionEndSeconds(section)
  ) ?? null;

const pauseRecordingPlaybackAudio = (): void => {
  const audio = recordingPlaybackAudio.value;
  if (!audio) return;
  audio.pause();
};

const syncRecordingPlaybackAudio = async (
  options: { play?: boolean } = {}
): Promise<void> => {
  const video = editorVideo.value;
  const audio = recordingPlaybackAudio.value;
  if (!video || !audio) return;
  if (isRecording.value || isPreparingRecording.value) {
    pauseRecordingPlaybackAudio();
    return;
  }

  const section = sectionAtPlaybackTime(video.currentTime);
  if (!section?.recording?.audioFilePath) {
    pauseRecordingPlaybackAudio();
    audio.removeAttribute("src");
    return;
  }

  const syncToken = ++recordingPlaybackSyncToken;
  const audioUrl = await resolveRecordingAudioUrl(section);
  if (syncToken !== recordingPlaybackSyncToken || !audioUrl) return;
  if (audio.src !== audioUrl) {
    audio.src = audioUrl;
    audio.load();
  }

  const targetTime = Math.max(
    0,
    Math.min(
      safeNonNegativeSeconds(section.recording.durationSeconds, sectionDurationSeconds(section)),
      safeNonNegativeSeconds(video.currentTime) - sectionStartSeconds(section)
    )
  );
  if (Math.abs(audio.currentTime - targetTime) > 0.18) {
    audio.currentTime = targetTime;
  }

  if (options.play && !video.paused) {
    await audio.play().catch(() => {
      // The video keeps playing even if the browser blocks auxiliary audio.
    });
  }
};

const seekToPointerTime = (event: PointerEvent): void => {
  const time = timelineTimeFromPointer(event);
  if (time === null) return;
  seekTo(time);
  selectSectionAtTime(time);
};

const handleTimelinePointerDown = (event: PointerEvent): void => {
  if ((event.target as HTMLElement | null)?.closest("button")) return;
  isDraggingPlayhead.value = true;
  timelineContainer.value?.setPointerCapture(event.pointerId);
  seekToPointerTime(event);
};

const handlePlayheadPointerDown = (event: PointerEvent): void => {
  isDraggingPlayhead.value = true;
  timelineContainer.value?.setPointerCapture(event.pointerId);
  seekToPointerTime(event);
};

const handleTimelinePointerMove = (event: PointerEvent): void => {
  if (!isDraggingPlayhead.value) return;
  seekToPointerTime(event);
};

const handleTimelinePointerUp = (event: PointerEvent): void => {
  if (!isDraggingPlayhead.value) return;
  isDraggingPlayhead.value = false;
  if (timelineContainer.value?.hasPointerCapture(event.pointerId)) {
    timelineContainer.value.releasePointerCapture(event.pointerId);
  }
};

const waitForVideoEvent = (
  video: HTMLVideoElement,
  eventName: "loadedmetadata" | "loadeddata" | "seeked" | "error",
  timeoutMs = 8000
): Promise<void> =>
  new Promise((resolve, reject) => {
    let timeoutId: number | null = null;
    const cleanup = (): void => {
      if (timeoutId !== null) window.clearTimeout(timeoutId);
      video.removeEventListener(eventName, onEvent);
      video.removeEventListener("error", onError);
    };
    const onEvent = (): void => {
      cleanup();
      resolve();
    };
    const onError = (): void => {
      cleanup();
      reject(new Error("動画フレームの取得に失敗しました"));
    };
    video.addEventListener(eventName, onEvent, { once: true });
    if (eventName !== "error") video.addEventListener("error", onError, { once: true });
    timeoutId = window.setTimeout(() => {
      cleanup();
      reject(new Error(`動画フレームの取得がタイムアウトしました: ${eventName}`));
    }, timeoutMs);
  });

const waitForVideoFramePaint = async (video: HTMLVideoElement): Promise<void> => {
  if ("requestVideoFrameCallback" in video) {
    await new Promise<void>((resolve) => {
      let resolved = false;
      const finish = (): void => {
        if (resolved) return;
        resolved = true;
        resolve();
      };
      const timeoutId = window.setTimeout(finish, 500);
      video.requestVideoFrameCallback(() => {
        window.clearTimeout(timeoutId);
        finish();
      });
    });
    return;
  }
  await new Promise<void>((resolve) => window.setTimeout(resolve, 80));
};

const makeTimelineVideoFragmentUrl = (url: string, time: number): string => {
  const [base] = url.split("#");
  return `${base}#t=${Math.max(0, time).toFixed(2)}`;
};

const fallbackTimelineThumbnail = (
  url: string,
  time: number
): TimelineThumbnail => ({
  kind: "video",
  url: makeTimelineVideoFragmentUrl(url, time),
  time,
});

const captureVideoFrame = async (
  video: HTMLVideoElement,
  time: number
): Promise<TimelineThumbnail> => {
  const safeTime = Math.max(0, Math.min(time, Math.max(0, (video.duration || time) - 0.03)));
  if (Math.abs(video.currentTime - safeTime) > 0.05) {
    const seeked = waitForVideoEvent(video, "seeked");
    video.currentTime = safeTime;
    await seeked;
  }
  await waitForVideoFramePaint(video);
  const canvas = document.createElement("canvas");
  canvas.width = 240;
  canvas.height = 135;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas context is unavailable");
  context.drawImage(video, 0, 0, canvas.width, canvas.height);
  return {
    kind: "image",
    url: canvas.toDataURL("image/jpeg", 0.64),
  };
};

const resolveTimelineThumbnailSource = async (
  section: VideoStudioSection
): Promise<TimelineThumbnailSource | null> => {
  thumbnailDebugLog("resolve_source:start", {
    sectionId: section.id,
    title: section.title,
    startTime: section.startTime,
    endTime: section.endTime,
    usesOriginalVideoAudio: usesOriginalVideoAudio.value,
    selectedVideoUrlReady: Boolean(store.selectedVideoUrl),
    selectedVideoStoragePath:
      store.selectedVideo?.convertedStoragePath ||
      store.selectedVideo?.originalStoragePath ||
      store.selectedVideo?.storagePath ||
      "",
    audioSegmentPath: section.audioSegment?.gcsFilePath ?? "",
    splitVideoConvertedPath: section.splitVideoConverted?.gcsFilePath ?? "",
    videoSegmentPath: section.videoSegment?.gcsFilePath ?? "",
    splitVideoPath: section.splitVideo?.gcsFilePath ?? "",
  });
  if (usesOriginalVideoAudio.value && store.selectedVideoUrl) {
    thumbnailDebugLog("resolve_source:selected_video", {
      sectionId: section.id,
      startTime: Math.max(0.03, section.startTime + 0.03),
      endTime: Math.max(section.startTime + 0.03, section.endTime - 0.06),
    });
    return {
      url: store.selectedVideoUrl,
      startTime: Math.max(0.03, section.startTime + 0.03),
      endTime: Math.max(section.startTime + 0.03, section.endTime - 0.06),
      sourceKind: "selected_video",
    };
  }
  const segment = [section.splitVideoConverted, section.videoSegment, section.splitVideo].find(
    (candidate) => Boolean(candidate?.gcsFilePath)
  );
  if (segment?.gcsFilePath) {
    const parsed = parseGcsPath(segment.gcsFilePath);
    const storagePath = parsed?.filePath ?? segment.gcsFilePath;
    thumbnailDebugLog("resolve_source:section_segment", {
      sectionId: section.id,
      storagePath,
      bucketName: segment.bucketName || parsed?.bucketName || store.defaultBucket,
    });
    const url = await store.resolveStorageUrl(storagePath);
    const segmentDuration = segment.duration || section.endTime - section.startTime;
    return {
      url,
      startTime: 0.03,
      endTime: Math.max(0.03, segmentDuration - 0.06),
      sourceKind: "section_segment",
      sourcePath: storagePath,
    };
  }
  if (!store.selectedVideoUrl) {
    thumbnailDebugLog("resolve_source:none", {
      sectionId: section.id,
      reason: "selectedVideoUrl and section segment path are both missing",
    }, "warn");
    return null;
  }
  thumbnailDebugLog("resolve_source:fallback_selected_video", {
    sectionId: section.id,
    startTime: section.startTime,
    endTime: Math.max(section.startTime, section.endTime - 0.06),
  }, "warn");
  return {
    url: store.selectedVideoUrl,
    startTime: section.startTime,
    endTime: Math.max(section.startTime, section.endTime - 0.06),
    sourceKind: "selected_video",
  };
};

const createTimelineCaptureVideo = (url: string): HTMLVideoElement => {
  const video = document.createElement("video");
  video.crossOrigin = "anonymous";
  video.muted = true;
  video.playsInline = true;
  video.preload = "auto";
  video.src = url;
  video.style.position = "fixed";
  video.style.left = "-9999px";
  video.style.top = "-9999px";
  video.style.width = "1px";
  video.style.height = "1px";
  return video;
};

const cleanupTimelineCaptureVideo = (video: HTMLVideoElement): void => {
  video.removeAttribute("src");
  video.load();
  video.remove();
};

async function generateTimelineThumbnails(): Promise<void> {
  if (!import.meta.client || editorSections.value.length === 0) {
    thumbnailDebugLog("generate:skip", {
      reason: !import.meta.client ? "not_client" : "no_sections",
      sectionCount: editorSections.value.length,
    });
    timelineThumbnails.value = {};
    return;
  }
  const token = ++thumbnailGenerationToken;
  thumbnailDebugLog("generate:start", {
    token,
    sectionCount: editorSections.value.length,
    selectedVideoUrlReady: Boolean(store.selectedVideoUrl),
    selectedVideoUrlLength: store.selectedVideoUrl.length,
  });
  const next: Record<string, TimelineThumbnailPair> = {};
  for (const section of editorSections.value) {
    if (token !== thumbnailGenerationToken) {
      thumbnailDebugLog("generate:stale_token", {
        token,
        currentToken: thumbnailGenerationToken,
      }, "warn");
      return;
    }
    const source = await resolveTimelineThumbnailSource(section);
    if (!source) {
      thumbnailDebugLog("generate:source_missing", {
        token,
        sectionId: section.id,
        title: section.title,
      }, "warn");
      next[section.id] = {};
      timelineThumbnails.value = { ...next };
      continue;
    }
    thumbnailDebugLog("generate:section_start", {
      token,
      sectionId: section.id,
      title: section.title,
      sourceKind: source.sourceKind,
      sourcePath: source.sourcePath ?? "",
      startTime: source.startTime,
      endTime: source.endTime,
      urlLength: source.url.length,
    });
    const video = createTimelineCaptureVideo(source.url);
    try {
      document.body.appendChild(video);
      video.load();
      await waitForVideoEvent(video, "loadedmetadata");
      thumbnailDebugLog("generate:metadata_loaded", {
        token,
        sectionId: section.id,
        duration: video.duration,
        readyState: video.readyState,
        videoWidth: video.videoWidth,
        videoHeight: video.videoHeight,
        networkState: video.networkState,
      });
      if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
        await waitForVideoEvent(video, "loadeddata");
        thumbnailDebugLog("generate:loadeddata", {
          token,
          sectionId: section.id,
          readyState: video.readyState,
          videoWidth: video.videoWidth,
          videoHeight: video.videoHeight,
        });
      }
      const pair: TimelineThumbnailPair = {};
      try {
        pair.start = await captureVideoFrame(video, source.startTime);
        thumbnailDebugLog("generate:capture_start_ok", {
          token,
          sectionId: section.id,
          time: source.startTime,
          thumbnailKind: pair.start.kind,
        });
      } catch (error) {
        thumbnailDebugLog("generate:capture_start_fallback", {
          token,
          sectionId: section.id,
          time: source.startTime,
          error: error instanceof Error ? error.message : String(error),
        }, "warn");
        pair.start = fallbackTimelineThumbnail(source.url, source.startTime);
      }
      try {
        pair.end = await captureVideoFrame(video, source.endTime);
        thumbnailDebugLog("generate:capture_end_ok", {
          token,
          sectionId: section.id,
          time: source.endTime,
          thumbnailKind: pair.end.kind,
        });
      } catch (error) {
        thumbnailDebugLog("generate:capture_end_fallback", {
          token,
          sectionId: section.id,
          time: source.endTime,
          error: error instanceof Error ? error.message : String(error),
        }, "warn");
        pair.end = fallbackTimelineThumbnail(source.url, source.endTime);
      }
      next[section.id] = pair;
      thumbnailDebugLog("generate:section_done", {
        token,
        sectionId: section.id,
        startKind: pair.start?.kind ?? "",
        endKind: pair.end?.kind ?? "",
      });
    } catch (error) {
      thumbnailDebugLog("generate:source_video_error", {
        token,
        sectionId: section.id,
        sourceKind: source.sourceKind,
        sourcePath: source.sourcePath ?? "",
        startTime: source.startTime,
        endTime: source.endTime,
        error: error instanceof Error ? error.message : String(error),
        mediaErrorCode: video.error?.code ?? null,
        mediaErrorMessage: video.error?.message ?? "",
        networkState: video.networkState,
        readyState: video.readyState,
      }, "error");
      next[section.id] = {
        start: fallbackTimelineThumbnail(source.url, source.startTime),
        end: fallbackTimelineThumbnail(source.url, source.endTime),
      };
    } finally {
      cleanupTimelineCaptureVideo(video);
    }
    timelineThumbnails.value = { ...next };
  }
}

watch(
  () => ({
    sourceUrl: store.selectedVideoUrl,
    sectionsKey: editorSections.value
      .map((section) => {
        const segment = section.splitVideoConverted ?? section.videoSegment ?? section.splitVideo;
        return [
          section.id,
          section.startTime,
          section.endTime,
          segment?.gcsFilePath ?? "",
          segment?.duration ?? "",
        ].join(":");
      })
      .join("|"),
    usesOriginalVideoAudio: usesOriginalVideoAudio.value,
    view: store.view,
  }),
  (state) => {
    thumbnailDebugLog("watch:trigger", {
      view: state.view,
      sourceUrlReady: Boolean(state.sourceUrl),
      sourceUrlLength: state.sourceUrl.length,
      sectionCount: editorSections.value.length,
      sectionsKeyLength: state.sectionsKey.length,
      usesOriginalVideoAudio: state.usesOriginalVideoAudio,
    });
    if (store.view !== "editor") {
      thumbnailDebugLog("watch:skip", {
        reason: "not_editor",
        view: store.view,
      });
      return;
    }
    void generateTimelineThumbnails();
  },
  { immediate: true }
);

const togglePlay = (): void => {
  const video = editorVideo.value;
  if (!video) return;
  if (video.paused) {
    void video.play();
    isPlaying.value = true;
  } else {
    video.pause();
    isPlaying.value = false;
  }
};

const sleepUntil = (targetTime: number): Promise<void> =>
  new Promise((resolve) => {
    window.setTimeout(resolve, Math.max(0, targetTime - performance.now()));
  });

const runRecordingCountdown = async (): Promise<void> => {
  clearRecordingCountdown();
  const startedAt = performance.now();
  recordingCountdown.value = 3;
  await sleepUntil(startedAt + 1000);
  if (!isPreparingRecording.value) return;
  recordingCountdown.value = 2;
  await sleepUntil(startedAt + 2000);
  if (!isPreparingRecording.value) return;
  recordingCountdown.value = 1;
  await sleepUntil(startedAt + 3000);
  clearRecordingCountdown();
};

const prepareVideoForRecording = async (
  section: VideoStudioSection
): Promise<HTMLVideoElement> => {
  const video = editorVideo.value;
  if (!video) {
    throw new Error("録音対象の動画が読み込まれていません。");
  }
  if (!Number.isFinite(video.duration) || video.duration <= 0) {
    await waitForVideoEvent(video, "loadedmetadata");
    syncDuration();
  }

  const startTime = Math.max(
    0,
    Math.min(
      sectionStartSeconds(section),
      Math.max(0, safeNonNegativeSeconds(video.duration, sectionStartSeconds(section)) - 0.05)
    )
  );
  if (Math.abs(video.currentTime - startTime) > 0.05) {
    const seeked = waitForVideoEvent(video, "seeked", 3000);
    video.currentTime = startTime;
    currentTime.value = startTime;
    await seeked.catch(() => undefined);
  } else {
    currentTime.value = video.currentTime;
  }
  video.pause();
  isPlaying.value = false;
  return video;
};

const supportedRecordingMimeTypes = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/mp4",
  "audio/ogg;codecs=opus",
  "audio/ogg",
] as const;

const pickRecordingMimeType = (): string => {
  if (!import.meta.client || typeof MediaRecorder === "undefined") return "";
  return supportedRecordingMimeTypes.find((type) => MediaRecorder.isTypeSupported(type)) ?? "";
};

const recordingExtensionFromMimeType = (mimeType: string): string => {
  if (mimeType.includes("mp4")) return "m4a";
  if (mimeType.includes("ogg")) return "ogg";
  return "webm";
};

const createRecordingId = (): string =>
  `recording_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

const createNarrationSegmentId = (): string =>
  `narration_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

const resetRecordingUiState = (): void => {
  isRecording.value = false;
  isRecordingPaused.value = false;
  isSavingRecording.value = false;
  isPreparingRecording.value = false;
  audioLevel.value = 0;
  recordingCountdown.value = null;
  recordingElapsed.value = 0;
  recordingStartedAt.value = null;
  recordingPausedStartedAt.value = null;
  recordingPausedTotalMs.value = 0;
  activeRecordingSectionIndex.value = null;
  recordingMimeType.value = "";
};

const clearRecordingTimer = (): void => {
  if (recordingTimer.value) window.clearInterval(recordingTimer.value);
  recordingTimer.value = null;
};

const clearRecordingCountdown = (): void => {
  if (recordingCountdownTimer !== null) {
    window.clearInterval(recordingCountdownTimer);
    recordingCountdownTimer = null;
  }
  recordingCountdown.value = null;
};

const pauseEditorVideo = (): void => {
  const video = editorVideo.value;
  if (!video) return;
  video.pause();
  pauseRecordingPlaybackAudio();
  isPlaying.value = false;
  currentTime.value = video.currentTime;
};

const cleanupRecordingRuntime = (): void => {
  clearRecordingTimer();
  clearRecordingCountdown();
  recordingStream?.getTracks().forEach((track) => track.stop());
  recordingStream = null;
  void recordingAudioContext?.close().catch(() => undefined);
  recordingAudioContext = null;
  recordingAnalyser = null;
  mediaRecorder = null;
  recordingChunks = [];
};

const updateRecordingElapsed = (): void => {
  const startedAt = recordingStartedAt.value;
  if (!startedAt) return;
  const pausedNow = recordingPausedStartedAt.value
    ? Date.now() - recordingPausedStartedAt.value
    : 0;
  recordingElapsed.value = Math.max(
    0,
    (Date.now() - startedAt - recordingPausedTotalMs.value - pausedNow) / 1000
  );
};

const readMicrophoneLevel = (): number => {
  const analyser = recordingAnalyser;
  if (!analyser) return 0;
  const buffer = new Uint8Array(analyser.fftSize);
  analyser.getByteTimeDomainData(buffer);
  let sumSquares = 0;
  for (const value of buffer) {
    const normalized = (value - 128) / 128;
    sumSquares += normalized * normalized;
  }
  const rms = Math.sqrt(sumSquares / buffer.length);
  return Math.min(1, rms * 5);
};

const startRecordingMeter = (): void => {
  clearRecordingTimer();
  recordingTimer.value = window.setInterval(() => {
    if (isRecordingPaused.value) return;
    const video = editorVideo.value;
    if (video) {
      currentTime.value = video.currentTime;
      isPlaying.value = !video.paused;
    }
    updateRecordingElapsed();
    const level = readMicrophoneLevel();
    audioLevel.value = level;
    recordedWaveformData.value = [
      ...recordedWaveformData.value,
      Math.max(4, Math.round(level * 100)),
    ];
    const section = activeRecordingSection.value;
    if (
      recordingRemaining.value <= 0 ||
      (section && video && video.currentTime >= section.endTime - 0.05)
    ) {
      void stopRecording();
    }
  }, 100);
};

const startRecording = async (): Promise<void> => {
  const section = selectedSectionForRecording.value;
  if (!section || !store.selectedProject || !store.selectedVideo) return;
  if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
    requestNotice.value = {
      kind: "error",
      message: "このブラウザではマイク録音を利用できません。",
    };
    return;
  }
  cleanupRecordingRuntime();
  resetRecordingUiState();
  pauseRecordingPlaybackAudio();
  recordedWaveformData.value = [];
  requestNotice.value = null;
  recordingDiscardRequested = false;
  activeRecordingSectionIndex.value = selectedSectionIndex.value;

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
      video: false,
    });
    const mimeType = pickRecordingMimeType();
    const recorder = new MediaRecorder(
      stream,
      mimeType ? { mimeType } : undefined
    );
    recordingStream = stream;
    recordingMimeType.value = recorder.mimeType || mimeType || "audio/webm";
    recordingChunks = [];
    recorder.addEventListener("dataavailable", (event: BlobEvent) => {
      if (event.data.size > 0) recordingChunks.push(event.data);
    });

    const AudioContextConstructor =
      window.AudioContext ||
      (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (AudioContextConstructor) {
      recordingAudioContext = new AudioContextConstructor();
      const source = recordingAudioContext.createMediaStreamSource(stream);
      recordingAnalyser = recordingAudioContext.createAnalyser();
      recordingAnalyser.fftSize = 512;
      source.connect(recordingAnalyser);
    }

    mediaRecorder = recorder;
    const video = await prepareVideoForRecording(section);
    isPreparingRecording.value = true;
    await runRecordingCountdown();
    if (!isPreparingRecording.value) return;
    recordingStartedAt.value = Date.now();
    isRecording.value = true;
    isPreparingRecording.value = false;
    const playPromise = video.play();
    recorder.start(250);
    await playPromise;
    isPlaying.value = true;
    startRecordingMeter();
  } catch (error) {
    pauseEditorVideo();
    if (mediaRecorder && mediaRecorder.state !== "inactive") {
      try {
        mediaRecorder.stop();
      } catch {
        // Ignore cleanup failures after a failed start.
      }
    }
    cleanupRecordingRuntime();
    resetRecordingUiState();
    requestNotice.value = {
      kind: "error",
      message:
        error instanceof DOMException && error.name === "NotAllowedError"
          ? "マイクの利用が許可されませんでした。ブラウザの権限設定を確認してください。"
          : error instanceof Error
            ? error.message
            : "録音の開始に失敗しました。",
    };
  }
};

const pauseRecording = (): void => {
  if (!mediaRecorder || mediaRecorder.state !== "recording") return;
  mediaRecorder.pause();
  pauseEditorVideo();
  isRecordingPaused.value = true;
  recordingPausedStartedAt.value = Date.now();
  audioLevel.value = 0;
};

const resumeRecording = (): void => {
  if (!mediaRecorder || mediaRecorder.state !== "paused") return;
  if (recordingPausedStartedAt.value) {
    recordingPausedTotalMs.value += Date.now() - recordingPausedStartedAt.value;
  }
  recordingPausedStartedAt.value = null;
  mediaRecorder.resume();
  void editorVideo.value
    ?.play()
    .then(() => {
      isPlaying.value = true;
    })
    .catch((error: unknown) => {
      requestNotice.value = {
        kind: "error",
        message:
          error instanceof Error ? error.message : "動画の再開に失敗しました。",
      };
    });
  isRecordingPaused.value = false;
};

const stopMediaRecorder = async (): Promise<Blob> => {
  const recorder = mediaRecorder;
  if (!recorder) {
    throw new Error("録音が開始されていません。");
  }
  if (recorder.state === "inactive") {
    return new Blob(recordingChunks, { type: recordingMimeType.value || "audio/webm" });
  }
  return await new Promise<Blob>((resolve, reject) => {
    const cleanup = (): void => {
      recorder.removeEventListener("stop", onStop);
      recorder.removeEventListener("error", onError);
    };
    const onStop = (): void => {
      cleanup();
      resolve(new Blob(recordingChunks, { type: recordingMimeType.value || "audio/webm" }));
    };
    const onError = (event: Event): void => {
      cleanup();
      reject((event as ErrorEvent).error ?? new Error("録音の停止に失敗しました。"));
    };
    recorder.addEventListener("stop", onStop, { once: true });
    recorder.addEventListener("error", onError, { once: true });
    if (recorder.state === "paused") recorder.resume();
    recorder.requestData();
    recorder.stop();
  });
};

const extractTranscriptText = (payload: unknown): string => {
  if (typeof payload === "string") return payload;
  if (!isRecord(payload)) return "";
  if (typeof payload.transcript === "string") return payload.transcript;
  const llmOutput = isRecord(payload.llm_output) ? payload.llm_output : null;
  const paragraphs = Array.isArray(llmOutput?.paragraphs) ? llmOutput.paragraphs : [];
  return paragraphs
    .map((paragraph) => {
      if (typeof paragraph === "string") return paragraph;
      if (isRecord(paragraph)) {
        return String(paragraph.text ?? paragraph.content ?? paragraph.summary ?? "");
      }
      return "";
    })
    .filter(Boolean)
    .join("\n");
};

const extractTranscriptParagraphs = (payload: unknown): TranscriptionParagraph[] => {
  const fromText = (text: string): TranscriptionParagraph[] =>
    text
      .split(/\n{2,}|\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((text, index) => ({
        text,
        start: formatDuration(index * 5),
        startSeconds: index * 5,
      }));

  if (typeof payload === "string") return fromText(payload);
  if (!isRecord(payload)) return [];
  const llmOutput = isRecord(payload.llm_output) ? payload.llm_output : null;
  const rawParagraphs =
    Array.isArray(payload.paragraphs)
      ? payload.paragraphs
      : Array.isArray(llmOutput?.paragraphs)
        ? llmOutput.paragraphs
        : [];
  if (rawParagraphs.length === 0) return fromText(extractTranscriptText(payload));
  return rawParagraphs
    .map((paragraph, index) => {
      if (typeof paragraph === "string") {
        return {
          text: paragraph.trim(),
          start: formatDuration(index * 5),
          startSeconds: index * 5,
        };
      }
      if (!isRecord(paragraph)) return null;
      const text = String(paragraph.text ?? paragraph.content ?? paragraph.summary ?? "").trim();
      if (!text) return null;
      const startSeconds = Number(paragraph.startSeconds ?? paragraph.start_seconds ?? paragraph.start ?? index * 5);
      const safeStart = Number.isFinite(startSeconds) ? Math.max(0, startSeconds) : index * 5;
      return {
        text,
        start: formatDuration(safeStart),
        startSeconds: safeStart,
      };
    })
    .filter((paragraph): paragraph is TranscriptionParagraph => Boolean(paragraph));
};

const buildNarrationSegmentsFromTranscript = (
  section: VideoStudioSection,
  transcript: string,
  existing = section.finalyNarrations
): VideoStudioSection["finalyNarrations"] => {
  const paragraphs = extractTranscriptParagraphs(transcript);
  const sourceParagraphs =
    paragraphs.length > 0
      ? paragraphs
      : [{
          text: transcript,
          start: formatDuration(0),
          startSeconds: 0,
        }];
  return sourceParagraphs.map((paragraph, index) => {
    const previous = existing[index];
    return {
      id: previous?.id ?? createNarrationSegmentId(),
      originalText: paragraph.text,
      rewrittenText: previous?.rewrittenText || paragraph.text,
      start: previous?.start ?? paragraph.start,
      startSeconds: previous?.startSeconds ?? paragraph.startSeconds,
      endSeconds: previous?.endSeconds,
      characterCount: (previous?.rewrittenText || paragraph.text).length,
      isTtsGenerated: previous?.isTtsGenerated ?? false,
      requestOutput: previous?.requestOutput,
    };
  });
};

const fetchTranscriptionText = async (filePath?: string): Promise<string> => {
  if (!filePath) return "";
  let text = "";
  try {
    const bytes = await getBytes(storageRef(getStorage(), filePath), 10 * 1024 * 1024);
    text = new TextDecoder("utf-8").decode(bytes);
  } catch {
    const url = await store.resolveStorageUrl(filePath);
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`文字起こし結果の取得に失敗しました: ${response.status}`);
    }
    text = await response.text();
  }
  try {
    return extractTranscriptText(JSON.parse(text)) || text;
  } catch {
    return text;
  }
};

const transcriptionFilePathFromOutput = (output: Record<string, unknown>): string => {
  const filePath = String(output.transcriptionFilePath ?? "");
  if (filePath) return filePath;
  const gcsPath = String(output.transcriptionPath ?? "");
  const match = gcsPath.match(/^gs:\/\/[^/]+\/(.+)$/);
  return match?.[1] ?? "";
};

type TranscriptionRequestDocData = {
  status?: string;
  output?: Record<string, unknown>;
  errorMessage?: string;
};

const transcriptionRequestDocPath = (requestId: string): string =>
  `organizations/${store.organizationId}/spaces/${store.spaceId}/requests/videoTranscriptionRequests/logs/${requestId}`;

const reportVideoTranscriptionEvent = (
  eventName: string,
  context: Record<string, unknown>
): void => {
  reportDatadogInfo(`video_transcription.${eventName}`, {
    feature: "video_studio",
    requestType: "videoTranscriptionRequests",
    ...context,
  });
};

const markTranscriptionRequestError = async (
  sectionId: string,
  requestId: string,
  message: string
): Promise<void> => {
  await updateSectionRecordingTranscriptionState(sectionId, {
    transcriptionStatus: "error",
  });
  requestNotice.value = {
    kind: "error",
    message,
  };
  reportDatadogInfo("video_transcription.error", {
    feature: "video_studio",
    requestType: "videoTranscriptionRequests",
    requestId,
    sectionId,
    errorMessage: message,
  });
};

const updateProjectSectionsForTranscription = async (
  mutateSections: (sections: VideoStudioSection[]) => VideoStudioSection[]
): Promise<void> => {
  const project = store.selectedProject;
  if (!project) return;

  transcriptionProjectUpdateQueue = transcriptionProjectUpdateQueue.then(async () => {
    await store.openProject(project.videoId, project.id);
    const freshProject = store.selectedProject;
    if (!freshProject) return;

    const sections = mutateSections(freshProject.sections);
    const selectedIndex = freshProject.editorState.selectedSectionIndex;
    const selectedSection =
      typeof selectedIndex === "number"
        ? sections[selectedIndex] ?? null
        : freshProject.editorState.selectedSection ?? sections[0] ?? null;
    await store.updateProject(freshProject.videoId, freshProject.id, {
      sections,
      editorState: {
        ...freshProject.editorState,
        selectedSection,
      },
    });
  });

  return transcriptionProjectUpdateQueue;
};

const applyTranscriptionToSection = async (
  params: {
    sectionId: string;
    recordingId: string;
    requestId: string;
    output: Record<string, unknown>;
  }
): Promise<void> => {
  const transcriptionFilePath = transcriptionFilePathFromOutput(params.output);
  const transcript = await fetchTranscriptionText(transcriptionFilePath);
  await updateProjectSectionsForTranscription((sections) => sections.map((section) => {
    if (section.id !== params.sectionId) return section;
    const narrations = buildNarrationSegmentsFromTranscript(
      section,
      transcript
    ).map((narration) => ({
      ...narration,
      requestOutput: {
        ...narration.requestOutput,
        recordingId: params.recordingId,
        transcriptionRequestId: params.requestId,
        transcriptionOutput: params.output,
      },
    }));
    return {
      ...section,
      recording: {
        recordingId: section.recording?.recordingId ?? params.recordingId,
        audioBucketName: section.recording?.audioBucketName ?? "",
        audioFilePath: section.recording?.audioFilePath ?? "",
        audioContentType: section.recording?.audioContentType ?? "audio/webm",
        audioSizeBytes: section.recording?.audioSizeBytes ?? 0,
        durationSeconds: section.recording?.durationSeconds ?? 0,
        waveform: section.recording?.waveform ?? [],
        recordedAt: section.recording?.recordedAt,
        transcriptionRequestId: params.requestId,
        transcriptionStatus: "completed" as const,
        transcriptionBucketName: String(params.output.transcriptionBucketName ?? ""),
        transcriptionFilePath,
        transcript,
      },
      finalyNarrations: narrations,
    };
  }));
  reportVideoTranscriptionEvent("completed", {
    requestId: params.requestId,
    sectionId: params.sectionId,
    recordingId: params.recordingId,
    transcriptionFilePath,
    transcriptLength: transcript.length,
  });
};

const handleTranscriptionRequestSnapshot = async (
  params: {
    requestId: string;
    sectionId: string;
    recordingId: string;
    data: TranscriptionRequestDocData;
  }
): Promise<"handled" | "pending"> => {
  if (params.data.status === "completed") {
    await applyTranscriptionToSection({
      sectionId: params.sectionId,
      recordingId: params.recordingId,
      requestId: params.requestId,
      output: params.data.output ?? {},
    });
    requestNotice.value = {
      kind: "success",
      message: usesOriginalVideoAudio.value
        ? "元動画音声の文字起こしが完了しました。"
        : "録音と文字起こしが完了しました。",
    };
    return "handled";
  }

  if (params.data.status === "error") {
    await markTranscriptionRequestError(
      params.sectionId,
      params.requestId,
      params.data.errorMessage || "文字起こしに失敗しました。"
    );
    return "handled";
  }

  return "pending";
};

const watchRecordingTranscriptionRequest = (
  params: {
    requestId: string;
    sectionId: string;
    recordingId: string;
  }
): void => {
  if (watchedTranscriptionRequestIds.has(params.requestId)) return;
  watchedTranscriptionRequestIds.add(params.requestId);
  const db = getFirestore();
  const path = transcriptionRequestDocPath(params.requestId);
  const unsubscribe = onSnapshot(doc(db, path), (snapshot) => {
    const data = snapshot.data() as TranscriptionRequestDocData | undefined;
    if (!data) return;
    void handleTranscriptionRequestSnapshot({
      ...params,
      data,
    }).then((result) => {
      if (result === "handled") {
        watchedTranscriptionRequestIds.delete(params.requestId);
        unsubscribe();
      }
    }).catch((error) => {
      watchedTranscriptionRequestIds.delete(params.requestId);
      unsubscribe();
      reportDatadogError(error, {
        feature: "video_studio",
        requestType: "videoTranscriptionRequests",
        requestId: params.requestId,
        sectionId: params.sectionId,
        recordingId: params.recordingId,
      });
      void markTranscriptionRequestError(
        params.sectionId,
        params.requestId,
        error instanceof Error ? error.message : "文字起こし結果の反映に失敗しました。"
      );
    });
  });
};

const recoverRecordingTranscriptionRequest = async (
  section: VideoStudioSection
): Promise<void> => {
  const recording = section.recording;
  const requestId = recording?.transcriptionRequestId;
  if (!recording?.audioFilePath || !requestId) return;
  if (recording.transcriptionStatus === "completed" || recording.transcriptionStatus === "error") return;

  const db = getFirestore();
  const snapshot = await getDoc(doc(db, transcriptionRequestDocPath(requestId)));
  if (!snapshot.exists()) {
    const startedAtMatch = requestId.match(/^videoTranscription_(\d+)_/);
    const startedAt = startedAtMatch ? Number(startedAtMatch[1]) : 0;
    const isRecentlyCreated =
      Number.isFinite(startedAt) &&
      startedAt > 0 &&
      Date.now() - startedAt < 1000 * 60 * 2;

    if (isRecentlyCreated) {
      watchRecordingTranscriptionRequest({
        requestId,
        sectionId: section.id,
        recordingId: recording.recordingId,
      });
      return;
    }

    await markTranscriptionRequestError(
      section.id,
      requestId,
      "文字起こしリクエストが見つかりません。もう一度文字起こしを実行してください。"
    );
    return;
  }

  const data = snapshot.data() as TranscriptionRequestDocData;
  const result = await handleTranscriptionRequestSnapshot({
    requestId,
    sectionId: section.id,
    recordingId: recording.recordingId,
    data,
  });
  if (result === "pending") {
    await updateSectionRecordingTranscriptionState(section.id, {
      transcriptionStatus: "processing",
    });
    watchRecordingTranscriptionRequest({
      requestId,
      sectionId: section.id,
      recordingId: recording.recordingId,
    });
  }
};

const recoverPendingRecordingTranscriptions = async (): Promise<void> => {
  if (!import.meta.client || !store.selectedProject) return;
  const pendingSections = editorSections.value.filter((section) => {
    const recording = section.recording;
    return (
      recording?.audioFilePath &&
      recording.transcriptionRequestId &&
      recording.transcriptionStatus !== "completed" &&
      recording.transcriptionStatus !== "error"
    );
  });
  if (pendingSections.length === 0) return;

  reportVideoTranscriptionEvent("recover_started", {
    projectId: store.selectedProject.id,
    videoId: store.selectedProject.videoId,
    pendingCount: pendingSections.length,
  });

  for (const section of pendingSections) {
    try {
      await recoverRecordingTranscriptionRequest(section);
    } catch (error) {
      reportDatadogError(error, {
        feature: "video_studio",
        requestType: "videoTranscriptionRequests",
        requestId: section.recording?.transcriptionRequestId,
        sectionId: section.id,
      });
      await markTranscriptionRequestError(
        section.id,
        section.recording?.transcriptionRequestId ?? "",
        error instanceof Error ? error.message : "文字起こし状態の復旧に失敗しました。"
      );
    }
  }
};

const updateSectionRecordingTranscriptionState = async (
  sectionId: string,
  updates: Partial<NonNullable<VideoStudioSection["recording"]>>
): Promise<void> => {
  await updateProjectSectionsForTranscription((sections) => sections.map((section) =>
    section.id === sectionId && section.recording
      ? {
          ...section,
          recording: {
            ...section.recording,
            ...updates,
          },
        }
      : section
  ));
};

const ensureSectionTranscriptionRecording = async (
  sectionId: string,
  source: SectionTranscriptionSource,
  updates: Partial<NonNullable<VideoStudioSection["recording"]>>
): Promise<void> => {
  await updateProjectSectionsForTranscription((sections) => sections.map((section) =>
    section.id === sectionId
      ? {
          ...section,
          recording: {
            recordingId: section.recording?.recordingId ?? source.sourceId,
            audioBucketName: section.recording?.audioBucketName || source.bucketName,
            audioFilePath: section.recording?.audioFilePath || source.filePath,
            audioContentType: section.recording?.audioContentType || source.contentType,
            audioSizeBytes: section.recording?.audioSizeBytes ?? 0,
            durationSeconds: section.recording?.durationSeconds || source.durationSeconds,
            waveform: section.recording?.waveform?.length
              ? section.recording.waveform
              : normalizedWaveform(source.waveform),
            recordedAt: section.recording?.recordedAt,
            transcriptionRequestId: section.recording?.transcriptionRequestId,
            transcriptionStatus: section.recording?.transcriptionStatus ?? "pending",
            transcriptionBucketName: section.recording?.transcriptionBucketName,
            transcriptionFilePath: section.recording?.transcriptionFilePath,
            transcript: section.recording?.transcript,
            ...updates,
          },
        }
      : section
  ));
};

const requestSectionTranscription = async (
  sectionIndex: number
): Promise<string | null> => {
  const project = store.selectedProject;
  const section = editorSections.value[sectionIndex];
  const source = section ? sectionTranscriptionSource(section) : null;
  const videoId = project?.videoId || store.selectedVideo?.id || "";
  if (!project || !videoId || !section || !source) {
    workflowDebugLog("transcription_section_skipped", {
      sectionIndex,
      hasProject: Boolean(project),
      hasVideoId: Boolean(videoId),
      hasSection: Boolean(section),
      hasSource: Boolean(source),
      sectionId: section?.id ?? "",
      sectionTitle: section?.title ?? "",
    }, "warn");
    return null;
  }

  const requestId = `videoTranscription_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const transcriptionOutputFilePath = getNarrationRecordingStoragePath({
    organizationId: store.organizationId,
    spaceId: store.spaceId,
    videoId,
    projectId: project.id,
    sectionId: section.id,
    fileName: `${source.sourceId}/${requestId}.json`,
  });
  workflowDebugLog("transcription_request_prepare", {
    requestId,
    sectionIndex,
    sectionId: section.id,
    sourceKind: source.kind,
    sourceMode: source.mode,
    sourceBucketName: source.bucketName,
    sourceFilePath: source.filePath,
    outputFilePath: transcriptionOutputFilePath,
  });
  await createWorkflowRequestDoc(
    "videoTranscriptionRequests",
    {
      mode: source.mode,
      sourceFileBucketName: source.bucketName,
      sourceFilePath: source.filePath,
      outputBucketName: store.defaultBucket,
      outputFilePath: transcriptionOutputFilePath,
      enableParagraphFormatting: true,
      videoId,
      projectId: project.id,
      projectName: project.name,
      videoTitle: store.selectedVideo?.title ?? "",
      sectionId: section.id,
      sectionTitle: section.title,
      sectionIndex,
      sectionStartTime: section.startTime,
      sectionEndTime: section.endTime,
    },
    requestId
  );
  await ensureSectionTranscriptionRecording(section.id, source, {
    transcriptionRequestId: requestId,
    transcriptionStatus: "processing",
  });
  workflowDebugLog("transcription_request_created", {
    requestId,
    sectionIndex,
    sectionId: section.id,
  });
  reportVideoTranscriptionEvent("request_created", {
    requestId,
    videoId,
    projectId: project.id,
    sectionId: section.id,
    sectionIndex,
    recordingId: source.sourceId,
    sourceKind: source.kind,
    sourceMode: source.mode,
    sourceFilePath: source.filePath,
    outputFilePath: transcriptionOutputFilePath,
  });
  watchRecordingTranscriptionRequest({
    requestId,
    sectionId: section.id,
    recordingId: source.sourceId,
  });
  return requestId;
};

const requestBulkTranscription = async (
  options: { advanceToAiStep?: boolean } = {}
): Promise<boolean> => {
  const project = store.selectedProject;
  if (!project) {
    workflowDebugLog("transcription_bulk_no_project", {}, "warn");
    return false;
  }
  activeRequest.value = "transcription";
  requestNotice.value = {
    kind: "success",
    message: "文字起こしを開始しています...",
  };
  try {
    workflowDebugLog("transcription_bulk_start", {
      advanceToAiStep: Boolean(options.advanceToAiStep),
      sectionCount: editorSections.value.length,
      transcribableSectionsCount: transcribableSectionsCount.value,
    });
    await saveEditorSections();
    const latestProject = store.selectedProject ?? project;
    const targets = editorSections.value
      .map((section, index) => ({ section, index }))
      .filter(({ section }) =>
        sectionHasTranscriptionSource(section) &&
        section.recording?.transcriptionStatus !== "completed"
      );
    workflowDebugLog("transcription_bulk_targets_resolved", {
      advanceToAiStep: Boolean(options.advanceToAiStep),
      targetCount: targets.length,
      sectionCount: editorSections.value.length,
      transcribableSectionsCount: transcribableSectionsCount.value,
      sectionSummaries: editorSections.value.map((section, index) => ({
        index,
        id: section.id,
        title: section.title,
        hasSource: sectionHasTranscriptionSource(section),
        transcriptionStatus: section.recording?.transcriptionStatus ?? "",
        audioFilePath: section.recording?.audioFilePath ?? "",
        audioSegmentPath: section.audioSegment?.gcsFilePath ?? "",
        splitVideoConvertedPath: section.splitVideoConverted?.gcsFilePath ?? "",
        videoSegmentPath: section.videoSegment?.gcsFilePath ?? "",
        splitVideoPath: section.splitVideo?.gcsFilePath ?? "",
      })),
    });
    reportVideoTranscriptionEvent("bulk_start", {
      videoId: latestProject.videoId,
      projectId: latestProject.id,
      sourceKind: usesOriginalVideoAudio.value ? "source_video" : "recording",
      targetCount: targets.length,
      sectionCount: editorSections.value.length,
    });
    const hasMissingSource =
      usesOriginalVideoAudio.value &&
      editorSections.value.length > 0 &&
      transcribableSectionsCount.value === 0;
    if (targets.length === 0) {
      requestNotice.value = {
        kind: hasMissingSource ? "error" : "success",
        message:
          hasMissingSource
            ? "元動画音声の文字起こし対象を作成できませんでした。セクション動画のStorage情報を確認してください。"
            : "文字起こし対象はありません。既存の結果を表示します。",
      };
      workflowDebugLog(hasMissingSource ? "transcription_bulk_missing_source" : "transcription_bulk_no_targets", {
        advanceToAiStep: Boolean(options.advanceToAiStep),
        hasMissingSource,
      }, hasMissingSource ? "error" : "info");
      if (hasMissingSource) return false;
    }
    if (options.advanceToAiStep) {
      const completedStep = requiresRecordingFlow.value ? "recording" : "section_split";
      workflowDebugLog("transcription_bulk_advance_start", {
        completedStep,
        projectId: latestProject.id,
        videoId: latestProject.videoId,
        timing: "before_request_creation",
      });
      await store.updateProject(latestProject.videoId, latestProject.id, {
        currentStep: "voice_generation",
        completedSteps: Array.from(new Set([...latestProject.completedSteps, completedStep])),
      });
      workflowDebugLog("transcription_bulk_advance_done", {
        currentStep: store.selectedProject?.currentStep ?? "",
      });
    }
    if (targets.length > 0) {
      let started = 0;
      for (const target of targets) {
        const requestId = await requestSectionTranscription(target.index);
        if (requestId) started++;
      }
      requestNotice.value = {
        kind: "success",
        message: `${started}件の文字起こしを開始しました。完了するとAIナレーションへ反映されます。`,
      };
      workflowDebugLog("transcription_bulk_requests_started", {
        started,
        targetCount: targets.length,
      });
      if (started === 0) return false;
    }
    return true;
  } catch (error) {
    requestNotice.value = {
      kind: "error",
      message: error instanceof Error ? error.message : "文字起こしの開始に失敗しました。",
    };
    workflowDebugLog("transcription_bulk_error", {
      error: error instanceof Error ? error.message : String(error),
    }, "error");
    return false;
  } finally {
    activeRequest.value = null;
  }
};

const saveRecordedAudio = async (audioBlob: Blob): Promise<void> => {
  const project = store.selectedProject;
  const video = store.selectedVideo;
  const sectionIndex = activeRecordingSectionIndex.value;
  const section =
    typeof sectionIndex === "number" ? editorSections.value[sectionIndex] : null;
  if (!project || !video || !section) {
    throw new Error("録音の保存先セクションが見つかりません。");
  }
  if (audioBlob.size === 0) {
    throw new Error("録音データが空です。マイク入力を確認してください。");
  }

  const bucketName = store.defaultBucket;
  const recordingId = createRecordingId();
  const waveform = normalizedWaveform(recordedWaveformData.value);
  const contentType = audioBlob.type || recordingMimeType.value || "audio/webm";
  const extension = recordingExtensionFromMimeType(contentType);
  const audioFilePath = getNarrationRecordingStoragePath({
    organizationId: store.organizationId,
    spaceId: store.spaceId,
    videoId: video.id,
    projectId: project.id,
    sectionId: section.id,
    fileName: `${recordingId}.${extension}`,
  });
  await uploadBytes(storageRef(getStorage(), audioFilePath), audioBlob, {
    contentType,
  });

  const nextSections = editorSections.value.map((item, index) => {
    if (index !== sectionIndex) return item;
    return {
      ...item,
      recording: {
        recordingId,
        audioBucketName: bucketName,
        audioFilePath,
        audioContentType: contentType,
        audioSizeBytes: audioBlob.size,
        durationSeconds: recordingElapsed.value,
        waveform,
        transcriptionStatus: "pending" as const,
        recordedAt: Timestamp.now(),
      },
      finalyNarrations: item.finalyNarrations,
    };
  });
  await store.saveSections(nextSections);
  requestNotice.value = {
    kind: "success",
    message: "録音を保存しました。次へ進むと文字起こしを開始します。",
  };
};

const stopRecording = async (): Promise<void> => {
  if (!mediaRecorder) return;
  clearRecordingTimer();
  clearRecordingCountdown();
  updateRecordingElapsed();
  pauseEditorVideo();
  isSavingRecording.value = true;
  isRecordingPaused.value = false;
  try {
    const audioBlob = await stopMediaRecorder();
    cleanupRecordingRuntime();
    isRecording.value = false;
    audioLevel.value = 0;
    if (!recordingDiscardRequested) {
      await saveRecordedAudio(audioBlob);
    }
  } catch (error) {
    requestNotice.value = {
      kind: "error",
      message: error instanceof Error ? error.message : "録音の保存に失敗しました。",
    };
  } finally {
    recordingDiscardRequested = false;
    resetRecordingUiState();
  }
};

const retakeRecording = async (): Promise<void> => {
  recordingDiscardRequested = true;
  pauseEditorVideo();
  if (mediaRecorder && mediaRecorder.state !== "inactive") {
    await stopRecording();
  } else {
    cleanupRecordingRuntime();
    resetRecordingUiState();
  }
  recordedWaveformData.value = [];
  recordingElapsed.value = 0;
  audioLevel.value = 0;
};

const meterBarActive = (index: number): boolean =>
  index <= Math.round(audioLevel.value * 10);

const meterBarClass = (index: number): string => {
  if (!meterBarActive(index)) return "bg-gray-600";
  if (index <= 3) return "bg-green-500";
  if (index <= 6) return "bg-green-400";
  if (index <= 8) return "bg-yellow-400";
  return "bg-red-500";
};

const sectionTranscriptionCompleted = (section: VideoStudioSection): boolean =>
  section.recording?.transcriptionStatus === "completed";

const sectionHasGeneratedAudio = (section: VideoStudioSection): boolean =>
  section.finalyNarrations.length > 0 &&
  section.finalyNarrations.every(
    (segment) => segment.isTtsGenerated && Boolean(ttsSegmentOutputPath(segment))
  );

const generatedNarrationCount = (section: VideoStudioSection): number =>
  section.finalyNarrations.filter(
    (segment) => segment.isTtsGenerated && Boolean(ttsSegmentOutputPath(segment))
  ).length;

const sectionFixable = (section: VideoStudioSection): boolean =>
  sectionTranscriptionCompleted(section) && sectionHasGeneratedAudio(section);

const sectionFixBlockingReason = (section: VideoStudioSection): string => {
  if (!sectionTranscriptionCompleted(section)) return "文字起こし完了後に確定できます";
  if (section.finalyNarrations.length === 0) return "AIナレーション段落を作成してください";
  if (!sectionHasGeneratedAudio(section)) return "すべてのAI音声生成後に確定できます";
  return "編集を確定できます";
};

const toggleSectionFixed = async (sectionIndex: number): Promise<void> => {
  const section = editorSections.value[sectionIndex];
  if (!section) return;
  const nextFixed = !section.isFixed;
  if (nextFixed && !sectionFixable(section)) {
    requestNotice.value = {
      kind: "error",
      message: sectionFixBlockingReason(section),
    };
    return;
  }
  const sections = editorSections.value.map((item, index) =>
    index === sectionIndex
      ? {
          ...item,
          isFixed: nextFixed,
        }
      : item
  );
  await store.saveSections(sections);
  requestNotice.value = {
    kind: nextFixed ? "success" : "error",
    message: nextFixed
      ? `${section.title || `セクション ${sectionIndex + 1}`} の編集を確定しました。`
      : `${section.title || `セクション ${sectionIndex + 1}`} の確定を解除しました。`,
  };
};

const transcriptionStatusLabel = (section: VideoStudioSection): string => {
  const recording = section.recording;
  const hasSource = sectionHasTranscriptionSource(section);
  if (!recording?.audioFilePath) {
    return hasSource
      ? usesOriginalVideoAudio.value
        ? "元動画音声を未文字起こし"
        : "未文字起こし"
      : "音声なし";
  }
  switch (recording.transcriptionStatus) {
    case "completed":
      return "文字起こし完了";
    case "processing":
      return "文字起こし処理中";
    case "error":
      return "文字起こしエラー";
    default:
      return recording.transcriptionRequestId ? "文字起こし待機中" : "未文字起こし";
  }
};

const transcriptionProgressBadgeClass = (section: VideoStudioSection): string => {
  const status = section.recording?.transcriptionStatus;
  if (status === "completed") return "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200";
  if (status === "error") return "bg-red-50 text-red-700 ring-1 ring-inset ring-red-200";
  if (isSectionTranscriptionInFlight(section)) return "bg-indigo-50 text-indigo-700 ring-1 ring-inset ring-indigo-200";
  return "bg-gray-100 text-gray-600 ring-1 ring-inset ring-gray-200";
};

const normalizedWaveform = (waveform?: number[]): number[] =>
  (waveform ?? [])
    .filter((value) => Number.isFinite(value))
    .map((value) => Math.max(4, Math.min(100, Math.round(value))));

const recordingCacheKey = (section: VideoStudioSection): string => {
  if (section.recording?.audioFilePath) return section.recording.audioFilePath;
  if (!usesOriginalVideoAudio.value) return "";
  const source = sectionVideoSourceInfo(section);
  if (!source?.filePath) return "";
  return source.bucketName ? `gs://${source.bucketName}/${source.filePath}` : source.filePath;
};

const sectionRecordingWaveform = (section: VideoStudioSection): number[] => {
  const persisted = normalizedWaveform(section.recording?.waveform);
  if (persisted.length > 0) return persisted;
  const key = recordingCacheKey(section);
  return key ? normalizedWaveform(recordingWaveformCache.value[key]) : [];
};

const resampleWaveformBars = (
  waveform: number[],
  barCount: number,
  keyPrefix: string
): WaveformBar[] => {
  if (waveform.length === 0 || !Number.isFinite(barCount) || barCount <= 0) return [];
  const count = Math.min(Math.max(1, Math.floor(barCount)), 420);
  return Array.from({ length: count }, (_, index) => {
    const start = Math.floor((index / count) * waveform.length);
    const end = Math.max(start + 1, Math.floor(((index + 1) / count) * waveform.length));
    const bucket = waveform.slice(start, end);
    return {
      key: `${keyPrefix}-${index}`,
      height: Math.max(4, ...bucket),
    };
  });
};

function sectionRecordingWaveformBars(
  section: VideoStudioSection,
  barCount: number
): WaveformBar[] {
  return resampleWaveformBars(sectionRecordingWaveform(section), barCount, section.id);
}

const waveformFromAudioBuffer = (
  audioBuffer: AudioBuffer,
  sampleCount: number
): number[] => {
  const channel = audioBuffer.getChannelData(0);
  if (channel.length === 0) return [];
  const count = Math.min(
    Math.max(1, Number.isFinite(sampleCount) ? Math.floor(sampleCount) : 1),
    1200
  );
  return Array.from({ length: count }, (_, index) => {
    const start = Math.floor((index / count) * channel.length);
    const end = Math.max(start + 1, Math.floor(((index + 1) / count) * channel.length));
    let peak = 0;
    for (let cursor = start; cursor < end; cursor += 1) {
      peak = Math.max(peak, Math.abs(channel[cursor] ?? 0));
    }
    return Math.max(4, Math.min(100, Math.round(4 + peak * 160)));
  });
};

const decodeRecordingWaveform = async (
  audioData: ArrayBuffer,
  sampleCount = 180
): Promise<number[]> => {
  const AudioContextConstructor =
    window.AudioContext ||
    (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextConstructor) return [];
  const audioContext = new AudioContextConstructor();
  try {
    const audioBuffer = await audioContext.decodeAudioData(audioData);
    return waveformFromAudioBuffer(audioBuffer, sampleCount);
  } finally {
    void audioContext.close();
  }
};

const getRecordingAudioBytes = async (filePath: string): Promise<ArrayBuffer> => {
  const bytes = await getBytes(storageRef(getStorage(), filePath), 200 * 1024 * 1024);
  return bytes;
};

const resolveRecordingAudioUrl = async (
  section: VideoStudioSection
): Promise<string | null> => {
  const key = recordingCacheKey(section);
  if (!key) return null;
  const cached = recordingAudioUrlCache.value[key];
  if (cached) return cached;
  const url = await store.resolveStorageUrl(key);
  recordingAudioUrlCache.value = {
    ...recordingAudioUrlCache.value,
    [key]: url,
  };
  return url;
};

const ttsOutputFilePath = (
  segment: VideoStudioSection["finalyNarrations"][number]
): string => {
  const outputPath = ttsSegmentOutputPath(segment);
  const parsed = parseGcsPath(outputPath);
  return parsed?.filePath ?? "";
};

const getTtsAudioBytes = async (
  segment: VideoStudioSection["finalyNarrations"][number]
): Promise<ArrayBuffer | null> => {
  const outputPath = ttsSegmentOutputPath(segment);
  const filePath = ttsOutputFilePath(segment);
  const storagePath = outputPath.startsWith("gs://") ? outputPath : filePath;
  if (!storagePath) return null;
  const bytes = await getBytes(storageRef(getStorage(), storagePath), 50 * 1024 * 1024);
  return bytes;
};

const resolveTtsAudioUrl = async (
  segment: VideoStudioSection["finalyNarrations"][number]
): Promise<string | null> => {
  const outputPath = ttsSegmentOutputPath(segment);
  if (!outputPath) return null;
  const cached = ttsAudioUrlCache.value[outputPath];
  if (cached) return cached;
  const filePath = ttsOutputFilePath(segment);
  if (!filePath) return null;
  const url = await store.resolveStorageUrl(filePath);
  ttsAudioUrlCache.value = {
    ...ttsAudioUrlCache.value,
    [outputPath]: url,
  };
  return url;
};

const hydrateTtsWaveforms = async (): Promise<void> => {
  if (!import.meta.client) return;
  const token = ++ttsWaveformHydrationToken;
  for (const section of editorSections.value) {
    for (const [segmentIndex, segment] of section.finalyNarrations.entries()) {
      if (token !== ttsWaveformHydrationToken) return;
      const outputPath = ttsSegmentOutputPath(segment);
      if (!segment.isTtsGenerated || !outputPath || ttsWaveformCache.value[outputPath]?.length) {
        continue;
      }
      try {
        const audioData = await getTtsAudioBytes(segment);
        if (!audioData || token !== ttsWaveformHydrationToken) return;
        const waveform = await decodeRecordingWaveform(audioData);
        if (token !== ttsWaveformHydrationToken || waveform.length === 0) continue;
        ttsWaveformCache.value = {
          ...ttsWaveformCache.value,
          [outputPath]: waveform,
        };
      } catch (error) {
        reportDatadogError(error, {
          feature: "video_studio",
          operation: "hydrate_tts_waveform",
          sectionId: section.id,
          segmentIndex,
          outputPath,
        });
      }
    }
  }
};

const preloadTtsAudioUrls = async (): Promise<void> => {
  if (!import.meta.client) return;
  const section = selectedSectionForRecording.value;
  if (!section || !isTimingPreviewActive()) return;
  await Promise.all(
    section.finalyNarrations
      .filter((segment) => segment.isTtsGenerated && Boolean(ttsSegmentOutputPath(segment)))
      .map(async (segment) => {
        try {
          const url = await resolveTtsAudioUrl(segment);
          if (!url) return;
          const audio = new Audio();
          audio.preload = "auto";
          audio.src = url;
          audio.load();
        } catch {
          // Timing playback can still lazily resolve the URL later.
        }
      })
  );
};

watch(
  () => [
    aiNarrationMode.value,
    selectedSectionForRecording.value?.id ?? "",
    selectedSectionForRecording.value?.finalyNarrations
      .map((segment) => `${segment.isTtsGenerated ? "1" : "0"}:${ttsSegmentOutputPath(segment)}`)
      .join("|") ?? "",
  ] as const,
  () => {
    void preloadTtsAudioUrls();
  },
  { immediate: true }
);

const ttsWaveformBars = (
  sectionId: string,
  segmentIndex: number,
  segment: VideoStudioSection["finalyNarrations"][number],
  barCount: number
): WaveformBar[] => {
  const outputPath = ttsSegmentOutputPath(segment);
  const waveform = outputPath ? normalizedWaveform(ttsWaveformCache.value[outputPath]) : [];
  return resampleWaveformBars(waveform, barCount, ttsSegmentKey(sectionId, segmentIndex));
};

const stopTtsPreview = (): void => {
  ttsPreviewAudio?.pause();
  ttsPreviewAudio = null;
  playingTtsKey.value = null;
};

const toggleTtsPreview = async (
  sectionId: string,
  segmentIndex: number,
  segment: VideoStudioSection["finalyNarrations"][number]
): Promise<void> => {
  const key = ttsSegmentKey(sectionId, segmentIndex);
  if (playingTtsKey.value === key) {
    stopTtsPreview();
    return;
  }
  stopTtsPreview();
  try {
    const url = await resolveTtsAudioUrl(segment);
    if (!url) throw new Error("AI音声ファイルが見つかりません。");
    const audio = new Audio(url);
    ttsPreviewAudio = audio;
    playingTtsKey.value = key;
    audio.addEventListener("ended", stopTtsPreview, { once: true });
    audio.addEventListener("error", stopTtsPreview, { once: true });
    await audio.play();
  } catch (error) {
    stopTtsPreview();
    requestNotice.value = {
      kind: "error",
      message: error instanceof Error ? error.message : "AI音声の試聴に失敗しました。",
    };
    reportDatadogError(error, {
      feature: "video_studio",
      operation: "play_tts_preview",
      sectionId,
      segmentIndex,
      outputPath: ttsSegmentOutputPath(segment),
    });
  }
};

const hydrateRecordingWaveforms = async (): Promise<void> => {
  if (!import.meta.client) return;
  const token = ++recordingWaveformHydrationToken;
  for (const section of editorSections.value) {
    if (token !== recordingWaveformHydrationToken) return;
    const key = recordingCacheKey(section);
    if (!key) continue;
    const persisted = normalizedWaveform(section.recording?.waveform);
    if (persisted.length > 0) {
      recordingWaveformCache.value = {
        ...recordingWaveformCache.value,
        [key]: persisted,
      };
      continue;
    }
    if (recordingWaveformCache.value[key]?.length) continue;
    try {
      const audioData = await getRecordingAudioBytes(key);
      const waveform = await decodeRecordingWaveform(audioData);
      if (token !== recordingWaveformHydrationToken) return;
      if (waveform.length === 0) continue;
      recordingWaveformCache.value = {
        ...recordingWaveformCache.value,
        [key]: waveform,
      };
    } catch {
      // Waveform hydration is best-effort; playback can still use the audio URL.
    }
  }
};

watch(
  () =>
    editorSections.value
      .map((section) =>
        [
          section.id,
          recordingCacheKey(section),
          section.recording?.waveform?.length ?? 0,
        ].join(":")
      )
      .join("|") + `:${usesOriginalVideoAudio.value ? "source" : "recording"}`,
  () => {
    void hydrateRecordingWaveforms();
  },
  { immediate: true }
);

watch(
  () =>
    editorSections.value
      .map((section) =>
        section.finalyNarrations
          .map((segment, index) =>
            [
              section.id,
              index,
              segment.isTtsGenerated ? "1" : "0",
              ttsSegmentOutputPath(segment),
            ].join(":")
          )
          .join("|")
      )
      .join("||"),
  () => {
    void hydrateTtsWaveforms();
  },
  { immediate: true }
);

watch(
  () => ({
    isAiNarrationStep: isAiNarrationStep.value,
    view: store.view,
    projectId: store.selectedProject?.id ?? "",
    requestsKey: editorSections.value
      .map((section) =>
        [
          section.id,
          section.recording?.transcriptionRequestId ?? "",
          section.recording?.transcriptionStatus ?? "",
        ].join(":")
      )
      .join("|"),
  }),
  (state) => {
    if (!state?.isAiNarrationStep || state.view !== "editor") return;
    const token = ++transcriptionRecoveryToken;
    void recoverPendingRecordingTranscriptions().then(() => {
      if (token !== transcriptionRecoveryToken) return;
    });
  },
  { immediate: true }
);

const sourceLabel = (source: string): string =>
  source === "youtube"
    ? "YouTube"
    : source === "screen_recording"
      ? "スクリーン撮影"
      : "アップロード";

const sourceIcon = (source: string): string => {
  if (source === "youtube") return "i-simple-icons-youtube";
  if (source === "screen_recording") return "i-heroicons-video-camera";
  return "i-heroicons-arrow-up-tray";
};

const formatBytes = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const statusLabel = (status: string): string => {
  switch (status) {
    case "completed":
      return "完了";
    case "processing":
      return "処理中";
    case "error":
      return "エラー";
    default:
      return "待機";
  }
};

const statusClass = (status: string): string => {
  switch (status) {
    case "completed":
      return "bg-emerald-50 text-emerald-700";
    case "processing":
      return "bg-amber-50 text-amber-700";
    case "error":
      return "bg-red-50 text-red-700";
    default:
      return "bg-gray-100 text-gray-600";
  }
};

const projectStatusLabel = (status: string): string => {
  switch (status) {
    case "completed":
      return "完了";
    case "archived":
      return "アーカイブ";
    case "draft":
      return "下書き";
    default:
      return "進行中";
  }
};

function projectStepIndex(
  step: string,
  keys: readonly WorkflowStepKey[] = activeWorkflowStepKeys.value
): number {
  const normalizedStep = step === "recording" && !keys.includes("recording")
    ? "voice_generation"
    : step;
  return keys.findIndex((item) => item === normalizedStep);
}

function formatDuration(value: number): string {
  const total = Math.max(0, Math.floor(value || 0));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

const formatTimestamp = (value: Timestamp | Date | unknown): string => {
  const date =
    value && typeof value === "object" && "toDate" in value
      ? (value as Timestamp).toDate()
      : value instanceof Date
        ? value
        : null;
  if (!date) return "";
  return new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
};

onMounted(() => {
  window.addEventListener("keydown", onEditorKeydown, true);
  void store.loadVideos();
});

onUnmounted(() => {
  if (bodyOverflowBeforeEditor !== null) {
    document.body.style.overflow = bodyOverflowBeforeEditor;
    bodyOverflowBeforeEditor = null;
  }
  if (focusModeBeforeEditor !== null) {
    contextStore.focusModeIsActive = focusModeBeforeEditor;
    focusModeBeforeEditor = null;
  }
  contextStore.setVideoEditorActive(false);
  window.removeEventListener("keydown", onEditorKeydown, true);
  cleanupAutoSectionWatcher();
  cleanupRecordingRuntime();
  screenRecorder.dispose();
  stopTimingSegmentDrag();
  pauseTimingNarrationAudio();
  stopVoicePreview();
  stopTtsPreview();
});
</script>

<style scoped>
.vohance-workspace {
  font-feature-settings: "palt";
}

.bg-gray-850 {
  background-color: #111827;
}

.bg-gray-750 {
  background-color: #374151;
}

.video-editor-light {
  background: #f8f7ff;
  color: #1f2937;
}

.video-editor-light .bg-gray-950,
.video-editor-light .bg-slate-950 {
  background-color: #f8fafc;
}

.video-editor-light .bg-gray-900,
.video-editor-light .bg-slate-900,
.video-editor-light .bg-gray-850,
.video-editor-light .bg-gray-800,
.video-editor-light .bg-slate-800 {
  background-color: #ffffff;
}

.video-editor-light .bg-gray-750,
.video-editor-light .bg-gray-700,
.video-editor-light .bg-gray-700\/50 {
  background-color: #f1f5f9;
}

.video-editor-light .bg-gray-600,
.video-editor-light .hover\:bg-gray-600:hover,
.video-editor-light .hover\:bg-gray-700:hover,
.video-editor-light .hover\:bg-gray-750:hover,
.video-editor-light .hover\:bg-gray-800:hover,
.video-editor-light .hover\:bg-gray-850:hover {
  background-color: #e2e8f0;
}

.video-editor-light .border-gray-800,
.video-editor-light .border-gray-700,
.video-editor-light .border-gray-600,
.video-editor-light .border-slate-700 {
  border-color: #e5e7eb;
}

.video-editor-light :where(.text-gray-100, .text-gray-200, .text-gray-300, .text-gray-400, .text-gray-500) {
  color: #475569;
}

.video-editor-light :where(h2, h3, h4, p, span, label, div).text-white,
.video-editor-light :where(h2, h3, h4, p, span, label, div).text-gray-100 {
  color: #111827;
}

.video-editor-light button.bg-gray-700,
.video-editor-light button.bg-gray-800,
.video-editor-light button.bg-gray-900,
.video-editor-light button.bg-gray-950 {
  background-color: #ffffff;
  border: 1px solid #e5e7eb;
  color: #334155;
}

.video-editor-light button.bg-gray-700:hover,
.video-editor-light button.bg-gray-800:hover,
.video-editor-light button.bg-gray-900:hover,
.video-editor-light button.bg-gray-950:hover {
  background-color: #f1f5f9;
}

.video-editor-light textarea.bg-gray-950,
.video-editor-light input.bg-gray-950,
.video-editor-light input.bg-gray-900 {
  background-color: #ffffff;
  color: #111827;
}

.video-editor-light .bg-indigo-500,
.video-editor-light .bg-purple-500,
.video-editor-light .bg-purple-600,
.video-editor-light .bg-emerald-500,
.video-editor-light .bg-red-500,
.video-editor-light .bg-yellow-500,
.video-editor-light .bg-rose-400 {
  color: #ffffff;
}

.video-editor-light .text-emerald-100,
.video-editor-light .text-emerald-200,
.video-editor-light .text-indigo-100,
.video-editor-light .text-indigo-200,
.video-editor-light .text-amber-100,
.video-editor-light .text-amber-200,
.video-editor-light .text-red-100,
.video-editor-light .text-red-200 {
  color: inherit;
}

.video-editor-light .bg-emerald-500\/15,
.video-editor-light .bg-emerald-500\/20,
.video-editor-light .bg-emerald-500\/10,
.video-editor-light .bg-emerald-500\/5 {
  background-color: #ecfdf5;
  color: #047857;
}

.video-editor-light .bg-indigo-500\/15,
.video-editor-light .bg-indigo-500\/20,
.video-editor-light .bg-indigo-500\/10 {
  background-color: #eef2ff;
  color: #4338ca;
}

.video-editor-light .bg-red-500\/15,
.video-editor-light .bg-red-500\/10 {
  background-color: #fef2f2;
  color: #b91c1c;
}

.video-editor-light .bg-amber-500\/10 {
  background-color: #fffbeb;
  color: #b45309;
}

.video-editor-light .bg-black,
.video-editor-light .bg-black\/35 {
  background-color: #0f172a;
}

.video-editor-light .bg-black\/60,
.video-editor-light .bg-black\/80 {
  background-color: rgb(15 23 42 / 0.72);
}

.video-editor-light .shadow-\[0_0_40px_rgba\(99\,102\,241\,0\.65\)\] {
  box-shadow: 0 18px 45px -24px rgb(79 70 229 / 0.72);
}

.video-editor-light .audio-timing-segment {
  box-shadow: 0 10px 24px -18px rgb(79 70 229 / 0.65);
}

.video-editor-light footer {
  background-color: #ffffff;
  border-color: #e5e7eb;
  color: #64748b;
}
</style>
