/** Godモード UI を表示できる組織コード（中村海産） */
export const GOD_MODE_ORGANIZATION_CODE = "NAKAMURA";

/**
 * 組織コードが Godモード利用可能か判定する。
 * SaaS オンボーディング用の内部機能のため、中村海産組織のアカウントのみ許可。
 */
export function canAccessGodMode(
  organizationCode: string | null | undefined,
): boolean {
  if (!organizationCode) return false;
  return (
    organizationCode.toUpperCase() === GOD_MODE_ORGANIZATION_CODE.toUpperCase()
  );
}

/**
 * 現在ログイン中ユーザーの Godモードアクセス可否。
 */
export function useGodModeAccess() {
  const adminUserStore = useAdminUserStore();
  const organizationStore = useOrganizationStore();

  const operatorOrganizationCode = computed(() => {
    const fromClaims = (
      adminUserStore.currentUserClaimsInfo as { organizationCode?: string }
    )?.organizationCode;
    if (fromClaims) return fromClaims;
    return organizationStore.loggedInOrganizationInfo?.code ?? null;
  });

  const canAccess = computed(() =>
    canAccessGodMode(operatorOrganizationCode.value),
  );

  return {
    operatorOrganizationCode,
    canAccess,
    organizationCode: GOD_MODE_ORGANIZATION_CODE,
  };
}
