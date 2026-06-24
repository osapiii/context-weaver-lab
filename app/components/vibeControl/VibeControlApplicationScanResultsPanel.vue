<template>
  <section class="rounded-lg border border-slate-200 bg-white">
    <div class="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 p-4">
      <div class="min-w-0">
        <p class="text-xs font-medium uppercase tracking-wide text-emerald-600">
          Screen Atlas Assets
        </p>
        <h2 class="mt-1 truncate text-base font-semibold text-slate-900">
          {{ application?.name ?? "Application" }}
        </h2>
        <p class="mt-1 text-xs text-slate-500">
          画面遷移、スクリーンショット、状態Variantをアプリ資産として確認します
        </p>
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <button
          v-if="run"
          type="button"
          class="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 shadow-sm transition hover:border-primary-200 hover:text-primary-600"
          @click="emit('openProgress')"
        >
          <UIcon
            :name="run.status === 'pending' || run.status === 'processing' ? 'svg-spinners:180-ring' : 'material-symbols:timeline'"
            class="h-4 w-4"
          />
          進捗
        </button>
        <button
          v-if="application"
          type="button"
          class="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 shadow-sm transition hover:border-primary-200 hover:text-primary-600 disabled:cursor-not-allowed disabled:opacity-60"
          :disabled="isStartingScan"
          @click="emit('rescan')"
        >
          <UIcon
            :name="isStartingScan ? 'svg-spinners:180-ring' : 'material-symbols:refresh-rounded'"
            class="h-4 w-4"
          />
          Screen Atlasを再取得
        </button>
        <EnBadge v-if="run" :color="statusBadge.color" variant="soft">
          {{ statusBadge.label }}
        </EnBadge>
        <EnBadge v-if="application?.applicationKey" variant="tag">
          {{ application.applicationKey }}
        </EnBadge>
      </div>
    </div>

    <div v-if="!run" class="flex min-h-72 flex-col items-center justify-center px-4 py-12 text-center">
      <UIcon
        name="material-symbols:radar"
        class="h-12 w-12 text-slate-300"
      />
      <p class="mt-3 text-sm font-semibold text-slate-700">
        まだScreen Atlasがありません
      </p>
      <p class="mt-1 text-xs text-slate-500">
        基本情報タブからApplication Scanを実行すると、画面と状態のアセットがここに保存されます
      </p>
    </div>

    <div v-else class="space-y-4 p-4">
      <div class="grid gap-3 md:grid-cols-4">
        <div class="rounded-lg border border-slate-200 bg-slate-50 p-3">
          <p class="text-xs font-semibold text-slate-500">Start URL</p>
          <p class="mt-1 truncate text-sm font-semibold text-slate-900">
            {{ run.startUrl }}
          </p>
        </div>
        <div class="rounded-lg border border-slate-200 bg-slate-50 p-3">
          <p class="text-xs font-semibold text-slate-500">Screen Assets</p>
          <p class="mt-1 text-sm font-semibold text-slate-900">
            {{ screenshotCards.length }}
          </p>
        </div>
        <div class="rounded-lg border border-slate-200 bg-slate-50 p-3">
          <p class="text-xs font-semibold text-slate-500">Detected Routes</p>
          <p class="mt-1 text-sm font-semibold text-slate-900">
            {{ sitemapSummary }}
          </p>
        </div>
        <div class="rounded-lg border border-slate-200 bg-slate-50 p-3">
          <p class="text-xs font-semibold text-slate-500">Artifacts</p>
          <p class="mt-1 text-sm font-semibold text-slate-900">
            {{ artifactCards.length }}
          </p>
        </div>
      </div>

      <div class="grid gap-4 xl:grid-cols-[minmax(0,1fr)_24rem]">
        <div class="min-w-0 space-y-4">
          <div class="rounded-lg border border-slate-200 p-4">
            <div class="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p class="text-sm font-bold text-slate-900">Captured Screens</p>
                <p class="text-xs text-slate-500">
                  Playwright巡回とVariant探索で保存された画面状態
                </p>
              </div>
              <EnBadge v-if="syncingCount > 0" color="info" variant="soft">
                同期中 {{ syncingCount }}
              </EnBadge>
            </div>

            <div
              v-if="screenshotCards.length === 0"
              class="mt-4 rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-10 text-center text-xs text-slate-500"
            >
              スクリーンショットはまだ同期されていません
            </div>
            <div v-else class="mt-4 space-y-4">
              <div class="overflow-x-auto rounded-lg border border-slate-200 bg-slate-950 p-4">
                <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p class="text-sm font-bold text-white">Interaction Flow Map</p>
                    <p class="text-xs text-slate-400">
                      URL階層とスクリーンショットをつないだ画面遷移ツリー
                    </p>
                  </div>
                  <EnBadge variant="tag">
                    {{ screenshotFlowNodes.length }} pages
                  </EnBadge>
                </div>
                <div
                  v-if="screenshotFlowLevels.length === 0"
                  class="rounded-md border border-dashed border-slate-700 px-4 py-8 text-center text-xs text-slate-400"
                >
                  sitemapからURL pathを同期中です
                </div>
                <div v-else class="flex min-w-[48rem] items-start gap-4 pb-1">
                  <div
                    v-for="level in screenshotFlowLevels"
                    :key="level.depth"
                    class="min-w-72 flex-1"
                  >
                    <div class="mb-3 flex items-center gap-2">
                      <span class="h-px flex-1 bg-slate-700" />
                      <span class="rounded-full bg-slate-800 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-slate-300">
                        depth {{ level.depth }}
                      </span>
                      <span class="h-px flex-1 bg-slate-700" />
                    </div>
                    <div class="space-y-3">
                      <button
                        v-for="node in level.nodes"
                        :key="node.id"
                        type="button"
                        class="group relative grid w-full grid-cols-[5rem_minmax(0,1fr)] gap-2 rounded-lg border border-slate-700 bg-white p-2 text-left shadow-[4px_4px_0_rgba(15,23,42,0.5)] transition hover:-translate-y-0.5 hover:border-primary-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-300"
                        @click="previewArtifactId = node.artifact.artifactId"
                      >
                        <span
                          v-if="node.depth > 0"
                          class="absolute -left-5 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center text-primary-300"
                        >
                          <UIcon name="material-symbols:arrow-forward-rounded" class="h-5 w-5" />
                        </span>
                        <div class="h-14 overflow-hidden rounded-md bg-slate-100">
                          <AdkArtifactImage
                            :artifact-id="node.artifact.artifactId"
                            :session-id="run.sessionId"
                            :adk-filename="node.artifact.adkFilename"
                            :artifact-version="node.artifact.adkVersion"
                            :alt="node.title"
                            class="h-full w-full object-cover transition duration-200 group-hover:scale-[1.03]"
                          />
                        </div>
                        <div class="min-w-0 space-y-1">
                          <div class="flex items-center gap-2">
                            <span
                              class="h-2 w-2 shrink-0 rounded-full"
                              :class="node.colorClass"
                            />
                            <p class="truncate text-xs font-bold text-slate-900">
                              {{ node.label }}
                            </p>
                          </div>
                          <a
                            :href="node.pageUrl"
                            target="_blank"
                            rel="noopener"
                            class="block truncate rounded bg-slate-100 px-2 py-1 font-mono text-[10px] text-slate-600 hover:text-primary-600 hover:underline"
                            @click.stop
                          >
                            {{ node.pageUrl }}
                          </a>
                          <p
                            v-if="node.parentPath"
                            class="truncate text-[10px] text-slate-400"
                          >
                            from {{ node.parentPath }}
                          </p>
                        </div>
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div class="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
              <button
                v-for="screen in screenCards"
                :key="screen.id"
                type="button"
                class="group overflow-hidden rounded-lg border border-slate-200 bg-white text-left shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
                :class="screen.id === selectedScreen?.id ? 'border-primary-300 ring-2 ring-primary-100' : ''"
                @click="selectedScreenId = screen.id"
              >
                <div class="aspect-video overflow-hidden bg-slate-100">
                  <AdkArtifactImage
                    v-if="screen.screenshotCard"
                    :artifact-id="screen.screenshotCard.artifact.artifactId"
                    :session-id="run.sessionId"
                    :adk-filename="screen.screenshotCard.artifact.adkFilename"
                    :artifact-version="screen.screenshotCard.artifact.adkVersion"
                    :alt="screen.title"
                    class="h-full w-full object-cover transition duration-200 group-hover:scale-[1.03]"
                  />
                  <div
                    v-else
                    class="flex h-full items-center justify-center text-xs text-slate-400"
                  >
                    Screenshot同期中
                  </div>
                </div>
                <div class="p-3">
                  <p class="truncate text-xs font-bold text-slate-900">
                    {{ screen.title }}
                  </p>
                  <a
                    v-if="screen.url"
                    :href="screen.url"
                    target="_blank"
                    rel="noopener"
                    class="mt-1 block truncate font-mono text-[11px] text-slate-500 hover:text-primary-600 hover:underline"
                    @click.stop
                  >
                    {{ screen.url }}
                  </a>
                  <p v-else class="mt-1 truncate font-mono text-[11px] text-amber-600">
                    URL同期待ち
                  </p>
                  <div class="mt-2 flex items-center justify-between gap-2">
                    <p class="text-[11px] text-slate-500">
                      {{ screen.variants.length }} variants
                    </p>
                    <button
                      v-if="screen.screenshotCard"
                      type="button"
                      class="rounded-md border border-slate-200 px-2 py-1 text-[11px] font-semibold text-slate-600 hover:border-primary-200 hover:text-primary-600"
                      @click.stop="previewArtifactId = screen.screenshotCard.artifact.artifactId"
                    >
                      Preview
                    </button>
                  </div>
                </div>
              </button>
              </div>
            </div>
          </div>

          <div class="rounded-lg border border-slate-200 p-4">
            <p class="text-sm font-bold text-slate-900">Screen Atlas Artifact一覧</p>
            <div
              v-if="nonScreenshotCards.length === 0"
              class="mt-4 rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-10 text-center text-xs text-slate-500"
            >
              Screen Atlas Artifactを同期中です
            </div>
            <div v-else class="mt-4 grid gap-3 md:grid-cols-2">
              <article
                v-for="card in nonScreenshotCards"
                :key="card.artifact.artifactId"
                class="rounded-lg border border-slate-200 bg-slate-50 p-3"
              >
                <div class="flex items-center gap-2">
                  <UIcon :name="card.icon" class="h-4 w-4" :class="card.iconClass" />
                  <p class="truncate text-xs font-bold text-slate-900">
                    {{ card.title }}
                  </p>
                </div>
                <p class="mt-2 line-clamp-5 whitespace-pre-wrap text-[11px] leading-relaxed text-slate-600">
                  {{ card.preview }}
                </p>
              </article>
            </div>
          </div>
        </div>

        <aside class="min-w-0 space-y-4">
          <div class="rounded-lg border border-slate-200 p-4">
            <div class="flex flex-wrap items-start justify-between gap-3">
              <div class="min-w-0">
                <p class="text-sm font-bold text-slate-900">Screen詳細</p>
                <p class="mt-1 truncate font-mono text-[11px] text-slate-500">
                  {{ selectedScreen?.routeKey || "未選択" }}
                </p>
              </div>
              <EnButton
                v-if="selectedScreen?.url"
                variant="ai"
                size="xs"
                leading-icon="material-symbols:auto-awesome-outline"
                :disabled="isStartingScan"
                :loading="isStartingScan"
                @click="requestVariantExploration(selectedScreen)"
              >
                Variant探索
              </EnButton>
            </div>

            <div
              v-if="!selectedScreen"
              class="mt-3 rounded-md bg-slate-50 p-3 text-xs text-slate-500"
            >
              Screenを選択してください
            </div>
            <div v-else class="mt-3 space-y-3">
              <div>
                <p class="text-xs font-semibold text-slate-500">Title</p>
                <p class="mt-1 text-sm font-semibold text-slate-900">
                  {{ selectedScreen.title }}
                </p>
              </div>
              <div>
                <p class="text-xs font-semibold text-slate-500">URL</p>
                <a
                  :href="selectedScreen.url"
                  target="_blank"
                  rel="noopener"
                  class="mt-1 block break-all font-mono text-[11px] text-primary-600 hover:underline"
                >
                  {{ selectedScreen.url }}
                </a>
              </div>
              <div>
                <p class="text-xs font-semibold text-slate-500">Variants</p>
                <div
                  v-if="selectedScreenVariantItems.length === 0"
                  class="mt-2 rounded-md bg-slate-50 p-3 text-xs text-slate-500"
                >
                  まだVariantはありません。探索を実行するとここに追加されます。
                </div>
                <div v-else class="mt-2 space-y-2">
                  <article
                    v-for="variant in selectedScreenVariantItems"
                    :key="variant.id"
                    class="rounded-md border border-slate-200 bg-slate-50 p-3"
                  >
                    <div class="flex items-center justify-between gap-2">
                      <p class="truncate text-xs font-bold text-slate-900">
                        {{ variant.label }}
                      </p>
                      <EnBadge variant="tag">
                        {{ variant.variantKind }}
                      </EnBadge>
                    </div>
                    <p
                      v-if="variant.changedFromBase"
                      class="mt-2 line-clamp-3 text-[11px] leading-relaxed text-slate-600"
                    >
                      {{ variant.changedFromBase }}
                    </p>
                    <button
                      v-if="variant.screenshotArtifactId"
                      type="button"
                      class="mt-2 text-[11px] font-semibold text-primary-600 hover:underline"
                      @click="previewArtifactId = variant.screenshotArtifactId"
                    >
                      Screenshotを見る
                    </button>
                  </article>
                </div>
              </div>
            </div>
          </div>

          <div class="rounded-lg border border-slate-200 p-4">
            <p class="text-sm font-bold text-slate-900">Detected Routes</p>
            <div
              v-if="sitemapUrls.length === 0"
              class="mt-3 rounded-md bg-slate-50 p-3 text-xs text-slate-500"
            >
              sitemap JSONを待っています
            </div>
            <ol v-else class="mt-3 max-h-[32rem] space-y-2 overflow-y-auto pr-1">
              <li
                v-for="url in sitemapUrls"
                :key="url"
                class="rounded-md bg-slate-50 px-2 py-1.5 text-xs text-slate-700"
              >
                <a
                  :href="url"
                  target="_blank"
                  rel="noopener"
                  class="break-all hover:text-primary-600 hover:underline"
                >
                  {{ url }}
                </a>
              </li>
            </ol>
          </div>

          <div class="rounded-lg border border-slate-200 p-4">
            <p class="text-sm font-bold text-slate-900">Screen Atlas Summary</p>
            <EnMarkdown
              v-if="summaryBody"
              :markdown-text="summaryBody"
              variant="ai"
              compact
              class="mt-3 max-h-[28rem] overflow-y-auto rounded-md bg-slate-50 p-3"
            />
            <p v-else class="mt-3 rounded-md bg-slate-50 p-3 text-xs text-slate-500">
              summary markdownを待っています
            </p>
          </div>
        </aside>
      </div>
    </div>

    <EnModal
      :open="Boolean(previewArtifact)"
      title="Screenshot Preview"
      size="3xl"
      padding="sm"
      @update:open="previewArtifactId = $event ? previewArtifactId : ''"
    >
      <AdkArtifactImage
        v-if="previewArtifact && run"
        :artifact-id="previewArtifact.artifactId"
        :session-id="run.sessionId"
        :adk-filename="previewArtifact.adkFilename"
        :artifact-version="previewArtifact.adkVersion"
        :alt="previewArtifact.name ?? 'Application screenshot'"
        class="max-h-[70vh] w-full rounded-lg border border-slate-200 bg-slate-50 object-contain"
      />
    </EnModal>

    <EnModal
      v-model:open="variantMonitorOpen"
      title="Variant探索モニター"
      subtitle="対象画面、操作状態、生成Artifactを同期して確認します"
      title-icon="material-symbols:auto-awesome-motion-outline"
      size="3xl"
      padding="lg"
    >
      <div class="grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div class="min-w-0 space-y-4">
          <div class="overflow-hidden rounded-lg border border-slate-200 bg-slate-950">
            <div class="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 px-3 py-2">
              <div class="min-w-0">
                <p class="text-xs font-bold text-white">
                  {{ monitorPreviewLabel }}
                </p>
                <p class="mt-0.5 truncate font-mono text-[10px] text-slate-400">
                  {{ selectedScreen?.url || run?.startUrl || "" }}
                </p>
              </div>
              <EnBadge
                v-if="monitorPreviewCard?.kind"
                variant="tag"
              >
                {{ monitorPreviewCard.kind }}
              </EnBadge>
            </div>
            <div class="aspect-video bg-slate-900">
              <AdkArtifactImage
                v-if="monitorPreviewCard && run"
                :artifact-id="monitorPreviewCard.artifact.artifactId"
                :session-id="run.sessionId"
                :adk-filename="monitorPreviewCard.artifact.adkFilename"
                :artifact-version="monitorPreviewCard.artifact.adkVersion"
                :alt="monitorPreviewLabel"
                class="h-full w-full object-contain"
              />
              <div
                v-else
                class="flex h-full items-center justify-center text-xs text-slate-400"
              >
                画面プレビューを待っています
              </div>
            </div>
          </div>

          <div class="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <div class="flex flex-wrap items-center justify-between gap-3">
              <div class="min-w-0">
                <p class="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  対象Screen
                </p>
                <p class="mt-1 truncate text-sm font-bold text-slate-900">
                  {{ selectedScreen?.title || "Screen" }}
                </p>
                <p class="mt-1 truncate font-mono text-[11px] text-slate-500">
                  {{ selectedScreen?.url || run?.startUrl || "" }}
                </p>
              </div>
              <EnBadge :color="statusBadge.color" variant="soft">
                {{ statusBadge.label }}
              </EnBadge>
            </div>
          </div>

          <div class="rounded-lg border border-slate-200 p-4">
            <p class="text-sm font-bold text-slate-900">探索ステップ</p>
            <div
              v-if="variantProgressEvents.length === 0"
              class="mt-3 rounded-md bg-slate-50 p-3 text-xs text-slate-500"
            >
              ADK session stateの更新を待っています
            </div>
            <ol v-else class="mt-3 space-y-2">
              <li
                v-for="event in variantProgressEvents"
                :key="event.key"
                class="rounded-md border border-slate-200 bg-white p-3"
              >
                <div class="flex items-center justify-between gap-2">
                  <p class="text-xs font-bold text-slate-900">
                    {{ event.label }}
                  </p>
                  <span class="font-mono text-[10px] text-slate-400">
                    {{ event.time }}
                  </span>
                </div>
                <p class="mt-1 break-all text-[11px] leading-relaxed text-slate-600">
                  {{ event.detail }}
                </p>
              </li>
            </ol>
          </div>

          <div class="rounded-lg border border-slate-200 p-4">
            <p class="text-sm font-bold text-slate-900">生成Variant</p>
            <div
              v-if="selectedScreenVariantItems.length === 0"
              class="mt-3 rounded-md bg-slate-50 p-3 text-xs text-slate-500"
            >
              Variant Artifactを待っています
            </div>
            <div v-else class="mt-3 grid gap-3 md:grid-cols-2">
              <article
                v-for="variant in selectedScreenVariantItems"
                :key="variant.id"
                class="rounded-lg border border-slate-200 bg-white p-3"
              >
                <div class="flex items-center justify-between gap-2">
                  <p class="truncate text-xs font-bold text-slate-900">
                    {{ variant.label }}
                  </p>
                  <EnBadge variant="tag">
                    {{ variant.variantKind }}
                  </EnBadge>
                </div>
                <p
                  v-if="variant.changedFromBase"
                  class="mt-2 line-clamp-4 text-[11px] leading-relaxed text-slate-600"
                >
                  {{ variant.changedFromBase }}
                </p>
                <button
                  v-if="variant.screenshotArtifactId"
                  type="button"
                  class="mt-2 text-[11px] font-semibold text-primary-600 hover:underline"
                  @click="previewArtifactId = variant.screenshotArtifactId"
                >
                  Screenshotを開く
                </button>
              </article>
            </div>
          </div>
        </div>

        <aside class="min-w-0 space-y-4">
          <div class="rounded-lg border border-slate-200 p-4">
            <p class="text-sm font-bold text-slate-900">Session状態</p>
            <dl class="mt-3 space-y-2 text-xs">
              <div class="flex justify-between gap-3">
                <dt class="text-slate-500">Session</dt>
                <dd class="min-w-0 truncate font-mono text-slate-700">
                  {{ run?.sessionId || "-" }}
                </dd>
              </div>
              <div class="flex justify-between gap-3">
                <dt class="text-slate-500">Phase</dt>
                <dd class="font-semibold text-slate-800">
                  {{ applicationScanSessionState.phase || "-" }}
                </dd>
              </div>
              <div class="flex justify-between gap-3">
                <dt class="text-slate-500">Current</dt>
                <dd class="min-w-0 truncate font-mono text-slate-700">
                  {{ currentProgressUrl || "-" }}
                </dd>
              </div>
            </dl>
          </div>

          <div class="rounded-lg border border-emerald-100 bg-emerald-50 p-4">
            <p class="text-sm font-bold text-emerald-900">安全制約</p>
            <ul class="mt-2 space-y-1 text-[11px] leading-relaxed text-emerald-800">
              <li>同一origin内の非破壊操作のみ探索します</li>
              <li>保存、送信、購入、招待、削除はブロックします</li>
              <li>チャット送信とフォーム送信は既定では実行しません</li>
            </ul>
          </div>

          <div class="rounded-lg border border-slate-200 p-4">
            <p class="text-sm font-bold text-slate-900">同期Artifact</p>
            <div class="mt-3 space-y-2">
              <article
                v-for="card in recentVariantArtifacts"
                :key="card.artifact.artifactId"
                class="rounded-md bg-slate-50 p-2"
              >
                <p class="truncate text-[11px] font-bold text-slate-800">
                  {{ card.title }}
                </p>
                <p class="mt-1 text-[10px] text-slate-500">
                  {{ card.kind }} / {{ card.artifact.status }}
                </p>
              </article>
              <p
                v-if="recentVariantArtifacts.length === 0"
                class="rounded-md bg-slate-50 p-3 text-xs text-slate-500"
              >
                Artifact syncを待っています
              </p>
            </div>
          </div>
        </aside>
      </div>
    </EnModal>
  </section>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from "vue";
