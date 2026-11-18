import { randomUUID } from "node:crypto";
import type { ScreenKind } from "@agenteschat/adapters";
import type { Judge, JudgeAnswer, JudgeQuestion } from "../judge";
import {
  describeElement,
  type ScreenElement,
  type ScreenImage,
  type ScreenObservation,
  type ScreenRegion,
  screenRef,
} from "./observation";

/**
 * Targets in words (ADR 0054): the agent says "the Sign in button" instead of
 * reading the screen and copying a number. Code finds it, cheapest first:
 *
 * 1. a ref (`e12`) as given;
 * 2. one element whose name is exactly the words (no judge);
 * 3. what the same words found on this site before (the target cache);
 * 4. the judge picks among the screen's elements (a Choice over refs, plus
 *    whether it's there at all);
 * 5. on an image of the screen, when the text has nothing that fits (`locate`).
 *
 * The judge only points at something already on the screen; it never decides
 * whether the agent may act.
 */

/** What an action needs its target to be: only fitting elements are offered. */
export type TargetUse = "click" | "fill" | "select" | "check" | "type_secret" | "upload" | "hover" | "window";

const FIELDS = new Set(["textbox", "searchbox", "combobox", "spinbutton", "textarea"]);
const ROLES: Partial<Record<TargetUse, ReadonlySet<string>>> = {
  fill: FIELDS,
  type_secret: new Set(["textbox"]),
  select: new Set(["combobox", "listbox"]),
  check: new Set(["checkbox", "radio", "switch", "menuitemcheckbox", "menuitemradio"]),
};
/** Controls, as opposed to text with a ref (a heading "Sign in" next to the button "Sign in"). */
export const CONTROLS = new Set([
  ...FIELDS,
  "button",
  "link",
  "menuitem",
  "menuitemcheckbox",
  "menuitemradio",
  "tab",
  "checkbox",
  "radio",
  "switch",
  "option",
  "listbox",
  "slider",
  "treeitem",
]);

export type TargetFound = {
  found: true;
  ref: string;
  element: ScreenElement | null;
  via: "ref" | "exact" | "cache" | "judge";
  confidence: number;
};
export type TargetMissing = {
  found: false;
  /** `unsure`: several fit; `absent`: nothing on the screen fits; `unjudged`: no calibrated judge answered. */
  reason: "unsure" | "absent" | "unjudged";
  candidates: ScreenElement[];
};
export type TargetResult = TargetFound | TargetMissing;

/** What a target's words found on a site, to find it again without the judge. */
export interface TargetMemory {
  role: string;
  name: string;
  /** Where it sat (its named containers): it is found again only there ("Delete" in the row for invoice 42). */
  context: string[];
  /** The judge found it can't be undone: it is never taken from memory. */
  costly?: boolean;
}

/** In-process memory of targets per agent and site (LRU). */
export interface TargetCache {
  get(key: string): TargetMemory | undefined;
  set(key: string, value: TargetMemory): void;
}

export function createTargetCache(max = 2000): TargetCache {
  const map = new Map<string, TargetMemory>();
  return {
    get(key) {
      const v = map.get(key);
      if (v) {
        map.delete(key);
        map.set(key, v);
      }
      return v;
    },
    set(key, value) {
      map.delete(key);
      map.set(key, value);
      if (map.size > max) map.delete(map.keys().next().value as string);
    },
  };
}

