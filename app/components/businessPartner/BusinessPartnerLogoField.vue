<template>
  <div class="space-y-4">
    <div
      class="flex flex-col gap-4 sm:flex-row sm:items-start"
    >
      <div
        class="relative mx-auto sm:mx-0 flex h-32 w-32 shrink-0 items-center justify-center overflow-hidden rounded-2xl border-2 border-slate-200 bg-gradient-to-br from-slate-50 to-slate-100 shadow-inner"
      >
        <img
          v-if="previewUrl && !previewFailed"
          :src="previewUrl"
          :alt="`${name || '取引先'} ロゴ`"
          class="h-full w-full object-contain p-2"
          referrerpolicy="no-referrer"
          @error="previewFailed = true"
        />
        <UIcon
          v-else
          :name="placeholderIcon"
          class="h-12 w-12 text-purple-400"
        />
      </div>

      <div class="min-w-0 flex-1 space-y-3">
        <p class="text-sm text-slate-600 leading-relaxed">
          会社HPの取得時にロゴが見つかれば自動でセットされます。別画像を使う場合はアップロードするか、画像URLを直接入力してください。
        </p>

        <div class="flex flex-wrap gap-2">
          <EnButton
            variant="outline"
            color="neutral"
            size="sm"
            leading-icon="i-heroicons-arrow-up-tray"
            :loading="isUploading"
            @click="fileInputRef?.click()"
          >
            画像をアップロード
          </EnButton>
          <EnButton
            v-if="showRestoreAutoLogo"
            variant="soft"
            color="primary"
            size="sm"
            leading-icon="i-heroicons-sparkles"
            @click="applyAutoFetched"
          >
            自動取得ロゴを使う
          </EnButton>
        </div>

        <input
          ref="fileInputRef"
          type="file"
          accept="image/*"
          class="hidden"
          @change="onFileSelected"
        >

        <UFormField label="ロゴ画像 URL（任意）" hint="https:// で始まる画像の直リンク">
          <UInput
            :model-value="logoUrl"
            placeholder="https://example.com/logo.png"
            size="lg"
            @update:model-value="onLogoUrlInput"
          />
        </UFormField>

        <p v-if="uploadedFileName" class="text-xs text-emerald-700">
          アップロード済み: {{ uploadedFileName }}
        </p>
        <EnAlert
          v-if="uploadError"
          color="error"
          :title="uploadError"
          icon="i-heroicons-exclamation-triangle"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { resolvePartnerBrandImageUrl } from "@utils/partnerBrandImage";

const props = withDefaults(
  defineProps<{
    name?: string;
    logoUrl: string;
    imageUrl: string;
    faviconUrl: string;
    autoFetchedUrl?: string;
    placeholderIcon?: string;
    partnerId?: string;
  }>(),
  {
    name: "",
    autoFetchedUrl: "",
    placeholderIcon: "i-heroicons-building-office-2",
    partnerId: "",
  }
);

const emit = defineEmits<{
  "update:logoUrl": [value: string];
  "update:imageUrl": [value: string];
  "update:faviconUrl": [value: string];
  "pending-file": [file: File | null];
}>();

const { uploadLogoFile } = useBusinessPartnerLogoUpload();
const toast = useToast();

const fileInputRef = ref<HTMLInputElement | null>(null);
const previewFailed = ref(false);
const isUploading = ref(false);
const uploadError = ref("");
const uploadedFileName = ref("");
const pendingLocalPreview = ref("");

const previewUrl = computed(() => {
  if (pendingLocalPreview.value) return pendingLocalPreview.value;
  return (
    resolvePartnerBrandImageUrl({
      logoUrl: props.logoUrl,
      imageUrl: props.imageUrl,
      faviconUrl: props.faviconUrl,
    }) || ""
  );
});

watch(previewUrl, () => {
  previewFailed.value = false;
});

const showRestoreAutoLogo = computed(() => {
  const auto = props.autoFetchedUrl?.trim();
  if (!auto) return false;
  return auto !== previewUrl.value;
});

const applyAutoFetched = (): void => {
  if (!props.autoFetchedUrl) return;
  const url = props.autoFetchedUrl.trim();
  emit("update:logoUrl", url);
  emit("update:imageUrl", url);
  pendingLocalPreview.value = "";
  emit("pending-file", null);
  uploadedFileName.value = "";
};

const onLogoUrlInput = (value: string): void => {
  emit("update:logoUrl", value);
  emit("update:imageUrl", value.trim());
  pendingLocalPreview.value = "";
  emit("pending-file", null);
  uploadedFileName.value = "";
};

const onFileSelected = async (event: Event): Promise<void> => {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = "";
  if (!file) return;

  if (!file.type.startsWith("image/")) {
    uploadError.value = "画像ファイルを選択してください";
    return;
  }

  uploadError.value = "";
  pendingLocalPreview.value = URL.createObjectURL(file);
  emit("pending-file", file);
  uploadedFileName.value = file.name;

  if (!props.partnerId) return;

  isUploading.value = true;
  try {
    const url = await uploadLogoFile({
      partnerId: props.partnerId,
      file,
    });
    if (!url) {
      uploadError.value = "アップロードに失敗しました";
      return;
    }
    emit("update:logoUrl", url);
    emit("update:imageUrl", url);
    emit("update:faviconUrl", "");
    emit("pending-file", null);
    toast.add({ title: "ロゴをアップロードしました", color: "success" });
  } finally {
    isUploading.value = false;
  }
};

onUnmounted(() => {
  if (pendingLocalPreview.value.startsWith("blob:")) {
    URL.revokeObjectURL(pendingLocalPreview.value);
  }
});
</script>
