import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { GameSocketProvider } from "./context/GameSocketContext";
import { prepareReelFaces } from "./data/roster";
import "./styles/global.css";

const base = import.meta.env.BASE_URL;

// Once the page has loaded, quietly download a few reel faces so the first
// roll spins with real portraits instead of blank cells.
if (document.readyState === "complete") prepareReelFaces();
else window.addEventListener("load", () => prepareReelFaces(), { once: true });

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter basename={base === "/" ? undefined : base.replace(/\/$/, "")}>
      <GameSocketProvider>
        <App />
      </GameSocketProvider>
    </BrowserRouter>
  </StrictMode>,
);
