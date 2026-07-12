import type { ResearchAgentBriefingDraft } from "@stores/researchAgent";
import { isValidEmailAddress } from "@utils/emailAddress";

export type ResearchSectionKind =
  | "definitional"
  | "comparative"
  | "decisional"
  | "how_to"
  | "risk"
  | "other";

export interface ResearchPlanSectionDraft {
  id: string;
  question: string;
  kind: ResearchSectionKind;
}

export interface ResearchPlanConcernDraft {
  id: string;
  text: string;
}

export interface ResearchPlanDraft {
  deck: {
    title: string;
    target_reader: string;
    intent: string;
  };
  sections: ResearchPlanSectionDraft[];
  concerns: ResearchPlanConcernDraft[];
}

export interface ResearchPlanContextHint {
  organizationName?: string | null;
  spaceName?: string | null;
  fileSpaceId?: string | null;
  contextStatus?: "ready" | "limited" | null;
  contextWarning?: string | null;
}

const DEFAULT_KIND: ResearchSectionKind = "definitional";

const resolveContextDescriptor = (params: {
  context?: ResearchPlanContextHint | null;
}): string | null => {
  const org = params.context?.organizationName?.trim();
  if (org) return org;
  return null;
};

/** Pinia / Firestore 由来の reactive でも安全にローカル編集用コピーを作る */
export const cloneResearchPlanDraft = (
  plan: ResearchPlanDraft
): ResearchPlanDraft => ({
  deck: {
    title: plan.deck.title,
    target_reader: plan.deck.target_reader,
    intent: plan.deck.intent,
  },
  sections: plan.sections.map((section) => ({
    id: section.id,
    question: section.question,
    kind: section.kind,
  })),
  concerns: plan.concerns.map((concern) => ({
    id: concern.id,
    text: concern.text,
  })),
});

export const buildDefaultDeckMeta = (params: {
  theme: string;
  context?: ResearchPlanContextHint | null;
}): { target_reader: string; intent: string } => {
  const title = params.theme.trim() || "(未指定)";
  const contextLabel = resolveContextDescriptor({ context: params.context });
  return {
    target_reader: contextLabel
      ? `「${contextLabel}」に関わる意思決定者・担当者`
      : "このテーマに関わる意思決定者・担当者",
    intent: contextLabel
      ? `「${title}」を ${contextLabel} の文脈で調査し、疑問を解消して次のアクションを決める`
      : `「${title}」について Question を調査し、疑問を解消して次のアクションを決める`,
  };
};

/** AgentBriefing の draft → store 用 briefing */
export const researchBriefingDraftFromAgentDraft = (params: {
  draft: Record<string, unknown>;
}): ResearchAgentBriefingDraft => {
  const theme = typeof params.draft.theme === "string" ? params.draft.theme : "";
  const questions = Array.isArray(params.draft.questions)
    ? params.draft.questions.filter((q): q is string => typeof q === "string")
    : [];
  const doubts = Array.isArray(params.draft.doubts)
    ? params.draft.doubts.filter((d): d is string => typeof d === "string")
    : Array.isArray(params.draft.concerns)
      ? params.draft.concerns.filter((c): c is string => typeof c === "string")
      : [];
  const notificationEmail =
    typeof params.draft.notificationEmail === "string"
      ? params.draft.notificationEmail.trim()
      : "";
  return {
    theme,
    questions,
    doubts,
    ...(notificationEmail ? { notificationEmail } : {}),
  };
};

export const resolveResearchNotificationEmail = (params: {
  draft: ResearchAgentBriefingDraft;
  fallbackEmail?: string | null;
}): string => {
  const explicit = params.draft.notificationEmail?.trim() ?? "";
  if (explicit) {
    if (!isValidEmailAddress(explicit)) {
      throw new Error("完了通知メールアドレスの形式が正しくありません");
    }
    return explicit;
  }
  const fallback = params.fallbackEmail?.trim() ?? "";
  if (fallback && isValidEmailAddress(fallback)) {
    return fallback;
  }
  throw new Error("完了通知メールアドレスを入力してください");
};

export const buildResearchPlanFromBriefing = (params: {
  briefing: ResearchAgentBriefingDraft;
  context?: ResearchPlanContextHint | null;
}): ResearchPlanDraft => {
  const theme = params.briefing.theme.trim();
  const deckMeta = buildDefaultDeckMeta({ theme, context: params.context });
  const questions = params.briefing.questions ?? [];
  const doubts =
    params.briefing.doubts ??
    params.briefing.concerns?.filter((c): c is string => typeof c === "string") ??
    [];

  const defaultPair = theme.trim()
    ? [
        `${theme.trim()}について、最初に調べるべきことは?`,
        resolveContextDescriptor({ context: params.context })
          ? `${theme.trim()}を進めるうえで、${resolveContextDescriptor({ context: params.context })}で実行可能な第一歩は?`
          : `${theme.trim()}を進めるうえで、うちの規模でも現実的な第一歩は?`,
      ]
    : [
        "このテーマについて、最初に調べるべきことは?",
        "このテーマを進めるうえで、最初に取るべき具体的アクションは?",
      ];

  let normalizedQuestions =
    questions.length > 0 ? [...questions] : defaultPair;

  // research-v13 schema は sections 最低 2 件 — 1 件だけのときは補完
  if (normalizedQuestions.length === 1) {
    normalizedQuestions = [
      normalizedQuestions[0]!,
      theme.trim()
        ? `${theme.trim()}を進めるうえで、うちの規模でも現実的な第一歩は?`
        : "このテーマを進めるうえで、最初に取るべき具体的アクションは?",
    ];
  }

  return {
    deck: {
      title: theme || "(未指定)",
      target_reader:
        params.briefing.audience?.trim() || deckMeta.target_reader,
      intent: params.briefing.useCase?.trim() || deckMeta.intent,
    },
    sections: normalizedQuestions.map((q, i) => ({
      id: `Q${i + 1}`,
      question: q.trim(),
      kind: DEFAULT_KIND,
    })),
    concerns: doubts.map((d, i) => ({
      id: `C${i + 1}`,
      text: d.trim(),
    })),
  };
};

