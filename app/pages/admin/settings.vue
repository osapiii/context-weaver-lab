<template>
  <div class="space-y-6 px-6 py-6">
    <AdminModePageNav current-page-label="組織設定" />

    <!-- 作成関連UI(アラート & モーダル) -->
    <div>
      <!-- ユーザー作成終了時アラート -->
      <Transition>
        <EStatusCard
          v-if="userCreateAlertIsOpen"
          :label="EStatusCardLabel.label"
          :status="EStatusCardLabel.status"
          :message="EStatusCardLabel.messages"
      /></Transition>
      <!-- Google権限付与終了時アラート -->
      <Transition>
        <EStatusCard
          v-if="googleAddUserAlertIsOpen"
          label="対象のGoogleユーザーに閲覧権限を付与しました"
      /></Transition>
      <!-- Googleユーザー権限付与モーダル -->
      <EFormPopUpModal
        v-model:modal-is-open="googleAddUserModalIsOpen"
        title="権限付与"
      >
        <UFormField label="メールアドレス" required>
          <UInput
            v-model="formInputGoogleUser.email"
            type="email"
            placeholder="user@example.com"
            class="w-full"
          />
        </UFormField>

        <EButton
          label="権限付与"
          size="lg"
          :disabled="!isGoogleUserEmailValid"
          @click="sendGoogleAddUserRoleRequest"
        />
      </EFormPopUpModal>
      <!-- ユーザー作成モーダル -->
      <EFormPopUpModal
        v-model:modal-is-open="userCreateModalIsOpen"
        title="ユーザーの新規作成"
      >
        <UFormField label="メールアドレス" required>
          <UInput
            v-model="formInputAdminUser.email"
            type="email"
            placeholder="user@example.com"
            class="w-full"
          />
        </UFormField>

        <EButton
          label="ユーザーの作成"
          size="xs"
          color="primary"
          :icon="actionIcons.create"
          :disabled="!isAdminUserCreateEmailValid"
          @click="
            createAdminUser({
              email: formInputAdminUser.email,
            })
          "
        />
      </EFormPopUpModal>
    </div>
    <!-- 編集関連UI(アラート & モーダル) -->
    <div>
      <!-- ユーザー編集成功アラート -->
      <Transition>
        <EStatusCard
          v-if="userEditAlertIsOpen"
          label="ユーザー情報の更新が完了しました"
      /></Transition>
      <!-- ユーザー編集モーダル -->
      <EFormPopUpModal
        v-model:modal-is-open="userEditModalIsOpen"
        title="ユーザー情報の更新"
      >
        <UFormField label="メールアドレス" required class="mb-3">
          <UInput
            v-model="formInputAdminUser.email"
            type="email"
            placeholder="user@example.com"
            class="w-full"
          />
        </UFormField>
        <UFormField label="ユーザータイプ">
          <USelect
            v-model="formInputAdminUser.role"
            :items="adminUserRoleOptions"
            class="w-full"
          />
        </UFormField>

        <UButton
          label="ユーザーの作成"
          size="xs"
          color="primary"
          :disabled="!isAdminUserUpdateEmailValid"
          :icon="actionIcons.create"
          @click="
            updateAdminUser({
              email: formInputAdminUser.email,
              role: formInputAdminUser.role,
            })
          "
        />
      </EFormPopUpModal>
    </div>
    <!-- 削除関連UI(アラート & モーダル) -->
    <div>
      <!-- ユーザー削除成功アラート -->
      <Transition>
        <EStatusCard
          v-if="userDeleteAlertIsOpen"
          label="ユーザーのアカウント停止が完了しました"
      /></Transition>
      <!-- ユーザー削除モーダル -->
      <EPopUpModal
        v-model:modal-is-open="userDeleteModalIsOpen"
        :icon-name="statusIcons.warningSimple"
        icon-color="error"
        :main-text="`対象ユーザー「${selectedAdminUserInfo.email}」\nを削除してもよろしいでしょうか?`"
      >
        <template #left-button>
          <EButton
            size="xl"
            class="min-w-[120px]"
            color="error"
            label="削除する"
            @click="deleteUser(selectedAdminUserInfo.id)"
          />
        </template>
        <template #right-button>
          <EButton
            size="xl"
            class="min-w-[120px]"
            color="background"
            label="閉じる"
            @click="userDeleteModalIsOpen = false"
          />
        </template>
      </EPopUpModal>
    </div>
    <!-- ヘッダー -->
    <EPageCommonHeader>
      <template #left>
        <div class="text-sm font-bold">設定</div>
      </template>
    </EPageCommonHeader>

    <UTabs
      v-model="tabController.selectedTabIndex"
      :items="items"
      class="w-full"
    >
      <template #default="{ item, selected }">
        <!-- メニューの編集 -->
        <div class="flex items-center gap-2 relative truncate">
          <UIcon :name="item.icon" class="w-4 h-4 flex-shrink-0" />
          <span class="truncate font-bold">{{ item.label }}</span>
          <span v-if="selected">
            <EnBadge color="background">選択中</EnBadge>
          </span>
        </div>
      </template>
      <!-- 各タブアイテムの表示 -->
      <template #item="{ item }">
        <!-- ユーザー一覧 -->
        <div v-if="item.key == 'users'">
          <div class="justify-end flex mb-2">
            <EButton
              label="ユーザーの作成"
              size="xs"
              color="primary"
              :icon="actionIcons.create"
              @click="openUserCreateModal"
            />
          </div>
          <!-- テーブル -->
          <div class="overflow-x-auto">
            <UTable
              :rows="adminUserList"
              :columns="columns"
              @select="setSelectedAdminUserRow"
            >
              <!-- ロールタイプ -->
              <template #role-data="{ row }">
                <EnBadge v-if="row.role == 1" variant="outline"
                  >システム管理者</EnBadge
                >
                <EnBadge v-if="row.role == 2" variant="outline" color="background"
                  >企業管理者</EnBadge
                >
              </template>
              <!-- 操作メニュー -->
              <template #actions-data="{}">
                <UDropdown :items="actionItems()">
                  <UButton
                    color="gray"
                    variant="ghost"
                    :icon="actionIcons.menu"
                  />
                </UDropdown>
              </template>
              <!-- createdAt -->
              <template #createdAt-data="{ row }">
                {{ formatTimestamp(row.createdAt.toDate()) }}
              </template>
            </UTable>
          </div>
        </div>
        <!-- 認証済みメールアドレス -->
        <div v-if="item.key == 'verifiedEmails'">
          <div class="overflow-x-auto">
            <UTable
              :rows="senderEmails.mailAddressList"
              :columns="senderEmailColumns"
            >
              <template #type-data="{ row }">
                <EnBadge v-if="row.type == 'default'" variant="outline"
                  >デフォルト</EnBadge
                >
                <EnBadge
                  v-if="row.type == 'custom'"
                  variant="outline"
                  color="background"
                  >カスタム</EnBadge
                >
              </template>
              <template #createdAt-data="{ row }">
                {{ formatTimestamp(row.createdAt.toDate()) }}
              </template>
            </UTable>
          </div>
        </div>
        <!-- サービス連携設定 -->
        <div v-if="item.key == 'serviceConfig'">
          <!-- Slack連携 -->
          <EnCard>
            <div class="font-bold text-h5 text-black">Slack連携</div>

            <!-- 連携済みの場合の表示 -->
            <div v-if="slackIntegration.slackIntegrationConfig.accessToken">
              <div class="flex justify-between">
                <div class="font-bold text-success-500 text-xs">連携済み</div>
                <UButton
                  color="purple"
                  class="mt-2"
                  size="xs"
                  @click="openSlackOauthWindow"
                  >再連携する</UButton
                >
              </div>
            </div>
            <div v-if="!slackIntegration.slackIntegrationConfig.accessToken">
              <div class="flex justify-between">
                <div class="font-bold text-slate-600 text-xs">未連携</div>
                <UButton
                  v-if="!slackIntegration.slackIntegrationConfig.accessToken"
                  color="purple"
                  class="mt-2"
                  size="xs"
                  :icon="brandIcons.slack"
                  @click="openSlackOauthWindow"
                  >連携する</UButton
                >
              </div>
            </div>
            <div class="mt-2">
              <div class="text-slate-700 text-xs font-bold">
                通知送信可能なチャンネルの一覧
              </div>
              <ESelect
                :options="slackIntegration.returnSlackChannelsForSelectForm"
              />
            </div>
          </EnCard>
          <!-- Googleサービスアカウント連携 -->
          <EnCard custom-class="mt-4">
            <div class="flex justify-between">
              <div class="font-bold text-h5 text-black">
                Google BigQuery連携
              </div>
              <UButton
                color="primary"
                size="xs"
                :icon="actionIcons.add"
                @click="googleAddUserModalIsOpen = true"
                >メールアドレスの追加</UButton
              >
            </div>
            <div class="overflow-x-auto">
              <UTable :rows="googleUser.userList" :columns="googleUserColumns">
                <template #action-data>
                  <UButton size="xs" color="error" variant="outline"
                    >削除</UButton
                  >
                </template>
                <template #createdAt-data="{ row }">
                  {{ formatTimestamp(row.createdAt.toDate()) }}
                </template>
              </UTable>
            </div>
          </EnCard>
          <!-- 送信元メールアドレスの設定 -->
          <EnCard custom-class="mt-4">
            <div class="font-bold text-h5 text-black">
              送信元メールアドレスの設定
            </div>
            <div class="overflow-x-auto">
              <UTable
                :rows="senderEmails.mailAddressList"
                :columns="senderEmailColumns"
              >
                <template #type-data="{ row }">
                  <EBadge
                    v-if="row.type == 'default'"
                    color="background"
                    variant="outline"
                    >デフォルト</EBadge
                  >
                  <EBadge
                    v-if="row.type == 'custom'"
                    color="primary"
                    variant="outline"
                    >追加登録</EBadge
                  >
                </template>
                <template #createdAt-data="{ row }">
                  {{ formatTimestamp(row.createdAt.toDate()) }}
                </template>
              </UTable>
            </div>
          </EnCard>
        </div>
      </template>
    </UTabs>
  </div>
