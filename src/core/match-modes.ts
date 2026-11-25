export const MATCH_MODES = {
  freeForAll: { name:"自由乱斗", available:true },
  practice: { name:"练习模式", available:true },
  carnival: { name:"狂欢模式", available:false },
} as const;
export type MatchMode = keyof typeof MATCH_MODES;
export const DEFAULT_MODE: MatchMode = "freeForAll";