/** Words as targets and names are compared: lowercase, no accents or quotes, single spaces. */
export const normalizeWords = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/["'`“”‘’]/g, "")
    .replace(/\s+/g, " ")
    .trim();

/** The page a target belongs to, with ids in the path generalized (`/orders/:id`). */
export function pageKey(url: string | null): string {
  if (!url) return "";
  try {
    const u = new URL(url);
    const path = u.pathname
      .split("/")
      .map((p) => (/^\d+$|^[0-9a-f-]{8,}$|^[A-Za-z0-9_-]{20,}$/i.test(p) ? ":id" : p))
      .join("/");
    return `${u.host}${path}`;
  } catch {
    return url.slice(0, 200);
  }
}

export const targetKey = (scope: string, url: string | null, use: TargetUse, words: string) =>
  `${scope}|${pageKey(url)}|${use}|${normalizeWords(words)}`;

const WINDOWS = new Set(["window", "dialog", "alertdialog"]);
/**
 * A panel's button for a window (`button "Files - Thunar" [window, ref=e3]`): read from the attributes
 * right after the quoted name, so a name with "[window]" in it can't pass for one.
 */
const WINDOW_BUTTON = /^-\s+button(?:\s+"(?:[^"\\]|\\.)*")?\s*\[(?:[^\]]*?,\s*)?window\s*[,\]]/;

export const fits = (use: TargetUse, e: ScreenElement) =>
  use === "window" ? WINDOWS.has(e.role) || WINDOW_BUTTON.test(e.line) : (ROLES[use]?.has(e.role) ?? true);

/** The elements an action may target, best guesses first when there are too many for one question. */
function candidatesFor(words: string, use: TargetUse, o: ScreenObservation, max: number): ScreenElement[] {
  const fitting = o.elements.filter((e) => fits(use, e));
  // Only a window is brought to the front: with none on the screen, nothing else stands in.
  const pool = fitting.length > 0 || use === "window" ? fitting : o.elements;
  if (pool.length <= max) return pool;
  const terms = normalizeWords(words)
    .split(" ")
    .filter((t) => t.length > 1);
  const scored = pool.map((e) => {
    const text = normalizeWords(`${e.role} ${e.name} ${e.context.join(" ")}`);
    return { e, score: terms.reduce((n, t) => n + (text.includes(t) ? 1 : 0), 0) };
  });
  return scored
    .sort((a, b) => b.score - a.score || a.e.index - b.e.index)
    .slice(0, max)
    .map((s) => s.e)
    .sort((a, b) => a.index - b.index);
}

/** The one element with exactly these words as its name (and a fitting role), if there is exactly one. */
function exactMatch(words: string, use: TargetUse, o: ScreenObservation): ScreenElement | null {
  const w = normalizeWords(words.replace(/^(the|o|a|os|as)\s+/i, ""));
  if (!w) return null;
  const same = o.elements.filter((e) => fits(use, e) && normalizeWords(e.name) === w);
  if (same.length === 1) return same[0] as ScreenElement;
  // The same name on a heading and a button: the button is what one acts on.
  const controls = same.filter((e) => CONTROLS.has(e.role));
  if (controls.length === 1) return controls[0] as ScreenElement;
  // `button "Save"` written out.
  const m = /^([a-z]+)\s+"(.+)"$/i.exec(words.trim());
  if (m) {
    const role = (m[1] as string).toLowerCase();
    const name = normalizeWords(m[2] as string);
    const hits = o.elements.filter((e) => e.role.toLowerCase() === role && normalizeWords(e.name) === name);
    if (hits.length === 1) return hits[0] as ScreenElement;
  }
  return null;
}

/** The one element with the remembered role, name and place; none or several: the judge decides again. */
function fromMemory(memory: TargetMemory, o: ScreenObservation): ScreenElement | null {
  const place = memory.context.join(" › ");
  const same = o.elements.filter(
    (e) => e.role === memory.role && e.name === memory.name && e.context.join(" › ") === place,
  );
  return same.length === 1 ? (same[0] as ScreenElement) : null;
}

const memoryOf = (e: ScreenElement): TargetMemory => ({ role: e.role, name: e.name, context: e.context });

/** Most options one Choice offers (Jev takes 255, one is "none"). */
export const MAX_OPTIONS = 200;
/** The judge's pick is taken from this probability, this far ahead of the next one. */
export const PICK_AT = 0.55;
const PICK_MARGIN = 0.2;
/**
 * An element whose wrong pick costs (it pays, deletes, sends, throws work away): the judge must be this
 * sure, else the closest ones go back to the agent, which picks by number.
 */
