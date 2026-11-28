# Downloaded asset sources

The in-game credits roll (`src/ui/credits-data.ts`) is a curated summary of this file. When a third-party asset is added or removed here, update that list too.

<details>
<summary>Field manual backgrounds and frames · built-in ImageGen</summary>

Use case: ui-mockup. Create a single premium nine-slice item card texture for a modern tactical video game's field manual. Landscape 3:2 rectangle. Front-on orthographic scan, flush full-bleed rectangular panel exactly on all four canvas edges; zero outer margin, no cast shadow, no perspective. A quiet very dark desaturated graphite interior occupies the central 87 percent and will hold real text later. All decorative tooling must hug the outermost 5 percent, with four compact distinctive corner details; long horizontal and vertical rim segments must stretch cleanly. Carefully crafted industrial materials, fine worn edges catching a little light, never busy. No typography, lettering, numbers, icons, logos, badges or mockup background.

- `public/assets/manual/backdrop.webp` — Use case: ui-mockup. Portrait 4:5 full-bleed background artwork for a premium tactical video game's field manual. A decommissioned charcoal-green topographic plotting board, viewed directly overhead with shallow grazing light; visible dry fine-grain laminate, oxidized hardware on the far corners, faint broken contour lines mapped along the outer right and lower edges, dusty narrow bronze edge of a binder spine on the left. Restrained, tactile, photographed military-industrial art direction, dark but with subtle warm light at the top. Keep broad central 80 percent dark, visually quiet, suitable for a bright text overlay. No words, numbers, labels, icons, UI panels, page layouts or objects in the middle. Edge to edge, no surrounding tabletop.
- `public/assets/manual/skills.webp` — Skill card. Machined blackened aluminium with muted champagne brass inlays. Corner motif: twin precision diagonal cuts with the brass underneath; quiet fine brushed center.
- `public/assets/manual/equipment.webp` — Equipment inventory tag. Blackened field-case steel with cool desaturated blue-grey enamel edge, neatly crimped lugs and minute abrasion at the corners. Fine anthracite powder coat interior.
- `public/assets/manual/perks.webp` — Upgrade card. Graphite ceramic, double antique brass hairline tracery confined to the corners, distinctive stepped top-right corner and tiny warm glints; exceptionally restrained.
- `public/assets/manual/genes.webp` — Genetic augment card. Dark diagnostic instrument cover, muted oxidised sea-green rims, staggered traces and recessed teal glass inserts only on corners. Deep graphite center.

</details>

