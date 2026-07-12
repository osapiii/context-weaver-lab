/**
 * ADK session state デバッグ取得 — Firestore adkSessions + events サブコレクション.
 */
import {
  collection,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  limit,
  orderBy,
  query,
} from "firebase/firestore";
import { resolveAdkSessionScope } from "@composables/useAdkSessionScope";
import { readImageTaskBucketFromSession } from "@utils/workspaceSessionBuckets";
import log from "@utils/logger";

export interface AdkSessionDebugPayload {
  sessionId: string;
  appName: string;
  state: Record<string, unknown>;
  eventCount: number;
  events: Array<Record<string, unknown>>;
  lastUpdateTime?: number;
  imageStudioSummary: ImageStudioStateSummary | null;
}

export interface ImageStudioStateSummary {
  phase: string;
  primaryFilename: string | null;
  regionCount: number;
}

const resolvePhase = (state: Record<string, unknown>): string => {
  const bucket = readImageTaskBucketFromSession({ state });
  const raw = bucket.image_workflow_phase;
  if (raw === "create" || raw === "retouch") return raw;
  return "—";
};

const resolvePrimaryFilename = (state: Record<string, unknown>): string | null => {
  const fromPrimary = (raw: unknown): string | null => {
    if (!raw || typeof raw !== "object") return null;
    const o = raw as Record<string, unknown>;
    const name =
      (typeof o.adk_filename === "string" && o.adk_filename) ||
      (typeof o.adkFilename === "string" && o.adkFilename) ||
      "";
    return name.trim() || null;
  };
  const bucket = readImageTaskBucketFromSession({ state });
  return fromPrimary(bucket.primary_image);
};

const countRegions = (state: Record<string, unknown>): number => {
  const bucket = readImageTaskBucketFromSession({ state });
  const raw = bucket.retouch_regions;
  return Array.isArray(raw) ? raw.length : 0;
};

const buildImageStudioSummary = (
  state: Record<string, unknown>
): ImageStudioStateSummary => ({
  phase: resolvePhase(state),
  primaryFilename: resolvePrimaryFilename(state),
  regionCount: countRegions(state),
});

export const useAdkSessionDebug = () => {
  const fetchSession = async (
    sessionId: string
  ): Promise<AdkSessionDebugPayload | null> => {
    const scope = resolveAdkSessionScope();
    const sessionRef = doc(
      getFirestore(),
      "organizations",
      scope.organizationId,
      "spaces",
      scope.spaceId,
      "adkSessions",
      sessionId
    );
    const snap = await getDoc(sessionRef);
    if (!snap.exists()) {
      return null;
    }
    const data = snap.data() as Record<string, unknown>;
    const state =
      data.state && typeof data.state === "object"
        ? (data.state as Record<string, unknown>)
        : {};

    const lastUpdateTime =
      typeof data.lastUpdateTime === "number"
        ? (data.lastUpdateTime as number)
        : undefined;

    let events: Array<Record<string, unknown>> = [];
    try {
      const eventsQuery = query(
        collection(sessionRef, "events"),
        orderBy("timestamp", "desc"),
        limit(40)
      );
      const eventSnaps = await getDocs(eventsQuery);
      events = eventSnaps.docs
        .map((eventDoc) => ({
          id: eventDoc.id,
          ...(eventDoc.data() as Record<string, unknown>),
        }))
        .reverse();
    } catch (error) {
      log("WARN", "[useAdkSessionDebug] events load failed", error);
    }

    return {
      sessionId: snap.id,
      appName:
        typeof data.appName === "string" ? data.appName : "en-aistudio-adk-agent",
      state,
      eventCount: events.length,
      events,
      lastUpdateTime,
      imageStudioSummary: buildImageStudioSummary(state),
    };
  };

  return { fetchSession };
};
