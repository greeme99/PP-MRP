"use client";

import { useRef, useState, useTransition } from "react";
import { setPlanCell } from "@/actions/plan";

export function PlanCell({
  orderLineId,
  lineId,
  weekStartKey,
  qty,
  isDueWeek,
}: {
  orderLineId: number;
  lineId: number;
  weekStartKey: string;
  qty: number;
  isDueWeek: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState(false);
  const lastSaved = useRef(qty);

  const commit = (raw: string) => {
    const next = raw === "" ? 0 : Number(raw);
    if (!Number.isInteger(next) || next < 0) {
      setError(true);
      return;
    }
    if (next === lastSaved.current) return;
    startTransition(async () => {
      const res = await setPlanCell({
        orderLineId,
        lineId,
        weekStartKey,
        qty: next,
      });
      if (res.ok) {
        lastSaved.current = next;
        setError(false);
      } else {
        setError(true);
      }
    });
  };

  return (
    <input
      type="number"
      min={0}
      defaultValue={qty === 0 ? "" : qty}
      disabled={pending}
      onBlur={(e) => commit(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
      }}
      className={`w-full min-w-14 text-right text-sm px-1 py-0.5 border rounded bg-white
        ${error ? "border-red-500" : isDueWeek ? "border-blue-400 border-2" : "border-gray-200"}
        ${pending ? "opacity-50" : ""}
        [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none`}
      title={isDueWeek ? "납기 주" : undefined}
    />
  );
}
