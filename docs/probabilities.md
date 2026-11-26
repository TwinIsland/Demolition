# Probabilities

How the game rolls perk offers, loot, zombies and mutations. Every roll uses the match's seeded random generator, so a seed replays the same match.

## Perk offers

Source: `rollPerks` in `src/core/content.ts`, `offerUpgrades` in `src/core/systems/progression.ts`.

A level-up offers 3 different perks. Each of the 3 slots is rolled in two steps.

**1. Eligible pool.** A perk is in the pool when all of these hold:

- its `weight` is above 0;
- `requiresSkill` is owned, `requiresActiveSkill` is met, `requiresTerrainReset` perks only appear on maps with `randomizeTerrain`, and `requiresFreeView` perks are left out of Classic mode;
- its `eligible(player)` returns true (stack limits and stat caps live here);
- it was not already picked for an earlier slot of this offer.

**2. Tier, then perk.** The tier is rolled by weight among tiers that still have a perk in the pool:

| Tier | Weight | Chance with all tiers available |
| --- | --- | --- |
| Silver | 61 | 61% |
| Gold | 30 | 30% |
| Diamond | 8 | 8% |
| Mythic | 1 | 1% |

A tier with no eligible perk is left out and the rest are renormalised. For example, while you hold Dimensional Collapse there is no Mythic tier, so Silver becomes 61 ÷ 99.

Inside the tier, a perk's chance is its `weight`, doubled if it was **not** in your previous offer. Perks you just saw and passed on are therefore half as likely to return.

**Pity.** After two offers in a row made only of Silver perks, the next offer is protected: if its first two slots come up Silver, the third slot cannot be Silver. That slot is then Gold 76.9%, Diamond 20.5%, Mythic 2.6% (30 : 8 : 1). The counter resets whenever an offer contains a non-Silver perk.

Without pity, an all-Silver offer happens about 0.61³ ≈ 23% of the time.

## Cover drops

Source: `src/core/loot.ts`, `destroyCover` in `src/core/systems/loot.ts`.

### Does it drop?

Each operator has a miss counter. The base chance rises with every piece of cover that gave them nothing, and resets on a drop:

| Misses in a row | 0 | 1 | 2 | 3 | 4+ |
| --- | --- | --- | --- | --- | --- |
| Base chance | 30% | 39% | 51% | 69% | 100% |

The final chance is `clamp(base + 0.12 × shortage, 10%, 97%)`. A base of 100% always drops. Cover on a tile that already holds an item does not roll and does not move the counter. Crates built by players and cover removed by the closing wall never drop anything.

### Shortage

`shortage` ranges from −1 to 1 and measures how much the operators near the drop need supplies.

```text
influence(p) = (1.6 if p broke the cover, else 1) ÷ (1 + 0.18 × distance from p to the drop)
need(p)      = 0.65 − 0.25 × min(consumables carried, 5) + 0.55 × missing HP fraction
shortage     = Σ influence(p) × need(p) ÷ Σ influence(p)  −  0.14 × min(4, consumables on the ground within 5 tiles)
```

All living operators count, bots included. An empty-handed, wounded operator close to the cover raises the chance by up to 12 points. A well-stocked area lowers it by as much.

### Which item?

Only non-permanent items in the `supply` pool can drop. Each gets a weight:

```text
weight(item) = Σ influence(p) × dropWeight(item, p) ÷ Σ influence(p)  ÷  (1 + 0.65 × same items on the ground within 5 tiles)
```

`dropWeight` is the item's own formula. Items without one use their base `weight`.

| Item | Base | `dropWeight` |
| --- | --- | --- |
| Frag Grenade | 2.4 | `base ÷ (1 + held)` |
| Molotov | 2.6 | `base ÷ (1 + held)` |
| Tactical Shield | 3.4 | `base × (1 + 1.8 × missingHp) ÷ (1 + shieldActive + held)` |
| Bandage | 3 | `base × (0.65 + 2.6 × missingHp) ÷ (1 + held)` |

Resulting shares for one operator with an empty inventory and nothing on the ground:

| Health | Grenade | Molotov | Shield | Bandage |
| --- | --- | --- | --- | --- |
| 100% | 23.2% | 25.1% | 32.9% | 18.8% |
| 50% | 13.9% | 15.0% | 37.3% | 33.8% |

Carrying one of an item halves its weight for you, and each copy already lying nearby cuts it further.

## Zombie drops

A killed zombie rolls gear with a base chance of 70%, 82% or 90% for level 1, 2 or 3, adjusted by the same `shortage` term. The item is chosen as above, with the killer weighted 1.6. The item lands on the zombie's tile or a free neighbour.

Separately, the kill grants a mutation with chance 5%, 5% or 100%. The mutation is uniform among installed mutations whose `eligible(player)` is true or absent (5 installed, so 20% each until Blast Expansion or Fast-Twitch Fibers reach their caps). If none is eligible, all are candidates again.

Spawn levels are 58% level 1, 30% level 2, 12% level 3. See [Game rules](game-rules.md#zombies).

## Field supplies

Source: `src/core/field-supplies.ts`.

Every 8 to 14 s (uniform) one item appears on a random free tile at least 2 steps from every operator and outside the blast of any placed charge. No more than 3 field supplies lie on the map at once. The item is chosen with the cover formula, with no operator weighted as owner.

## Obstacle appearance

Which obstacle model stands on a cover tile is cosmetic. It is rolled per tile from the map's weighted `obstacles` pool with a generator seeded by the match seed and the tile, so previews and matches agree. See [Map mods](modding/maps.md#obstacles).
