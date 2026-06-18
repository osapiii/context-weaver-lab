import { nextTick } from "vue";
import type { RouteLocationRaw } from "vue-router";

const DEFAULT_NAVIGATION_LOADING_MESSAGE = "画面を読み込んでいます…";

/**
 * 画面遷移と、その直前に必要なデータ取得を globalLoading で包む。
 */
export function useGlobalLoadingNavigation() {
  const router = useRouter();
  const globalLoading = useGlobalLoadingStore();

  const runWithGlobalLoading = async <T>(
    action: () => Promise<T>,
    loadingMessage = DEFAULT_NAVIGATION_LOADING_MESSAGE
  ): Promise<T> => {
    const token = globalLoading.beginLoading(loadingMessage);
    try {
      // Overlay を描画してから、データ取得・ルート解決を開始する。
      await nextTick();
      return await action();
    } finally {
      globalLoading.endLoading(token);
    }
  };

  const pushWithGlobalLoading = (
    to: RouteLocationRaw,
    loadingMessage = DEFAULT_NAVIGATION_LOADING_MESSAGE
  ): Promise<void> =>
    runWithGlobalLoading(async () => {
      await router.push(to);
    }, loadingMessage);

  const replaceWithGlobalLoading = (
    to: RouteLocationRaw,
    loadingMessage = DEFAULT_NAVIGATION_LOADING_MESSAGE
  ): Promise<void> =>
    runWithGlobalLoading(async () => {
      await router.replace(to);
    }, loadingMessage);

  return {
    runWithGlobalLoading,
    pushWithGlobalLoading,
    replaceWithGlobalLoading,
  };
}
