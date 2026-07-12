import { defineStore } from "pinia";
import { getAuth } from "firebase/auth";
import { doc, getDoc, getFirestore } from "firebase/firestore";
import type { GoogleGenAI } from "@google/genai";
import log from "@utils/logger";

export const GEMINI_BYOK_DOC_ID = "geminiApiKey";

export const GEMINI_BYOK_SETUP_MESSAGE =
  "Gemini API キーが未登録です。設定 → AI 連携 で登録してください。";

/**
 * アプリ全体で共有する Gemini BYOK キー解決.
 * Firestore `users/{uid}/secrets/geminiApiKey` のみを正とする (env フォールバックなし).
 */
export const useGeminiByokStore = defineStore("geminiByok", {
  state: () => ({
    apiKey: null as string | null,
    isLoading: false,
    loadAttempted: false,
    loadError: null as string | null,
    genaiClient: null as GoogleGenAI | null,
    genaiClientKeySuffix: null as string | null,
  }),

  getters: {
    hasApiKey(state): boolean {
      return !!state.apiKey;
    },
    isAiEnabled(): boolean {
      return this.hasApiKey;
    },
    statusShortLabel(): string {
      if (this.isLoading) return "確認中…";
      return this.hasApiKey ? "AI 有効" : "AI 未設定";
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
          doc(getFirestore(), "users", user.uid, "secrets", GEMINI_BYOK_DOC_ID)
        );
        const k = (snap.data() as { apiKey?: string } | undefined)?.apiKey;
        const trimmed = typeof k === "string" && k.trim() ? k.trim() : null;
        this.apiKey = trimmed;

        if (trimmed) {
          const suffix = trimmed.slice(-6);
          if (!this.genaiClient || this.genaiClientKeySuffix !== suffix) {
            const { GoogleGenAI } = await import("@google/genai");
            this.genaiClient = new GoogleGenAI({ apiKey: trimmed });
            this.genaiClientKeySuffix = suffix;
          }
        } else {
          this.genaiClient = null;
          this.genaiClientKeySuffix = null;
        }

        return trimmed;
      } catch (e) {
        this.loadError = e instanceof Error ? e.message : String(e);
        log("WARN", "[geminiByok] loadUserApiKey failed", e);
        this.apiKey = null;
        this.genaiClient = null;
        this.genaiClientKeySuffix = null;
        return null;
      } finally {
        this.isLoading = false;
        this.loadAttempted = true;
      }
    },

    clearCache(): void {
      this.apiKey = null;
      this.genaiClient = null;
      this.genaiClientKeySuffix = null;
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
        throw new Error(GEMINI_BYOK_SETUP_MESSAGE);
      }
      return key;
    },

    async ensureGeminiClient(): Promise<GoogleGenAI> {
      await this.resolveApiKey();
      if (!this.genaiClient) {
        throw new Error(GEMINI_BYOK_SETUP_MESSAGE);
      }
      return this.genaiClient;
    },
  },
});
