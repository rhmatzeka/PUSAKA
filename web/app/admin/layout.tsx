import Link from "next/link";
import SesiAdmin from "@/components/SesiAdmin";

export default function LayoutAdmin({ children }: LayoutProps<"/admin">) {
  return (
    <div>
      <div className="mb-4 flex gap-5 text-sm font-medium">
        <Link href="/admin" className="hover:underline">Dasbor</Link>
        <Link href="/admin/issue" className="hover:underline">Terbitkan</Link>
        <Link href="/admin/certificates" className="hover:underline">Daftar ijazah</Link>
      </div>
      <SesiAdmin>{children}</SesiAdmin>
    </div>
  );
}
