import type { AgentSseArtifact } from "@composables/useAgentSseClient";

export type WorkspaceArtifactPanelKind =
  | "image"
  | "markdown"
  | "html"
  | "text"
  | "json"
  | "csv"
  | "sheet"
  | "citation"
  | "other";

export interface WorkspaceArtifactMeta {
  key: string;
  title: string;
  typeLabel: string;
  icon: string;
  panelKind: WorkspaceArtifactPanelKind;
  /** 右ペインに大きく表示する対象か */
  isPanelPrimary: boolean;
}

const PANEL_KINDS = new Set<AgentSseArtifact["kind"]>([
  "image",
  "markdown_document",
  "html_document",
  "text_block",
  "json_document",
  "csv_document",
]);

/** メッセージ群に含まれる右ペイン表示対象の成果物件数 */
export const countPanelPrimaryArtifacts = (params: {
  messages: ReadonlyArray<{ artifacts?: AgentSseArtifact[] }>;
}): number => {
  let n = 0;
  for (const message of params.messages) {
    if (!message) continue;
    for (const artifact of message.artifacts ?? []) {
      if (isPanelPrimaryArtifact(artifact)) n += 1;
    }
  }
  return n;
};

/** 成果物パネル用の短いタイトル（edit 用長文 prompt は使わない） */
export const imageArtifactDisplayTitle = (params: {
  artifact: AgentSseArtifact;
  index: number;
}): string => {
  const { artifact, index } = params;
  if (artifact.adkFilename?.trim()) {
    const base = artifact.adkFilename
      .trim()
      .replace(/_[a-f0-9]{6,12}(\.[^.]+)$/i, "$1");
    if (base.length > 0 && base.length <= 56) return base;
    if (base.length > 56) return `${base.slice(0, 53)}…`;
  }
  return `生成画像 ${index + 1}`;
};

export const isPanelPrimaryArtifact = (artifact: AgentSseArtifact): boolean => {
  if (artifact.kind === "image") {
    return Boolean(
      artifact.artifactId?.trim() ||
        artifact.url?.trim() ||
        artifact.adkFilename?.trim()
    );
  }
  if (
    artifact.kind === "markdown_document" ||
    artifact.kind === "html_document" ||
    artifact.kind === "text_block"
  ) {
    return Boolean(artifact.body?.trim());
  }
  if (artifact.kind === "json_document") {
    return Boolean(
      artifact.body?.trim() ||
        artifact.artifactId?.trim() ||
        artifact.adkFilename?.trim()
    );
  }
  if (artifact.kind === "csv_document") {
    return Boolean(
      artifact.body?.trim() ||
        artifact.artifactId?.trim() ||
        artifact.adkFilename?.trim()
    );
  }
  return false;
};

export const workspaceArtifactKey = (params: {
  artifact: AgentSseArtifact;
  messageId: string;
  index: number;
}): string => {
  const { artifact, messageId, index } = params;
  if (artifact.artifactId?.trim()) {
    return `${messageId}:${artifact.artifactId}`;
  }
  return `${messageId}:${artifact.kind}:${index}`;
};

export const workspaceArtifactMeta = (params: {
  artifact: AgentSseArtifact;
  messageId: string;
  index: number;
}): WorkspaceArtifactMeta => {
  const { artifact, messageId, index } = params;
  const key = workspaceArtifactKey({ artifact, messageId, index });

  if (artifact.kind === "image") {
    const title = imageArtifactDisplayTitle({ artifact, index });
    return {
      key,
      title,
      typeLabel: "Image",
      icon: "material-symbols:image",
      panelKind: "image",
      isPanelPrimary: isPanelPrimaryArtifact(artifact),
    };
  }

  if (artifact.kind === "markdown_document") {
    return {
      key,
      title: artifact.title?.trim() || "レポート",
      typeLabel: "Report",
      icon: "material-symbols:description",
      panelKind: "markdown",
      isPanelPrimary: isPanelPrimaryArtifact(artifact),
    };
  }

  if (artifact.kind === "html_document") {
    return {
      key,
      title: artifact.title?.trim() || "レポート",
      typeLabel: "Report",
      icon: "material-symbols:analytics",
      panelKind: "html",
      isPanelPrimary: isPanelPrimaryArtifact(artifact),
    };
  }

  if (artifact.kind === "text_block") {
    return {
      key,
      title: artifact.title?.trim() || "テキスト",
      typeLabel: "Text",
      icon: "material-symbols:subject",
      panelKind: "text",
      isPanelPrimary: isPanelPrimaryArtifact(artifact),
    };
  }

  if (artifact.kind === "json_document") {
    return {
      key,
      title: artifact.title?.trim() || "生成 JSON",
      typeLabel: "JSON",
      icon: "material-symbols:data-object",
      panelKind: "json",
      isPanelPrimary: isPanelPrimaryArtifact(artifact),
    };
  }

  if (artifact.kind === "csv_document") {
    return {
      key,
      title: artifact.title?.trim() || "生成 CSV",
      typeLabel: "CSV",
      icon: "material-symbols:table-rows",
      panelKind: "csv",
      isPanelPrimary: isPanelPrimaryArtifact(artifact),
    };
  }

  if (artifact.kind === "sheet_op") {
    return {
      key,
      title: artifact.summary?.trim() || "シート操作",
      typeLabel: "Sheet",
      icon: "material-symbols:table",
      panelKind: "sheet",
      isPanelPrimary: false,
    };
  }

  if (artifact.kind === "citation") {
    return {
      key,
      title: artifact.title?.trim() || "引用",
      typeLabel: "Citation",
      icon: "material-symbols:bookmark",
      panelKind: "citation",
      isPanelPrimary: false,
    };
  }

  return {
    key,
    title: "成果物",
    typeLabel: "File",
    icon: "material-symbols:draft",
    panelKind: "other",
    isPanelPrimary: false,
  };
};
