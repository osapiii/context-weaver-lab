import { describe, expect, it } from "vitest";
import { maskStoryVaultMcpTokenForDisplay } from "./storyVaultMcpTokenDisplay";

describe("maskStoryVaultMcpTokenForDisplay", () => {
  const token = "sv_mcp_payload.secret-value";

  it("masks a standalone token", () => {
    const displayed = maskStoryVaultMcpTokenForDisplay(token, token);
    expect(displayed).toBe("sv_mcp_••••••••••••••••••••••••");
    expect(displayed).not.toContain("payload.secret-value");
  });

  it("masks a token embedded in a setup command", () => {
    const displayed = maskStoryVaultMcpTokenForDisplay(
      `npx setup --token '${token}' --client cursor`,
      token
    );
    expect(displayed).toContain("--token 'sv_mcp_••••••••••••••••••••••••'");
    expect(displayed).not.toContain(token);
  });

  it("leaves the placeholder unchanged before issuance", () => {
    const command = "npx setup --token '<STORYVAULT_MCP_TOKEN>'";
    expect(maskStoryVaultMcpTokenForDisplay(command, "")).toBe(command);
  });
});
