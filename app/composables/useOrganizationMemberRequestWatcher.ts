import { onUnmounted, watch, type Ref } from "vue";
import { doc, onSnapshot } from "firebase/firestore";
import {
  memberUserCreateRequestConverter,
  memberUserUpdateRequestConverter,
  memberUserDeleteRequestConverter,
  type DecodedMemberUserCreateRequest,
  type DecodedMemberUserUpdateRequest,
  type DecodedMemberUserDeleteRequest,
} from "@models/organizationMemberRequest";

type MemberRequestDoc =
  | DecodedMemberUserCreateRequest
  | DecodedMemberUserUpdateRequest
  | DecodedMemberUserDeleteRequest;

type WatcherKind = "create" | "update" | "delete";

const CONVERTERS = {
  create: memberUserCreateRequestConverter,
  update: memberUserUpdateRequestConverter,
  delete: memberUserDeleteRequestConverter,
} as const;

/**
 * メンバー管理 RequestDoc の完了を購読する。
 */
export function useOrganizationMemberRequestWatcher(options: {
  requestId: Ref<string | null>;
  kind: Ref<WatcherKind | null>;
  collectionPath: Ref<string | null>;
  onTerminal: (doc: MemberRequestDoc, ok: boolean) => void;
}) {
  const { $firestore } = useNuxtApp();
  let unsubscribe: (() => void) | null = null;

  const stop = () => {
    if (unsubscribe) {
      unsubscribe();
      unsubscribe = null;
    }
  };

  watch(
    [options.requestId, options.kind, options.collectionPath],
    ([requestId, kind, collectionPath]) => {
      stop();
      if (!requestId || !kind || !collectionPath) return;

      const ref = doc(
        $firestore,
        `${collectionPath}/${requestId}`,
      ).withConverter(CONVERTERS[kind]);

      unsubscribe = onSnapshot(ref, (snap) => {
        if (!snap.exists()) return;
        const data = snap.data();
        if (!data) return;

        if (data.status === "completed") {
          options.onTerminal(data, true);
          stop();
        } else if (data.status === "error") {
          options.onTerminal(data, false);
          stop();
        }
      });
    },
    { immediate: true },
  );

  onUnmounted(stop);

  return { stop };
}
