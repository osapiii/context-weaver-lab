<template>
  <div class="log-terminal-container">
    <div class="log-terminal-header">
      <div class="terminal-title-bar">
        <div class="terminal-buttons">
          <span class="terminal-button close"/>
          <span class="terminal-button minimize"/>
          <span class="terminal-button maximize"/>
        </div>
        <span class="terminal-title">Terminal</span>
      </div>
    </div>
    <div ref="logContainer" class="log-terminal-content">
      <div
        v-for="(log, index) in logs"
        :key="index"
        class="log-line"
        :class="`log-${log.type}`"
      >
        <span class="log-timestamp">{{ formatTimestamp(log.timestamp) }}</span>
        <span class="log-message">{{ log.message }}</span>
      </div>
      <div v-if="logs.length === 0" class="log-empty">
        No logs yet...
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, nextTick, onMounted } from "vue";
import type { RequestLog } from "@models/core/requestStatus";
import { Timestamp } from "firebase/firestore";

interface Props {
  logs: RequestLog[];
}

const props = defineProps<Props>();

const logContainer = ref<HTMLElement | null>(null);

/**
 * タイムスタンプをフォーマット
 */
const formatTimestamp = (timestamp: any): string => {
  if (!timestamp) return "";
  
  let date: Date;
  if (timestamp instanceof Timestamp) {
    date = timestamp.toDate();
  } else if (timestamp instanceof Date) {
    date = timestamp;
  } else if (typeof timestamp === "string") {
    date = new Date(timestamp);
  } else if (timestamp?.seconds) {
    date = new Date(timestamp.seconds * 1000);
  } else {
    return "";
  }

  const hours = date.getHours().toString().padStart(2, "0");
  const minutes = date.getMinutes().toString().padStart(2, "0");
  const seconds = date.getSeconds().toString().padStart(2, "0");
  return `${hours}:${minutes}:${seconds}`;
};

/**
 * ログが追加されたら自動スクロール
 */
watch(
  () => props.logs.length,
  async () => {
    await nextTick();
    if (logContainer.value) {
      logContainer.value.scrollTop = logContainer.value.scrollHeight;
    }
  }
);

onMounted(() => {
  // 初期表示時に最下部にスクロール
  nextTick(() => {
    if (logContainer.value) {
      logContainer.value.scrollTop = logContainer.value.scrollHeight;
    }
  });
});
</script>

<style scoped>
.log-terminal-container {
  background: #1e1e1e;
  border-radius: 8px;
  overflow: hidden;
  font-family: "Monaco", "Menlo", "Ubuntu Mono", "Consolas", "source-code-pro",
    monospace;
  font-size: 13px;
  line-height: 1.5;
}

.log-terminal-header {
  background: #2d2d2d;
  padding: 8px 12px;
  border-bottom: 1px solid #3d3d3d;
}

.terminal-title-bar {
  display: flex;
  align-items: center;
  gap: 8px;
}

.terminal-buttons {
  display: flex;
  gap: 6px;
}

.terminal-button {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  display: inline-block;
}

.terminal-button.close {
  background: #ff5f57;
}

.terminal-button.minimize {
  background: #ffbd2e;
}

.terminal-button.maximize {
  background: #28ca42;
}

.terminal-title {
  color: #b3b3b3;
  font-size: 12px;
  margin-left: auto;
}

.log-terminal-content {
  background: #1e1e1e;
  color: #00ff00;
  padding: 16px;
  height: 400px;
  overflow-y: auto;
  overflow-x: hidden;
}

.log-terminal-content::-webkit-scrollbar {
  width: 8px;
}

.log-terminal-content::-webkit-scrollbar-track {
  background: #2d2d2d;
}

.log-terminal-content::-webkit-scrollbar-thumb {
  background: #555;
  border-radius: 4px;
}

.log-terminal-content::-webkit-scrollbar-thumb:hover {
  background: #666;
}

.log-line {
  display: flex;
  gap: 12px;
  margin-bottom: 4px;
  word-wrap: break-word;
  white-space: pre-wrap;
}

.log-line.log-info {
  color: #00ff00;
}

.log-line.log-error {
  color: #ff4444;
}

.log-timestamp {
  color: #888;
  flex-shrink: 0;
  min-width: 80px;
}

.log-message {
  flex: 1;
}

.log-empty {
  color: #666;
  font-style: italic;
  text-align: center;
  padding: 40px;
}
</style>

