<p align="center">
  <img src="docs/media/logo.png" width="96" alt="Demolition Front logo" />
</p>

<h1 align="center">DEMOLITION FRONT · 爆破前线</h1>

<p align="center">
  <b>A first-person, roguelite take on the classic bomb-arena game.</b><br />
  Plant charges. Blow open cover. Draft a different build every match.
</p>

<p align="center">
  <a href="https://twinisland.github.io/Demolition/"><img src="https://img.shields.io/badge/%E2%96%B6%20PLAY%20NOW-in%20your%20browser-e8b23a?style=for-the-badge&labelColor=14181b" alt="Play now in your browser" /></a>
  <a href="https://twinisland.github.io/Demolition/wiki/"><img src="https://img.shields.io/badge/WIKI-rules%20%26%20content-7fa98f?style=for-the-badge&labelColor=14181b" alt="Wiki" /></a>
</p>

<p align="center">
  <a href="https://twinisland.github.io/Demolition/"><img src="docs/media/home.jpg" alt="Main menu of Demolition Front" /></a>
</p>

The idea came to me in a dream one night: what if you played Crazy Arcade (泡泡堂) in first person, and every match let you build a different character?

You drop into a grid arena with up to three AI opponents. Charges explode in a cross, cover hides gear, a safe zone closes in, and zombies roam the lanes. The last operator standing wins.

<table>
  <tr>
    <td width="50%"><img src="docs/media/first-person.jpg" alt="Facing an opponent in the rain on Outpost" /></td>
    <td width="50%"><img src="docs/media/play-rainforest.jpg" alt="First-person view in the Rainforest" /></td>
  </tr>
  <tr>
    <td><img src="docs/media/play-pool.jpg" alt="Wading through the Pool" /></td>
    <td><img src="docs/media/play-backrooms.jpg" alt="A corridor in the Backrooms" /></td>
  </tr>
  <tr>
    <td><img src="docs/media/perk-draft.jpg" alt="Three perk cards offered after a level-up on Warehouse" /></td>
    <td><img src="docs/media/top-down.jpg" alt="Classic mode on the top-down board, with a cross-shaped blast" /></td>
  </tr>
</table>

## Five arenas

Each map has its own layout rules, weather, footsteps, ambience and soundtrack.

<table>
  <tr>
    <td width="50%">
      <img src="src/modules/maps/dream-garden/backdrop.webp" alt="Outpost key art" /><br />
      <b>OUTPOST</b> · 19 × 19<br />
      A rain-soaked forward base. The standard arena, with wet concrete that mirrors every blast.
    </td>
    <td width="50%">
      <img src="src/modules/maps/rainforest/backdrop.webp" alt="Rainforest key art" /><br />
      <b>RAINFOREST</b> · 31 × 31<br />
      The big one. Temple ruins under a monsoon canopy, with grass, mud and stone underfoot.
    </td>
  </tr>
  <tr>
    <td>
      <img src="src/modules/maps/night-lab/backdrop.webp" alt="Warehouse key art" /><br />
      <b>WAREHOUSE</b> · 17 × 17<br />
      Close quarters between the shelves. Short lanes, fast fights.
    </td>
    <td>
      <img src="src/modules/maps/poolrooms/backdrop.webp" alt="Pool key art" /><br />
      <b>POOL</b> · 21 × 21<br />
      Endless white tile and ankle-deep water. Wade through canals with ripples and caustics at your feet.
    </td>
  </tr>
  <tr>
    <td>
      <img src="src/modules/maps/backrooms/backdrop.webp" alt="Backrooms key art" /><br />
      <b>BACKROOMS</b> · 21 × 21<br />
      Yellow rooms without end. The lights stutter, and every half minute the walls move.
    </td>
    <td>
      <img src="docs/media/menu-maps.jpg" alt="Map selection in the main menu" /><br />
      <b>YOUR MAP HERE</b><br />
      Maps are self-contained modules. The <a href="docs/modding/maps.md">map modding guide</a> shows how to add one.
    </td>
  </tr>
</table>

## Build your operator

### Skills

Spend your starting coins on up to four skills before you deploy.