</template>

<script lang="ts" setup>
//#region Imports - 外部ライブラリ
import { computed, ref, reactive, onMounted, onBeforeUnmount, watchEffect } from "vue";
import { storeToRefs } from "pinia";
import { doc, onSnapshot } from "firebase/firestore";
import { ZodError } from "zod";

//#region Imports - 型定義
import type { decodedAdminUser } from "@models/adminUser";

//#region Imports - データコンバーター
import { googleAddUserRoleRequestConverter } from "@models/googleAddUserRoleRequest";
import { adminUserCreateRequestConverter } from "@models/adminUserCreateRequest";

//#region Imports - ユーティリティ
import log from "@utils/logger";

// ***********************
// ** Middleware Setup
// ***********************
definePageMeta({
  layout: "admin",
  middleware: ["admin-logged-in-check"],
});

//#region Store Access
const organizationStore = useOrganizationStore();
const adminUserStore = useAdminUserStore();
const tableSchema = useTableSchema();
const firestoreDocOps = useFirestoreDocOperation();
const globalError = useGlobalErrorStore();
const googleUser = useGoogleUserStore();
const senderEmails = useSenderEmailStore();
const slackIntegration = useSlackIntegrationStore();
const tabController = useTabControllerStore();
//#endregion Store Access

//#region Composables
const actionIcons = useActionIcons();
const brandIcons = useBrandIcons();
const statusIcons = useStatusIcons();
//#endregion Composables

