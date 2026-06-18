import type { User } from "firebase/auth";
import type { decodedOrganizationSchema } from "@models/Organization";
import type { Space } from "@models/space";
import log from "@utils/logger";

type DatadogPublicConfig = {
  applicationId?: string;
  clientToken?: string;
  site?: string;
  service?: string;
  env?: string;
  version?: string;
};

type DatadogInitParams = {
  datadog: DatadogPublicConfig;
  allowedTracingUrls: Array<string | RegExp>;
};

type AuthenticatedDatadogContext = {
  user: User;
  claims?: Record<string, unknown>;
  organization?: Partial<decodedOrganizationSchema>;
  space?: Space | null;
};

type DatadogErrorContext = Record<string, unknown>;
type DatadogBeforeSendEvent = {
  type?: string;
  error?: {
    message?: string;
    source?: string;
  };
};

declare global {
  interface Window {
    __EN_AISTUDIO_DATADOG_INITIALIZED__?: boolean;
  }
}

const DATADOG_CONTEXT_KEYS = [
  "firebaseUid",
  "userEmail",
  "organizationId",
  "organizationCode",
  "organizationName",
  "rbacRole",
  "spaceId",
  "spaceName",
  "selectedSpaceId",
  "selectedSpaceName",
];

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

const isDatadogObservabilityActive = (): boolean =>
  import.meta.client && window.__EN_AISTUDIO_DATADOG_INITIALIZED__ === true;

const compactObject = <T extends Record<string, unknown>>(value: T): T => {
  const entries = Object.entries(value).filter(([, entryValue]) => {
    if (entryValue === null || entryValue === undefined) return false;
    if (typeof entryValue === "string") return entryValue.trim().length > 0;
    return true;
  });
  return Object.fromEntries(entries) as T;
};

const shouldSendDatadogEvent = (event: DatadogBeforeSendEvent): boolean => {
  const message = event.error?.message ?? "";
  if (!message) return true;
  if (message.startsWith("Page not found:")) return false;
  if (
    message.includes(
      "[nuxt] error caught during app initialization Error: Page not found:"
    )
  ) {
    return false;
  }
  if (message.includes("[vite] Failed to reload")) return false;
  return true;
};

export const initDatadogObservability = async ({
  datadog,
  allowedTracingUrls,
}: DatadogInitParams): Promise<void> => {
  if (!import.meta.client) return;

  const applicationId = datadog.applicationId?.trim();
  const clientToken = datadog.clientToken?.trim();

  if (!applicationId || !clientToken) {
    log(
      "WARN",
      "Datadog RUM is disabled: NUXT_PUBLIC_DATADOG_APPLICATIONID and NUXT_PUBLIC_DATADOG_CLIENTTOKEN are required."
    );
    return;
  }

  if (window.__EN_AISTUDIO_DATADOG_INITIALIZED__) return;

  const [{ datadogRum }, { datadogLogs }] = await Promise.all([
    import("@datadog/browser-rum"),
    import("@datadog/browser-logs"),
  ]);

  const baseConfig = compactObject({
    clientToken,
    site: datadog.site?.trim() || "ap1.datadoghq.com",
    service: datadog.service?.trim() || "en-aistudio-frontend",
    env: datadog.env?.trim() || "development",
    version: datadog.version?.trim(),
    sessionSampleRate: 100,
    storeContextsAcrossPages: true,
    silentMultipleInit: true,
  });

  datadogRum.init({
    ...baseConfig,
    applicationId,
    sessionReplaySampleRate: 100,
    defaultPrivacyLevel: "allow",
    trackUserInteractions: true,
    trackResources: true,
    trackLongTasks: true,
    allowedTracingUrls,
    beforeSend: shouldSendDatadogEvent,
  });

  datadogRum.startSessionReplayRecording({ force: true });

  datadogLogs.init({
    ...baseConfig,
    forwardErrorsToLogs: true,
    forwardConsoleLogs: ["error", "warn"],
    beforeSend: shouldSendDatadogEvent,
  });

  window.__EN_AISTUDIO_DATADOG_INITIALIZED__ = true;
};

export const reportDatadogError = (
  error: unknown,
  context: DatadogErrorContext = {}
): void => {
  if (!isDatadogObservabilityActive()) return;

  void Promise.all([
    import("@datadog/browser-rum"),
    import("@datadog/browser-logs"),
  ]).then(([{ datadogRum }, { datadogLogs }]) => {
    datadogRum.addError(error, context);

    const errorInstance =
      error instanceof Error ? error : new Error(String(error));
    datadogLogs.logger.error(
      errorInstance.message || "Unhandled frontend error",
      context,
      errorInstance
    );
  });
};

