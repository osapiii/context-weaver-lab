import {
  initDatadogObservability,
  startDatadogView,
} from "@utils/datadogObservability";

const toOrigin = (url: unknown): string | null => {
  if (typeof url !== "string" || !url.trim()) return null;

  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
};

type DatadogRoute = {
  name?: string | symbol | null;
  path: string;
  fullPath: string;
};

const resolveViewName = (route: DatadogRoute): string =>
  route.name ? String(route.name) : route.path;

export default defineNuxtPlugin(async () => {
  const config = useRuntimeConfig();
  const router = useRouter();
  const publicConfig = config.public;

  const serviceOrigins = [
    publicConfig.driveToGcsSyncServiceUrl,
    publicConfig.googleDriveWorkflowKickerServiceUrl,
    publicConfig.webCrawlWorkflowKickerServiceUrl,
    publicConfig.researchAgentServiceUrl,
    publicConfig.dataAnalystServiceUrl,
    publicConfig.enAiStudioAdkBaseUrl,
    publicConfig.enAiStudioAdkWritingUrl,
    publicConfig.enAiStudioAdkSheetUrl,
    publicConfig.enAiStudioAdkImageUrl,
    publicConfig.enAiStudioAdkConsultationUrl,
  ];

  const allowedTracingUrls = Array.from(
    new Set([
      window.location.origin,
      "http://localhost:3000",
      "http://localhost:4000",
      "http://127.0.0.1:3000",
      "http://127.0.0.1:4000",
      ...serviceOrigins
        .map(toOrigin)
        .filter((origin): origin is string => !!origin),
    ])
  );

  await initDatadogObservability({
    datadog: publicConfig.datadog,
    allowedTracingUrls,
  });

  startDatadogView({
    name: resolveViewName(router.currentRoute.value),
    path: router.currentRoute.value.path,
    fullPath: router.currentRoute.value.fullPath,
  });

  router.afterEach((to) => {
    startDatadogView({
      name: resolveViewName(to),
      path: to.path,
      fullPath: to.fullPath,
    });
  });
});
