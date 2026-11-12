/** WebSocket endpoint: production needs VITE_WS_URL; dev uses Vite proxy on same origin. */
export function getWsUrl(): string {
  if (import.meta.env.VITE_WS_URL) {
    return import.meta.env.VITE_WS_URL;
  }
  if (import.meta.env.DEV && typeof window !== "undefined") {
    const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
    return `${proto}//${window.location.host}/game-ws`;
  }
  return "ws://127.0.0.1:8081";
}
