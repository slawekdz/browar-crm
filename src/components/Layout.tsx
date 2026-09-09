import { useEffect, useRef, type ReactNode } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { useStore } from "@/store";
import { isRecordPath, useSliderStack, useCloseSlider, RECORD_RE } from "@/lib/nav";
import Board from "@/pages/Board";
import Companies from "@/pages/Companies";
import Products from "@/pages/Products";
import Contacts from "@/pages/Contacts";
import Settings from "@/pages/Settings";
import DealPage from "@/pages/DealPage";
import CompanyPage from "@/pages/CompanyPage";
import ProductPage from "@/pages/ProductPage";
import MobileShell from "@/mobile/MobileShell";
import { useIsMobile } from "@/lib/useMedia";

/*
 * Bitrix chrome: indigo sidebar (modules) + indigo top bar (CRM sections) + wallpaper canvas.
 * Records (/deals/:id, /companies/:id) render as sliders over the list page they were opened from.
 */

const NAV = [
  { to: "/", label: "Deale", icon: "M4 5h4v14H4zM10 5h4v10h-4zM16 5h4v7h-4z" },
  { to: "/companies", label: "Firmy", icon: "M4 20V6l8-3 8 3v14M9 20v-5h6v5M8 9h2M14 9h2M8 12h2M14 12h2" },
  { to: "/contacts", label: "Kontakty", icon: "M12 12a4 4 0 100-8 4 4 0 000 8zM4 20a8 8 0 0116 0" },
  { to: "/products", label: "Produkty", icon: "M9 3h6l1 4H8zM7 7h10l1 12a2 2 0 01-2 2H8a2 2 0 01-2-2z" },
  { to: "/settings", label: "Ustawienia", icon: "M12 15a3 3 0 100-6 3 3 0 000 6zM19 12l2-1-1-3-2 .5-1.5-1.5.5-2-3-1-1 2h-2l-1-2-3 1 .5 2L6 8.5 4 8l-1 3 2 1v2l-2 1 1 3 2-.5 1.5 1.5-.5 2 3 1 1-2h2l1 2 3-1-.5-2 1.5-1.5 2 .5 1-3-2-1z" },
];

function Icon({ d, className = "h-[18px] w-[18px]" }: { d: string; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={d} />
    </svg>
  );
}

const LIST_PAGES: Record<string, () => ReactNode> = {
  "/": () => <Board />,
  "/companies": () => <Companies />,
  "/contacts": () => <Contacts />,
  "/products": () => <Products />,
  "/settings": () => <Settings />,
};

function RecordView({ path }: { path: string }) {
  const m = RECORD_RE.exec(path);
  if (!m) return null;
  const id = Number(m[2]);
  if (m[1] === "deals") return <DealPage id={id} />;
  if (m[1] === "products") return <ProductPage id={id} />;
  return <CompanyPage id={id} />;
}

function Slider({ path, top, onClose }: { path: string; top: boolean; onClose: () => void }) {
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!top) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [top, onClose]);
  return (
    <div className={`fixed inset-0 z-50 ${top ? "" : "pointer-events-none"}`} aria-hidden={!top}>
      {top && <div className="absolute inset-0 bg-black/35 fade-in" onClick={onClose} />}
      <div className="absolute inset-y-0 left-0 sm:left-14 right-0 sm:right-10 flex">
        <div className="hidden sm:flex w-12 shrink-0 flex-col items-center gap-2 pt-3">
          {top && (
            <>
              <button type="button" className="flex h-9 w-9 items-center justify-center rounded-full bg-brand text-white shadow hover:bg-brand-dark" onClick={onClose} aria-label="Zamknij" title="Zamknij (Esc)">
                ✕
              </button>
              <button
                type="button"
                className="flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-gray-600 shadow hover:text-gray-900"
                onClick={() => navigator.clipboard?.writeText(`${window.location.origin}${window.location.pathname}#${path}`)}
                aria-label="Kopiuj link"
                title="Kopiuj link"
              >
                <Icon d="M10 14a4 4 0 005.7 0l3-3a4 4 0 00-5.7-5.7l-1 1M14 10a4 4 0 00-5.7 0l-3 3a4 4 0 005.7 5.7l1-1" />
              </button>
            </>
          )}
        </div>
        <div ref={panel} className={`relative flex-1 min-w-0 overflow-y-auto bg-canvas sm:rounded-l-2xl shadow-2xl slider-in ${top ? "" : "opacity-60"}`} role="dialog" aria-modal={top}>
          <button type="button" className="sm:hidden sticky top-0 z-30 w-full bg-indigo px-4 py-2 text-left text-sm text-white" onClick={onClose}>
            ← Zamknij
          </button>
          <RecordView path={path} />
        </div>
      </div>
    </div>
  );
}

