import { auth, type ApiSession } from "@/lib/api/auth";
import { USE_STRAPI } from "@/lib/api/client";

// Deduplicates refresh attempts and avoids hammering Supabase with refresh requests,
// which can trigger 429s and force the client to sign out.
const REFRESH_BUFFER_MS = 2 * 60 * 1000; // refresh only when expiring within 2 minutes
const MIN_REFRESH_INTERVAL_MS = 30 * 1000; // don't refresh more than once every 30s
const REFRESH_LOCK_MS = 3 * 60 * 1000; // a single tab owns refresh for 3 minutes
const REFRESH_COOLDOWN_MS = 2 * 60 * 1000; // wait after a failed refresh (e.g., 429)
const REFRESH_LOCK_KEY = "sb_refresh_owner";
const REFRESH_COOLDOWN_KEY = "sb_refresh_cooldown_until";
const GOOGLE_TOKEN_KEY = "google_access_token";

const TAB_ID_KEY = "sb_tab_id";
const getTabId = () => {
  if (typeof window === "undefined") return "server";
  const existing = sessionStorage.getItem(TAB_ID_KEY);
  if (existing) return existing;
  const id = crypto.randomUUID();
  sessionStorage.setItem(TAB_ID_KEY, id);
  return id;
};

let refreshPromise: Promise<ApiSession | null> | null = null;
let lastRefreshAt = 0;

export const ensureFreshSession = async (): Promise<ApiSession | null> => {
  const currentSession = await auth.getSession();
  const now = Date.now();
  if (!currentSession) return null;

  const expiresAtMs = currentSession.expires_at
    ? currentSession.expires_at * 1000
    : 0;

  // Strapi sessions may not expose expiry; avoid forced refresh loops.
  if (USE_STRAPI && !currentSession.expires_at) {
    return currentSession;
  }

  // If the session exists and isn't close to expiring, return it.
  if (currentSession && expiresAtMs - now > REFRESH_BUFFER_MS) {
    return currentSession;
  }

  // Respect a shared cooldown across tabs to avoid hammering /token
  const cooldownUntil = Number(localStorage.getItem(REFRESH_COOLDOWN_KEY) || "0");
  if (cooldownUntil && now < cooldownUntil) {
    return currentSession;
  }

  // Only one tab should attempt a refresh window at a time.
  const tabId = getTabId();
  const lockOwner = localStorage.getItem(REFRESH_LOCK_KEY);
  const [ownerId, lockExpiryStr] = (lockOwner || "").split(":");
  const lockExpiry = Number(lockExpiryStr || "0");

  const lockExpired = !lockExpiry || lockExpiry < now;
  const weOwnLock = ownerId === tabId;

  if (!lockExpired && !weOwnLock) {
    return currentSession;
  }

  // (Re)acquire lock for this tab
  const newLockExpiry = now + REFRESH_LOCK_MS;
  localStorage.setItem(REFRESH_LOCK_KEY, `${tabId}:${newLockExpiry}`);

  // Avoid overlapping refresh calls.
  if (refreshPromise) {
    return refreshPromise;
  }

  // Respect a minimum refresh interval when we still have a session.
  if (currentSession && now - lastRefreshAt < MIN_REFRESH_INTERVAL_MS) {
    return currentSession;
  }

  refreshPromise = auth
    .refreshSession()
    .then((session) => {
      if (!session) {
        if (!USE_STRAPI) {
          console.warn("Session refresh failed");
          localStorage.setItem(
            REFRESH_COOLDOWN_KEY,
            String(Date.now() + REFRESH_COOLDOWN_MS)
          );
        }
      } else {
        // Extend lock on success
        localStorage.setItem(
          REFRESH_LOCK_KEY,
          `${tabId}:${Date.now() + REFRESH_LOCK_MS}`
        );
        localStorage.removeItem(REFRESH_COOLDOWN_KEY);

        // Store refreshed Google provider token
        if (session.provider_token) {
          localStorage.setItem(GOOGLE_TOKEN_KEY, session.provider_token);
          console.log("Google access token refreshed and stored");
        }
      }
      lastRefreshAt = Date.now();
      return session ?? null;
    })
    .finally(() => {
      refreshPromise = null;
    });

  return refreshPromise;
};
