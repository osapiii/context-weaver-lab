<script setup lang="ts">
import { z } from "zod";
import type { User } from "firebase/auth";
import { nextTick, onMounted } from "vue";
import log from "@utils/logger";

type FormSubmitEvent<T> = {
  data: T;
};

definePageMeta({
  layout: false,
});

defineOptions({
  name: "AdminSigninPage",
});

useHead({
  title: "ログイン",
});

//#region Zod Schema
const EMAIL_STORAGE_KEY = "aiStudioEmailForSignIn";

const schema = z.object({
  email: z
    .string()
    .trim()
    .email("有効なメールアドレスを入力してください")
    .min(1, "メールアドレスは必須です"),
  password: z.string().optional(),
});

type Schema = z.output<typeof schema>;
//#endregion

//#region Stores
const userAuthStore = useAdminUserStore();
const organizationStore = useOrganizationStore();
const spaceStore = useSpaceStore();
const toast = useToast();
//#endregion

//#region Composables
const { isMobile } = useIsMobile();
const route = useRoute();
const config = useRuntimeConfig();

/** ログイン後の戻り先 (QR ディープリンク等)。内部パスのみ許可 */
const resolveRedirectPath = (): string | null => {
  const raw = route.query.redirect;
  const value = typeof raw === "string" ? raw.trim() : "";
  if (!value) return null;
  // open redirect 防止: アプリ内パス ("/...") のみ許可 ("//host" は除外)
  if (!value.startsWith("/") || value.startsWith("//")) return null;
  if (value.startsWith("/admin/signin")) return null;
  return value;
};
//#endregion

//#region Reactive Data
const state = reactive<Schema>({
  email: "",
  password: "",
});

const isLoading = ref(false);
const signinStep = ref<"request" | "sent" | "verifying" | "needs-email">(
  "request",
);
const sentEmail = ref("");
const passwordAuthEnabled =
  String(config.public.passwordAuthEnabled) === "true";
const loginMethod = ref<"password" | "email-link">(
  passwordAuthEnabled ? "password" : "email-link",
);
//#endregion

//#region Methods
const buildSigninUrl = (): string => {
  const url = new URL("/admin/signin", window.location.origin);
  const redirectPath = resolveRedirectPath();
  if (redirectPath) {
    url.searchParams.set("redirect", redirectPath);
  }
  return url.toString();
};

const persistEmailForLink = (email: string) => {
  window.localStorage.setItem(EMAIL_STORAGE_KEY, email);
};

const readPersistedEmailForLink = () =>
  window.localStorage.getItem(EMAIL_STORAGE_KEY) || "";

const clearPersistedEmailForLink = () => {
  window.localStorage.removeItem(EMAIL_STORAGE_KEY);
};

const isDevAuthBypassEmail = (email: string): boolean => {
  const normalizedEmail = email.trim().toLowerCase();
  const isLocalHost =
    typeof window !== "undefined" &&
    ["localhost", "127.0.0.1"].includes(window.location.hostname);
  if (!isLocalHost) return false;

  const devAuthBypass = config.public.devAuthBypass as
    | { enabled?: boolean | string; emails?: string }
    | undefined;
  if (devAuthBypass?.enabled !== true && devAuthBypass?.enabled !== "true") {
    return false;
  }

  const allowlistedEmails = String(devAuthBypass.emails || "")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
  return allowlistedEmails.includes(normalizedEmail);
};

async function signInWithPassword(email: string, password: string) {
  if (isLoading.value) return;
  if (!passwordAuthEnabled) return;
  if (password.length < 8) {
    toast.add({
      title: "入力を確認してください",
      description: "パスワードは8文字以上で入力してください",
      color: "error",
    });
    return;
  }

  isLoading.value = true;
  try {
    const user = await userAuthStore.passwordSignIn({ email, password });
    await initializeSignedInUser(user);
    toast.add({ title: "ログインしました", color: "success" });
    await redirectAfterSignIn();
  } catch (error: unknown) {
    log("ERROR", "Password sign-in failed", error);
    toast.add({
      title: "ログインできませんでした",
      description: "メールアドレスまたはパスワードを確認してください",
      color: "error",
    });
  } finally {
    isLoading.value = false;
  }
}

