/**
 * @agenteschat/tokens: the design system's values for platforms without CSS
 * (the phone app). `docs/design/design-system/tokens.css` is the source of
 * truth; a test keeps these equal to it. Names are the CSS custom properties
 * in camelCase (`--line2` → `line2`, `--raised-2` → `raised2`).
 */

export interface ThemeColors {
  bg: string;
  raised: string;
  raised2: string;
  sunken: string;
  /** The app shell: the sidebar's paper and the work area beside it. */
  side: string;
  pane: string;
  glass: string;
  glassSolid: string;
  line: string;
  line2: string;
  lineStrong: string;
  ink: string;
  ink2: string;
  muted: string;
  faint: string;
  /** The keyboard focus ring's color (`--focus-color`, the strong line). */
  focusColor: string;
  agent: string;
  agent2: string;
  agentSoft: string;
  onAgent: string;
  ok: string;
  warn: string;
  warnSoft: string;
  onWarn: string;
  danger: string;
  info: string;
  plate: string;
  plateSoft: string;
  scrim: string;
  /** Names from v1 (aliases that follow the theme). */
  surface: string;
  surfaceRaised: string;
  surfaceSunken: string;
  inkMuted: string;
  action: string;
  onAction: string;
  attention: string;
  onAttention: string;
  attentionSoft: string;
  success: string;
}

export const light: ThemeColors = {
  bg: "#f6f6fb",
  raised: "#ffffff",
  raised2: "#ffffff",
  sunken: "#e9e8f4",
  side: "#efeff8",
  pane: "#ffffff",
  glass: "rgba(255, 255, 255, 0.88)",
  glassSolid: "#f6f6fb",
  line: "rgba(14, 12, 42, 0.08)",
  line2: "rgba(14, 12, 42, 0.14)",
  lineStrong: "#6f6c91",
  ink: "#12102b",
  ink2: "#2b284d",
  muted: "#535076",
  faint: "#635f87",
  focusColor: "#6f6c91",
  agent: "#b34d00",
  agent2: "#e07b39",
  agentSoft: "#fff0e2",
  onAgent: "#ffffff",
  ok: "#1f7a45",
  warn: "#8a6200",
  warnSoft: "#fbeed5",
  onWarn: "#ffffff",
  danger: "#b42a20",
  info: "#0a6f9e",
  plate: "rgba(18, 16, 43, 0.08)",
  plateSoft: "rgba(18, 16, 43, 0.045)",
  scrim: "rgba(7, 6, 26, 0.36)",
  surface: "#f6f6fb",
  surfaceRaised: "#ffffff",
  surfaceSunken: "#e9e8f4",
  inkMuted: "#535076",
  action: "#12102b",
  onAction: "#f6f6fb",
  attention: "#8a6200",
  onAttention: "#ffffff",
  attentionSoft: "#fbeed5",
  success: "#12102b",
};

export const dark: ThemeColors = {
  bg: "#0e0c2a",
  raised: "#1a1940",
  raised2: "#22204f",
  sunken: "#07061a",
  side: "#0a0920",
  pane: "#13122f",
  glass: "rgba(14, 12, 42, 0.84)",
  glassSolid: "#1a1940",
  line: "rgba(214, 210, 255, 0.1)",
  line2: "rgba(214, 210, 255, 0.18)",
  lineStrong: "#7d79a8",
  ink: "#eeecfa",
  ink2: "#c9c6e4",
  muted: "#a09dc4",
  faint: "#908cb6",
  focusColor: "#7d79a8",
  agent: "#ffb46a",
  agent2: "#ffd09e",
  agentSoft: "#2b1c1c",
  onAgent: "#2a1300",
  ok: "#7ee2b0",
  warn: "#f0c954",
  warnSoft: "#2b2214",
  onWarn: "#2a1c00",
  danger: "#ff9a9a",
  info: "#5cc4ea",
  plate: "rgba(214, 210, 255, 0.12)",
  plateSoft: "rgba(214, 210, 255, 0.07)",
  scrim: "rgba(7, 6, 26, 0.6)",
  surface: "#0e0c2a",
  surfaceRaised: "#1a1940",
  surfaceSunken: "#07061a",
  inkMuted: "#a09dc4",
  action: "#eeecfa",
  onAction: "#0e0c2a",
  attention: "#f0c954",
  onAttention: "#2a1c00",
  attentionSoft: "#2b2214",
  success: "#eeecfa",
};

export const themes = { light, dark } as const;
export type ThemeName = keyof typeof themes;

