import { describe, expect, test } from "bun:test";
import { cropImage, decodePng, openImage, pngOf } from "../src/screen/crop";

/** A 60x40 PNG, white with a red 10x10 square at (30, 20) and a blue pixel at (0, 0). */
function scene(): string {
  const [width, height] = [60, 40];
  const rgb = new Uint8Array(width * height * 3).fill(255);
  const paint = (x: number, y: number, c: number[]) => rgb.set(c, (y * width + x) * 3);
  for (let y = 20; y < 30; y++) for (let x = 30; x < 40; x++) paint(x, y, [255, 0, 0]);
  paint(0, 0, [0, 0, 255]);
  return Buffer.from(pngOf({ width, height, rgb }, 0, 0, width, height)).toString("base64");
}

const SIZE = { width: 4, height: 4 };
/** The middle pixel color of a crop, read back as a PNG. */
async function middle(base64: string): Promise<number[]> {
  const png = await new Bun.Image(Buffer.from(base64, "base64")).png().bytes();
  const p = decodePng(png);
  const at = (Math.floor(p.height / 2) * p.width + Math.floor(p.width / 2)) * 3;
  return [...p.rgb.subarray(at, at + 3)];
}

describe("cropImage", () => {
  test("cuts a region out and draws it at the size asked", async () => {
    const out = await cropImage(scene(), { x: 30, y: 20, width: 10, height: 10 }, { width: 80, height: 50 });
    const meta = await new Bun.Image(Buffer.from(out, "base64")).metadata();
    expect([meta.width, meta.height, meta.format]).toEqual([80, 50, "jpeg"]);
  });

  test("the pixels are the ones at the region: on the square it is red, off it white, the corner blue", async () => {
    const near = (c: number[], want: number[]) => {
      for (const [i, v] of c.entries()) expect(Math.abs(v - (want[i] as number))).toBeLessThan(40);
    };
    near(await middle(await cropImage(scene(), { x: 32, y: 22, width: 4, height: 4 }, SIZE)), [255, 0, 0]);
    near(await middle(await cropImage(scene(), { x: 5, y: 5, width: 4, height: 4 }, SIZE)), [255, 255, 255]);
    near(await middle(await cropImage(scene(), { x: 0, y: 0, width: 1, height: 1 }, SIZE)), [0, 0, 255]);
  });

  test("a region past the edge is clamped inside the image", async () => {
    const out = await cropImage(scene(), { x: 50, y: 30, width: 500, height: 500 }, SIZE);
    expect((await new Bun.Image(Buffer.from(out, "base64")).metadata()).width).toBe(4);
    const off = await cropImage(scene(), { x: -9, y: -9, width: 3, height: 3 }, SIZE);
    expect(off.length).toBeGreaterThan(0);
  });

  test("a cross drawn on a point: red at its center, the picture left as it was away from it", async () => {
    const picture = await openImage(scene());
    const crossed = await picture.crop(
      { x: 0, y: 0, width: 20, height: 20 },
      { width: 20, height: 20 },
      { cross: { x: 10, y: 10 } },
    );
    const [r, g, b] = await middle(crossed);
    expect(r).toBeGreaterThan(180);
    expect(Math.max(g as number, b as number)).toBeLessThan(90);
    const plain = await picture.crop({ x: 0, y: 0, width: 20, height: 20 }, { width: 20, height: 20 });
    expect(Math.min(...(await middle(plain)))).toBeGreaterThan(200);
  });

  test("an image that is not a readable PNG throws", () => {
    expect(() => decodePng(new Uint8Array(40))).toThrow("not a PNG");
  });
});
