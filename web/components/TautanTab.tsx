"use client";
// Tab panel admin: rule tebal menandai halaman aktif
import Link from "next/link";
import { usePathname } from "next/navigation";

export default function TautanTab({ href, children }: { href: string; children: React.ReactNode }) {
  const path = usePathname();
  const aktif = href === "/admin" ? path === "/admin" : path.startsWith(href);
  return (
    <Link
      href={href}
      aria-current={aktif ? "page" : undefined}
      className="label whitespace-nowrap py-3 transition-colors duration-150"
      style={{
        color: aktif ? "var(--color-ink)" : undefined,
        borderBottom: `2px solid ${aktif ? "var(--color-signal)" : "transparent"}`,
      }}
    >
      {children}
    </Link>
  );
}
