import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { Repo, AuthState } from "@/lib/db";
import { createRepo } from "@/lib/repo";
import type {
  Comment,
  CommentEntity,
  Company,
  Contact,
  Deal,
  DealLine,
  NewCompany,
  NewContact,
  NewDeal,
  NewLine,
  NewProduct,
  Product,
  Snapshot,
} from "@/types";

interface Store {
  repo: Repo;
  auth: AuthState | null;
  data: Snapshot | null;
  error: string | null;
  loading: boolean;
  signIn(email: string, password: string): Promise<void>;
  signOut(): Promise<void>;
  reload(): Promise<void>;

  companyById: Map<number, Company>;
  contactById: Map<number, Contact>;
  productById: Map<number, Product>;
  personName(id: number | null): string;
  linesOf(dealId: number): DealLine[];
  commentsOf(entity: CommentEntity, id: number): Comment[];

  createDeal(deal: NewDeal, lines: NewLine[]): Promise<Deal>;
  updateDeal(id: number, patch: Partial<Omit<Deal, "id">>): Promise<void>;
  moveDeal(id: number, stageCode: string): Promise<void>;
  setLines(dealId: number, lines: NewLine[]): Promise<void>;
  deleteDeal(id: number): Promise<void>;
  createCompany(company: NewCompany): Promise<Company>;
  updateCompany(id: number, patch: Partial<Omit<Company, "id">>): Promise<void>;
  deleteCompany(id: number): Promise<void>;
  createContact(contact: NewContact): Promise<Contact>;
  updateContact(id: number, patch: Partial<Omit<Contact, "id">>): Promise<void>;
  deleteContact(id: number): Promise<void>;
  createProduct(product: NewProduct): Promise<Product>;
  updateProduct(id: number, patch: Partial<Omit<Product, "id">>): Promise<void>;
  deleteProduct(id: number): Promise<void>;
  uploadProductImage(id: number, file: File): Promise<void>;
  addComment(entity: CommentEntity, id: number, body: string): Promise<void>;
  deleteComment(id: number): Promise<void>;
}

const StoreContext = createContext<Store | null>(null);

const replaceIn = <T extends { id: number }>(rows: T[], row: T): T[] => rows.map((r) => (r.id === row.id ? row : r));