import AdkArtifactImage from "@components/AgentWorkspace/AdkArtifactImage.vue";
import {
  fetchAdkSessionState,
  subscribeActiveAdkSession,
} from "@composables/useAiStudioSessions";
import { useAdkSessionArtifacts } from "@composables/useAdkSessionArtifacts";
import type { DecodedAdkSessionArtifact } from "@models/adkSessionArtifact";
import type {
  DecodedVibeControlApplication,
  VibeControlApplicationScanRun,
} from "@models/vibeControl";
import type { RequestStatus } from "@models/core/requestStatus";
import { fetchArtifactTextContent } from "@utils/artifactDisplayUrl";

const props = defineProps<{
  application: DecodedVibeControlApplication | null;
  run: VibeControlApplicationScanRun | null;
  isStartingScan?: boolean;
}>();

const emit = defineEmits<{
  rescan: [];
  openProgress: [];
  exploreScreenVariants: [
    input: { screenId: string; screenUrl: string; routeKey?: string },
  ];
}>();

type ArtifactCardKind = "screenshot" | "sitemap" | "summary" | "other";

type ScanSitemapScreenshotRef = {
  filename?: string;
  version?: number;
};

type ScanSitemapPage = {
  screenId: string;
  sourceAssetId?: string;
  url: string;
  routeKey: string;
  title: string;
  screenshot?: ScanSitemapScreenshotRef | null;
  variants: ScanSitemapVariant[];
};

