import type { AIRevisionQuickAction } from "@components/EnAIRevisionAssistantPanel.vue";
import type { AdkAgentMode } from "@composables/useAgentSseClient";

const ICON_ALIASES: Record<string, string> = {
  search: "material-symbols:search",
  folder: "material-symbols:folder-open",
  analytics: "material-symbols:analytics",
  alert: "material-symbols:warning",
  trend: "material-symbols:trending-up",
  mail: "material-symbols:mail",
  image: "material-symbols:image",
  table: "material-symbols:table",
  psychology: "material-symbols:psychology",
};

export const normalizeQuickActionIcon = (icon?: string): string => {
  if (!icon?.trim()) return "material-symbols:auto-awesome";
  const trimmed = icon.trim();
  if (trimmed.startsWith("material-symbols:") || trimmed.startsWith("i-")) {
    return trimmed;
  }
  return ICON_ALIASES[trimmed] ?? `material-symbols:${trimmed}`;
};

export const fallbackQuickActions = (
  agent: AdkAgentMode | null
): AIRevisionQuickAction[] => {
  switch (agent) {
    case "consultation":
      return [
        {
          label: "社内資料を調査",
          icon: "material-symbols:folder-open",
          text: "登録済みの社内資料を検索して、気になるテーマの要点と根拠をまとめて",
        },
        {
          label: "粗利の原因分解",
          icon: "material-symbols:analytics",
          text: "粗利率低下の要因を原価・Mix・値引・固定費の観点で分解し、優先アクションを提案して",
        },
        {
          label: "業務リスク整理",
          icon: "material-symbols:warning",
          text: "今見えている業務リスクを優先度付きで整理し、最初に確認すべきデータを提案して",
        },
        {
          label: "来期利益シナリオ",
          icon: "material-symbols:trending-up",
          text: "売上・原価・固定費の前提を確認しながら、来期利益の楽観/標準/悲観シナリオを作って",
        },
      ];
    case "writing":
      return [
        {
          label: "謝罪メール",
          icon: "material-symbols:mail",
          text: "顧客向け謝罪メールを、事実→お詫び→再発防止→次アクションの構成で下書きして",
        },
        {
          label: "社内通知",
          icon: "material-symbols:campaign",
          text: "社内通知文を、背景・決定事項・各自のアクションに分けて書いて",
        },
      ];
    case "sheet":
      return [
        {
          label: "ピボット整理",
          icon: "material-symbols:pivot-table-chart",
          text: "売上データのピボット表を見やすく整理して、気づきも添えて",
        },
        {
          label: "アラート列追加",
          icon: "material-symbols:warning",
          text: "一覧データに確認優先度を判定するアラート列を追加して",
        },
      ];
    case "image":
      return [
        {
          label: "OGP 生成",
          icon: "material-symbols:image",
          text: "ブランドの信頼感が伝わる OGP 用画像を 16:9 で生成して",
        },
        {
          label: "パッケージ mock",
          icon: "material-symbols:shopping-bag",
          text: "新商品パッケージのモックアップを棚置きイメージで生成して",
        },
      ];
    default:
      return [
        {
          label: "経営相談",
          icon: "material-symbols:psychology",
          text: "今困っている経営課題を整理して、最初に確認すべき論点を提案して",
        },
      ];
  }
};

export type RawQuickActionSuggestion = {
  label?: unknown;
  text?: unknown;
  icon?: unknown;
};

export const parseQuickActionSuggestions = (
  raw: unknown,
  limit = 4
): AIRevisionQuickAction[] => {
  const list =
    typeof raw === "object" &&
    raw !== null &&
    Array.isArray((raw as { suggestions?: unknown }).suggestions)
      ? (raw as { suggestions: RawQuickActionSuggestion[] }).suggestions
      : [];

  const parsed: AIRevisionQuickAction[] = [];
  for (const item of list) {
    const label = typeof item.label === "string" ? item.label.trim() : "";
    const text = typeof item.text === "string" ? item.text.trim() : "";
    if (!label || !text) continue;
    parsed.push({
      label: label.length > 20 ? `${label.slice(0, 20)}…` : label,
      text,
      icon: normalizeQuickActionIcon(
        typeof item.icon === "string" ? item.icon : undefined
      ),
    });
    if (parsed.length >= limit) break;
  }
  return parsed;
};
