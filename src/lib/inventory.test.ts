import { describe, expect, it } from "vitest";
import { netRequirements, onHandByItem } from "./inventory";
import type { Requirements } from "./mrp";

const gross = (data: Record<number, Record<string, number>>): Requirements =>
  new Map(
    Object.entries(data).map(([itemId, weeks]) => [
      Number(itemId),
      new Map(Object.entries(weeks)),
    ])
  );

const W1 = "2026-07-13";
const W2 = "2026-07-20";
const W3 = "2026-07-27";

describe("onHandByItem", () => {
  it("부호 있는 증감량 합산", () => {
    const onHand = onHandByItem([
      { itemId: 1, qty: 100 },
      { itemId: 1, qty: -30 },
      { itemId: 2, qty: 50 },
    ]);
    expect(onHand.get(1)).toBe(70);
    expect(onHand.get(2)).toBe(50);
  });
});

describe("netRequirements", () => {
  it("재고가 첫 주부터 순차 소진되고 잔여는 이월", () => {
    const { net, remainingByItem } = netRequirements(
      gross({ 1: { [W1]: 100, [W2]: 100, [W3]: 100 } }),
      new Map([[1, 150]])
    );
    // W1: 100 전량 재고 충당, W2: 50 충당 → 순소요 50, W3: 100
    expect(net.get(1)?.get(W1)).toBeUndefined();
    expect(net.get(1)?.get(W2)).toBe(50);
    expect(net.get(1)?.get(W3)).toBe(100);
    expect(remainingByItem.get(1)).toBe(0);
  });

  it("재고가 충분하면 순소요 없음 + 잔여재고 반환", () => {
    const { net, remainingByItem } = netRequirements(
      gross({ 1: { [W1]: 100 } }),
      new Map([[1, 300]])
    );
    expect(net.has(1)).toBe(false);
    expect(remainingByItem.get(1)).toBe(200);
  });

  it("재고가 없으면 순소요 = 총소요", () => {
    const { net } = netRequirements(gross({ 1: { [W1]: 100 } }), new Map());
    expect(net.get(1)?.get(W1)).toBe(100);
  });

  it("음수 재고(과출고)는 0으로 간주", () => {
    const { net } = netRequirements(
      gross({ 1: { [W1]: 100 } }),
      new Map([[1, -50]])
    );
    expect(net.get(1)?.get(W1)).toBe(100);
  });

  it("주차 키 순서가 뒤섞여 있어도 시간순으로 소진", () => {
    const weeks = new Map([
      [W3, 100],
      [W1, 100],
      [W2, 100],
    ]);
    const { net } = netRequirements(
      new Map([[1, weeks]]),
      new Map([[1, 100]])
    );
    expect(net.get(1)?.get(W1)).toBeUndefined(); // 첫 주가 먼저 충당
    expect(net.get(1)?.get(W2)).toBe(100);
    expect(net.get(1)?.get(W3)).toBe(100);
  });

  it("품목별로 독립 계산", () => {
    const { net } = netRequirements(
      gross({ 1: { [W1]: 100 }, 2: { [W1]: 100 } }),
      new Map([[1, 999]])
    );
    expect(net.has(1)).toBe(false);
    expect(net.get(2)?.get(W1)).toBe(100);
  });

  it("소수 소요량 netting", () => {
    const { net } = netRequirements(
      gross({ 1: { [W1]: 10.5, [W2]: 10.5 } }),
      new Map([[1, 10.5]])
    );
    expect(net.get(1)?.get(W1)).toBeUndefined();
    expect(net.get(1)?.get(W2)).toBe(10.5);
  });
});
