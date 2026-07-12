/**
 * ADK セッション API / invoke で必須の organizationId + spaceId を解決する.
 */
export interface AdkSessionScope {
  organizationId: string;
  spaceId: string;
}

export const resolveAdkSessionScope = (): AdkSessionScope => {
  const organizationStore = useOrganizationStore();
  const spaceStore = useSpaceStore();
  const adminUserStore = useAdminUserStore();

  const organizationId = (
    organizationStore.getLoggedInOrganizationId ||
    organizationStore.loggedInOrganizationInfo?.id ||
    adminUserStore.currentOrganizationId ||
    ""
  ).trim();

  let spaceId = (spaceStore.selectedSpace?.id ?? "").trim();
  if (!spaceId && import.meta.client) {
    const saved = localStorage.getItem("selectedSpaceId");
    if (saved?.trim()) {
      spaceId = saved.trim();
    }
  }

  if (!organizationId || !spaceId) {
    throw new Error(
      "組織またはスペースが未選択です。画面上部でスペースを選んでから再度お試しください。"
    );
  }

  return { organizationId, spaceId };
};

export const tryResolveAdkSessionScope = (): AdkSessionScope | null => {
  try {
    return resolveAdkSessionScope();
  } catch {
    return null;
  }
};

export const buildAdkSessionScopeQuery = (scope: AdkSessionScope): string =>
  `organizationId=${encodeURIComponent(scope.organizationId)}&spaceId=${encodeURIComponent(scope.spaceId)}`;