//#region State - Forms
/**
 * ステータスカード表示用のラベル情報
 */
const EStatusCardLabel = reactive({
  label: "",
  status: "success" as "success" | "failed",
  messages: "",
});

/**
 * 管理ユーザーフォーム入力値
 */
const formInputAdminUser = ref({
  email: "",
  role: 1,
});

/**
 * Googleユーザーフォーム入力値
 */
const formInputGoogleUser = ref({
  email: "",
});

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const isValidEmail = (email: string) => EMAIL_PATTERN.test(email.trim());

const isGoogleUserEmailValid = computed(() =>
  isValidEmail(formInputGoogleUser.value.email),
);

const isAdminUserCreateEmailValid = computed(() =>
  isValidEmail(formInputAdminUser.value.email),
);

const isAdminUserUpdateEmailValid = computed(() =>
  isValidEmail(formInputAdminUser.value.email),
);

const adminUserRoleOptions = [
  { label: "システム管理者", value: 1 },
  { label: "企業管理者", value: 2 },
  { label: "一般", value: 3 },
];
//#endregion State - Forms

//#region State - Modals & Alerts
/**
 * Googleユーザー追加モーダルの開閉状態
 */
const googleAddUserModalIsOpen = ref(false);

/**
 * Googleユーザー追加アラートの表示状態
 */
