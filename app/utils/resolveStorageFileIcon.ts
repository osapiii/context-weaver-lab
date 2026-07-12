import type { useFileIcons } from "@composables/useFileIcons";
import type { FileTypeFilter } from "@models/storageFileMetadata";
import { getFileTypeFromExtension } from "@models/storageFileMetadata";

export type FileIconsMap = ReturnType<typeof useFileIcons>;

/** Google Drive ネイティブ MIME (application/vnd.google-apps.*) */
export const GOOGLE_DRIVE_NATIVE_MIME = {
  document: "application/vnd.google-apps.document",
  spreadsheet: "application/vnd.google-apps.spreadsheet",
  presentation: "application/vnd.google-apps.presentation",
  drawing: "application/vnd.google-apps.drawing",
  form: "application/vnd.google-apps.form",
  folder: "application/vnd.google-apps.folder",
} as const;

const GOOGLE_SHORTCUT_EXTENSIONS = new Set([
  "gdoc",
  "gsheet",
  "gslides",
  "gdraw",
  "gform",
  "gmap",
  "gsite",
]);

export type GoogleWorkspaceKind =
  | "docs"
  | "sheets"
  | "slides"
  | "drawing"
  | "form"
  | "drive";

const MARKDOWN_EXTENSIONS = new Set(["md", "markdown"]);
const MARKDOWN_MIME_TYPES = new Set(["text/markdown", "text/x-markdown"]);

const CSV_EXTENSIONS = new Set(["csv"]);
const CSV_MIME_TYPES = new Set(["text/csv", "application/csv"]);

/** Markdown (.md / text/markdown 等) */
export function isMarkdownStorageFile(
  extension: string,
  mimeType = ""
): boolean {
  const ext = extension.toLowerCase();
  const mime = mimeType.toLowerCase();
  if (MARKDOWN_EXTENSIONS.has(ext)) return true;
  if (MARKDOWN_MIME_TYPES.has(mime)) return true;
  return mime.includes("markdown");
}

/** CSV (.csv / text/csv 等) */
export function isCsvStorageFile(extension: string, mimeType = ""): boolean {
  const ext = extension.toLowerCase();
  const mime = mimeType.toLowerCase();
  if (CSV_EXTENSIONS.has(ext)) return true;
  return CSV_MIME_TYPES.has(mime);
}

/**
 * 拡張子・MIME から Google Workspace 種別を推定。
 */
export function resolveGoogleWorkspaceKind(
  extension: string,
  mimeType = ""
): GoogleWorkspaceKind | null {
  const ext = extension.toLowerCase();
  const mime = mimeType.toLowerCase();

  if (
    ext === "gdoc" ||
    mime === GOOGLE_DRIVE_NATIVE_MIME.document ||
    mime.includes("google-apps.document")
  ) {
    return "docs";
  }
  if (
    ext === "gsheet" ||
    mime === GOOGLE_DRIVE_NATIVE_MIME.spreadsheet ||
    mime.includes("google-apps.spreadsheet")
  ) {
    return "sheets";
  }
  if (
    ext === "gslides" ||
    mime === GOOGLE_DRIVE_NATIVE_MIME.presentation ||
    mime.includes("google-apps.presentation")
  ) {
    return "slides";
  }
  if (
    ext === "gdraw" ||
    mime === GOOGLE_DRIVE_NATIVE_MIME.drawing ||
    mime.includes("google-apps.drawing")
  ) {
    return "drawing";
  }
  if (
    ext === "gform" ||
    mime === GOOGLE_DRIVE_NATIVE_MIME.form ||
    mime.includes("google-apps.form")
  ) {
    return "form";
  }
  if (GOOGLE_SHORTCUT_EXTENSIONS.has(ext)) {
    return "drive";
  }
  return null;
}

/**
 * 拡張子 + MIME からファイルタイプフィルタを判定 (Google ショートカット拡張子を document 扱い)。
 */
export function getFileTypeFromMetadata(
  extension: string,
  mimeType = ""
): FileTypeFilter {
  if (resolveGoogleWorkspaceKind(extension, mimeType)) {
    return "document";
  }
  return getFileTypeFromExtension(extension);
}

/**
 * ストレージ / FileSpace カード用のアイコン名を解決。
 */
export function resolveStorageFileIcon(
  icons: FileIconsMap,
  extension: string,
  mimeType = ""
): string {
  const googleKind = resolveGoogleWorkspaceKind(extension, mimeType);
  if (googleKind === "docs") return icons.googleDocs;
  if (googleKind === "sheets") return icons.googleSheets;
  if (googleKind === "slides") return icons.googleSlides;
  if (googleKind === "drawing") return icons.googleDrawing;
  if (googleKind === "form") return icons.googleForms;
  if (googleKind === "drive") return icons.googleDrive;

  if (isMarkdownStorageFile(extension, mimeType)) return icons.markdown;
  if (isCsvStorageFile(extension, mimeType)) return icons.csv;

  const fileType = getFileTypeFromMetadata(extension, mimeType);
  const ext = extension.toLowerCase();

  switch (fileType) {
    case "video":
      return icons.video;
    case "audio":
      return icons.audio;
    case "document":
      if (ext === "pdf") return icons.pdf;
      if (ext === "xlsx" || ext === "xls") return icons.excel;
      if (ext === "docx" || ext === "doc") return icons.word;
      if (ext === "pptx" || ext === "ppt") return icons.powerpoint;
      if (ext === "csv") return icons.csv;
      if (ext === "json") return icons.json;
      if (ext === "xml") return icons.xml;
      if (ext === "yml" || ext === "yaml") return icons.yaml;
      if (ext === "zip" || ext === "tar" || ext === "gz") return icons.zip;
      return icons.file;
    default:
      if (ext === "csv") return icons.csv;
      if (ext === "json") return icons.json;
      if (ext === "xml") return icons.xml;
      if (ext === "yml" || ext === "yaml") return icons.yaml;
      if (ext === "zip" || ext === "tar" || ext === "gz") return icons.zip;
      return icons.file;
  }
}

/**
 * 色付きブランド / タイプ別アイコンか (default-file 以外)。
 * AdminStorageFileCard 等で text-gray-400 を付けない判定に使う。
 */
export function isColoredStorageFileIcon(
  icons: FileIconsMap,
  extension: string,
  mimeType = ""
): boolean {
  return (
    resolveStorageFileIcon(icons, extension, mimeType) !== icons.file
  );
}

/** FileSpace ドキュメント一覧のコンパクトグリッド class */
export const FILE_SPACE_DOCUMENT_GRID_CLASS =
  "grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2.5 sm:gap-3" as const;
