import { defineStore } from "pinia";

type LoadingRequest = {
  message: string;
  sequence: number;
};

// *********STORE*********
export const useGlobalLoadingStore = defineStore("globalLoading", {
  state: () => ({
    isLoading: false,
    loadingText: "",
    legacyLoading: false,
    legacyLoadingText: "",
    loadingRequests: {} as Record<string, LoadingRequest>,
    nextRequestSequence: 0,
  }),
  actions: {
    syncLoadingState() {
      const requests = Object.values(this.loadingRequests).sort(
        (a, b) => b.sequence - a.sequence
      );
      this.isLoading = this.legacyLoading || requests.length > 0;
      this.loadingText = this.legacyLoading
        ? this.legacyLoadingText
        : (requests[0]?.message ?? "");
    },
    /**
     * loading開始
     */
    startLoading(loadingText = "") {
      this.legacyLoading = true;
      this.legacyLoadingText = loadingText;
      this.syncLoadingState();
    },
    /**
     * loading終了
     */
    stopLoading() {
      this.legacyLoading = false;
      this.legacyLoadingText = "";
      this.syncLoadingState();
    },
    /**
     * 並行する loading ごとに管理可能なトークンを発行する。
     */
    beginLoading(loadingText = "") {
      this.nextRequestSequence += 1;
      const token = `global-loading-${this.nextRequestSequence}`;
      this.loadingRequests[token] = {
        message: loadingText,
        sequence: this.nextRequestSequence,
      };
      this.syncLoadingState();
      return token;
    },
    /**
     * beginLoading で開始した loading だけを終了する。
     */
    endLoading(token: string) {
      if (!(token in this.loadingRequests)) return;
      this.loadingRequests = Object.fromEntries(
        Object.entries(this.loadingRequests).filter(([key]) => key !== token)
      );
      this.syncLoadingState();
    },
  },
});