async function initializeSignedInUser(currentUser: User) {
  organizationStore.$reset();
  spaceStore.$reset();

  // ✅ Step 1: adminUserStoreを更新（currentUser, CustomClaims, rbacRoleを設定）
  await userAuthStore.updateAuthState({ currentUser });
  log("INFO", "✅ Step 1: adminUserStore更新完了", {
    rbacRole: userAuthStore.rbacRole,
    organizationId: userAuthStore.currentOrganizationId,
  });

  // ✅ Step 2: organizationStoreを更新
  const organizationId = userAuthStore.currentOrganizationId;
  if (!organizationId) {
    throw new Error("組織IDが見つかりません");
  }

  await organizationStore.updateLoggedInOrganizationInfo({
    filterKey: organizationId,
    searchType: "id",
  });
  log("INFO", "✅ Step 2: organizationStore更新完了");

  // ✅ Step 3: Space一覧を取得
  await spaceStore.fetchSpaces();
  log("INFO", "✅ Step 3: Space一覧取得完了", {
    spacesCount: spaceStore.spaces.length,
  });

  // ✅ Step 4: デフォルトSpaceまたは最初のSpaceを選択
  const targetSpace =
    spaceStore.defaultSpace || spaceStore.currentUserSpaces[0];

  if (!targetSpace) {
    throw new Error("アクセス可能なスペースが見つかりません");
  }

  log("INFO", "✅ サインイン後初期化完了", { spaceId: targetSpace.id });
}

async function redirectAfterSignIn() {
  // クライアントサイドで確実に判定するため、nextTickを使用
  await nextTick();

  // redirect クエリ (QR ディープリンク等) があれば最優先で元のページへ戻す
  const redirectPath = resolveRedirectPath();
  if (redirectPath && typeof window !== "undefined") {
    log("INFO", "Redirect query detected, returning to original page", {
      redirectPath,
    });
    window.location.href = redirectPath;
    return;
  }

  // スマホ判定（画面幅で判定）。タブレット (>=768px, iPad 縦含む) は
  // PC と同じくホーム (/admin) に着地させ、全機能を使えるようにする。
  const isMobileDevice =
    typeof window !== "undefined" && window.innerWidth < 768;

  log("INFO", "Device detection", {
    windowWidth: typeof window !== "undefined" ? window.innerWidth : "N/A",
    isMobileDevice,
  });

  if (isMobileDevice) {
    log("INFO", "Mobile device detected, redirecting to /admin/ai-chat");
    if (typeof window !== "undefined") {
      window.location.href = "/admin/ai-chat";
      return;
    }
  } else {
    log("INFO", "PC device detected, redirecting to /admin (home)");
    await navigateTo("/admin", { replace: true });
  }
}

async function completeEmailLinkSignIn(email: string) {
  if (isLoading.value) return;
  isLoading.value = true;
  signinStep.value = "verifying";

  try {
    log("INFO", "Email Link サインイン完了処理開始", { email });
    const user = await userAuthStore.completeEmailLinkSignIn({
      email,
      url: window.location.href,
    });
    clearPersistedEmailForLink();
    await initializeSignedInUser(user);

    toast.add({
      title: "ログインしました",
      description: "認証リンクを確認しました",
      color: "success",
    });

    await redirectAfterSignIn();
  } catch (error: unknown) {
    log("ERROR", "Email Link sign-in failed", error);
    signinStep.value = "request";
    const errorMessage =
      error instanceof Error
        ? error.message
        : "ログインリンクの確認に失敗しました。もう一度リンクを送信してください。";
    toast.add({
      title: "ログインエラー",
      description: errorMessage,
      color: "error",
    });
  } finally {
    isLoading.value = false;
  }
}

