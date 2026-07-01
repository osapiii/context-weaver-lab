import { z } from "zod";
import { Timestamp } from "firebase/firestore";
import { firestoreTypeConverter } from "@models/firestoreTypeConverter";

export const videoStatusSchema = z.enum([
  "pending",
  "processing",
  "completed",
  "error",
]);

export const videoSourceTypeSchema = z.enum(["youtube", "upload", "screen_recording"]);
export const videoAudioTypeSchema = z
  .enum(["with_audio", "without_audio"])
  .default("without_audio");

const finiteNumberSchema = z.coerce.number().finite().catch(0);
const optionalFiniteNumberSchema = z
  .preprocess((value) => (value === undefined ? undefined : value), z.coerce.number().finite().optional())
  .catch(undefined);

const transcriptSegmentSchema = z.object({
  id: z.string(),
  index: finiteNumberSchema,
  startMs: finiteNumberSchema,
  endMs: finiteNumberSchema,
  text: z.string(),
  confidence: optionalFiniteNumberSchema,
});

const parseTimestampLikeObject = (value: unknown): Timestamp | unknown => {
  if (!value || typeof value !== "object") return value;
  if (value instanceof Timestamp || value instanceof Date) return value;

  const record = value as Record<string, unknown>;
  const seconds = record.seconds ?? record._seconds;
  const nanoseconds = record.nanoseconds ?? record._nanoseconds;
  if (typeof seconds !== "number") return value;

  return new Timestamp(
    seconds,
    typeof nanoseconds === "number" ? nanoseconds : 0
  );
};

const timestampOrDateSchema = z.preprocess((value) => {
  const timestampLike = parseTimestampLikeObject(value);
  if (timestampLike !== value) return timestampLike;
  if (typeof value !== "string") return value;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed;
}, z.union([z.instanceof(Timestamp), z.date()]));

export const videoSchema = z.object({
  id: z.string(),
  title: z.string().min(1),
  description: z.string().optional(),
  tags: z.array(z.string()).default([]),
  sourceType: videoSourceTypeSchema,
  sourceUrl: z.string().optional(),
  videoAudioType: videoAudioTypeSchema.optional(),
  storageBucket: z.string().optional(),
  storagePath: z.string().optional(),
  originalStorageBucket: z.string().optional(),
  originalStoragePath: z.string().optional(),
  convertedStorageBucket: z.string().optional(),
  convertedStoragePath: z.string().optional(),
  thumbnailUrl: z.string().optional(),
  sceneThumbnails: z
    .array(
      z.object({
        timestampSeconds: finiteNumberSchema,
        imageUrl: z.string(),
        storageBucket: z.string().optional(),
        storagePath: z.string().optional(),
      })
    )
    .default([]),
  duration: optionalFiniteNumberSchema,
  status: videoStatusSchema.default("pending"),
  transcriptionStatus: videoStatusSchema.default("pending"),
  transcriptionResult: z.string().optional(),
  transcriptionResultUrl: z.string().optional(),
  transcriptSegments: z.array(transcriptSegmentSchema).default([]),
  transcriptSrt: z.string().optional(),
  transcriptTimingStatus: z.literal("timestamped").optional(),
  createdAt: timestampOrDateSchema,
  updatedAt: timestampOrDateSchema,
  deletedAt: timestampOrDateSchema.optional(),
});

export type VideoStudioVideo = z.infer<typeof videoSchema>;
export type VideoStudioVideoCreateInput = Omit<
  VideoStudioVideo,
  "id" | "createdAt" | "updatedAt" | "deletedAt"
>;
export type VideoStudioVideoUpdateInput = Partial<VideoStudioVideoCreateInput> & {
  deletedAt?: Timestamp;
};

export const videoConverter = firestoreTypeConverter(videoSchema);

export const narrationProjectStepSchema = z.enum([
  "section_split",
  "recording",
  "voice_generation",
  "export",
  "subtitle",
]);

export const narrationProjectStatusSchema = z.enum([
  "draft",
  "in_progress",
  "completed",
  "archived",
]);

export const narrationSegmentSchema = z.object({
  id: z.string().optional(),
  originalText: z.string().default(""),
  rewrittenText: z.string().default(""),
  start: z.string().default("0:00"),
  startSeconds: optionalFiniteNumberSchema,
  endSeconds: optionalFiniteNumberSchema,
  characterCount: z.number().default(0),
  isTtsGenerated: z.boolean().default(false),
  requestOutput: z.record(z.string(), z.unknown()).optional(),
});

