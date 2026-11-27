import { bindings } from "../input/bindings";
import type { GameApp } from "./game-app";

const TEXT_FIELDS =
  'textarea,input:not([type]),input[type="text"],input[type="search"],[contenteditable="true"]';
const FOCUSABLE_CONTROLS = "select,button,summary,input,a";
const OFFER_ACTIONS = ["reward1", "reward2", "reward3"];
/** Cursor steps on the targeting tablet, by key code or movement action. */
const TARGET_STEPS: Readonly<Record<string, readonly [number, number] | undefined>> = {
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  forward: [0, -1],
  back: [0, 1],
  left: [-1, 0],
  right: [1, 0],
};

const editable = (target: EventTarget | null) => target instanceof Element && !!target.closest(TEXT_FIELDS);

/** Stops browser gestures that break a mouse-driven game: context menu, text selection, drags, select-all. */
export function installPageGuards() {
  document.addEventListener("contextmenu", (event) => event.preventDefault());
  for (const name of ["selectstart", "dragstart"])
    document.addEventListener(name, (event) => {
      if (!editable(event.target)) event.preventDefault();
    });
  document.addEventListener("keydown", (event) => {
    if ((event.ctrlKey || event.metaKey) && event.code === "KeyA" && !editable(event.target))
      event.preventDefault();
  });
}

/**
 * Translates page-level keyboard, pointer and focus events into `GameApp` calls. In-match movement
 * and aiming are read by `KeyboardAgent`; this covers menus, chat, the wheel and losing focus.
 */
export function attachGlobalInput(app: GameApp, root: HTMLElement, canvas: HTMLCanvasElement): () => void {
  const listeners = new AbortController();
  const { signal } = listeners;
  // Last unlocked pointer position, for wheel drags that start without pointer lock.
  let pointerX: number | undefined;
  let pointerY: number | undefined;

  function onChatKey(event: KeyboardEvent) {
    // Enter that confirms an IME composition must not send the message.
    if (event.isComposing || event.keyCode === 229) return;
    if (event.code !== "Enter" && event.code !== "Escape") return;
    event.preventDefault();
    if (!event.repeat) app.leaveChat(event.code === "Enter");
  }

  function onKeyDown(event: KeyboardEvent) {
    if (app.screen === "loading") return;
    if (app.chatting) {
      onChatKey(event);
      return;
    }
    if (app.screen === "story") {
      // The story reads its own keys; only the way out is handled here.
      if (event.code === "Escape" && !event.repeat) app.back();
      // A scene that has handed over the hero plays like a match: gear, wheel and reward keys.
      if (app.storyControlled && !event.repeat && !event.altKey && !event.ctrlKey && !event.metaKey)
        onPlayKey(event, bindings.action(event.code));
      return;
    }
    if (event.altKey || event.ctrlKey || event.metaKey || event.isComposing) return;
    if (app.screen === "replay") {
      // The killcam takes no input except the keys that cut it short.
      event.preventDefault();
      if (!event.repeat && (event.code === "Space" || event.code === "Enter" || event.code === "Escape"))
        app.skipReplay();
      return;
    }
    const action = bindings.action(event.code);
    if (app.targeting) {
      // The targeting tablet owns the keyboard: steer the cursor, fire, or put it away.
      const step = TARGET_STEPS[event.code] ?? (action ? TARGET_STEPS[action] : undefined);
      event.preventDefault();
      if (event.code === "Escape" || action === "usePerk" || action === "pause") {
        if (!event.repeat) app.endTargeting();
      } else if (event.code === "Enter" || event.code === "Space") {
        if (!event.repeat) app.confirmTargeting();
      } else if (step) app.steerTargeting(step[0], step[1]);
      return;
    }
    if (action === "fullscreen" && !editable(event.target)) {
      event.preventDefault();
      if (!event.repeat) app.toggleFullscreen();
      return;
    }
    if (app.screen === "playing" && action === "chat") {
      event.preventDefault();
      if (!event.repeat) app.openChat();
      return;
    }
    const onControl = event.target instanceof Element && !!event.target.closest(FOCUSABLE_CONTROLS);
    if (event.code === "Enter" && app.screen === "lobby" && !onControl) {
      event.preventDefault();
      if (!event.repeat) app.confirmLobby();
    }
    if (action === "expand" && app.screen === "playing") {
      event.preventDefault();
      if (!event.repeat) app.togglePerks();
    }
    const pauseKey = action === "pause" && (app.screen === "playing" || app.screen === "paused");
    if (event.code === "Escape" || pauseKey) {
      if (event.repeat) return;
      app.back();
    }
    if (!app.controllingPlayer || event.repeat) return;
    onPlayKey(event, action);
  }

  /** Keys that only mean something while the keyboard drives a player. */
  function onPlayKey(event: KeyboardEvent, action: ReturnType<typeof bindings.action>) {
    if (action === "expand") {
      // In a match the handler above has taken this key already.
      if (app.screen === "story") {
        event.preventDefault();
        app.togglePerks();
      }
    } else if (action === "gearWheel") {
      event.preventDefault();
      if (!editable(event.target)) app.equipment.beginWheel(event.code);
    } else if (action?.startsWith("equip:") && !app.topDown && !editable(event.target)) {
      event.preventDefault();
      app.equipment.quickEquip(action.slice("equip:".length));
    } else if (action && OFFER_ACTIONS.includes(action)) {
      if (app.chooseOffer(OFFER_ACTIONS.indexOf(action))) event.preventDefault();
    }
  }

  function onMouseMove(event: MouseEvent) {
    const locked = document.pointerLockElement === canvas;
    // Unlocked moves have no reliable movementX/Y on every browser, so diff the positions.
    const dx = locked || pointerX === undefined ? event.movementX : event.clientX - pointerX;
    const dy = locked || pointerY === undefined ? event.movementY : event.clientY - pointerY;
    app.equipment.moveWheel(dx, dy);
    pointerX = locked ? undefined : event.clientX;
    pointerY = locked ? undefined : event.clientY;
  }

  function onPointerLockChange() {
    pointerX = pointerY = undefined;
    // Losing the lock while playing means Esc or a focus change: pause, silently if the tab is away.
    if (!document.pointerLockElement && app.storyControlled && !app.topDown) app.back();
    else if (!document.pointerLockElement && app.controllingPlayer)
      app.pause(document.hasFocus() && !document.hidden);
  }

  window.addEventListener("keydown", onKeyDown, { signal });
  window.addEventListener("keyup", (event) => app.equipment.releaseKey(event.code), { signal });
  window.addEventListener("mousemove", onMouseMove, { signal });
  window.addEventListener("blur", () => app.pause(false), { signal });
  document.addEventListener("pointerlockchange", onPointerLockChange, { signal });
  document.addEventListener(
    "visibilitychange",
    () => {
      if (document.hidden) app.pause(false);
    },
    { signal },
  );
  root.addEventListener(
    "change",
    (event) => {
      if (event.target instanceof Element && event.target.matches('select,input[type="checkbox"]'))
        app.playClick();
    },
    { signal },
  );
  root.addEventListener(
    "auxclick",
    (event) => {
      // Middle click would start browser autoscroll over the canvas.
      if (app.screen === "playing" && event.button === 1) event.preventDefault();
    },
    { signal },
  );
  canvas.addEventListener("click", () => app.recapturePointer(), { signal });
  return () => listeners.abort();
}
