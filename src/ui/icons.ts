const paths: Record<string, string> = {
  collapse:'<path d="m2 13 10-5 10 5-10 5zM3 17l9 5 9-5M8 2l4 4 4-4m-4 4V1"/>',
  bandage:'<path d="m4 13 9-9a3 3 0 0 1 4 0l3 3a3 3 0 0 1 0 4l-9 9a3 3 0 0 1-4 0l-3-3a3 3 0 0 1 0-4z"/><path d="m8 9 7 7m-3-11 7 7m-12 3 1 1m7-9 1 1"/>',
  dna:'<path d="M5 2c0 10 14 10 14 20M19 2c0 10-14 10-14 20M6 4h12M8 7h8M8 17h8M6 20h12"/>',
  apocalypse:'<path d="m14 2-2 6 5-2-3 7H9l2-4-5 3 3-7zM3 17l5-2m8 0 5 2M4 21l5-3 3 3 3-3 5 3"/>',
  knife:'<path d="M20 3c1 4-1 9-6 13l-4-4C13 8 16 5 20 3ZM9 12l5 5M10 15l-5 6-2-2 6-6"/>',
  lock: '<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3m-4 5v2"/>',
  chevron: '<path d="m6 9 6 6 6-6"/>',
  fullscreen: '<path d="M9 4H4v5m11-5h5v5M4 15v5h5m11-5v5h-5"/>',
  exitFullscreen: '<path d="M4 9h5V4m6 0v5h5M9 20v-5H4m16 0h-5v5"/>',
  graphics: '<path d="M3 6h7m4 0h7M3 12h3m4 0h11M3 18h11m4 0h3"/><circle cx="12" cy="6" r="2"/><circle cx="8" cy="12" r="2"/><circle cx="16" cy="18" r="2"/>',
  recover: '<path d="M4 10a8 8 0 1 1 0 5M4 5v5h5"/><path d="m13 6-4 7h4l-1 5 5-8h-4z"/>',
  stamina: '<rect x="3" y="6" width="16" height="12" rx="2"/><path d="M21 10v4m-14-4v4m4-4v4m4-4v4"/>',
  flame: '<path d="M13 2c1 6 5 7 5 12 0 4-3 7-7 7s-7-3-7-7c0-2 1-5 4-8 0 3 1 4 2 5 2-2 3-5 3-9Z"/><path d="M12 14c2 2 2 4 0 6"/>',
  grenade:'<path d="M10 7V4h5l4 4m-7-4V2"/><ellipse cx="12" cy="14" rx="7" ry="8"/><path d="M6 11h12M5 16h14m-9-8v13m4-13v13"/>',
  smoke:'<path d="m7 11 7-2 3 11-7 2zM8 10l-1-3 5-1 1 3m3-3c4-2-2-3 2-5"/>',
  chat: '<path d="M3 4h18v12H9l-5 4v-4H3zM7 8h10M7 12h7"/>',
  bubble:
    '<rect x="4" y="8" width="16" height="12" rx="1"/><path d="M9 8v12m6-12v12M12 8V5q0-3 4-3M7 12h10"/>',
  speed: '<path d="m13 3-3 8h7l-6 10 1-8H5l8-10Z"/>',
  flask:
    '<path d="M9 3h6m-5 0v6l-5 8a2 2 0 0 0 2 4h10a2 2 0 0 0 2-4l-5-8V3M8 14h8"/>',
  shield:
    '<path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6l8-3Z"/><path d="m9 12 2 2 4-4"/>',
  heart: '<path d="M20 5c-3-3-6-1-8 1-2-2-5-4-8-1-5 5 8 15 8 15S25 10 20 5Z"/>',
  surge:
    '<path d="m12 2 2.5 6.5L21 11l-6.5 2.5L12 20l-2.5-6.5L3 11l6.5-2.5L12 2Z"/><path d="m20 17 1 2 2 1-2 1-1 2-1-2-2-1 2-1 1-2Z"/>',
  radar:
    '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><path d="m12 12 7-7M12 3v2M3 12h2M12 19v2M19 12h2"/>',
  volume:
    '<path d="m11 4-5 4H3v8h3l5 4V4ZM15 8c3 2 3 6 0 8m3-11c5 4 5 10 0 14"/>',
  muted: '<path d="m11 4-5 4H3v8h3l5 4V4Zm5 5 6 6m0-6-6 6"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9 8c0-4 7-3 6 1-1 2-3 1-3 4m0 4h.01"/>',
  pause: '<path d="M8 5v14M16 5v14"/>',
  play: '<path d="m8 4 12 8-12 8V4Z"/>',
  close: '<path d="m6 6 12 12M18 6 6 18"/>',
  crown: '<path d="m3 6 4 4 5-7 5 7 4-4-2 13H5L3 6ZM5 22h14"/>',
  refresh:
    '<path d="M20 7v5h-5M4 17v-5h5M6 6a8 8 0 0 1 13 3M5 15a8 8 0 0 0 13 3"/>',
  map: '<path d="m3 5 6-2 6 2 6-2v16l-6 2-6-2-6 2V5ZM9 3v16M15 5v16"/>',
  target:
    '<circle cx="12" cy="12" r="7"/><path d="M12 1v7m0 8v7M1 12h7m8 0h7"/>',
};
export const icon = (name: string, cls = "") =>
  /^(?:\/|https?:\/\/|data:image\/)/i.test(name)
    ? `<img class="icon ${cls}" src="${name.replaceAll("&","&amp;").replaceAll('"',"&quot;").replaceAll("<","&lt;")}" alt=""/>`
    : `<svg class="icon ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] ?? paths.bubble}</svg>`;