export const COSTLY_PICK_AT = 0.85;
/**
 * Whether acting on the target can't be undone, asked of the judge with the pick: a screen in any language reads
 * the same. No answer is a yes.
 */
export const COSTLY: JudgeQuestion = {
  type: "noul",
  instructions:
    "Would acting on `target` pay, delete, send or do something else that can't be undone? A plain Yes or OK in a dialog that asks for such a thing does what the dialog asks.",
  criteria: {
    true: "It pays, buys, deletes, discards, empties, overwrites, replaces, sends, transfers, uninstalls, formats, cancels an account or a plan, closes without saving, or confirms one of these.",
    false: "It can be undone, or only opens, shows, selects or types something.",
  },
};
export const costlyOf = (answers: Record<string, JudgeAnswer>) => (answers.costly?.noul ?? 1) >= 0.5;
/** Below this, nothing on the screen is it. */
const ABSENT_BELOW = 0.3;

export interface ResolveInput {
  judge: Judge;
  orgId: string;
  agentId?: string | null;
  runId?: string;
  /** The ref or the words, as the agent gave them. */
  target: string;
  use: TargetUse;
  observation: ScreenObservation;
  cache?: TargetCache;
  /** Who the cache is for (the agent's browser): one agent's sites never steer another's. */
  scope: string;
}

/** Finds the element the agent means (see the file's comment for the order). */
export async function resolveTarget(input: ResolveInput): Promise<TargetResult> {
  const { observation: o } = input;
  const ref = screenRef(input.target);
  if (ref) {
    return {
      found: true,
      ref,
      element: o.elements.find((e) => e.ref === ref) ?? null,
      via: "ref",
      confidence: 1,
    };
  }
  const words = input.target.trim();
  const exact = exactMatch(words, input.use, o);
  if (exact) return { found: true, ref: exact.ref, element: exact, via: "exact", confidence: 1 };
  const key = targetKey(input.scope, o.url, input.use, words);
  const remembered = input.cache?.get(key);
  const again = remembered ? fromMemory(remembered, o) : null;
  // A costly one (delete, pay) is never taken from memory: its place is kept only in part (row text cut short).
  if (again && !remembered?.costly) return { found: true, ref: again.ref, element: again, via: "cache", confidence: 1 };

  const candidates = candidatesFor(words, input.use, o, MAX_OPTIONS);
  if (candidates.length === 0) return { found: false, reason: "absent", candidates: [] };
  const criteria: Record<string, string> = {};
  for (const e of candidates) criteria[e.ref] = describeElement(e);
  criteria.none = "None of these elements is it.";
  const questions: Record<string, JudgeQuestion> = {
    which: {
      type: "choice",
      instructions:
        "An agent is working on `screen` and wants to act on `target`. Which element is the one it means? Judge by what each element is, its name and where it sits.",
      criteria,
    },
    present: {
      type: "noul",
      instructions: "Is `target` one of the elements on `screen`?",
      criteria: {
        true: "One element on the screen is clearly what `target` describes.",
        false: "Nothing on the screen is what `target` describes, or it can't be told apart from others.",
      },
    },
    costly: COSTLY,
  };
  let answers: Record<string, JudgeAnswer>;
  try {
    answers = await input.judge.ask({
      orgId: input.orgId,
      agentId: input.agentId,
      runId: input.runId,
      kind: "screen_target",
      // The pick is taken on its probabilities (the margin, 0.85 for costly ones): only a calibrated
      // judge answers. The cheap model would say 1 to anything.
      calibrated: true,
      state: {
        target: words,
        action: input.use,
        screen: { address: o.url, elements: candidates.map((e) => `${e.ref}: ${describeElement(e)}`).join("\n") },
      },
      questions,
    });
  } catch {
    // No calibrated judge (or it failed): the closest by their words go back, and the agent picks by number.
    return { found: false, reason: "unjudged", candidates: closestByWords(words, candidates) };
  }
  return decide(answers, candidates, (picked, costly) => {
    input.cache?.set(key, { ...memoryOf(picked), costly });
  });
}

