# 0200. Only production decisions, a target found by choice, and goals a screen reaches in fast steps

- Status: Accepted
- Date: 2026-11-18
- Builds on: ADR 0054 (a fast browser: the screen layer, targets in words), ADR 0062 (desktop computer use), ADR 0195 (an optional decision model beside Jev)
- Changes: ADR 0054 §2 (targets on an image are found by choice, never a box), ADR 0195 §4 and §6 (the box question and pictures go to Jev no more; pictures go to the decision model when it reads them)
- Code: `packages/engine/src/judge.ts`, `packages/engine/src/decision-model.ts`, `packages/engine/src/screen/targets.ts`, `packages/engine/src/screen/goal.ts` (new), `browser/tools.ts`, `desktop/tools.ts`

## Context

Jev's image input and its Box question are a preview at TypeSafe. Requests must send the `TypeSafe-Danger-Zone-Images: true` header and use the model `jev-preview`, and TypeSafe says they are not ready for production (Jev 1.14, October 2026). The agent browser and the desktop used them to find a target on a screenshot. A production path cannot depend on a preview that its maker has not released.

Two decision APIs now serve production traffic with images:

- OpenAI's Decisions API (`POST /v1/decisions`, model `gpt-6-luna`) answers predicate, choice (2 to 255 choices) and score, up to 400 questions per request, over text, JSON and images (`detail` low, high, auto or original).
- Gemini's Decisions API (`gemini-decision-1`) answers noul, choice (2 to 255 options) and score, up to 1,000 questions per request over a 262,144-token input, with text, images, audio, video and PDF. It takes an image `resolution` from low to ultra_high and answers in about 150 to 250 ms end to end.

Neither API has a box. A box has to come from the model's own description, so a target on an image has to be found in another way.

Browser Use's Jev Ultrafast experiment showed the other lever. Per step, one request picks an operation and, speculatively, the element for each operation over a numbered table of the page's elements. The large model leaves the per-click loop. Their Google Flights search finished in 7.1 s.

## Decision

1. **Only release features in Jev's path.** Jev answers text questions only. Images, the Box question and the `TypeSafe-Danger-Zone-Images` header go. `JEV_VISION_MODEL` is removed. A judgment over an image goes only to the installation's decision model (ADR 0195) when that model is on and its recorded capabilities include images. Otherwise the judgment fails and its caller does without it, as for any judge that is off. The `box` question leaves the judge and the decision providers. Whether a plan may look at images is `DecisionModel.seesImages()`.

2. **A target is found without a box.** `locateOnImage` (`packages/engine/src/screen/targets.ts`) asks choice and yes/no questions only.
   - With an annotated screenshot, one choice picks among the marks' numbers and lands on that element's ref.
   - Without marks, it splits the region into a 3×3 grid of overlapping cells, cut for real (`screen/crop.ts`, a small PNG decoder: Bun's image API crops nothing) and never drawn smaller than the screen shows them. Each cell is asked in its own request, all at once, whether it holds the control's center; the surest cell goes on, two neighbors about as sure go on together, anything else is unsure. It repeats on a close-up of that region until it is small enough to click its center, after at most 4 rounds.
   - Whether the target is there and whether acting can't be undone are asked once, on the whole screen, beside the first round. A target whose action can't be undone is never taken at a bare point, as before (ADR 0062).

   Measured with `eval:desktop:micro` against `gemini-decision-1` (one trial, the recorded scenes of ADR 0062):
   - Nine named cells in one request were told apart badly (0 of 6 targets without marks); one cell per request, well.
   - Pictures drawn smaller than the screen read worse: a 640×400 copy of the screen made the judge call visible folders absent.
   - Small targets 10/16 on the first pass (Jev's Box: 22/39), large targets 2/4 (Box: 15/15), absent targets 4/4, choice over the tree 14/14 (median 187 ms), checks on the image 6/7, and no click on a wrong spot: an unsure target goes back to the agent.
   - With marks a target takes about 0.8 s. Without them, 2–10 s (each round is nine requests at once), and a screen costs about 1,500 input tokens: an account's tokens a minute (50,000 on the measured one) bound how often it can run.

3. **A `goal` step.** `browser_do` and `desktop_do` take `{ do: "goal", goal, values?, steps? }` (`packages/engine/src/screen/goal.ts`). Each step is one judge request over the screen's element table. The answer holds:
   - the operation: click, type, select, scroll down, scroll up, wait, done or blocked;
   - speculatively, the target for each operation, among the elements that fit it;
   - which of the agent's `values` to type or select;
   - whether the goal is reached.

   The decision model answers it: any of the installation's models (OpenAI, Gemini, local, or Jev on text), falling back down the existing chain. Text typed comes only from `values` the agent wrote. No model writes text inside the loop.

   The loop stops on:
   - done, after the check;
   - blocked;
   - an unsure pick;
   - a target whose action can't be undone, which is handed back to the agent with what the loop would have done;
   - no change twice in a row;
   - a person taking the screen;
   - the step limit (default 12, at most 25);
   - a cancel.

   `open`, `back` and `type_secret` are not allowed inside a goal. Every action the loop takes is a step in the plan's report, like any other step.

## Consequences

- A server without a decision model that reads images finds targets from text only: refs, words, site memory, and the judge's choice over text. It loses the image path and keeps the rest.
- An agent reaches a short goal in one tool call instead of one model turn per action. The big model is called once to start the plan and when a step is unsure; the loop does not call it per click.
- The cost per step is one decision request. Its price is the decision model's price (ADR 0195 §7).
- Jev without images stays the text judge and the router. Its price and its role as the first step do not change.
- The loop never acts on what can't be undone. It hands that step back to the agent.
- Confidential threads (ADR 0190) get no judge, so no goal runs in them.
- Eval and the desktop smoke test of ADR 0062 cover the goal step before it is turned on for a desktop.
