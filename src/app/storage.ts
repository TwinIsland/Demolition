/**
 * Typed access to localStorage. Storage can be blocked (private browsing, sandboxed frames, quota),
 * so every read falls back to "nothing saved" and every write is best-effort.
 */

/** Reads a raw entry, or undefined when it is missing or storage is unavailable. */
export function readEntry(key: string): string | undefined {
  try {
    return localStorage.getItem(key) ?? undefined;
  } catch {
    return undefined;
  }
}

/** Writes a raw entry and reports whether it was stored. */
function writeEntry(key: string, text: string): boolean {
  try {
    localStorage.setItem(key, text);
    return true;
  } catch {
    return false;
  }
}

export interface Codec<T> {
  /** Returns undefined, or throws, when the stored text is not a valid value. */
  decode(text: string): T | undefined;
  encode(value: T): string;
}

/** JSON entry; `validate` narrows the parsed value and returns undefined to reject it. */
export function jsonCodec<T>(validate: (raw: unknown) => T | undefined): Codec<T> {
  return { decode: (text) => validate(JSON.parse(text)), encode: (value) => JSON.stringify(value) };
}

/** Plain-text entry restricted to the strings `accepts` recognises. */
export function textCodec<T extends string>(accepts: (text: string) => text is T): Codec<T> {
  return { decode: (text) => (accepts(text) ? text : undefined), encode: (value) => value };
}

export const isRecord = (raw: unknown): raw is Record<string, unknown> =>
  typeof raw === "object" && raw !== null && !Array.isArray(raw);

export interface SettingOptions<T> {
  /** Key of the current schema. A changed data shape gets a new key (`…-v2`), never a silent reuse. */
  key: string;
  codec: Codec<T>;
  /** Keys of older schema versions, newest first. They are read and upgraded but never written. */
  legacy?: readonly { key: string; codec: Codec<T> }[];
}

/** One persisted setting, versioned by its storage key. */
export class Setting<T> {
  constructor(private readonly options: SettingOptions<T>) {}

  /** The saved value from the newest schema version present, or undefined when absent or invalid. */
  load(): T | undefined {
    for (const { key, codec } of [this.options, ...(this.options.legacy ?? [])]) {
      const text = readEntry(key);
      if (text === undefined) continue;
      try {
        return codec.decode(text);
      } catch {
        return undefined;
      }
    }
    return undefined;
  }

  save(value: T): boolean {
    return writeEntry(this.options.key, this.options.codec.encode(value));
  }
}
