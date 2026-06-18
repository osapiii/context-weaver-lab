import { defineStore } from "pinia";
import {
  browserLocalPersistence,
  getAuth,
  isSignInWithEmailLink,
  setPersistence,
  signInWithCustomToken,
  signInWithEmailLink,
  type User,
} from "firebase/auth";
import { getApp } from "firebase/app";
import { getFunctions, httpsCallable } from "firebase/functions";
import { adminUserConverter, type decodedAdminUser } from "@models/adminUser";
import log from "@utils/logger";
import { adminUserCreateRequestConverter } from "@models/adminUserCreateRequest";
import { clearDatadogUserContext } from "@utils/datadogObservability";

const FUNCTIONS_REGION = "asia-northeast1";

/**
 * サインインパラメータのインターフェース
 * @interface
 */
interface signInParams {
  email: string;
  continueUrl: string;
}

/**
 * Custom Claims インターフェース
 * Firebase Authentication Custom Claims で管理されるロール情報
 */
interface CustomClaims {
  rbacRole?: 1 | 2 | 3; // 1=Super, 2=システム管理者, 3=利用者
  organizationId?: string;
  organizationCode?: string;
  spaceIds?: string[]; // 利用者がアクセス可能な Space ID 配列
}

/**
 * 管理ユーザーストア
 * RBAC（Role-Based Access Control）によるマルチテナント権限管理
 */
