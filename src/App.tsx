import { Navigate, Route, Routes } from "react-router-dom";
import { StoreProvider, useStore } from "@/store";
import Layout from "@/components/Layout";
import Login from "@/pages/Login";
import Board from "@/pages/Board";
import Companies from "@/pages/Companies";
import Products from "@/pages/Products";
import Contacts from "@/pages/Contacts";
import Settings from "@/pages/Settings";

function Shell() {
  const { auth, data, loading, error, reload } = useStore();
  if (loading) return <div className="flex h-full items-center justify-center text-muted">Ładowanie…</div>;
  if (!auth?.email) return <Login />;
  if (error || !data)
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
        <div className="text-danger text-sm">{error ?? "Brak danych"}</div>
        <button type="button" className="btn-primary" onClick={reload}>
          Spróbuj ponownie
        </button>
      </div>
    );
  // Record routes (/deals/:id, /companies/:id) are handled inside Layout as sliders over the list page.
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Board />} />
        <Route path="deals/:id" element={null} />
        <Route path="companies" element={<Companies />} />
        <Route path="companies/:id" element={null} />
        <Route path="products" element={<Products />} />
        <Route path="products/:id" element={null} />
        <Route path="contacts" element={<Contacts />} />
        <Route path="settings" element={<Settings />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}

export default function App() {
  return (
    <StoreProvider>
      <Shell />
    </StoreProvider>
  );
}
