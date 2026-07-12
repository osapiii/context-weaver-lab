import { defineStore } from "pinia";
import { computed, ref } from "vue";
import { getAuth } from "firebase/auth";
import {
  collection,
  doc,
  getDocs,
  getFirestore,
  serverTimestamp,
  setDoc,
  writeBatch,
  type Timestamp,
} from "firebase/firestore";
import log from "@utils/logger";
import { convertWorkflowItemsToNotificationItems } from "@utils/workflowNotificationConverter";
import type { NotificationItem } from "@models/notificationItem";
import { useWorkflowExecutionsStore } from "./workflowExecutions";

function readStateCollectionRef() {
  const user = getAuth().currentUser;
  if (!user) throw new Error("ログインしていません");
  return collection(getFirestore(), "users", user.uid, "notificationReadStates");
}

function readStateDocRef(notificationId: string) {
  const user = getAuth().currentUser;
  if (!user) throw new Error("ログインしていません");
  return doc(getFirestore(), "users", user.uid, "notificationReadStates", notificationId);
}

function timestampToDate(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  const maybeTimestamp = value as Timestamp;
  if (typeof maybeTimestamp.toDate === "function") return maybeTimestamp.toDate();
  return null;
}

export const useWorkflowNotificationsStore = defineStore(
  "workflowNotifications",
  () => {
    const workflowExecutions = useWorkflowExecutionsStore();
    const readAtById = ref<Record<string, Date>>({});
    const isPanelOpen = ref(false);
    const showUnreadOnly = ref(false);
    const isLoadingReadStates = ref(false);
    const error = ref<string | null>(null);

    const items = computed<NotificationItem[]>(() =>
      convertWorkflowItemsToNotificationItems(workflowExecutions.items)
    );

    const unreadItems = computed(() =>
      items.value.filter((item) => !readAtById.value[item.id])
    );

    const visibleItems = computed(() =>
      showUnreadOnly.value ? unreadItems.value : items.value
    );

    const unreadCount = computed(() => unreadItems.value.length);

    function isRead(notificationId: string): boolean {
      return !!readAtById.value[notificationId];
    }

    async function loadReadStates(): Promise<void> {
      const user = getAuth().currentUser;
      if (!user) {
        readAtById.value = {};
        return;
      }
      isLoadingReadStates.value = true;
      error.value = null;
      try {
        const snap = await getDocs(readStateCollectionRef());
        const next: Record<string, Date> = {};
        snap.forEach((docSnap) => {
          const readAt = timestampToDate(docSnap.data().readAt);
          if (readAt) next[docSnap.id] = readAt;
        });
        readAtById.value = next;
      } catch (e) {
        error.value = e instanceof Error ? e.message : String(e);
        log("WARN", "[workflowNotifications] loadReadStates failed", e);
      } finally {
        isLoadingReadStates.value = false;
      }
    }

    async function markAsRead(notificationId: string): Promise<void> {
      if (readAtById.value[notificationId]) return;
      readAtById.value = {
        ...readAtById.value,
        [notificationId]: new Date(),
      };
      try {
        await setDoc(
          readStateDocRef(notificationId),
          { readAt: serverTimestamp() },
          { merge: true }
        );
      } catch (e) {
        log("WARN", "[workflowNotifications] markAsRead failed", e);
      }
    }

    async function markAllAsRead(): Promise<void> {
      const targetItems = unreadItems.value;
      if (targetItems.length === 0) return;
      const now = new Date();
      readAtById.value = {
        ...readAtById.value,
        ...Object.fromEntries(targetItems.map((item) => [item.id, now])),
      };
      try {
        const batch = writeBatch(getFirestore());
        for (const item of targetItems) {
          batch.set(
            readStateDocRef(item.id),
            { readAt: serverTimestamp() },
            { merge: true }
          );
        }
        await batch.commit();
      } catch (e) {
        log("WARN", "[workflowNotifications] markAllAsRead failed", e);
      }
    }

    function openPanel(): void {
      isPanelOpen.value = true;
    }

    function closePanel(): void {
      isPanelOpen.value = false;
    }

    return {
      items,
      unreadItems,
      visibleItems,
      unreadCount,
      readAtById,
      isPanelOpen,
      showUnreadOnly,
      isLoadingReadStates,
      error,
      isRead,
      loadReadStates,
      markAsRead,
      markAllAsRead,
      openPanel,
      closePanel,
    };
  }
);