async function sendSigninLink(email: string) {
  if (isLoading.value) return;
  isLoading.value = true;

  try {
    const normalizedEmail = email.trim().toLowerCase();
    if (isDevAuthBypassEmail(normalizedEmail)) {
      const user = await userAuthStore.devSignIn({ email: normalizedEmail });
      clearPersistedEmailForLink();
      await initializeSignedInUser(user);
      toast.add({
        title: "開発ログインしました",
        description: "メールリンク確認をスキップしました",
        color: "success",
      });
      await redirectAfterSignIn();
      return;
    }

    log("INFO", "ログインリンク送信開始", { email: normalizedEmail });
    await userAuthStore.signIn({
      email: normalizedEmail,
      continueUrl: buildSigninUrl(),
    });
    persistEmailForLink(normalizedEmail);
    sentEmail.value = normalizedEmail;
    signinStep.value = "sent";
    toast.add({
      title: "ログインリンクを送信しました",
      description: "メールを開いてリンクを押してください",
      color: "success",
    });
  } catch (error: unknown) {
    log("ERROR", "Email Link send failed", error);
    const errorMessage =
      error instanceof Error
        ? error.message
        : "ログインリンクの送信に失敗しました";
    toast.add({
      title: "送信エラー",
      description: errorMessage,
      color: "error",
    });
  } finally {
    isLoading.value = false;
  }
}

/**
 * サインイン処理（ログインリンク送信 / リンク検証）
 */
async function onSubmit(event: FormSubmitEvent<Schema>) {
  if (loginMethod.value === "password") {
    await signInWithPassword(
      event.data.email.trim().toLowerCase(),
      event.data.password || "",
    );
    return;
  }
  if (
    signinStep.value === "needs-email" &&
    userAuthStore.isEmailLinkSignIn(window.location.href)
  ) {
    await completeEmailLinkSignIn(event.data.email.trim().toLowerCase());
    return;
  }
  await sendSigninLink(event.data.email);
}

onMounted(async () => {
  if (!userAuthStore.isEmailLinkSignIn(window.location.href)) {
    const persistedEmail = readPersistedEmailForLink();
    if (persistedEmail) state.email = persistedEmail;
    return;
  }

  const persistedEmail = readPersistedEmailForLink();
  if (persistedEmail) {
    state.email = persistedEmail;
    await completeEmailLinkSignIn(persistedEmail);
    return;
  }

  signinStep.value = "needs-email";
});
//#endregion
</script>

