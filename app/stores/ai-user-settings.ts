import { defineStore } from "pinia";
import { getAuth } from "firebase/auth";
import {
  doc,
  getDoc,
  getFirestore,
  serverTimestamp,
  setDoc,
  deleteDoc,
} from "firebase/firestore";
import log from "@utils/logger";
import type { SelectedKnowledgeRef } from "@utils/consultationKnowledge";
import { toApiSelectedKnowledge } from "@utils/consultationKnowledge";

export const GLOBAL_SYSTEM_PROMPT_DOC_ID = "globalSystemPrompt";
export const PINNED_KNOWLEDGE_DOC_ID = "pinnedKnowledge";

/**
 * AI 連携のユーザー設定 (API キーと同じ Firestore secrets 配下).
 */
export const useAiUserSettingsStore = defineStore("aiUserSettings", {
  state: () => ({
    globalSystemPrompt: "" as string,
    pinnedKnowledge: [] as SelectedKnowledgeRef[],
    isLoading: false,
    pinnedKnowledgeLoadAttempted: false,
    loadAttempted: false,
    loadError: null as string | null,
  }),

  getters: {
    hasGlobalSystemPrompt(state): boolean {
      return state.globalSystemPrompt.trim().length > 0;
    },
    hasPinnedKnowledge(state): boolean {
      return state.pinnedKnowledge.length > 0;
    },
  },

  actions: {
    docRef() {
      const user = getAuth().currentUser;
      if (!user) throw new Error("ログインしていません");
      return doc(
        getFirestore(),
        "users",
        user.uid,
        "secrets",
        GLOBAL_SYSTEM_PROMPT_DOC_ID
      );
    },

    async loadGlobalSystemPrompt(force = false): Promise<string> {
      if (!force && this.loadAttempted && !this.isLoading) {
        return this.globalSystemPrompt;
      }

      this.isLoading = true;
      this.loadError = null;

      try {
        const user = getAuth().currentUser;
        if (!user) {
          this.globalSystemPrompt = "";
          return "";
        }

        const snap = await getDoc(this.docRef());
        const prompt =
          (snap.data() as { prompt?: string } | undefined)?.prompt ?? "";
        this.globalSystemPrompt =
          typeof prompt === "string" ? prompt.trim() : "";
        return this.globalSystemPrompt;
      } catch (e) {
        this.loadError = e instanceof Error ? e.message : String(e);
        log("WARN", "[aiUserSettings] loadGlobalSystemPrompt failed", e);
        this.globalSystemPrompt = "";
        return "";
      } finally {
        this.isLoading = false;
        this.loadAttempted = true;
      }
    },

    pinnedKnowledgeDocRef() {
      const user = getAuth().currentUser;
      if (!user) throw new Error("ログインしていません");
      return doc(
        getFirestore(),
        "users",
        user.uid,
        "secrets",
        PINNED_KNOWLEDGE_DOC_ID
      );
    },

    async loadPinnedKnowledge(force = false): Promise<SelectedKnowledgeRef[]> {
      if (!force && this.pinnedKnowledgeLoadAttempted) {
        return this.pinnedKnowledge;
      }

      try {
        const user = getAuth().currentUser;
        if (!user) {
          this.pinnedKnowledge = [];
          return [];
        }

        const snap = await getDoc(this.pinnedKnowledgeDocRef());
        const raw = (snap.data() as { items?: unknown } | undefined)?.items;
        if (!Array.isArray(raw)) {
          this.pinnedKnowledge = [];
          return [];
        }

        const items: SelectedKnowledgeRef[] = [];
        for (const entry of raw) {
          if (!entry || typeof entry !== "object") continue;
          const row = entry as Record<string, unknown>;
          const id = row.id;
          const name = row.name;
          const gcsPath = row.gcs_path ?? row.gcsPath;
          if (
            typeof id !== "string" ||
            typeof name !== "string" ||
            typeof gcsPath !== "string" ||
            !gcsPath.startsWith("gs://")
          ) {
            continue;
          }
          items.push({
            id,
            name,
            gcsPath,
            mimeType:
              typeof row.mime_type === "string"
                ? row.mime_type
                : typeof row.mimeType === "string"
                  ? row.mimeType
                  : "",
          });
        }
        this.pinnedKnowledge = items;
        return items;
      } catch (e) {
        log("WARN", "[aiUserSettings] loadPinnedKnowledge failed", e);
        this.pinnedKnowledge = [];
        return [];
      } finally {
        this.pinnedKnowledgeLoadAttempted = true;
      }
    },

    async savePinnedKnowledge(items: SelectedKnowledgeRef[]): Promise<void> {
      const payload = toApiSelectedKnowledge(items);
      if (payload.length > 0) {
        await setDoc(
          this.pinnedKnowledgeDocRef(),
          { items: payload, updatedAt: serverTimestamp() },
          { merge: true }
        );
      } else {
        await deleteDoc(this.pinnedKnowledgeDocRef());
      }
      this.pinnedKnowledge = [...items];
      this.pinnedKnowledgeLoadAttempted = true;
    },

    async saveGlobalSystemPrompt(prompt: string): Promise<void> {
      const trimmed = prompt.trim();
      if (trimmed) {
        await setDoc(
          this.docRef(),
          { prompt: trimmed, updatedAt: serverTimestamp() },
          { merge: true }
        );
      } else {
        await deleteDoc(this.docRef());
      }
      this.globalSystemPrompt = trimmed;
      this.loadAttempted = true;
    },
  },
});
