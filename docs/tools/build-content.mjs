// Regenerates docs/content/ from the module configs. Run: node docs/tools/build-content.mjs
// Numbers come from src/modules/*/*/config.js. The behaviour notes below are written by hand
// from each module's index.js, so update them when the behaviour changes.
import { mkdir, readdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const docs = join(dirname(fileURLToPath(import.meta.url)), "..");
const modules = join(docs, "..", "src", "modules");
const out = join(docs, "content");

const notes = {
  "items/bandage": [
    "Use: heals `heal` HP, capped at max HP. At full health nothing happens and the bandage is kept.",
    "Drop weight: `weight × (0.65 + 2.6 × missingHp) ÷ (1 + bandages held)`, where `missingHp` is the missing fraction of max HP.",
    "Bots value a pickup at `16 + 22 × missingHp`.",
  ],
  "items/crate": [
    "Right-click: pays coins and stands a crate on the aimed tile at once (same reach as a planted charge), independently of equipped gear.",
    "Always costs 20 coins (`BUILD.cost`). Never dropped, carried, equipped or sold in the supply shop.",
    "No standing-crate limit. The tile must be free of operators, zombies, items, charges and fire.",
    "A built crate behaves like cover with durability 2, but gives no score. Breaking it rolls loot with the same chance as any other cover. Another operator who destroys it gets 2 coins. It shows the builder's emblem.",
  ],
  "items/grenade": [
    "Lobbed over walls and cover to any clear tile within `reach` tiles, landing after `flight` seconds. A direct (low) throw uses the charge placement radius and needs a clear path.",
    "It explodes the moment it lands, in a cross of `blastRange` tiles at `powerScale` × the thrower's attack power.",
    "The thrower takes normal blast damage from it, not the reduced damage of an own charge.",
    "Drop weight: `weight ÷ (1 + grenades held)`.",
  ],
  "items/knife": [
    "Permanent: always on the gear wheel, never consumed, never dropped (`weight` 0).",
    "Hits the nearest operator or zombie within `reach` tiles, inside a cone of about 61° around the aim direction, with a clear line of sight.",
    "Zombies have 48 HP, so two strikes kill one. A hit operator is immune for 0.3 s.",
    "Destructible cover in front of the target is struck first: `coverDamage` per swing against a durability of 2. Cover broken this way scores and rolls loot like a blast.",
  ],
  "items/shield": [
    "Use: starts a shield lasting `duration` seconds (stat `duration:shield`). Cannot be used while a shield is up, and is not consumed in that case.",
    "Blocks every melee and zombie hit while active. The first blast breaks it, and that whole explosion deals no damage to the holder.",
    "Drop weight: `weight × (1 + 1.8 × missingHp) ÷ (1 + shieldActive + shields held)`.",
    "Bots value a pickup at 25, or 14 while shielded.",
  ],
  "items/molotov": [
    "Lobbed to any clear tile within `reach` tiles, landing after `flight` seconds. It shatters on landing; there is no fuse.",
    "Lights every open tile within `fire.radius` tiles that the flames can reach without crossing a wall or cover, for `fire.duration` seconds.",
    "Anyone standing in the fire, the thrower included, loses `fire.damage` HP every 0.5 s. A shield blocks it. Zombies that touch it die. It does not open cover or set off charges.",
    "Drop weight: `weight ÷ (1 + Molotovs held)`.",
    "Bots treat burning tiles as blast cells, and throw one at a visible target more than 2.7 tiles away when they hold no grenade.",
  ],
  "skills/kick": [
    "Passive. Stand outside a charge, line up with it (within 0.3 tile sideways, 0.8 tile ahead) and keep pushing into it for 0.12 s.",
    "The charge slides one tile every 0.12 s with its fuse paused, and detonates when it hits a wall, cover, another charge, an operator, a zombie or a blast.",
    "A charge you are still standing on is never kicked. Any other operator walking into a sliding charge sets it off.",
    "Constants: `KICK` and `SLIDE_STEP` in `src/core/geometry.ts`.",
  ],
  "skills/medic": [
    "Heals `heal` HP spread evenly over the duration, capped at max HP. Cannot be cast at full health.",
    "Losing any health stops the treatment. The rest of the heal is lost.",
    "Bots cast it when at least 30 HP is missing.",
  ],
  "skills/scan": [
    "Shows operators and zombies through cover for `duration` seconds.",
    "Bots cast it when they have no opponent in sight.",
  ],
  "skills/detonator": [
    "Every charge you have planted goes off `delay` seconds after the cast, unless its own fuse is shorter.",
    "Thrown explosives are not affected. Cannot be cast with no planted charge.",
    "Bots do not buy it.",
  ],
  "skills/veil": [
    "For `duration` seconds, charges you plant are concealed, and so are the charges you already have on the ground at the cast. A concealed charge stays concealed until it goes off.",
    "Other operators see the charge itself but no blast path. You see the path as a violet dashed outline instead of the usual warning stripes.",
    "Bots cannot read a concealed charge either: they assume a reach of 1 tile, so longer blasts catch them. The fire itself is visible to everyone as usual.",
    "Bots cast it when an opponent they have seen is within 6 tiles.",
  ],
  "skills/cloak": [
    "Invisible for `duration` seconds: other operators do not see your body, health bar, shield or radar blip. Your footsteps are still heard.",
    "Bots lose sight of you and cannot aim charges, grenades, knives or a Missile Strike at you; zombies stop tracking and attacking you. Blasts and the fire zone still hurt.",
    "[Threat Scan](scan.md) reveals cloaked operators to whoever is scanning, bots included.",
    "You see your own arm and body ripple while it lasts. Bots cast it when hurt with an opponent in sight, or with one within 5 tiles.",
  ],
  "perks/missile-strike": [
    "Active perk: stored until you trigger it, then consumed. Only one copy can be held.",
    "Triggering opens the targeting tablet, a 2D map of the arena. Click a tile (or steer with the movement keys and press Enter) to fire; right-click or Esc cancels and keeps the perk. The match keeps running while the tablet is open.",
    "After `delay` seconds the missile lands. Every open or cover tile within `radius` tiles burns for 0.9 s at `power` blast power, falling off with distance from the centre. Walls give no shelter, cover inside is destroyed, and charges inside are set off.",
    "The caller takes full damage from it. A shield blocks it like any blast. Everyone sees the marker on the ground and on the radar and hears the warning.",
    "Bots fire at the opponent they have seen with the most others nearby, never within `radius` + 1.5 tiles of themselves, and move out of a marked area.",
  ],
  "perks/short-fuse": ["Multiplies the fuse of charges you plant by `1 − rate × stacks` (base 2.65 s; two stacks: 1.86 s).", "Offered until you hold `maxStacks`."],
  "perks/last-stand": [
    "While at or below `threshold` × max HP: movement speed × `speed`, and charges planted in that state carry × `power` blast power.",
    "Power is fixed when the charge is planted. Only one copy can be held.",
  ],
  "perks/contract": ["Multiplies every coin reward by `1 + bonus × stacks`.", "Offered until you hold `maxStacks`."],
  "perks/piercing-charge": [
    "Each arm of your blasts destroys the first piece of destructible cover and continues to the next obstacle. Permanent walls still stop it.",
    "Only one copy can be held.",
  ],
  "perks/afterburn": ["Adds `seconds` to the fire duration of your charges per stack (base 0.42 s).", "Offered until you hold `maxStacks`."],
  "perks/apocalypse": [
    "Active perk: stored until you trigger it, then consumed. Only one copy can be held.",
    "After `delay` seconds, all surviving cover moves to new tiles and keeps its damage. Spawn zones, walls, occupied tiles and tiles holding items or charges are protected.",
    "At the same moment fire sweeps the whole floor: every other living operator loses `scorch` HP wherever they stand. A shield blocks it. The caster is spared.",
    "Only offered on maps that implement `randomizeTerrain`. Cannot be triggered while another reset is pending.",
    "Bots trigger it below 45% HP or with an enemy charge within 2.5 tiles.",
  ],
  "perks/armor-training": ["Adds `health` max HP and heals the same amount. No stack limit."],
  "perks/bubble-pocket": ["Adds `amount` to the number of charges you can have placed at once (base 2, and levels 2, 4, 6 and 8 each add one more).", "Offered until capacity reaches `cap`, the ceiling shared with level gains."],
  "perks/capacitor": [
    "Multiplies the cooldown of every active skill by `factor` per stack (two stacks: ×0.64). Applied when the skill is cast.",
    "Requires at least one active skill. Offered until you hold `maxStacks`.",
  ],
  "perks/dimension-collapse": [
    "Active perk: stored until you trigger it, then consumed. Only one copy can be held.",
    "After a `warningSeconds` countdown every operator except the caster is locked in overhead view for `duration` seconds, then returns to their previous view.",
    "Not offered in Classic mode, where everyone is already overhead.",
    "Bots trigger it when an opponent is within 6 tiles.",
  ],
  "perks/endurance": ["Per stack: `amount` max stamina, `regenBonus` × 100% faster stamina recovery, and `amount` stamina restored at once.", "Offered until you hold `maxStacks`."],
  "perks/light-feet": ["Multiplies movement speed by `amount` (base 2.3 tiles/s).", "Offered while speed is below `cap` tiles/s, and never raises it past that."],
  "perks/long-reach": ["Adds `reach` tile(s) to the charge placement radius per stack (base 2).", "Offered until you hold `maxStacks`."],
  "perks/long-wave": ["Adds `amount` tile(s) of blast range to every charge (base 2).", "Offered while range is below `cap`."],
  "perks/repair": ["Heals `heal` HP and sets the shield timer to at least `duration` seconds.", "Offered only while you are hurt or your shield has less than `duration` seconds left."],
  "perks/salvage": ["Heals `heal` HP per stack for each piece of cover you destroy. No stack limit."],
  "perks/shaped-charge": ["Adds `amount` attack power per stack (base 70). Charges switch visuals at 85 and 130 power.", "Offered until you hold `maxStacks`."],
  "perks/siphon": ["Heals `fraction` × stacks of the damage you deal to operators, rounded.", "Offered until you hold `maxStacks`."],
  "mutations/blast-reach": ["Adds `range` tile(s) of blast range per copy, up to `cap`. No longer granted once range reaches `cap`."],
  "mutations/blast-yield": ["Adds `power` attack power per copy. No limit."],
  "mutations/fast-twitch": ["Adds `step` tiles/s of movement speed per copy, up to `cap`. No longer granted once speed reaches `cap`."],
  "mutations/lung-capacity": ["Adds `stamina` max stamina per copy and restores the same amount."],
  "mutations/vitality": ["Adds `health` max HP per copy and heals `heal` HP."],
};

const TIER = { silver: "Silver", gold: "Gold", diamond: "Diamond", mythic: "Mythic" };
const TIER_ORDER = Object.keys(TIER);
const en = (c, key) => c.translations?.en?.[key] ?? c[key];
const fmt = value => typeof value === "object" && value !== null
  ? Object.entries(value).filter(([, v]) => typeof v === "number" || (typeof v === "string" && !/[\/.]/.test(v))).map(([k, v]) => `${k} ${v}`).join(", ")
  : String(value);
const seconds = n => n ? `${n} s` : "–";

async function load(category) {
  const dirs = (await readdir(join(modules, category), { withFileTypes: true })).filter(d => d.isDirectory());
  const configs = await Promise.all(dirs.map(async d =>
    (await import(pathToFileURL(join(modules, category, d.name, "config.js")).href)).default));
  return configs.sort((a, b) => (a.order ?? 100) - (b.order ?? 100) || a.id.localeCompare(b.id, "en"));
}

const facts = {
  items: c => [
    ["Drop pool", c.pool], ["Base drop weight", c.weight], ["Shop price", c.price ? `${c.price} coins` : "not sold"], ["Permanent", c.permanent ? "yes" : "no"],
    c.throwable && ["Throwable", fmt(c.throwable)], c.melee && ["Melee", fmt(c.melee)],
    c.quickEquipCode && ["Default quick key", c.quickEquipCode.replace("Key", "")],
  ],
  skills: c => [
    ["Price", c.price], ["Cooldown", seconds(c.cooldown)], ["Duration", seconds(c.duration)],
    ["Default key", c.code ? c.code.replace("Key", "") : "passive"],
  ],
  perks: c => [
    ["Tier", TIER[c.tier]], ["Weight within tier", c.weight], ["Tag", en(c, "tag")],
    c.requiresSkill && ["Requires skill", `\`${c.requiresSkill}\``],
    c.requiresActiveSkill && ["Requires", "any active skill"],
    c.requiresTerrainReset && ["Requires", "a map with `randomizeTerrain`"],
    c.targeted && ["Targeting", "pick a tile on the targeting tablet"],
  ],
  mutations: () => [],
};
const KIND = { items: "Item", skills: "Skill", perks: "Perk", mutations: "Mutation" };

async function page(category, c) {
  const rows = [
    ["Type", KIND[category]],
    ["ID", `<code>${c.id}</code>`],
    ...facts[category](c).filter(Boolean),
    ...Object.entries(c.stats ?? {}).map(([k, v]) => [`<code>stats.${k}</code>`, v]),
  ];
  const behaviour = notes[`${category}/${c.id}`];
  if (!behaviour) console.warn(`No behaviour notes for ${category}/${c.id}`);
  const cell = (value) => String(value).replace(/`([^`]+)`/g, "<code>$1</code>");
  const text = [
    `# ${en(c, "name")}`,
    "",
    '<table class="infobox">',
    `<caption>${en(c, "name")}</caption>`,
    ...rows.map(([k, v]) => `<tr><th>${cell(k)}</th><td>${cell(v)}</td></tr>`),
    "</table>",
    "",
    `**${en(c, "name")}** is ${/^[aeiou]/i.test(KIND[category]) ? "an" : "a"} ${KIND[category].toLowerCase()} in Demolition Front. In the game it is described as:`,
    "",
    `> ${en(c, "description")}`,
    "",
    "## Behaviour",
    "",
    ...(behaviour ?? ["See the module source."]).map((line) => `- ${line}`),
    "",
    "## Source",
    "",
    `\`src/modules/${category}/${c.id}/\` (\`config.js\` holds the numbers, \`index.js\` the behaviour).`,
    "",
    `See also: [content reference](../README.md), [${KIND[category].toLowerCase()} mods](../../modding/${category === "mutations" ? "other-packs" : category}.md).`,
    "",
  ].join("\n");
  await mkdir(join(out, category), { recursive: true });
  await writeFile(join(out, category, `${c.id}.md`), text);
}

