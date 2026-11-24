import { createRoot } from "react-dom/client";
import { Component, type ReactNode } from "react";
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

// Keep browser zoom gestures from competing with the timer and cube controls.
window.addEventListener("wheel", (event) => {
  if (event.ctrlKey || event.metaKey) event.preventDefault();
}, { passive: false });
window.addEventListener("keydown", (event) => {
  if ((event.ctrlKey || event.metaKey) &&
    (["+", "=", "-", "0", "−"].includes(event.key) ||
      ["NumpadAdd", "NumpadSubtract"].includes(event.code))) event.preventDefault();
}, { capture: true });
window.addEventListener("touchmove", (event) => {
  if (event.touches.length > 1 && event.cancelable) event.preventDefault();
}, { passive: false });
for (const type of ["gesturestart", "gesturechange"]) {
  window.addEventListener(type, (event) => event.preventDefault(), { passive: false });
}

createRoot(document.getElementById("root")!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>,
);
// Updates wait until the next visit so a running solve is never interrupted.
registerSW({ immediate: true });
