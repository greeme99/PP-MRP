// BOM 그래프 순수 로직 (DB 비의존)

export type BomEdge = { parentItemId: number; childItemId: number };

/**
 * parentId → childId 간선을 추가하면 순환이 생기는지 검사한다.
 * childId에서 기존 간선을 따라 내려가 parentId에 도달하면 순환이다.
 * 자기 자신 참조(parentId === childId)도 순환으로 본다.
 */
export function wouldCreateCycle(
  edges: BomEdge[],
  parentId: number,
  childId: number
): boolean {
  if (parentId === childId) return true;

  const childrenOf = new Map<number, number[]>();
  for (const e of edges) {
    const list = childrenOf.get(e.parentItemId) ?? [];
    list.push(e.childItemId);
    childrenOf.set(e.parentItemId, list);
  }

  const visited = new Set<number>();
  const stack = [childId];
  while (stack.length > 0) {
    const cur = stack.pop()!;
    if (cur === parentId) return true;
    if (visited.has(cur)) continue;
    visited.add(cur);
    for (const next of childrenOf.get(cur) ?? []) {
      stack.push(next);
    }
  }
  return false;
}

/** 간선 집합 전체에 순환이 존재하는지 검사한다 (Excel import 검증용). */
export function hasCycle(edges: BomEdge[]): boolean {
  const childrenOf = new Map<number, number[]>();
  const nodes = new Set<number>();
  for (const e of edges) {
    const list = childrenOf.get(e.parentItemId) ?? [];
    list.push(e.childItemId);
    childrenOf.set(e.parentItemId, list);
    nodes.add(e.parentItemId);
    nodes.add(e.childItemId);
  }

  const WHITE = 0, GRAY = 1, BLACK = 2;
  const color = new Map<number, number>();

  const dfs = (start: number): boolean => {
    // 재귀 대신 명시적 스택 (깊은 BOM에서도 안전)
    const stack: Array<{ node: number; childIdx: number }> = [
      { node: start, childIdx: 0 },
    ];
    color.set(start, GRAY);
    while (stack.length > 0) {
      const frame = stack[stack.length - 1];
      const children = childrenOf.get(frame.node) ?? [];
      if (frame.childIdx < children.length) {
        const next = children[frame.childIdx++];
        const c = color.get(next) ?? WHITE;
        if (c === GRAY) return true;
        if (c === WHITE) {
          color.set(next, GRAY);
          stack.push({ node: next, childIdx: 0 });
        }
      } else {
        color.set(frame.node, BLACK);
        stack.pop();
      }
    }
    return false;
  };

  for (const n of nodes) {
    if ((color.get(n) ?? WHITE) === WHITE && dfs(n)) return true;
  }
  return false;
}
