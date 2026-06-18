import {
  KNOWN_WEB_CRAWL_STEPS,
  type WebCrawlProgress,
  type WebCrawlStepsById,
  type WebCrawlUiFlow,
} from "@models/webCrawlRequest";
import { createEmptyWebCrawlProgress } from "@utils/webCrawlSession";

export type InitialWebCrawlRequestSeed = {
  steps: WebCrawlStepsById;
  progress: WebCrawlProgress;
  uiFlow: WebCrawlUiFlow;
};

function buildPendingStepsMap(): WebCrawlStepsById {
  const steps: NonNullable<WebCrawlStepsById> = {};
  for (const id of KNOWN_WEB_CRAWL_STEPS) {
    steps[id] = {
      id,
      status: "pending",
      attempts: 0,
    };
  }
  return steps;
}

function buildUiFlow(): WebCrawlUiFlow {
  const nodes = KNOWN_WEB_CRAWL_STEPS.map((id, index) => ({
    id,
    type: "jobFlow",
    position: { x: index * 180, y: 0 },
    data: {
      kind: "step",
      label: id,
      stepId: id,
    },
  }));
  const edges = KNOWN_WEB_CRAWL_STEPS.slice(0, -1).map((id, index) => {
    const next = KNOWN_WEB_CRAWL_STEPS[index + 1];
    return {
      id: `${id}-${next}`,
      source: id,
      target: next,
      dashed: false,
    };
  });
  return { version: 1, nodes, edges };
}

export function buildInitialWebCrawlRequestSeed(): InitialWebCrawlRequestSeed {
  return {
    steps: buildPendingStepsMap(),
    progress: {
      ...createEmptyWebCrawlProgress(),
      currentStep: "loadInput",
    },
    uiFlow: buildUiFlow(),
  };
}
