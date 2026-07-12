import {
  isCsvStorageFile,
  isMarkdownStorageFile,
  resolveGoogleWorkspaceKind,
  type GoogleWorkspaceKind,
} from "@utils/resolveStorageFileIcon";

export type StoragePreviewMode =
  | "image"
  | "pdf"
  | "markdown"
  | "csv"
  | "text"
  | "google-workspace"
  | "binary";

export type GoogleShortcutPayload = {
  docId: string;
  email?: string;
  resourceKey?: string;
};

const TEXT_EXTENSIONS = new Set([
  "txt",
  "log",
  "json",
  "xml",
  "yml",
  "yaml",
  "html",
  "htm",
  "ts",
  "tsx",
  "js",
  "jsx",
  "py",
  "sql",
  "sh",
  "env",
]);

const OFFICE_EXTENSIONS = new Set([
  "doc",
  "docx",
  "xls",
  "xlsx",
  "ppt",
  "pptx",
]);

/** Google デスクトップ同期の .gdoc / .gsheet 等ショートカット JSON */
export function parseGoogleShortcutPayload(
  text: string
): GoogleShortcutPayload | null {
  const trimmed = text.trim();
  if (!trimmed.startsWith("{")) return null;
  try {
    const data = JSON.parse(trimmed) as Record<string, unknown>;
    const docId =
      (typeof data.doc_id === "string" && data.doc_id) ||
      (typeof data.docId === "string" && data.docId) ||
      (typeof data.id === "string" && data.id) ||
      null;
    if (!docId) return null;
    return {
      docId,
      email: typeof data.email === "string" ? data.email : undefined,
      resourceKey:
        typeof data.resource_key === "string"
          ? data.resource_key
          : typeof data.resourceKey === "string"
            ? data.resourceKey
            : undefined,
    };
  } catch {
    return null;
  }
}

export function buildGoogleWorkspaceEditUrl(
  kind: GoogleWorkspaceKind,
  docId: string
): string {
  const id = encodeURIComponent(docId);
  switch (kind) {
    case "docs":
      return `https://docs.google.com/document/d/${id}/edit`;
    case "sheets":
      return `https://docs.google.com/spreadsheets/d/${id}/edit`;
    case "slides":
      return `https://docs.google.com/presentation/d/${id}/edit`;
    case "drawing":
      return `https://docs.google.com/drawings/d/${id}/edit`;
    case "form":
      return `https://docs.google.com/forms/d/${id}/edit`;
    default:
      return `https://drive.google.com/file/d/${id}/view`;
  }
}

export function buildGoogleDriveFileUrl(driveFileId: string): string {
  return `https://drive.google.com/file/d/${encodeURIComponent(driveFileId)}/view`;
}

/**
 * Drive file id / webViewLink / ショートカット doc_id から「開く」URLを解決。
 */
