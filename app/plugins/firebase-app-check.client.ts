import {
  ReCaptchaEnterpriseProvider,
  initializeAppCheck,
} from "firebase/app-check";
import { getApp } from "firebase/app";

export default defineNuxtPlugin(() => {
  const config = useRuntimeConfig();
  const siteKey = String(
    config.public.firebaseAppCheckRecaptchaEnterpriseSiteKey || ""
  ).trim();
  if (!siteKey) return;

  initializeAppCheck(getApp(), {
    provider: new ReCaptchaEnterpriseProvider(siteKey),
    isTokenAutoRefreshEnabled: true,
  });
});
