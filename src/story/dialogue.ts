import { SPEAKER_NAMES, type Line, type Speaker } from "./script";

/** Characters revealed per second. */
const TYPE_SPEED = 34;
/** Characters between two ticks of the typing sound. */
const TICK_EVERY = 3;

export const dialogueMarkup = `
  <div class="story-dialogue" hidden>
    <img class="story-portrait" alt="" hidden />
    <div class="story-speech">
      <div class="story-name"></div>
      <p class="story-text"></p>
      <ol class="story-choices" hidden></ol>
    </div>
    <i class="story-next" aria-hidden="true"></i>
  </div>`;

/**
 * The text box of the story: types a line out, waits for the player, and offers choices.
 * `play` resolves with the option picked at each flagged choice.
 */
export class DialogueBox {
  private readonly box: HTMLElement;
  private readonly portrait: HTMLImageElement;
  private readonly name: HTMLElement;
  private readonly text: HTMLElement;
  private readonly choices: HTMLElement;
  private timer = 0;
  private full = "";
  private shown = 0;
  private options: readonly string[] = [];
  private selected = 0;
  private proceed?: (pick: number) => void;
  private playing = false;

  constructor(
    root: HTMLElement,
    private readonly portraits: Partial<Record<Speaker, string>>,
    private readonly sounds: { tick(): void; move(): void; accept(): void },
  ) {
    this.box = root.querySelector<HTMLElement>(".story-dialogue")!;
    this.portrait = this.box.querySelector<HTMLImageElement>(".story-portrait")!;
    this.name = this.box.querySelector<HTMLElement>(".story-name")!;
    this.text = this.box.querySelector<HTMLElement>(".story-text")!;
    this.choices = this.box.querySelector<HTMLElement>(".story-choices")!;
    this.choices.addEventListener("click", (event) => {
      const item = (event.target as HTMLElement).closest<HTMLElement>("[data-option]");
      if (item) this.choose(Number(item.dataset.option));
    });
  }

  get active() {
    return this.playing;
  }

  async play(lines: readonly Line[]): Promise<Record<string, number>> {
    const picks: Record<string, number> = {};
    this.playing = true;
    this.box.hidden = false;
    for (const line of lines) {
      if ("choice" in line) {
        const pick = await this.ask(line.choice);
        if (line.flag) picks[line.flag] = pick;
      } else await this.say(line.who, line.text);
    }
    this.box.hidden = true;
    this.playing = false;
    return picks;
  }

  /** The confirm key: finishes the line being typed, then moves on. */
  confirm() {
    if (this.options.length) this.choose(this.selected);
    else if (this.shown < this.full.length) this.reveal(this.full.length);
    else this.advance(0);
  }

  /** Moves the highlight among the options of an open choice. */
  navigate(step: number) {
    if (!this.options.length || !step) return;
    this.selected = (this.selected + step + this.options.length) % this.options.length;
    this.sounds.move();
    this.paintChoices();
  }

  choose(index: number) {
    if (index < 0 || index >= this.options.length) return;
    this.sounds.accept();
    this.advance(index);
  }

  dispose() {
    clearInterval(this.timer);
    this.proceed = undefined;
  }

  private advance(pick: number) {
    const proceed = this.proceed;
    this.proceed = undefined;
    proceed?.(pick);
  }

  private say(who: Speaker, text: string) {
    const portrait = this.portraits[who];
    this.portrait.hidden = !portrait;
    if (portrait) this.portrait.src = portrait;
    this.box.dataset.who = who;
    this.name.textContent = SPEAKER_NAMES[who];
    this.choices.hidden = true;
    this.options = [];
    this.full = text;
    this.reveal(0);
    clearInterval(this.timer);
    this.timer = window.setInterval(() => this.reveal(this.shown + 1), 1000 / TYPE_SPEED);
    return new Promise<number>((resolve) => (this.proceed = resolve));
  }

  private reveal(count: number) {
    this.shown = Math.min(count, this.full.length);
    this.text.textContent = this.full.slice(0, this.shown);
    const done = this.shown >= this.full.length;
    this.box.classList.toggle("waiting", done);
    if (done) clearInterval(this.timer);
    else if (this.shown % TICK_EVERY === 1) this.sounds.tick();
  }

  private ask(options: readonly string[]) {
    clearInterval(this.timer);
    this.options = options;
    this.selected = 0;
    this.box.classList.remove("waiting");
    this.choices.hidden = false;
    this.paintChoices();
    return new Promise<number>((resolve) => (this.proceed = resolve));
  }

  private paintChoices() {
    this.choices.replaceChildren(
      ...this.options.map((option, index) => {
        const item = document.createElement("li");
        item.dataset.option = String(index);
        item.textContent = option;
        item.classList.toggle("selected", index === this.selected);
        return item;
      }),
    );
  }
}
