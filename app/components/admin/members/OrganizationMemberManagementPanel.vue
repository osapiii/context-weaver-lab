<template>
  <div class="space-y-6">
    <section class="rounded-lg border border-neutral-200 bg-white p-6 shadow-sm">
      <div class="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 class="text-lg font-semibold flex items-center gap-2">
            <UIcon name="material-symbols:group" class="text-primary-500 w-5 h-5" />
            メンバー管理
          </h2>
          <p class="mt-1 text-sm text-neutral-600">
            組織に所属するユーザーの発行・ロール変更・削除を行います。処理は Firebase Admin 経由で非同期実行されます。
          </p>
        </div>
        <EnButton
          variant="solid"
          leading-icon="material-symbols:person-add"
          :disabled="isSubmitting"
          @click="openCreateModal"
        >
          メンバーを追加
        </EnButton>
      </div>

      <EnAlert
        v-if="membersError"
        variant="soft"
        color="error"
        title="一覧の取得に失敗しました"
        :description="membersError"
        class="mb-4"
      />

      <EnAlert
        v-if="operationNotice"
        :variant="operationNotice.ok ? 'soft' : 'soft'"
        :color="operationNotice.ok ? 'success' : 'error'"
        :title="operationNotice.title"
        :description="operationNotice.description"
        class="mb-4"
      />

      <div v-if="isLoadingMembers" class="py-8 text-center text-sm text-neutral-500">
        読み込み中…
      </div>

      <div v-else-if="members.length === 0" class="py-8 text-center text-sm text-neutral-500">
        登録されているメンバーがいません
      </div>

      <div v-else class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead>
            <tr class="border-b border-neutral-200 text-left text-neutral-600">
              <th class="py-2 pr-4 font-medium">メールアドレス</th>
              <th class="py-2 pr-4 font-medium">ロール</th>
              <th class="py-2 pr-4 font-medium">登録日</th>
              <th class="py-2 font-medium text-right">操作</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="member in members"
              :key="member.id"
              class="border-b border-neutral-100 last:border-0"
            >
              <td class="py-3 pr-4">
                <span class="font-medium text-neutral-900">{{ member.email }}</span>
                <span
                  v-if="member.id === currentUserId"
                  class="ml-2 text-xs text-neutral-500"
                >(あなた)</span>
              </td>
              <td class="py-3 pr-4">
                <EnBadge :variant="roleBadgeVariant(member.role)">
                  {{ roleLabel(member.role) }}
                </EnBadge>
              </td>
              <td class="py-3 pr-4 text-neutral-600">
                {{ formatCreatedAt(member.createdAt) }}
              </td>
              <td class="py-3 text-right">
                <div class="flex justify-end gap-2">
                  <EnButton
                    variant="outline"
                    size="xs"
                    :disabled="isSubmitting || member.id === currentUserId || member.role === '1'"
                    @click="openEditModal(member)"
                  >
                    編集
                  </EnButton>
                  <EnButton
                    variant="outline"
                    size="xs"
                    color="error"
                    :disabled="isSubmitting || member.id === currentUserId || member.role === '1'"
                    @click="openDeleteModal(member)"
                  >
                    削除
                  </EnButton>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <!-- 作成モーダル -->
    <EnModal
      v-model:open="createModalOpen"
      title="メンバーを追加"
      subtitle="Firebase Auth にアカウントを作成し、組織へ紐付けます"
      size="md"
    >
      <div class="space-y-4">
        <UFormField label="メールアドレス" required>
          <UInput
            v-model="createForm.email"
            type="email"
            placeholder="user@example.com"
            class="w-full"
          />
        </UFormField>
        <UFormField label="初期パスワード" required hint="6文字以上">
          <UInput
            v-model="createForm.password"
            type="password"
            placeholder="••••••••"
            class="w-full"
          />
        </UFormField>
        <UFormField label="ロール" required>
          <EnRadioGroup
            v-model="createForm.rbacRole"
            :items="roleRadioItems"
          />
        </UFormField>
        <UFormField
          v-if="createForm.rbacRole === 3"
          label="アクセス可能な Space"
          required
        >
          <EnRadioGroup
            v-model="createForm.spaceIds"
            multiple
            :items="spaceCheckboxItems"
          />
        </UFormField>
        <p v-if="formError" class="text-xs text-rose-600">{{ formError }}</p>
      </div>
      <template #footer>
        <div class="flex justify-end gap-2">
          <EnButton variant="ghost" @click="createModalOpen = false">
            キャンセル
          </EnButton>
          <EnButton
            variant="solid"
            :loading="isSubmitting"
            :disabled="!canSubmitCreate"
            @click="submitCreate"
          >
            作成する
          </EnButton>
        </div>
      </template>
    </EnModal>

    <!-- 編集モーダル -->
    <EnModal
      v-model:open="editModalOpen"
      title="メンバーを編集"
      size="md"
    >
      <div class="space-y-4">
        <UFormField label="メールアドレス">
          <UInput
            v-model="editForm.email"
            type="email"
            class="w-full"
          />
        </UFormField>
        <UFormField label="ロール" required>
          <EnRadioGroup
            v-model="editForm.rbacRole"
            :items="roleRadioItems"
          />
        </UFormField>
        <UFormField
          v-if="editForm.rbacRole === 3"
          label="アクセス可能な Space"
          required
        >
          <EnRadioGroup
            v-model="editForm.spaceIds"
            multiple
            :items="spaceCheckboxItems"
          />
        </UFormField>
        <p v-if="formError" class="text-xs text-rose-600">{{ formError }}</p>
      </div>
      <template #footer>
        <div class="flex justify-end gap-2">
          <EnButton variant="ghost" @click="editModalOpen = false">
            キャンセル
          </EnButton>
          <EnButton
            variant="solid"
            :loading="isSubmitting"
            :disabled="!canSubmitEdit"
            @click="submitEdit"
          >
            保存する
          </EnButton>
        </div>
      </template>
    </EnModal>

    <!-- 削除確認 -->
    <EnModal
      v-model:open="deleteModalOpen"
      title="メンバーを削除"
      header-variant="warning"
      size="sm"
    >
      <p class="text-sm text-neutral-700">
        <strong>{{ deleteTarget?.email }}</strong>
        を Firebase Auth から削除し、組織のメンバー一覧からも取り除きます。この操作は取り消せません。
      </p>
      <template #footer>
        <div class="flex justify-end gap-2">
          <EnButton variant="ghost" @click="deleteModalOpen = false">
            キャンセル
          </EnButton>
          <EnButton
            variant="solid"
            color="error"
            :loading="isSubmitting"
            @click="submitDelete"
          >
            削除する
          </EnButton>
        </div>
      </template>
    </EnModal>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from "vue";
