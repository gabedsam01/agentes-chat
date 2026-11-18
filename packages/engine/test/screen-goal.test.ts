import { describe, expect, test } from "bun:test";
import { createFakeJudge, formatPlanReport, type JudgeAnswer, runGoal, runPlan, screenStepOf } from "../src";
import { fakeScreen } from "./screen-fixtures";

const FORM = `- heading "Sign in" [level=1, ref=e2]
- textbox "Email" [ref=e3]
- button "Sign in" [ref=e5]
- button "Delete account" [ref=e6]`;
const DONE = `- heading "Welcome" [level=1, ref=e2]
- button "Sign out" [ref=e9]`;

type Turn = { op: string | JudgeAnswer; target?: string; value?: string; reached?: number; costly?: number };

/** A judge that answers each round of the loop from `turns`, in order. */
function scripted(turns: Turn[]) {
  let round = -1;
  return createFakeJudge((kind, id) => {
    if (kind === "screen_goal" && id === "operation") round++;
    const t = turns[Math.min(round, turns.length - 1)] as Turn;
    if (kind === "screen_goal_costly") return t.costly ?? 0;
    switch (id) {
      case "operation":
        return t.op;
      case "click_target":
      case "type_target":
      case "select_target":
        return t.target;
      case "value":
        return t.value;
      case "reached":
        return t.reached ?? 0;
      default:
        return undefined;
    }
  });
}

/** The screen shows `shows[i]` after the i-th action. */
function surfaceShowing(...shows: string[]) {
  const surface = fakeScreen(FORM, { kind: "browser", url: "https://acme.test/login" });
  const perform = surface.perform.bind(surface);
  let n = 0;
  surface.perform = async (action, options) => {
    const out = await perform(action, options);
    const next = shows[n++];
    if (next !== undefined) surface.show(next);
    return out.ok ? { ...out, observation: await surface.observe() } : out;
  };
  return surface;
}

const goalOf = (steps?: number, values?: Record<string, string>) => ({
  do: "goal" as const,
  goal: "sign in",
  ...(values ? { values } : {}),
  ...(steps ? { steps } : {}),
});
const run = (surface: ReturnType<typeof fakeScreen>, judge: ReturnType<typeof scripted>, step = goalOf()) =>
  runGoal({ judge, orgId: "o", agentId: "a", surface, scope: "s" }, step);

describe("the goal step", () => {
  test("is parsed with its values capped to text", () => {
    const s = screenStepOf({ do: "goal", goal: "x", values: { a: "1", b: 2, none: "z" }, steps: 4 }, ["goal"]);
    expect(s).toEqual({ do: "goal", goal: "x", values: { a: "1" }, steps: 4 });
  });

  test("types a provided value, clicks, and is done once the screen shows it", async () => {
    const surface = surfaceShowing(FORM, DONE);
    const judge = scripted([
      { op: "type", target: "e3", value: "email" },
      { op: "click", target: "e5" },
      { op: "done", reached: 0.9 },
    ]);
    const out = await run(surface, judge, goalOf(5, { email: "ana@example.com" }));
    expect(out.stop).toBeUndefined();
    expect(surface.actions).toEqual([
      { kind: "fill", at: { ref: "e3" }, text: "ana@example.com" },
      { kind: "click", at: { ref: "e5" } },
    ]);
    expect(out.actions.map((a) => a.step.do)).toEqual(["fill", "click"]);
    expect(JSON.stringify(out.actions)).not.toContain("ana@example.com");
  });

  test("stops before a click that can't be undone, without performing it", async () => {
    const surface = surfaceShowing();
    const judge = scripted([{ op: "click", target: "e6", costly: 0.95 }]);
    const out = await run(surface, judge);
    expect(surface.actions).toEqual([]);
    expect(out.stop?.reason).toContain("can't be undone");
    expect(out.stop?.candidates?.map((e) => e.ref)).toEqual(["e6"]);
  });

  test("stops unsure on a low probability", async () => {
    const surface = surfaceShowing();
    const judge = scripted([{ op: { choice: "click", probabilities: { click: 0.3 } } }]);
    const out = await run(surface, judge);
    expect(surface.actions).toEqual([]);
    expect(out.stop?.reason).toContain("couldn't tell");
  });

  test("done needs the goal shown as reached", async () => {
    const surface = surfaceShowing();
    const out = await run(surface, scripted([{ op: "done", reached: 0.2 }]));
    expect(out.stop?.reason).toContain("doesn't clearly show");
  });

  test("stops after the step limit", async () => {
    const surface = surfaceShowing("a", "b", "c", "d");
    const out = await run(surface, scripted([{ op: "scroll_down" }]), goalOf(3));
    expect(surface.actions).toHaveLength(3);
    expect(out.stop?.reason).toContain("3 actions");
  });

  test("stops when the same action changes nothing twice", async () => {
    const surface = surfaceShowing();
    const out = await run(surface, scripted([{ op: "click", target: "e5" }]), goalOf(10));
    expect(surface.actions).toHaveLength(2);
    expect(out.stop?.reason).toContain("changed nothing twice");
  });

  test("stops when no judge can answer", async () => {
    const judge = { name: "none", ask: () => Promise.reject(new Error("no judge")) };
    const out = await runGoal(
      { judge, orgId: "o", surface: surfaceShowing(), scope: "s" },
      goalOf(),
    );
    expect(out.stop?.reason).toContain("no judge");
  });

  test("its actions are steps of the plan's report", async () => {
    const surface = surfaceShowing(DONE);
    const judge = scripted([{ op: "click", target: "e5" }, { op: "done", reached: 1 }]);
    const report = await runPlan({ judge, orgId: "o", surface, scope: "s" }, [goalOf()]);
    expect(report.stopped).toBeUndefined();
    expect(report.steps[0]?.goal?.actions).toHaveLength(1);
    expect(formatPlanReport(report).summary).toContain("Clicked button (e5)");
  });
});
