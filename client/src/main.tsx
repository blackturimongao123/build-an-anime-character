import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { GameSocketProvider } from "./context/GameSocketContext";
import "./styles/global.css";

const base = import.meta.env.BASE_URL;

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter basename={base === "/" ? undefined : base.replace(/\/$/, "")}>
      <GameSocketProvider>
        <App />
      </GameSocketProvider>
    </BrowserRouter>
  </StrictMode>,
);
