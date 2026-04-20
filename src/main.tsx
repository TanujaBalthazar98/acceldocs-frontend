import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { initPosthog } from "@/lib/analytics/posthog";

initPosthog();

createRoot(document.getElementById("root")!).render(<App />);