- BGM: [Volatile Reaction](https://incompetech.com/music/royalty-free/index.html?isrc=USUAN1400039) by Kevin MacLeod, [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Original recording, unchanged.
- Former BGM: Dark Place (loop), OpenGameArt: https://opengameart.org/content/dark-place-loop (CC0 as stated on source page). Original file dark_place.ogg, unchanged.
- Impact, hit, explosion, pickup: Kenney Impact Sounds / Sci-Fi Sounds / Digital Audio (CC0). https://kenney.nl/assets/impact-sounds ; https://kenney.nl/assets/sci-fi-sounds ; https://kenney.nl/assets/digital-audio . Download mirror: https://github.com/Mcamento8/open-game-sfx-index , original samples unchanged.
- Barlow Semi Condensed supplies Latin UI text and HUD numerals. The local WOFF2 files come from Fontsource 5.3.0. [Font source](https://github.com/google/fonts/tree/main/ofl/barlowsemicondensed) · [Bundled SIL Open Font License](fonts/barlow-semi-condensed/OFL.txt)
- Noto Sans SC supplies Simplified Chinese text. The local variable WOFF2 files and Unicode ranges come from Fontsource 5.3.1. [Font source](https://github.com/google/fonts/tree/main/ofl/notosanssc) · [Bundled SIL Open Font License](fonts/noto-sans-sc/OFL.txt)
- FilmShader, postprocessing and PBR shaders: official Three.js distribution (MIT), installed via npm, no handwritten replacement GLSL. https://github.com/mrdoob/three.js

- Wood: https://threejs.org/examples/textures/hardwood2_diffuse.jpg , official Three.js example texture, unchanged.

- Dynamite bundle: The Base Mesh, CC0; mirrored by https://github.com/Papyszoo/CC0-Public-Domain-Models/tree/main/packs/the-base-mesh/models/dynamite_stick_bundle . The game normalizes the original geometry, unwraps the bundle and separates the wrap, collars, caps and cord into material slots.
- Pickup confirmation and fuse tick: Kenney Interface Sounds (CC0), confirmation_002.ogg and tick_004.ogg, from https://kenney.nl/assets/interface-sounds ; downloaded via https://github.com/Mcamento8/open-game-sfx-index . Original audio unchanged; gain and playback cadence controlled at runtime.

- Daylight HDRI: Kloofendal 48d Partly Cloudy (Pure Sky), Greg Zaal / Jarod Guest, Poly Haven CC0: https://polyhaven.com/a/kloofendal_48d_partly_cloudy_puresky . Locally stored 1K Radiance HDR, used for background and PMREM lighting.
- Concrete Floor 02 / Concrete Wall 003: Poly Haven CC0, https://polyhaven.com/a/concrete_floor_02 and https://polyhaven.com/a/concrete_wall_003 . Original 1K albedo, roughness and OpenGL normal maps, downloaded from dl.polyhaven.org.
- Wood bump: official Three.js hardwood2_bump.jpg texture, matches the existing hardwood albedo.
- Physical Sky fallback and SSAO: unmodified official Three.js addon shaders (MIT), configured by the renderer.

- Minecraft articulated rig / UVs / walking and idle animation: skinview3d (MIT), https://github.com/bs-community/skinview3d ; skin normalization: skinview-utils (MIT). Default demonstration skins hacksore.png and haka.png from the upstream examples/public/img directory; original artwork ownership remains with the upstream authors. Minecraft is a trademark of Mojang; this project is not affiliated. Uploaded skin artwork belongs to its respective creator.

- The fallback pickup uses Quaternius’s CC0 ammunition crate from the [Sci-Fi Essentials Kit](https://quaternius.com/packs/scifiessentialskit.html). It is bundled with its three texture maps.

- Concrete footsteps 000–002: Kenney Impact Sounds (CC0), via Mcamento8/open-game-sfx-index. Smoke sprite: [OpenGameArt texture distributed in Three.js examples](https://github.com/mrdoob/three.js/blob/dev/examples/textures/opengameart/smoke1.png).

- Detonation flipbook — [Explosion](https://opengameart.org/content/explosion), CC0. Original `exp2_0.png`, 16 frames at 64 × 64 pixels.
- `perk-embers.ogg` uses a 1.2-second excerpt of AntumDeluge’s CC0 fireplace recording, normalized and faded for the perk offer cue. [Fire Crackling](https://opengameart.org/content/fire-crackling)
- `arena-fire.ogg` uses the full `fire-1.wav` recording for the looping fire under reward offers and terrain resets. Recorded by AntumDeluge, CC0. [Fire Crackling](https://opengameart.org/content/fire-crackling)
- `reset-signal.ogg` is Kenney’s CC0 `error_002.ogg`, used for the arena-wide terrain reset countdown. [Interface Sounds](https://kenney.nl/assets/interface-sounds) · [Audio mirror](https://github.com/Mcamento8/open-game-sfx-index/blob/main/audio/interface-sounds/error_002.ogg)

## Arena, music and finishes

- Obstacle presets in `public/assets/obstacles/` and the grenade, Molotov, shield, knife and field crate models are original to this project. They are generated by `tools/model-forge` and carry geometry only; their surfaces come from the shared texture sets below. The Kenney Nature Kit and Factory Kit models used in earlier releases have been removed.
- The three wrap textures in `src/modules/bomb-finishes/{standard,arctic,olive}/wrap.webp` were generated with OpenAI ImageGen. Art directions were worn oxblood and copper diagonal striping, pale polar splinter camouflage with contour lines, and olive tiger stripes with a survey grid. Each finish includes a derived roughness map.
- Shared prop surfaces in `public/assets/surfaces/` use Poly Haven textures, all CC0, converted from the 1K JPG maps to WebP: [Brown Planks 09](https://polyhaven.com/a/brown_planks_09) as `planks`, [Green Metal Rust](https://polyhaven.com/a/green_metal_rust) as `paint`, [Rusty Metal Sheet](https://polyhaven.com/a/rusty_metal_sheet) as `steel`, [Hessian 380](https://polyhaven.com/a/hessian_380) as `burlap` (colour desaturated), [Bark Brown 02](https://polyhaven.com/a/bark_brown_02) as `bark`, [Leafy Grass](https://polyhaven.com/a/leafy_grass) as `ground` and [Rubberized Track](https://polyhaven.com/a/rubberized_track) as `rubber` (colour converted to neutral grey). `paint-neutral_diff.webp` is the luminance of the Green Metal Rust colour map, tinted at runtime for the other paint colours. `hazard_diff.webp` is a stripe pattern drawn for this project and multiplied by the same luminance. `endgrain_diff.webp` is the weathered end-grain map generated earlier with OpenAI ImageGen.
- Zombie skins and glow maps in `public/assets/zombies/` are original pixel art drawn for this project by `tools/skin-forge/zombies.py`. Their shoulder plates and spikes use the shared `steel` surfaces.
- Character emblems (`src/modules/skins/*/emblem.svg`, `public/assets/emblems/default.svg`) are original vector marks drawn for this project.

- Map music by Kevin MacLeod. [Five Armies](https://incompetech.com/music/royalty-free/index.html?isrc=USUAN1100875) for the outpost, [Mechanolith](https://incompetech.com/music/royalty-free/index.html?isrc=USUAN1100879) for the warehouse. Original recordings, [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).
- Promotion feedback uses Kenney’s CC0 `powerUp7.ogg`. [Digital Audio](https://kenney.nl/assets/digital-audio)
- Menu click, confirm and back use Kenney’s CC0 `click_003`, `confirmation_001` and `back_002`, level-matched for playback. [Interface Sounds](https://kenney.nl/assets/interface-sounds)
- Knife swings and hits use Kenney’s CC0 `knifeSlice` and `impactPunch_medium_001`. [RPG Audio](https://kenney.nl/assets/rpg-audio) · [Impact Sounds](https://kenney.nl/assets/impact-sounds)

## Character skins from [SkinsDB](https://skinsdb.terraqueststudios.net/)

Original PNGs, distributed unchanged.

- Hatsune Miku-VOCALOID (SkinsDB #1013) — julito. [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/).

The Sapper, Assault, Scout, Medic and Engineer skins in `src/modules/skins/` are original pixel art drawn for this project by `tools/skin-forge/operators.py`. The third-party skins shipped in earlier releases have been removed.

## Deployment menu artwork

The logo, hangar key art, two map illustrations and control surfaces were produced with the built-in OpenAI ImageGen tool. The alpha logo was also exported at browser-icon sizes.

<details>
<summary>Assets and generation prompts</summary>

- `public/assets/hud/vital-strip.webp` — Use case: stylized-concept. Create a single landscape, edge-to-edge MATERIAL TEXTURE, not a UI mockup. A close-up of a translucent laminated jade-green military instrument light guide with fine longitudinal optical fibers, strongly horizontal micro-striations, subtle etched segment seams widely spaced, brighter mint catchlight across top, muted deep teal across bottom, consistent illumination left to right. Designed to crop down to a 210 by 10 pixel health gauge fill. Quiet, precise technical surfaces. No numbers, frame, letters, icons, shadows outside the panel or black margins.
- `public/assets/hud/perk-inlay.webp` — Use case: stylized-concept. Create a tileable square flat macro material texture for the face of a premium tactical game augmentation card. Smoky graphite ceramic substrate, fine etched angular circuit traces concentrated at margins, hairline brushed nickel and a few tarnished gold vias, darkest and almost blank central 65 percent to accommodate live text and icons. Top-down orthographic, uniform soft light. Single material surface all the way to edges without any physical card outline, no text, letters, numbers, logos, emblems or sample UI.
- `public/assets/hud/loadout-weave.webp` — Use case: stylized-concept. Create one square seamless albedo texture of rugged anthracite ripstop nylon bonded to a tactical equipment case, fine diagonal ballistic weave with an understated diamond reinforcement lattice, dusty graphite and desaturated olive, gentle raking light revealing threads and slight use wear. Full bleed, front-on, consistent density; suitable underneath small white game menu controls and equipment slots. No badges, lettering, symbols, objects, seams around the image, or border.

- `public/assets/menu/insignia.png, public/favicon.ico, public/favicon-64.png` — Use case: logo-brand. Create one iconic original standalone insignia for a premium tactical video game about demolition arena combat. Transparent background, square composition, center emblem occupying ~85% of the canvas. Construct a bold compact forward-leaning capital D from three angular interlocking plates, with a lightning-shaped diagonal fracture carved in genuine negative space. Weighty industrial stencil geometry; one broad muted signal-amber plate and two warm near-white plates. Flat, sharp silhouette, reads instantly at 16 px. No letters beyond the implicit D, no wordmark, no lettering, no outside shield, no shadow, no gradient, no background, no fine lines. Straight-on orthographic clean vector-like raster.
- `public/assets/menu/hangar.webp` — Use case: photorealistic-natural. Ultrawide landscape cinematic key art for an original premium military game lobby, photorealistic AAA environment matte painting, wide 16:9 frame. An abandoned concrete forward operating depot in a coastal mountain valley during a windy overcast dawn. Wide shutter doors opened onto distant low barracks, weather-faded painted concrete, stacked equipment, tall skeletal hangar girders on extreme left and overhead, hanging canvas sheets, rain-slick floor and pale ochre stripes, small restrained amber industrial lamps. Neutral blue-green steel, peat gray, misty sage and weathered brass. Strong directional light from high right, dusty god rays, layered depth with a dark quiet leftmost third for a UI, open hero-position foreground at 53% horizontal, unoccupied floor there for separately composited live character. View at shoulder height, horizon behind center. Give it a restrained textured 35mm documentary quality, expensive craft, grounded and atmospheric; no people, text, logos, markings resembling words, UI, weapons, title or watermarks.
- `src/modules/maps/dream-garden/briefing.webp` — Use case: photorealistic-natural. Wide 16:9 cinematic game level selection thumbnail, aerial oblique three-quarter site reconnaissance photo of a compact military concrete outpost on the edge of a conifer forest, sage green trees, crates, muddy courtyard, a water tower and small weathered trailers under cold dawn light. One strong silhouette and tiny warm light, premium restrained war-film color grade, atmospheric haze, cinematic depth; scene readable at 200px. No UI, no text, labels, logos, soldiers, badges, map markers or borders.
- `src/modules/maps/night-lab/briefing.webp` — Use case: photorealistic-natural. Wide 16:9 cinematic level selection thumbnail for a premium tactical videogame. Interior of a cavernous industrial goods depot at midnight, high three-quarter angle across orderly aisles of cargo, old overhead crane with rich tungsten amber lights, blue graphite shadows and volumetric light from clerestory windows. A striking strong amber diagonal of light through steel trusses. Grounded film cinematography, readable at 200px. No people, weapons, letters, text, logos, interface, map pins or borders.
- `public/assets/menu/confirm.webp, public/assets/menu/selector.webp, public/assets/menu/graphite.webp` — Use case: ui-mockup. A production asset sheet containing exactly THREE horizontal rectangular material strips, each occupies a full third of a square canvas from edge to edge, strictly stacked without any gap, text, glyphs, lettering, numbers or glyph-like markings. Each strip must work independently as a subtle premium tactical game UI button background cropped at y=1/3 and 2/3. TOP THIRD: rich aged ochre-gold anodized metal confirmation rail, bright gold lit top edge, tiny brushed wear, narrow dark diagonal laser-etched hatch only at far right; broad clean gold center that takes dark text. MIDDLE THIRD: dark graphite-blue gunmetal selection rail, recessed hairline rim, faint sage edge light, small chamfer detail on far right, center calm dark with room for white text. BOTTOM THIRD: seamless deep carbon gray micro-grain horizontal brushed steel panel texture; virtually flat, matte charcoal in center with extremely subdued drafting grid. All straight-on orthographic flat material scans, no perspective, no drop shadows, no background outside the three bands, no device, no screws or ornaments in center. Full bleed.

</details>

Equipment and reward cues use Kenney recordings distributed under CC0. The downloaded Ogg files retain their original audio. [Source audio collection](https://github.com/Mcamento8/open-game-sfx-index/tree/main/audio)

| Local cue | Source recording |
| --- | --- |
| gear-equip, gear-pickup, gear-throw, bomb-place | RPG Audio · beltHandle2, metalLatch, cloth3, dropLeather |
| shield-on, shield-block | Sci-Fi Sounds · forceField_002, forceField_000 |
| Shield shatter and expiry | Kenney CC0 recordings, impactGlass_heavy_002 from [Impact Sounds](https://kenney.nl/assets/impact-sounds) and forceField_004 from [Sci-Fi Sounds](https://kenney.nl/assets/sci-fi-sounds). |
| skill-cast, perk-silver | Interface Sounds · switch_007, confirmation_003 |
| perk-gold, perk-diamond | Digital Audio · powerUp4, powerUp12 |
| mutation-award | Kenney Digital Audio · powerUp11, CC0 |
| aim-step, clock-pulse, deploy-signal | Kenney Interface Sounds · tick_001, select_002, confirmation_001 (CC0). [Interface Sounds](https://kenney.nl/assets/interface-sounds) |
| zombie-ash | Impact Sounds · impactSoft_heavy_002 |
| zombie-hurt-1, zombie-hurt-2, zombie-death | Minecraft: Java Edition zombie hurt and death recordings, Mojang Studios. Original Ogg files from the [official 1.21.4 asset index](https://piston-meta.mojang.com/v1/packages/819525fa2445f041d8c865e8ea3d215b362f106e/19.json). |
| player-hurt-0, player-hurt-1, player-hurt-2 | Minecraft: Java Edition player hurt recordings (`damage/hit1`–`hit3`), Mojang Studios. Original Ogg files from the same asset index. |
| player-attack-0, player-attack-1, player-attack-2 | Minecraft: Java Edition player attack recordings (`entity/player/attack/strong1`–`strong3`), Mojang Studios. Original Ogg files from the same asset index. |
| level-up, pickup-confirm, gear-pickup, crate-build, bomb-place | Minecraft: Java Edition recordings, Mojang Studios: `random/levelup`, `random/pop` (both pickup cues), `dig/wood1`, `random/fuse`. Original Ogg files from the same asset index. They replace the Kenney and synthesised cues that earlier rows and `scripts/make-build-sound.py` describe for these names. |
| `src/modules/perks/hijack/use.ogg` | Minecraft: Java Edition beacon recording (`block/beacon/power1`), Mojang Studios. Original Ogg file from the same asset index. Played when the Hijack perk is triggered. |
| relic-fall, relic-land, relic-bounce, relic-rise, relic-reveal, ascend-charge, ascend-hit | Minecraft: Java Edition recordings, Mojang Studios, from the same asset index: `item/elytra/elytra_loop` (a 1.3 s slice, sped up, with a rising level), `random/anvil_land` (lowered for the landing, raised and shortened for the bounce), `block/beacon/activate`, `block/beacon/power2`, `mob/warden/sonic_charge1`, `block/end_portal/endportal`. Trimmed, faded and levelled with ffmpeg. Played over the relic drop film at the end of story act 3 and when the device goes off in act 4. |
| story-goal | Minecraft: Java Edition note block recording (`note/bell`), Mojang Studios, from the same asset index. Two copies a fifth apart, 130 ms apart, mixed and loudness-normalised with ffmpeg. Played when the story objective changes. |
| zombie-groan-0, zombie-groan-1, zombie-groan-2, zombie-step-0, zombie-step-1, zombie-step-2 | Minecraft: Java Edition zombie recordings, Mojang Studios: `mob/zombie/say1`–`say3` and `mob/zombie/step1`, `step3`, `step4`. Original Ogg files from the same asset index. |
| footstep-{0,1,2}, footstep-grass-{0,1,2}, footstep-mud-{0,1,2}, footstep-carpet-{0,1,2}, footstep-water-{0,1,2} | Minecraft: Java Edition step recordings, Mojang Studios: `step/stone1`, `2`, `4`; `step/grass1`, `3`, `5`; `block/mud/step3`–`step5`; `step/cloth1`, `2`, `4`; `liquid/swim1`, `3`, `4`. From the same asset index. All but the mud steps are raised to a common peak level and re-encoded; nothing else is changed. They replace every footstep source described elsewhere in this file. |
| skill-pick, skill-unpick, clock-pulse | Freesound, all CC0: [UI Button Press Deep](https://freesound.org/s/878235/) by Qvantor (skill taken in the skill shop), [Click_Button_BatteryRechargerFlashlight](https://freesound.org/s/617587/) by sweet_niche (skill handed back), [Setting Electronic Timer 1 Beep](https://freesound.org/s/536422/) by Rudmer_Rotteveel (countdown tick). Leading silence trimmed, raised to a common peak level and re-encoded. clock-pulse replaces the Kenney cue the earlier row describes; deploy-signal is still the Kenney one and now only marks the arena collapse. |
| ui-back | Kenney Interface Sounds · minimize_003 (CC0), unchanged. [Interface Sounds](https://kenney.nl/assets/interface-sounds) |
| ui-locked | Kenney Interface Sounds · error_006 (CC0), cut to 0.3 s with a fade out. Played when a choice that the story unlocks is clicked in the main menu. [Interface Sounds](https://kenney.nl/assets/interface-sounds) · [Audio mirror](https://github.com/Mcamento8/open-game-sfx-index/blob/main/audio/interface-sounds/error_006.ogg) |
| blast-ringing | Short excerpt with a fade from [Tinnitus by Joseph SARDIN, BigSoundBank](https://bigsoundbank.com/tinnitus-s1388.html), CC0. |
| Knife contact with wood, hard surfaces, and soft cover (`src/modules/items/knife/cover-{wood,metal,soft}.ogg`) | Minecraft: Java Edition block hit recordings, Mojang Studios: `step/wood1`, `step/stone1`, and `step/cloth1`, as referenced by `block.wood.hit`, `block.metal.hit` / `block.stone.hit`, and `block.wool.hit` in the official `sounds.json`. Original Ogg files from the [official 1.21.4 asset index](https://piston-meta.mojang.com/v1/packages/819525fa2445f041d8c865e8ea3d215b362f106e/19.json), replacing the previous Kenney recordings. |

The permanent knife is an original model from `tools/model-forge`; it replaced the Quaternius mesh used in earlier releases.

<details>
<summary>Field equipment surfaces · built-in ImageGen prompts and asset paths</summary>

Use case: photorealistic-natural. Generate one square seamless base-color PBR material texture for the specified first-person videogame equipment, consistently art-directed for an understated realistic military supply kit. Orthodox straight-on surface scan, uniform flat diffuse lighting, physically plausible subdued color, moderate fine detail still legible on a small model. Fill the entire square with this material, tileable on opposite edges. No object photos, shadows, highlights, labels, letters, logos, layout panels, borders or vignette.

- `src/modules/items/grenade/field-surface.webp` — Use case: photorealistic-natural. Generate one seamless flat tile for the base color of olive-drab field equipment in a videogame. Full-frame scanned surface of muted grey olive pebbled enamel over cast iron, with subtle handling patina, fine dark stipple and isolated worn silvery flecks. Medium olive color, even lighting, physically plausible scale. One continuous uniform material, no object, letters, logos, shadows, bevels, vignettes or frames. Square texture.
- `src/modules/items/shield/field-surface.webp` — Portable shield emitter casing. Matte graphite and muted petrol-blue ceramic composite casing with a fine diagonal carbon twill, fine handling scuffs and muted cyan woven tracer threads at irregular intervals, medium graphite values that read in shadow. Uniform technical material.
- `src/modules/items/bandage/field-surface.webp` — Field dressing. Close overhead macro of muted unbleached ecru medical cotton gauze, tight fine orthogonal warp and weft, occasional loose fibers, subtle thread thickness variation. Barely visible faded olive-green woven tracer every twelve threads, soft dusty khaki at thread intersections. Tile from a single continuous flat gauze strip, no folds or blood.
- `src/modules/items/knife/field-surface.webp` — Field knife blade. Medium-value cold grey satin-honed tool steel, fine faint lengthwise satin grind striations running horizontally, graphite temper mottling and a few shallow handling marks. Neutral silver-grey that reflects scene illumination. Single flat metal finish; no delineated blade profile.
- `public/assets/bomb-hardware.webp` — Exposed cap hardware for a fictional demolition charge game prop. Neutral pewter zinc-coated alloy with faint concentric lathe tool marks, restrained charcoal handling grime, freckled oxidation and small scratches. Mid-value neutral metal suitable to tint copper, olive or arctic in the game shader. Single continuous metal surface; no fasteners, diagrams, text, or individual components.

The grenade and shield models have new UV coordinates for these surfaces. The bandage uses the bandage_roll geometry in `src/modules/items/bandage/model.glb`. The knife uses its blade UVs. The charge hardware uses the cap UVs across all player finishes.

</details>

<details>
<summary>Knife and shield texture prompts · built-in ImageGen</summary>

- `src/modules/items/knife/blade.jpg` — Use case: stylized-concept. One square seamless texture intended as the actual base color of a tactical game utility knife blade. An edge-to-edge flat orthographic macro scan of dark graphite / blued gunmetal steel, understated cool-gray horizontal brushing, a few fine handling scratches, tiny worn lighter steel flecks. Soft even neutral lighting, enough tonal variation to read in first person, with consistent brightness across the surface. Only the uniform metal material swatch with no knife silhouette, painted bevel, border, emblems, typography, seams, or other objects. Not a product photo of a knife. Opaque.
- `public/assets/shield-field.webp` — Use case: stylized-concept. A single seamless square EMISSION MASK / energy-film texture for the inner and outer surfaces of a spherical sci-fi defensive shield in a premium tactical videogame. Edge-to-edge black field (almost all pixels black, 92% dark) crossed by extremely fine broken icy cyan/silver hexagonal cellular lines, about 10-12 hex cells across, sparse tiny junction pulses and whisper-thin interference fibers. Uniform scale and density; black centers of cells must stay entirely clear in additive rendering so a player can see through it. Flat UV material swatch, tile seamlessly in both axes. No sphere illustration, horizon, radial gradient, object, words, numbers, logos, vignette, graphic borders or pictograms. Opaque black background for additive blending.

</details>

## UI skin surfaces

Used by `src/ui/game-skin.css` for dialog, button, select and HUD panel surfaces.

| File | Source | Author | License | Changes |
| --- | --- | --- | --- | --- |
| `public/assets/ui/plate.webp` | [Metal Plate](https://polyhaven.com/a/metal_plate) (diffuse, 1k), Poly Haven | Poly Haven | CC0 1.0 | Resized to 512 px, desaturated, tinted dark gunmetal, WebP |
| `public/assets/ui/painted-steel.webp` | [Green Metal Rust](https://polyhaven.com/a/green_metal_rust) (diffuse, 1k), Poly Haven | Poly Haven | CC0 1.0 | Resized to 512 px, desaturated and darkened, WebP |
| `public/assets/ui/player-card.webp`, `player-card-self.webp` | [Rusty Metal Sheet](https://polyhaven.com/a/rusty_metal_sheet) (diffuse, 1k), Poly Haven | Poly Haven | CC0 1.0 | Tinted as dark olive paint over rust; chamfered outline, bevel, recessed well, edge chipping, scratches, screws and accent stripe composited by script (NumPy/Pillow) |
| `public/assets/ui/radar-frame.webp` | [Blue Metal Plate](https://polyhaven.com/a/blue_metal_plate) and Rusty Metal Sheet (diffuse, 1k), Poly Haven | Poly Haven | CC0 1.0 | Tinted gunmetal with rust patina; octagonal bezel, glass well with grid, screws, hazard strip composited by script |
| `src/modules/{skills,perks,mutations}/*/icon.webp`, `src/ui/icon-art/coin.webp` | Skill, perk, mutation and coin icons, AI-generated with Google Gemini by TwinIsland from prompts written for this project | TwinIsland | Project asset | Sliced from chroma-key sheets with `tools/icon-sheet/cut.py`, scaled to 256 × 256 WebP |
| `src/modules/items/{bandage,crate,grenade,molotov,shield}/model.glb`, `knife/knife.glb` | Equipment models, generated with Meshy 7.5 (image to 3D) by TwinIsland from the equipment icon art; they replace the earlier `tools/model-forge` item models | TwinIsland | Project asset | Reduced to about 6k triangles with WebP textures by `tools/model-import/optimize.mjs` |
| `src/modules/bomb-finishes/{frost,golden,camo,toxic,cyberpunk}/model.glb`, `src/modules/items/knife/styles/{tactical,damascus,butterfly,karambit,scifi}.glb` | Bomb finish and knife skin models, generated with Meshy 7.5 (image to 3D) by TwinIsland | TwinIsland | Project asset | Reduced to about 5k to 8k triangles with WebP textures by `tools/model-import/optimize.mjs`; knives rotated 0,0,-90 to stand tip up |
| `src/modules/bomb-finishes/{frost,golden,camo,toxic,cyberpunk}/explosion.webp` | Detonation flipbooks of the modelled bomb finishes, 4 × 4 frames, AI-generated by TwinIsland | TwinIsland | Project asset | Resized to 1024 px, black background turned into alpha, WebP |
| `src/ui/icon-art/bomb.webp`, `src/modules/items/{bandage,crate,grenade,knife,molotov,shield}/icon.webp` | Equipment icons, AI-generated with Google Gemini by TwinIsland from prompts written for this project | TwinIsland | Project asset | Cut out from a green-screen sheet, trimmed and scaled to 256 × 256 WebP |
| `public/assets/ui/minimap-ground.webp` | Radar ground, AI-generated image supplied by TwinIsland | TwinIsland | Project asset | Converted to WebP; tinted per map theme at draw time |
| `public/assets/ui/outcome-victory.webp`, `outcome-defeat.webp` | Blue Metal Plate and Rusty Metal Sheet (diffuse, 1k), Poly Haven | Poly Haven | CC0 1.0 | Used as the metal base; rays, star, chevrons, scorch, fracture glow, embers and smoke drawn by `scripts/make-ui-outcomes.py` |

The match room backdrop reuses the existing `public/assets/menu/hangar.webp`. Hazard stripes, corner brackets, rivets, toggle switches and the select chevron are CSS gradients or inline SVG written for this project.

## Weather and environment

Used by `src/render/environment` for the rain map.

| File | Source | Author | License | Changes |
| --- | --- | --- | --- | --- |
| `public/assets/environment/overcast-sky.hdr` | [Overcast Soil (Pure Sky)](https://polyhaven.com/a/overcast_soil_puresky) (HDRI, 1k), Poly Haven | Poly Haven | CC0 1.0 | Renamed |
| `public/assets/environment/rain.ogg` | Synthesised for this project (filtered noise, 14 s seamless loop) | Project | CC0 1.0 | — |
| `public/assets/environment/thunder-near.ogg`, `thunder-far.ogg` | Synthesised for this project (filtered noise) | Project | CC0 1.0 | — |

Stains, moss, cracks, puddles, ripples, rain streaks and splashes are procedural shaders and use no image files.

## Rainforest map

Trees, palms, ruin walls and shafts of light are built in code (`src/render/jungle-flora.ts`). The scans below are prepared by `scripts/make-jungle-flora.py` (textures) and `scripts/make-jungle-flora.mjs` (models).

| File | Source | Author | License | Changes |
| --- | --- | --- | --- | --- |
| `public/assets/surfaces/jungle-grass_*.webp` | [Forrest Ground 01](https://polyhaven.com/a/forrest_ground_01) (1k), Poly Haven | Poly Haven | CC0 1.0 | Converted to WebP |
| `public/assets/surfaces/jungle-mud_*.webp` | [Mud Forest](https://polyhaven.com/a/mud_forest) (1k), Poly Haven | Poly Haven | CC0 1.0 | Converted to WebP |
| `public/assets/surfaces/jungle-litter_*.webp` | [Forest Leaves 03](https://polyhaven.com/a/forest_leaves_03) (1k), Poly Haven | Poly Haven | CC0 1.0 | Converted to WebP |
| `public/assets/surfaces/fern_*.webp`, `public/assets/scenery/fern-{a,b,c}.glb`, `public/assets/obstacles/fern.glb` | [Fern 02](https://polyhaven.com/a/fern_02) (model, 1k), Poly Haven | Poly Haven | CC0 1.0 | Opacity packed into the colour map, variants split into files and simplified, textures moved to shared WebP |
| `public/assets/surfaces/calathea_*.webp`, `public/assets/scenery/calathea-{a,b}.glb` | [Calathea Orbifolia 01](https://polyhaven.com/a/calathea_orbifolia_01) (model, 1k), Poly Haven | Poly Haven | CC0 1.0 | Same as the fern |
| `public/assets/surfaces/anthurium_*.webp`, `public/assets/scenery/anthurium-{a,b}.glb`, `public/assets/obstacles/banana.glb` | [Anthurium Botany 01](https://polyhaven.com/a/anthurium_botany_01) (model, 1k), Poly Haven | Poly Haven | CC0 1.0 | Same as the fern; the obstacle is two plants scaled up |
| `public/assets/surfaces/shrub_*.webp`, `public/assets/scenery/shrub-{a,b}.glb` | [Shrub 03](https://polyhaven.com/a/shrub_03) (model, 1k), Poly Haven | Poly Haven | CC0 1.0 | Same as the fern |
| `public/assets/surfaces/scan-rock_*.webp`, `public/assets/scenery/rock-{a,b,c,d}.glb`, `public/assets/obstacles/boulder.glb` | [Rock Moss Set 01](https://polyhaven.com/a/rock_moss_set_01) (model, 2k), Poly Haven | Poly Haven | CC0 1.0 | Rocks split into files and simplified to 900 triangles, textures converted to WebP |
| `public/assets/surfaces/jungle-crown_diff.webp` | Composed for this project from the leaf scans of [Pachira Aquatica 01](https://polyhaven.com/a/pachira_aquatica_01) (2k), Poly Haven | Poly Haven, Project | CC0 1.0 | Single leaves arranged into four clumps by `scripts/make-jungle-flora.py` |
| `public/assets/surfaces/moss-rock_*.webp` | [Mossy Rock](https://polyhaven.com/a/mossy_rock) (1k), Poly Haven | Poly Haven | CC0 1.0 | Converted to WebP |
| `public/assets/surfaces/ruin-stone_*.webp` | [Mossy Sandstone](https://polyhaven.com/a/mossy_sandstone) (1k), Poly Haven | Poly Haven | CC0 1.0 | Converted to WebP, colour slightly desaturated and brightened |
| `public/assets/surfaces/village-writing_diff.webp` | Drawn for this project; the writing is set in the bundled Noto Sans SC | Project | Original | — |
| `public/assets/scenery/village-*.glb` (all but those of the next row), `public/assets/obstacles/{village-crate,barrels,crate-stack,sacks,wheelbarrow,lumber,training-rack,wood-fence}.glb`, `public/assets/surfaces/kaykit-medieval_diff.webp` | [KayKit Medieval Hexagon Pack 1.0](https://github.com/KayKit-Game-Assets/KayKit-Medieval-Hexagon-Pack-1.0) | Kay Lousberg | CC0 1.0 | Scaled, arranged and joined by `tools/model-import/kaykit.mjs`; the swatch texture is stored once as lossless WebP and shared |
| `public/assets/scenery/village-{arch,crypt,lantern,notice,grave-a,grave-b,grave-c}.glb`, `public/assets/surfaces/kaykit-halloween_diff.webp` | [KayKit Halloween Bits 1.0](https://github.com/KayKit-Game-Assets/KayKit-Halloween-Bits-1.0) | Kay Lousberg | CC0 1.0 | Same as the row above |
| `public/assets/surfaces/jungle-bark_*.webp` | [Tree Bark 03](https://polyhaven.com/a/tree_bark_03) (1k), Poly Haven | Poly Haven | CC0 1.0 | Converted to WebP |
| `public/assets/surfaces/leaf_*.webp` | Drawn procedurally for this project (midrib and veins) | Project | CC0 1.0 | — |
| `public/assets/obstacles/{fallen-log,ruin-pillar,idol}.glb` | Generated by `tools/model-forge/jungle.ts`, geometry only | Project | CC0 1.0 | — |
| `public/assets/footstep-grass-{0,1,2}.ogg` | `footstep_grass_000`–`002`, Kenney [Impact Sounds](https://kenney.nl/assets/impact-sounds), via the [audio mirror](https://github.com/Mcamento8/open-game-sfx-index/tree/main/audio/impact-sounds) | Kenney | CC0 1.0 | Trimmed to 0.3 s, faded, normalised |
| `public/assets/footstep-mud-{0,1,2}.ogg` | `footstep_snow_000`–`002`, Kenney Impact Sounds (same mirror), with a synthesised squelch | Kenney, Project | CC0 1.0 | Slowed to 70 %, low-passed, mixed with filtered noise and a low thump |
| `public/assets/environment/jungle.ogg` | Synthesised for this project (insects, crickets, birds, frogs; 24 s seamless loop) | Project | CC0 1.0 | — |
| `src/modules/maps/rainforest/bgm.mp3` | [Rite of Passage](https://incompetech.com/music/royalty-free/music.html), incompetech.com | Kevin MacLeod | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) | Re-encoded from 320 to 160 kbit/s MP3 |
| `src/modules/maps/rainforest/briefing.webp`, `backdrop.webp` | AI-generated key art (monsoon rainforest clearing with a temple ruin turned forward base), supplied by the project owner | Project | CC0 1.0 | — |
| `src/modules/maps/flatland/briefing.webp`, `backdrop.webp` | AI-generated key art (starter village plaza under cherry blossom at sunset, torii and snow peak), supplied by the project owner | Project | CC0 1.0 | — |

The footsteps and the ambience loop are built by `scripts/make-jungle-sounds.py`.

## Pool map

| File | Source | Author | License | Changes |
| --- | --- | --- | --- | --- |
| `public/assets/surfaces/pool-tile_*.webp`, `pool-mosaic_*.webp` | Drawn procedurally for this project by `scripts/make-pool-textures.py` | Project | CC0 1.0 | — |
| `public/assets/obstacles/{swim-rings,lifeguard-chair,locker,planter,towel-cart}.glb` | Generated by `tools/model-forge/pool.ts`, geometry only | Project | CC0 1.0 | — |
| `public/assets/footstep-water-{0,1,2}.ogg` | Water footsteps from the [AGFX pack](https://www.freesound.org/people/AGFX/packs/1253/) on Freesound, as shipped in [Minetest Game](https://github.com/luanti-org/minetest_game/tree/master/mods/default/sounds) (`default_water_footstep.1`–`3.ogg`) | AGFX | [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/) | Cut to the first 0.55 s of each take, faded, normalised, by `scripts/make-pool-sounds.py` |
| `public/assets/environment/poolrooms.ogg` | Synthesised for this project (light ballast hum, ventilation, lapping water, drips; 24 s seamless loop) by `scripts/make-pool-sounds.py` | Project | CC0 1.0 | — |
| `src/modules/maps/poolrooms/bgm.mp3` | [Dreamy Flashback](https://incompetech.com/music/royalty-free/music.html), incompetech.com | Kevin MacLeod | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) | Re-encoded from 320 to 160 kbit/s MP3 |
| `src/modules/maps/poolrooms/briefing.webp`, `backdrop.webp` | AI-generated key art, made by the project owner from a prompt written for this map (a flooded hall of white tile, teal band, columns, light panels and a deck island with pool props) | Project | CC0 1.0 | Scaled to 720 × 405 for the briefing |

The water, its caustics and the continuous tiling are procedural shaders and use no further image files.

## Backrooms map

| File | Source | Author | License | Changes |
| --- | --- | --- | --- | --- |
| `public/assets/surfaces/backrooms-wall_*.webp` | [Decrepit Wallpaper](https://polyhaven.com/a/decrepit_wallpaper) (1k diffuse, OpenGL normal, roughness), Poly Haven | Rob Tuytel | CC0 1.0 | Diffuse reduced to its detail and recoloured to yellowed paper, a printed stripe and lozenge pattern and damp stains drawn over it; roughness raised; WebP |
| `public/assets/surfaces/backrooms-carpet_*.webp` | [Dirty Carpet](https://polyhaven.com/a/dirty_carpet) (1k diffuse, OpenGL normal, roughness), Poly Haven | Rohit Seervi | CC0 1.0 | Diffuse recoloured to tan; roughness raised; WebP |
| `public/assets/surfaces/backrooms-ceiling_*.webp` | Suspended ceiling tiles drawn procedurally for this project | Project | CC0 1.0 | — |
| `public/assets/obstacles/{cardboard-boxes,filing-cabinet,office-desk,water-cooler,partition}.glb` | Generated by `tools/model-forge/office.ts`, geometry only | Project | CC0 1.0 | — |
| `public/assets/footstep-carpet-{0,1,2}.ogg` | `footstep_carpet_000`–`002`, Kenney [Impact Sounds](https://kenney.nl/assets/impact-sounds), via the [audio mirror](https://github.com/Mcamento8/open-game-sfx-index/tree/main/audio/impact-sounds) | Kenney | CC0 1.0 | Trimmed to 0.22 s, faded, normalised |
| `public/assets/environment/backrooms.ogg` | Synthesised for this project (fluorescent tube hum and ballast buzz with a stuttering tube, far air handling; 24 s seamless loop) | Project | CC0 1.0 | — |
| `public/assets/room-shift.ogg` | Synthesised for this project (earthquake roar, rattling and creaking, tubes restriking) | Project | CC0 1.0 | — |
| `src/modules/maps/backrooms/bgm.mp3` | [Lost in Liminal Dream](https://pixabay.com/music/search/lost%20in%20liminal%20dream/), Pixabay Music (track 619725), file supplied by the project owner | Lux-aeterna | [Pixabay Content License](https://pixabay.com/service/license-summary/) | Re-encoded to 160 kbit/s MP3, tags removed |
| `public/assets/credits-freedom.mp3` | You've Got to Have Freedom, file supplied by the project owner; plays under the credits roll | Pharoah Sanders | © Pharoah Sanders, all rights reserved; used in this personal, non-commercial project | First 4 minutes, 8 s fade out, loudness raised to about -12 LUFS, MP3 VBR q3 for desktop playback compatibility |
| `public/assets/story/electronic-girl-8bit.mp3` | 电动少女 Electronic Girl (8-Bit Remix), file supplied by the project owner; plays under the opening acts of story mode | Chinese Football | © Chinese Football, all rights reserved; used in this personal, non-commercial project | Tags removed |
| `public/assets/story/share-friendship.mp3` | Share Friendship, file supplied by the project owner; plays under the first duel of story mode | 黒魔 (Kuroma) | © the artist, all rights reserved; used in this personal, non-commercial project | Tags removed |
| `public/assets/story/clumsy-communication.mp3` | Clumsy Communication (from Tailless Hero), file supplied by the project owner; plays under the lessons of story mode | 黒魔 (Kuroma) | © the artist, all rights reserved; used in this personal, non-commercial project | Tags removed |
| `public/assets/story/kenka-no-bannin.mp3` | 献花の番人, file supplied by the project owner; plays under the 2D-to-3D ascension, the shutdown and the last fight of story mode | 黒魔 (Kuroma) | © the artist, all rights reserved; used in this personal, non-commercial project | Tags removed |
| `public/assets/story/electronic-girl.mp3` | 电动少女 Electronic Girl (original recording), file supplied by the project owner; plays under the "go back" ending of story mode | Chinese Football | © Chinese Football, all rights reserved; used in this personal, non-commercial project | Tags removed |
| `public/assets/fonts/fusion-pixel/` | [Fusion Pixel Font](https://github.com/TakWolf/fusion-pixel-font) 12px proportional, Simplified Chinese, from `@fontsource/fusion-pixel-12px-proportional-sc` 5.3.0; story mode text | TakWolf | [SIL Open Font License 1.1](https://openfontlicense.org/) | — |
| `src/modules/maps/backrooms/briefing.webp`, `backdrop.webp` | AI-generated key art, made by the project owner from a prompt written for this map (receding yellow office rooms under fluorescent panels, a demolition charge on the carpet, a soldier in a far doorway) | Project | CC0 1.0 | Cropped to 16:9 and scaled to 1672 × 941 and 720 × 405 |

The textures are built by `scripts/make-backrooms-textures.py`, the footsteps and the room loop by `scripts/make-backrooms-sounds.py`. The pools of light under the ceiling panels and the damp patches in the carpet are procedural shaders.

The story ending's replacement dining room (`src/story/shutdown/art/dining.png`) and four-frame breakfast (`src/story/shutdown/art/dining-meal.png`, individual frames in `art/meal/`) were generated for this project using the built-in image generator. The meal sheet preserves alpha and animates steam at 4 fps. Generation prompts and processing details are recorded in `tools/story/dining-assets.json`.

The replacement opening cover (`src/story/assets/comic-1.webp`), Bubble X illustration (`src/story/assets/comic-2.webp`), night/morning bedroom backgrounds, purple pixel logo, and four-frame CRT/dust animations were generated with the built-in image generator. Prompts, output paths, and sprite processing are recorded in `tools/story/comic-1-refresh.json` and `tools/story/visual-refresh.json`. Room animations run at 4 fps and pause with the story.

The empty-desk bedroom background, transparent four-state computer sheet (`src/story/assets/computer-setup.png`) and inventory icon were generated with the built-in image generator for the chapter-one pickup, placement and power sequence. Desk foreground masks are cropped from the corresponding night/morning backgrounds. Prompts, sources, and processing details are recorded in `tools/story/computer-setup-assets.json`.

## Match outcome sounds

`public/assets/match-victory.ogg`, `match-eliminated.ogg` and `type-tick.ogg` are original, synthesized for this project by `scripts/make-outcome-sounds.py` (additive synthesis, filtered noise and a synthetic hall reverb in NumPy, encoded with ffmpeg/libvorbis). The victory and elimination cues are deliberately restrained: a soft low hit and two felted notes over a sustained fifth. No third-party recordings.

`public/assets/shop-open.ogg`, `shop-close.ogg`, `shop-buy.ogg` and `shop-deny.ogg` are likewise original, synthesized by `scripts/make-shop-sounds.py`.

## Blind Fuse, Optical Camo and Missile Strike

`src/modules/skills/veil/activate.ogg`, `src/modules/skills/cloak/activate.ogg`, `public/assets/missile-incoming.ogg` and `public/assets/missile-impact.ogg` are original, synthesized for this project by `scripts/make-ability-sounds.py` (oscillators and filtered noise in NumPy, encoded with ffmpeg/libvorbis). No third-party recordings.

`src/modules/perks/missile-strike/missile.glb` is an original model built by `tools/model-forge/ordnance.ts` and exported with `tools/model-forge/export-node.ts`. It carries geometry only; its surfaces come from the shared texture sets listed above.

`public/assets/danger-veil.svg` (the blast-path outline shown to the owner of a concealed charge) is original artwork. The missile exhaust, explosion, shockwave, sparks, scorch mark and the optical-camo ripple are shaders written for this project; the smoke puffs reuse `smoke-cloud.png`.

`public/assets/crate-build.ogg` is original, synthesized for this project by `scripts/make-build-sound.py` (one damped hollow wooden "tock" from sine modes and filtered noise in NumPy, encoded with ffmpeg/libvorbis). It imitates the feel of placing a block in a voxel sandbox game but samples no third-party recording.

`public/assets/fire-ignite.ogg` is original, synthesized by `scripts/make-fire-sounds.py`. The Molotov model (`src/modules/items/molotov/model.glb`) is original, generated by `tools/model-forge`. Ground fire (`src/render/ground-fire.ts`) plays `public/assets/effects/fire-flames.webp` and `fire-smoke.webp`: the SmallFlame01 and WispySmoke03 flipbooks from Unity's [VFX Image Sequences & Flipbooks](https://unity.com/blog/engine-platform/free-vfx-image-sequences-flipbooks) (Unity Technologies, CC0 1.0), fetched from the ezEngine content mirror and packed by `scripts/make-fire-sheets.py`, which also adds a noise channel. The result-screen medal (`src/ui/outcome-badge.ts`) is procedural geometry and shaders written for this project; the medal is lit by the Three.js `RoomEnvironment` (MIT). No third-party models or recordings.

`public/assets/hud/perk-card-{silver,gold,diamond,mythic}.webp` (perk offer card frames per tier) were generated by the project owner with an image model from prompts written for this project, then downscaled to 512 px. No third-party artwork.

## Cues for skill endings, impacts and zombies

Built by `scripts/make-missing-sounds.py` from CC0 recordings in the [open-game-sfx-index mirror](https://github.com/Mcamento8/open-game-sfx-index/tree/main/audio) and from synthesis (oscillators and filtered noise in NumPy, encoded with ffmpeg/libvorbis).

| File | Source | Author | License | Changes |
| --- | --- | --- | --- | --- |
| `src/modules/skills/cloak/deactivate.ogg`, `src/modules/skills/veil/deactivate.ogg`, `src/modules/skills/scan/activate.ogg`, `src/modules/skills/medic/activate.ogg`, `public/assets/kill-confirm.ogg` | Synthesised for this project | Project | CC0 1.0 | — |
| `src/modules/skills/detonator/activate.ogg` | `metalLatch`, Kenney [RPG Audio](https://kenney.nl/assets/rpg-audio), with a synthesised double chirp | Kenney, Project | CC0 1.0 | Mixed |
| `src/modules/items/bandage/use.ogg` | `cloth1`, `cloth3`, `clothBelt2`, Kenney RPG Audio | Kenney | CC0 1.0 | Sequenced into one take |
| `public/assets/glass-shatter.ogg` | `impactGlass_heavy_001`, `impactGlass_medium_001`, `impactGlass_light_002`, Kenney [Impact Sounds](https://kenney.nl/assets/impact-sounds); `glass_004`, Kenney [Interface Sounds](https://kenney.nl/assets/interface-sounds); synthesised shards | Kenney, Project | CC0 1.0 | Layered |
| `public/assets/bomb-kick.ogg` | `impactPunch_heavy_002`, `impactMetal_medium_000`, `impactMetal_medium_003`, Kenney Impact Sounds | Kenney | CC0 1.0 | Layered, one layer slowed |
| `public/assets/cover-break-{0,1}.ogg` | `impactWood_heavy_000`/`003`, `impactPlank_medium_001`/`003`, `impactWood_light_000`–`004`, Kenney Impact Sounds | Kenney | CC0 1.0 | Layered into a crack and a scatter of splinters |
| `public/assets/body-fall.ogg` | `impactSoft_heavy_003`, `impactPunch_heavy_000`, Kenney Impact Sounds; `dropLeather`, `clothBelt`, Kenney RPG Audio | Kenney | CC0 1.0 | Layered |
| `public/assets/zone-wall.ogg` | `lowFrequency_explosion_001`, Kenney [Sci-Fi Sounds](https://kenney.nl/assets/sci-fi-sounds); `impactMining_000`, `impactMining_003`, Kenney Impact Sounds; synthesised grind | Kenney, Project | CC0 1.0 | Layered, slowed |
| `public/assets/zombie-spawn.ogg` | `zombie-16` from the [Zombies Sound Pack](https://opengameart.org/content/zombies-sound-pack); the spawn adds `impactMining_002` (Kenney) and synthesised earth | artisticdude, Kenney, Project | CC0 1.0 | Pitched down about 10 % |
| `public/assets/zombie-attack-{0,1}.ogg` | `zombie-24`, `zombie-11` from the Zombies Sound Pack; `swish_4`, `swish_2` from [Battle Sound Effects](https://opengameart.org/content/battle-sound-effects) | artisticdude, Ogrebane | CC0 1.0 | Layered, pitched down |
