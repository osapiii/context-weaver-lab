import { createSign } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const PROJECT_ID = "en-aistudio-development";
const PROJECT_NUMBER = "509107319597";
const SERVICE_ACCOUNT_KEY_PATH = resolve(
  process.cwd(),
  ".local/en-aistudio-local-dev-signer-key.json"
);
const ALLOWED_EMAILS = new Set(["super@enostech.co.jp"]);

type ServiceAccountKey = {
  client_email: string;
  private_key: string;
  private_key_id?: string;
};

const base64url = (value: string | Buffer): string =>
  Buffer.from(value)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");

const signJwt = (
  payload: Record<string, unknown>,
  serviceAccount: ServiceAccountKey
): string => {
  const header = {
    alg: "RS256",
    typ: "JWT",
    ...(serviceAccount.private_key_id
      ? { kid: serviceAccount.private_key_id }
      : {}),
  };
  const unsigned = `${base64url(JSON.stringify(header))}.${base64url(
    JSON.stringify(payload)
  )}`;
  const signer = createSign("RSA-SHA256");
  signer.update(unsigned);
  signer.end();
  return `${unsigned}.${base64url(signer.sign(serviceAccount.private_key))}`;
};

export default defineEventHandler(async (event) => {
  if (process.env.NODE_ENV !== "development") {
    throw createError({ statusCode: 404, statusMessage: "Not found" });
  }

  const host = getRequestHost(event, { xForwardedHost: false }).split(":")[0];
  if (!["localhost", "127.0.0.1"].includes(host)) {
    throw createError({ statusCode: 403, statusMessage: "Localhost only" });
  }

  const body = await readBody<{ email?: string }>(event);
  const email = String(body?.email || "").trim().toLowerCase();
  if (!ALLOWED_EMAILS.has(email)) {
    throw createError({ statusCode: 403, statusMessage: "Email is not allowlisted" });
  }

  let serviceAccount: ServiceAccountKey;
  try {
    serviceAccount = JSON.parse(
      readFileSync(SERVICE_ACCOUNT_KEY_PATH, "utf8")
    ) as ServiceAccountKey;
  } catch (error) {
    throw createError({
      statusCode: 500,
      statusMessage:
        "Local service account key is missing. Create app/.local/en-aistudio-local-dev-signer-key.json",
    });
  }

  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: serviceAccount.client_email,
    sub: serviceAccount.client_email,
    aud: "https://identitytoolkit.googleapis.com/google.identity.identitytoolkit.v1.IdentityToolkit",
    iat: now,
    exp: now + 60 * 60,
    uid: "super_enostech_co_jp",
    claims: {
      email,
      rbacRole: 1,
      organizationId: "org_enostech",
      organizationCode: "enostech",
      spaceIds: ["default"],
    },
  };

  return {
    customToken: signJwt(payload, serviceAccount),
    email,
    uid: payload.uid,
    projectId: PROJECT_ID,
    projectNumber: PROJECT_NUMBER,
  };
});
