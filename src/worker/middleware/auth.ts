import type { MiddlewareHandler } from "hono";
import type { ApiErrorBody } from "../../shared/schemas";
import { AccessError, type AccessVerifier } from "../access";
import { findUserIdByEmail } from "../db/users";
import type { Bindings } from "../env";
import type { AppEnv } from "../types";

/**
 * リクエストしたユーザーのメールアドレスを決める。
 * 本番では Access の JWT を検証し、ローカル開発では DEV_USER_EMAIL を使う。どちらもなければ誰も通さない
 */
async function authenticate(env: Bindings, token: string | undefined, verify: AccessVerifier): Promise<string> {
  const { ACCESS_TEAM_DOMAIN: teamDomain, ACCESS_AUD: aud, DEV_USER_EMAIL: devEmail } = env;
  if (teamDomain || aud) {
    if (!teamDomain || !aud) throw new AccessError("ACCESS_TEAM_DOMAIN and ACCESS_AUD must be set together");
    if (!token) throw new AccessError("missing Cf-Access-Jwt-Assertion header");
    return (await verify(token, { teamDomain, aud })).toLowerCase();
  }
  if (devEmail) return devEmail.toLowerCase();
  throw new AccessError("ACCESS_TEAM_DOMAIN / ACCESS_AUD (or DEV_USER_EMAIL for local development) is not set");
}

/** ユーザーを認証し、users に登録した人だけ通して userId を Context に入れる（db を入れたあとに使う） */
export function auth(verifyAccess: AccessVerifier): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    const email = await authenticate(c.env, c.req.header("cf-access-jwt-assertion"), verifyAccess);
    // Access を通っても、users に登録していない人には使わせない
    const userId = await findUserIdByEmail(c.get("db"), email);
    if (userId === null) {
      console.warn(`unregistered user: ${email}`);
      return c.json<ApiErrorBody>(
        { error: "forbidden", message: `${email} はまだ登録されていません。管理者に登録を頼んでください` },
        403,
      );
    }
    c.set("userId", userId);
    await next();
  };
}
