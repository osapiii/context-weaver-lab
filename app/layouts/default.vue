<template>
  <div>
    <header />
    <main>
      <slot />
    </main>
  </div>
</template>
<script setup>
import log from "@utils/logger";
const route = useRoute();

// 特定のパスにマッチしない場合にメタ情報を更新
if (
  !route.path.startsWith("/survey/answer/") &&
  !route.path.startsWith("/diagnosis/answer/")
) {
  log("INFO", "デフォルトのメタ情報を設定します");
  useHead({
    title: "VibeControl",
    meta: [
      {
        name: "description",
        content: "VibeControlの管理画面です。",
      },
    ],
    link: [
      {
        rel: "icon",
        href: "/favicon.ico",
        type: "image/x-icon",
      },
      {
        rel: "icon",
        href: "/favicon.svg",
        type: "image/svg+xml",
      },
      {
        rel: "icon",
        href: "/favicon-32x32.png",
        type: "image/png",
        sizes: "32x32",
      },
      {
        rel: "apple-touch-icon",
        href: "/apple-touch-icon.png",
        sizes: "180x180",
      },
      {
        rel: "manifest",
        href: "/site.webmanifest",
      },
    ],
  });
} else {
  log("INFO", "特定のパスにマッチしたのでメタ情報を更新しません");
}
</script>

<style></style>
