import { describe, expect, it } from "vitest";
import { achievementRate, computeCarryover } from "./results";

describe("computeCarryover", () => {
  it("실적 미달이면 잔량 이월", () => {
    expect(computeCarryover(100, 60)).toEqual({ newQty: 60, carryQty: 40 });
  });
  it("실적 0이면 전량 이월", () => {
    expect(computeCarryover(100, 0)).toEqual({ newQty: 0, carryQty: 100 });
  });
  it("실적이 계획 이상이면 이월 없음", () => {
    expect(computeCarryover(100, 100)).toBeNull();
    expect(computeCarryover(100, 120)).toBeNull();
  });
});

describe("achievementRate", () => {
  it("달성률 반올림", () => {
    expect(achievementRate(100, 60)).toBe(60);
    expect(achievementRate(3, 2)).toBe(67);
    expect(achievementRate(100, 120)).toBe(120);
  });
  it("계획 0이면 null", () => {
    expect(achievementRate(0, 50)).toBeNull();
  });
});