const googleAddUserAlertIsOpen = ref(false);

/**
 * ユーザー作成モーダルの開閉状態
 */
const userCreateModalIsOpen = ref(false);

/**
 * ユーザー作成アラートの表示状態
 */
const userCreateAlertIsOpen = ref(false);

/**
 * ユーザー編集モーダルの開閉状態
 */
const userEditModalIsOpen = ref(false);

/**
 * ユーザー編集アラートの表示状態
 */
const userEditAlertIsOpen = ref(false);

/**
 * ユーザー削除モーダルの開閉状態
 */
const userDeleteModalIsOpen = ref(false);

/**
 * ユーザー削除アラートの表示状態
 */
const userDeleteAlertIsOpen = ref(false);

/**
 * 選択された管理ユーザー情報
 */
const selectedAdminUser = ref<decodedAdminUser | null>(null);

/**
 * 管理ユーザーリスト（Storeから取得）
 */
const { adminUserList } = storeToRefs(adminUserStore);

/**
 * 購読中の管理ユーザー作成クエリドキュメント
 */
const subscribedAdminUserCreateQueryDoc = ref<DocumentData>({});
//#endregion State - Modals & Alerts

//#region UI Config
/**
 * 管理ユーザーテーブルの列定義
 */
const columns = tableSchema.value["admin-settings"].columns;

/**
 * Googleユーザーテーブルの列定義
 */
const googleUserColumns =
  tableSchema.value["admin-settings-google-users"].columns;

/**
 * 送信元メールアドレステーブルの列定義
 */
const senderEmailColumns =
  tableSchema.value["admin-settings-sender-emails"].columns;

/**
 * タブアイテム定義
 */
const items = [
  {
    key: "users",
    label: "ユーザー管理",
  },
  {
    key: "serviceConfig",
    label: "サービス連携設定",
  },
];

/**
 * アクションアイテム定義（ドロップダウンメニュー）
 *
 * @returns アクションアイテムの配列
 */
const actionItems = () => [
  [
    {
      label: "アカウント停止",
      icon: actionIcons.trash,
      click: () => (userDeleteModalIsOpen.value = true),
    },
  ],
];
//#endregion UI Config

//#region Computed
/**
 * 選択された管理ユーザーの情報
 *
 * @remarks
 * selectedAdminUserがnullの場合は空の情報を返します。
 *
 * @returns ユーザーIDとメールアドレスを含むオブジェクト
 */
const selectedAdminUserInfo = computed(() => {
  if (selectedAdminUser.value) {
    return {
      id: selectedAdminUser.value.id,
      email: selectedAdminUser.value.email,
    };
  } else {
    return {
      id: "",
      email: "",
    };
  }
});
//#endregion Computed

//#region Watch
/**
 * ログイン中の組織IDが変更されたら管理ユーザーリストを再取得
 *
 * @remarks
 * organizationStore.getLoggedInOrganizationIdの変更を監視します。
 */
watchEffect(async () => {
  if (organizationStore.getLoggedInOrganizationId) {
    await adminUserStore.fetchAdminUserListWithCurrentLoggedInOrganization();
  }
});
//#endregion Watch

//#region Methods - User Management
/**
 * 選択された管理ユーザーを削除
 *
 * @param userId - 削除対象のユーザーID
 *
 * @remarks
 * 以下の処理を順次実行します：
 * 1. 削除処理の実行
 * 2. 削除モーダルを閉じる
 * 3. ユーザー一覧の再取得
 * 4. 削除成功アラートを5秒間表示
 */
const deleteUser = async (userId: string) => {
  // 削除処理の実行
  await adminUserStore.deleteAdminUser({
    adminUserId: userId,
  });
  // 削除モーダルを閉じる
  userDeleteModalIsOpen.value = false;
  // ユーザー一覧の再取得
  await adminUserStore.fetchAdminUserListWithCurrentLoggedInOrganization();
  // 削除成功アラートを表示
  userDeleteAlertIsOpen.value = true;
  // 5秒後にアラートを閉じる
  useTimeoutFn(() => {
    userDeleteAlertIsOpen.value = false;
  }, 5000);
};

