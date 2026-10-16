"use client";
// Tautan masthead: huruf kapital bertrack, penanda halaman aktif lewat rule tebal
import Link from "next/link";
import { usePathname } from "next/navigation";

export default function TautanNav({ href, children }: { href: string; children: React.ReactNode }) {
  const path = usePathname();
  const aktif = href === "/" ? path === "/" : path.startsWith(href);
  return (
    <Link
      href={href}
      aria-current={aktif ? "page" : undefined}
      className="label whitespace-nowrap pb-1 transition-colors duration-150"
      style={{
        color: aktif ? "var(--color-ink)" : undefined,
        borderBottom: `2px solid ${aktif ? "var(--color-signal)" : "transparent"}`,
      }}
    >
      {children}
    </Link>
  );
}