<table>
  <tr>
    <td align="center" width="16%"><img src="src/modules/skills/detonator/icon.webp" width="72" alt="" /><br /><b>Remote Detonator</b><br /><sub>Set off all your charges at once</sub></td>
    <td align="center" width="16%"><img src="src/modules/skills/kick/icon.webp" width="72" alt="" /><br /><b>Slide Kick</b><br /><sub>Kick a charge down the lane</sub></td>
    <td align="center" width="16%"><img src="src/modules/skills/medic/icon.webp" width="72" alt="" /><br /><b>Med Injector</b><br /><sub>Heal 30 HP over 3 seconds</sub></td>
    <td align="center" width="16%"><img src="src/modules/skills/scan/icon.webp" width="72" alt="" /><br /><b>Threat Scan</b><br /><sub>See everyone through cover</sub></td>
    <td align="center" width="16%"><img src="src/modules/skills/veil/icon.webp" width="72" alt="" /><br /><b>Blind Fuse</b><br /><sub>Hide your blast paths</sub></td>
    <td align="center" width="16%"><img src="src/modules/skills/cloak/icon.webp" width="72" alt="" /><br /><b>Optical Camo</b><br /><sub>Turn invisible for 6 seconds</sub></td>
  </tr>
</table>

### Perks

Score is experience. Every level-up adds a fixed boost and deals you three perk cards in Silver, Gold, Diamond or Mythic. They stack for the rest of the match, so no two runs play the same.

<table>
  <tr>
    <td align="center" width="20%"><img src="src/modules/perks/missile-strike/icon.webp" width="72" alt="" /><br /><b>Missile Strike</b><br /><sub>Diamond · call a missile onto any tile; it ignores walls</sub></td>
    <td align="center" width="20%"><img src="src/modules/perks/hijack/icon.webp" width="72" alt="" /><br /><b>Hijack</b><br /><sub>Diamond · take over every enemy charge chained to yours</sub></td>
    <td align="center" width="20%"><img src="src/modules/perks/apocalypse/icon.webp" width="72" alt="" /><br /><b>Cataclysm</b><br /><sub>Diamond · rearrange the arena and sweep it with fire</sub></td>
    <td align="center" width="20%"><img src="src/modules/perks/piercing-charge/icon.webp" width="72" alt="" /><br /><b>Piercing Charge</b><br /><sub>Diamond · blasts punch through one obstacle</sub></td>
    <td align="center" width="20%"><img src="src/modules/perks/dimension-collapse/icon.webp" width="72" alt="" /><br /><b>Dimensional Collapse</b><br /><sub>Mythic · lock everyone else in the overhead view</sub></td>
  </tr>
</table>

<p align="center">
  <img src="src/modules/perks/armor-training/icon.webp" width="44" alt="Conditioning" title="Conditioning" />
  <img src="src/modules/perks/long-wave/icon.webp" width="44" alt="High Explosive" title="High Explosive" />
  <img src="src/modules/perks/light-feet/icon.webp" width="44" alt="Fleet Footed" title="Fleet Footed" />
  <img src="src/modules/perks/bubble-pocket/icon.webp" width="44" alt="Ammo Pouch" title="Ammo Pouch" />
  <img src="src/modules/perks/salvage/icon.webp" width="44" alt="Salvage" title="Salvage" />
  <img src="src/modules/perks/endurance/icon.webp" width="44" alt="Endurance" title="Endurance" />
  <img src="src/modules/perks/contract/icon.webp" width="44" alt="Bounty Contract" title="Bounty Contract" />
  <img src="src/modules/perks/shaped-charge/icon.webp" width="44" alt="Shaped Charge" title="Shaped Charge" />
  <img src="src/modules/perks/repair/icon.webp" width="44" alt="Field Recovery" title="Field Recovery" />
  <img src="src/modules/perks/long-reach/icon.webp" width="44" alt="Extended Reach" title="Extended Reach" />
  <img src="src/modules/perks/afterburn/icon.webp" width="44" alt="Afterburn" title="Afterburn" />
  <img src="src/modules/perks/short-fuse/icon.webp" width="44" alt="Short Fuse" title="Short Fuse" />
  <img src="src/modules/perks/last-stand/icon.webp" width="44" alt="Last Stand" title="Last Stand" />
  <img src="src/modules/perks/siphon/icon.webp" width="44" alt="Siphon Charge" title="Siphon Charge" />
  <img src="src/modules/perks/capacitor/icon.webp" width="44" alt="Rapid Circuit" title="Rapid Circuit" />
  <br />
  <sub>Twenty perks in all. Each has a page in the <a href="docs/content/README.md">content reference</a>.</sub>
</p>

### Gear and mutations

Cover and zombies drop gear. Zombies sometimes also drop a gene mutation that permanently raises one of your stats.

