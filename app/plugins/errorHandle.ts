import log from "@utils/logger";
import { reportDatadogError } from "@utils/datadogObservability";

const resolveComponentName = (instance: unknown): string | undefined => {
  if (!instance || typeof instance !== "object") return undefined;
  const component = instance as { $options?: { name?: string } };
  return component.$options?.name;
};

const isNotFoundNavigationError = (error: unknown): boolean => {
  if (!error || typeof error !== "object") return false;
  const maybeError = error as { statusCode?: unknown; message?: unknown };
  return (
    maybeError.statusCode === 404 ||
    (typeof maybeError.message === "string" &&
      maybeError.message.startsWith("Page not found:"))
  );
};

export default defineNuxtPlugin((nuxtApp) => {
  nuxtApp.vueApp.config.errorHandler = (error, instance, info) => {
    if (isNotFoundNavigationError(error)) return;
    const component = resolveComponentName(instance);
    log("ERROR", error, { source: "vue:errorHandler", info, component });
    reportDatadogError(error, {
      source: "vue:errorHandler",
      info,
      component,
    });
  };

  // Also possible
  nuxtApp.hook("vue:error", (error, instance, info) => {
    if (isNotFoundNavigationError(error)) return;
    const component = resolveComponentName(instance);
    log("ERROR", error, { source: "nuxt:vue:error", info, component });
    reportDatadogError(error, {
      source: "nuxt:vue:error",
      info,
      component,
    });
  });

  nuxtApp.hook("app:error", (error) => {
    if (isNotFoundNavigationError(error)) return;
    log("ERROR", error);
    reportDatadogError(error, {
      source: "nuxt:app:error",
    });
  });
});
