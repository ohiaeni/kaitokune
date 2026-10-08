/**
 * Cloudflare Access が付ける JWT（Cf-Access-Jwt-Assertion ヘッダー）を検証し、ログインしているメールアドレスを返す。
 * https://developers.cloudflare.com/cloudflare-one/identity/authorization-cookie/validating-json/
 */

export class AccessError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AccessError";
  }
}

type AccessConfig = {
  /** Access のチームドメイン（例: https://<team>.cloudflareaccess.com） */
  teamDomain: string;
  /** Access アプリケーションの Application Audience (AUD) タグ */
  aud: string;
};

type Jwk = JsonWebKey & { kid?: string };

/** 公開鍵を取り直すまでの時間。Access は鍵を定期的に入れ替えるので、知らない kid が来たら期限前でも取り直す */
const KEYS_TTL_MS = 60 * 60 * 1000;

/** "<team>.cloudflareaccess.com" と "https://<team>.cloudflareaccess.com/" のどちらで設定されていても同じ形にする */
export function normalizeTeamDomain(teamDomain: string): string {
  return `https://${teamDomain.replace(/^https?:\/\//, "").replace(/\/+$/, "")}`;
}

function base64UrlDecode(input: string): Uint8Array<ArrayBuffer> {
  const base64 = input
    .replace(/-/g, "+")
    .replace(/_/g, "/")
    .padEnd(Math.ceil(input.length / 4) * 4, "=");
  return Uint8Array.from(atob(base64), (ch) => ch.charCodeAt(0));
}

function decodeJson(input: string): Record<string, unknown> {
  try {
    const value: unknown = JSON.parse(new TextDecoder().decode(base64UrlDecode(input)));
    if (typeof value === "object" && value !== null) return value as Record<string, unknown>;
  } catch {
    // 下で AccessError にする
  }
  throw new AccessError("malformed token");
}

/** チームドメインごとに公開鍵をキャッシュし、JWT を検証する関数を作る */
export function createAccessVerifier(fetcher: typeof fetch) {
  const cache = new Map<string, { keys: Map<string, CryptoKey>; expiresAt: number }>();

  async function loadKeys(teamDomain: string): Promise<Map<string, CryptoKey>> {
    const res = await fetcher(`${teamDomain}/cdn-cgi/access/certs`);
    if (!res.ok) throw new Error(`failed to fetch Access certs: ${res.status}`);
    const { keys = [] } = (await res.json()) as { keys?: Jwk[] };
    const entries = await Promise.all(
      keys
        .filter((k) => k.kid && k.kty === "RSA")
        .map(async (k) => {
          const key = await crypto.subtle.importKey("jwk", k, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, [
            "verify",
          ]);
          return [k.kid as string, key] as const;
        }),
    );
    const map = new Map(entries);
    cache.set(teamDomain, { keys: map, expiresAt: Date.now() + KEYS_TTL_MS });
    return map;
  }

  async function findKey(teamDomain: string, kid: string): Promise<CryptoKey | undefined> {
    const cached = cache.get(teamDomain);
    if (cached && cached.expiresAt > Date.now() && cached.keys.has(kid)) return cached.keys.get(kid);
    return (await loadKeys(teamDomain)).get(kid);
  }

  /** 検証できたらメールアドレスを返す。検証できなければ AccessError を投げる */
  return async function verify(token: string, config: AccessConfig, now = Date.now()): Promise<string> {
    const teamDomain = normalizeTeamDomain(config.teamDomain);
    const parts = token.split(".");
    if (parts.length !== 3) throw new AccessError("malformed token");
    const [headerPart, payloadPart, signaturePart] = parts;

    const header = decodeJson(headerPart);
    if (header.alg !== "RS256" || typeof header.kid !== "string") throw new AccessError("unsupported token");
    const key = await findKey(teamDomain, header.kid);
    if (!key) throw new AccessError("unknown signing key");

    const valid = await crypto.subtle.verify(
      "RSASSA-PKCS1-v1_5",
      key,
      base64UrlDecode(signaturePart),
      new TextEncoder().encode(`${headerPart}.${payloadPart}`),
    );
    if (!valid) throw new AccessError("invalid signature");

    const payload = decodeJson(payloadPart);
    const audiences = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
    if (!audiences.includes(config.aud)) throw new AccessError("invalid audience");
    if (payload.iss !== teamDomain) throw new AccessError("invalid issuer");
    const nowSec = now / 1000;
    if (typeof payload.exp !== "number" || payload.exp <= nowSec) throw new AccessError("token expired");
    if (typeof payload.nbf === "number" && payload.nbf > nowSec) throw new AccessError("token not yet valid");
    // サービストークンなど、メールアドレスを持たないトークンは日記の持ち主にできない
    if (typeof payload.email !== "string" || payload.email === "") throw new AccessError("token has no email");
    return payload.email;
  };
}

export type AccessVerifier = ReturnType<typeof createAccessVerifier>;
