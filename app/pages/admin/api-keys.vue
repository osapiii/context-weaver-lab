<template>
  <div class="w-full space-y-6">
    <AdminModePageNav current-page-label="API キー" />
    <header class="space-y-1">
      <h1 class="text-2xl font-semibold tracking-tight">API キーの登録</h1>
      <p class="text-sm text-neutral-500">
        VibeControl の AI 連携を使うために必要な、あなた自身の API キーを登録します。
        キーは VibeControl の他のユーザーからは見えません。
      </p>
    </header>

    <section class="rounded-lg border border-neutral-200 bg-white p-6 shadow-sm">
      <div class="mb-4 flex items-center gap-2">
        <Icon
          name="material-symbols:key"
          class="text-purple-500"
          size="20"
        />
        <h2 class="text-lg font-semibold">Gemini API キー</h2>
      </div>

      <p class="mb-4 text-sm leading-relaxed text-neutral-600">
        Google AI Studio (<a
          href="https://aistudio.google.com/apikey"
          target="_blank"
          rel="noopener"
          class="text-purple-600 underline hover:text-purple-700"
        >aistudio.google.com/apikey</a>) で発行した API キーを貼り付けてください。
        VibeControl の AI 連携など、ブラウザから Gemini を使う機能はこのキーで動きます。
      </p>

      <div v-if="loading" class="text-sm text-neutral-500">読み込み中…</div>

      <div v-else class="space-y-4">
        <div v-if="hasKey" class="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          ✓ 登録済み ({{ maskedKey }})
          <span v-if="updatedAt" class="ml-2 text-emerald-600/70">
            最終更新: {{ formatTs(updatedAt) }}
          </span>
        </div>
        <div v-else class="rounded-md bg-purple-50 px-3 py-2 text-sm text-purple-800">
          ⚠️ まだ登録されていません。AI 機能を使う前に登録してください。
        </div>

        <UFormField
          label="新しい API キー"
          :required="!hasKey"
          help="プレフィックス AIzaSy 〜 から始まる Gemini API キー"
        >
          <UInput
            v-model="newKey"
            type="text"
            :placeholder="hasKey ? '（更新する場合のみ入力）' : 'AIzaSy…'"
            class="w-full font-mono"
          />
        </UFormField>

        <div class="flex flex-wrap gap-2">
          <EButton
            label="保存"
            color="primary"
            size="md"
            icon="material-symbols:save"
            :disabled="!newKey || saving"
            @click="save"
          />
          <EButton
            v-if="hasKey"
            label="削除"
            color="neutral"
            size="md"
            icon="material-symbols:delete-outline"
            :disabled="saving"
            @click="confirmRemove"
          />
        </div>

        <div v-if="lastError" class="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">
          ⚠️ {{ lastError }}
        </div>
        <div v-if="lastSuccess" class="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          ✓ {{ lastSuccess }}
        </div>
      </div>
    </section>

    <section class="rounded-lg border border-purple-200 bg-purple-50/50 p-6">
      <div class="mb-2 flex items-center gap-2">
        <Icon
          name="material-symbols:monitoring"
          class="text-purple-600"
          size="20"
        />
        <h3 class="text-base font-semibold text-neutral-800">
          利用状況と課金額の確認
        </h3>
      </div>
      <p class="mb-4 text-xs leading-relaxed text-neutral-600">
        VibeControl はあなたの API キーを「使う」だけで、課金は Google アカウントに直接発生します。
        現在の利用状況や月額、上限設定の管理は <strong>Google AI Studio</strong> で確認してください。
      </p>
      <div class="flex flex-wrap gap-2">
        <a
          href="https://aistudio.google.com/apikey"
          target="_blank"
          rel="noopener noreferrer"
          class="inline-flex items-center gap-1.5 rounded-md bg-purple-500 px-3 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-purple-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-400"
        >
          <Icon name="material-symbols:open-in-new" size="16" />
          AI Studio で利用状況を見る
        </a>
        <a
          href="https://console.cloud.google.com/billing"
          target="_blank"
          rel="noopener noreferrer"
          class="inline-flex items-center gap-1.5 rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm font-medium text-neutral-700 shadow-sm transition hover:border-neutral-400 hover:bg-neutral-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-300"
        >
          <Icon name="material-symbols:credit-card-outline" size="16" />
          Cloud Console で課金詳細を見る
        </a>
      </div>
    </section>

    <section class="rounded-lg border border-neutral-200 bg-neutral-50 p-6">
      <h3 class="mb-2 text-sm font-semibold">セキュリティについて</h3>
      <ul class="space-y-1 text-xs leading-relaxed text-neutral-600">
        <li>・ API キーは Firestore の `users/{あなたの uid}/secrets/geminiApiKey` に保存され、Firestore ルールで本人のみ R/W 可能です。</li>
        <li>・ AI 機能を実行中、サーバ側で一時的にあなたのキーを読み出し、Gemini API への問い合わせに使います。</li>
        <li>・ キーの利用料金はあなたの Google Cloud / AI Studio アカウントに直接請求されます。</li>
        <li>・ VibeControl の利用をやめる / キーが流出した場合は、このページから削除してください。</li>
      </ul>
    </section>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from "vue";
