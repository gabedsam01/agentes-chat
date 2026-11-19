import { describe, expect, test } from "bun:test";
import { createFakeJudge, formatPlanReport, locateOnImage, runPlan, type ScreenImage, type ScreenRegion } from "../src";
import {
  acted,
  cells,
  cellsAnswer,
  closeUpOf,
  fakeScreen,
  type Point,
  screenImage,
  THUNAR,
  ticking,
} from "./screen-fixtures";

const ids = { orgId: "o", agentId: "a", runId: "r" };

/** A close-up taker that records the regions asked for. */
function zoomer(make: (region: ScreenRegion) => ScreenImage | null = closeUpOf) {
  const asked: ScreenRegion[] = [];
  return {
    asked,
    zoom: async (region: ScreenRegion) => {
      asked.push(region);
      return make(region);
    },
  };
}

const MENU_ITEM: Point = { x: 300, y: 85 };
const locate = (judge: ReturnType<typeof cells>, extra: Partial<Parameters<typeof locateOnImage>[0]> = {}) =>
  locateOnImage({ judge, ...ids, target: "Settings in the menu", kind: "desktop", image: screenImage(), ...extra });

describe("a target on the screen image", () => {
  test("without marks the screen is narrowed in rounds of close-ups until a click lands on it", async () => {
    const z = zoomer();
    const judge = cells(MENU_ITEM);
    const spot = await locate(judge, { zoom: z.zoom });
    // Four rounds of nine requests, one cell picture and one yes/no each; once, on the whole screen, whether
    // it is there and whether it can't be undone; and the spot's check with a cross on it.
    expect(judge.calls).toHaveLength(1 + 4 * 9 + 1);
    const whole = judge.calls.filter((c) => "present" in c.questions);
    expect(whole).toHaveLength(1);
    expect(Object.keys(whole[0]?.questions ?? {})).toEqual(["present", "costly"]);
    expect(Object.keys(whole[0]?.images ?? {})).toEqual([whole[0]?.state.screenshot as string]);
    const cell = judge.calls.find((c) => "holds" in c.questions);
    expect(Object.keys(cell?.images ?? {})).toEqual([cell?.state.picture as string]);
    // Each close-up is the chosen cell, 40% of the last region.
    expect(z.asked).toHaveLength(3);
    expect(z.asked[0]?.width).toBe(Math.round(0.4 * 1280));
    expect(spot.found).toBe(true);
    if (spot.found) {
      expect(spot.ref).toBeNull();
      expect(Math.abs(spot.x - MENU_ITEM.x)).toBeLessThanOrEqual(20);
      expect(Math.abs(spot.y - MENU_ITEM.y)).toBeLessThanOrEqual(20);
    }
  });

  test("without close-ups the cells are cut from the one image and the spot is still found", async () => {
    const judge = cells(MENU_ITEM);
    const spot = await locate(judge);
    expect(judge.calls).toHaveLength(1 + 4 * 9 + 1);
    expect(spot.found).toBe(true);
    if (spot.found) {
      expect(Math.abs(spot.x - MENU_ITEM.x)).toBeLessThanOrEqual(20);
      expect(Math.abs(spot.y - MENU_ITEM.y)).toBeLessThanOrEqual(20);
    }
  });

  test("a close-up that can't be taken falls back to the image we have", async () => {
    const z = zoomer(() => null);
    const spot = await locate(cells(MENU_ITEM), { zoom: z.zoom });
    expect(spot.found).toBe(true);
  });

  test("with marks, one question picks the element and the answer is its ref", async () => {
    const image = screenImage([
      { ref: "e7", number: 7, role: "menuitem", name: "Settings", box: { x: 250, y: 75, width: 120, height: 24 } },
      { ref: "e8", number: 8, role: "menuitem", name: "Help", box: { x: 250, y: 100, width: 120, height: 24 } },
    ]);
    const judge = createFakeJudge((kind, id, _state, q) => {
      if (kind !== "screen_locate") return undefined;
      if (id === "costly") return 0.95;
      if (id === "present") return 0.9;
      expect(Object.keys((q as { criteria: Record<string, string> }).criteria)).toEqual(["e7", "e8", "none"]);
      return { choice: "e7", probabilities: { e7: 0.9 } };
    });
    // Even a target that can't be undone is fine on a ref.
    expect(await locate(judge, { image })).toEqual({ found: true, x: 310, y: 87, ref: "e7", confidence: 0.9 });
    expect(judge.calls).toHaveLength(1);
    const asked = judge.calls[0];
    const key = Object.keys(asked?.images ?? {})[0] as string;
    expect(asked?.state.screenshot).toBe(key);
  });

  test("a mark without a name is checked with a cross; a no narrows the screen instead", async () => {
    const image = screenImage([
      { ref: "e7", number: 7, role: "button", box: { x: 600, y: 700, width: 20, height: 20 } },
    ]);
    const narrow = cellsAnswer(MENU_ITEM);
    let checks = 0;
    const judge = createFakeJudge((kind, id, state, q, request) => {
      if (kind !== "screen_locate") return undefined;
      if (id === "which") return { choice: "e7", probabilities: { e7: 0.9 } };
      if (id === "on") return checks++ === 0 ? 0.1 : 0.9;
      return narrow(kind, id, state, q, request);
    });
    const spot = await locate(judge, { image });
    expect(checks).toBe(2);
    expect(spot).toMatchObject({ found: true, ref: null });
  });

  test("no mark fits: the screen is narrowed instead", async () => {
    const image = screenImage([
      { ref: "e7", number: 7, role: "menuitem", box: { x: 0, y: 700, width: 10, height: 10 } },
    ]);
    const narrow = cellsAnswer(MENU_ITEM);
    const judge = createFakeJudge((kind, id, state, q, request) => {
      if (kind !== "screen_locate") return undefined;
      if (id === "which") return { choice: "none", probabilities: { none: 0.9 } };
      return narrow(kind, id, state, q, request);
    });
    const spot = await locate(judge, { image });
    expect(judge.calls.length).toBeGreaterThan(1);
    expect(spot).toMatchObject({ found: true, ref: null });
  });

  test("an unsure pick, or a target that isn't there, is not found", async () => {
    expect(await locate(cells(MENU_ITEM, { p: 0.3 }))).toEqual({ found: false, reason: "unsure" });
    expect(await locate(cells(MENU_ITEM, { present: 0.2 }))).toEqual({ found: false, reason: "not on the screen" });
    // The spot found is checked with a cross drawn on it: a no there is not clicked.
    expect(await locate(cells(MENU_ITEM, { on: 0.2 }))).toEqual({ found: false, reason: "unsure" });
  });

  test("a target that can't be undone is never taken at a bare spot", async () => {
    const judge = cells(MENU_ITEM, { costly: 0.95 });
    expect(await locate(judge)).toEqual({ found: false, reason: "only a spot on the image", refused: true });
  });

  test("a judge that fails says why", async () => {
    const judge = createFakeJudge(() => {
      throw new Error("no decision model");
    });
    expect(await locate(judge)).toEqual({ found: false, reason: "no decision model" });
  });
});