import { storeToRefs } from "pinia";
import { getAuth } from "firebase/auth";
import type { Timestamp } from "firebase/firestore";
import type { decodedAdminUser } from "@models/adminUser";
import type { MemberRbacRole } from "@models/organizationMemberRequest";
import {
  MEMBER_USER_CREATE_COLLECTION,
  MEMBER_USER_UPDATE_COLLECTION,
  MEMBER_USER_DELETE_COLLECTION,
} from "@models/organizationMemberRequest";
import EnModal from "@components/EnModal.vue";
import EnButton from "@components/EnButton.vue";
import EnBadge from "@components/EnBadge.vue";
import EnAlert from "@components/EnAlert.vue";
import EnRadioGroup from "@components/EnRadioGroup.vue";

const memberStore = useOrganizationMemberManagementStore();
const spaceStore = useSpaceStore();
const contextStore = useContextStore();
const adminUserStore = useAdminUserStore();

const {
  members,
  isLoadingMembers,
  membersError,
  isSubmitting,
  pendingRequestId,
  operationError,
} = storeToRefs(memberStore);

const currentUserId = computed(() => getAuth().currentUser?.uid ?? "");

const createModalOpen = ref(false);
const editModalOpen = ref(false);
const deleteModalOpen = ref(false);
const deleteTarget = ref<decodedAdminUser | null>(null);
const formError = ref<string | null>(null);
const operationNotice = ref<{ ok: boolean; title: string; description: string } | null>(null);

const pendingKind = ref<"create" | "update" | "delete" | null>(null);
const pendingCollectionPath = ref<string | null>(null);

const createForm = reactive({
  email: "",
  password: "",
  rbacRole: 3 as MemberRbacRole,
  spaceIds: [] as string[],
});

const editForm = reactive({
  userId: "",
  email: "",
  rbacRole: 3 as MemberRbacRole,
  spaceIds: [] as string[],
});

const roleRadioItems = [
  {
    value: 2,
    label: "システム管理者",
    description: "組織内のすべての Space にアクセスできます",
  },
  {
    value: 3,
    label: "利用者",
    description: "指定した Space のみアクセスできます",
  },
];

const spaceCheckboxItems = computed(() =>
  spaceStore.spaces.map((s) => ({
    value: s.id,
    label: s.name,
    description: s.description || undefined,
  })),
);

const roleLabel = (role: string) => {
  if (role === "1") return "Super";
  if (role === "2") return "システム管理者";
  if (role === "3") return "利用者";
  return `ロール ${role}`;
};

