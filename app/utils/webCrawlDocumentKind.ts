import type { Document } from "@models/document";
import { isWebCrawlKnowledgeStoragePath } from "@utils/knowledgeStoragePaths";

/** Web クロールセッションに紐づく Document か (markdown / 画像 / entryUrl 等) */
export function isWebCrawlSessionDocument(doc: Document): boolean {
  if (doc.webCrawlRequestId) return true;
  if (doc.subCategory === "entryUrl" || doc.subCategory === "urlMarkdown") {
    return true;
  }
  const docName = (doc.name || "").toLowerCase();
  const filePath = (doc.filePath || "").toLowerCase();
  if (
    docName.includes("/documents/webcrawl_") ||
    docName.includes("/documents/webcrawl_img_")
  ) {
    return true;
  }
  if (isWebCrawlKnowledgeStoragePath(filePath)) return true;
  return false;
}

/** クロールで保存した Markdown ページ (フィルタ「Web」のカウント対象) */
export function isWebCrawlMarkdownDocument(doc: Document): boolean {
  const mime = (doc.mimeType || "").toLowerCase();
  const name = (doc.displayName || doc.name || "").toLowerCase();
  if (doc.subCategory === "urlMarkdown") return true;
  if (mime === "text/markdown" || mime === "text/x-markdown") return true;
  if (/\.md$/.test(name)) return true;
  // webcrawl_* placeholder のうち画像でないもの
  const docName = (doc.name || "").toLowerCase();
  if (
    docName.includes("/documents/webcrawl_") &&
    !docName.includes("/documents/webcrawl_img_")
  ) {
    return true;
  }
  return false;
}

/** Web クロールで取得した画像 (知識ビューでは「画像」グリッドに表示) */
export function isWebCrawlImageDocument(doc: Document): boolean {
  if (doc.id?.startsWith("webcrawl_img_")) return true;
  const docName = (doc.name || "").toLowerCase();
  if (docName.includes("/documents/webcrawl_img_")) return true;
  const filePath = (doc.filePath || "").toLowerCase();
  if (doc.webCrawlRequestId && filePath.includes("/images/")) return true;
  const mime = (doc.mimeType || "").toLowerCase();
  const name = (doc.displayName || doc.name || doc.filePath || "").toLowerCase();
  if (
    !doc.webCrawlRequestId &&
    !isWebCrawlKnowledgeStoragePath(filePath)
  ) {
    return false;
  }
  return (
    mime.startsWith("image/") ||
    /\.(png|jpe?g|gif|webp|bmp|svg|avif|heic|heif|tiff?)$/.test(name)
  );
}

/**
 * 知識一覧の種別フィルタ用。Web クロール由来は markdown→web / 画像→image に分離。
 */
export function classifyWebCrawlDocumentCategory(
  doc: Document
): "web" | "image" | "other" | null {
  if (!isWebCrawlSessionDocument(doc)) return null;
  // entryUrl はセッション代表メタのみ (ページ数には含めない)
  if (doc.subCategory === "entryUrl") return null;
  if (isWebCrawlImageDocument(doc)) return "image";
  if (isWebCrawlMarkdownDocument(doc)) return "web";
  return "other";
}
