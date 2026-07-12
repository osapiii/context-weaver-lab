import log from "@utils/logger";

/**
 * Space アクセス権限チェック Middleware
 * Global Middleware として全ルートに適用される
 *
 * 機能:
 * - URL パスから spaceId を抽出
 * - hasSpaceAccess(spaceId) で権限チェック
 * - アクセス許可時、Space を自動選択
 * - Super/システム管理者は全 Space、利用者は spaceIds でフィルタ
 *
 * 除外ページ:
 * - /admin/signin
 * - /setup/space
 * - /introduction
 */
export default defineNuxtRouteMiddleware(async (to, from) => {
  log("INFO", "space-access.global middleware triggered", { path: to.path });

  const adminUserStore = useAdminUserStore();
  const spaceStore = useSpaceStore();

  // 除外ページ: 認証前ページは権限チェックをスキップ
  const excludedPaths = ["/", "/lp", "/admin/signin", "/admin/ai-chat", "/setup", "/introduction"];

  // ルートパスまたは除外パスの場合はスキップ
  if (to.path === "/" || excludedPaths.some((path) => to.path.startsWith(path))) {
    log("INFO", "space-access: excluded path, skipping", to.path);
    return;
  }

  // ✅ URL パスから spaceId を抽出
  // パターン: /space/{spaceId}/... 形式
  const spaceUrlPattern = /^\/space\/([^\/]+)/;
  const match = to.path.match(spaceUrlPattern);

  if (!match) {
    // Space パスではない場合はスキップ
    log("INFO", "space-access: not a space path, skipping", to.path);
    return;
  }

  const spaceId = match[1];
  log("INFO", "space-access: extracted spaceId from URL", spaceId);

  // ✅ Space アクセス権限チェック
  // hasSpaceAccess() は以下のロジックで判定:
  // - Super (rbacRole === 1): 常に true
  // - システム管理者 (rbacRole === 2): 常に true
  // - 利用者 (rbacRole === 3): Custom Claims の spaceIds に含まれる場合のみ true
  const hasAccess = adminUserStore.hasSpaceAccess(spaceId);

  if (!hasAccess) {
    log("ERROR", "space-access: ACCESS_DENIED", {
      spaceId,
      rbacRole: adminUserStore.rbacRole,
      spaceIds: (adminUserStore.currentUserClaimsInfo as any)?.spaceIds || [],
    });

    // 404 エラーで返す（403 ではなく、Space が存在しないように見せる）
    throw createError({
      statusCode: 404,
      statusMessage: "スペースが見つかりません。",
    });
  }

  log("INFO", "space-access: access granted", {
    spaceId,
    rbacRole: adminUserStore.rbacRole,
  });

  // ✅ アクセス許可時、Space を自動選択
  // 現在選択中の Space と異なる場合のみ切り替え
  if (spaceStore.selectedSpace?.id !== spaceId) {
    log("INFO", "space-access: switching to space", spaceId);

    try {
      // Space 切り替え（全 Store をクリアして情報隔離）
      await spaceStore.selectSpace({ spaceId });
      log("INFO", "space-access: space switched successfully", spaceId);
    } catch (error) {
      log("ERROR", "space-access: space switch failed", {
        spaceId,
        error,
      });

      // Space 切り替え失敗時は 404 エラー
      throw createError({
        statusCode: 404,
        statusMessage: "スペースが見つかりません。",
      });
    }
  } else {
    log("INFO", "space-access: already on correct space", spaceId);
  }
});
