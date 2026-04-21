import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

const authRedirectBase = import.meta.env.VITE_AUTH_REDIRECT_BASE as string | undefined;

if (authRedirectBase) {
  try {
    const target = new URL(authRedirectBase);
    const current = new URL(window.location.href);
    const sameOrigin = target.origin === current.origin;

    if (!sameOrigin) {
      const next = new URL(`${current.pathname}${current.search}${current.hash}`, target.origin);
      window.location.replace(next.toString());
    }
  } catch {
    // Ignore malformed env var; fall back to current origin.
  }
}

createRoot(document.getElementById("root")!).render(<App />);