<p align="center">
  <img src="src/ui/icon-art/bomb.webp" width="56" alt="Charge" title="Charge" />
  <img src="src/modules/items/grenade/icon.webp" width="56" alt="Frag Grenade" title="Frag Grenade" />
  <img src="src/modules/items/molotov/icon.webp" width="56" alt="Molotov" title="Molotov" />
  <img src="src/modules/items/shield/icon.webp" width="56" alt="Tactical Shield" title="Tactical Shield" />
  <img src="src/modules/items/bandage/icon.webp" width="56" alt="Bandage" title="Bandage" />
  <img src="src/modules/items/knife/icon.webp" width="56" alt="Knife" title="Knife" />
  <img src="src/modules/items/crate/icon.webp" width="56" alt="Field Crate" title="Field Crate" />
  &nbsp;&nbsp;&nbsp;
  <img src="src/modules/mutations/vitality/icon.webp" width="56" alt="Vitality" title="Vitality" />
  <img src="src/modules/mutations/fast-twitch/icon.webp" width="56" alt="Fast Twitch" title="Fast Twitch" />
  <img src="src/modules/mutations/lung-capacity/icon.webp" width="56" alt="Lung Capacity" title="Lung Capacity" />
  <img src="src/modules/mutations/blast-reach/icon.webp" width="56" alt="Blast Reach" title="Blast Reach" />
  <img src="src/modules/mutations/blast-yield/icon.webp" width="56" alt="Blast Yield" title="Blast Yield" />
</p>

### Operators

Pick a built-in operator or import any Minecraft skin PNG, then choose a finish for your charges.

<table>
  <tr>
    <td width="50%"><img src="docs/media/lobby.jpg" alt="Match lobby with three AI opponents" /></td>
    <td width="50%"><img src="docs/media/skill-shop.jpg" alt="Skill shop" /></td>
  </tr>
</table>

## Four ways to play

| Mode | What changes |
| --- | --- |
| **Free-for-All** | The standard rules, in first person. Last operator standing wins. |
| **Classic** | The whole match on a top-down 2D board, like the original. |
| **Wild** | Everyone starts overpowered: more health, power and range, faster level-ups, and health that regenerates out of combat. |
| **Practice** | No clock. Go in alone if you like and learn the maps and skills. |

## Story mode

There is also a short story, about twenty minutes long, told in five acts with two endings.

Zero is a shut-in who is sure the ordinary world has no room for him. One night an old bomb game on his CRT pulls him through the screen, into a flat country where everyone lives on a grid and nobody has ever looked up. It starts as an isekai parody and ends somewhere quieter.

<p align="center">
  <img src="docs/media/story.jpg" alt="Scenes from story mode: a dinner under paper lanterns at sunset, a walk home along the power lines, an apartment block at dusk, the manga opening, the 8-bit bedroom, the game on the CRT, the pull into the screen, a status window that will not open, and the village of Flatland" />
</p>

| Act | | What it plays like |
| --- | --- | --- |
| **1** | The Mundane Cage · 凡俗的牢笼 | An 8-bit bedroom to poke around in, after a manga opening. |
| **2** | Bubble X · 泡泡 X | A 2D duel on a CRT, until the screen reaches back. |
| **3** | Flatland · 平面国 | A village that only knows two dimensions, and your first real fight. |
| **4** | Ascension · 升维 | You learn to see in 3D, and what that costs the people who cannot. |
| **5** | Shutdown · 关机 | The last fight, and a choice: go back, or stay. |

Each act changes how the game looks and plays: manga panels, a top-down pixel room, an arcade board, the full first-person arena, and small low-resolution films in between. Finishing the story unlocks new charge finishes, knives and the Flatland map for versus play. The story is written in Chinese.

## Controls

| Action | Input |
| --- | --- |
| Move, look | WASD, mouse |
| Sprint | Hold Shift |
| Jump | Space |
| Plant a charge, use or throw gear | Left click |
| Build a wooden crate | Right click |
| Skills | E, F, C, Z, Q |
| Pick a perk | 1, 2, 3 |
| Trigger an active perk / switch to the next | T / G |
| Gear wheel, supply wheel | Hold V, hold B |
| Pause | Esc |

Every key can be rebound in the in-game manual.

## Run it locally

Requires Node.js 20.19+ or 22.12+.

```sh
npm ci
npm run dev
```

## Docs and modding

Maps, skins, bomb finishes, skills, items, perks and mutations are all self-contained modules.

- [Wiki](docs/README.md): game rules, drop rates, and a page for every skill, item, perk and mutation.
- [Modding guide](docs/modding/README.md): make your own maps and content packs.
- [Developer guide](docs/developer-guide.md): working on the game itself.

## Credits

Game design by [TwinIsland](https://tianyihuang.com). Third-party assets and their licenses are listed in [CREDITS.md](public/assets/CREDITS.md). The equipment, bomb and knife 3D models were generated with Meshy 7.5; icons and key art were generated with Google Gemini and OpenAI ImageGen.
