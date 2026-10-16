import SesiAdmin from "@/components/SesiAdmin";
import TautanTab from "@/components/TautanTab";

export default function LayoutAdmin({ children }: LayoutProps<"/admin">) {
  return (
    <div className="shell pb-20 pt-10">
      <nav aria-label="Panel admin" className="flex flex-wrap items-center gap-x-8 border-b-2 border-[var(--color-ink)]">
        <TautanTab href="/admin">Dasbor</TautanTab>
        <TautanTab href="/admin/issue">Terbitkan</TautanTab>
        <TautanTab href="/admin/certificates">Register</TautanTab>
      </nav>
      <div className="pt-10">
        <SesiAdmin>{children}</SesiAdmin>
      </div>
    </div>
  );
}
