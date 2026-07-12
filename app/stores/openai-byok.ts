import { defineStore } from "pinia";
import { getAuth } from "firebase/auth";
import { doc, getDoc, getFirestore } from "firebase/firestore";
import log from "@utils/logger";

export const OPENAI_BYOK_DOC_ID = "openaiApiKey";

export const OPENAI_BYOK_SETUP_MESSAGE =
  "OpenAI API キーが未登録です。設定 → AI 連携 で登録してください。";

/**
 * 画像生成 (gpt-image-2) 用 BYOK.
 * Firestore `users/{uid}/secrets/openaiApiKey` のみを正とする.
 */
export const useOpenaiByokStore = defineStore("openaiByok", {
  state: () => ({
    apiKey: null as string | null,
    isLoading: false,
    loadAttempted: false,
    loadError: null as string | null,
  }),

  getters: {
    hasApiKey(state): boolean {
      return !!state.apiKey;
    },
  },

  actions: {
    async loadUserApiKey(force = false): Promise<string | null> {
      if (!force && this.loadAttempted && !this.isLoading) {
        return this.apiKey;
      }

      this.isLoading = true;
      this.loadError = null;

      try {
        const user = getAuth().currentUser;
        if (!user) {
          this.apiKey = null;
          return null;
        }

        const snap = await getDoc(
          doc(getFirestore(), "users", user.uid, "secrets", OPENAI_BYOK_DOC_ID)
        );
        const k = (snap.data() as { apiKey?: string } | undefined)?.apiKey;
        const trimmed = typeof k === "string" && k.trim() ? k.trim() : null;
        this.apiKey = trimmed;
        return trimmed;
      } catch (e) {
        this.loadError = e instanceof Error ? e.message : String(e);
        log("WARN", "[openaiByok] loadUserApiKey failed", e);
        this.apiKey = null;
        return null;
      } finally {
        this.isLoading = false;
        this.loadAttempted = true;
      }
    },

    clearCache(): void {
      this.apiKey = null;
      this.loadAttempted = false;
      this.loadError = null;
    },

    async refreshUserApiKey(): Promise<string | null> {
      this.clearCache();
      return this.loadUserApiKey(true);
    },

    async resolveApiKey(): Promise<string> {
      const key = (await this.loadUserApiKey()) ?? this.apiKey;
      if (!key) {
        throw new Error(OPENAI_BYOK_SETUP_MESSAGE);
      }
      return key;
    },
  },
});
