/**
 * アプリ外観 (ロゴ / AI アバター) のリアクティブな解決。
 *
 * 組織の branding 設定が無ければ EN AIstudio デフォルト値を返す。
 *
 * - `hasCustomLogo` が true なら ヘッダーは "EN AIstudio" 文字を隠してロゴ画像を出す
 * - `aiAvatarUrl` は AI 部下系コンポーネント (チャット / 経営相談 / マスター編集 / AI コンパニオン)
 *   が共通で参照する。未設定なら ENOSTECH Violet アバター。
 */

const DEFAULT_AI_AVATAR_URL = "/en-ai-avatar-violet.png";

export const useAppAppearance = () => {
  const organization = useOrganizationStore();

  const branding = computed(
    () => organization.loggedInOrganizationInfo.branding ?? {}
  );

  const logoUrl = computed(() => branding.value.logoUrl ?? "");
  const hasCustomLogo = computed(() => !!logoUrl.value);

  const aiAvatarUrl = computed(
    () => branding.value.aiAvatarUrl || DEFAULT_AI_AVATAR_URL
  );
  const hasCustomAiAvatar = computed(() => !!branding.value.aiAvatarUrl);

  return {
    logoUrl,
    hasCustomLogo,
    aiAvatarUrl,
    hasCustomAiAvatar,
    defaultAiAvatarUrl: DEFAULT_AI_AVATAR_URL,
  };
};