export function StoreProvider({ children }: { children: ReactNode }) {
  const repo = useRef<Repo>(createRepo()).current;
  const [auth, setAuth] = useState<AuthState | null>(null);
  const [data, setData] = useState<Snapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await repo.load());
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [repo]);

  useEffect(() => {
    repo.auth().then(async (state) => {
      setAuth(state);
      if (state.email) await reload();
      else setLoading(false);
    });
  }, [repo, reload]);

  const signIn = useCallback(
    async (email: string, password: string) => {
      setAuth(await repo.signIn(email, password));
      await reload();
    },
    [repo, reload],
  );

  const signOut = useCallback(async () => {
    await repo.signOut();
    setAuth({ email: null });
    setData(null);
  }, [repo]);

  const patch = (fn: (d: Snapshot) => Snapshot) => setData((d) => (d ? fn(d) : d));

  const store = useMemo<Store | null>(() => {
    const d = data;
    const companyById = new Map((d?.companies ?? []).map((c) => [c.id, c]));
    const contactById = new Map((d?.contacts ?? []).map((c) => [c.id, c]));
    const productById = new Map((d?.products ?? []).map((p) => [p.id, p]));
    const personById = new Map((d?.people ?? []).map((p) => [p.id, p.name]));
    return {
      repo,
      auth,
      data,
      error,
      loading,
      signIn,
      signOut,
      reload,
      companyById,
      contactById,
      productById,
      personName: (id) => (id === null ? "" : (personById.get(id) ?? `Użytkownik ${id}`)),
      linesOf: (dealId) => (d?.deal_lines ?? []).filter((l) => l.deal_id === dealId).sort((a, b) => a.sort - b.sort),
      commentsOf: (entity, id) => (d?.comments ?? []).filter((c) => c.entity_type === entity && c.entity_id === id),

      async createDeal(deal, lines) {
        const result = await repo.createDeal(deal, lines);
        patch((s) => ({ ...s, deals: [...s.deals, result.deal], deal_lines: [...s.deal_lines, ...result.lines], stage_history: [...s.stage_history, result.history] }));
        return result.deal;
      },
      async updateDeal(id, p) {
        const row = await repo.updateDeal(id, p);
        patch((s) => ({ ...s, deals: replaceIn(s.deals, row) }));
      },
      async moveDeal(id, stageCode) {
        const result = await repo.moveDeal(id, stageCode);
        patch((s) => ({ ...s, deals: replaceIn(s.deals, result.deal), stage_history: [...s.stage_history, result.history] }));
      },
      async setLines(dealId, lines) {
        const result = await repo.setLines(dealId, lines);
        patch((s) => ({ ...s, deals: replaceIn(s.deals, result.deal), deal_lines: [...s.deal_lines.filter((l) => l.deal_id !== dealId), ...result.lines] }));
      },
      async deleteDeal(id) {
        await repo.deleteDeal(id);
        patch((s) => ({
          ...s,
          deals: s.deals.filter((x) => x.id !== id),
          deal_lines: s.deal_lines.filter((l) => l.deal_id !== id),
          stage_history: s.stage_history.filter((h) => h.deal_id !== id),
          comments: s.comments.filter((c) => !(c.entity_type === "deal" && c.entity_id === id)),
        }));
      },
      async createCompany(company) {
        const row = await repo.createCompany(company);
        patch((s) => ({ ...s, companies: [...s.companies, row] }));
        return row;
      },
      async updateCompany(id, p) {
        const row = await repo.updateCompany(id, p);
        patch((s) => ({ ...s, companies: replaceIn(s.companies, row) }));
      },
      async deleteCompany(id) {
        await repo.deleteCompany(id);
        patch((s) => ({ ...s, companies: s.companies.filter((c) => c.id !== id), contacts: s.contacts.map((c) => (c.company_id === id ? { ...c, company_id: null } : c)) }));
      },
      async createContact(contact) {
        const row = await repo.createContact(contact);
        patch((s) => ({ ...s, contacts: [...s.contacts, row] }));
        return row;
      },
      async updateContact(id, p) {
        const row = await repo.updateContact(id, p);
        patch((s) => ({ ...s, contacts: replaceIn(s.contacts, row) }));
      },
      async deleteContact(id) {
        await repo.deleteContact(id);
        patch((s) => ({ ...s, contacts: s.contacts.filter((c) => c.id !== id), deals: s.deals.map((x) => (x.contact_id === id ? { ...x, contact_id: null } : x)) }));
      },
      async createProduct(product) {
        const row = await repo.createProduct(product);
        patch((s) => ({ ...s, products: [...s.products, row] }));
        return row;
      },
      async updateProduct(id, p) {
        const row = await repo.updateProduct(id, p);
        patch((s) => ({ ...s, products: replaceIn(s.products, row) }));
      },
      async deleteProduct(id) {
        await repo.deleteProduct(id);
        patch((s) => ({ ...s, products: s.products.map((x) => (x.id === id ? { ...x, active: false } : x)) }));
      },
      async uploadProductImage(id, file) {
        const row = await repo.uploadProductImage(id, file);
        patch((s) => ({ ...s, products: replaceIn(s.products, row) }));
      },
      async addComment(entity, id, body) {
        const row = await repo.addComment(entity, id, body);
        patch((s) => ({ ...s, comments: [...s.comments, row] }));
      },
      async deleteComment(id) {
        await repo.deleteComment(id);
        patch((s) => ({ ...s, comments: s.comments.filter((c) => c.id !== id) }));
      },
    };
  }, [repo, auth, data, error, loading, signIn, signOut, reload]);

  return <StoreContext.Provider value={store}>{children}</StoreContext.Provider>;
}

export const useStore = (): Store => {
  const store = useContext(StoreContext);
  if (!store) throw new Error("StoreProvider missing");
  return store;
};

/** Store with data guaranteed loaded; pages under the layout use this. */
export const useData = (): Store & { data: Snapshot } => {
  const store = useStore();
  if (!store.data) throw new Error("data not loaded");
  return store as Store & { data: Snapshot };
};