export const useAdminUserStore = defineStore("adminUser", {
  state: () => ({
    currentUser: null as User | null, // ✅ 現在ログイン中のユーザー（Firebase Auth）
    currentUserClaimsInfo: {} as Partial<CustomClaims> & Record<string, unknown>,
    adminUserList: [] as decodedAdminUser[],
    rbacRole: null as 1 | 2 | 3 | null, // SSOT: Custom Claims から取得したロール
  }),
  getters: {
    /**
     * Super ロール判定（rbacRole === 1）
     * 全組織・全Spaceへのアクセス権限を持つ
     */
    isSuper: (state): boolean => state.rbacRole === 1,

    /**
     * システム管理者ロール判定（rbacRole === 2）
     * 所属組織内の全Spaceへのアクセス権限を持つ
     */
    isSystemAdmin: (state): boolean => state.rbacRole === 2,

    /**
     * 利用者ロール判定（rbacRole === 3）
     * Custom Claims の spaceIds で指定された Space のみアクセス可能
     */
    isRegularUser: (state): boolean => state.rbacRole === 3,

    /**
     * システム管理者以上の権限判定（rbacRole === 1 または 2）
     */
    isAdminOrAbove: (state): boolean => state.rbacRole === 1 || state.rbacRole === 2,

    /**
     * 組織ID取得
     */
    currentOrganizationId: (state): string | null =>
      (state.currentUserClaimsInfo as CustomClaims)?.organizationId || null,

    /**
     * Space アクセス権限判定
     * @param spaceId - チェック対象の Space ID
     * @returns アクセス可能な場合 true
     */
    hasSpaceAccess:
      (state) =>
      (spaceId: string): boolean => {
        // Super は全 Space アクセス可能
        if (state.rbacRole === 1) return true;

        // システム管理者は組織内の全 Space アクセス可能
        if (state.rbacRole === 2) return true;

        // 利用者は Custom Claims の spaceIds をチェック
        const spaceIds = (state.currentUserClaimsInfo as CustomClaims)?.spaceIds || [];
        return spaceIds.includes(spaceId);
      },
  },
  actions: {
    /**
     * サインインの実行
     * @param {signInParams} params - サインインに必要なパラメータ
     */
    async signIn(params: signInParams) {
      const auth = getAuth();
      await setPersistence(auth, browserLocalPersistence);
      const functions = getFunctions(getApp(), FUNCTIONS_REGION);
      const callable = httpsCallable<
        { email: string; continueUrl: string },
        { sent: boolean; email: string }
      >(functions, "send_admin_sign_in_link");
      await callable({
        email: params.email,
        continueUrl: params.continueUrl,
      });
    },

    isEmailLinkSignIn(url: string): boolean {
      return isSignInWithEmailLink(getAuth(), url);
    },

    async completeEmailLinkSignIn(params: { email: string; url: string }) {
      const auth = getAuth();
      await setPersistence(auth, browserLocalPersistence);
      const credential = await signInWithEmailLink(
        auth,
        params.email,
        params.url,
      );
      return credential.user;
    },

    async devSignIn(params: { email: string }) {
      const auth = getAuth();
      await setPersistence(auth, browserLocalPersistence);
      if (
        typeof window !== "undefined" &&
        ["localhost", "127.0.0.1"].includes(window.location.hostname)
      ) {
        const localResult = await $fetch<{
          customToken: string;
          email: string;
          uid: string;
          projectId: string;
        }>("/api/dev-admin-token", {
          method: "POST",
          body: { email: params.email },
        });
        const credential = await signInWithCustomToken(
          auth,
          localResult.customToken,
        );
        return credential.user;
      }

      const functions = getFunctions(getApp(), FUNCTIONS_REGION);
      const devAdminSignIn = httpsCallable<
        { email: string },
        { customToken: string; email: string; uid: string; projectId: string }
      >(functions, "dev_admin_sign_in");
      const result = await devAdminSignIn({ email: params.email });
      const credential = await signInWithCustomToken(
        auth,
        result.data.customToken,
      );
      return credential.user;
    },

    /**
     * サインアウトの実行
     */
    async signOut() {
      const router = useRouter();
      const auth = getAuth();
      clearDatadogUserContext();
      await auth.signOut();
      router.push({ name: "admin-signin" });
    },

    /**
     * ユーザー認証ステータスの更新
     * Custom Claims から rbacRole と権限情報を取得
     * @param {Object} params - パラメータオブジェクト
     * @param {User} params.currentUser - 現在のユーザー
     */
    async updateAuthState(params: { currentUser: User }) {
      log("INFO", "updateAuthState triggered🔥");

      // ✅ currentUser を保存
      this.currentUser = params.currentUser;

      const idTokenResult = await params.currentUser.getIdTokenResult();
      const customClaims = await idTokenResult.claims;

      this.currentUserClaimsInfo = {
        ...customClaims,
      };

      // SSOT: Custom Claims から rbacRole を取得
      const claims = customClaims as CustomClaims;
      this.rbacRole = claims.rbacRole || null;

      log("INFO", "rbacRole set from Custom Claims", this.rbacRole);
      log("INFO", "currentUserClaimsInfo", this.currentUserClaimsInfo);
    },

    /**
     * Custom Claims を強制リフレッシュ
     * ロール更新時などに使用
     */
    async refreshCustomClaims(): Promise<void> {
      const auth = getAuth();
      const currentUser = auth.currentUser;

      if (!currentUser) {
        log("WARN", "refreshCustomClaims: no current user");
        return;
      }

      // Custom Claims を強制リフレッシュ
      await currentUser.getIdToken(true);
      const idTokenResult = await currentUser.getIdTokenResult();

      this.currentUserClaimsInfo = idTokenResult.claims;
      const claims = idTokenResult.claims as CustomClaims;
      this.rbacRole = claims.rbacRole || null;

      log("INFO", "Custom Claims refreshed", this.rbacRole);
    },

    /**
     * 管理ユーザー一覧の取得
     */
    async fetchAdminUserListWithCurrentLoggedInOrganization() {
      const firestoreOps = useFirestoreDocOperation();
      const organization = useOrganizationStore();
      const adminUsers = await firestoreOps.getDocumentListByQuery({
        collectionName: `organizations/${organization.getLoggedInOrganizationId}/adminUsers`,
        targetField: "organizationId",
        operator: "==",
        targetValue: organization.loggedInOrganizationInfo.id,
        converter: adminUserConverter,
      });
      this.adminUserList = adminUsers;
    },

    /**
     * 管理ユーザーの更新
     * @param {Object} params - パラメータオブジェクト
     * @param {string} params.adminUserId - 管理ユーザーID
     * @param {Partial<decodedAdminUser>} params.updateData - 更新データ
     */
    async updateAdminUser(params: {
      adminUserId: string;
      updateData: Partial<decodedAdminUser>;
    }) {
      params.updateData.role = String(params.updateData.role);
      const firestoreOps = useFirestoreDocOperation();
      firestoreOps.updateDocument({
        collectionName: "adminUsers",
        docId: params.adminUserId,
        docData: params.updateData,
        converter: adminUserConverter,
      });
    },

    /**
     * 管理ユーザーの削除
     * @param {Object} params - パラメータオブジェクト
     * @param {string} params.adminUserId - 管理ユーザーID
     */
    async deleteAdminUser(params: { adminUserId: string }) {
      const firestoreOps = useFirestoreDocOperation();
      firestoreOps.deleteDocument({
        collectionName: "adminUsers",
        docId: params.adminUserId,
      });
    },

    /**
     * ユーザー新規登録リクエストの実行
     * @param {Object} params - パラメータオブジェクト
     * @param {string} params.email - ユーザーのメールアドレス
     * @param {string} params.password - ユーザーのパスワード
     */
    async createNewAdminUser(params: { email: string; password: string }) {
      const firestoreOps = useFirestoreDocOperation();
      const organization = useOrganizationStore();
      firestoreOps.createDocument({
        collectionName: `organizations/${organization.getLoggedInOrganizationId}/requests/adminUserCreate/logs`,
        docId: createRandomDocId(),
        docData: {
          email: params.email,
          role: "2",
          organizationId: organization.loggedInOrganizationInfo.id,
          organizationCode: organization.loggedInOrganizationInfo.code,
          status: "pending",
        },
        converter: adminUserCreateRequestConverter,
      });
    },
  },
});
