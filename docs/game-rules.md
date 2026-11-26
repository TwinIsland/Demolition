# Game rules

All values are in the code and listed with their source under `src/`. Distances are in tiles, times in seconds.

## Match

| Rule | Value | Source |
| --- | --- | --- |
| Players | 1 human, 1 to 3 bots | `core/room.ts` |
| Win | Last operator alive. There is no timer and score does not decide the winner. If nobody is left it is a draw | `core/systems/match.ts` |
| Modes | Free-for-All, Classic (everyone in the top-down view), Wild, and Practice (no zone, no damage to you, never ends) | `core/match-modes.ts` |
| Skill shop | 115 starting coins, up to 4 skills, bought and refunded before the start. Leftover coins carry into the match | `RULES.startingCredits`, `SLOT_LIMIT` |
| Simulation rate | 60 Hz, fixed | `RULES.step` |

## Safe zone

The boundary wall closes in ring by ring until one operator is left. Source: `core/zone.ts`, `core/systems/zone.ts`.

- **Match duration** in the room settings is the time the zone takes to reach its minimum size: 120, 180 (default) or 240 s.
- Nothing closes for the first 20 s. After that the rings close at even intervals, the last one exactly at the chosen duration. A 19 × 19 map has 7 rings, a 17 × 17 map has 6.
- A ring flashes for 4 s. Before the wall moves, permanent walls, cover, built crates, items, zombies and charges in that ring and the next ring inward are removed, with no blast and no reward. Demolition takes 0.5 s, then the full-height boundary slides inward over 0.85 s, reaching the marked ring at its deadline.
- The moving wall pushes operators inward along its face without dealing damage. Operators can still steer toward the safe area while being pushed.
- The inner ring provides an open escape lane. New crates and charges cannot be placed there during demolition or the advance.
- The centre 3 × 3 stays safe for 15 s after the last ring. Then that square burns: 16 HP/s, rising by 4 every 5 s, through shields, and no one can regain health.

## Operator

| Stat | Standard | Wild | Source |
| --- | --- | --- | --- |
| Health | 100 | 300 | `COMBAT.health` |
| Attack power | 70 | 90 | `COMBAT.attack` |
| Speed (tiles/s) | 2.3 | 3.2 | `RULES.baseSpeed` |
| Blast range | 2 | 4 | `RULES.baseRange` |
| Charges placed at once | 2 | 10 | `RULES.baseCapacity` |
| Stamina | 100 | 160 | `core/stamina.ts` |
| Starting coins | 115 | 260 | `RULES.startingCredits` |
| Score needed per level | ×1 | ×0.5 | `upgradePace` |

Wild values are the `WILD` preset in `core/match-modes.ts`. Wild also regenerates health: 12 HP/s once 5 seconds have passed without losing health, up to max HP, except in the final firestorm (`core/systems/regen.ts`). Classic uses the standard values with `overhead` set, which locks every operator in the top-down view and removes Dimensional Collapse from the perk pool. Placement radius is 2 tiles in every mode. Sprint is ×1.55 speed and drains 25 stamina/s. Stamina recovers 18/s after 0.85 s, and a sprint needs 20 to start.

## Charges and damage

- A charge explodes 2.65 s after placement. Fire stays for 0.42 s.
- The blast is a cross. Walls stop it. The first piece of cover in each arm is destroyed and stops it.
- A blast reaching another charge sets it off.
- Damage to others: `power × remaining × max(0.25, 1 − 0.75 × distance ÷ (range + 1))`, at least 1. `remaining` is the fraction of the fire's lifetime left when you touch it, and `distance` is measured from the charge.
- Your own charge deals 20% of its power, at least 10 (14 at base power). Your own grenade deals full damage.
- After blast or zombie damage you are immune for 1.3 s. After a knife hit, 0.3 s.
- Cover has 2 durability against the knife. Any blast destroys it.
- In overhead view a charge is planted on the tile you stand on, and you walk off it.
- Overhead movement is tile by tile (`moveOnGrid` in `core/systems/movement.ts`): you stand on tile centres, a tap walks exactly one tile, a held key keeps walking without pausing, and a turn pressed during a step is taken when the step ends (0.22 s buffer). A step that gets blocked midway returns to the tile it left. A Slide Kick triggers from the neighbouring tile, since you cannot lean into the charge.

Sources: `core/combat.ts`, `core/geometry.ts`, `core/systems/bombs.ts`, `RULES` in `core/content.ts`.

