export type AgentSseActivityStatus = "running" | "completed" | "failed";

export interface AgentSseActivity {
  id: string;
  name: string;
  status: AgentSseActivityStatus;
}

const normalizeToolName = (name: string): string =>
  name.trim().toLowerCase().replace(/[\s-]+/g, "_");

const TOOL_LABELS: Record<string, string> = {
  vertex_ai_search: "知識を検索",
  vertexaisearchtool: "知識を検索",
  discovery_engine_search: "知識を検索",
  discoveryengine_search: "知識を検索",
  set_workspace_mode: "モード切替",
  convert_mode: "モード切替",
  add_citation: "出典追加",
  add_markdown_document: "Markdown 作成",
  add_html_document: "HTML 作成",
  add_text_block: "テキスト追加",
  generate_image: "画像生成",
  retouch_image: "画像レタッチ",
  list_sheets: "シート一覧",
  read_range: "セル読取",
  update_range: "セル更新",
  append_rows: "行追加",
};

export const formatAdkToolLabel = (name: string): string => {
  const key = normalizeToolName(name);
  return TOOL_LABELS[key] ?? name.replace(/_/g, " ");
};

const KNOWLEDGE_SEARCH_TOOL_KEYS = new Set([
  "vertex_ai_search",
  "vertexaisearchtool",
  "discovery_engine_search",
  "discoveryengine_search",
  "search_knowledge",
]);

/** UI 表示・upsert 用 — 知識検索系は canonical キーに集約 */
export const activityToolKey = (name: string): string => {
  const key = normalizeToolName(name);
  if (KNOWLEDGE_SEARCH_TOOL_KEYS.has(key)) {
    return "vertex_ai_search";
  }
  return key;
};

export const isKnowledgeSearchActivityName = (name: string): boolean =>
  KNOWLEDGE_SEARCH_TOOL_KEYS.has(normalizeToolName(name));

export const formatAdkToolActivityDisplay = (
  name: string,
  status: AgentSseActivityStatus
): string => {
  const label = formatAdkToolLabel(name);
  if (status === "running") {
    return `${label}中`;
  }
  if (status === "failed") {
    return `${label}（失敗）`;
  }
  return label;
};

export const normalizeActivityStatus = (
  value: unknown
): AgentSseActivityStatus | null => {
  if (value === "running" || value === "completed" || value === "failed") {
    return value;
  }
  return null;
};

export const upsertAgentActivity = (
  activities: AgentSseActivity[],
  patch: { name: string; status: AgentSseActivityStatus }
): AgentSseActivity[] => {
  const name = patch.name.trim();
  if (!name) return activities;

  const key = activityToolKey(name);
  const existingIndex = activities.findIndex(
    (a) => activityToolKey(a.name) === key
  );
  if (existingIndex >= 0) {
    const next = [...activities];
    next[existingIndex] = {
      ...next[existingIndex]!,
      name,
      status: patch.status,
    };
    return next;
  }

  return [
    ...activities,
    {
      id: `${key}-${activities.length}`,
      name,
      status: patch.status,
    },
  ];
};

/** 表示用 — 同一ツールは最新ステータスのみ（Firestore 履歴の重複も吸収） */
export const dedupeActivitiesForDisplay = (
  activities: ReadonlyArray<AgentSseActivity>
): AgentSseActivity[] => {
  const indexByKey = new Map<string, number>();
  const result: AgentSseActivity[] = [];
  for (const activity of activities) {
    const key = activityToolKey(activity.name);
    if (!key) continue;
    const existingIdx = indexByKey.get(key);
    if (existingIdx !== undefined) {
      result[existingIdx] = {
        ...result[existingIdx]!,
        name: activity.name,
        status: activity.status,
      };
      continue;
    }
    indexByKey.set(key, result.length);
    result.push({ ...activity });
  }
  return result;
};
