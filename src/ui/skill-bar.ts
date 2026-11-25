import { SHOP_SKILLS, SKILLS, modifiedStat } from "../core/content";
import type { SkillId } from "../core/types";
import { field, t } from "../i18n";
import { skillBinding } from "../input/bindings";
import { keyHint } from "./control-settings";
import { query, setText } from "./dom";
import { icon } from "./icons";
import type { HudFrame, HudView } from "./view";

/** Key cap for a skill; passive skills have no binding. */
export const skillKeyHint = (id: SkillId) =>
  SKILLS[id].passive ? `<kbd>${t("被动")}</kbd>` : keyHint(skillBinding(id));

const skillButton = (id: SkillId) => {
  const skill = SKILLS[id];
  return `<button class="skill-button" data-skill="${id}" aria-label="${field(skill, "name")}"><span class="skill-visual">${icon(skill.icon)}<i class="clock-shade" id="${id}-progress"></i><svg class="clock-ring" viewBox="0 0 40 40" aria-hidden="true"><circle id="${id}-ring" cx="20" cy="20" r="18" pathLength="100"/></svg></span><span><b>${field(skill, "name")}</b><small id="${id}-time">就绪</small></span>${skillKeyHint(id)}</button>`;
};

interface SkillSlot {
  id: SkillId;
  button: HTMLButtonElement;
  name: HTMLElement;
  status: HTMLElement;
  shade: HTMLElement;
  ring: Element;
}

/** Bottom-right row of purchased skills with cooldown clocks. */
export class SkillBarView implements HudView {
  private readonly slots: SkillSlot[];

  constructor(readonly root: HTMLElement) {
    root.innerHTML = SHOP_SKILLS.map(skillButton).join("");
    this.slots = SHOP_SKILLS.map((id) => {
      const button = query<HTMLButtonElement>(root, `[data-skill="${id}"]`);
      return {
        id,
        button,
        name: query(button, "b"),
        status: query(button, `#${id}-time`),
        shade: query(button, `#${id}-progress`),
        ring: query<Element>(button, `#${id}-ring`),
      };
    });
  }

  refreshLanguage() {
    for (const { id, button, name } of this.slots) {
      button.ariaLabel = field(SKILLS[id], "name");
      name.textContent = button.ariaLabel;
      if (SKILLS[id].passive) query(button, "kbd").textContent = t("被动");
    }
  }

  update({ snapshot, viewer }: HudFrame) {
    const { time } = snapshot;
    for (const { id, button, status, shade, ring } of this.slots) {
      const skill = SKILLS[id];
      const active = skill.isActive?.(viewer, time);
      const locked = !!skill.isActive && !!skill.canActivate && !skill.canActivate(viewer, time);
      const remaining = Math.max(0, (viewer.cooldowns[id] ?? 0) - time);
      setText(
        status,
        locked
          ? t("视角锁定")
          : active
            ? t("已开启")
            : remaining > 0
              ? t("{0} 秒冷却", Math.ceil(remaining))
              : skill.passive
                ? t("被动")
                : t("技能就绪"),
      );
      const fraction = Math.min(
        1,
        remaining / Math.max(0.001, modifiedStat(viewer, "cooldown", skill.cooldown, time)),
      );
      shade.style.setProperty("--remaining", `${fraction * 360}deg`);
      ring.setAttribute("stroke-dasharray", `${(1 - fraction) * 100} 100`);
      button.classList.toggle("cooling", remaining > 0);
      if (skill.isActive) button.setAttribute("aria-pressed", String(active));
      button.hidden = !viewer.skills.includes(id);
      button.disabled =
        locked || !!skill.passive || remaining > 0 || !viewer.alive || snapshot.phase !== "playing";
    }
  }

  dispose() {}
}