/** Briefing → plan_only invoke 用プロンプト */
export const buildResearchPlanBriefingInvokePrompt = (params: {
  briefing: ResearchAgentBriefingDraft;
  context?: ResearchPlanContextHint | null;
}): string => {
  const plan = buildResearchPlanFromBriefing({
    briefing: params.briefing,
    context: params.context,
  });
  const seedJson = JSON.stringify(plan, null, 2);
  const contextLines = [
    params.context?.organizationName?.trim()
      ? `- 組織: ${params.context.organizationName.trim()}`
      : null,
    params.context?.spaceName?.trim()
      ? `- スペース: ${params.context.spaceName.trim()}`
      : null,
    params.context?.fileSpaceId?.trim()
      ? `- fileSpaceId: ${params.context.fileSpaceId.trim()}`
      : null,
    params.context?.contextStatus === "limited"
      ? `- 注意: ${params.context.contextWarning?.trim() || "企業コンテキストが不足しています。"}`
      : null,
  ].filter((line): line is string => Boolean(line));
  return [
    "# リサーチ依頼 (Briefing)",
    "",
    `テーマ: ${params.briefing.theme.trim() || "(未指定)"}`,
    "",
    "## Question",
    ...(params.briefing.questions.length
      ? params.briefing.questions.map((q) => `- ${q}`)
      : ["- (未指定)"]),
    "",
    "## 疑問",
    ...(params.briefing.doubts?.length
      ? params.briefing.doubts.map((d) => `- ${d}`)
      : ["- (なし)"]),
    "",
    ...(contextLines.length > 0
      ? ["## 企業コンテキスト", ...contextLines, ""]
      : []),
    "上記を research-v13 整合のプラン素案 (deck + sections + concerns) に整理し、",
    "`save_research_plan_draft(plan_json=...)` で保存してください。",
    "",
    "参考 seed (そのまま使っても、言い回しを整えても OK):",
    "```json",
    seedJson,
    "```",
  ].join("\n");
};

/** ADK Phase 1 / 1.8 へ渡す research-v13 整合プラン起動プロンプト */
export const buildResearchPlanLaunchPrompt = (params: {
  plan: ResearchPlanDraft;
  context?: ResearchPlanContextHint | null;
}): string => {
  const { plan } = params;
  const sectionsBlock = plan.sections.length
    ? plan.sections
        .map((s) => `- ${s.id}: ${s.question} (kind: ${s.kind})`)
        .join("\n")
    : "- (なし)";
  const concernsBlock = plan.concerns.length
    ? plan.concerns.map((c) => `- ${c.id}: ${c.text}`).join("\n")
    : "- (なし)";
  const contextLines = [
    params.context?.organizationName?.trim()
      ? `- 組織: ${params.context.organizationName.trim()}`
      : null,
    params.context?.spaceName?.trim()
      ? `- スペース: ${params.context.spaceName.trim()}`
      : null,
    params.context?.fileSpaceId?.trim()
      ? `- fileSpaceId: ${params.context.fileSpaceId.trim()}`
      : null,
    params.context?.contextStatus === "limited"
      ? `- 注意: ${params.context.contextWarning?.trim() || "企業コンテキストが不足しています。一般論化に注意してください。"}`
      : null,
  ].filter((line): line is string => Boolean(line));

  return [
    "# research-v13 プラン素案 (ユーザー承認済み)",
    "",
    "## deck",
    `- title: ${plan.deck.title}`,
    `- target_reader: ${plan.deck.target_reader}`,
    `- intent: ${plan.deck.intent}`,
    "",
    "## sections[] (Question → research.json sections)",
    sectionsBlock,
    "",
    "## concerns[] (疑問 → research.json concerns)",
    concernsBlock,
    "",
    ...(contextLines.length > 0
      ? ["## 企業コンテキスト", ...contextLines, ""]
      : []),
    "## 実行モード",
    "pipeline_autonomous (一気通貫). 中間承認・再ヒアリング不要。",
    "このプランに沿って research.json → SVG → research.html まで 1 セッションで完走してください。",
    "",
    "## 指示",
    "1. Agent Search で自社ナレッジを先に確認し、上記プランに自社コンテキストを反映してください。",
    "2. ensure_deck_dir_tool → Phase 1.8 で research.json (v13) を save_research_tool まで確定してください。",
    "3. generate_svgs_tool → build_research_html_tool の順で成果物を保存してください。",
    "4. next_action.paths には自社で取れる具体打ち手を含めてください。",
  ].join("\n");
};