const link = (category, c) => `[${en(c, "name")}](${category}/${c.id}.md)`;
const [items, skills, perks, mutations] = await Promise.all(["items", "skills", "perks", "mutations"].map(load));
perks.sort((a, b) => TIER_ORDER.indexOf(a.tier) - TIER_ORDER.indexOf(b.tier));
for (const [category, list] of Object.entries({ items, skills, perks, mutations }))
  for (const c of list) await page(category, c);

const tierCount = Object.fromEntries(TIER_ORDER.map(t => [t, perks.filter(p => p.tier === t && p.weight > 0).length]));
const index = `<!-- Generated by docs/tools/build-content.mjs. Edit the script, not this file. -->
# Content reference

Every skill, item, perk and mutation in the game, with a page for each. Numbers are read from the module configs.
For how offers and drops are rolled, see [Probabilities](../probabilities.md). For match rules, see [Game rules](../game-rules.md).

## Skills

Bought before the match with starting coins (115 in standard modes), up to 4 skills. See [Skill mods](../modding/skills.md).

| Skill | Key | Price | Cooldown | Duration | Effect |
| --- | --- | --- | --- | --- | --- |
${skills.map(c => `| ${link("skills", c)} | ${c.code ? c.code.replace("Key", "") : "passive"} | ${c.price} | ${seconds(c.cooldown)} | ${seconds(c.duration)} | ${en(c, "description")} |`).join("\n")}

## Items

Dropped by cover, zombies and field supplies, or bought with coins in the supply shop. The knife is permanent gear; crates are built directly with coins. See [Item mods](../modding/items.md).

| Item | Base drop weight | Shop price | Numbers | Effect |
| --- | --- | --- | --- | --- |
${items.map(c => `| ${link("items", c)} | ${c.permanent || !c.weight ? "never drops" : c.weight} | ${c.price ?? "–"} | ${[c.throwable && fmt(c.throwable), c.melee && fmt(c.melee), c.stats && fmt(c.stats)].filter(Boolean).join("; ")} | ${en(c, "description")} |`).join("\n")}

## Perks

Each level-up offers three perks. The tier is rolled first (Silver 61, Gold 30, Diamond 8, Mythic 1), then a perk inside the tier.
"Share in tier" is the chance of a perk once its tier is rolled, when every perk of the tier is eligible and none was in the previous offer.

| Perk | Tier | Share in tier | Limit | Requires | Effect |
| --- | --- | --- | --- | --- | --- |
${perks.map(c => `| ${link("perks", c)} | ${TIER[c.tier]} | ${Math.round(100 * c.weight / perks.filter(p => p.tier === c.tier).reduce((n, p) => n + p.weight, 0))}% | ${c.stats?.maxStacks ? `${c.stats.maxStacks} stacks` : c.stats?.cap ? `stat cap ${c.stats.cap}` : ["apocalypse", "dimension-collapse", "last-stand", "missile-strike", "piercing-charge"].includes(c.id) ? "1 held" : "–"} | ${c.requiresSkill ? `\`${c.requiresSkill}\` skill` : c.requiresActiveSkill ? "an active skill" : c.requiresTerrainReset ? "map with terrain reset" : "–"} | ${en(c, "description")} |`).join("\n")}

Perks per tier: ${TIER_ORDER.map(t => `${TIER[t]} ${tierCount[t]}`).join(", ")}.

## Mutations

A zombie kill can grant one mutation, picked uniformly among those still useful to the operator (${mutations.length} installed). Level 1 and 2 zombies grant one 5% of the time, level 3 always.

| Mutation | Effect |
| --- | --- |
${mutations.map(c => `| ${link("mutations", c)} | ${en(c, "description")} |`).join("\n")}
`;
await writeFile(join(out, "README.md"), index);
console.log(`Wrote ${items.length + skills.length + perks.length + mutations.length} pages to docs/content/`);
