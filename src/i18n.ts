import { english } from "./locales/en";

export type Language = "en" | "zh";
export type Translations = Partial<Record<Language, Partial<Record<"name" | "description" | "tag" | "subtitle",string>>>>;
const preference = "demolition-language";
export let language:Language = "en";
try { if (localStorage.getItem(preference) === "zh") language = "zh"; } catch {}

export function setLanguage(value:Language) {
  language = value;
  try { localStorage.setItem(preference,value); } catch {}
}

/** Source messages use numbered placeholders so each language controls word order. */
export function t(source:string, ...values:(string|number)[]):string {
  return format(language,source,...values);
}
export function format(locale:Language,source:string,...values:(string|number)[]) {
  const message = locale === "en" && Object.hasOwn(english,source) ? english[source] : source;
  return values.length ? message.replace(/\{(\d+)\}/g,(token,i)=>String(values[Number(i)] ?? token)) : message;
}

export function field<K extends "name"|"description"|"tag"|"subtitle">(pack:Record<K,string> & {translations?:Translations}, key:K, locale=language) {
  return pack.translations?.[locale]?.[key] ?? pack[key];
}

/** Bind static shell copy once. Dynamic HUD and player-supplied text render independently. */
export function bindShellCopy(root:HTMLElement) {
  const refresh:(()=>void)[] = [];
  function bind(value:string, write:(next:string)=>void) {
    const key=value.trim();
    if (!Object.hasOwn(english,key)) return;
    refresh.push(()=>write(value.replace(key,()=>t(key))));
  }
  const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);
  for (let node=walker.nextNode();node;node=walker.nextNode()) {
    const text=node as Text;
    bind(text.data,next=>{text.data=next;});
  }
  for (const el of root.querySelectorAll("[title],[aria-label],[placeholder]"))
    for (const attr of ["title","aria-label","placeholder"]) {
      const value=el.getAttribute(attr);
      if (value) bind(value,next=>el.setAttribute(attr,next));
    }
  return () => refresh.forEach(update=>update());
}
