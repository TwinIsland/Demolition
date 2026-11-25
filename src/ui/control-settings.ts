import { t } from "../i18n";
import {
  ACTIONS,
  BASIC_CONTROLS,
  bindings,
  equipmentBinding,
  type BindingId,
  type EquipmentBinding,
} from "../input/bindings";

export const keyHint = (id: BindingId) => `<kbd data-keyhint="${id}">${bindings.label(id)}</kbd>`;
const manualKey = (id: BindingId) => (bindings.codes(id).length ? bindings.label(id, true) : t("未绑定"));

export function bindingButton(id: BindingId, label: string, name = label) {
  return `<button type="button" class="binding-button" data-bind="${id}" aria-label="${t("修改{0}的快捷键", name)}" aria-describedby="bind-key-${id}"><span>${label}</span><kbd id="bind-key-${id}">${manualKey(id)}</kbd></button>`;
}

export function quickEquipControl(item: string, name: string) {
  const id = equipmentBinding(item);
  return `<div class="equip-binding">${bindingButton(id, t("快速装备"), name)}
    <button type="button" class="clear-binding" data-clear-bind="${id}" aria-label="${t("清除{0}的快捷键", name)}" ${bindings.codes(id).length ? "" : "disabled"}>${t("清除")}</button></div>`;
}

export function controlSettings() {
  return `<details class="guide-section" open><summary>${t("基础操作")}</summary>
    <div class="control-grid">${ACTIONS.map((id) => `<div>${bindingButton(id, t(BASIC_CONTROLS[id][0]))}</div>`).join("")}</div></details>`;
}

export function mountControls(panel: HTMLElement) {
  let listening: HTMLButtonElement | null = null;
  const status = document.createElement("p");
  status.className = "binding-status";
  status.setAttribute("role", "status");
  status.setAttribute("aria-live", "polite");
  function refreshButton(button: HTMLButtonElement) {
    button.querySelector("kbd")!.textContent = manualKey(button.dataset.bind as BindingId);
  }
  function refreshControls() {
    panel.querySelectorAll<HTMLButtonElement>("[data-bind]").forEach(refreshButton);
    for (const button of panel.querySelectorAll<HTMLButtonElement>("[data-clear-bind]"))
      button.disabled = !bindings.codes(button.dataset.clearBind as EquipmentBinding).length;
  }
  function stop(message: string) {
    if (listening) {
      listening.classList.remove("listening");
      refreshButton(listening);
    }
    listening = null;
    status.textContent = message;
  }
  function accept(code: string) {
    if (!listening) return;
    const id = listening.dataset.bind as BindingId;
    const error = bindings.bind(id, code);
    if (error) {
      status.textContent = error + t("，请选择其他键");
      return;
    }
    refreshControls();
    stop(t("键位已保存"));
  }
  panel.addEventListener("focusout", (e) => {
    if (e.target === listening) stop("");
  });
  panel.addEventListener("click", (e) => {
    const button = (e.target as Element).closest<HTMLButtonElement>(
      "[data-bind],[data-clear-bind],[data-reset-controls]",
    );
    if (!button) return;
    if (button.hasAttribute("data-reset-controls")) {
      bindings.reset();
      refreshControls();
      button.parentElement!.after(status);
      stop(t("已恢复默认键位"));
    } else if (button.dataset.clearBind) {
      bindings.unbind(button.dataset.clearBind as EquipmentBinding);
      const group = button.parentElement!;
      group.querySelector<HTMLButtonElement>("[data-bind]")!.focus();
      refreshControls();
      group.after(status);
      stop(t("快捷键已清除"));
    } else if (button === listening) {
      if (e.detail) accept("Mouse0");
    } else {
      stop("");
      listening = button;
      button.focus();
      button.classList.add("listening");
      button.querySelector("kbd")!.textContent = "…";
      (button.closest(".equip-binding") ?? button).after(status);
      status.textContent = button.dataset.bind?.startsWith("equip:")
        ? t("按下新键。Esc 取消")
        : t("按下新键，或在此项上按鼠标键。Esc 取消");
    }
  });
  panel.addEventListener("keydown", (e) => {
    if (!listening) return;
    e.preventDefault();
    e.stopPropagation();
    if (e.repeat || e.isComposing) return;
    if (e.code === "Escape") {
      stop(t("已取消"));
      return;
    }
    if (e.metaKey || e.ctrlKey || e.altKey) {
      status.textContent = t("请选择单个按键");
      return;
    }
    accept(e.code);
  });
  panel.addEventListener("pointerdown", (e) => {
    if (!listening || !e.button || !(e.target instanceof Node && listening.contains(e.target))) return;
    e.preventDefault();
    e.stopPropagation();
    accept("Mouse" + e.button);
  });
  panel.addEventListener(
    "wheel",
    (e) => {
      if (!listening || !e.deltaY || !(e.target instanceof Node && listening.contains(e.target))) return;
      e.preventDefault();
      accept(e.deltaY < 0 ? "WheelUp" : "WheelDown");
    },
    { passive: false },
  );
}