type ScanSitemapVariant = {
  id: string;
  label: string;
  variantKind: string;
  changedFromBase: string;
  screenshotFilename?: string;
  screenshotArtifactId?: string;
};

type ScreenshotFlowNode = {
  id: string;
  artifact: DecodedAdkSessionArtifact;
  title: string;
  label: string;
  pageUrl: string;
  urlPath: string;
  parentPath: string;
  depth: number;
  colorClass: string;
};

type ScreenshotFlowLevel = {
  depth: number;
  nodes: ScreenshotFlowNode[];
};

type ArtifactCard = {
  artifact: DecodedAdkSessionArtifact;
  kind: ArtifactCardKind;
  title: string;
  pageUrl: string;
  urlPath: string;
  preview: string;
  icon: string;
  iconClass: string;
};

type ScreenCard = {
  id: string;
  url: string;
  routeKey: string;
  title: string;
  screenshotCard: ArtifactCard | null;
  variants: ScanSitemapVariant[];
};

const artifacts = ref<DecodedAdkSessionArtifact[]>([]);
const textByArtifactId = ref<Record<string, string>>({});
const previewArtifactId = ref("");
const selectedScreenId = ref("");
const variantMonitorOpen = ref(false);
const sessionState = ref<Record<string, unknown>>({});
let stopArtifacts: (() => void) | null = null;
let stopSession: (() => void) | null = null;

