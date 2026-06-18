<template>
  <div
    class="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4"
  >
    <button
      v-for="job in jobs"
      :key="job.kind"
      type="button"
      :class="[
        'group rounded-2xl border bg-white p-6 text-left transition-all duration-200',
        'hover:-translate-y-1 hover:shadow-lg focus:outline-none focus-visible:ring-2',
        job.borderHover,
        job.ringFocus,
      ]"
      @click="$emit('select', job.kind)"
    >
      <div
        :class="[
          'mb-4 flex h-14 w-14 items-center justify-center rounded-xl',
          job.iconBg,
        ]"
      >
        <UIcon :name="job.icon" :class="['h-8 w-8', job.iconColor]" />
      </div>
      <h3 class="text-lg font-bold text-neutral-900">
        {{ job.label }}
      </h3>
      <p class="mt-2 text-sm leading-relaxed text-neutral-600">
        {{ job.description }}
      </p>
      <p class="mt-4 text-xs text-neutral-400">
        例: {{ job.example }}
      </p>
    </button>
  </div>
</template>

<script setup lang="ts">
import type { AiStudioJobKind } from "@stores/aiStudio";

defineEmits<{
  (e: "select", kind: AiStudioJobKind): void;
}>();

const jobs: Array<{
  kind: AiStudioJobKind;
  label: string;
  description: string;
  example: string;
  icon: string;
  iconBg: string;
  iconColor: string;
  borderHover: string;
  ringFocus: string;
}> = [
  {
    kind: "consultation",
    label: "経営相談",
    description:
      "経営判断や数値変動の壁打ち。組織ナレッジを参照しつつ仮説を整理.",
    example: "最近の粗利率が落ちている、原因は?",
    icon: "material-symbols:psychology",
    iconBg: "bg-sky-50",
    iconColor: "text-sky-600",
    borderHover: "border-sky-100 hover:border-sky-400",
    ringFocus: "focus-visible:ring-sky-400",
  },
  {
    kind: "research",
    label: "リサーチ",
    description:
      "多 phase 構成のディープリサーチ。読み物 (HTML) + 図解 (SVG) を生成.",
    example: "中小企業の DX 動向を調べて読み物にして",
    icon: "material-symbols:search-insights",
    iconBg: "bg-purple-50",
    iconColor: "text-purple-600",
    borderHover: "border-purple-100 hover:border-purple-400",
    ringFocus: "focus-visible:ring-purple-400",
  },
  {
    kind: "writing",
    label: "文書生成",
    description:
      "メール・議事録・通知文など、コピペで使える文章をすぐ生成.",
    example: "顧客への謝罪メール、丁寧めで",
    icon: "material-symbols:edit-document",
    iconBg: "bg-emerald-50",
    iconColor: "text-emerald-600",
    borderHover: "border-emerald-100 hover:border-emerald-400",
    ringFocus: "focus-visible:ring-emerald-400",
  },
  {
    kind: "image",
    label: "画像生成",
    description:
      "OGP・アイコン・資料挿絵などを Imagen で生成. プロンプトを練り込み.",
    example: "OGP 用に信頼感のあるサービス紹介画像を",
    icon: "material-symbols:image",
    iconBg: "bg-violet-50",
    iconColor: "text-violet-600",
    borderHover: "border-violet-100 hover:border-violet-400",
    ringFocus: "focus-visible:ring-violet-400",
  },
];
</script>
