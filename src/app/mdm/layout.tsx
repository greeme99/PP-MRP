import Link from "next/link";

const MDM_NAV = [
  { href: "/mdm/items", label: "Item Master" },
  { href: "/mdm/vendors", label: "Vendor Master" },
  { href: "/mdm/customers", label: "Customer Master" },
  { href: "/mdm/sites", label: "Site Master" },
  { href: "/mdm/facilities", label: "Facility Master" },
  { href: "/mdm/lines", label: "Line Master" },
];

export default function MdmLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center gap-1 mb-4 border-b border-gray-200 flex-wrap">
        <span className="text-sm font-bold text-gray-700 mr-3 pb-2">
          기준정보(MDM)
        </span>
        {MDM_NAV.map((n) => (
          <Link
            key={n.href}
            href={n.href}
            className="px-3 pb-2 text-sm text-gray-600 hover:text-gray-900 border-b-2 border-transparent hover:border-slate-500"
          >
            {n.label}
          </Link>
        ))}
      </div>
      {children}
    </div>
  );
}
