import { createRoot } from "react-dom/client";
import { Component, type ReactNode } from "react";
import "@fontsource/space-grotesk/latin-400.css";
import "@fontsource/space-grotesk/latin-500.css";
import "@fontsource/space-grotesk/latin-600.css";
import "@fontsource/space-grotesk/latin-700.css";
import "@fontsource/dm-mono/latin-400.css";
import { registerSW } from "virtual:pwa-register";
import App from "./App";
import "./styles.css";
class ErrorBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <main className="loading-screen">
        <h1>画面を表示できませんでした</h1>
        <p>保存済みの記録は端末に残っています。</p>
        <button onClick={() => location.reload()}>再読み込み</button>
      </main>
    ) : (
      this.props.children
    );
  }
}
// Touch can trigger :focus-visible on inputs and programmatically focused elements.
document.addEventListener("pointerdown", () => {
  document.documentElement.setAttribute("data-pointer-focus", "");
}, true);
document.addEventListener("keydown", (event) => {
  if (event.key === "Tab") document.documentElement.removeAttribute("data-pointer-focus");
}, true);

createRoot(document.getElementById("root")!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>,
);
// Updates wait until the next visit so a running solve is never interrupted.
registerSW({ immediate: true });
