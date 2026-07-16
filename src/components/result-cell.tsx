"use client";

import { useRef, useState, useTransition } from "react";
import { setResultCell } from "@/actions/results";

export function ResultCell({
  dateKey,
  lineId,
  itemId,
  orderLineId,
  field,
  value,
}: {
  dateKey: string;
  lineId: number;
  itemId: number;
  orderLineId: number | null;
  field: "qty" | "defectQty";
  value: number;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState(false);
  const lastSaved = useRef(value);

  const commit = (raw: string) => {
    const next = raw === "" ? 0 : Number(raw);
    if (!Number.isInteger(next) || next < 0) {
      setError(true);
      return;
    }
    if (next === lastSaved.current) return;
    startTransition(async () => {
      const res = await setResultCell({
        dateKey,
        lineId,
        itemId,
        orderLineId,
        field,
        value: next,
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
      defaultValue={value === 0 ? "" : value}
      disabled={pending}
      onBlur={(e) => commit(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
      }}
      className={`w-full min-w-14 text-right text-sm px-1 py-0.5 border rounded
        ${error ? "border-red-500" : field === "defectQty" ? "border-red-100 bg-red-50/40" : "border-green-100 bg-green-50/40"}
        ${pending ? "opacity-50" : ""}
        [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none`}
      title={field === "qty" ? "실적(양품)" : "불량"}
    />
  );
}