export const syncDatadogAuthenticatedContext = ({
  user,
  claims = {},
  organization,
  space,
}: AuthenticatedDatadogContext): void => {
  if (!isDatadogObservabilityActive()) return;

  const organizationId =
    organization?.id ||
    (isNonEmptyString(claims.organizationId) ? claims.organizationId : "");
  const organizationCode =
    organization?.code ||
    (isNonEmptyString(claims.organizationCode) ? claims.organizationCode : "");
  const rbacRole = claims.rbacRole;

  const datadogUser = compactObject({
    id: user.uid,
    email: user.email ?? undefined,
    name: user.displayName ?? undefined,
    organizationId,
    organizationCode,
    organizationName: organization?.name,
    rbacRole,
    spaceId: space?.id,
    spaceName: space?.name,
    selectedSpaceId: space?.id,
    selectedSpaceName: space?.name,
  });

  const globalContext = compactObject({
    firebaseUid: user.uid,
    userEmail: user.email ?? undefined,
    organizationId,
    organizationCode,
    organizationName: organization?.name,
    rbacRole,
    spaceId: space?.id,
    spaceName: space?.name,
    selectedSpaceId: space?.id,
    selectedSpaceName: space?.name,
  });

  void Promise.all([
    import("@datadog/browser-rum"),
    import("@datadog/browser-logs"),
  ]).then(([{ datadogRum }, { datadogLogs }]) => {
    datadogRum.setUser(datadogUser);
    datadogLogs.setUser(datadogUser);

    for (const [key, value] of Object.entries(globalContext)) {
      datadogRum.setGlobalContextProperty(key, value);
      datadogLogs.setGlobalContextProperty(key, value);
    }
  });
};

export const syncDatadogSpaceContext = (space: Space | null): void => {
  if (!isDatadogObservabilityActive()) return;

  void Promise.all([
    import("@datadog/browser-rum"),
    import("@datadog/browser-logs"),
  ]).then(([{ datadogRum }, { datadogLogs }]) => {
    if (!space) {
      datadogRum.removeGlobalContextProperty("spaceId");
      datadogRum.removeGlobalContextProperty("spaceName");
      datadogRum.removeGlobalContextProperty("selectedSpaceId");
      datadogRum.removeGlobalContextProperty("selectedSpaceName");
      datadogLogs.removeGlobalContextProperty("spaceId");
      datadogLogs.removeGlobalContextProperty("spaceName");
      datadogLogs.removeGlobalContextProperty("selectedSpaceId");
      datadogLogs.removeGlobalContextProperty("selectedSpaceName");
      datadogRum.removeUserProperty("spaceId");
      datadogRum.removeUserProperty("spaceName");
      datadogRum.removeUserProperty("selectedSpaceId");
      datadogRum.removeUserProperty("selectedSpaceName");
      datadogLogs.removeUserProperty("spaceId");
      datadogLogs.removeUserProperty("spaceName");
      datadogLogs.removeUserProperty("selectedSpaceId");
      datadogLogs.removeUserProperty("selectedSpaceName");
      return;
    }

    datadogRum.setGlobalContextProperty("spaceId", space.id);
    datadogRum.setGlobalContextProperty("spaceName", space.name);
    datadogRum.setGlobalContextProperty("selectedSpaceId", space.id);
    datadogRum.setGlobalContextProperty("selectedSpaceName", space.name);
    datadogLogs.setGlobalContextProperty("spaceId", space.id);
    datadogLogs.setGlobalContextProperty("spaceName", space.name);
    datadogLogs.setGlobalContextProperty("selectedSpaceId", space.id);
    datadogLogs.setGlobalContextProperty("selectedSpaceName", space.name);
    datadogRum.setUserProperty("spaceId", space.id);
    datadogRum.setUserProperty("spaceName", space.name);
    datadogRum.setUserProperty("selectedSpaceId", space.id);
    datadogRum.setUserProperty("selectedSpaceName", space.name);
    datadogLogs.setUserProperty("spaceId", space.id);
    datadogLogs.setUserProperty("spaceName", space.name);
    datadogLogs.setUserProperty("selectedSpaceId", space.id);
    datadogLogs.setUserProperty("selectedSpaceName", space.name);
  });
};

export const clearDatadogUserContext = (): void => {
  if (!isDatadogObservabilityActive()) return;

  void Promise.all([
    import("@datadog/browser-rum"),
    import("@datadog/browser-logs"),
  ]).then(([{ datadogRum }, { datadogLogs }]) => {
    datadogRum.clearUser();
    datadogLogs.clearUser();

    for (const key of DATADOG_CONTEXT_KEYS) {
      datadogRum.removeGlobalContextProperty(key);
      datadogLogs.removeGlobalContextProperty(key);
    }
  });
};
