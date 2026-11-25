import { field, format, type Language, type Translations } from "../i18n";

type Argument = number | string | { name:string; translations?:Translations; bot?:boolean };
export interface CombatMessage { zh:string; en:string }

export function combatMessage(key:string,...args:Argument[]):CombatMessage {
  function render(locale:Language) {
    const values = args.map(arg => {
      if (typeof arg === "number") return arg;
      if (typeof arg === "string") return format(locale,arg);
      if (arg.bot === false && arg.name === "你") return format(locale,"你");
      return field(arg,"name",locale);
    });
    return format(locale,key,...values);
  }
  return {zh:render("zh"),en:render("en")};
}
