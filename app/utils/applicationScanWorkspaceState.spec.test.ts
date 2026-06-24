import { describe, expect, it } from "vitest";
import { VibeControlSourceAssetTypeSchema } from "@models/vibeControl";
import {
  applicationScanFieldsComplete,
  applicationScanModeStateToApi,
  emptyApplicationScanFields,
  resolveApplicationScanFieldsFromRecord,
} from "./applicationScanWorkspaceState";

describe("applicationScanWorkspaceState", () => {
  it("defaults variant exploration to disabled", () => {
    const fields = emptyApplicationScanFields();

    expect(fields.exploreVariants).toBe(false);
    expect(fields.maxVariantsPerScreen).toBe(5);
    expect(fields.maxStepsPerScreen).toBe(12);
    expect(fields.allowChatSend).toBe(false);
    expect(fields.variantOnly).toBe(false);
    expect(fields.scanProfileName).toBe("Default");
    expect(fields.authMode).toBe("none");
    expect(fields.authenticatedUrl).toBe("");
  });

  it("serializes Screen Atlas variant exploration settings", () => {
    const state = applicationScanModeStateToApi({
      ...emptyApplicationScanFields(),
      startUrl: "https://stale.example.com/",
      scanProfileId: "scan-profile-app-default",
      scanProfileName: "Production",
      authMode: "email_link_manual",
      authenticatedUrl: "https://example.com/__/auth/action?mode=signIn&oobCode=abc",
      exploreVariants: true,
      maxVariantsPerScreen: 99,
      maxStepsPerScreen: 99,
      variantOnly: true,
      targetScreenId: "screen-home",
      targetScreenUrl: "https://example.com/dashboard",
      targetRouteKey: "/dashboard",
    });

    expect(state.setup).toMatchObject({
      scan_profile_id: "scan-profile-app-default",
      scan_profile_name: "Production",
      auth_mode: "email_link_manual",
      start_url: undefined,
      username: undefined,
      authenticated_url: "https://example.com/__/auth/action?mode=signIn&oobCode=abc",
      explore_variants: true,
      max_variants_per_screen: 10,
      max_steps_per_screen: 30,
      allow_chat_send: false,
      variant_only: true,
      target_screen_id: "screen-home",
      target_screen_url: "https://example.com/dashboard",
      target_route_key: "/dashboard",
    });
  });

  it("restores missing variant fields with safe defaults", () => {
    const fields = resolveApplicationScanFieldsFromRecord({
      state: {
        application_scan: {
          setup: {
            start_url: "https://example.com/",
            auth_mode: "credentials",
            capture_screenshots: true,
          },
        },
      },
    });

    expect(fields.exploreVariants).toBe(false);
    expect(fields.maxVariantsPerScreen).toBe(5);
    expect(fields.maxStepsPerScreen).toBe(12);
    expect(fields.authMode).toBe("credentials");
  });

  it("accepts Screen Atlas SourceAsset types", () => {
    expect(VibeControlSourceAssetTypeSchema.parse("application_screen")).toBe(
      "application_screen"
    );
    expect(
      VibeControlSourceAssetTypeSchema.parse("application_screen_variant")
    ).toBe("application_screen_variant");
  });

  it("requires an authenticated URL for manual email link auth", () => {
    const fields = {
      ...emptyApplicationScanFields(),
      authMode: "email_link_manual" as const,
    };

    expect(applicationScanFieldsComplete(fields)).toBe(false);
    expect(
      applicationScanFieldsComplete({
        ...fields,
        authenticatedUrl: "https://example.com/__/auth/action?oobCode=abc",
      })
    ).toBe(true);
  });
});
