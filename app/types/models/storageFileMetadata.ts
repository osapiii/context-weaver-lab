/**
 * Firebase Storage ファイルメタデータ型定義
 *
 * @remarks
 * - Firebase Storage APIから取得するメタデータの型
 * - ファイルエクスプローラーで使用
 */
export interface StorageFileMetadata {
  /** ファイル名 */
  name: string
  /** フルパス（organizations/{organizationId}/...） */
  fullPath: string
  /** バケット名 */
  bucket: string
  /** ファイルサイズ（バイト） */
  size: number
  /** コンテンツタイプ */
  contentType: string
  /** 作成日時 */
  timeCreated: string
  /** 更新日時 */
  updated: string
}

/**
 * ファイルタイプフィルタ
 */
export type FileTypeFilter = 'all' | 'image' | 'video' | 'audio' | 'document' | 'other'

/**
 * ソート対象フィールド
 */
export type SortBy = 'name' | 'updated' | 'size' | 'type'

/**
 * ソート順
 */
export type SortOrder = 'asc' | 'desc'

/**
 * パンくずリストアイテム
 */
export interface BreadcrumbItem {
  /** 表示ラベル */
  label: string
  /** パス */
  path: string
  /** ルートかどうか */
  isRoot: boolean
}

/**
 * Signed URLキャッシュエントリ
 */
export interface SignedUrlCacheEntry {
  /** Signed URL */
  url: string
  /** 有効期限（Unixタイムスタンプ ミリ秒） */
  expiresAt: number
}

/**
 * ファイル拡張子を抽出
 *
 * @param fileName - ファイル名
 * @returns 拡張子（小文字、ドットなし）
 *
 * @example
 * extractFileExtension('example.pdf') // => 'pdf'
 * extractFileExtension('image.PNG') // => 'png'
 * extractFileExtension('noext') // => ''
 */
export function extractFileExtension(fileName: string): string {
  const match = fileName.match(/\.([^.]+)$/)
  return match ? match[1].toLowerCase() : ''
}

/**
 * ファイル拡張子からファイルタイプを判定
 *
 * @param extension - ファイル拡張子
 * @returns ファイルタイプ
 */
export function getFileTypeFromExtension(extension: string): FileTypeFilter {
  const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg']
  const videoExtensions = ['mp4', 'mov', 'avi', 'mkv', 'webm', 'flv']
  const audioExtensions = ['mp3', 'wav', 'ogg', 'flac', 'aac', 'm4a']
  const documentExtensions = [
    'pdf',
    'doc',
    'docx',
    'xls',
    'xlsx',
    'ppt',
    'pptx',
    'txt',
    'md',
    'markdown',
    'csv',
    // Google Drive desktop shortcut extensions
    'gdoc',
    'gsheet',
    'gslides',
    'gdraw',
    'gform',
    'gmap',
    'gsite',
  ]

  if (imageExtensions.includes(extension)) return 'image'
  if (videoExtensions.includes(extension)) return 'video'
  if (audioExtensions.includes(extension)) return 'audio'
  if (documentExtensions.includes(extension)) return 'document'
  return 'other'
}
