/**
 * OAuth 2.0 routes for social media authentication.
 *
 * Twitter/X — uses PKCE (no client_secret needed), requires TWITTER_CLIENT_ID.
 * LinkedIn  — uses standard auth code flow, requires LINKEDIN_CLIENT_ID + LINKEDIN_CLIENT_SECRET.
 *
 * Redirect URI (must be registered in each platform's developer app):
 *   https://{REPLIT_DEV_DOMAIN}/api/auth/{platform}/callback
 */

import { Router } from "express";
import { randomBytes, createHash } from "crypto";
import { eq } from "drizzle-orm";
import { db, socialConnectionsTable } from "@workspace/db";

const router = Router();

// ── In-memory state store (single-user, short-lived) ─────────────────────────
interface PendingState {
  platform: string;
  codeVerifier?: string; // Twitter PKCE only
  expiresAt: number;
}
const pendingStates = new Map<string, PendingState>();
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of pendingStates) {
    if (v.expiresAt < now) pendingStates.delete(k);
  }
}, 60_000);

// ── URL helpers ───────────────────────────────────────────────────────────────
function getApiBase(): string {
  if (process.env.REPLIT_DEV_DOMAIN) return `https://${process.env.REPLIT_DEV_DOMAIN}`;
  return `http://localhost:${process.env.PORT ?? 8080}`;
}

function getFrontendBase(): string {
  if (process.env.REPLIT_DEV_DOMAIN) return `https://${process.env.REPLIT_DEV_DOMAIN}`;
  return "http://localhost:5173";
}

function callbackUrl(platform: string) {
  return `${getApiBase()}/api/auth/${platform}/callback`;
}

// ── PKCE helpers ──────────────────────────────────────────────────────────────
function makeCodeVerifier() {
  return randomBytes(32).toString("base64url");
}
function makeCodeChallenge(verifier: string) {
  return createHash("sha256").update(verifier).digest("base64url");
}

// ═══════════════════════════════════════════════════════════════════════════════
// TWITTER / X
// ═══════════════════════════════════════════════════════════════════════════════

/** GET /api/auth/twitter/connect — start OAuth PKCE flow */
router.get("/auth/twitter/connect", (req, res) => {
  const clientId = process.env.TWITTER_CLIENT_ID;
  if (!clientId) {
    res.status(500).send("TWITTER_CLIENT_ID not configured. Set it in Secrets.");
    return;
  }
  const state = randomBytes(16).toString("hex");
  const codeVerifier = makeCodeVerifier();
  pendingStates.set(state, {
    platform: "twitter",
    codeVerifier,
    expiresAt: Date.now() + 10 * 60_000,
  });

  const params = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    redirect_uri: callbackUrl("twitter"),
    scope: "tweet.read tweet.write users.read offline.access",
    state,
    code_challenge: makeCodeChallenge(codeVerifier),
    code_challenge_method: "S256",
  });

  res.redirect(`https://twitter.com/i/oauth2/authorize?${params}`);
});