/**
 * The three elements that share the most words with the target: its name counts most, then its
 * role, then where it sits; a control comes before text with the same words.
 */
function closestByWords(words: string, candidates: ScreenElement[]): ScreenElement[] {
  const terms = normalizeWords(words)
    .split(" ")
    .filter((t) => t.length > 1);
  const hits = (text: string) => {
    const said = normalizeWords(text);
    return terms.filter((t) => said.includes(t)).length;
  };
  return candidates
    .map((e) => ({
      e,
      score: 2 * hits(e.name) + hits(e.role) + 0.5 * hits(e.context.join(" ")) + (CONTROLS.has(e.role) ? 0.5 : 0),
    }))
    .filter((s) => s.score > 0.5)
    .sort((a, b) => b.score - a.score || a.e.index - b.e.index)
    .slice(0, 3)
    .map((s) => s.e);
}

function decide(
  answers: Record<string, JudgeAnswer>,
  candidates: ScreenElement[],
  remember: (e: ScreenElement, costly: boolean) => void,
): TargetResult {
  const which = answers.which;
  const probabilities = which?.probabilities ?? {};
  const present = answers.present?.noul ?? 0;
  const ranked = candidates
    .map((e) => ({ e, p: probabilities[e.ref] ?? 0 }))
    .filter((r) => r.p > 0.02)
    .sort((a, b) => b.p - a.p);
  const choice = which?.choice;
  const picked = choice && choice !== "none" ? candidates.find((e) => e.ref === choice) : undefined;
  const p = choice ? (probabilities[choice] ?? 0) : 0;
  // The pick must stand out: ahead of the next element (or of "none").
  const next = Math.max(
    ranked.find((r) => r.e.ref !== choice)?.p ?? 0,
    choice === "none" ? 0 : (probabilities.none ?? 0),
  );
  // Elements that read the same can't be told apart, whatever the judge says: the agent picks by number.
  const twins = picked ? candidates.filter((e) => e !== picked && describeElement(e) === describeElement(picked)) : [];
  if (picked && twins.length > 0) {
    return { found: false, reason: "unsure", candidates: [picked, ...twins].slice(0, 3) };
  }
  const costly = costlyOf(answers);
  if (picked && p >= (costly ? COSTLY_PICK_AT : PICK_AT) && p - next >= PICK_MARGIN && present >= ABSENT_BELOW) {
    remember(picked, costly);
    return { found: true, ref: picked.ref, element: picked, via: "judge", confidence: p };
  }
  const top = ranked.slice(0, 3).map((r) => r.e);
  if (present < ABSENT_BELOW || (choice === "none" && p >= PICK_AT)) {
    return { found: false, reason: "absent", candidates: top };
  }
  return { found: false, reason: "unsure", candidates: top };
}

/** Where a target is on an image of the screen (the surface's pixels), with the element there if marked. */
export type Located =
  | { found: true; x: number; y: number; ref: string | null; confidence: number }
  | {
      found: false;
      reason: string;
      /** It is there, but only as a spot on the image, and the judge found it can't be undone. */
      refused?: true;
    };

/** How the judge is asked about each kind of screen. */
const ON_IMAGE: Record<ScreenKind, { what: string; present: string; absent: string }> = {
  browser: {
    what: "`screenshot` is a web page. The control may be only an icon: a gear for settings, a trash can for delete, a pencil for edit, a magnifier for search, × for close.",
    present: "Does `screenshot` show a control that does what `target` describes (maybe only as an icon)?",
    absent: "It isn't on the screenshot (hidden, scrolled away or not on this page).",
  },
  desktop: {
    what: "`screenshot` is a computer's desktop: windows, menus, a panel. The control may be only an icon: a gear for settings, a trash can for delete, a magnifier for search, x for close.",
    present: "Does `screenshot` show a control that does what `target` describes?",
    absent: "It isn't on the screenshot.",
  },
};
/** The judge must say it's there at least this sure, in every round. */
const PRESENT_AT = 0.6;
/**
 * The decision model answers a choice over images but draws no box (ADR 0200), so a spot is found by
 * narrowing: a 3x3 grid of cells that overlap, so a control on a border is whole in one cell.
 */
