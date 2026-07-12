import { WEB_CRAWL_WORKFLOW_KICKER_URL } from "@constants/webCrawlServices";

export function getWebCrawlWorkflowKickerUrl(): string {
  const fromConfig = useRuntimeConfig().public.webCrawlWorkflowKickerServiceUrl;
  return (fromConfig || WEB_CRAWL_WORKFLOW_KICKER_URL).replace(/\/$/, "");
}
