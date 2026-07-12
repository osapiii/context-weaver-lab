import { getAuth, onAuthStateChanged } from "firebase/auth";
import log from "@utils/logger";

export default defineNuxtRouteMiddleware(async (to) => {
  log("INFO", "adminLoggedInCheck triggered!🔥");

  // クライアントのミドルウェアを実行
  const auth = getAuth();

  // Contextの更新
  const context = useContextStore();
  context.updateContextInfo();

  // 現在ユーザーの取得
  const user = await new Promise<boolean>((resolve) => {
    onAuthStateChanged(auth, async (user) => {
      if (user) {
        log("INFO", "user is..", user);

        log("INFO", "ユーザーが存在するので組織とClaimsの初期化");
        const adminUserStore = useAdminUserStore();
        await adminUserStore.updateAuthState({
          currentUser: user,
        });
        log(
          "INFO",
          "組織とClaimsの初期化完了 adminUserStore.currentUserClaimsInfo:",
          adminUserStore.currentUserClaimsInfo
        );
        // 組織情報を更新する
        const organizationStore = useOrganizationStore();
        const organizationId = adminUserStore.currentOrganizationId;
        if (!organizationId) {
          throw new Error("Custom Claims に organizationId がありません");
        }
        await organizationStore.updateLoggedInOrganizationInfo({
          // Firestore Rules で所属組織だけを許可しているため、collection
          // query ではなく claims の document ID を使って直接取得する。
          filterKey: organizationId,
          searchType: "id",
        });
        log("INFO", "update organization operation finished!🔥");

        // ✅ Space一覧を取得
        const spaceStore = useSpaceStore();
        await spaceStore.fetchSpaces();
        log("INFO", "Space一覧取得完了", {
          spacesCount: spaceStore.spaces.length,
        });

        // ✅ localStorageからselectedSpaceIdを復元
        const savedSpaceId = localStorage.getItem("selectedSpaceId");
        if (
          savedSpaceId &&
          spaceStore.spaces.some((s) => s.id === savedSpaceId)
        ) {
          await spaceStore.selectSpace({ spaceId: savedSpaceId });
          log("INFO", "保存されていたSpaceを復元", {
            spaceId: savedSpaceId,
          });
        } else if (spaceStore.spaces.length > 0) {
          const defaultSpace =
            spaceStore.defaultSpace || spaceStore.currentUserSpaces[0];
          if (defaultSpace) {
            await spaceStore.selectSpace({ spaceId: defaultSpace.id });
            log("INFO", "デフォルトSpaceを選択", {
              spaceId: defaultSpace.id,
            });
          }
        }

        resolve(true);
      } else {
        log("INFO", "ユーザーが見つからないのでサインインにリダイレクト");
        resolve(false);
      }
    });
  });
  log("INFO", "user is..", user);
  if (user) {
    log("INFO", "user is found, next()🔥");
  } else {
    log("INFO", "user is not found, redirect to admin-signin");
    // Redirectする時はreturnを使用(router.pushは使用しない)
    // ログイン後に元のページへ戻れるよう redirect クエリを付与 (QR ディープリンク対応)
    return { path: "/admin/signin", query: { redirect: to.fullPath } };
    log("INFO", "redirect to admin-signin finished!🔥");
  }
});
