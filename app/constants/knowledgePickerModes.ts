import { MAX_AI_MASTER_SOURCE_DOCUMENTS } from "~/constants/aiMaster";
import {
  MAX_PINNED_KNOWLEDGE,
  MAX_SELECTED_KNOWLEDGE,
} from "@utils/consultationKnowledge";

/** 知識ピッカーの利用シーン（UI 文言・上限の切替） */
export type KnowledgePickerMode =
  | "consultation-turn"
  | "global-pinned"
  | "ai-master-pool"
  | "image-reference";

export interface KnowledgePickerModeConfig {
  title: string;
  subtitle: string;
  titleIcon: string;
  headerVariant: "brand" | "default";
  maxSelection: number;
  selectionBasketLabel: string;
  emptySelectionFooterHint: string;
  selectionFooterHint: (count: number) => string;
  confirmLabel: (count: number) => string;
  maxSelectionToastTitle: string;
}

export const KNOWLEDGE_PICKER_MODES: Record<
  KnowledgePickerMode,
  KnowledgePickerModeConfig
> = {
  "consultation-turn": {
    title: "参照する知識を選択",
    subtitle:
      "索引済みの社内資料から、今回の相談で優先的に参照する資料を選びます",
    titleIcon: "material-symbols:menu-book-outline",
    headerVariant: "brand",
    maxSelection: MAX_SELECTED_KNOWLEDGE,
    selectionBasketLabel: "選択中の知識",
    emptySelectionFooterHint:
      "未選択の場合は、組織ナレッジ全体を Agent Search で探索します",
    selectionFooterHint: (count) =>
      `${count} 件をこの相談の参照知識に設定`,
    confirmLabel: (count) =>
      count > 0 ? "参照知識を設定" : "選択をクリア",
    maxSelectionToastTitle: `参照知識は最大 ${MAX_SELECTED_KNOWLEDGE} 件までです`,
  },
  "global-pinned": {
    title: "ピン留めする知識を選択",
    subtitle:
      "会社概要・商品カタログなど、全セッションで常に GCS コンテキストとして渡す資料を選びます",
    titleIcon: "material-symbols:push-pin-outline",
    headerVariant: "brand",
    maxSelection: MAX_PINNED_KNOWLEDGE,
    selectionBasketLabel: "ピン留め予定",
    emptySelectionFooterHint:
      "未設定の場合は Global プロンプトと Agent Search のみが使われます",
    selectionFooterHint: (count) =>
      `${count} 件を常時参照知識としてピン留め`,
    confirmLabel: (count) =>
      count > 0 ? "ピン留めを設定" : "ピン留めを解除",
    maxSelectionToastTitle: `ピン留めは最大 ${MAX_PINNED_KNOWLEDGE} 件までです`,
  },
  "image-reference": {
    title: "リファレンス画像を選択",
    subtitle: "索引済みの資料から、画像ファイルのみ選べます（最大3枚）",
    titleIcon: "material-symbols:image-outline",
    headerVariant: "brand",
    maxSelection: 3,
    selectionBasketLabel: "選択中のリファレンス",
    emptySelectionFooterHint: "画像（PNG / JPEG / WebP 等）を 1 枚以上選んでください",
    selectionFooterHint: (count) =>
      `${count} 枚をリファレンスに追加`,
    confirmLabel: (count) =>
      count > 0 ? "リファレンスに追加" : "選択をクリア",
    maxSelectionToastTitle: "リファレンス画像は最大 3 枚までです",
  },
  "ai-master-pool": {
    title: "参考資料を選ぶ",
    subtitle:
      "素材プールの索引済み資料から、マスタ抽出の参考にするファイルを選びます",
    titleIcon: "material-symbols:folder-open-outline",
    headerVariant: "brand",
    maxSelection: MAX_AI_MASTER_SOURCE_DOCUMENTS,
    selectionBasketLabel: "選択中の参考資料",
    emptySelectionFooterHint:
      "1 件以上選ぶと「AI で下書きを抽出」が有効になります",
    selectionFooterHint: (count) =>
      `${count} 件をマスタ抽出の参考資料に設定`,
    confirmLabel: (count) =>
      count > 0 ? "参考資料を設定" : "選択をクリア",
    maxSelectionToastTitle: `参考資料は最大 ${MAX_AI_MASTER_SOURCE_DOCUMENTS} 件までです`,
  },
};

export const knowledgePickerModeConfig = (
  mode: KnowledgePickerMode
): KnowledgePickerModeConfig => KNOWLEDGE_PICKER_MODES[mode];