const { subscribe } = useAdkSessionArtifacts();

const statusLabels: Record<RequestStatus, string> = {
  pending: "待機中",
  processing: "実行中",
  completed: "完了",
  error: "失敗",
};

const statusColors = {
  pending: "warning",
  processing: "info",
  completed: "success",
  error: "error",
} as const;

const statusBadge = computed(() => {
  const status = props.run?.status ?? "pending";
  return {
    label: statusLabels[status],
    color: statusColors[status],
  };
});

const sitemapArtifact = computed(() =>
  artifacts.value.find((artifact) => {
    const filename = artifact.adkFilename || artifact.name || artifact.artifactId;
    const lower = filename.toLowerCase();
    return lower.includes("sitemap") || lower.includes("screen_atlas");
  })
);

const summaryArtifact = computed(() =>
  artifacts.value.find((artifact) => {
    const filename = artifact.adkFilename || artifact.name || artifact.artifactId;
    return filename.toLowerCase().includes("summary");
  })
);

const parsedSitemapPages = computed<ScanSitemapPage[]>(() => {
  const text = sitemapArtifact.value
    ? textByArtifactId.value[sitemapArtifact.value.artifactId]
    : "";
  if (!text) return [];
  try {
    const parsed = JSON.parse(text) as {
      pages?: Array<Record<string, unknown>>;
    };
    const pages: ScanSitemapPage[] = [];
    for (const page of parsed.pages ?? []) {
      const url = typeof page.url === "string" ? page.url.trim() : "";
      if (!url) continue;
      const screenshot = isRecord(page.screenshot)
        ? {
            filename:
              typeof page.screenshot.filename === "string"
                ? page.screenshot.filename
                : undefined,
            version:
              typeof page.screenshot.version === "number"
                ? page.screenshot.version
                : undefined,
          }
        : null;
      pages.push({
        screenId:
          typeof page.screenId === "string" && page.screenId.trim()
            ? page.screenId.trim()
            : `screen-${pages.length + 1}`,
        sourceAssetId:
          typeof page.sourceAssetId === "string" ? page.sourceAssetId : undefined,
        url,
        routeKey:
          typeof page.routeKey === "string" && page.routeKey.trim()
            ? page.routeKey
            : formatUrlPath(url),
        title: typeof page.title === "string" ? page.title : "",
        screenshot,
        variants: parseSitemapVariants(page.variants),
      });
    }
    return pages;
  } catch {
    return [];
  }
});

