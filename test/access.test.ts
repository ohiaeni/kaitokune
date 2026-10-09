import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import type { ApiErrorBody } from "../src/shared/schemas";
import { AccessError, createAccessVerifier, normalizeTeamDomain } from "../src/worker/access";
import type { DiaryAI } from "../src/worker/ai";
import { createApp } from "../src/worker/app";
import type { Bindings } from "../src/worker/env";

const TEAM = "https://example.cloudflareaccess.com";
const AUD = "test-aud";
const KID = "key-1";
const BASE64_PADDING = /=+$/;

function base64Url(bytes: ArrayBuffer | Uint8Array): string {
  return btoa(String.fromCharCode(...new Uint8Array(bytes)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(BASE64_PADDING, "");
}

const encodeJson = (value: unknown) => base64Url(new TextEncoder().encode(JSON.stringify(value)));

async function generateKey() {
  return (await crypto.subtle.generateKey(
    { name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" },
    true,
    ["sign", "verify"],
  )) as CryptoKeyPair;
}

const signingKey = await generateKey();
const publicJwk = { ...((await crypto.subtle.exportKey("jwk", signingKey.publicKey)) as JsonWebKey), kid: KID };

const nowSec = () => Math.floor(Date.now() / 1000);

async function sign(
  claims: Record<string, unknown> = {},
  { kid = KID, key = signingKey.privateKey }: { kid?: string; key?: CryptoKey } = {},
): Promise<string> {
  const header = encodeJson({ alg: "RS256", kid, typ: "JWT" });
  const payload = encodeJson({
    aud: [AUD],
    iss: TEAM,
    email: "Owner@Example.invalid",
    exp: nowSec() + 60,
    iat: nowSec(),
    ...claims,
  });
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    new TextEncoder().encode(`${header}.${payload}`),
  );
  return `${header}.${payload}.${base64Url(signature)}`;
}

/** Access の公開鍵の配布元を真似る */
function certsFetcher(keys: JsonWebKey[] = [publicJwk]) {
  const urls: string[] = [];
  const fetcher = ((input: RequestInfo | URL) => {
    urls.push(String(input));
    return Promise.resolve(Response.json({ keys }));
  }) as typeof fetch;
  return { fetcher, urls };
}

describe("normalizeTeamDomain", () => {
  it("accepts the domain with or without the scheme and trailing slash", () => {
    expect(normalizeTeamDomain("example.cloudflareaccess.com")).toBe(TEAM);
    expect(normalizeTeamDomain(`${TEAM}/`)).toBe(TEAM);
    expect(normalizeTeamDomain(TEAM)).toBe(TEAM);
  });
});

describe("createAccessVerifier", () => {
  const config = { teamDomain: TEAM, aud: AUD };

  it("returns the email of a valid token and caches the keys", async () => {
    const { fetcher, urls } = certsFetcher();
    const verify = createAccessVerifier(fetcher);
    expect(await verify(await sign(), config)).toBe("Owner@Example.invalid");
    expect(await verify(await sign(), config)).toBe("Owner@Example.invalid");
    expect(urls).toEqual([`${TEAM}/cdn-cgi/access/certs`]);
  });

  it("refetches the keys when the token uses an unknown key id", async () => {
    const other = await generateKey();
    const otherJwk = { ...((await crypto.subtle.exportKey("jwk", other.publicKey)) as JsonWebKey), kid: "key-2" };
    let keys: JsonWebKey[] = [publicJwk];
    const urls: string[] = [];
    const verify = createAccessVerifier(((input: RequestInfo | URL) => {
      urls.push(String(input));
      return Promise.resolve(Response.json({ keys }));
    }) as typeof fetch);

    await verify(await sign(), config);
    keys = [publicJwk, otherJwk];
    expect(await verify(await sign({}, { kid: "key-2", key: other.privateKey }), config)).toBe("Owner@Example.invalid");
    expect(urls).toHaveLength(2);
  });

  it.each([
    ["a different audience", { aud: ["other"] }],
    ["a different issuer", { iss: "https://other.cloudflareaccess.com" }],
    ["an expired token", { exp: nowSec() - 1 }],
    ["a token that is not yet valid", { nbf: nowSec() + 60 }],
    ["a token without email", { email: undefined }],
  ])("rejects %s", async (_, claims) => {
    const verify = createAccessVerifier(certsFetcher().fetcher);
    await expect(verify(await sign(claims), config)).rejects.toThrow(AccessError);
  });

  it("rejects a token signed by another key", async () => {
    const other = await generateKey();
    const verify = createAccessVerifier(certsFetcher().fetcher);
    await expect(verify(await sign({}, { key: other.privateKey }), config)).rejects.toThrow("invalid signature");
  });

  it("rejects a token whose payload was changed", async () => {
    const verify = createAccessVerifier(certsFetcher().fetcher);
    const [header, , signature] = (await sign()).split(".");
    const forged = `${header}.${encodeJson({ aud: [AUD], iss: TEAM, email: "x@example.invalid", exp: nowSec() + 60 })}.${signature}`;
    await expect(verify(forged, config)).rejects.toThrow("invalid signature");
  });

  it.each(["", "a.b", "not.a.jwt"])("rejects a malformed token %j", async (token) => {
    const verify = createAccessVerifier(certsFetcher().fetcher);
    await expect(verify(token, config)).rejects.toThrow(AccessError);
  });

  it("rejects a token with an unsupported algorithm", async () => {
    const verify = createAccessVerifier(certsFetcher().fetcher);
    const [, payload, signature] = (await sign()).split(".");
    await expect(verify(`${encodeJson({ alg: "none", kid: KID })}.${payload}.${signature}`, config)).rejects.toThrow(
      "unsupported token",
    );
  });
});

describe("authentication middleware", () => {
  const ai: DiaryAI = {
    nextQuestion: async () => ({ done: true }),
    composeDiary: async () => ({ body: "", suggestions: [] }),
  };

  function request(envOverrides: Partial<Bindings>, headers: Record<string, string> = {}) {
    const app = createApp({ createAI: () => ai, fetcher: certsFetcher().fetcher });
    return app.request("/api/notes?date=2026-10-08", { headers }, { ...env, ...envOverrides });
  }

  const access = { ACCESS_TEAM_DOMAIN: TEAM, ACCESS_AUD: AUD };

  it("accepts a request with a valid Access token", async () => {
    const res = await request(access, { "cf-access-jwt-assertion": await sign() });
    expect(res.status).toBe(200);
  });

  it("rejects a request without the Access token", async () => {
    const res = await request(access);
    expect(res.status).toBe(401);
    expect(((await res.json()) as ApiErrorBody).error).toBe("unauthorized");
  });

  it("ignores DEV_USER_EMAIL when Access is configured", async () => {
    const res = await request({ ...access, DEV_USER_EMAIL: "owner@example.invalid" });
    expect(res.status).toBe(401);
  });

  it("does not trust the email header set by Access alone", async () => {
    const res = await request(access, { "cf-access-authenticated-user-email": "owner@example.invalid" });
    expect(res.status).toBe(401);
  });

  it("rejects every request when only one of the Access settings is set", async () => {
    const res = await request({ ACCESS_TEAM_DOMAIN: TEAM, DEV_USER_EMAIL: "owner@example.invalid" });
    expect(res.status).toBe(401);
  });

  it("rejects every request when neither Access nor DEV_USER_EMAIL is set", async () => {
    const res = await request({ DEV_USER_EMAIL: undefined });
    expect(res.status).toBe(401);
  });

  it("rejects a user who passed Access but is not registered", async () => {
    const res = await request(access, { "cf-access-jwt-assertion": await sign({ email: "stranger@example.invalid" }) });
    expect(res.status).toBe(403);
    expect(((await res.json()) as ApiErrorBody).error).toBe("forbidden");
  });

  it("matches the registered email case-insensitively", async () => {
    const res = await request({ DEV_USER_EMAIL: "OWNER@example.invalid" });
    expect(res.status).toBe(200);
  });

  it("uses DEV_USER_EMAIL in local development", async () => {
    const res = await request({});
    expect(res.status).toBe(200);
  });
});
