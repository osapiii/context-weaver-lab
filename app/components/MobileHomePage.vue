<template>
  <div class="px-4 pt-6 pb-10 max-w-md mx-auto">
    <div class="mb-6">
      <h1 class="text-2xl font-extrabold tracking-tight text-slate-900">
        AI に仕事を任せる
      </h1>
      <p class="text-sm text-slate-600 mt-1">
        タップするとそのまま AI が作業を始めます。
      </p>
    </div>

    <div class="space-y-4">
      <button
        v-for="card in cards"
        :key="card.key"
        type="button"
        class="w-full text-left rounded-2xl bg-white border border-slate-200 shadow-sm active:shadow-inner active:bg-slate-50 transition-all px-5 py-5 flex items-start gap-4"
        @click="invoke(card)"
      >
        <div
          :class="[
            'w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 bg-gradient-to-br shadow-sm',
            card.gradient,
          ]"
        >
          <UIcon :name="card.icon" class="w-6 h-6 text-white" />
        </div>
        <div class="min-w-0 flex-1">
          <div class="flex items-center gap-2">
            <h2 class="text-base font-bold text-slate-900 truncate">
              {{ card.label }}
            </h2>
            <UIcon
              name="i-heroicons-arrow-right"
              class="w-4 h-4 text-slate-400 flex-shrink-0"
            />
          </div>
          <p class="text-xs text-slate-600 mt-1 leading-relaxed">
            {{ card.description }}
          </p>
        </div>
      </button>
    </div>

    <p class="text-[11px] text-slate-400 text-center mt-8 leading-relaxed">
      生産計画策定 / マスタ整備 / AI 育成は PC 版でご利用ください。
    </p>
  </div>
</template>

<script lang="ts" setup>
type MobileTaskCard = {
  key: "business-consultation" | "slides-research-agent";
  label: string;
  description: string;
  icon: string;
  gradient: string;
};

const router = useRouter();
const enAiStudioAssistant = useEnAiStudioAssistantStore();

const cards: MobileTaskCard[] = [
  {
    key: "business-consultation",
    label: "経営相談する",
    description:
      "教えた知識を参照しながら、AI と経営課題を相談します。",
    icon: "i-heroicons-chat-bubble-left-right",
    gradient: "from-violet-500 to-purple-500",
  },
  {
    key: "slides-research-agent",
    label: "レポートを作る",
    description:
      "テーマを伝えれば、AI が Web 調査 → 解説スライドまで自動で作ります。",
    icon: "material-symbols:auto-stories",
    gradient: "from-emerald-500 to-teal-600",
  },
];

const invoke = (card: MobileTaskCard) => {
  switch (card.key) {
    case "business-consultation":
      enAiStudioAssistant.open();
      return;
    case "slides-research-agent":
      router.push({ name: "admin-ai-studio", query: { kind: "research" } });
  }
};
</script>