<template>
  <main class="signin-shell">
    <section class="signin-auth-panel" aria-label="StoryVault login">
      <div class="signin-auth-inner">
        <header class="signin-brand">
          <div class="signin-mark" aria-hidden="true">
            <span />
          </div>
          <div>
            <p class="signin-kicker">ENOSTECH</p>
            <h1>StoryVault</h1>
          </div>
        </header>

        <div class="signin-copy">
          <p class="signin-eyebrow">Secure workspace access</p>
          <h2>仕様とコードのズレを、ストーリー単位で管理。</h2>
          <p>登録済みアカウントで安全にワークスペースへ接続します。</p>
        </div>

        <!-- スマホ向けメッセージ -->
        <div
          v-if="isMobile"
          class="signin-mobile-note"
        >
          <UIcon
            name="i-heroicons-device-phone-mobile"
            class="h-5 w-5 flex-shrink-0"
          />
          <div>
            <p>スマートフォンでのご利用について</p>
            <span>
              ログイン後、StoryVault 画面へ移動します。
            </span>
          </div>
        </div>

        <!-- ログインフォーム -->
        <div class="signin-card">
          <div v-if="signinStep === 'verifying'" class="text-center space-y-3">
            <UIcon
              name="i-svg-spinners-90-ring-with-bg"
              class="mx-auto h-10 w-10 text-cyan-500"
            />
            <div>
              <h3 class="text-lg font-bold text-slate-950">
                ログインリンクを確認しています
              </h3>
              <p class="mt-2 text-sm text-slate-500">
                認証が完了したら自動で管理画面へ移動します。
              </p>
            </div>
          </div>

          <div v-else class="mb-6">
            <div
              v-if="passwordAuthEnabled && signinStep === 'request'"
              class="mb-5 grid grid-cols-2 gap-2 rounded-lg bg-slate-100 p-1"
            >
              <UButton
                type="button"
                :variant="loginMethod === 'password' ? 'solid' : 'ghost'"
                color="neutral"
                block
                @click="loginMethod = 'password'"
              >
                審査用ログイン
              </UButton>
              <UButton
                type="button"
                :variant="loginMethod === 'email-link' ? 'solid' : 'ghost'"
                color="neutral"
                block
                @click="loginMethod = 'email-link'"
              >
                メールリンク
              </UButton>
            </div>
            <div class="signin-card-header">
              <div class="signin-card-icon" aria-hidden="true">
                <UIcon
                  :name="
                    signinStep === 'sent'
                      ? 'i-heroicons-envelope-open'
                      : signinStep === 'needs-email'
                        ? 'i-heroicons-key'
                        : 'i-heroicons-envelope'
                  "
                />
              </div>
              <p>
                {{
                  loginMethod === "password"
                    ? "Reviewer sign in"
                    : signinStep === "sent"
                    ? "Link sent"
                    : signinStep === "needs-email"
                      ? "Confirm email"
                      : "Passwordless sign in"
                }}
              </p>
            </div>
            <h3 class="signin-form-title">
              {{
                loginMethod === "password"
                  ? "メールとパスワードでログイン"
                  : signinStep === "sent"
                  ? "メールを確認してください"
                  : signinStep === "needs-email"
                    ? "確認のためメールアドレスを入力"
                    : "メールでログイン"
              }}
            </h3>
            <p class="signin-form-description">
              {{
                loginMethod === "password"
                  ? "主催者へ個別に共有された審査用アカウントを入力してください。"
                  : signinStep === "sent"
                  ? `${sentEmail} 宛にログインリンクを送信しました。リンクを押すとログインが完了します。`
                  : signinStep === "needs-email"
                    ? "別のブラウザまたは端末でリンクを開いたため、送信先メールアドレスの確認が必要です。"
                    : "パスワードは不要です。登録済みのメールアドレスに届くリンクからログインします。"
              }}
            </p>
          </div>

          <UForm
            v-if="signinStep !== 'verifying'"
            :schema="schema"
            :state="state"
            @submit="onSubmit"
          >
            <div class="space-y-6">
              <!-- メールアドレス -->
              <UFormField
                label="メールアドレス"
                required
                name="email"
                class="signin-field"
              >
                <UInput
                  v-model="state.email"
                  type="email"
                  placeholder="your@email.com"
                  autocomplete="email"
                  size="xl"
                  class="w-full"
                  :disabled="isLoading || signinStep === 'sent'"
                  icon="i-heroicons-envelope"
                />
              </UFormField>

              <UFormField
                v-if="loginMethod === 'password'"
                label="パスワード"
                required
                name="password"
                class="signin-field"
              >
                <UInput
                  v-model="state.password"
                  type="password"
                  placeholder="パスワード"
                  autocomplete="current-password"
                  size="xl"
                  class="w-full"
                  :disabled="isLoading"
                  icon="i-heroicons-lock-closed"
                />
              </UFormField>

              <!-- サインインボタン -->
              <div v-if="signinStep !== 'sent'" class="pt-1">
                <EnButton
                  variant="solid"
                  color="info"
                  size="xl"
                  :leading-icon="
                    isLoading
                      ? 'i-svg-spinners-90-ring-with-bg'
                      : loginMethod === 'password' || signinStep === 'needs-email'
                        ? 'i-heroicons-arrow-right-end-on-rectangle'
                        : 'i-heroicons-paper-airplane'
                  "
                  :disabled="isLoading"
                  block
                  custom-class="signin-submit-button"
                  @click="onSubmit({ data: state } as FormSubmitEvent<Schema>)"
                >
                  {{
                    isLoading
                      ? "処理中..."
                      : loginMethod === "password"
                        ? "ログイン"
                        : signinStep === "needs-email"
                        ? "ログインを完了する"
                        : "ログインリンクを送信"
                  }}
                </EnButton>
              </div>

              <div v-else class="flex flex-col gap-3 pt-1">
                <EnButton
                  variant="soft"
                  color="info"
                  size="xl"
                  leading-icon="i-heroicons-envelope-open"
                  :disabled="true"
                  block
                  custom-class="signin-submit-button"
                >
                  メール送信済み
                </EnButton>
                <UButton
                  type="button"
                  variant="ghost"
                  color="neutral"
                  :disabled="isLoading"
                  @click="signinStep = 'request'"
                >
                  別のメールに送信
                </UButton>
              </div>
            </div>
          </UForm>
        </div>
      </div>
    </section>

    <section class="signin-product-panel" aria-hidden="true">
      <div class="signin-product-grid" />
      <div class="signin-dashboard-preview">
        <div class="preview-topbar">
          <span />
          <span />
          <span />
        </div>
        <div class="preview-header">
          <div>
            <p>StoryVault</p>
            <strong>Story SSOT</strong>
          </div>
          <div class="preview-live">LIVE</div>
        </div>
        <div class="preview-command">
          <UIcon name="i-heroicons-shield-check" />
          <span>Secure session ready</span>
        </div>
        <div class="preview-rail">
          <span class="is-active" />
          <span />
          <span />
          <span />
        </div>
        <div class="preview-metrics">
          <div>
            <span>Sessions</span>
            <strong>128</strong>
          </div>
          <div>
            <span>Jobs</span>
            <strong>42</strong>
          </div>
          <div>
            <span>Assets</span>
            <strong>316</strong>
          </div>
        </div>
        <div class="preview-flow">
          <span />
          <span />
          <span />
        </div>
      </div>
    </section>
  </main>