const GRID = 3;
/** A cell side is this share of the region's: cells start every 30%, so each overlaps its neighbor by 10%. */
const CELL = 0.4;
/** The region is narrowed until both sides are this many screen pixels or fewer: a click at its center lands. */
const SPOT_PX = 40;
/** At most this many narrowing rounds (each one request): 1920x1080 ends near 49x28 px. */
const MAX_ROUNDS = 4;
/** The image of a close-up, whatever part of the screen it shows (small regions are enlarged). */
const CLOSE_UP = { width: 480, height: 300 };

/** `image` drawn at `CLOSE_UP`'s size (a JPEG at the runner's quality); what it shows, and where, stay the same. */
async function asCloseUp(image: ScreenImage): Promise<ScreenImage> {
  const data = await new Bun.Image(Buffer.from(image.data, "base64"))
    .resize(CLOSE_UP.width, CLOSE_UP.height)
    .jpeg({ quality: 70 })
    .toBase64();
  return { ...image, data, ...CLOSE_UP };
}

/** The pick of a Choice: its key, and how sure the judge is of it. */
const pickOf = (a: JudgeAnswer | undefined) => {
  const choice = a?.choice;
  return { choice, p: choice ? (a?.probabilities?.[choice] ?? 0) : 0 };
};

/** The cells a region is split in, left to right and top to bottom, in screen pixels. */
function cellsOf(region: ScreenRegion): ScreenRegion[] {
  const out: ScreenRegion[] = [];
  const stride = (1 - CELL) / (GRID - 1);
  for (let r = 0; r < GRID; r++) {
    for (let c = 0; c < GRID; c++) {
      out.push({
        x: Math.round(region.x + c * stride * region.width),
        y: Math.round(region.y + r * stride * region.height),
        width: Math.round(CELL * region.width),
        height: Math.round(CELL * region.height),
      });
    }
  }
  return out;
}

/**
 * Looks for the target on an image of the screen, with `choice` questions only (ADR 0200).
 * With marks (an annotated screenshot) one question picks a marked element, so the action stays as
 * exact as a ref. Else, or when no mark fits, the screen is narrowed cell by cell (see `GRID`): each
 * round asks which cell holds the control, then looks again at that cell (a native-resolution
 * close-up through `zoom`, else the same image with the cells named by where they sit on it) until
 * the cell is `SPOT_PX` or less. A target the judge finds can't be undone (delete, discard…) is
 * never taken at a bare spot.
 */
