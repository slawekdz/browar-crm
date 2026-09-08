import { NavLink, Outlet } from "react-router-dom";
import { useStore } from "@/store";

const links = [
  { to: "/", label: "Deale", icon: "▦" },
  { to: "/companies", label: "Firmy", icon: "▣" },
  { to: "/products", label: "Produkty", icon: "◫" },
  { to: "/contacts", label: "Kontakty", icon: "☺" },
  { to: "/settings", label: "Ustawienia", icon: "⚙" },
];

export default function Layout() {
  const { repo } = useStore();
  const cls = ({ isActive }: { isActive: boolean }) =>
    `flex flex-col sm:flex-row items-center gap-0.5 sm:gap-2 rounded-lg px-2 py-1.5 sm:px-3 sm:py-2 text-[11px] sm:text-sm ${isActive ? "text-amber sm:bg-panel-2" : "text-gray-300 hover:text-white"}`;
  return (
    <div className="flex h-full flex-col sm:flex-row">
      <aside className="hidden sm:flex w-52 shrink-0 flex-col border-r border-line bg-panel p-3 gap-1">
        <div className="px-3 py-2 mb-2">
          <div className="text-sm font-semibold">Browar Pogórza</div>
          <div className="text-xs text-muted">CRM {repo.mode === "local" ? "· tryb lokalny" : ""}</div>
        </div>
        {links.map((l) => (
          <NavLink key={l.to} to={l.to} end={l.to === "/"} className={cls}>
            <span aria-hidden>{l.icon}</span>
            {l.label}
          </NavLink>
        ))}
      </aside>
      <main className="flex-1 min-w-0 overflow-y-auto pb-16 sm:pb-0">
        <Outlet />
      </main>
      <nav className="sm:hidden fixed bottom-0 inset-x-0 z-40 flex justify-around border-t border-line bg-panel safe-bottom">
        {links.map((l) => (
          <NavLink key={l.to} to={l.to} end={l.to === "/"} className={cls}>
            <span aria-hidden className="text-base leading-none">{l.icon}</span>
            {l.label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