/**
 * テーブル行選択時に管理ユーザー情報を設定
 *
 * @param row - 選択された管理ユーザーの行データ
 */
const setSelectedAdminUserRow = (row: decodedAdminUser) => {
  selectedAdminUser.value = row;
};

/**
 * ユーザー編集モーダルを開く
 *
 * @remarks
 * selectedAdminUserが設定されている場合のみモーダルを開きます。
 * フォーム入力値を選択ユーザーの情報で初期化します。
 */
const openUserEditModal = () => {
  if (selectedAdminUser.value) {
    formInputAdminUser.value.email = selectedAdminUser.value.email;
    formInputAdminUser.value.role = selectedAdminUser.value.role;
    userEditModalIsOpen.value = true;
  } else {
    // エラーアラートを表示
    log("ERROR", "ユーザーが選択されていません");
  }
};

/**
 * Google連携ユーザーの権限付与リクエストを送信
 */
const sendGoogleAddUserRoleRequest = async () => {
  log("INFO", "sendGoogleAddUserRoleRequest triggered!");
  const requestId = createRandomDocId();
  try {
    await firestoreDocOps.createDocument({
      collectionName: `organizations/${organizationStore.getLoggedInOrganizationId}/googleAddUserRequestLogs`,
      docId: requestId,
      docData: {
        organizationCode: organizationStore.loggedInOrganizationInfo.code,
        organizationId: organizationStore.getLoggedInOrganizationId,
        mailAddress: formInputGoogleUser.value.email,
        status: "pending",
        operationType: "add",
      },
      converter: googleAddUserRoleRequestConverter,
    });
    log("INFO", "succeed🎉");
    // ドキュメントの参照を取得
    const db = useFirestore();
    const docRef = doc(
      db,
      `organizations/${organizationStore.getLoggedInOrganizationId}/googleAddUserRequestLogs`,
      requestId
    );
    // リアルタイムリスナーを設定
    onSnapshot(
      docRef,
      (doc) => {
        if (doc.exists()) {
          log("INFO", "Http Request doc is updated:", doc.data());
          const data = doc.data();
          if (data.status === "success") {
            // モーダルを閉じる
            googleAddUserModalIsOpen.value = false;
            googleAddUserModalIsOpen.value = false;
            googleAddUserAlertIsOpen.value = true;
            useTimeoutFn(() => {
              googleAddUserAlertIsOpen.value = false;
            }, 5000);
          }
        }
      },
      (error) => {
        log("ERROR", "Error getting document:", error);
      }
    );
  } catch (error) {
    if (error instanceof ZodError) {
      error.errors.forEach((err) => {
        log("ERROR", "Zod validation error:", err);
      });
    } else {
      log("ERROR", "Unexpected error:", error);
    }
    globalError.createNewGlobalError({
      selectedErrorMessage: globalError.errorCodeList.setting.google.E1500,
    });
  }
};

/**
 * ユーザー作成モーダルを開く
 */
const openUserCreateModal = () => {
  userCreateModalIsOpen.value = true;
};

/**
 * 管理ユーザーを作成
 *
 * @param params - ユーザー作成パラメータ
 * @param params.email - ユーザーのメールアドレス
 * @param params.password - ユーザーのパスワード
 *
 * @remarks
 * 以下の処理を順次実行します：
 * 1. Firestoreにユーザー作成リクエストを登録
 * 2. モーダルを閉じる
 * 3. ステータスカードラベルを設定
 * 4. ユーザー一覧を再取得
 * 5. 作成成功アラートを5秒間表示
 */
