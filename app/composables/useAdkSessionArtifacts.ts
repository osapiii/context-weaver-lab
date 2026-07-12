/**
 * Firestore adkSessions/{sessionId}/artifacts — onSnapshot SSOT for artifact metadata.
 */
import { shallowRef, type Ref } from "vue";
import {
  collection,
  getDocs,
  onSnapshot,
  type Unsubscribe,
} from "firebase/firestore";
import {
  resolveAdkSessionScope,
  tryResolveAdkSessionScope,
} from "@composables/useAdkSessionScope";
import type { DecodedAdkSessionArtifact } from "@models/adkSessionArtifact";
import log from "@utils/logger";

const artifactMapRef = shallowRef<Map<string, DecodedAdkSessionArtifact>>(
  new Map()
);

type ArtifactListener = (
  artifacts: Map<string, DecodedAdkSessionArtifact>
) => void;

type SessionArtifactSubscription = {
  unsubscribe: Unsubscribe;
  listeners: Set<ArtifactListener>;
  artifacts: Map<string, DecodedAdkSessionArtifact>;
};

const subscriptionByKey = new Map<string, SessionArtifactSubscription>();

const buildArtifactsCollectionRef = (params: {
  organizationId: string;
  spaceId: string;
  sessionId: string;
}) => {
  const db = useFirestore();
  return collection(
    db,
    "organizations",
    params.organizationId,
    "spaces",
    params.spaceId,
    "adkSessions",
    params.sessionId,
    "artifacts"
  );
};

const mapSnapshotDocs = (
  docs: Array<{ id: string; data: () => Record<string, unknown> }>
): Map<string, DecodedAdkSessionArtifact> => {
  const next = new Map<string, DecodedAdkSessionArtifact>();
  for (const docSnap of docs) {
    const data = docSnap.data();
    const record = mapDoc(docSnap.id, data);
    next.set(record.artifactId, record);
  }
  return next;
};

const mapDoc = (
  artifactId: string,
  data: Record<string, unknown>
): DecodedAdkSessionArtifact => ({
  id: artifactId,
  artifactId: String(data.artifactId ?? artifactId),
  sessionId: String(data.sessionId ?? ""),
  organizationId: String(data.organizationId ?? ""),
  spaceId: String(data.spaceId ?? ""),
  uid: String(data.uid ?? ""),
  kind: String(data.kind ?? "other"),
  adkFilename: String(data.adkFilename ?? ""),
  adkVersion: Number(data.adkVersion ?? 0),
  sourceGcsPath: String(data.sourceGcsPath ?? ""),
  storageGcsPath: String(data.storageGcsPath ?? ""),
  contentType: String(data.contentType ?? "application/octet-stream"),
  bytes: Number(data.bytes ?? 0),
  name: typeof data.name === "string" ? data.name : undefined,
  prompt: typeof data.prompt === "string" ? data.prompt : undefined,
  customMetadata:
    data.customMetadata && typeof data.customMetadata === "object"
      ? (data.customMetadata as Record<string, unknown>)
      : undefined,
  messageId: typeof data.messageId === "string" ? data.messageId : undefined,
  responseId: typeof data.responseId === "string" ? data.responseId : undefined,
  status: (data.status as DecodedAdkSessionArtifact["status"]) ?? "syncing",
  syncError: typeof data.syncError === "string" ? data.syncError : undefined,
});

const notifyListeners = (params: {
  key: string;
  artifacts: Map<string, DecodedAdkSessionArtifact>;
}): void => {
  const sub = subscriptionByKey.get(params.key);
  if (!sub) return;
  sub.artifacts = params.artifacts;
  artifactMapRef.value = params.artifacts;
  for (const listener of sub.listeners) {
    listener(params.artifacts);
  }
};

const teardownSubscription = (params: { key: string }): void => {
  const sub = subscriptionByKey.get(params.key);
  if (!sub) return;
  sub.unsubscribe();
  subscriptionByKey.delete(params.key);
  if (artifactMapRef.value === sub.artifacts || subscriptionByKey.size === 0) {
    artifactMapRef.value = new Map();
  }
};

export const fetchSessionArtifacts = async (params: {
  sessionId: string;
}): Promise<Map<string, DecodedAdkSessionArtifact>> => {
  const scope = tryResolveAdkSessionScope();
  if (!scope || !params.sessionId) {
    return new Map();
  }
  const colRef = buildArtifactsCollectionRef({
    organizationId: scope.organizationId,
    spaceId: scope.spaceId,
    sessionId: params.sessionId,
  });
  const snap = await getDocs(colRef);
  return mapSnapshotDocs(snap.docs);
};

export const subscribeSessionArtifacts = (params: {
  sessionId: string;
  onUpdate?: (artifacts: Map<string, DecodedAdkSessionArtifact>) => void;
}): (() => void) => {
  let orgId: string;
  let spaceId: string;
  try {
    ({ organizationId: orgId, spaceId } = resolveAdkSessionScope());
  } catch {
    log(
      "WARN",
      "[useAdkSessionArtifacts] org/space unresolved; skip subscribe",
      { sessionId: params.sessionId }
    );
    return () => {};
  }

  const key = `${orgId}:${spaceId}:${params.sessionId}`;
  if (!params.sessionId) {
    return () => {};
  }

  let sub = subscriptionByKey.get(key);
  if (!sub) {
    const listeners = new Set<ArtifactListener>();
    const colRef = buildArtifactsCollectionRef({
      organizationId: orgId,
      spaceId,
      sessionId: params.sessionId,
    });
    const unsubscribe = onSnapshot(
      colRef,
      (snap) => {
        const next = mapSnapshotDocs(snap.docs);
        notifyListeners({ key, artifacts: next });
      },
      (error) => {
        log("ERROR", "[useAdkSessionArtifacts] snapshot failed", error);
      }
    );
    sub = {
      unsubscribe,
      listeners,
      artifacts: new Map(),
    };
    subscriptionByKey.set(key, sub);
  }

  if (params.onUpdate) {
    sub.listeners.add(params.onUpdate);
    if (sub.artifacts.size > 0) {
      params.onUpdate(new Map(sub.artifacts));
    }
  }

  return () => {
    if (!params.onUpdate) return;
    const current = subscriptionByKey.get(key);
    if (!current) return;
    current.listeners.delete(params.onUpdate);
    if (current.listeners.size === 0) {
      teardownSubscription({ key });
    }
  };
};

export const useAdkSessionArtifacts = (): {
  artifactsById: Ref<Map<string, DecodedAdkSessionArtifact>>;
  getArtifact: (params: {
    artifactId: string;
  }) => DecodedAdkSessionArtifact | undefined;
  subscribe: (params: {
    sessionId: string;
    onUpdate?: (artifacts: Map<string, DecodedAdkSessionArtifact>) => void;
  }) => () => void;
  fetch: (params: {
    sessionId: string;
  }) => Promise<Map<string, DecodedAdkSessionArtifact>>;
} => {
  const getArtifact = (params: { artifactId: string }) =>
    artifactMapRef.value.get(params.artifactId);

  return {
    artifactsById: artifactMapRef,
    getArtifact,
    subscribe: subscribeSessionArtifacts,
    fetch: fetchSessionArtifacts,
  };
};
