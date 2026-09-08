import type { Repo, AuthState } from "./db";
import { CURRENT_USER_ID } from "./db";
import { dealAmount } from "./money";
import { nowIso } from "./dates";
import type {
  Comment,
  CommentEntity,
  Company,
  Contact,
  Deal,
  DealLine,
  NewComment,
  NewCompany,
  NewContact,
  NewDeal,
  NewLine,
  NewProduct,
  Product,
  Snapshot,
  StageHistory,
} from "@/types";

const STORAGE_KEY = "browar-crm-local-v1";

const nextId = (rows: { id: number }[]): number => rows.reduce((max, row) => Math.max(max, row.id), 0) + 1;

/**
 * In-browser adapter: seeds from the bundled snapshot and keeps every change in localStorage.
 * Used for development, tests and as a read-only demo when no Supabase project is configured.
 */
export class LocalRepo implements Repo {
  readonly mode = "local" as const;
  private data: Snapshot | null = null;

  constructor(private readonly snapshotUrl: string, private readonly imageBase: string) {}

  async auth(): Promise<AuthState> {
    return { email: "local@dev" };
  }
  async signIn(email: string): Promise<AuthState> {
    return { email };
  }
  async signOut(): Promise<void> {}
  async changePassword(): Promise<void> {}

  async load(): Promise<Snapshot> {
    const stored = safeRead();
    if (stored) this.data = stored;
    else {
      const response = await fetch(this.snapshotUrl);
      if (!response.ok) throw new Error(`snapshot fetch failed: ${response.status}`);
      this.data = (await response.json()) as Snapshot;
    }
    // The store keeps its own copy: this adapter mutates its arrays in place, and sharing them would double every insert.
    return structuredClone(this.data);
  }

  imageUrl(path: string | null): string | null {
    return path ? `${this.imageBase}${path}` : null;
  }

  private get db(): Snapshot {
    if (!this.data) throw new Error("load() first");
    return this.data;
  }