const sitemapPageByArtifactKey = computed(() => {
  const out = new Map<string, ScanSitemapPage>();
  for (const page of parsedSitemapPages.value) {
    const filename = page.screenshot?.filename?.trim();
    if (!filename) continue;
    out.set(filename, page);
    if (page.screenshot?.version != null) {
      out.set(`${filename}:${page.screenshot.version}`, page);
    }
  }
  return out;
});

const artifactCards = computed<ArtifactCard[]>(() =>
  artifacts.value.map((artifact) => {
    const filename = artifact.adkFilename || artifact.name || artifact.artifactId;
    const lower = filename.toLowerCase();
    const kind: ArtifactCardKind = lower.includes("screenshot")
      ? "screenshot"
      : lower.includes("sitemap") || lower.includes("screen_atlas")
        ? "sitemap"
        : lower.includes("summary")
          ? "summary"
          : "other";
    const text = textByArtifactId.value[artifact.artifactId] ?? "";
    const page = resolveSitemapPageForArtifact(artifact);
    const metadataUrl = metadataString(artifact.customMetadata, "url");
    const pageUrl = page?.url || metadataUrl;
    const urlPath = pageUrl ? formatUrlPath(pageUrl) : "";
    return {
      artifact,
      kind,
      title: artifact.name || artifact.prompt || filename,
      pageUrl,
      urlPath,
      preview: previewText({ artifact, kind, text }),
      icon:
        kind === "sitemap"
          ? "material-symbols:account-tree-outline"
          : kind === "summary"
            ? "material-symbols:article-outline"
            : "material-symbols:insert-drive-file-outline",
      iconClass:
        kind === "sitemap"
          ? "text-sky-500"
          : kind === "summary"
            ? "text-emerald-500"
            : "text-slate-500",
    };
  })
);

const screenshotCards = computed(() =>
  artifactCards.value.filter((card) => card.kind === "screenshot")
);

