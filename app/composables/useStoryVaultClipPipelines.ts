import {
  Timestamp,
  addDoc,
  collection,
  doc,
  getFirestore,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  type Unsubscribe,
} from "firebase/firestore";
import {
  STORYVAULT_CLIP_PIPELINE_COLLECTION,
  STORYVAULT_CLIP_PIPELINE_STEPS,
  type StoryVaultClipPipelineEvent,
  type StoryVaultClipPipelineRequest,
} from "@models/storyVaultClipPipelineRequest";

export function useStoryVaultClipPipelines() {
  const pipelines = ref<StoryVaultClipPipelineRequest[]>([]);
  const events = ref<Record<string, StoryVaultClipPipelineEvent[]>>({});
  const loading = ref(false);
  const errorMessage = ref("");
  let stopList: Unsubscribe | null = null;
  const eventStops = new Map<string, Unsubscribe>();
  const organizationStore = useOrganizationStore();
  const spaceStore = useSpaceStore();
  const scopeKey = computed(() =>
    `${organizationStore.loggedInOrganizationInfo?.id ?? ""}:${spaceStore.selectedSpace?.id ?? ""}`
  );

  const requestCollectionPath = () => {
    const organizationId = organizationStore.loggedInOrganizationInfo?.id ?? "";
    const spaceId = spaceStore.selectedSpace?.id ?? "";
    if (!organizationId || !spaceId) return "";
    return `organizations/${organizationId}/spaces/${spaceId}/${STORYVAULT_CLIP_PIPELINE_COLLECTION}`;
  };

  function subscribe(): void {
    stopList?.();
    stopList = null;
    eventStops.forEach((stop) => stop());
    eventStops.clear();
    events.value = {};
    const path = requestCollectionPath();
    if (!path) {
      pipelines.value = [];
      loading.value = false;
      return;
    }
    loading.value = true;
    stopList = onSnapshot(
      query(collection(getFirestore(), path), orderBy("createdAt", "desc"), limit(50)),
      (snapshot) => {
        pipelines.value = snapshot.docs.map((item) => ({
          id: item.id,
          ...(item.data() as Omit<StoryVaultClipPipelineRequest, "id">),
        }));
        loading.value = false;
        errorMessage.value = "";
      },
      (error) => {
        loading.value = false;
        errorMessage.value = error.message;
      }
    );
  }

  function subscribeEvents(pipelineId: string): void {
    if (eventStops.has(pipelineId)) return;
    const path = requestCollectionPath();
    if (!path) return;
    const eventsRef = collection(getFirestore(), `${path}/${pipelineId}/events`);
    const stop = onSnapshot(
      query(eventsRef, orderBy("createdAt", "desc"), limit(200)),
      (snapshot) => {
        events.value[pipelineId] = snapshot.docs.map((item) => ({
          id: item.id,
          ...(item.data() as Omit<StoryVaultClipPipelineEvent, "id">),
        }));
      }
    );
    eventStops.set(pipelineId, stop);
  }

  async function createPipeline(input: {
    applicationId: string;
    applicationName?: string;
    clipGroupId: string;
    clipGroupName?: string;
    title: string;
    sourceDraftId?: string;
    sourceGcsUri: string;
    sourceContentType: string;
    durationMs: number;
    notificationEmail?: string;
  }): Promise<string> {
    const path = requestCollectionPath();
    if (!path) throw new Error("組織・スペースを確認してください");
    const requestRef = doc(collection(getFirestore(), path));
    const initialSteps = Object.fromEntries(
      STORYVAULT_CLIP_PIPELINE_STEPS.map((step) => [step, { status: "pending", progress: 0 }])
    );
    await setDoc(requestRef, {
      id: requestRef.id,
      title: input.title,
      applicationId: input.applicationId,
      applicationName: input.applicationName || "",
      clipGroupId: input.clipGroupId,
      clipGroupName: input.clipGroupName || "",
      status: "pending",
      currentStep: "upload",
      progress: 0,
      steps: initialSteps,
      clips: [],
      counters: { total: 0, completed: 0, processing: 0, failed: 0 },
      latestLogs: [],
      input: {
        sourceDraftId: input.sourceDraftId || "",
        sourceGcsUri: input.sourceGcsUri,
        sourceContentType: input.sourceContentType,
        durationMs: input.durationMs,
        notificationEmail: input.notificationEmail || "",
        autoAcceptSections: true,
        silenceMergeGapMs: 10_000,
      },
      operationMetadata: {
        loggingCollectionId: path,
        loggingDocumentId: requestRef.id,
        organizationId: organizationStore.loggedInOrganizationInfo?.id ?? "",
        spaceId: spaceStore.selectedSpace?.id ?? "",
        requestedBy: { email: input.notificationEmail || "", role: "admin" },
        isCommand: true,
        isOouiCrud: true,
        isLlmCall: true,
        isAdminCrud: false,
      },
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });
    return requestRef.id;
  }

  async function retry(pipelineId: string, options: { clipId?: string; step?: string }): Promise<void> {
    const path = requestCollectionPath();
    if (!path) throw new Error("組織・スペースを確認してください");
    await addDoc(collection(getFirestore(), `${path}/${pipelineId}/commands`), {
      type: options.clipId ? "retry_clip" : "resume_step",
      clipId: options.clipId || null,
      step: options.step || null,
      status: "pending",
      createdAt: serverTimestamp(),
    });
  }

  onBeforeUnmount(() => {
    stopList?.();
    eventStops.forEach((stop) => stop());
  });

  watch(scopeKey, subscribe, { immediate: true });

  return { pipelines, events, loading, errorMessage, subscribe, subscribeEvents, createPipeline, retry };
}
