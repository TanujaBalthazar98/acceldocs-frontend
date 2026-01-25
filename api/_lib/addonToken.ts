import crypto from "crypto";
import { base64UrlEncode, base64UrlDecode } from "./base64url";

export interface AddonTokenPayload {
  sub: string;
  workspaceId: string;
  role?: string;
  exp: number;
  iat: number;
}

const getAddonSecret = () => {
  const secret = process.env.ADDON_JWT_SECRET;
  if (!secret) {
    throw new Error("Missing ADDON_JWT_SECRET");
  }
  return secret;
};

const sign = (data: string, secret: string) =>
  base64UrlEncode(crypto.createHmac("sha256", secret).update(data).digest());

export const createAddonToken = (payload: Omit<AddonTokenPayload, "iat" | "exp">, ttlSeconds = 600) => {
  const issuedAt = Math.floor(Date.now() / 1000);
  const body: AddonTokenPayload = {
    ...payload,
    iat: issuedAt,
    exp: issuedAt + ttlSeconds,
  };

  const header = { alg: "HS256", typ: "JWT" };
  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(body));
  const signingInput = `${encodedHeader}.${encodedPayload}`;
  const signature = sign(signingInput, getAddonSecret());

  return `${signingInput}.${signature}`;
};

export const verifyAddonToken = (token: string): AddonTokenPayload => {
  const [encodedHeader, encodedPayload, signature] = token.split(".");
  if (!encodedHeader || !encodedPayload || !signature) {
    throw new Error("Invalid token format");
  }

  const signingInput = `${encodedHeader}.${encodedPayload}`;
  const expectedSignature = sign(signingInput, getAddonSecret());
  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
    throw new Error("Invalid token signature");
  }

  const payload = JSON.parse(base64UrlDecode(encodedPayload)) as AddonTokenPayload;
  if (payload.exp < Math.floor(Date.now() / 1000)) {
    throw new Error("Token expired");
  }

  return payload;
};
