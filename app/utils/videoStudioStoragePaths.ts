export const getVideoOriginalStoragePath = (params: {
  organizationId: string;
  spaceId: string;
  videoId: string;
  fileName: string;
}): string =>
  `organizations/${params.organizationId}/spaces/${params.spaceId}/videos/${params.videoId}/file/original/${params.fileName}`;

export const getVideoThumbnailStoragePath = (params: {
  organizationId: string;
  spaceId: string;
  videoId: string;
  fileName: string;
}): string =>
  `organizations/${params.organizationId}/spaces/${params.spaceId}/videos/${params.videoId}/thumbnails/${params.fileName}`;

export const getNarrationRecordingStoragePath = (params: {
  organizationId: string;
  spaceId: string;
  videoId: string;
  projectId: string;
  sectionId: string;
  fileName: string;
}): string =>
  `organizations/${params.organizationId}/spaces/${params.spaceId}/videos/${params.videoId}/narrationProjects/${params.projectId}/sections/${params.sectionId}/recordings/${params.fileName}`;

export const getTtsAudioStoragePath = (params: {
  organizationId: string;
  spaceId: string;
  videoId: string;
  projectId: string;
  sectionId: string;
  segmentIndex: number;
  languageCode?: string;
}): string =>
  `organizations/${params.organizationId}/spaces/${params.spaceId}/videos/${params.videoId}/narrationProjects/${params.projectId}/sections/${params.sectionId}/transcribe/aiNarration/${params.languageCode || "ja"}/${params.segmentIndex}.mp3`;

export const getMergedVideoStoragePath = (params: {
  organizationId: string;
  spaceId: string;
  videoId: string;
  projectId: string;
  fileName: string;
}): string =>
  `organizations/${params.organizationId}/spaces/${params.spaceId}/videos/${params.videoId}/narrationProjects/${params.projectId}/mergedVideos/${params.fileName}`;

export const getVideoExportStoragePath = (params: {
  organizationId: string;
  spaceId: string;
  videoId: string;
  projectId: string;
  fileName: string;
}): string =>
  `organizations/${params.organizationId}/spaces/${params.spaceId}/videos/${params.videoId}/narrationProjects/${params.projectId}/exports/${params.fileName}`;