const screenCards = computed<ScreenCard[]>(() => {
  const cardsByFilename = new Map<string, ArtifactCard>();
  const baseScreenshotCards: ArtifactCard[] = [];
  for (const card of screenshotCards.value) {
    const captureKind = metadataString(card.artifact.customMetadata, "captureKind");
    const filename = card.artifact.adkFilename.trim();
    if (filename) cardsByFilename.set(filename, card);
    if (captureKind !== "screen_variant") {
      baseScreenshotCards.push(card);
    }
  }
  const pages = parsedSitemapPages.value;
  if (pages.length > 0) {
    return pages.map((page, index) => {
      const screenshotCard =
        (page.screenshot?.filename
          ? cardsByFilename.get(page.screenshot.filename)
          : undefined) ??
        baseScreenshotCards.find((card) => card.pageUrl === page.url) ??
        baseScreenshotCards[index] ??
        null;
      return {
        id: page.screenId,
        url: page.url,
        routeKey: page.routeKey,
        title: page.title || page.routeKey || page.url,
        screenshotCard,
        variants: mergeVariantArtifacts(page.variants, page.screenId),
      };
    });
  }
  return baseScreenshotCards.map((card, index) => {
    const screenId =
      metadataString(card.artifact.customMetadata, "screenId") ||
      `screen-${index + 1}`;
    return {
      id: screenId,
      url: card.pageUrl,
      routeKey:
        metadataString(card.artifact.customMetadata, "routeKey") ||
        formatUrlPath(card.pageUrl),
      title: card.title,
      screenshotCard: card,
      variants: mergeVariantArtifacts([], screenId),
    };
  });
});

const selectedScreen = computed<ScreenCard | null>(() => {
  if (screenCards.value.length === 0) return null;
  return (
    screenCards.value.find((screen) => screen.id === selectedScreenId.value) ??
    screenCards.value[0] ??
    null
  );
});

const selectedScreenVariantItems = computed<ScanSitemapVariant[]>(() =>
  selectedScreen.value?.variants ?? []
);

const nonScreenshotCards = computed(() =>
  artifactCards.value.filter((card) => card.kind !== "screenshot")
);

const recentVariantArtifacts = computed(() =>
  artifactCards.value
    .filter((card) => {
      const captureKind = metadataString(card.artifact.customMetadata, "captureKind");
      const filename = card.artifact.adkFilename.toLowerCase();
      return captureKind === "screen_variant" || filename.includes("variant");
    })
    .slice(-8)
);

const monitorPreviewCard = computed<ArtifactCard | null>(() => {
  const latestVariantWithScreenshot = [...selectedScreenVariantItems.value]
    .reverse()
    .find((variant) => variant.screenshotArtifactId);
  if (latestVariantWithScreenshot?.screenshotArtifactId) {
    const variantCard = artifactCards.value.find(
      (card) =>
        card.artifact.artifactId ===
        latestVariantWithScreenshot.screenshotArtifactId
    );
    if (variantCard) return variantCard;
  }
  const latestSyncedVariantScreenshot = [...recentVariantArtifacts.value]
    .reverse()
    .find((card) => card.kind === "screenshot");
  return (
    latestSyncedVariantScreenshot ??
    selectedScreen.value?.screenshotCard ??
    null
  );
});

const monitorPreviewLabel = computed(() => {
  const variant = [...selectedScreenVariantItems.value]
    .reverse()
    .find((item) => item.screenshotArtifactId === monitorPreviewCard.value?.artifact.artifactId);
  if (variant) return `最新Variant: ${variant.label}`;
  return selectedScreen.value?.title
    ? `Base Screen: ${selectedScreen.value.title}`
    : "画面プレビュー";
});

const syncingCount = computed(
  () => artifacts.value.filter((artifact) => artifact.status === "syncing").length
);

const sitemapUrls = computed(() =>
  normalizedPageUrlsForDisplay(parsedSitemapPages.value.map((page) => page.url))
);

const sitemapSummary = computed(() => {
  if (sitemapUrls.value.length > 0) return `${sitemapUrls.value.length} URLs`;
  return sitemapArtifact.value ? "同期中" : "未生成";
});

const summaryBody = computed(() =>
  summaryArtifact.value
    ? textByArtifactId.value[summaryArtifact.value.artifactId] ?? ""
    : ""
);

const previewArtifact = computed(() =>
  artifacts.value.find((artifact) => artifact.artifactId === previewArtifactId.value)
);

const screenshotFlowNodes = computed<ScreenshotFlowNode[]>(() =>
  buildScreenshotFlowNodes()
);

const screenshotFlowLevels = computed<ScreenshotFlowLevel[]>(() => {
  const byDepth = new Map<number, ScreenshotFlowNode[]>();
  for (const node of screenshotFlowNodes.value) {
    const list = byDepth.get(node.depth) ?? [];
    list.push(node);
    byDepth.set(node.depth, list);
  }
  return [...byDepth.entries()]
    .sort(([a], [b]) => a - b)
    .map(([depth, nodes]) => ({
      depth,
      nodes: nodes.sort((a, b) => a.urlPath.localeCompare(b.urlPath)),
    }));
});

const applicationScanSessionState = computed<Record<string, unknown>>(() => {
  const bucket = sessionState.value.application_scan;
  return isRecord(bucket) ? bucket : {};
});

const applicationScanProgress = computed<Record<string, unknown>>(() => {
  const progress = applicationScanSessionState.value.progress;
  return isRecord(progress) ? progress : {};
});

const currentProgressUrl = computed(
  () =>
    stringValue(applicationScanProgress.value.current_url) ||
    stringValue(applicationScanProgress.value.currentUrl)
);

const variantProgressEvents = computed(() => {
  const progress = applicationScanProgress.value;
  const events: Array<{ key: string; label: string; detail: string; time: string }> = [];
  const currentUrl =
    stringValue(progress.current_url) || stringValue(progress.currentUrl);
  const startedAt =
    stringValue(progress.started_at) || stringValue(progress.startedAt);
  const updatedAt =
    stringValue(progress.updated_at) || stringValue(progress.updatedAt);
  if (startedAt) {
    events.push({
      key: "started",
      label: "探索開始",
      detail: currentUrl || selectedScreen.value?.url || "",
      time: startedAt,
    });
  }
  if (currentUrl) {
    events.push({
      key: "current",
      label: "画面操作中",
      detail: currentUrl,
      time: updatedAt || startedAt || "",
    });
  }
  for (const failure of variantFailureEvents.value) {
    events.push(failure);
  }
  if (selectedScreenVariantItems.value.length > 0) {
    events.push({
      key: "variants",
      label: "Variant生成",
      detail: `${selectedScreenVariantItems.value.length}件のvariantを検出`,
      time: updatedAt || "",
    });
  }
  return events;
});

