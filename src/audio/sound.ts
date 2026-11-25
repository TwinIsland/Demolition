import { bombWarning } from "../core/bomb-warning";
import type { GameEvent, GameSnapshot, Vec2 } from "../core/types";
import { ITEMS, SKILLS, TIERS, isEquipment, perkById } from "../core/content";
export const MENU_MUSIC = "./assets/volatile-reaction.mp3";
const menuCues = { click: "ui-click", accept: "ui-accept", back: "ui-back" } as const;
function cueUrl(file:string) {
  return file.includes("/") || file.includes(":") ? file : `./assets/${file}.ogg`;
}
/** Downloaded recordings only; no synthesized oscillators. */
export class Sound {
  enabled = true;
  private menuMusic = new Audio(MENU_MUSIC);
  private fieldMusic = new Audio();
  private fire = new Audio("./assets/arena-fire.ogg");
  private fireVolume = 0;
  private lastResetId?: number;
  private lastResetSecond?: number;
  private countdownBeat?: string;
  private collapseBeat?: number;
  private aimedCell?: Vec2;
  private lastSelectionTick = -Infinity;
  private music = this.menuMusic;
  private context?: AudioContext;
  private analyser?: AnalyserNode;
  private analyserUnavailable = false;
  private bassBins = new Uint8Array(0);
  private bassFloor = 0;
  private pulse = 0;
  private lastBeatSample = -Infinity;
  private strides = new Map<string,{x:number;z:number;travel:number;index:number}>();
  private lastEvent = 0;
  private nextBlastRing = 0;
  private fuseBeats = new Map<number, number>();
  private samples = new Map<string, HTMLAudioElement>();
  private voices: HTMLAudioElement[] = [];
  private shortCues = new Map<string,AudioBuffer>();
  private shortVoices = new Set<AudioBufferSourceNode>();
  constructor() {
    this.fire.loop = true;
    this.fire.preload = "auto";
    for (const name of ["perk-embers",...Object.values(menuCues),"level-up"]) {
      const cue = new Audio(cueUrl(name));
      cue.preload = "auto";
      this.samples.set(name,cue);
    }
    for (const track of [this.menuMusic,this.fieldMusic]) {
      track.loop = true;
      track.volume = .18;
    }
    this.menuMusic.addEventListener("playing",this.connectSpectrum);
    this.prepareShortCues();
    this.start();
    document.addEventListener("click", this.start);
    document.addEventListener("keydown", this.start);
  }
  private prepareShortCues() {
    if (typeof AudioContext === "undefined") return;
    try { this.context = new AudioContext({latencyHint:"interactive"}); } catch { return; }
    const ctx = this.context;
    const files = new Set([...Object.values(menuCues),"hit","perk-embers","reset-signal","blast","mutation-award",
      "aim-step","clock-pulse","deploy-signal","fuse-tick","gear-equip",
      "blast-ringing","zombie-death","zombie-hurt-1","zombie-hurt-2"]);
    for (const cue of Object.values(ITEMS.shield?.shieldSounds ?? {})) files.add(cue);
    for (const item of Object.values(ITEMS)) if (item.melee) {
      if (item.sound) files.add(item.sound);
      if (item.melee.hitSound) files.add(item.melee.hitSound);
      for (const cue of Object.values(item.melee.coverSounds ?? {})) if (cue) files.add(cue);
    }
    for (const file of files) {
      void fetch(cueUrl(file)).then(async response => {
        if (response.ok) this.shortCues.set(file,await ctx.decodeAudioData(await response.arrayBuffer()));
      }).catch(() => { /* The regular media player can still play the URL. */ });
    }
  }
  private connectSpectrum = () => {
    if (this.music !== this.menuMusic || !this.enabled || this.analyserUnavailable || typeof AudioContext === "undefined") return;
    if (this.menuMusic.paused && !navigator.userActivation?.hasBeenActive) return;
    try {
      this.context ??= new AudioContext();
    } catch {
      this.analyserUnavailable = true;
      return;
    }
    const ctx = this.context;
    if (ctx.state === "suspended") {
      if (navigator.userActivation?.isActive)
        void ctx.resume().then(() => this.attachAnalyser(ctx)).catch(() => {});
    } else this.attachAnalyser(ctx);
  };
  private attachAnalyser(ctx: AudioContext) {
    if (this.analyser || ctx.state !== "running") return;
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 2048;
    analyser.smoothingTimeConstant = .30;
    analyser.minDecibels = -84;
    analyser.maxDecibels = -16;
    const output = ctx.createGain();
    output.gain.value = .18;
    ctx.createMediaElementSource(this.menuMusic).connect(analyser).connect(output).connect(ctx.destination);
    this.menuMusic.volume = 1;
    this.analyser = analyser;
    this.bassBins = new Uint8Array(Math.ceil(150 * analyser.fftSize / ctx.sampleRate));
  }
  menuBeat(time: number) {
    if (!this.enabled || this.music !== this.menuMusic || this.music.paused ||
        !this.analyser || this.context?.state !== "running") {
      this.lastBeatSample = -Infinity;
      this.pulse = 0;
      return 0;
    }
    const dt = time-this.lastBeatSample;
    if (dt < 1/60) return this.pulse;
    this.lastBeatSample = time;
    this.analyser.getByteFrequencyData(this.bassBins);
    const first = Math.max(1,Math.ceil(32*this.analyser.fftSize/this.context.sampleRate));
    let energy = 0;
    for (let i=first;i<this.bassBins.length;i++) energy += (this.bassBins[i]/255)**2;
    energy /= Math.max(1,this.bassBins.length-first);
    if (dt > .5) this.bassFloor = energy;
    const attack = Math.max(0, energy-this.bassFloor-.018);
    this.bassFloor += (energy-this.bassFloor)*(1-Math.exp(-dt*3.8));
    this.pulse = Math.max(this.pulse*Math.exp(-dt*12),Math.min(1,attack*4));
    return this.pulse;
  }
  start = () => {
    this.connectSpectrum();
    if (this.enabled && this.context?.state === "suspended" && navigator.userActivation?.isActive)
      void this.context.resume().catch(() => {});
    if (this.enabled && this.fireVolume > 0 && this.fire.paused) void this.fire.play().catch(() => {});
    if (this.enabled && this.music.paused)
      void this.music.play().catch(() => { /* Retry on user interaction. */ });
  };
  setMusic(path: string) {
    const url = new URL(path,document.baseURI).href;
    const track = url === this.menuMusic.src ? this.menuMusic : this.fieldMusic;
    if (track !== this.music) {
      this.music.pause();
      this.music = track;
      if (track === this.fieldMusic && track.src === url) track.currentTime = 0;
    }
    if (this.music.src !== url) {
      this.music.pause();
      this.music.src = url;
    }
    this.start();
  }
  menu(cue: keyof typeof menuCues = "click") {
    if (this.enabled) this.play(menuCues[cue], .56, true);
  }
  confirmEquipment() { if (this.enabled) this.play("gear-equip",.65,true); }
  selectionTick() {
    const now = performance.now();
    if (!this.enabled || now-this.lastSelectionTick < 55) return;
    this.lastSelectionTick = now;
    this.play("aim-step",.36);
  }
  aimAt(cell?:Vec2) {
    if (cell && this.aimedCell && (cell.x !== this.aimedCell.x || cell.z !== this.aimedCell.z))
      this.selectionTick();
    this.aimedCell = cell;
  }
  matchClock(state: Readonly<GameSnapshot>) {
    let beat: string | undefined;
    if (state.phase === "countdown") beat = "start-" + Math.ceil(state.countdown);
    else if (state.phase === "playing" && this.countdownBeat?.startsWith("start-")) beat = "go";
    else if (state.phase === "playing" && state.mode !== "practice") {
      const left = Math.ceil(state.duration-state.time);
      if (left > 0 && left <= 5) beat = "end-" + left;
    } else if (state.phase === "finished" && state.time >= state.duration) beat = "time-up";
    if (this.enabled && beat && beat !== this.countdownBeat)
      this.play(beat === "go" || beat === "time-up" ? "deploy-signal" : "clock-pulse",.64,true);
    this.countdownBeat = beat;
  }
  collapseClock(warningSeconds?: number) {
    if (this.enabled && warningSeconds !== undefined && warningSeconds !== this.collapseBeat) {
      const switching = warningSeconds === 0;
      this.play(switching ? "deploy-signal" : "clock-pulse", switching ? .52 : .46, true);
    }
    this.collapseBeat = warningSeconds;
  }
  toggle() {
    this.enabled = !this.enabled;
    if (this.enabled) this.start();
    else {
      this.music.pause();
      this.fire.pause();
      this.stopVoices();
    }
    return this.enabled;
  }
  reset() {
    this.battleFire(0);
    this.lastResetId = this.lastResetSecond = undefined;
    this.lastEvent = 0;
    this.nextBlastRing = 0;
    this.countdownBeat = undefined;
    this.collapseBeat = undefined;
    this.aimedCell = undefined;
    this.lastSelectionTick = -Infinity;
    this.fuseBeats.clear();
    this.strides.clear();
    this.stopVoices();
  }
  private stopVoices() {
    for (const node of this.shortVoices) node.stop();
    this.shortVoices.clear();
    this.voices.forEach((v) => v.pause());
    this.voices = [];
  }
  update(state: Readonly<GameSnapshot>, localId: string) {
    const self = state.players.find((p) => p.id === localId)!;
    if (state.phase === "playing") for (const p of state.players) {
      if (!p.alive) continue;
      const stride=this.strides.get(p.id) ?? {x:p.x,z:p.z,travel:0,index:p.id.length%3};
      if (p.verticalSpeed === 0) stride.travel+=Math.hypot(p.x-stride.x,p.z-stride.z);
      stride.x=p.x; stride.z=p.z;
      this.strides.set(p.id,stride);
      if (stride.travel<.85) continue;
      stride.travel%=.85;
      const volume=p.id===localId ? .29 : .18*Math.max(0,1-Math.hypot(p.x-self.x,p.z-self.z)/6);
      if (this.enabled && volume>.015) this.play(`footstep-${stride.index}`,volume);
      stride.index=(stride.index+1)%3;
    }
    for (const event of state.events)
      if (event.id > this.lastEvent && this.enabled) {
        const distance = Math.hypot(event.x - self.x, event.z - self.z);
        const own = event.playerId === localId;
        if (event.zombieId !== undefined && distance < 9) {
          const voice = event.zombieOutcome === "hurt" ? `zombie-hurt-${1+(event.id%2)}` : "zombie-death";
          this.play(voice,.66*(1-distance/10),own);
        }
        if (own && event.type === "blast-contact" && event.at >= this.nextBlastRing) {
          this.play("blast-ringing",.25,true);
          this.nextBlastRing = event.at + 1.45;
        }
        if (event.type === "shield-end" && event.shieldEnd) {
          const cue = ITEMS.shield?.shieldSounds?.[event.shieldEnd];
          const volume = event.shieldEnd === "broken" ? .88 : .54;
          if (cue && (own || distance < 7)) this.play(cue,own ? volume : volume*.6*(1-distance/7),own);
        } else if (event.type === "cover-hit" && event.item && event.coverSurface) {
          const cue = ITEMS[event.item]?.melee?.coverSounds?.[event.coverSurface];
          if (cue && (own || distance < 6)) this.play(cue,own ? .72 : .4*(1-distance/6),own);
        } else if (event.type === "blast" && distance < 9)
          this.play("blast",.55*Math.max(.1,1-distance/10));
        else if (own) this.localEvent(event);
      }
    const live = new Set(state.bombs.map((b) => b.id));
    for (const id of this.fuseBeats.keys())
      if (!live.has(id)) this.fuseBeats.delete(id);
    for (const bomb of state.bombs) {
      if (bomb.slide) continue;
      const warning = bombWarning(bomb.detonateAt, state.time);
      const previous = this.fuseBeats.get(bomb.id);
      this.fuseBeats.set(bomb.id, warning.beat);
      const distance = Math.hypot(bomb.x - self.x, bomb.z - self.z);
      if (
        this.enabled &&
        state.phase === "playing" &&
        distance < 8 &&
        previous !== warning.beat
      )
        this.play(
          "fuse-tick",
          (0.22 + 0.15 * warning.progress) * Math.max(0.1, 1 - distance / 9),
        );
    }
    this.lastEvent = Math.max(this.lastEvent, ...state.events.map((e) => e.id));
  }
  private localEvent(event: GameEvent) {
    const item = event.item ? ITEMS[event.item] : undefined;
    switch (event.type) {
      case "equip": return this.confirmEquipment();
      case "bomb": return this.play("charge-place",.38);
      case "equipment": return this.play(item?.sound ?? (item?.throwable ? "gear-throw" : "gear-equip"),.52);
      case "melee": return this.play(item?.sound ?? "gear-throw",.53,true);
      case "pickup": return this.play(item && isEquipment(item) ? "gear-pickup" : "pickup-confirm",.38);
      case "skill": return this.play((event.skill && SKILLS[event.skill]?.sound) || "skill-cast",.45);
      case "perk-use": return this.play("skill-cast",.52,true);
      case "perk": {
        const perk = event.perk && perkById(event.perk);
        if (perk) this.play(perk.sound ?? TIERS[perk.tier].sound,.5,true);
        return;
      }
      case "hurt": return this.play(event.blocked ? "shield-block" : "hurt",.8);
      case "hit": return this.play(item?.melee?.hitSound ?? "hit",.8,true);
    }
  }
  perkReady() {
    if (this.enabled) this.play("perk-embers", .8, true);
  }
  mutationReady() { if (this.enabled) this.play("mutation-award",.74,true); }
  battleFire(volume:number, resetId?:number, seconds?:number) {
    if (volume !== this.fireVolume) {
      this.fireVolume = volume;
      if (volume === 0) this.fire.pause();
      else {
        this.fire.volume = volume;
        if (this.enabled && this.fire.paused) void this.fire.play().catch(() => {});
      }
    }
    if (resetId === undefined || seconds === undefined ||
        (this.lastResetId === resetId && this.lastResetSecond === seconds)) return;
    this.lastResetId = resetId;
    this.lastResetSecond = seconds;
    if (this.enabled) this.play(seconds === 0 ? "blast" : "reset-signal",seconds === 0 ? .88 : .74,true);
  }
  levelUp() {
    if (this.enabled) this.play("level-up", .39, true);
  }
  private play(file: string, volume: number, priority = false) {
    const buffer=this.shortCues.get(file), ctx=this.context;
    if (buffer && ctx && (ctx.state === "running" || (ctx.state === "suspended" && navigator.userActivation?.isActive))) {
      if (ctx.state === "suspended") void ctx.resume().catch(() => {});
      if (this.shortVoices.size >= 12 && !priority) return;
      const voice=ctx.createBufferSource(), gain=ctx.createGain();
      voice.buffer=buffer;
      gain.gain.value=volume;
      voice.connect(gain).connect(ctx.destination);
      this.shortVoices.add(voice);
      voice.onended=()=>{ this.shortVoices.delete(voice); voice.disconnect(); gain.disconnect(); };
      voice.start();
      return;
    }
    this.voices = this.voices.filter((v) => !v.ended);
    if (this.voices.length >= 20) {
      if (!priority) return;
      this.voices.shift()?.pause();
    }
    let sample = this.samples.get(file);
    if (!sample) {
      sample = new Audio(cueUrl(file));
      sample.preload = "auto";
      this.samples.set(file, sample);
    }
    const voice = sample.cloneNode(true) as HTMLAudioElement;
    voice.volume = volume;
    this.voices.push(voice);
    void voice.play().catch(() => {
      this.voices = this.voices.filter((v) => v !== voice);
    });
  }
  dispose() {
    document.removeEventListener("click", this.start);
    document.removeEventListener("keydown", this.start);
    this.music.pause();
    this.menuMusic.removeEventListener("playing",this.connectSpectrum);
    this.reset();
    if (this.context) void this.context.close().catch(() => {});
  }
}