export default function Layout() {
  const isMobile = useIsMobile();
  if (isMobile) return <MobileShell />;
  return <DesktopLayout />;
}

function DesktopLayout() {
  const { repo, auth } = useStore();
  const location = useLocation();
  const stack = useSliderStack();
  const close = useCloseSlider();
  const lastList = useRef("/");
  const isRecord = isRecordPath(location.pathname);
  if (!isRecord && LIST_PAGES[location.pathname]) lastList.current = location.pathname;
  const background = isRecord ? ((location.state as { background?: string } | null)?.background?.split("?")[0] ?? lastList.current) : location.pathname;
  const activeNav = NAV.find((n) => n.to === background) ?? NAV[0];
  const portalName = "Browar Pogórza";

  useEffect(() => {
    if (!isRecord) document.title = `${activeNav.label} · Browar Pogórza CRM`;
  }, [isRecord, activeNav.label]);

  return (
    <div className="flex h-full flex-col sm:flex-row wallpaper">
      <aside className="hidden sm:flex w-52 shrink-0 flex-col bg-indigo/85 backdrop-blur text-white p-3 gap-0.5">
        <div className="px-3 py-2 mb-2 flex items-center gap-2">
          <Icon d="M4 5h4v14H4zM10 5h4v10h-4zM16 5h4v7h-4z" className="h-5 w-5 text-brand" />
          <div>
            <div className="text-sm font-semibold leading-tight">Browar Pogórza</div>
            <div className="text-[11px] text-white/60">CRM{repo.mode === "local" ? " · tryb lokalny" : ""}</div>
          </div>
        </div>
        {NAV.map((l) => (
          <NavLink key={l.to} to={l.to} end className={({ isActive }) => `flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition ${isActive || (isRecord && l.to === background) ? "bg-white/15 text-white" : "text-white/80 hover:bg-white/10 hover:text-white"}`}>
            <Icon d={l.icon} />
            {l.label}
            {l.to === "/" && <span className="ml-auto rounded-full bg-danger px-1.5 text-[10px] font-semibold">1</span>}
          </NavLink>
        ))}
      </aside>
      <div className="flex-1 min-w-0 flex flex-col">
        <header className="hidden sm:flex h-12 shrink-0 items-center gap-1 bg-indigo/85 backdrop-blur px-3 text-white">
          {NAV.slice(0, 4).map((l) => (
            <NavLink key={l.to} to={l.to} end className={({ isActive }) => `chrome-pill ${isActive || (isRecord && l.to === background) ? "chrome-pill-active" : ""}`}>
              {l.label}
            </NavLink>
          ))}
          <div className="ml-auto flex items-center gap-3 text-sm">
            <span className="flex items-center gap-2 text-white/90">
              <Icon d="M11 4a7 7 0 105.3 11.6L21 20" className="h-4 w-4" />
              {portalName} <span className="text-brand font-semibold">24</span>
            </span>
            <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs tabular-nums">{new Date().toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" })}</span>
            <NavLink to="/settings" className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20 text-xs font-semibold" title={auth?.email ?? ""}>
              SD
            </NavLink>
          </div>
        </header>
        <main className="flex-1 min-w-0 overflow-y-auto pb-16 sm:pb-0">
          {isRecord ? LIST_PAGES[background]?.() ?? <Board />
            : <Outlet />}
        </main>
      </div>
      {isRecord && (
        <>
          {stack.map((p) => (
            <Slider key={p} path={p} top={false} onClose={close} />
          ))}
          <Slider key={location.pathname} path={location.pathname} top onClose={close} />
        </>
      )}
      <nav className="sm:hidden fixed bottom-0 inset-x-0 z-40 flex justify-around border-t border-white/10 bg-indigo text-white safe-bottom">
        {NAV.map((l) => (
          <NavLink key={l.to} to={l.to} end className={({ isActive }) => `flex flex-col items-center gap-0.5 px-2 py-1.5 text-[11px] ${isActive || (isRecord && l.to === background) ? "text-brand" : "text-white/75"}`}>
            <Icon d={l.icon} className="h-5 w-5" />
            {l.label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
