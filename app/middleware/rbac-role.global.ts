import log from "@utils/logger";

/**
 * RBAC ロールベース権限チェック Middleware
 * Global Middleware として全ルートに適用される
 *
 * 機能:
 * - rbacRole が未設定の場合は 403 エラー
 * - Super 専用ページ（God モード）への権限チェック
 * - システム管理者以上が必要なページの権限チェック
 *
 * 除外ページ:
 * - /admin/signin
 * - /setup/space
 * - /introduction
 */
export default defineNuxtRouteMiddleware((to, from) => {
  log("INFO", "rbac-role.global middleware triggered", { path: to.path });

  const adminUserStore = useAdminUserStore();

  // 除外ページ: 認証前ページは権限チェックをスキップ
  const excludedPaths = [
    "/",
    "/lp",
    "/admin/signin",
    "/admin/ai-chat",
    "/admin/storyvault/jira-callback",
    "/admin/storyvault/slack-callback",
    "/setup",
    "/introduction",
  ];

  // ルートパスまたは除外パスの場合はスキップ
  if (to.path === "/" || excludedPaths.some((path) => to.path.startsWith(path))) {
    log("INFO", "rbac-role: excluded path, skipping", to.path);
    return;
  }

  // rbacRole が未設定の場合はエラー
  if (!adminUserStore.rbacRole) {
    log("ERROR", "rbac-role: RBAC_ROLE_MISSING", {
      path: to.path,
      rbacRole: adminUserStore.rbacRole,
    });

    throw createError({
      statusCode: 403,
      statusMessage: "権限がないか存在しないページです",
      data: { reason: "RBAC_ROLE_MISSING" },
    });
  }

  // ✅ Super 専用ページの権限チェック（God モード）
  // URL例: /space/{spaceId}/settings?tab=organization
  const spaceSettingsPattern = /^\/space\/[^/]+\/settings/;
  if (spaceSettingsPattern.test(to.path) && to.query.tab === "organization") {
    if (!adminUserStore.isSuper) {
      log("ERROR", "rbac-role: SUPER_ONLY access denied", {
        path: to.path,
        query: to.query,
        rbacRole: adminUserStore.rbacRole,
      });

      throw createError({
        statusCode: 403,
        statusMessage: "権限がないか存在しないページです",
        data: {
          reason: "SUPER_ONLY",
          requiredRole: 1,
          currentRole: adminUserStore.rbacRole,
        },
      });
    }
  }

  // ✅ システム管理者以上が必要なページの権限チェック
  const adminOnlyPatterns = [
    /^\/space\/[^/]+\/settings/, // Space 設定ページ
    /^\/space\/[^/]+\/admin\/audit-logs/, // 監査ログ
    /^\/space\/[^/]+\/admin\/storage/, // Storage Explorer
    /^\/space\/[^/]+\/admin\/users/, // ユーザー管理
  ];

  // 設定 > メンバー管理タブ（preferences は全員アクセス可だが、メンバー操作は store 側でもガード）
  if (to.path === "/admin/preferences" && to.query.tab === "members") {
    if (!adminUserStore.isSystemAdmin && !adminUserStore.isSuper) {
      throw createError({
        statusCode: 403,
        statusMessage: "権限がないか存在しないページです",
        data: { reason: "ADMIN_ONLY", path: to.path },
      });
    }
  }

  if (adminOnlyPatterns.some((pattern) => pattern.test(to.path))) {
    // システム管理者以上（rbacRole === 1 or 2）が必要
    if (!adminUserStore.isSystemAdmin && !adminUserStore.isSuper) {
      log("ERROR", "rbac-role: ADMIN_ONLY access denied", {
        path: to.path,
        rbacRole: adminUserStore.rbacRole,
      });

      throw createError({
        statusCode: 403,
        statusMessage: "権限がないか存在しないページです",
        data: {
          reason: "ADMIN_ONLY",
          requiredRole: 2,
          currentRole: adminUserStore.rbacRole,
        },
      });
    }
  }

  log("INFO", "rbac-role: access granted", {
    path: to.path,
    rbacRole: adminUserStore.rbacRole,
  });
});