</template>

<style scoped>
.signin-shell {
  min-height: 100vh;
  display: grid;
  grid-template-columns: minmax(420px, 0.92fr) minmax(520px, 1.08fr);
  background:
    linear-gradient(90deg, rgba(148, 163, 184, 0.08) 1px, transparent 1px),
    linear-gradient(0deg, rgba(148, 163, 184, 0.08) 1px, transparent 1px),
    #07111f;
  background-size: 56px 56px;
  position: relative;
  overflow: hidden;
}

.signin-shell::before {
  content: "";
  position: absolute;
  inset: 0;
  background:
    radial-gradient(circle at 44% 22%, rgba(20, 184, 166, 0.18), transparent 26%),
    linear-gradient(120deg, rgba(15, 23, 42, 0.1), rgba(8, 145, 178, 0.16));
  pointer-events: none;
}

.signin-auth-panel,
.signin-product-panel {
  position: relative;
  z-index: 1;
}

.signin-auth-panel {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  padding: clamp(32px, 5vw, 72px);
  border-right: 1px solid rgba(148, 163, 184, 0.18);
}

.signin-auth-inner {
  width: min(100%, 468px);
}

.signin-brand {
  display: flex;
  align-items: center;
  gap: 14px;
  margin-bottom: 52px;
}

.signin-mark {
  display: grid;
  place-items: center;
  width: 44px;
  height: 44px;
  border: 1px solid rgba(125, 211, 252, 0.28);
  border-radius: 8px;
  background: rgba(15, 23, 42, 0.74);
  box-shadow: 0 20px 60px rgba(6, 182, 212, 0.18);
}

.signin-mark span {
  width: 18px;
  height: 18px;
  border: 2px solid #67e8f9;
  border-left-color: transparent;
  border-bottom-color: #34d399;
  transform: rotate(45deg);
}

.signin-kicker {
  margin: 0 0 2px;
  color: #38bdf8;
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.16em;
  text-transform: uppercase;
}

