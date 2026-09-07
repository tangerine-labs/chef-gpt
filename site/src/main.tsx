import { createRoot } from "react-dom/client";
import "../../packages/ui/signal.css";
import "../../packages/ui/tokens.css";
import { App } from "./App.tsx";

const root = document.getElementById("root");
if (root) createRoot(root).render(<App />);