  private persist(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.db));
    } catch {
      /* quota or private mode: keep in memory only */
    }
  }

  async createDeal(deal: NewDeal, lines: NewLine[]) {
    const now = nowIso();
    const row: Deal = {
      ...deal,
      id: nextId(this.db.deals),
      amount: dealAmount(lines),
      created_at: now,
      updated_at: now,
      moved_at: now,
      previous_stage_code: null,
    };
    if (!row.title) row.title = `Deal #${row.id}`;
    this.db.deals.push(row);
    const saved = this.replaceLines(row.id, lines);
    const history: StageHistory = { id: nextId(this.db.stage_history), deal_id: row.id, stage_code: row.stage_code, moved_at: now, moved_by: CURRENT_USER_ID };
    this.db.stage_history.push(history);
    this.persist();
    return { deal: row, lines: saved, history };
  }

  async updateDeal(id: number, patch: Partial<Omit<Deal, "id">>): Promise<Deal> {
    const row = this.db.deals.find((d) => d.id === id);
    if (!row) throw new Error("deal not found");
    Object.assign(row, patch, { updated_at: nowIso() });
    this.persist();
    return row;
  }

  async moveDeal(id: number, stageCode: string) {
    const row = this.db.deals.find((d) => d.id === id);
    if (!row) throw new Error("deal not found");
    const stage = this.db.stages.find((s) => s.code === stageCode);
    if (!stage) throw new Error("stage not found");
    const now = nowIso();
    row.previous_stage_code = row.stage_code;
    row.stage_code = stageCode;
    row.moved_at = now;
    row.updated_at = now;
    row.closed = stage.semantic !== "open";
    row.close_date = row.closed ? now.slice(0, 10) : row.close_date;
    const history: StageHistory = { id: nextId(this.db.stage_history), deal_id: id, stage_code: stageCode, moved_at: now, moved_by: CURRENT_USER_ID };
    this.db.stage_history.push(history);
    this.persist();
    return { deal: row, history };
  }

  private replaceLines(dealId: number, lines: NewLine[]): DealLine[] {
    this.db.deal_lines = this.db.deal_lines.filter((l) => l.deal_id !== dealId);
    let id = nextId(this.db.deal_lines);
    const saved = lines.map((line, index) => ({ ...line, id: id++, deal_id: dealId, sort: index * 10 }));
    this.db.deal_lines.push(...saved);
    return saved;
  }

  async setLines(dealId: number, lines: NewLine[]) {
    const deal = this.db.deals.find((d) => d.id === dealId);
    if (!deal) throw new Error("deal not found");
    const saved = this.replaceLines(dealId, lines);
    deal.amount = dealAmount(saved);
    deal.updated_at = nowIso();
    this.persist();
    return { deal, lines: saved };
  }

  async deleteDeal(id: number): Promise<void> {
    this.db.deals = this.db.deals.filter((d) => d.id !== id);
    this.db.deal_lines = this.db.deal_lines.filter((l) => l.deal_id !== id);
    this.db.stage_history = this.db.stage_history.filter((h) => h.deal_id !== id);
    this.db.comments = this.db.comments.filter((c) => !(c.entity_type === "deal" && c.entity_id === id));
    this.persist();
  }

  async createCompany(company: NewCompany): Promise<Company> {
    const now = nowIso();
    const row: Company = { ...company, id: nextId(this.db.companies), created_at: now, updated_at: now };
    this.db.companies.push(row);
    this.persist();
    return row;
  }

  async updateCompany(id: number, patch: Partial<Omit<Company, "id">>): Promise<Company> {
    const row = this.db.companies.find((c) => c.id === id);
    if (!row) throw new Error("company not found");
    Object.assign(row, patch, { updated_at: nowIso() });
    this.persist();
    return row;
  }

  async deleteCompany(id: number): Promise<void> {
    if (this.db.deals.some((d) => d.company_id === id)) throw new Error("Firma ma deale, najpierw je usuń lub przepnij");
    this.db.companies = this.db.companies.filter((c) => c.id !== id);
    this.db.contacts.forEach((c) => {
      if (c.company_id === id) c.company_id = null;
    });
    this.persist();
  }

  async createContact(contact: NewContact): Promise<Contact> {
    const row: Contact = { ...contact, id: nextId(this.db.contacts), created_at: nowIso() };
    this.db.contacts.push(row);
    this.persist();
    return row;
  }

  async updateContact(id: number, patch: Partial<Omit<Contact, "id">>): Promise<Contact> {
    const row = this.db.contacts.find((c) => c.id === id);
    if (!row) throw new Error("contact not found");
    Object.assign(row, patch);
    this.persist();
    return row;
  }

  async deleteContact(id: number): Promise<void> {
    this.db.contacts = this.db.contacts.filter((c) => c.id !== id);
    this.db.deals.forEach((d) => {
      if (d.contact_id === id) d.contact_id = null;
    });
    this.persist();
  }

  async createProduct(product: NewProduct): Promise<Product> {
    const row: Product = { ...product, id: nextId(this.db.products), created_at: nowIso() };
    this.db.products.push(row);
    this.persist();
    return row;
  }

  async updateProduct(id: number, patch: Partial<Omit<Product, "id">>): Promise<Product> {
    const row = this.db.products.find((p) => p.id === id);
    if (!row) throw new Error("product not found");
    Object.assign(row, patch);
    this.persist();
    return row;
  }

  async deleteProduct(id: number): Promise<void> {
    const row = this.db.products.find((p) => p.id === id);
    if (!row) return;
    row.active = false; // lines keep their product_id, so products are only deactivated
    this.persist();
  }

  async uploadProductImage(id: number, file: File): Promise<Product> {
    const row = this.db.products.find((p) => p.id === id);
    if (!row) throw new Error("product not found");
    row.image_path = URL.createObjectURL(file).replace(this.imageBase, "");
    this.persist();
    return row;
  }

  async addComment(entity: CommentEntity, entityId: number, input: NewComment): Promise<Comment> {
    const row: Comment = { id: nextId(this.db.comments), entity_type: entity, entity_id: entityId, kind: input.kind, author_id: CURRENT_USER_ID, body: input.body, deadline: input.deadline, completed: false, pinned: false, created_at: nowIso(), files: [] };
    this.db.comments.push(row);
    this.persist();
    return row;
  }

  async updateComment(id: number, patch: Partial<Pick<Comment, "body" | "completed" | "pinned" | "deadline">>): Promise<Comment> {
    const row = this.db.comments.find((c) => c.id === id);
    if (!row) throw new Error("comment not found");
    Object.assign(row, patch);
    this.persist();
    return row;
  }

  async deleteComment(id: number): Promise<void> {
    this.db.comments = this.db.comments.filter((c) => c.id !== id);
    this.persist();
  }
}

function safeRead(): Snapshot | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Snapshot) : null;
  } catch {
    return null;
  }
}

export const resetLocalData = (): void => {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
};