import { getAuth } from "firebase/auth";
import {
  doc,
  getDoc,
  getFirestore,
  setDoc,
  deleteDoc,
  serverTimestamp,
} from "firebase/firestore";
import type { Timestamp } from "firebase/firestore";

definePageMeta({
  layout: "admin",
  adminPageStack: false,
});

const loading = ref(true);
const saving = ref(false);
const hasKey = ref(false);
const maskedKey = ref("");
const updatedAt = ref<Date | null>(null);
const newKey = ref("");
const lastError = ref<string | null>(null);
const lastSuccess = ref<string | null>(null);

const _uid = () => {
  const u = getAuth().currentUser;
  if (!u) throw new Error("ログインしていません");
  return u.uid;
};

const _docRef = () =>
  doc(getFirestore(), "users", _uid(), "secrets", "geminiApiKey");

const load = async () => {
  loading.value = true;
  lastError.value = null;
  try {
    const snap = await getDoc(_docRef());
    if (snap.exists()) {
      const data = snap.data() as { apiKey?: string; updatedAt?: Timestamp };
      const k = data.apiKey ?? "";
      hasKey.value = !!k;
      maskedKey.value = k ? `${k.slice(0, 6)}…${k.slice(-4)}` : "";
      updatedAt.value = data.updatedAt?.toDate?.() ?? null;
    } else {
      hasKey.value = false;
      maskedKey.value = "";
      updatedAt.value = null;
    }
  } catch (e) {
    lastError.value = e instanceof Error ? e.message : String(e);
  } finally {
    loading.value = false;
  }
};

const save = async () => {
  if (!newKey.value) return;
  saving.value = true;
  lastError.value = null;
  lastSuccess.value = null;
  try {
    const key = newKey.value.trim();
    if (!key.startsWith("AIza")) {
      throw new Error('Gemini API キーは通常 "AIza" から始まります。コピペ漏れが無いか確認してください。');
    }
    await setDoc(
      _docRef(),
      { apiKey: key, updatedAt: serverTimestamp() },
      { merge: true },
    );
    newKey.value = "";
    lastSuccess.value = "API キーを保存しました";
    await load();
    await useGeminiByokStore().refreshUserApiKey();
    useEnAiStudioAssistantStore().clearUserApiKeyCache();
  } catch (e) {
    lastError.value = e instanceof Error ? e.message : String(e);
  } finally {
    saving.value = false;
  }
};

const confirmRemove = async () => {
  if (!confirm("API キーを削除します。AI 機能が使えなくなりますがよろしいですか?")) return;
  saving.value = true;
  lastError.value = null;
  lastSuccess.value = null;
  try {
    await deleteDoc(_docRef());
    lastSuccess.value = "API キーを削除しました";
    await load();
    await useGeminiByokStore().refreshUserApiKey();
    useEnAiStudioAssistantStore().clearUserApiKeyCache();
  } catch (e) {
    lastError.value = e instanceof Error ? e.message : String(e);
  } finally {
    saving.value = false;
  }
};

const formatTs = (d: Date) =>
  new Intl.DateTimeFormat("ja-JP", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(d);

onMounted(load);
</script>
