"use client";

import { useState, useTransition } from "react";
import type { ActionResult } from "@/actions/items";

export function ActionForm({
  action,
  children,
  className,
}: {
  action: (formData: FormData) => Promise<ActionResult>;
  children: React.ReactNode;
  className?: string;
}) {
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  return (
    <form
      className={className}
      action={(fd) =>
        startTransition(async () => {
          const res = await action(fd);
          setError(res.ok ? null : (res.message ?? "저장에 실패했습니다"));
        })
      }
    >
      {children}
      {error && <p className="text-red-600 text-sm mt-1 w-full">{error}</p>}
    </form>
  );
}

export function ActionButton({
  action,
  children,
  className,
  confirmMessage,
}: {
  action: () => Promise<ActionResult>;
  children: React.ReactNode;
  className?: string;
  confirmMessage?: string;
}) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<ActionResult | null>(null);
  return (
    <>
      <button
        type="button"
        disabled={pending}
        className={className}
        onClick={() => {
          if (confirmMessage && !window.confirm(confirmMessage)) return;
          setResult(null);
          startTransition(async () => {
            setResult(await action());
          });
        }}
      >
        {children}
      </button>
      {result && (!result.ok || result.message) && (
        <span
          className={`text-xs ml-2 ${result.ok ? "text-green-700" : "text-red-600"}`}
        >
          {result.message ?? "처리에 실패했습니다"}
        </span>
      )}
    </>
  );
}