## Score and levels

Score doubles as experience. Each level grants fixed stat gains and a perk offer.

| Action | Score | Coins |
| --- | --- | --- |
| Destroy cover | 25 | 4 |
| Damage an operator | 20% of the damage, at least 1 | 6 per hit |
| Eliminate an operator | 100 | 30 |
| Pick up an item | 10 | – |
| Kill a zombie (level 1 / 2 / 3) | 40 / 60 / 100 | 5 / 8 / 12 |
| Destroy another operator's built crate | 0 | 2 |

The first level-up needs 75, and each later one needs 50 more than the last (75, 125, 175, …). Wild mode halves these (38, 63, 88, …). Every level-up offers three perks, see [Probabilities](probabilities.md).

Each level also grants fixed gains (`core/level-rewards.ts`). Levelling never heals: extra max HP arrives empty.

| Level | Total score | Fixed gain | Capacity | Max HP | Range | Attack |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | 0 | – | 2 | 100 | 2 | 70 |
| 2 | 75 | +1 capacity | 3 | 100 | 2 | 70 |
| 3 | 200 | +10 max HP | 3 | 110 | 2 | 70 |
| 4 | 375 | +1 capacity | 4 | 110 | 2 | 70 |
| 5 | 600 | +1 range | 4 | 110 | 3 | 70 |
| 6 | 875 | +1 capacity, +10 max HP | 5 | 120 | 3 | 70 |
| 7 | 1200 | +10 attack | 5 | 120 | 3 | 80 |
| 8 | 1575 | +1 capacity, +10 max HP | 6 | 130 | 3 | 80 |
| 9 | 2000 | +1 range | 6 | 130 | 4 | 80 |
| 10+ | +50 more per level | +10 max HP | 6 | +10 per level | 4 | 80 |

The table shows standard mode without perks or mutations. Capacity from all sources stops at 7 and range at 5; a gain that would pass its ceiling is skipped, so Wild mode, which starts at 10 charges, gets no capacity from levels.

## Coins and crate building

Source: `core/economy.ts`, `core/systems/building.ts`, the [Field Crate](content/items/crate.md) item.

- Coins left after the skill shop, plus coins earned in the match, pay for building and the [supply shop](#supply-shop).
- Right-click to build a crate on the tile you aim at, without changing equipment or buying an item first. It is aimed like a planted charge and reaches as far (the placement radius, 2 tiles by default). Every crate costs 20 coins and stands at once, with no build time. In the top-down view it goes on the tile ahead.
- There is no limit on how many crates you can have standing at once; each site must still be clear and affordable.
- A built crate blocks movement and blasts like any cover and has the same durability. It gives no score, but drops loot with the same chance as any other cover. It shows the builder's emblem.

## Supply shop

Source: `SUPPLY` in `core/economy.ts`, `core/systems/supply.ts`.

- Hold B during a match to open the supply wheel, slide to an item and release to buy it with coins. The match does not pause. The shop closes in the final firestorm.
- Prices: bandage 25, Molotov 30, grenade 35, shield 40. Crates are built directly; the knife is not sold.
- Each earlier purchase of the same item this match adds 25% of its base price (grenade: 35, 44, 53, …).
- You must wait 6 s between purchases, and cannot buy an item while carrying 3 of it.
- The item goes straight into your inventory.

## Zombies

| Level | Spawn share | Speed (chasing) | Sight | Damage | Gear drop | Mutation |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | 58% | 0.96 (×1.42) | 6 | 10 | 70% | 5% |
| 2 | 30% | 1.34 (×1.55) | 7 | 16 | 82% | 5% |
| 3 | 12% | 1.85 (×1.65) | 8 | 24 | 90% | 100% |

- Every zombie has 48 HP against the knife and dies to any blast. A zombie that survives a knife hit is knocked back 0.8 tile and staggered for 0.4 s.
- At most 6 are alive. They spawn at least 3 steps from every operator.
- Spawn interval by room setting: low 10–17 s (first at 8 s), standard 5–9 s (first at 4 s), high 2.5–5 s (first at 2.5 s), or off.
- A zombie strikes within 0.55 tile, 0.18 s after winding up, at most every 1.3 s.

Sources: `ZOMBIE_STATS` in `core/loot.ts`, `core/zombies.ts`, `ZOMBIE_RATES` in `core/room.ts`.