describe("plans with images", () => {
  test("a surface that takes close-ups gets the zoom; one that can't (the browser) never asks for a region", async () => {
    const zooming = fakeScreen(THUNAR, { capture: (r) => (r ? closeUpOf(r) : screenImage()), regions: true });
    const judge = cells(MENU_ITEM);
    const report = await runPlan({ judge, ...ids, surface: zooming, scope: "a", vision: true }, [
      { do: "click", target: "the gear icon" },
    ]);
    expect(report.stopped).toBeUndefined();
    expect(zooming.captures[0]).toBeUndefined();
    expect(zooming.captures).toHaveLength(4);
    const click = acted(zooming.actions)[0] as { kind: string; at: Point };
    expect(click.kind).toBe("click");
    expect(Math.abs(click.at.x - MENU_ITEM.x)).toBeLessThanOrEqual(20);
    expect(report.steps[0]?.via).toBe("image");

    const flat = cells(MENU_ITEM);
    const plain = fakeScreen(THUNAR, { kind: "browser", url: "https://app.example/", capture: () => screenImage() });
    await runPlan({ judge: flat, ...ids, surface: plain, scope: "a", vision: true }, [
      { do: "click", target: "the gear icon" },
    ]);
    expect(plain.captures).toEqual([undefined]);
    expect(flat.calls.filter((c) => c.kind === "screen_locate")).toHaveLength(1 + 4 * 9 + 1);
    const flatClick = acted(plain.actions)[0] as { at: Point };
    expect(Math.abs(flatClick.at.x - MENU_ITEM.x)).toBeLessThanOrEqual(20);
  });

  test("a costly target only on the image stops the plan and says why; nothing is clicked", async () => {
    const judge = cells({ x: 640, y: 400 }, { costly: 0.95 });
    const surface = fakeScreen(THUNAR, { capture: () => screenImage() });
    const report = await runPlan({ judge, ...ids, surface, scope: "a", vision: true }, [
      { do: "click", target: "Move to Trash" },
    ]);
    expect(report.stopped?.reason).toStartWith(
      "found \"Move to Trash\" only on the screen image, not as an element: something that can't be undone isn't done at a bare spot",
    );
    expect(acted(surface.actions)).toHaveLength(0);
  });

  test("an expectation the text leaves unsure is judged once more with an image", async () => {
    const judge = createFakeJudge((kind, _id, _state, _q, request) =>
      kind === "screen_check" ? (request.images ? 0.9 : 0.5) : undefined,
    );
    const surface = fakeScreen(THUNAR, { capture: () => screenImage() });
    const report = await runPlan({ judge, ...ids, surface, scope: "a", vision: true, now: ticking() }, [
      { do: "click", target: "Back", expect: "the home folder shows" },
    ]);
    expect(report.stopped).toBeUndefined();
    expect(report.steps[0]?.expected).toEqual({ met: true, p: 0.9 });
    const checks = judge.calls.filter((c) => c.kind === "screen_check");
    expect(checks.filter((c) => c.images)).toHaveLength(1);
    expect(checks.at(-1)?.images).toBeDefined();
    expect(formatPlanReport(report).summary).toBe('Clicked button (e25) (✓ "the home folder shows").');

    // Without vision it stays unsure, and the plan says it couldn't confirm it.
    const blind = createFakeJudge((kind) => (kind === "screen_check" ? 0.5 : undefined));
    const unsure = await runPlan({ judge: blind, ...ids, surface, scope: "a", now: ticking() }, [
      { do: "click", target: "Back", expect: "the home folder shows" },
    ]);
    expect(unsure.stopped?.reason).toBe('couldn\'t confirm "the home folder shows" on the screen');
    expect(blind.calls.some((c) => c.images)).toBe(false);

    // A clear no on the text isn't asked again.
    const no = createFakeJudge((kind) => (kind === "screen_check" ? 0.05 : undefined));
    await runPlan({ judge: no, ...ids, surface, scope: "a", vision: true, now: ticking() }, [
      { do: "click", target: "Back", expect: "the home folder shows" },
    ]);
    expect(no.calls.some((c) => c.images)).toBe(false);
  });

  test("a wait the text leaves unsure ends when the image shows it", async () => {
    const judge = createFakeJudge((kind, _id, _state, _q, request) =>
      kind === "screen_check" ? (request.images ? 0.9 : 0.5) : undefined,
    );
    const surface = fakeScreen(THUNAR, { capture: () => screenImage() });
    const report = await runPlan({ judge, ...ids, surface, scope: "a", vision: true, now: ticking() }, [
      { do: "wait", until: "the copy finished", seconds: 10 },
    ]);
    expect(report.stopped).toBeUndefined();
    expect(report.steps[0]?.note).toBe('"the copy finished" is true');
    expect(judge.calls.map((c) => Boolean(c.images))).toEqual([false, true]);
  });
});