export type VideoStudioNarrationSegment = z.infer<typeof narrationSegmentSchema>;

export const sectionRecordingSchema = z.object({
  recordingId: z.string(),
  audioBucketName: z.string(),
  audioFilePath: z.string(),
  audioContentType: z.string().default("audio/webm"),
  audioSizeBytes: finiteNumberSchema.default(0),
  durationSeconds: finiteNumberSchema.default(0),
  waveform: z.array(finiteNumberSchema).default([]),
  transcriptionRequestId: z.string().optional(),
  transcriptionStatus: videoStatusSchema.default("pending"),
  transcriptionBucketName: z.string().optional(),
  transcriptionFilePath: z.string().optional(),
  transcript: z.string().optional(),
  recordedAt: timestampOrDateSchema.optional(),
});

export const splitVideoInfoSchema = z.object({
  bucketName: z.string().default(""),
  gcsFilePath: z.string().default(""),
  segmentNumber: finiteNumberSchema.default(0),
  startTime: finiteNumberSchema.default(0),
  endTime: finiteNumberSchema.default(0),
  duration: finiteNumberSchema.default(0),
  sizeBytes: finiteNumberSchema.default(0),
  createdAt: timestampOrDateSchema.optional(),
});

export const videoSectionSchema = z.object({
  id: z.string(),
  index: finiteNumberSchema,
  title: z.string().optional(),
  memo: z.string().optional(),
  startTime: finiteNumberSchema,
  endTime: finiteNumberSchema,
  splitVideo: splitVideoInfoSchema.optional(),
  splitVideoConverted: splitVideoInfoSchema.optional(),
  videoSegment: splitVideoInfoSchema.optional(),
  audioSegment: splitVideoInfoSchema.optional(),
  recording: sectionRecordingSchema.optional(),
  finalyNarrations: z.array(narrationSegmentSchema).default([]),
  isFixed: z.boolean().default(false),
  finalyNarrationsByLanguage: z
    .record(z.string(), z.array(narrationSegmentSchema))
    .optional(),
  mergedVideoOutput: z
    .object({
      resultBucketName: z.string().optional(),
      resultFilePath: z.string().optional(),
      processingTime: finiteNumberSchema.nullable().optional(),
      statistics: z.record(z.string(), z.unknown()).optional(),
      requestId: z.string().optional(),
    })
    .optional(),
});

export type VideoStudioSection = z.infer<typeof videoSectionSchema>;

export const subtitlePresetSchema = z.enum([
  "clear_standard",
  "business_emphasis",
  "cinema_bottom",
  "shorts_pop",
  "soft_gray_panel",
]);

export const subtitleSettingsSchema = z.object({
  enabled: z.boolean().default(true),
  preset: subtitlePresetSchema.default("clear_standard"),
  size: z.enum(["small", "medium", "large"]).default("medium"),
  position: z.enum(["top", "bottom"]).default("bottom"),
  fontScale: finiteNumberSchema.default(1),
  skipped: z.boolean().default(false),
});

export const subtitleAssetSchema = z.object({
  resultBucketName: z.string().optional(),
  resultFilePath: z.string().optional(),
});

export const subtitleOutputSchema = z
  .object({
    subtitledVideo: subtitleAssetSchema.optional(),
    srt: subtitleAssetSchema.optional(),
    ass: subtitleAssetSchema.optional(),
    requestId: z.string().optional(),
    generatedAt: timestampOrDateSchema.optional(),
    preset: subtitlePresetSchema.optional(),
    statistics: z.record(z.string(), z.unknown()).optional(),
  })
  .nullable();

export const silenceCutSettingsSchema = z.object({
  enabled: z.boolean().default(false),
  preset: z.enum(["natural"]).default("natural"),
  thresholdDb: finiteNumberSchema.default(-38),
  minSilenceMs: finiteNumberSchema.default(700),
  keepPaddingMs: finiteNumberSchema.default(180),
  minSegmentMs: finiteNumberSchema.default(450),
  skipped: z.boolean().default(false),
});

export const silenceCutAssetSchema = z.object({
  resultBucketName: z.string().optional(),
  resultFilePath: z.string().optional(),
});

