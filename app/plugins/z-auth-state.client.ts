import { getAuth, onAuthStateChanged, type User } from "firebase/auth";
import log from "~/utils/logger";
import { syncDatadogAuthenticatedContext } from "@utils/datadogObservability";

/**
 * Firebase Authentication 状態監視プラグイン
 *
 * 機能:
 * - onAuthStateChanged でページリロード時に認証状態を自動復元
 * - 段階的初期化: AdminUserStore → OrganizationStore → SpaceStore
 * - localStorage から selectedSpaceId を復元
 * - 未認証時は公開ページ以外を /admin/signin にリダイレクト
 */
export default defineNuxtPlugin(async () => {
  const router = useRouter();
  const auth = getAuth();

  // 公開ページ（認証不要）のパスリスト
  const publicPaths = ["/", "/lp", "/admin/signin", "/setup", "/introduction"];

  const isPublicPath = (path: string): boolean => {
    return publicPaths.some((publicPath) =>
      path === publicPath || path.startsWith(publicPath)
    );
  };

  log("INFO", "🔐 認証状態監視プラグイン起動");

  // 認証状態の初期化を待つPromiseを作成
  const authStatePromise = new Promise<User | null>((resolve) => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        log("INFO", "✅ 認証済みユーザー検出", {
          uid: user.uid,
          email: user.email,
        });

        try {
          // Step 1: adminUserStoreを更新
          const adminUserStore = useAdminUserStore();
          await adminUserStore.updateAuthState({ currentUser: user });

          log("INFO", "✅ adminUserStore更新完了", {
            rbacRole: adminUserStore.rbacRole,
            organizationId: adminUserStore.currentOrganizationId,
          });

          // Step 2: organizationStoreを更新
          const organizationId = adminUserStore.currentOrganizationId;
          if (organizationId) {
            const organizationStore = useOrganizationStore();
            await organizationStore.updateLoggedInOrganizationInfo({
              filterKey: organizationId,
              searchType: "id",
            });

            log("INFO", "✅ organizationStore更新完了");

            // Step 3: Space一覧を取得
            const spaceStore = useSpaceStore();
            await spaceStore.fetchSpaces();

            log("INFO", "✅ Space一覧取得完了", {
              spacesCount: spaceStore.spaces.length,
            });

            // Step 4: localStorageからselectedSpaceIdを復元
            const savedSpaceId = localStorage.getItem("selectedSpaceId");
            if (
              savedSpaceId &&
              spaceStore.spaces.some((s) => s.id === savedSpaceId)
            ) {
              await spaceStore.selectSpace({ spaceId: savedSpaceId });
              log("INFO", "✅ 保存されていたSpaceを復元", {
                spaceId: savedSpaceId,
              });
            } else if (spaceStore.spaces.length > 0) {
              const defaultSpace =
                spaceStore.defaultSpace || spaceStore.currentUserSpaces[0];
              if (defaultSpace) {
                await spaceStore.selectSpace({ spaceId: defaultSpace.id });
                log("INFO", "✅ デフォルトSpaceを選択", {
                  spaceId: defaultSpace.id,
                });
              }
            }

            syncDatadogAuthenticatedContext({
              user,
              claims: adminUserStore.currentUserClaimsInfo,
              organization: organizationStore.loggedInOrganizationInfo,
              space: spaceStore.selectedSpace,
            });

            log("INFO", "🎉 認証状態の復元完了");
          } else {
            log("ERROR", "❌ organizationIdが取得できませんでした");
          }
        } catch (error) {
          log("ERROR", "❌ 認証状態の復元中にエラー", error);
        }

        resolve(user);
      } else {
        log("INFO", "🚫 未認証状態");

        // 未認証の場合、公開ページ以外は/admin/signinにリダイレクト
        const currentRoute = router.currentRoute.value;
        if (!isPublicPath(currentRoute.path)) {
          log("INFO", "🔀 未認証のため/admin/signinにリダイレクト");
          // ログイン後に元のページへ戻れるよう redirect クエリを付与 (QR ディープリンク対応)
          router.push({
            path: "/admin/signin",
            query: { redirect: currentRoute.fullPath },
          });
        }

        resolve(null);
      }

      // リスナーを解除（初回実行後は不要）
      unsubscribe();
    });
  });

  // 認証状態の初期化を待つ
  await authStatePromise;

  log("INFO", "✅ 認証状態監視プラグイン初期化完了");
});
