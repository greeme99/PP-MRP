"use client";

import { useRef, useState, useTransition } from "react";
import { setDailyCell } from "@/actions/daily";

export function DailyCell({
  planEntryId,
  dateKey,
  qty,
  isWeekend,
}: {
  planEntryId: number;
  dateKey: string;
  qty: number;
  isWeekend: boolean;
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
      const res = await setDailyCell({ planEntryId, dateKey, qty: next });
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
      className={`w-full min-w-14 text-right text-sm px-1 py-0.5 border rounded
        ${error ? "border-red-500" : "border-gray-200"}
        ${isWeekend ? "bg-gray-50" : "bg-white"}
        ${pending ? "opacity-50" : ""}
        [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none`}
      title={isWeekend ? "주말 (초안 분할 제외, 특근 시 수동 입력)" : undefined}
    />
  );
}
