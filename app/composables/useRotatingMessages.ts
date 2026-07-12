import { ref, watch, onUnmounted, type MaybeRef, toValue } from "vue";

export type UseRotatingMessagesOptions = {
  enabled?: MaybeRef<boolean>;
  intervalMs?: number;
  /** 指定時は配列の該当 index を表示（ローテーション停止） */
  messageIndex?: MaybeRef<number | null | undefined>;
};

/**
 * ローディング中のサブメッセージを段階的に切り替える。
 * 取引先登録・AIマスタ抽出などで共通利用。
 */
export function useRotatingMessages(
  messages: MaybeRef<readonly string[]>,
  options: UseRotatingMessagesOptions = {}
) {
  const list = () => {
    const m = toValue(messages);
    return m.length > 0 ? [...m] : [""];
  };

  const currentMessage = ref(list()[0] ?? "");

  let timer: ReturnType<typeof setInterval> | undefined;

  const stop = () => {
    if (timer) {
      clearInterval(timer);
      timer = undefined;
    }
  };

  const applyIndex = (index: number) => {
    const items = list();
    const clamped = Math.min(Math.max(index, 0), items.length - 1);
    currentMessage.value = items[clamped] ?? "";
  };

  const start = (fromIndex = 0) => {
    stop();
    const items = list();
    if (items.length === 0) {
      currentMessage.value = "";
      return;
    }
    let idx = Math.min(fromIndex, items.length - 1);
    currentMessage.value = items[idx] ?? "";
    timer = setInterval(() => {
      idx = Math.min(idx + 1, items.length - 1);
      currentMessage.value = items[idx] ?? "";
    }, options.intervalMs ?? 2800);
  };

  watch(
    () => [
      toValue(options.enabled),
      toValue(options.messageIndex),
      list().join("\u0000"),
    ] as const,
    ([enabled, index]) => {
      const items = list();
      if (index != null && typeof index === "number") {
        stop();
        applyIndex(index);
        return;
      }
      if (enabled === false) {
        stop();
        return;
      }
      if (items.length <= 1) {
        stop();
        currentMessage.value = items[0] ?? "";
        return;
      }
      start(0);
    },
    { immediate: true }
  );

  onUnmounted(stop);

  return {
    currentMessage,
    start,
    stop,
    setIndex: applyIndex,
  };
}
