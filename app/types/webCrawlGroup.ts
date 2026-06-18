import type { Document } from "@models/document";
import type {
  DecodedWebCrawlRequest,
  WebCrawlImportFolder,
} from "@models/webCrawlRequest";

/** Web クロール 1 セッション分のグループ (一覧 / 詳細モーダル共通) */
export interface WebCrawlGroup {
  key: string;
  title: string;
  hostname: string;
  entryUrl: string | null;
  createdAt: Date | null;
  createdAtText: string;
  markdownCount: number;
  imageCount: number;
  indexedCount: number;
  markdownDocs: Document[];
  imageDocs: Document[];
  otherDocs: Document[];
}

export interface WebCrawlFolderGroup {
  folder: WebCrawlImportFolder;
  jobs: WebCrawlGroup[];
  requests: DecodedWebCrawlRequest[];
  latestAt: Date | null;
  pageCount: number;
  imageCount: number;
}

/** @deprecated WebCrawlGroup を使ってください */
export type CrawlGroup = WebCrawlGroup;