const variantFailureEvents = computed(() => {
  const failures = applicationScanSessionState.value.variantFailures;
  if (!Array.isArray(failures)) return [];
  return failures
    .filter(isRecord)
    .map((failure, index) => ({
      key: `failure-${index}`,
      label: "探索スキップ/ブロック",
      detail: stringValue(failure.error) || JSON.stringify(failure),
      time: "",
    }));
});

watch(
  () => props.run?.sessionId,
  (sessionId) => {
    stopArtifacts?.();
    stopArtifacts = null;
    artifacts.value = [];
    textByArtifactId.value = {};
    previewArtifactId.value = "";
    sessionState.value = {};
    stopSession?.();
    stopSession = null;
    if (!sessionId) return;
    stopSession = subscribeActiveAdkSession({
      sessionId,
      onRecord: (record) => {
        if (!record) {
          sessionState.value = {};
          return;
        }
        void fetchAdkSessionState(sessionId).then((state) => {
          sessionState.value = state ?? {};
        });
      },
    });
    stopArtifacts = subscribe({
      sessionId,
      onUpdate: (next) => {
        artifacts.value = [...next.values()].sort((a, b) =>
          (a.adkFilename || a.artifactId).localeCompare(
            b.adkFilename || b.artifactId
          )
        );
        void loadTextArtifacts();
      },
    });
  },
  { immediate: true }
);

watch(
  screenCards,
  (screens) => {
    if (screens.length === 0) {
      selectedScreenId.value = "";
      return;
    }
    if (!screens.some((screen) => screen.id === selectedScreenId.value)) {
      selectedScreenId.value = screens[0]?.id ?? "";
    }
  },
  { immediate: true }
);

onBeforeUnmount(() => {
  stopArtifacts?.();
  stopSession?.();
});

async function loadTextArtifacts(): Promise<void> {
  const textArtifacts = artifacts.value.filter((artifact) => {
    const contentType = artifact.contentType.toLowerCase();
    const filename = artifact.adkFilename.toLowerCase();
    const gcsPath = textArtifactGcsPath(artifact);
    return (
      artifact.status !== "failed" &&
      gcsPath &&
      (contentType.includes("json") ||
        contentType.includes("markdown") ||
        contentType.includes("text") ||
        filename.endsWith(".json") ||
        filename.endsWith(".md"))
    );
  });
  for (const artifact of textArtifacts) {
    if (textByArtifactId.value[artifact.artifactId]) continue;
    const gcsPath = textArtifactGcsPath(artifact);
    if (!gcsPath) continue;
    const text = await fetchArtifactTextContent({
      storageGcsPath: gcsPath,
      contentType: artifact.contentType,
    });
    if (text) {
      textByArtifactId.value = {
        ...textByArtifactId.value,
        [artifact.artifactId]: text,
      };
    }
  }
}

function textArtifactGcsPath(artifact: DecodedAdkSessionArtifact): string {
  return artifact.storageGcsPath.trim() || artifact.sourceGcsPath.trim();
}

function requestVariantExploration(screen: ScreenCard): void {
  variantMonitorOpen.value = true;
  emit("exploreScreenVariants", {
    screenId: screen.id,
    screenUrl: screen.url,
    routeKey: screen.routeKey,
  });
}

function parseSitemapVariants(value: unknown): ScanSitemapVariant[] {
  if (!Array.isArray(value)) return [];
  return value.filter(isRecord).map((variant, index) => {
    const screenshot = isRecord(variant.screenshot)
      ? variant.screenshot
      : undefined;
    const observation = isRecord(variant.observation)
      ? variant.observation
      : undefined;
    return {
      id:
        stringValue(variant.variantId) ||
        stringValue(variant.id) ||
        `variant-${index + 1}`,
      label:
        stringValue(variant.label) ||
        stringValue(variant.variantKind) ||
        `Variant ${index + 1}`,
      variantKind: stringValue(variant.variantKind) || "unknown",
      changedFromBase: stringValue(variant.changedFromBase),
      screenshotFilename:
        stringValue(variant.screenshotFilename) ||
        stringValue(screenshot?.filename) ||
        stringValue(observation?.screenshotFilename),
    };
  });
}

function mergeVariantArtifacts(
  baseVariants: ScanSitemapVariant[],
  screenId: string
): ScanSitemapVariant[] {
  const byId = new Map<string, ScanSitemapVariant>();
  for (const variant of baseVariants) {
    byId.set(variant.id, { ...variant });
  }
  for (const card of artifactCards.value) {
    const metadata = card.artifact.customMetadata;
    if (metadataString(metadata, "screenId") !== screenId) continue;
    if (metadataString(metadata, "captureKind") !== "screen_variant") continue;
    const variantId =
      metadataString(metadata, "variantId") ||
      metadataString(metadata, "sourceAssetId") ||
      card.artifact.artifactId;
    const existing = byId.get(variantId) ?? {
      id: variantId,
      label:
        metadataString(metadata, "variantKind") ||
        card.title ||
        "Screen Variant",
      variantKind: metadataString(metadata, "variantKind") || "unknown",
      changedFromBase: "",
    };
    if (card.kind === "screenshot") {
      existing.screenshotArtifactId = card.artifact.artifactId;
      existing.screenshotFilename = card.artifact.adkFilename;
    } else if (!existing.changedFromBase && card.preview) {
      existing.changedFromBase = card.preview;
    }
    byId.set(variantId, existing);
  }
  return [...byId.values()].sort((a, b) => a.id.localeCompare(b.id));
}