.signin-brand h1 {
  margin: 0;
  color: #f8fafc;
  font-size: 28px;
  font-weight: 850;
  line-height: 1;
}

.signin-copy {
  margin-bottom: 28px;
}

.signin-eyebrow {
  margin: 0 0 12px;
  color: #5eead4;
  font-size: 12px;
  font-weight: 800;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

.signin-copy h2 {
  margin: 0;
  color: #f8fafc;
  font-size: clamp(32px, 4vw, 52px);
  font-weight: 850;
  line-height: 1.06;
}

.signin-copy p:last-child {
  margin: 18px 0 0;
  max-width: 34rem;
  color: #a8b3c7;
  font-size: 15px;
  line-height: 1.8;
}

.signin-mobile-note {
  display: flex;
  gap: 12px;
  margin-bottom: 16px;
  padding: 14px;
  border: 1px solid rgba(251, 191, 36, 0.32);
  border-radius: 8px;
  background: rgba(120, 53, 15, 0.18);
  color: #fde68a;
}

.signin-mobile-note p {
  margin: 0 0 4px;
  color: #fef3c7;
  font-size: 13px;
  font-weight: 800;
}

.signin-mobile-note span {
  color: #fed7aa;
  font-size: 12px;
  line-height: 1.7;
}

.signin-card {
  position: relative;
  overflow: hidden;
  padding: clamp(24px, 3vw, 34px);
  border: 1px solid rgba(226, 232, 240, 0.92);
  border-radius: 8px;
  background: rgba(248, 250, 252, 0.98);
  box-shadow:
    0 28px 80px rgba(2, 6, 23, 0.34),
    0 1px 0 rgba(255, 255, 255, 0.8) inset;
}

.signin-card::before {
  content: "";
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 3px;
  background: linear-gradient(90deg, #22d3ee, #34d399, #f8fafc);
}

.signin-card-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 18px;
}

.signin-card-header p {
  margin: 0;
  color: #0f766e;
  font-size: 11px;
  font-weight: 850;
  letter-spacing: 0.13em;
  text-transform: uppercase;
}

.signin-card-icon {
  display: grid;
  place-items: center;
  width: 34px;
  height: 34px;
  border-radius: 8px;
  background: #0f172a;
  color: #67e8f9;
}

.signin-card-icon :deep(svg) {
  width: 18px;
  height: 18px;
}

.signin-form-title {
  margin: 0;
  color: #020617;
  font-size: 26px;
  font-weight: 850;
  line-height: 1.15;
}

.signin-form-description {
  margin: 10px 0 0;
  color: #64748b;
  font-size: 14px;
  line-height: 1.75;
}

.signin-field :deep(label) {
  color: #0f172a;
  font-weight: 800;
}

.signin-field :deep(input) {
  height: 54px;
  border-radius: 8px;
  font-size: 16px;
}

.signin-field :deep(input::placeholder) {
  color: #94a3b8;
}

.signin-submit-button {
  min-height: 52px;
  justify-content: center;
  white-space: nowrap;
  border-radius: 8px !important;
  font-weight: 850;
}

.signin-product-panel {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  padding: clamp(32px, 6vw, 92px);
  background:
    linear-gradient(135deg, rgba(15, 23, 42, 0.4), rgba(8, 47, 73, 0.24)),
    linear-gradient(180deg, rgba(14, 165, 233, 0.18), transparent 44%);
}

.signin-product-grid {
  position: absolute;
  inset: 0;
  background:
    linear-gradient(90deg, rgba(103, 232, 249, 0.12) 1px, transparent 1px),
    linear-gradient(0deg, rgba(103, 232, 249, 0.12) 1px, transparent 1px);
  background-size: 42px 42px;
  mask-image: linear-gradient(90deg, transparent, black 18%, black 86%, transparent);
}

.signin-product-panel::before,
.signin-product-panel::after {
  content: "";
  position: absolute;
  left: 0;
  right: 0;
  height: 1px;
  background: linear-gradient(90deg, transparent, rgba(125, 211, 252, 0.62), transparent);
}

.signin-product-panel::before {
  top: 22%;
}

.signin-product-panel::after {
  bottom: 18%;
}

.signin-dashboard-preview {
  position: relative;
  width: min(100%, 640px);
  border: 1px solid rgba(125, 211, 252, 0.24);
  border-radius: 8px;
  background: rgba(8, 13, 26, 0.72);
  box-shadow:
    0 36px 120px rgba(0, 0, 0, 0.36),
    0 0 0 1px rgba(255, 255, 255, 0.04) inset;
  backdrop-filter: blur(16px);
}

.preview-topbar {
  display: flex;
  gap: 8px;
  padding: 16px 18px;
  border-bottom: 1px solid rgba(148, 163, 184, 0.16);
}

.preview-topbar span {
  width: 8px;
  height: 8px;
  border-radius: 999px;
  background: #475569;
}

.preview-topbar span:first-child {
  background: #22d3ee;
}

.preview-header,
.preview-command,
.preview-metrics,
.preview-flow {
  margin: 22px;
}

.preview-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
}

