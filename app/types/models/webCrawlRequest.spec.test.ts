import { describe, expect, it } from "vitest";
import { Timestamp } from "firebase/firestore";
import { DecodedWebCrawlRequestSchema } from "./webCrawlRequest";

const baseRequest = {
  id: "webCrawl_test",
  input: {
    url: "https://example.com",
    bucketName: "test-bucket",
    folderPath: "webCrawl/test",
    maxDepth: 1,
    maxUrls: 10,
    fileSpaceId: "file-space",
    includeImages: true,
  },
  operationMetadata: {
    organizationId: "organization",
    spaceId: "space",
    loggingCollectionId: "requests/webCrawlRequests/logs",
    loggingDocumentId: "webCrawl_test",
    requestedBy: {
      userId: "user",
      email: "user@example.com",
      role: 1,
    },
    isCommand: true,
    isOouiCrud: false,
    isLlmCall: false,
    isAdminCrud: true,
  },
  status: "completed",
  steps: {},
  stepLogs: {},
  createdAt: Timestamp.now(),
  updatedAt: Timestamp.now(),
};

describe("DecodedWebCrawlRequestSchema", () => {
  it("normalizes a JSON-string Firestore output to an object", () => {
    const parsed = DecodedWebCrawlRequestSchema.parse({
      ...baseRequest,
      output: JSON.stringify({
        totalPages: 3,
        markdownCount: 3,
        imageCount: 1,
      }),
    });

    expect(parsed.output).toEqual({
      totalPages: 3,
      markdownCount: 3,
      imageCount: 1,
    });
  });

  it("continues to accept object outputs", () => {
    const parsed = DecodedWebCrawlRequestSchema.parse({
      ...baseRequest,
      output: { totalPages: 2 },
    });

    expect(parsed.output).toEqual({ totalPages: 2 });
  });
});