/** GET /api/auth/twitter/callback */
router.get("/auth/twitter/callback", async (req, res): Promise<void> => {
  const { code, state, error } = req.query as Record<string, string>;

  if (error) {
    res.redirect(`${getFrontendBase()}/settings?error=twitter_denied`);
    return;
  }

  const pending = pendingStates.get(state);
  if (!pending || pending.platform !== "twitter" || pending.expiresAt < Date.now()) {
    res.redirect(`${getFrontendBase()}/settings?error=invalid_state`);
    return;
  }
  pendingStates.delete(state);

  try {
    const tokenRes = await fetch("https://api.twitter.com/2/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        grant_type: "authorization_code",
        client_id: process.env.TWITTER_CLIENT_ID!,
        redirect_uri: callbackUrl("twitter"),
        code_verifier: pending.codeVerifier!,
      }),
    });

    if (!tokenRes.ok) {
      throw new Error(`Token exchange failed: ${await tokenRes.text()}`);
    }

    const tokens = await tokenRes.json() as {
      access_token: string;
      refresh_token?: string;
      expires_in?: number;
    };

    const userRes = await fetch("https://api.twitter.com/2/users/me", {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    const user = await userRes.json() as { data: { id: string; username: string; name: string } };

    const tokenExpiry = tokens.expires_in
      ? new Date(Date.now() + tokens.expires_in * 1000)
      : null;

    // Upsert — one Twitter connection at a time
    await db.delete(socialConnectionsTable).where(eq(socialConnectionsTable.platform, "twitter"));
    await db.insert(socialConnectionsTable).values({
      platform: "twitter",
      handle: `@${user.data.username}`,
      platformUserId: user.data.id,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token ?? null,
      tokenExpiry,
      scope: "tweet.read tweet.write users.read offline.access",
    });

    res.redirect(`${getFrontendBase()}/settings?connected=twitter`);
  } catch (err) {
    console.error("Twitter OAuth error:", err);
    res.redirect(`${getFrontendBase()}/settings?error=twitter_failed`);
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// LINKEDIN
// ═══════════════════════════════════════════════════════════════════════════════

/** GET /api/auth/linkedin/connect — start OAuth flow */
router.get("/auth/linkedin/connect", (req, res) => {
  const clientId = process.env.LINKEDIN_CLIENT_ID;
  if (!clientId) {
    res.status(500).send("LINKEDIN_CLIENT_ID not configured. Set it in Secrets.");
    return;
  }

  const state = randomBytes(16).toString("hex");
  pendingStates.set(state, { platform: "linkedin", expiresAt: Date.now() + 10 * 60_000 });

  const params = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    redirect_uri: callbackUrl("linkedin"),
    scope: "openid profile w_member_social",
    state,
  });

  res.redirect(`https://www.linkedin.com/oauth/v2/authorization?${params}`);
});

/** GET /api/auth/linkedin/callback */
router.get("/auth/linkedin/callback", async (req, res): Promise<void> => {
  const { code, state, error } = req.query as Record<string, string>;

  if (error) {
    res.redirect(`${getFrontendBase()}/settings?error=linkedin_denied`);
    return;
  }

  const pending = pendingStates.get(state);
  if (!pending || pending.platform !== "linkedin" || pending.expiresAt < Date.now()) {
    res.redirect(`${getFrontendBase()}/settings?error=invalid_state`);
    return;
  }
  pendingStates.delete(state);

  const clientSecret = process.env.LINKEDIN_CLIENT_SECRET;
  if (!clientSecret) {
    res.redirect(`${getFrontendBase()}/settings?error=linkedin_not_configured`);
    return;
  }

  try {
    const tokenRes = await fetch("https://www.linkedin.com/oauth/v2/accessToken", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: callbackUrl("linkedin"),
        client_id: process.env.LINKEDIN_CLIENT_ID!,
        client_secret: clientSecret,
      }),
    });

    if (!tokenRes.ok) {
      throw new Error(`LinkedIn token exchange failed: ${await tokenRes.text()}`);
    }

    const tokens = await tokenRes.json() as {
      access_token: string;
      expires_in: number;
      refresh_token?: string;
    };

    // Get user profile via OpenID userinfo endpoint
    const profileRes = await fetch("https://api.linkedin.com/v2/userinfo", {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    const profile = await profileRes.json() as { sub: string; name?: string; given_name?: string };

    const handle = profile.name ?? profile.given_name ?? "LinkedIn User";
    const tokenExpiry = new Date(Date.now() + tokens.expires_in * 1000);

    await db.delete(socialConnectionsTable).where(eq(socialConnectionsTable.platform, "linkedin"));
    await db.insert(socialConnectionsTable).values({
      platform: "linkedin",
      handle,
      platformUserId: profile.sub,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token ?? null,
      tokenExpiry,
      scope: "openid profile w_member_social",
    });

    res.redirect(`${getFrontendBase()}/settings?connected=linkedin`);
  } catch (err) {
    console.error("LinkedIn OAuth error:", err);
    res.redirect(`${getFrontendBase()}/settings?error=linkedin_failed`);
  }
});

export default router;