function buildScreenshotFlowNodes(): ScreenshotFlowNode[] {
  const candidates = screenshotCards.value.filter((card) => Boolean(card.pageUrl));
  const groupCounts = new Map<string, number>();
  for (const card of candidates) {
    const groupUrl = flowGroupUrl(card.pageUrl);
    groupCounts.set(groupUrl, (groupCounts.get(groupUrl) ?? 0) + 1);
  }
  const hasRepeatedGroup = [...groupCounts.values()].some((count) => count > 1);
  const byGroup = new Map<string, ScreenshotFlowNode>();

  candidates.forEach((card, index) => {
    const groupUrl = flowGroupUrl(card.pageUrl);
    const shouldKeep =
      groupUrl === originRootUrl(card.pageUrl) ||
      !hasRepeatedGroup ||
      (groupCounts.get(groupUrl) ?? 0) > 1;
    if (!shouldKeep) return;

    const urlPath = formatUrlPath(groupUrl);
    const segments = urlPathSegments(urlPath);
    const depth = Math.max(0, segments.length - 1);
    const node: ScreenshotFlowNode = {
      id: card.artifact.artifactId,
      artifact: card.artifact,
      title: card.title,
      label: flowNodeLabel({ title: card.title, urlPath }),
      pageUrl: groupUrl,
      urlPath,
      parentPath: parentPathFor(urlPath),
      depth,
      colorClass: flowColorClass(segments[0] || urlPath, index),
    };
    const existing = byGroup.get(groupUrl);
    const exactGroupCapture = canonicalUrlWithoutQuery(card.pageUrl) === groupUrl;
    if (!existing || exactGroupCapture) {
      byGroup.set(groupUrl, node);
    }
  });

  return [...byGroup.values()].sort(
    (a, b) => a.depth - b.depth || a.pageUrl.localeCompare(b.pageUrl)
  );
}

function normalizedPageUrlsForDisplay(urls: string[]): string[] {
  const cleaned = urls.map(canonicalUrlWithoutQuery).filter(Boolean);
  const groupCounts = new Map<string, number>();
  for (const url of cleaned) {
    const groupUrl = flowGroupUrl(url);
    groupCounts.set(groupUrl, (groupCounts.get(groupUrl) ?? 0) + 1);
  }
  const hasRepeatedGroup = [...groupCounts.values()].some((count) => count > 1);
  const out = new Set<string>();
  for (const url of cleaned) {
    const groupUrl = flowGroupUrl(url);
    const shouldKeep =
      groupUrl === originRootUrl(url) ||
      !hasRepeatedGroup ||
      (groupCounts.get(groupUrl) ?? 0) > 1;
    if (shouldKeep) {
      out.add(groupUrl);
    }
  }
  return [...out].sort((a, b) => formatUrlPath(a).localeCompare(formatUrlPath(b)));
}

function resolveSitemapPageForArtifact(
  artifact: DecodedAdkSessionArtifact
): ScanSitemapPage | undefined {
  const filename = artifact.adkFilename.trim();
  if (!filename) return undefined;
  return (
    sitemapPageByArtifactKey.value.get(`${filename}:${artifact.adkVersion}`) ??
    sitemapPageByArtifactKey.value.get(filename)
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function metadataString(
  metadata: Record<string, unknown> | undefined,
  key: string
): string {
  const value = metadata?.[key];
  return typeof value === "string" ? value.trim() : "";
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function formatUrlPath(rawUrl: string): string {
  try {
    const parsed = new URL(rawUrl);
    const path = parsed.pathname && parsed.pathname !== "/" ? parsed.pathname : "/";
    return path.replace(/\/{2,}/g, "/");
  } catch {
    return rawUrl.split("?")[0]?.trim() || "/";
  }
}

function canonicalUrlWithoutQuery(rawUrl: string): string {
  try {
    const parsed = new URL(rawUrl);
    const path = parsed.pathname && parsed.pathname !== "/" ? parsed.pathname : "/";
    const normalizedPath = path.replace(/\/{2,}/g, "/");
    return `${parsed.origin}${normalizedPath === "/" ? "/" : normalizedPath.replace(/\/$/, "")}`;
  } catch {
    return rawUrl.split("?")[0]?.trim() || rawUrl.trim();
  }
}

function originRootUrl(rawUrl: string): string {
  try {
    return `${new URL(rawUrl).origin}/`;
  } catch {
    return rawUrl;
  }
}

function flowGroupUrl(rawUrl: string): string {
  try {
    const parsed = new URL(rawUrl);
    const segments = parsed.pathname.split("/").filter(Boolean);
    if (segments.length === 0) return `${parsed.origin}/`;
    return `${parsed.origin}/${segments[0]}`;
  } catch {
    const path = rawUrl.split("?")[0]?.trim() || rawUrl.trim();
    const segments = path.split("/").filter(Boolean);
    return segments.length > 0 ? `/${segments[0]}` : "/";
  }
}

function urlPathSegments(urlPath: string): string[] {
  const withoutQuery = urlPath.split("?")[0] ?? urlPath;
  const segments = withoutQuery.split("/").filter(Boolean);
  return segments.length > 0 ? segments : ["home"];
}

function parentPathFor(urlPath: string): string {
  const segments = urlPathSegments(urlPath);
  if (segments.length <= 1) return "";
  return `/${segments.slice(0, -1).join("/")}`;
}

function flowNodeLabel(params: { title: string; urlPath: string }): string {
  const segments = urlPathSegments(params.urlPath);
  const last = segments.at(-1) ?? "home";
  if (params.urlPath === "/") return "Home";
  return decodeURIComponent(last).replace(/[-_]+/g, " ") || params.title;
}

function flowColorClass(seed: string, index: number): string {
  const colors = [
    "bg-pink-400",
    "bg-sky-400",
    "bg-emerald-400",
    "bg-orange-400",
    "bg-violet-400",
    "bg-cyan-300",
  ];
  const sum = [...seed].reduce((acc, char) => acc + char.charCodeAt(0), index);
  return colors[sum % colors.length] ?? "bg-slate-400";
}

function previewText(params: {
  artifact: DecodedAdkSessionArtifact;
  kind: ArtifactCardKind;
  text: string;
}): string {
  if (params.text) {
    if (params.kind === "sitemap") {
      try {
        const parsed = JSON.parse(params.text) as {
          summary?: { pageCount?: number; screenshotCount?: number; failureCount?: number };
        };
        const summary = parsed.summary;
        if (summary) {
          return `${summary.pageCount ?? 0} pages / ${summary.screenshotCount ?? 0} screenshots / ${summary.failureCount ?? 0} failures`;
        }
      } catch {
        return params.text.slice(0, 240);
      }
    }
    return params.text.replace(/\s+/g, " ").trim().slice(0, 260);
  }
  if (params.artifact.status === "failed") {
    return params.artifact.syncError || "同期に失敗しました";
  }
  return "Artifactを同期中です";
}

</script>