export const silenceCutOutputSchema = z
  .object({
    trimmedVideo: silenceCutAssetSchema.optional(),
    manifest: silenceCutAssetSchema.optional(),
    requestId: z.string().optional(),
    generatedAt: timestampOrDateSchema.optional(),
    settings: silenceCutSettingsSchema.optional(),
    statistics: z.record(z.string(), z.unknown()).optional(),
  })
  .nullable();

export const timelineStateSchema = z.object({
  currentTime: finiteNumberSchema.default(0),
  duration: finiteNumberSchema.default(0),
  isPlaying: z.boolean().default(false),
  playbackRate: finiteNumberSchema.default(1),
  zoomLevel: finiteNumberSchema.default(5),
  scrollPosition: finiteNumberSchema.default(0),
});

export const editorStateSchema = z.object({
  splitPoints: z.array(z.number()).default([]),
  tracks: z.array(z.record(z.string(), z.unknown())).default([]),
  isSectionLocked: z.boolean().default(false),
  selectedSectionIndex: z.number().nullable().default(null),
  selectedSection: videoSectionSchema.nullable().default(null),
  timeline: timelineStateSchema.default({}),
  recording: z.record(z.string(), z.unknown()).default({}),
  ui: z.record(z.string(), z.unknown()).default({}),
  audioDevices: z.record(z.string(), z.unknown()).default({}),
  thumbnailCache: z.record(z.string(), z.string()).default({}),
  video: z
    .object({
      id: z.string().default(""),
      url: z.string().default(""),
      title: z.string().default(""),
      type: videoSourceTypeSchema.default("upload"),
    })
    .default({}),
  finalyNarrations: z.array(narrationSegmentSchema).default([]),
});

export type VideoStudioEditorState = z.infer<typeof editorStateSchema>;

export const narrationVideoProjectSchema = z.object({
  id: z.string(),
  videoId: z.string(),
  organizationId: z.string(),
  name: z.string().min(1),
  description: z.string().optional(),
  status: narrationProjectStatusSchema.default("draft"),
  videoAudioType: videoAudioTypeSchema,
  voiceName: z.string().default("Puck"),
  currentStep: narrationProjectStepSchema.default("section_split"),
  completedSteps: z.array(narrationProjectStepSchema).default([]),
  sections: z.array(videoSectionSchema).default([]),
  editorState: editorStateSchema.default({}),
  mergedVideoOutput: z.record(z.string(), z.unknown()).nullable().default(null),
  mergedVideoOutputSilenceCut: z
    .record(z.string(), z.unknown())
    .nullable()
    .optional(),
  subtitleSettings: subtitleSettingsSchema.default({}),
  subtitleOutput: subtitleOutputSchema.optional().default(null),
  silenceCutSettings: silenceCutSettingsSchema.default({}),
  silenceCutOutput: silenceCutOutputSchema.optional().default(null),
  latestExportedZip: z.record(z.string(), z.unknown()).nullable().optional(),
  latestExportedAt: timestampOrDateSchema.nullable().optional(),
  createdAt: timestampOrDateSchema,
  updatedAt: timestampOrDateSchema,
  lastEditedAt: timestampOrDateSchema.optional(),
});

export type VideoStudioProject = z.infer<typeof narrationVideoProjectSchema>;
export type VideoStudioProjectCreateInput = Omit<
  VideoStudioProject,
  "id" | "createdAt" | "updatedAt" | "lastEditedAt"
>;
export type VideoStudioProjectUpdateInput = Partial<VideoStudioProjectCreateInput> & {
  lastEditedAt?: Timestamp;
};

export const narrationVideoProjectConverter = firestoreTypeConverter(
  narrationVideoProjectSchema
);

export const createEmptyEditorState = (params: {
  videoId: string;
  title: string;
  sourceType: "youtube" | "upload" | "screen_recording";
  duration?: number;
}): VideoStudioEditorState => ({
  splitPoints: [],
  tracks: [],
  isSectionLocked: false,
  selectedSectionIndex: null,
  selectedSection: null,
  timeline: {
    currentTime: 0,
    duration: params.duration ?? 0,
    isPlaying: false,
    playbackRate: 1,
    zoomLevel: 5,
    scrollPosition: 0,
  },
  recording: {},
  ui: {},
  audioDevices: {},
  thumbnailCache: {},
  video: {
    id: params.videoId,
    url: "",
    title: params.title,
    type: params.sourceType,
  },
  finalyNarrations: [],
});
