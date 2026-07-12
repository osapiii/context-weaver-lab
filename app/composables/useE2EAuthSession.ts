import { getApp } from "firebase/app";
import { getFunctions, httpsCallable } from "firebase/functions";

const FUNCTIONS_REGION = "asia-northeast1";

export type E2EAuthSessionStatus = {
  configured: boolean;
  secretId?: string;
  updatedAt?: string | null;
  cookieCount?: number;
  originCount?: number;
};

type StatusRequest = {
  organizationId: string;
  applicationId: string;
};

type SaveRequest = StatusRequest & {
  storageStateJson: string;
};

type BrowserSessionRequest = StatusRequest & {
  entryUrl: string;
};

type BrowserSessionResponse = {
  url: string;
  expiresAt: number;
};

const sharedStatusByApplicationId = ref<Record<string, E2EAuthSessionStatus>>({});
const sharedLoadingByApplicationId = ref<Record<string, boolean>>({});

const functions = () => getFunctions(getApp(), FUNCTIONS_REGION);

export function useE2EAuthSession() {
  const statusByApplicationId = sharedStatusByApplicationId;
  const loadingByApplicationId = sharedLoadingByApplicationId;

  const setLoading = (applicationId: string, loading: boolean): void => {
    loadingByApplicationId.value = {
      ...loadingByApplicationId.value,
      [applicationId]: loading,
    };
  };

  const refreshStatus = async (
    request: StatusRequest
  ): Promise<E2EAuthSessionStatus> => {
    if (!request.organizationId || !request.applicationId) {
      return { configured: false };
    }
    setLoading(request.applicationId, true);
    try {
      const callable = httpsCallable<StatusRequest, E2EAuthSessionStatus>(
        functions(),
        "get_e2e_auth_session_status"
      );
      const result = await callable(request);
      statusByApplicationId.value = {
        ...statusByApplicationId.value,
        [request.applicationId]: result.data,
      };
      return result.data;
    } finally {
      setLoading(request.applicationId, false);
    }
  };

  const saveState = async (
    request: SaveRequest
  ): Promise<E2EAuthSessionStatus> => {
    setLoading(request.applicationId, true);
    try {
      const callable = httpsCallable<SaveRequest, E2EAuthSessionStatus>(
        functions(),
        "save_e2e_auth_session_state"
      );
      const result = await callable(request);
      statusByApplicationId.value = {
        ...statusByApplicationId.value,
        [request.applicationId]: result.data,
      };
      return result.data;
    } finally {
      setLoading(request.applicationId, false);
    }
  };

  const deleteState = async (
    request: StatusRequest
  ): Promise<E2EAuthSessionStatus> => {
    setLoading(request.applicationId, true);
    try {
      const callable = httpsCallable<StatusRequest, E2EAuthSessionStatus>(
        functions(),
        "delete_e2e_auth_session_state"
      );
      const result = await callable(request);
      statusByApplicationId.value = {
        ...statusByApplicationId.value,
        [request.applicationId]: result.data,
      };
      return result.data;
    } finally {
      setLoading(request.applicationId, false);
    }
  };

  const createBrowserSession = async (
    request: BrowserSessionRequest
  ): Promise<BrowserSessionResponse> => {
    setLoading(request.applicationId, true);
    try {
      const callable = httpsCallable<BrowserSessionRequest, BrowserSessionResponse>(
        functions(),
        "create_e2e_auth_browser_session"
      );
      const result = await callable(request);
      return result.data;
    } finally {
      setLoading(request.applicationId, false);
    }
  };

  return {
    statusByApplicationId,
    loadingByApplicationId,
    refreshStatus,
    saveState,
    deleteState,
    createBrowserSession,
  };
}
