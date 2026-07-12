/**
 * Firebase Storage パス生成ユーティリティ
 * すべての関数は Space-aware で、spaceId を必須パラメータとして受け取ります
 */

/**
 * Video ファイルの Storage パスを生成
 * @param organizationId - 組織ID
 * @param spaceId - Space ID（必須）
 * @param videoId - 動画ID
 * @param fileName - ファイル名
 * @returns Storage パス文字列
 */
export function getVideoStoragePath(
  organizationId: string,
  spaceId: string,
  videoId: string,
  fileName: string
): string {
  if (!spaceId) {
    throw new Error("spaceId is required for path generation");
  }
  return `organizations/${organizationId}/spaces/${spaceId}/videos/${videoId}/file/${fileName}`;
}

/**
 * 分割動画セグメントの Storage パスを生成
 * @param organizationId - 組織ID
 * @param spaceId - Space ID（必須）
 * @param videoId - 動画ID
 * @param projectId - プロジェクトID
 * @param sectionId - セクションID
 * @param fileName - ファイル名
 * @returns Storage パス文字列
 */
export function getSplitVideoStoragePath(
  organizationId: string,
  spaceId: string,
  videoId: string,
  projectId: string,
  sectionId: string,
  fileName: string
): string {
  if (!spaceId) {
    throw new Error("spaceId is required for path generation");
  }
  return `organizations/${organizationId}/spaces/${spaceId}/videos/${videoId}/narrationProjects/${projectId}/sections/${sectionId}/recordings/${fileName}`;
}

/**
 * 音声録音の Storage パスを生成
 * @param organizationId - 組織ID
 * @param spaceId - Space ID（必須）
 * @param videoId - 動画ID
 * @param projectId - プロジェクトID
 * @param sectionId - セクションID
 * @param recordingId - 録音ID
 * @param extension - ファイル拡張子（デフォルト: webm）
 * @returns Storage パス文字列
 */
export function getRecordingStoragePath(
  organizationId: string,
  spaceId: string,
  videoId: string,
  projectId: string,
  sectionId: string,
  recordingId: string,
  extension: string = "webm"
): string {
  if (!spaceId) {
    throw new Error("spaceId is required for path generation");
  }
  return `organizations/${organizationId}/spaces/${spaceId}/videos/${videoId}/narrationProjects/${projectId}/sections/${sectionId}/recordings/${recordingId}.${extension}`;
}

/**
 * TTS 音声の Storage パスを生成
 * @param organizationId - 組織ID
 * @param spaceId - Space ID（必須）
 * @param videoId - 動画ID
 * @param projectId - プロジェクトID
 * @param sectionId - セクションID
 * @param segmentIndex - セグメントインデックス
 * @returns Storage パス文字列
 */
export function getTTSAudioPath(
  organizationId: string,
  spaceId: string,
  videoId: string,
  projectId: string,
  sectionId: string,
  segmentIndex: number
): string {
  if (!spaceId) {
    throw new Error("spaceId is required for path generation");
  }
  return `organizations/${organizationId}/spaces/${spaceId}/videos/${videoId}/narrationProjects/${projectId}/sections/${sectionId}/aiNarration/segments/${segmentIndex}/audio.mp3`;
}

/**
 * サムネイル画像の Storage パスを生成
 * @param organizationId - 組織ID
 * @param spaceId - Space ID（必須）
 * @param videoId - 動画ID
 * @param fileName - ファイル名
 * @returns Storage パス文字列
 */
export function getThumbnailStoragePath(
  organizationId: string,
  spaceId: string,
  videoId: string,
  fileName: string
): string {
  if (!spaceId) {
    throw new Error("spaceId is required for path generation");
  }
  return `organizations/${organizationId}/spaces/${spaceId}/videos/${videoId}/thumbnails/${fileName}`;
}

/**
 * エクスポート動画の Storage パスを生成
 * @param organizationId - 組織ID
 * @param spaceId - Space ID（必須）
 * @param videoId - 動画ID
 * @param projectId - プロジェクトID
 * @param fileName - ファイル名
 * @returns Storage パス文字列
 */
export function getExportStoragePath(
  organizationId: string,
  spaceId: string,
  videoId: string,
  projectId: string,
  fileName: string
): string {
  if (!spaceId) {
    throw new Error("spaceId is required for path generation");
  }
  return `organizations/${organizationId}/spaces/${spaceId}/videos/${videoId}/narrationProjects/${projectId}/exports/${fileName}`;
}

/**
 * Reference ファイルの Storage パスを生成
 * @param organizationId - 組織ID
 * @param spaceId - Space ID（必須）
 * @param type - Reference タイプ
 * @param referenceId - Reference ID
 * @returns Storage パス文字列
 */
export function getReferenceStoragePath(
  organizationId: string,
  spaceId: string,
  type: string,
  referenceId: string
): string {
  if (!spaceId) {
    throw new Error("spaceId is required for path generation");
  }
  return `organizations/${organizationId}/spaces/${spaceId}/references/${type}/${referenceId}`;
}

/**
 * Context ファイルの Storage パスを生成
 * @param organizationId - 組織ID
 * @param spaceId - Space ID（必須）
 * @param contextId - Context ID
 * @returns Storage パス文字列
 */
export function getContextStoragePath(
  organizationId: string,
  spaceId: string,
  contextId: string
): string {
  if (!spaceId) {
    throw new Error("spaceId is required for path generation");
  }
  return `organizations/${organizationId}/spaces/${spaceId}/contexts/${contextId}`;
}

/**
 * Transcription ファイルの Storage パスを生成
 * @param organizationId - 組織ID
 * @param spaceId - Space ID（必須）
 * @param videoId - 動画ID
 * @param requestId - リクエストID
 * @returns Storage パス文字列
 */
export function getTranscriptionStoragePath(
  organizationId: string,
  spaceId: string,
  videoId: string,
  requestId: string
): string {
  if (!spaceId) {
    throw new Error("spaceId is required for path generation");
  }
  return `organizations/${organizationId}/spaces/${spaceId}/videos/${videoId}/gladioTranscription/${requestId}/transcript/`;
}

/**
 * セクションサムネイルの Storage パスを生成
 * @param organizationId - 組織ID
 * @param spaceId - Space ID（必須）
 * @param videoId - 動画ID
 * @param projectId - プロジェクトID
 * @param sectionId - セクションID
 * @param extension - ファイル拡張子（デフォルト: jpg）
 * @returns Storage パス文字列
 */
export function getSectionThumbnailStoragePath(
  organizationId: string,
  spaceId: string,
  videoId: string,
  projectId: string,
  sectionId: string,
  extension: string = "jpg"
): string {
  if (!spaceId) {
    throw new Error("spaceId is required for path generation");
  }
  return `organizations/${organizationId}/spaces/${spaceId}/videos/${videoId}/narrationProjects/${projectId}/thumbnails/${sectionId}.${extension}`;
}
