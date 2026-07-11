const MASKED_TOKEN = "sv_mcp_••••••••••••••••••••••••";

/** Masks a freshly issued token without changing the value used for copying. */
export function maskStoryVaultMcpTokenForDisplay(value: string, token: string): string {
  if (!token || !value.includes(token)) return value;
  return value.replaceAll(token, MASKED_TOKEN);
}
