/**
 * 起動時 + 組織情報更新時に、保存済みの色テーマを Nuxt UI に反映する。
 *
 * organizations.branding.colorThemeId が未設定なら DEFAULT_COLOR_THEME_ID で初期化。
 * 別ブラウザで管理者がテーマを切り替えた場合も watch 経由で追従する。
 */
import {
  useColorTheme,
  DEFAULT_COLOR_THEME_ID,
  type ColorThemePresetId,
} from "~/composables/useColorTheme";

export default defineNuxtPlugin(() => {
  const organization = useOrganizationStore();
  const { applyTheme } = useColorTheme();

  watch(
    () => organization.loggedInOrganizationInfo.branding?.colorThemeId,
    (id) => {
      applyTheme((id as ColorThemePresetId) ?? DEFAULT_COLOR_THEME_ID);
    },
    { immediate: true }
  );
});