export async function locateOnImage(input: {
  judge: Judge;
  orgId: string;
  agentId?: string | null;
  runId?: string;
  target: string;
  image: ScreenImage;
  url?: string | null;
  /** Which screen the image shows (default the browser's page). */
  kind?: ScreenKind;
  /** A close-up of a region of the screen, at its native size, or null when it can't be taken. */
  zoom?: (region: ScreenRegion) => Promise<ScreenImage | null>;
}): Promise<Located> {
  const words = ON_IMAGE[input.kind ?? "browser"];
  const target = input.target.trim();
  const ask = async (image: ScreenImage, which: JudgeQuestion, first: boolean) => {
    const placeholder = `screen_${randomUUID()}`;
    const answers: Record<string, JudgeAnswer> = await input.judge.ask({
      orgId: input.orgId,
      agentId: input.agentId,
      runId: input.runId,
      kind: "screen_locate",
      state: { screenshot: placeholder, address: input.url ?? null, target },
      images: { [placeholder]: { data: image.data, format: "jpeg" } },
      questions: {
        which,
        present: {
          type: "noul",
          instructions: words.present,
          criteria: { true: "It is visible on the screenshot.", false: words.absent },
        },
        ...(first ? { costly: COSTLY } : {}),
      },
    });
    return { ...pickOf(answers.which), present: answers.present?.noul ?? 0, costly: first && costlyOf(answers) };
  };
  const fail = (error: unknown): Located => ({
    found: false,
    reason: error instanceof Error ? error.message : String(error),
  });

  // Marks: one question over their numbers (the most a Choice takes, plus "none").
  const marks = (input.image.marks ?? []).slice(0, MAX_OPTIONS);
  let costly = true;
  if (marks.length > 0) {
    const criteria: Record<string, string> = {};
    for (const m of marks) criteria[m.ref] = `${m.number}: ${m.role}${m.name ? ` "${m.name}"` : ""}`;
    criteria.none = "None of the numbered elements is it.";
    try {
      const r = await ask(
        input.image,
        {
          type: "choice",
          instructions: `${words.what} Elements are drawn with a number. Which one does what \`target\` describes?`,
          criteria,
        },
        true,
      );
      if (r.present < PRESENT_AT) return { found: false, reason: "not on the screen" };
      costly = r.costly;
      const m = r.choice && r.choice !== "none" ? marks.find((e) => e.ref === r.choice) : undefined;
      if (m && r.p >= PICK_AT) {
        return {
          found: true,
          x: Math.round(m.box.x + m.box.width / 2),
          y: Math.round(m.box.y + m.box.height / 2),
          ref: m.ref,
          confidence: Math.min(r.p, r.present),
        };
      }
    } catch (error) {
      return fail(error);
    }
  }

  // No mark fits: narrow the screen down. `region` is in screen pixels; `shown` is what the image covers.
  const origin = input.image.origin ?? { x: 0, y: 0 };
  let region: ScreenRegion = { ...origin, ...input.image.viewport };
  let image = input.image;
  let shown: ScreenRegion = region;
  let confidence = 1;
  for (let round = 0; round < MAX_ROUNDS && (region.width > SPOT_PX || region.height > SPOT_PX); round++) {
    if (round > 0 && input.zoom) {
      // Only an image that says where it sits maps back; without one the cells are read on the image we have.
      const taken = await input.zoom(region).catch(() => null);
      const close = taken?.origin ? await asCloseUp(taken).catch(() => null) : null;
      if (close) {
        image = close;
        shown = { ...close.origin!, ...close.viewport };
      }
    }
    const cells = cellsOf(region);
    const pct = (v: number, from: number, side: number) => Math.round(((v - from) / side) * 100);
    const criteria: Record<string, string> = {};
    cells.forEach((c, i) => {
      criteria[String(i + 1)] =
        `cell ${i + 1}: from ${pct(c.x, shown.x, shown.width)}% to ${pct(c.x + c.width, shown.x, shown.width)}% across, from ${pct(c.y, shown.y, shown.height)}% to ${pct(c.y + c.height, shown.y, shown.height)}% down`;
    });
    criteria.none = "No cell holds it.";
    try {
      const r = await ask(
        image,
        {
          type: "choice",
          instructions: `${words.what} Cells of overlapping parts are numbered left to right, top to bottom, and named by where they sit on the image. Which cell holds the one control that does what \`target\` describes, whole?`,
          criteria,
        },
        round === 0,
      );
      if (round === 0) costly = r.costly;
      if (r.present < PRESENT_AT) return { found: false, reason: "not on the screen" };
      const cell = r.choice && r.choice !== "none" ? cells[Number(r.choice) - 1] : undefined;
      if (!cell || r.p < PICK_AT) return { found: false, reason: "unsure" };
      confidence = Math.min(confidence, r.p, r.present);
      region = cell;
    } catch (error) {
      return fail(error);
    }
  }
  // A spot is only as exact as a cell: something that can't be undone is done on an element, or not at all.
  if (costly) return { found: false, reason: "only a spot on the image", refused: true };
  return {
    found: true,
    x: Math.round(region.x + region.width / 2),
    y: Math.round(region.y + region.height / 2),
    ref: null,
    confidence,
  };
}
