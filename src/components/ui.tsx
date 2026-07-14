export const inputCls =
  "border border-gray-300 rounded px-2 py-1 text-sm bg-white";
export const btnCls =
  "bg-slate-700 text-white rounded px-3 py-1 text-sm hover:bg-slate-600 disabled:opacity-50";
export const btnGhostCls =
  "border border-gray-300 rounded px-2 py-0.5 text-xs text-gray-600 hover:bg-gray-100";
export const thCls =
  "text-left text-xs font-semibold text-gray-500 uppercase px-3 py-2 border-b";
export const tdCls = "px-3 py-2 border-b text-sm";

export function PageTitle({ children }: { children: React.ReactNode }) {
  return <h1 className="text-xl font-bold mb-4">{children}</h1>;
}

export function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-4 mb-4">
      {children}
    </div>
  );
}

export function Badge({
  color,
  children,
}: {
  color: "green" | "gray" | "blue" | "amber" | "red";
  children: React.ReactNode;
}) {
  const colors = {
    green: "bg-green-100 text-green-800",
    gray: "bg-gray-100 text-gray-600",
    blue: "bg-blue-100 text-blue-800",
    amber: "bg-amber-100 text-amber-800",
    red: "bg-red-100 text-red-800",
  };
  return (
    <span
      className={`inline-block rounded px-1.5 py-0.5 text-xs font-medium ${colors[color]}`}
    >
      {children}
    </span>
  );
}

export const ITEM_TYPE_LABEL: Record<string, string> = {
  FG: "완제품",
  SF: "반제품",
  RM: "원자재",
};

export const PARTNER_TYPE_LABEL: Record<string, string> = {
  CUSTOMER: "고객사",
  VENDOR: "공급사",
  BOTH: "고객+공급",
};
