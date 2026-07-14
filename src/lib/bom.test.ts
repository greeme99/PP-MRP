import { describe, expect, it } from "vitest";
import { hasCycle, wouldCreateCycle, type BomEdge } from "./bom";

const e = (p: number, c: number): BomEdge => ({
  parentItemId: p,
  childItemId: c,
});

describe("wouldCreateCycle", () => {
  it("자기 자신 참조는 순환", () => {
    expect(wouldCreateCycle([], 1, 1)).toBe(true);
  });
  it("빈 그래프에 새 간선은 순환 아님", () => {
    expect(wouldCreateCycle([], 1, 2)).toBe(false);
  });
  it("직접 역방향(1→2 존재, 2→1 추가)은 순환", () => {
    expect(wouldCreateCycle([e(1, 2)], 2, 1)).toBe(true);
  });
  it("간접 순환(1→2→3 존재, 3→1 추가)", () => {
    expect(wouldCreateCycle([e(1, 2), e(2, 3)], 3, 1)).toBe(true);
  });
  it("다이아몬드(1→2, 1→3, 2→4, 3→4)는 순환 아님", () => {
    const edges = [e(1, 2), e(1, 3), e(2, 4)];
    expect(wouldCreateCycle(edges, 3, 4)).toBe(false);
  });
  it("무관한 간선 추가는 순환 아님", () => {
    expect(wouldCreateCycle([e(1, 2), e(2, 3)], 4, 5)).toBe(false);
  });
});

describe("hasCycle", () => {
  it("빈 그래프", () => {
    expect(hasCycle([])).toBe(false);
  });
  it("트리는 순환 없음", () => {
    expect(hasCycle([e(1, 2), e(1, 3), e(2, 4)])).toBe(false);
  });
  it("다이아몬드는 순환 없음", () => {
    expect(hasCycle([e(1, 2), e(1, 3), e(2, 4), e(3, 4)])).toBe(false);
  });
  it("자기 참조", () => {
    expect(hasCycle([e(1, 1)])).toBe(true);
  });
  it("2-노드 순환", () => {
    expect(hasCycle([e(1, 2), e(2, 1)])).toBe(true);
  });
  it("긴 순환(1→2→3→4→1)", () => {
    expect(hasCycle([e(1, 2), e(2, 3), e(3, 4), e(4, 1)])).toBe(true);
  });
  it("분리된 컴포넌트 중 하나만 순환", () => {
    expect(hasCycle([e(1, 2), e(10, 11), e(11, 10)])).toBe(true);
  });
});
