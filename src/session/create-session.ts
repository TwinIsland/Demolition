import { BOT_PROFILES } from "../core/room";
import { BotAgent } from "../agents/bot-agent";
import type { MatchOptions, MatchSession } from "../core/types";
import { LocalMatchSession } from "./local-session";

/** Composition root: replace this factory with a server-backed MatchSession.
 * In that setup, bot policies run on the server, alongside Simulation. */
export function createSession(options: MatchOptions): MatchSession {
  const session = new LocalMatchSession(options);
  session.setAgents(BOT_PROFILES.map(p => new BotAgent(p.id)));
  return session;
}
