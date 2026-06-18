import { useSpeechRecognition } from "@vueuse/core";

/**
 * Web Speech API ベースの簡易音声入力ラッパ.
 *
 * 仕様:
 *   - 言語: ja-JP 固定 (現状 research-agent は日本語専用)
 *   - continuous: true / interimResults: true で、確定前テキストも逐次取得できる
 *   - Safari など `isSupported === false` のブラウザでは UI 側でボタンを隠す前提
 *   - マイク権限拒否などのエラーは isListening が即 false に戻るので呼び出し側で検知
 *
 * 使い方:
 *   const { isSupported, isListening, transcript, toggle } = useVoiceInput()
 *   // toggle() で開始/停止. transcript (= 最終確定したテキスト) を v-model などへ.
 */
export const useVoiceInput = () => {
  const { isSupported, isListening, result, start, stop, isFinal } =
    useSpeechRecognition({
      lang: "ja-JP",
      continuous: true,
      interimResults: true,
    });

  const startListening = () => {
    if (!isSupported.value || isListening.value) return;
    start();
  };

  const stopListening = () => {
    if (!isListening.value) return;
    stop();
  };

  const toggle = () => {
    if (isListening.value) stopListening();
    else startListening();
  };

  return {
    isSupported,
    isListening,
    /** 認識テキスト (interim 含む) */
    transcript: result,
    /** 直近の結果が確定済みか */
    isFinal,
    start: startListening,
    stop: stopListening,
    toggle,
  };
};