const createAdminUser = async (params: { email: string; password: string }) => {
  log("INFO", "createAdminUser params is....", params);
  // ユーザーを作成する
  await firestoreDocOps.createDocument({
    collectionName: `organizations/${organizationStore.getLoggedInOrganizationId}/requests/adminUserCreate/logs`,
    docId: createRandomDocId(),
    docData: {
      email: params.email,
      role: "2",
      organizationId: organizationStore.loggedInOrganizationInfo.id,
      organizationCode: organizationStore.loggedInOrganizationInfo.code,
      status: "pending",
    },
    converter: adminUserCreateRequestConverter,
  });
  // modalを閉じる
  userCreateModalIsOpen.value = false;
  EStatusCardLabel.label = "ユーザーの新規作成が完了しました";
  EStatusCardLabel.status = "success";
  // ユーザー一覧の再取得
  await adminUserStore.fetchAdminUserListWithCurrentLoggedInOrganization();
  // 更新成功アラートを表示
  userCreateAlertIsOpen.value = true;
  // 5秒後にアラートを閉じる
  useTimeoutFn(() => {
    userCreateAlertIsOpen.value = false;
  }, 5000);
  log("INFO", "createAdminUser finished");
};

/**
 * 管理ユーザー情報を更新
 *
 * @param submitData - 更新するデータ（email, role等）
 *
 * @remarks
 * selectedAdminUserが設定されている場合のみ更新を実行します。
 * 更新後、ユーザー一覧を再取得し、編集アラートを8秒間表示します。
 */
const updateAdminUser = async (submitData: object) => {
  if (selectedAdminUser.value) {
    await adminUserStore.updateAdminUser({
      adminUserId: selectedAdminUser.value.id,
      updateData: submitData,
    });
    // ユーザー一覧の更新
    await adminUserStore.fetchAdminUserListWithCurrentLoggedInOrganization();
    userEditModalIsOpen.value = false;
    userEditAlertIsOpen.value = true;
    // 8秒後にアラートを閉じる
    useTimeoutFn(() => {
      userEditAlertIsOpen.value = false;
    }, 8000);
  } else {
    // エラーアラートを表示
    log("ERROR", "ユーザーが選択されていません");
  }
};

/**
 * Slack OAuthの認証画面を開く
 */
const openSlackOauthWindow = () => {
  const oauthUrl = slackIntegration.generateSlackOAuthURL({
    clientId: "3288876322150.7589385494418",
    redirectUri: "https://localhost:3000/admin/oauth/complete",
    scopes: [
      "chat:write",
      "channels:history",
      "channels:read",
      "groups:read",
      "mpim:read",
      "im:read",
    ],
    state: organizationStore.getLoggedInOrganizationId,
  });
  window.open(oauthUrl, "_blank");
};
//#endregion Methods - User Management

//#region Lifecycle
/**
 * コンポーネントマウント時の初期化処理（データ取得）
 *
 * @remarks
 * 以下のデータを順次取得します：
 * - タブインデックスの初期化
 * - Googleユーザー一覧
 * - 送信元メールアドレス一覧
 * - Slackチャンネル一覧
 */
onMounted(async () => {
  // Tab Indexの一律初期化
  const tabControllerStore = useTabControllerStore();
  tabControllerStore.selectedTabIndex = 0;
  // Googleユーザー一覧の取得
  await googleUser.fetchGoogleUsers();
  // 送信元メールアドレスの取得
  await senderEmails.fetchSenderEmailAddress();
  // Slackチャンネル一覧の取得
  await slackIntegration.getChannels();
});

/**
 * コンポーネントマウント時の初期化処理（キーボードイベント）
 *
 * @remarks
 * タブコントローラーのキーボードイベントリスナーを設定します。
 * 矢印キーによるタブ切り替えを有効化します。
 */
onMounted(() => {
  // キーボードイベントリスナーを追加
  window.addEventListener("keydown", tabController.handleArrowKey);
  // Tabのmin/maxを設定
  tabController.minTabIndex = 0;
  tabController.maxTabIndex = items.length - 1;
});

/**
 * コンポーネントアンマウント前のクリーンアップ処理
 *
 * @remarks
 * キーボードイベントリスナーを削除します。
 */
onBeforeUnmount(() => {
  // コンポーネントのアンマウント時にリスナーを削除
  window.removeEventListener("keydown", tabController.handleArrowKey);
});
//#endregion Lifecycle
</script>

<style scoped>
.v-enter-active,
.v-leave-active {
  transition: opacity 0.8s ease-in-out;
}

.v-enter-from,
.v-leave-to {
  opacity: 0;
}
</style>
