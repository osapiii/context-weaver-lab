export const SITE_NAME = "StoryVault";
export const SITE_DESCRIPTION =
  "StoryVaultは、操作動画・ユーザーストーリー・関連コンテキストを束ね、AI開発の背景知を管理するストーリーSSOTです。";
export const SITE_URL = "https://storyvault-dev.web.app";

export const SITE_FAVICON_LINKS = [
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
] as const;