export function resolveGoogleWorkspaceOpenUrl(params: {
  kind: GoogleWorkspaceKind;
  docId?: string | null;
  driveFileId?: string | null;
  webViewLink?: string | null;
}): string | null {
  const webView = params.webViewLink?.trim();
  if (webView && /^https?:\/\//i.test(webView)) return webView;

  const docId = params.docId?.trim();
  if (docId) return buildGoogleWorkspaceEditUrl(params.kind, docId);

  const driveId = params.driveFileId?.trim();
  if (driveId) return buildGoogleDriveFileUrl(driveId);

  return null;
}

export function isGoogleWorkspaceShortcut(
  extension: string,
  mimeType = ""
): boolean {
  return resolveGoogleWorkspaceKind(extension, mimeType) !== null;
}

export function isStorageTextPreview(
  extension: string,
  mimeType = ""
): boolean {
  const ext = extension.toLowerCase();
  const mime = mimeType.toLowerCase();
  if (isMarkdownStorageFile(ext, mime)) return true;
  if (isCsvStorageFile(ext, mime)) return false;
  if (mime.startsWith("text/")) return true;
  if (mime.includes("json") || mime.includes("xml") || mime.includes("yaml")) {
    return true;
  }
  return TEXT_EXTENSIONS.has(ext);
}

export function resolveStoragePreviewMode(
  extension: string,
  mimeType = ""
): StoragePreviewMode {
  const ext = extension.toLowerCase();
  const mime = mimeType.toLowerCase();

  if (resolveGoogleWorkspaceKind(ext, mime)) {
    return "google-workspace";
  }

  if (mime.startsWith("image/") || ["jpg", "jpeg", "png", "gif", "webp", "svg", "bmp", "avif"].includes(ext)) {
    return "image";
  }
  if (mime.includes("pdf") || ext === "pdf") return "pdf";
  if (isMarkdownStorageFile(ext, mime)) return "markdown";
  if (isCsvStorageFile(ext, mime)) return "csv";
  if (isStorageTextPreview(ext, mime)) return "text";
  if (OFFICE_EXTENSIONS.has(ext)) return "binary";
  return "binary";
}

const GOOGLE_WORKSPACE_LABELS: Record<GoogleWorkspaceKind, string> = {
  docs: "Google ドキュメント",
  sheets: "Google スプレッドシート",
  slides: "Google スライド",
  drawing: "Google ドロー",
  form: "Google フォーム",
  drive: "Google Drive",
};

export function googleWorkspaceTypeLabel(kind: GoogleWorkspaceKind): string {
  return GOOGLE_WORKSPACE_LABELS[kind];
}

export function googleWorkspaceOpenButtonLabel(
  kind: GoogleWorkspaceKind
): string {
  switch (kind) {
    case "docs":
      return "Google ドキュメントで開く";
    case "sheets":
      return "Google スプレッドシートで開く";
    case "slides":
      return "Google スライドで開く";
    case "drawing":
      return "Google ドローで開く";
    case "form":
      return "Google フォームで開く";
    default:
      return "Google Drive で開く";
  }
}

export function resolveStorageFileTypeLabel(
  extension: string,
  mimeType = ""
): string {
  const googleKind = resolveGoogleWorkspaceKind(extension, mimeType);
  if (googleKind) return googleWorkspaceTypeLabel(googleKind);

  const mode = resolveStoragePreviewMode(extension, mimeType);
  switch (mode) {
    case "image":
      return "画像";
    case "pdf":
      return "PDF";
    case "markdown":
      return "Markdown";
    case "csv":
      return "CSV";
    case "text":
      return "テキスト";
    case "google-workspace":
      return "Google Workspace";
    default:
      return "ファイル";
  }
}

export function shouldOfferStorageDownload(mode: StoragePreviewMode): boolean {
  return mode !== "google-workspace";
}

export function googleWorkspaceShortcutHint(): string {
  return "このファイルは Google Drive 上のクラウドドキュメントへのリンクです。実体は Google 側にあり、ここからダウンロードできるのはショートカット情報のみです。";
}

/** プレビュー用の簡易 CSV パース (引用符・カンマのみ) */
export function parseCsvPreviewTable(
  text: string,
  maxRows = 200
): { columns: { accessorKey: string; header: string }[]; rows: Record<string, string>[] } | null {
  const lines = text
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0);
  if (lines.length === 0) return null;

  const parseRow = (line: string): string[] => {
    const cells: string[] = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i += 1) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i += 1;
        } else {
          inQuotes = !inQuotes;
        }
        continue;
      }
      if (ch === "," && !inQuotes) {
        cells.push(current);
        current = "";
        continue;
      }
      current += ch;
    }
    cells.push(current);
    return cells;
  };

  const headerCells = parseRow(lines[0]);
  const columns = headerCells.map((header, index) => {
    const key = `col_${index}`;
    return {
      accessorKey: key,
      header: header.trim() || `列 ${index + 1}`,
    };
  });

  const rows = lines.slice(1, maxRows + 1).map((line) => {
    const cells = parseRow(line);
    const row: Record<string, string> = {};
    columns.forEach((col, index) => {
      row[col.accessorKey] = (cells[index] ?? "").trim();
    });
    return row;
  });

  return { columns, rows };
}