const roleBadgeVariant = (role: string) => {
  if (role === "1") return "ai" as const;
  if (role === "2") return "assistant" as const;
  return "tag" as const;
};

const formatCreatedAt = (ts: Timestamp) =>
  new Intl.DateTimeFormat("ja-JP", { dateStyle: "medium" }).format(ts.toDate());

const canSubmitCreate = computed(
  () =>
    createForm.email.includes("@") &&
    createForm.password.length >= 6 &&
    (createForm.rbacRole === 2 || createForm.spaceIds.length > 0),
);

const canSubmitEdit = computed(
  () =>
    editForm.email.includes("@") &&
    (editForm.rbacRole === 2 || editForm.spaceIds.length > 0),
);

const openCreateModal = () => {
  formError.value = null;
  createForm.email = "";
  createForm.password = "";
  createForm.rbacRole = 3;
  createForm.spaceIds = spaceStore.spaces[0]?.id ? [spaceStore.spaces[0].id] : [];
  createModalOpen.value = true;
};

const openEditModal = (member: decodedAdminUser) => {
  formError.value = null;
  editForm.userId = member.id;
  editForm.email = member.email;
  const roleNum = Number(member.role);
  editForm.rbacRole = roleNum === 2 ? 2 : 3;
  editForm.spaceIds =
    member.spaceIds?.length
      ? [...member.spaceIds]
      : spaceStore.spaces[0]?.id
        ? [spaceStore.spaces[0].id]
        : [];
  editModalOpen.value = true;
};

const openDeleteModal = (member: decodedAdminUser) => {
  deleteTarget.value = member;
  deleteModalOpen.value = true;
};

const startWatch = (kind: "create" | "update" | "delete", requestId: string) => {
  pendingKind.value = kind;
  const suffix =
    kind === "create"
      ? MEMBER_USER_CREATE_COLLECTION
      : kind === "update"
        ? MEMBER_USER_UPDATE_COLLECTION
        : MEMBER_USER_DELETE_COLLECTION;
  pendingCollectionPath.value = contextStore.organizationFirestorePath(suffix);
  memberStore.pendingRequestId = requestId;
};

const submitCreate = async () => {
  formError.value = null;
  const created = await memberStore.submitCreateRequest({
    email: createForm.email.trim(),
    password: createForm.password,
    rbacRole: createForm.rbacRole,
    spaceIds: createForm.rbacRole === 3 ? [...createForm.spaceIds] : [],
  });
  if (!created) {
    formError.value = operationError.value ?? "作成に失敗しました";
    return;
  }
  startWatch("create", created.id);
  createModalOpen.value = false;
};

const submitEdit = async () => {
  formError.value = null;
  const updated = await memberStore.submitUpdateRequest({
    userId: editForm.userId,
    email: editForm.email.trim(),
    rbacRole: editForm.rbacRole,
    spaceIds: editForm.rbacRole === 3 ? [...editForm.spaceIds] : [],
  });
  if (!updated) {
    formError.value = operationError.value ?? "更新に失敗しました";
    return;
  }
  startWatch("update", updated.id);
  editModalOpen.value = false;
};

const submitDelete = async () => {
  if (!deleteTarget.value) return;
  const deleted = await memberStore.submitDeleteRequest({
    userId: deleteTarget.value.id,
  });
  if (!deleted) {
    formError.value = operationError.value ?? "削除に失敗しました";
    return;
  }
  startWatch("delete", deleted.id);
  deleteModalOpen.value = false;
};

useOrganizationMemberRequestWatcher({
  requestId: pendingRequestId,
  kind: pendingKind,
  collectionPath: pendingCollectionPath,
  onTerminal: async (doc, ok) => {
    operationNotice.value = {
      ok,
      title: ok ? "処理が完了しました" : "処理に失敗しました",
      description: ok
        ? "メンバー一覧を更新しました"
        : doc.errorMessage ?? "エラーが発生しました",
    };
    memberStore.clearPendingRequest();
    pendingKind.value = null;
    pendingCollectionPath.value = null;
    if (ok) {
      await memberStore.fetchMembers();
      if (
        doc.operationMetadata.requestedBy.userId === currentUserId.value &&
        "input" in doc &&
        doc.input &&
        "userId" in doc.input &&
        doc.input.userId === currentUserId.value
      ) {
        await adminUserStore.refreshCustomClaims();
      }
    }
  },
});

watch(
  () => createForm.rbacRole,
  (role) => {
    if (role === 3 && createForm.spaceIds.length === 0 && spaceStore.spaces[0]) {
      createForm.spaceIds = [spaceStore.spaces[0].id];
    }
  },
);

onMounted(async () => {
  await spaceStore.fetchSpaces();
  await memberStore.fetchMembers();
});
</script>