/** One layer of a CSS `box-shadow` (px). */
export interface ShadowLayer {
  x: number;
  y: number;
  blur: number;
  spread: number;
  color: string;
  inset?: boolean;
}

export type ShadowName = "e1" | "e2" | "e3" | "top";

/** Elevations (`--e1`…`--e3`) and the raised top edge (`--top`), per theme, as layer lists. */
export const shadows: Record<ThemeName, Record<ShadowName, ShadowLayer[]>> = {
  light: {
    e1: [
      { x: 0, y: 1, blur: 1, spread: 0, color: "rgba(7, 6, 26, 0.04)" },
      { x: 0, y: 2, blur: 4, spread: -1, color: "rgba(7, 6, 26, 0.05)" },
      { x: 0, y: 0, blur: 0, spread: 1, color: "rgba(14, 12, 42, 0.08)" },
    ],
    e2: [
      { x: 0, y: 1, blur: 1, spread: 0, color: "rgba(7, 6, 26, 0.04)" },
      { x: 0, y: 6, blur: 16, spread: -4, color: "rgba(7, 6, 26, 0.1)" },
      { x: 0, y: 0, blur: 0, spread: 1, color: "rgba(14, 12, 42, 0.08)" },
    ],
    e3: [
      { x: 0, y: 2, blur: 4, spread: 0, color: "rgba(7, 6, 26, 0.04)" },
      { x: 0, y: 24, blur: 56, spread: -16, color: "rgba(7, 6, 26, 0.3)" },
      { x: 0, y: 0, blur: 0, spread: 1, color: "rgba(14, 12, 42, 0.14)" },
    ],
    top: [{ x: 0, y: 1, blur: 0, spread: 0, color: "rgba(255, 255, 255, 0.9)", inset: true }],
  },
  dark: {
    e1: [
      { x: 0, y: 1, blur: 2, spread: 0, color: "rgba(0, 0, 0, 0.5)" },
      { x: 0, y: 0, blur: 0, spread: 1, color: "rgba(214, 210, 255, 0.1)" },
    ],
    e2: [
      { x: 0, y: 8, blur: 20, spread: -6, color: "rgba(0, 0, 0, 0.6)" },
      { x: 0, y: 0, blur: 0, spread: 1, color: "rgba(214, 210, 255, 0.1)" },
    ],
    e3: [
      { x: 0, y: 28, blur: 64, spread: -16, color: "rgba(0, 0, 0, 0.8)" },
      { x: 0, y: 0, blur: 0, spread: 1, color: "rgba(214, 210, 255, 0.18)" },
    ],
    top: [{ x: 0, y: 1, blur: 0, spread: 0, color: "rgba(255, 255, 255, 0.06)", inset: true }],
  },
};

/** Corner radii (px). */
export const radius = {
  xs: 4,
  sm: 6,
  item: 10,
  md: 10,
  btn: 12,
  lg: 14,
  xl: 18,
  section: 20,
  cut: 2,
  full: 999,
} as const;

/** The agent symbol's corners (`--radius-agent`), as fractions of its size: top-left, top-right, bottom-right, bottom-left. */
export const agentRadius = [0.3, 0.3, 0.3, 0.09] as const;

/** Spacing steps (px), by `--space-N`. */
export const space = {
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  6: 24,
  8: 32,
} as const;

/** Type sizes (px). */
export const text = {
  xs: 12,
  sm: 13,
  md: 14.5,
  base: 15,
  lg: 16,
  h3: 17,
  h2: 20,
  h1: 28,
  display: 32,
} as const;

/** Letter spacing (em). */
export const tracking = {
  tight: -0.025,
  tighter: -0.035,
} as const;

/** Font families (the first family of each CSS stack; brand is Instrument Serif for the wordmark). */
export const fonts = {
  sans: "Onest",
  display: "Funnel Display",
  brand: "Instrument Serif",
  dot: "Doto",
  mono: "Martian Mono",
} as const;

/** Cubic bezier curves `[x1, y1, x2, y2]`: `spring` and `out` from the tokens; `ios` for sheets (`--drawer`). */
export const motion = {
  spring: [0.34, 1.4, 0.5, 1],
  out: [0.2, 0.8, 0.2, 1],
  ios: [0.32, 0.72, 0, 1],
} as const satisfies Record<string, readonly [number, number, number, number]>;

/** Durations in ms (`--dur-*`): fast for presses, menus and exits, base for dialogs, toasts and arrivals, panel for a
 *  side panel's slide. */
export const durations = { fast: 140, base: 180, panel: 240 } as const;
