import { defineStore } from "pinia";
import {
  Timestamp,
  collection,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  orderBy,
  query,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import {
  getDownloadURL,
  getStorage,
  ref as storageRef,
  uploadBytesResumable,
} from "firebase/storage";
import {
  createEmptyEditorState,
  narrationVideoProjectConverter,
  narrationVideoProjectSchema,
  videoConverter,
  videoSchema,
  type VideoStudioProject,
  type VideoStudioProjectCreateInput,
  type VideoStudioProjectUpdateInput,
  type VideoStudioSection,
  type VideoStudioVideo,
  type VideoStudioVideoCreateInput,
  type VideoStudioVideoUpdateInput,
} from "@models/videoStudio";
import { reportDatadogError } from "@utils/datadogObservability";
import log from "@utils/logger";
import { getVideoOriginalStoragePath } from "@utils/videoStudioStoragePaths";

const createId = (prefix: string): string =>
  `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

const safeFileName = (name: string): string =>
  name
    .replace(/[^\w.-]+/g, "_")
    .replace(/_+/g, "_")
    .slice(0, 140);

const isPlainObject = (value: unknown): value is Record<string, unknown> => {
  if (!value || typeof value !== "object") return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
};

const removeUndefinedFields = <T>(value: T): T => {
  if (Array.isArray(value)) {
    return value
      .filter((item) => item !== undefined)
      .map((item) => removeUndefinedFields(item)) as T;
  }
  if (!isPlainObject(value)) return value;
  return Object.fromEntries(
    Object.entries(value)
      .filter(([, entryValue]) => entryValue !== undefined)
      .map(([key, entryValue]) => [key, removeUndefinedFields(entryValue)])
  ) as T;
};

const collectUndefinedFieldPaths = (
  value: unknown,
  prefix = ""
): string[] => {
  if (value === undefined) return [prefix || "(root)"];
  if (Array.isArray(value)) {
    return value.flatMap((item, index) =>
      collectUndefinedFieldPaths(item, `${prefix}[${index}]`)
    );
  }
  if (!isPlainObject(value)) return [];
  return Object.entries(value).flatMap(([key, entryValue]) =>
    collectUndefinedFieldPaths(entryValue, prefix ? `${prefix}.${key}` : key)
  );
};

const hasPersistedEditorProgress = (project: VideoStudioProject): boolean => {
  if (project.currentStep !== "section_split") return true;
  if ((project.completedSteps ?? []).length > 0) return true;
  if (project.mergedVideoOutput) return true;
  if (project.subtitleOutput) return true;
  if (project.silenceCutOutput) return true;
  if (project.latestExportedZip || project.latestExportedAt) return true;
  return (project.sections ?? []).some((section) => {
    if (section.isFixed || section.mergedVideoOutput) return true;
    if (section.recording?.transcriptionStatus === "completed") return true;
    return (section.finalyNarrations ?? []).some(
      (segment) => segment.isTtsGenerated || Boolean(segment.requestOutput)
    );
  });
};

const extractYouTubeVideoId = (url: string): string | null => {
  const match = url.match(
    /(?:youtube\.com\/(?:[^/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?/\\s]{11})/
  );
  return match ? match[1] ?? null : null;
};

export const useVideoStudioStore = defineStore("videoStudio", {
  state: () => ({
    videos: [] as VideoStudioVideo[],
    selectedVideo: null as VideoStudioVideo | null,
    projects: [] as VideoStudioProject[],
    selectedProject: null as VideoStudioProject | null,
    selectedVideoUrl: "" as string,
    selectedProjectOutputUrl: "" as string,
    selectedProjectSubtitleOutputUrl: "" as string,
    selectedProjectSilenceCutOutputUrl: "" as string,
    isLoading: false,
    isUploading: false,
    uploadProgress: 0,
    errorMessage: "" as string,
    view: "list" as "list" | "detail" | "editor",
  }),

  getters: {
    organizationId(): string {
      const organizationStore = useOrganizationStore();
      return organizationStore.loggedInOrganizationInfo?.id ?? "";
    },
    spaceId(): string {
      const spaceStore = useSpaceStore();
      return spaceStore.selectedSpace?.id ?? "";
    },
    defaultBucket(): string {
      const config = useRuntimeConfig();
      return config.public.firebase?.storageBucket || "";
    },
    videosPath(): string {
      if (!this.organizationId || !this.spaceId) return "";
      return `organizations/${this.organizationId}/spaces/${this.spaceId}/videos`;
    },
    projectsPath:
      () =>
      (videoId: string): string => {
        const organizationStore = useOrganizationStore();
        const spaceStore = useSpaceStore();
        const organizationId = organizationStore.loggedInOrganizationInfo?.id ?? "";
        const spaceId = spaceStore.selectedSpace?.id ?? "";
        return `organizations/${organizationId}/spaces/${spaceId}/videos/${videoId}/narrationProjects`;
      },
    inProgressVideos: (state): VideoStudioVideo[] =>
      state.videos.filter((video) => video.status !== "completed"),
    completedVideos: (state): VideoStudioVideo[] =>
      state.videos.filter((video) => video.status === "completed"),
  },

  actions: {
    requireScope(): { organizationId: string; spaceId: string } {
      if (!this.organizationId || !this.spaceId) {
        throw new Error("動画スタジオを使うには組織とスペースの選択が必要です。");
      }
      return { organizationId: this.organizationId, spaceId: this.spaceId };
    },

    async loadVideos(): Promise<void> {
      const { organizationId, spaceId } = this.requireScope();
      this.isLoading = true;
      this.errorMessage = "";
      try {
        const db = getFirestore();
        const q = query(
          collection(
            db,
            `organizations/${organizationId}/spaces/${spaceId}/videos`
          ),
          orderBy("updatedAt", "desc")
        );
        const snap = await getDocs(q);
        this.videos = snap.docs
          .map((item) => {
            const result = videoSchema
              .passthrough()
              .safeParse({ ...item.data(), id: item.id });
            if (result.success) return result.data;

            const error = new Error("Invalid video studio document");
            reportDatadogError(error, {
              feature: "video_studio",
              action: "load_videos",
              organizationId,
              spaceId,
              videoId: item.id,
              issues: result.error.issues.map((issue) => ({
                path: issue.path.join("."),
                message: issue.message,
                code: issue.code,
              })),
            });
            log("WARN", "[VideoStudio] Skipping invalid video document", {
              videoId: item.id,
              issues: result.error.issues,
            });
            return null;
          })
          .filter((video): video is VideoStudioVideo => video !== null)
          .filter((video) => !video.deletedAt);
      } catch (error) {
        this.errorMessage = error instanceof Error ? error.message : String(error);
        throw error;
      } finally {
        this.isLoading = false;
      }
    },

    async openVideo(videoId: string): Promise<void> {
      const { organizationId, spaceId } = this.requireScope();
      this.isLoading = true;
      this.errorMessage = "";
      try {
        const db = getFirestore();
        const videoRef = doc(
          db,
          `organizations/${organizationId}/spaces/${spaceId}/videos/${videoId}`
        ).withConverter(videoConverter);
        const snap = await getDoc(videoRef);
        if (!snap.exists()) throw new Error("動画が見つかりません。");
        this.selectedVideo = snap.data();
        this.view = "detail";
        await Promise.all([
          this.loadProjects(videoId),
          this.resolveSelectedVideoUrl(),
        ]);
      } catch (error) {
        this.errorMessage = error instanceof Error ? error.message : String(error);
        throw error;
      } finally {
        this.isLoading = false;
      }
    },

    async createYoutubeVideo(params: {
      title: string;
      sourceUrl: string;
      description?: string;
      tags?: string[];
    }): Promise<string> {
      const { organizationId, spaceId } = this.requireScope();
      const db = getFirestore();
      const videoId = createId("video");
      const youtubeId = extractYouTubeVideoId(params.sourceUrl);
      const input: VideoStudioVideoCreateInput = {
        title: params.title.trim(),
        description: params.description?.trim() || undefined,
        tags: params.tags ?? [],
        sourceType: "youtube",
        sourceUrl: params.sourceUrl.trim(),
        thumbnailUrl: youtubeId
          ? `https://img.youtube.com/vi/${youtubeId}/hqdefault.jpg`
          : undefined,
        sceneThumbnails: [],
        status: "completed",
        transcriptionStatus: "pending",
        transcriptSegments: [],
      };
      await setDoc(
        doc(
          db,
          `organizations/${organizationId}/spaces/${spaceId}/videos/${videoId}`
        ).withConverter(videoConverter),
        removeUndefinedFields({ id: videoId, ...input } as VideoStudioVideo)
      );
      await this.loadVideos();
      await this.openVideo(videoId);
      return videoId;
    },

    async createUploadedVideo(params: {
      title: string;
      file: File;
      description?: string;
      tags?: string[];
      sourceType?: "upload" | "screen_recording";
      transcriptionResult?: string;
      openAfterCreate?: boolean;
    }): Promise<string> {
      const { organizationId, spaceId } = this.requireScope();
      const videoId = createId("video");
      const storage = getStorage();
      const bucket = this.defaultBucket;
      const filePath = getVideoOriginalStoragePath({
        organizationId,
        spaceId,
        videoId,
        fileName: safeFileName(params.file.name),
      });
      this.isUploading = true;
      this.uploadProgress = 0;
      this.errorMessage = "";
      try {
        await new Promise<void>((resolve, reject) => {
          const task = uploadBytesResumable(storageRef(storage, filePath), params.file, {
            contentType: params.file.type || "video/mp4",
          });
          task.on(
            "state_changed",
            (snapshot) => {
              this.uploadProgress =
                snapshot.totalBytes > 0
                  ? Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100)
                  : 0;
            },
            reject,
            () => resolve()
          );
        });

        const db = getFirestore();
        const input: VideoStudioVideoCreateInput = {
          title: params.title.trim(),
          description: params.description?.trim() || undefined,
          tags: params.tags ?? [],
          sourceType: params.sourceType ?? "upload",
          storageBucket: bucket,
          storagePath: filePath,
          originalStorageBucket: bucket,
          originalStoragePath: filePath,
          sceneThumbnails: [],
          status: "completed",
          transcriptionStatus: params.transcriptionResult?.trim() ? "completed" : "pending",
          transcriptionResult: params.transcriptionResult?.trim() || undefined,
          transcriptSegments: [],
        };
        await setDoc(
          doc(
            db,
            `organizations/${organizationId}/spaces/${spaceId}/videos/${videoId}`
          ).withConverter(videoConverter),
          removeUndefinedFields({ id: videoId, ...input } as VideoStudioVideo)
        );
        await this.loadVideos();
        if (params.openAfterCreate !== false) await this.openVideo(videoId);
        return videoId;
      } catch (error) {
        this.errorMessage = error instanceof Error ? error.message : String(error);
        throw error;
      } finally {
        this.isUploading = false;
      }
    },

    async createStorageBackedVideo(params: {
      videoId: string;
      title: string;
      storageBucket: string;
      storagePath: string;
      fileName?: string;
      contentType?: string;
      description?: string;
      tags?: string[];
      duration?: number;
      sourceType?: "upload" | "screen_recording";
      transcriptSegments: VideoStudioVideo["transcriptSegments"];
      transcriptSrt: string;
      openAfterCreate?: boolean;
    }): Promise<string> {
      const { organizationId, spaceId } = this.requireScope();
      const db = getFirestore();
      const input: VideoStudioVideoCreateInput = {
        title: params.title.trim(),
        description: params.description?.trim() || undefined,
        tags: params.tags ?? [],
        sourceType: params.sourceType ?? "screen_recording",
        videoAudioType: params.contentType?.startsWith("video/")
          ? "with_audio"
          : "without_audio",
        storageBucket: params.storageBucket,
        storagePath: params.storagePath,
        originalStorageBucket: params.storageBucket,
        originalStoragePath: params.storagePath,
        sceneThumbnails: [],
        duration: params.duration,
        status: "completed",
        transcriptionStatus: "completed",
        transcriptionResult: params.transcriptSegments.map((segment) => segment.text).join("\n"),
        transcriptSegments: params.transcriptSegments,
        transcriptSrt: params.transcriptSrt.trim(),
        transcriptTimingStatus: "timestamped",
      };
      await setDoc(
        doc(
          db,
          `organizations/${organizationId}/spaces/${spaceId}/videos/${params.videoId}`
        ).withConverter(videoConverter),
        removeUndefinedFields({
          id: params.videoId,
          ...input,
          sourceStoryVaultOperationVideo: true,
        } as unknown as VideoStudioVideo & Record<string, unknown>),
        { merge: true }
      );
      await this.loadVideos();
      if (params.openAfterCreate !== false) await this.openVideo(params.videoId);
      return params.videoId;
    },

    async createOrOpenPreparedProject(params: {
      video: VideoStudioVideo;
      projectId: string;
      name: string;
      description?: string;
      voiceName?: string;
      sections: VideoStudioSection[];
      openAfterCreate?: boolean;
      refreshPreparedSections?: boolean;
    }): Promise<string> {
      const { organizationId, spaceId } = this.requireScope();
      const db = getFirestore();
      const projectRef = doc(
        db,
        `organizations/${organizationId}/spaces/${spaceId}/videos/${params.video.id}/narrationProjects/${params.projectId}`
      ).withConverter(narrationVideoProjectConverter);
      const existing = await getDoc(projectRef);
      const makeEditorState = () => {
        const baseEditorState = createEmptyEditorState({
          videoId: params.video.id,
          title: params.video.title,
          sourceType: params.video.sourceType,
          duration: params.video.duration,
        });
        const selectedSectionIndex = params.sections.length > 0 ? 0 : null;
        return {
          ...baseEditorState,
          splitPoints: params.sections
            .slice(1)
            .map((section) => section.startTime)
            .filter((time) => Number.isFinite(time) && time > 0),
          selectedSectionIndex,
          selectedSection:
            typeof selectedSectionIndex === "number"
              ? params.sections[selectedSectionIndex] ?? null
              : null,
          timeline: {
            ...baseEditorState.timeline,
            duration: params.video.duration ?? params.sections.at(-1)?.endTime ?? 0,
          },
        };
      };
      const editorState = makeEditorState();
      if (!existing.exists()) {
        const input: VideoStudioProjectCreateInput = {
          videoId: params.video.id,
          organizationId,
          name: params.name.trim(),
          description: params.description?.trim() || undefined,
          status: "in_progress",
          videoAudioType: "with_audio",
          voiceName: params.voiceName || "Puck",
          currentStep: "section_split",
          completedSteps: [],
          sections: params.sections,
          editorState,
          mergedVideoOutput: null,
          silenceCutSettings: {
            enabled: false,
            preset: "natural",
            thresholdDb: -38,
            minSilenceMs: 700,
            keepPaddingMs: 180,
            minSegmentMs: 450,
            skipped: false,
          },
          silenceCutOutput: null,
          subtitleSettings: {
            enabled: true,
            preset: "clear_standard",
            size: "medium",
            position: "bottom",
            fontScale: 1,
            skipped: false,
          },
          subtitleOutput: null,
        };
        await setDoc(
          projectRef,
          removeUndefinedFields({ id: params.projectId, ...input } as VideoStudioProject)
        );
      } else {
        const existingProject = existing.data();
        const shouldRefreshPreparedSections =
          params.refreshPreparedSections === true &&
          params.sections.length > 0 &&
          !hasPersistedEditorProgress(existingProject);
        await updateDoc(projectRef, removeUndefinedFields({
          ...(shouldRefreshPreparedSections
            ? {
                videoAudioType: "with_audio" as const,
                currentStep: "section_split" as const,
                sections: params.sections,
                editorState,
              }
            : {}),
          updatedAt: Timestamp.now(),
          lastEditedAt: Timestamp.now(),
        }));
      }
      await this.loadProjects(params.video.id);
      if (params.openAfterCreate !== false) {
        await this.openProject(params.video.id, params.projectId);
      }
      return params.projectId;
    },

    async updateVideo(
      videoId: string,
      updates: VideoStudioVideoUpdateInput
    ): Promise<void> {
      const { organizationId, spaceId } = this.requireScope();
      const db = getFirestore();
      const payload = removeUndefinedFields({
        ...updates,
        updatedAt: Timestamp.now(),
      });
      await updateDoc(
        doc(
          db,
          `organizations/${organizationId}/spaces/${spaceId}/videos/${videoId}`
        ),
        payload
      );
      await this.loadVideos();
      if (this.selectedVideo?.id === videoId) await this.openVideo(videoId);
    },

    async deleteVideo(videoId: string): Promise<void> {
      await this.updateVideo(videoId, { deletedAt: Timestamp.now() });
      if (this.selectedVideo?.id === videoId) {
        this.selectedVideo = null;
        this.selectedVideoUrl = "";
        this.selectedProjectOutputUrl = "";
        this.selectedProjectSubtitleOutputUrl = "";
        this.selectedProjectSilenceCutOutputUrl = "";
        this.projects = [];
        this.selectedProject = null;
        this.view = "list";
      }
    },

    async loadProjects(videoId: string): Promise<void> {
      const { organizationId, spaceId } = this.requireScope();
      const db = getFirestore();
      const q = query(
        collection(
          db,
          `organizations/${organizationId}/spaces/${spaceId}/videos/${videoId}/narrationProjects`
        ),
        orderBy("updatedAt", "desc")
      );
      const snap = await getDocs(q);
      this.projects = snap.docs
        .map((item) => {
          const result = narrationVideoProjectSchema
            .passthrough()
            .safeParse({ ...item.data(), id: item.id });
          if (result.success) return result.data;

          const error = new Error("Invalid video studio project document");
          reportDatadogError(error, {
            feature: "video_studio",
            action: "load_projects",
            organizationId,
            spaceId,
            videoId,
            projectId: item.id,
            issues: result.error.issues.map((issue) => ({
              path: issue.path.join("."),
              message: issue.message,
              code: issue.code,
            })),
          });
          log("WARN", "[VideoStudio] Skipping invalid project document", {
            videoId,
            projectId: item.id,
            issues: result.error.issues,
          });
          return null;
        })
        .filter((project): project is VideoStudioProject => project !== null);
    },

    async createProject(params: {
      video: VideoStudioVideo;
      name: string;
      description?: string;
      videoAudioType: "with_audio" | "without_audio";
      voiceName?: string;
      openAfterCreate?: boolean;
    }): Promise<string> {
      const { organizationId, spaceId } = this.requireScope();
      const db = getFirestore();
      const projectId = createId("narrationProject");
      const input: VideoStudioProjectCreateInput = {
        videoId: params.video.id,
        organizationId,
        name: params.name.trim(),
        description: params.description?.trim() || undefined,
        status: "in_progress",
        videoAudioType: params.videoAudioType,
        voiceName: params.voiceName || "Puck",
        currentStep: "section_split",
        completedSteps: [],
        sections: [],
        editorState: createEmptyEditorState({
          videoId: params.video.id,
          title: params.video.title,
          sourceType: params.video.sourceType,
          duration: params.video.duration,
        }),
        mergedVideoOutput: null,
        silenceCutSettings: {
          enabled: false,
          preset: "natural",
          thresholdDb: -38,
          minSilenceMs: 700,
          keepPaddingMs: 180,
          minSegmentMs: 450,
          skipped: false,
        },
        silenceCutOutput: null,
        subtitleSettings: {
          enabled: true,
          preset: "clear_standard",
          size: "medium",
          position: "bottom",
          fontScale: 1,
          skipped: false,
        },
        subtitleOutput: null,
      };
      await setDoc(
        doc(
          db,
          `organizations/${organizationId}/spaces/${spaceId}/videos/${params.video.id}/narrationProjects/${projectId}`
        ).withConverter(narrationVideoProjectConverter),
        removeUndefinedFields({ id: projectId, ...input } as VideoStudioProject)
      );
      await this.loadProjects(params.video.id);
      if (params.openAfterCreate !== false) {
        await this.openProject(params.video.id, projectId);
      }
      return projectId;
    },

    async openProject(videoId: string, projectId: string): Promise<void> {
      const { organizationId, spaceId } = this.requireScope();
      const db = getFirestore();
      const snap = await getDoc(
        doc(
          db,
          `organizations/${organizationId}/spaces/${spaceId}/videos/${videoId}/narrationProjects/${projectId}`
        ).withConverter(narrationVideoProjectConverter)
      );
      if (!snap.exists()) throw new Error("ナレーションプロジェクトが見つかりません。");
      if (!this.selectedVideo || this.selectedVideo.id !== videoId) {
        const videoSnap = await getDoc(
          doc(
            db,
            `organizations/${organizationId}/spaces/${spaceId}/videos/${videoId}`
          ).withConverter(videoConverter)
        );
        if (videoSnap.exists()) this.selectedVideo = videoSnap.data();
      }
      this.selectedProject = snap.data();
      this.view = "editor";
      await this.resolveSelectedVideoUrl();
      await Promise.all([
        this.resolveSelectedProjectOutputUrl(),
        this.resolveSelectedProjectSubtitleOutputUrl(),
        this.resolveSelectedProjectSilenceCutOutputUrl(),
      ]);
    },

    async updateProject(
      videoId: string,
      projectId: string,
      updates: VideoStudioProjectUpdateInput
    ): Promise<void> {
      const { organizationId, spaceId } = this.requireScope();
      const db = getFirestore();
      const payload = removeUndefinedFields({
        ...updates,
        lastEditedAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      });
      const undefinedPaths = collectUndefinedFieldPaths(payload);
      if (undefinedPaths.length > 0) {
        log("WARN", "[VideoStudio] Firestore update payload still contains undefined", {
          videoId,
          projectId,
          undefinedPaths,
        });
      }
      await updateDoc(
        doc(
          db,
          `organizations/${organizationId}/spaces/${spaceId}/videos/${videoId}/narrationProjects/${projectId}`
        ),
        payload
      );
      await this.openProject(videoId, projectId);
      await this.loadProjects(videoId);
    },

    async saveSections(sections: VideoStudioSection[]): Promise<void> {
      if (!this.selectedProject) return;
      const selectedIndex =
        typeof this.selectedProject.editorState.selectedSectionIndex === "number"
          ? Math.min(
              Math.max(this.selectedProject.editorState.selectedSectionIndex, 0),
              Math.max(sections.length - 1, 0)
            )
          : sections.length > 0
            ? 0
            : null;
      await this.updateProject(this.selectedProject.videoId, this.selectedProject.id, {
        sections,
        editorState: {
          ...this.selectedProject.editorState,
          selectedSection:
            typeof selectedIndex === "number" ? sections[selectedIndex] ?? null : null,
          selectedSectionIndex: selectedIndex,
        },
      });
    },

    async resolveStorageUrl(path?: string): Promise<string> {
      if (!path) return "";
      const storage = getStorage();
      return await getDownloadURL(storageRef(storage, path));
    },

    async resolveSelectedVideoUrl(): Promise<void> {
      const video = this.selectedVideo;
      if (
        !video ||
        (video.sourceType !== "upload" && video.sourceType !== "screen_recording")
      ) {
        this.selectedVideoUrl = "";
        return;
      }
      const path =
        video.convertedStoragePath || video.originalStoragePath || video.storagePath;
      this.selectedVideoUrl = await this.resolveStorageUrl(path);
    },

    async resolveSelectedProjectOutputUrl(): Promise<void> {
      const output = this.selectedProject?.mergedVideoOutput as
        | { resultFilePath?: string }
        | null
        | undefined;
      this.selectedProjectOutputUrl = await this.resolveStorageUrl(
        output?.resultFilePath
      );
    },

    async resolveSelectedProjectSubtitleOutputUrl(): Promise<void> {
      const output = this.selectedProject?.subtitleOutput as
        | { subtitledVideo?: { resultFilePath?: string } }
        | null
        | undefined;
      this.selectedProjectSubtitleOutputUrl = await this.resolveStorageUrl(
        output?.subtitledVideo?.resultFilePath
      );
    },

    async resolveSelectedProjectSilenceCutOutputUrl(): Promise<void> {
      const output = this.selectedProject?.silenceCutOutput as
        | { trimmedVideo?: { resultFilePath?: string } }
        | null
        | undefined;
      this.selectedProjectSilenceCutOutputUrl = await this.resolveStorageUrl(
        output?.trimmedVideo?.resultFilePath
      );
    },

    createDraftSection(params: {
      index: number;
      startTime: number;
      endTime: number;
    }): VideoStudioSection {
      return {
        id: createId("section"),
        index: params.index,
        title: `セクション ${params.index + 1}`,
        startTime: params.startTime,
        endTime: params.endTime,
        finalyNarrations: [],
        isFixed: false,
      };
    },

    async appendDraftSection(): Promise<void> {
      if (!this.selectedProject) return;
      const sections = [...this.selectedProject.sections];
      const last = sections.at(-1);
      const startTime = last?.endTime ?? 0;
      sections.push(
        this.createDraftSection({
          index: sections.length,
          startTime,
          endTime: startTime + 30,
        })
      );
      await this.saveSections(sections);
    },

    async createRequestDoc(params: {
      type: string;
      input: Record<string, unknown>;
      requestId?: string;
    }): Promise<string> {
      const { organizationId, spaceId } = this.requireScope();
      const db = getFirestore();
      const requestId = params.requestId || createId(params.type.replace(/Requests$/, ""));
      const collectionPath = `organizations/${organizationId}/spaces/${spaceId}/requests/${params.type}/logs`;
      const ref = doc(db, collectionPath, requestId);
      await setDoc(
        ref,
        removeUndefinedFields({
          id: requestId,
          status: "pending",
          input: params.input,
          output: {},
          logs: [],
          systemMetadata: {
            organizationId,
            spaceId,
            loggingCollectionId: collectionPath,
            loggingDocumentId: requestId,
            requestedBy: {
              email: "",
              role: "admin",
            },
            isCommand: false,
            isOouiCrud: true,
            isLlmCall: params.type === "autoSectionVideoRequests",
            isAdminCrud: false,
          },
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
        })
      );
      return requestId;
    },
  },
});
