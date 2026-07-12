<template>
  <div class="space-y-10">
    <!-- モードヘッダー -->
    <header class="flex min-w-0 items-center gap-4">
      <UIcon
        :name="mode.icon"
        class="h-12 w-12 flex-shrink-0"
        :class="modeHeaderIconClass"
      />
      <div class="min-w-0">
        <div class="flex items-center gap-2">
          <h1 class="text-3xl font-extrabold text-slate-900 tracking-tight">
            {{ mode.label }}
          </h1>
          <EnBadge
            v-if="mode.badge"
            color="warning"
            variant="subtle"
            size="sm"
          >
            {{ mode.badge }}
          </EnBadge>
        </div>
        <p class="text-sm text-slate-600 mt-1">
          {{ mode.subtitle }}
        </p>
      </div>
    </header>

    <!-- 空モード (準備中) -->
    <div
      v-if="mode.groups.length === 0"
      class="rounded-3xl border border-dashed border-slate-300 bg-slate-50 p-12 text-center"
    >
      <UIcon
        :name="mode.icon"
        class="mx-auto mb-4 h-16 w-16"
        :class="isMulticolorNavIcon(mode.icon) ? 'opacity-70' : 'text-slate-300'"
      />
      <p class="text-slate-700 font-semibold mb-2">
        {{ mode.label }}は準備中です
      </p>
      <p class="text-sm text-slate-500">
        外部システム (基幹システム / EDI / ECサイト等) との自動連携機能を順次追加予定です。
      </p>
    </div>

    <!-- カードグループ -->
    <section
      v-for="group in mode.groups"
      :key="group.key"
      class="space-y-4"
    >
      <header class="border-b border-slate-200 pb-2">
        <h2 class="text-lg font-bold text-slate-900">
          {{ group.label }}
        </h2>
        <p v-if="group.description" class="text-xs text-slate-500 mt-0.5">
          {{ group.description }}
        </p>
      </header>

      <div :class="ADMIN_AUTO_FILL_GRID_CLASS">
        <EModePreviewCard
          v-for="card in group.cards"
          :key="card.key"
          :title="card.label"
          :description="card.description"
          :purpose="card.purpose"
          :icon="card.icon"
          :behavior="card.behavior"
          :badge="card.badge"
          :disabled="!canInvoke(card)"
          :accent="mode.accent"
          :use-cases="card.useCases"
          :readiness="cardReadiness(card)"
          @click="invokeCard(card)"
          @continue-setup="onContinueSetup(card)"
        />
      </div>
    </section>
  </div>
</template>

<script lang="ts" setup>
import type {
  NavCard,
  NavMode,
} from "@composables/useNavigationModeRegistry";
import type { CardReadiness } from "@components/EModePreviewCard.vue";
import { ADMIN_AUTO_FILL_GRID_CLASS } from "@composables/useAdminViewport";
import { useGlobalLoadingNavigation } from "@composables/useGlobalLoadingNavigation";
import { isMulticolorNavIcon } from "@composables/useNavModeIcons";

interface Props {
  mode: NavMode;
}
const props = defineProps<Props>();

const { pushWithGlobalLoading } = useGlobalLoadingNavigation();
const enAiStudioAssistant = useEnAiStudioAssistantStore();

const cardReadiness = (card: NavCard): CardReadiness | undefined => {
  if (card.comingSoon) return { state: "coming-soon" };
  return undefined;
};

/**
 * 「設定を続ける」: 仕事カード内の二次 CTA から呼ばれる. AI ガイドモード起動.
 * (旧 AiQuestBoard の "続きを進める" と同等)
 */
const onContinueSetup = (card: NavCard) => {
  if (card.routeName) {
    void pushWithGlobalLoading({
      name: card.routeName,
      query: card.routeQuery,
    });
  }
};

const modeHeaderIconClass = computed(() =>
  isMulticolorNavIcon(props.mode.icon) ? "" : "text-slate-600"
);

const canInvoke = (card: NavCard): boolean => {
  if (card.comingSoon) return false;
  return true;
};

const invokeCard = (card: NavCard) => {
  if (!canInvoke(card)) return;

  // 準備未完了のカードは「タスク本体を起動する代わりに AI ガイドへ飛ばす」.
  // 仕事カード内の「設定を続ける」CTA と同じ挙動 → カード全体がガイドへの入口になる.
  const readiness = cardReadiness(card);
  if (readiness?.state === "todo") {
    onContinueSetup(card);
    return;
  }

  switch (card.behavior) {
    case "modal":
      if (card.launcher === "business-consultation") {
        // 統合アシスタントで開く。最初のメッセージ送信時に AI が
        // consultation モードと判定するので、ここでは mode を強制しない。
        enAiStudioAssistant.open();
      }
      return;
    case "panel":
      if (card.launcher === "business-consultation") {
        enAiStudioAssistant.open();
      } else if (
        card.launcher === "writing" ||
        card.launcher === "sheet" ||
        card.launcher === "image"
      ) {
        // 新 3 モード (ADK 経路) は mode を確定させてからパネルを開く
        enAiStudioAssistant.clear();
        enAiStudioAssistant.presetMode(card.launcher);
        enAiStudioAssistant.open();
      }
      return;
    case "page":
      if (!card.routeName) return;
      void pushWithGlobalLoading({
        name: card.routeName,
        query: card.routeQuery,
      });
  }
};
</script>
