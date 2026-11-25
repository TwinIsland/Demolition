// Cascade order is significant: these come first and in this sequence, whatever the views import.
import "./style.css";
import "./ui/match-room.css";
import "./ui/reward-effects.css";
import "./ui/equipment-wheel.css";
import "./ui/deployment-menu.css";
import "./ui/mutation-notice.css";
import { GameApp } from "./app/game-app";
import { attachGlobalInput, installPageGuards } from "./app/global-input";
import { t } from "./i18n";
import { GameRenderer } from "./render/game-renderer";

/** Composition root: runs after the content catalog has loaded (see bootstrap.ts). */
const root = document.querySelector<HTMLElement>("#app")!;
installPageGuards();

let renderer: GameRenderer;
try {
  renderer = new GameRenderer(root);
} catch (error) {
  // bootstrap.ts shows this message on the loading screen.
  throw new Error(t("需要 WebGL 2，请启用浏览器硬件加速"), { cause: error });
}

const app = new GameApp(root, renderer);
const detachInput = attachGlobalInput(app, root, renderer.canvas);
app.start();

window.addEventListener(
  "pagehide",
  () => {
    detachInput();
    app.dispose();
  },
  { once: true },
);