.preview-header p,
.preview-metrics span {
  margin: 0;
  color: #94a3b8;
  font-size: 12px;
  font-weight: 700;
}

.preview-header strong {
  display: block;
  margin-top: 6px;
  color: #f8fafc;
  font-size: clamp(32px, 4vw, 48px);
  font-weight: 850;
  line-height: 1;
}

.preview-live {
  border: 1px solid rgba(52, 211, 153, 0.38);
  border-radius: 999px;
  padding: 6px 10px;
  color: #86efac;
  font-size: 11px;
  font-weight: 900;
  letter-spacing: 0.12em;
}

.preview-command {
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 54px;
  border: 1px solid rgba(125, 211, 252, 0.2);
  border-radius: 8px;
  padding: 0 16px;
  background: rgba(15, 23, 42, 0.76);
  color: #dbeafe;
  font-size: 14px;
  font-weight: 760;
}

.preview-command :deep(svg) {
  width: 18px;
  height: 18px;
  color: #67e8f9;
}

.preview-rail {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 10px;
  margin: 0 22px 22px;
}

.preview-rail span {
  height: 9px;
  border-radius: 999px;
  background: rgba(71, 85, 105, 0.64);
}

.preview-rail .is-active {
  background: linear-gradient(90deg, #22d3ee, #34d399);
}

.preview-metrics {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
}

.preview-metrics div {
  border: 1px solid rgba(148, 163, 184, 0.14);
  border-radius: 8px;
  padding: 16px;
  background: rgba(15, 23, 42, 0.54);
}

.preview-metrics strong {
  display: block;
  margin-top: 8px;
  color: #f8fafc;
  font-size: 28px;
  font-weight: 850;
}

.preview-flow {
  display: grid;
  gap: 10px;
  padding-bottom: 12px;
}

.preview-flow span {
  height: 12px;
  border-radius: 999px;
  background: linear-gradient(90deg, rgba(56, 189, 248, 0.48), rgba(15, 23, 42, 0.2));
}

.preview-flow span:nth-child(2) {
  width: 82%;
}

.preview-flow span:nth-child(3) {
  width: 58%;
}

@media (max-width: 1023px) {
  .signin-shell {
    grid-template-columns: 1fr;
  }

  .signin-auth-panel {
    border-right: 0;
  }

  .signin-product-panel {
    display: none;
  }
}

@media (max-width: 640px) {
  .signin-auth-panel {
    align-items: flex-start;
    padding: 28px 18px;
  }

  .signin-brand {
    margin-bottom: 34px;
  }

  .signin-copy {
    margin-bottom: 22px;
  }

  .signin-copy h2 {
    font-size: 30px;
    line-height: 1.18;
  }

  .signin-card {
    padding: 22px;
  }

  .signin-form-title {
    font-size: 24px;
  }

  .signin-field :deep(input) {
    font-size: 15px;
  }
}
</style>
