<template>
  <div class="hand-arrow-wrap pointer-events-none select-none" aria-hidden="true">
    <svg
      viewBox="0 0 220 110"
      xmlns="http://www.w3.org/2000/svg"
      class="hand-arrow"
    >
      <!-- メインの曲線 (ペンギン側 → ドロップゾーン側) 微妙に wobble -->
      <path
        class="arrow-line"
        d="M 6 88 Q 22 78 38 70 T 78 56 Q 100 50 122 50 T 168 56 Q 188 60 198 56"
        fill="none"
        stroke="currentColor"
        stroke-width="2.4"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
      <!-- 矢じり (2 本の短い線) -->
      <path
        class="arrow-head"
        d="M 198 56 L 188 48"
        fill="none"
        stroke="currentColor"
        stroke-width="2.4"
        stroke-linecap="round"
      />
      <path
        class="arrow-head"
        d="M 198 56 L 188 64"
        fill="none"
        stroke="currentColor"
        stroke-width="2.4"
        stroke-linecap="round"
      />
    </svg>

    <!-- 手書き風キャプション "ここにポイッ!" -->
    <span class="hand-caption">ここにポイッ!</span>
  </div>
</template>

<script setup lang="ts">
// 純粋な装飾コンポーネント (props/emit なし)
</script>

<style scoped>
.hand-arrow-wrap {
  position: relative;
  color: rgb(217, 119, 6); /* purple-600 */
  display: inline-block;
  /* 微妙に傾けて手書きの呼吸感 */
  transform: rotate(-3deg);
}

.hand-arrow {
  width: 180px;
  height: 90px;
  overflow: visible;
  /* SVG 自体にも軽い drop-shadow で「インク」感 */
  filter: drop-shadow(0 1px 0 rgba(217,119,6, 0.08));
}

/* 線をゆっくり draw-in (stroke-dashoffset アニメ) */
.arrow-line {
  stroke-dasharray: 320;
  stroke-dashoffset: 320;
  animation: draw-line 1.6s cubic-bezier(0.65, 0, 0.35, 1) 0.4s forwards;
}
.arrow-head {
  stroke-dasharray: 16;
  stroke-dashoffset: 16;
  animation: draw-head 0.4s ease-out 1.8s forwards;
}

@keyframes draw-line {
  to {
    stroke-dashoffset: 0;
  }
}
@keyframes draw-head {
  to {
    stroke-dashoffset: 0;
  }
}

/* 手書き風キャプション */
.hand-caption {
  position: absolute;
  /* 矢印の左上に乗せる */
  left: 16px;
  top: -12px;
  font-family: "Caveat", "Klee One", "Yu Mincho", "ヒラギノ明朝 ProN", serif;
  font-size: 18px;
  font-weight: 600;
  color: rgb(217, 119, 6);
  white-space: nowrap;
  letter-spacing: 0.02em;
  transform: rotate(-2deg);
  opacity: 0;
  animation: caption-fade 0.5s ease-out 2s forwards;
}

@keyframes caption-fade {
  from {
    opacity: 0;
    transform: rotate(-2deg) translateY(4px);
  }
  to {
    opacity: 0.95;
    transform: rotate(-2deg) translateY(0);
  }
}

@media (prefers-reduced-motion: reduce) {
  .arrow-line,
  .arrow-head,
  .hand-caption {
    animation: none;
    stroke-dashoffset: 0;
    opacity: 0.95;
  }
}
</style>
