import { createClient, type SupabaseClient } from "@supabase/supabase-js";
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
  NewCompany,
  NewContact,
  NewDeal,
  NewLine,
  NewProduct,
  Product,
  Snapshot,
  Stage,
  StageHistory,
} from "@/types";

const unwrap = <T>(result: { data: T | null; error: { message: string } | null }): T => {
  if (result.error) throw new Error(result.error.message);
  if (result.data === null) throw new Error("empty response");
  return result.data;
};

/** PostgREST returns numeric columns as strings; coerce the money/quantity fields back to numbers. */
const numeric = <T extends object>(row: T, keys: (keyof T)[]): T => {
  const copy = { ...row } as Record<keyof T, unknown>;
  for (const key of keys) copy[key] = Number(copy[key] ?? 0);
  return copy as T;
};

const dealRow = (row: Deal): Deal => numeric(row, ["amount"]);
const lineRow = (row: DealLine): DealLine => numeric(row, ["price", "quantity", "discount_rate", "discount_sum"]);
const productRow = (row: Product): Product => numeric(row, ["price"]);

export class SupabaseRepo implements Repo {
  readonly mode = "supabase" as const;
  private readonly client: SupabaseClient;
  private readonly storageBase: string;
  private stages: Stage[] = [];

  constructor(url: string, anonKey: string) {
    this.client = createClient(url, anonKey);
    this.storageBase = `${url}/storage/v1/object/public/products/`;
  }

  async auth(): Promise<AuthState> {
    const { data } = await this.client.auth.getSession();
    return { email: data.session?.user.email ?? null };
  }

  async signIn(email: string, password: string): Promise<AuthState> {
    const { data, error } = await this.client.auth.signInWithPassword({ email, password });
    if (error) throw new Error(error.message);
    return { email: data.user?.email ?? null };
  }

  async signOut(): Promise<void> {
    await this.client.auth.signOut();
  }

  async changePassword(password: string): Promise<void> {
    const { error } = await this.client.auth.updateUser({ password });
    if (error) throw new Error(error.message);
  }

  async load(): Promise<Snapshot> {
    const all = async <T>(table: string, order: string): Promise<T[]> => {
      // PostgREST pages at 1000 rows; stage history has 2.6k.
      const rows: T[] = [];
      for (let from = 0; ; from += 1000) {
        const page = unwrap(await this.client.from(table).select("*").order(order).range(from, from + 999)) as T[];
        rows.push(...page);
        if (page.length < 1000) return rows;
      }
    };
    const [stages, people, companies, contacts, products, deals, deal_lines, stage_history, comments] = await Promise.all([
      all<Stage>("stages", "sort"),
      all<Snapshot["people"][number]>("people", "id"),
      all<Company>("companies", "id"),
      all<Contact>("contacts", "id"),
      all<Product>("products", "id"),
      all<Deal>("deals", "id"),
      all<DealLine>("deal_lines", "id"),
      all<StageHistory>("stage_history", "id"),
      all<Comment>("comments", "id"),
    ]);
    this.stages = stages;
    return { stages, people, companies, contacts, products: products.map(productRow), deals: deals.map(dealRow), deal_lines: deal_lines.map(lineRow), stage_history, comments };
  }

  imageUrl(path: string | null): string | null {
    return path ? `${this.storageBase}${path}` : null;
  }

  async createDeal(deal: NewDeal, lines: NewLine[]) {
    const now = nowIso();
    const inserted = dealRow(unwrap(await this.client.from("deals").insert({ ...deal, amount: dealAmount(lines), moved_at: now }).select().single()));
    if (!inserted.title) {
      inserted.title = `Deal #${inserted.id}`;
      await this.client.from("deals").update({ title: inserted.title }).eq("id", inserted.id);
    }
    const saved = await this.insertLines(inserted.id, lines);
    const history = unwrap(
      await this.client.from("stage_history").insert({ deal_id: inserted.id, stage_code: inserted.stage_code, moved_at: now, moved_by: CURRENT_USER_ID }).select().single(),
    ) as StageHistory;
    return { deal: inserted, lines: saved, history };
  }

  async updateDeal(id: number, patch: Partial<Omit<Deal, "id">>): Promise<Deal> {
    return dealRow(unwrap(await this.client.from("deals").update({ ...patch, updated_at: nowIso() }).eq("id", id).select().single()));
  }

  async moveDeal(id: number, stageCode: string) {
    const stage = this.stages.find((s) => s.code === stageCode);
    if (!stage) throw new Error("stage not found");
    const current = dealRow(unwrap(await this.client.from("deals").select("*").eq("id", id).single()));
    const now = nowIso();
    const closed = stage.semantic !== "open";
    const deal = dealRow(
      unwrap(
        await this.client
          .from("deals")
          .update({ stage_code: stageCode, previous_stage_code: current.stage_code, moved_at: now, updated_at: now, closed, close_date: closed ? now.slice(0, 10) : current.close_date })
          .eq("id", id)
          .select()
          .single(),
      ),
    );
    const history = unwrap(await this.client.from("stage_history").insert({ deal_id: id, stage_code: stageCode, moved_at: now, moved_by: CURRENT_USER_ID }).select().single()) as StageHistory;
    return { deal, history };
  }

  private async insertLines(dealId: number, lines: NewLine[]): Promise<DealLine[]> {
    if (lines.length === 0) return [];
    const rows = lines.map((line, index) => ({ ...line, deal_id: dealId, sort: index * 10 }));
    return (unwrap(await this.client.from("deal_lines").insert(rows).select()) as DealLine[]).map(lineRow);
  }

  async setLines(dealId: number, lines: NewLine[]) {
    const { error } = await this.client.from("deal_lines").delete().eq("deal_id", dealId);
    if (error) throw new Error(error.message);
    const saved = await this.insertLines(dealId, lines);
    const deal = await this.updateDeal(dealId, { amount: dealAmount(saved) });
    return { deal, lines: saved };
  }

  async deleteDeal(id: number): Promise<void> {
    await this.client.from("comments").delete().eq("entity_type", "deal").eq("entity_id", id);
    const { error } = await this.client.from("deals").delete().eq("id", id);
    if (error) throw new Error(error.message);
  }

  async createCompany(company: NewCompany): Promise<Company> {
    return unwrap(await this.client.from("companies").insert(company).select().single());
  }

  async updateCompany(id: number, patch: Partial<Omit<Company, "id">>): Promise<Company> {
    return unwrap(await this.client.from("companies").update({ ...patch, updated_at: nowIso() }).eq("id", id).select().single());
  }

  async deleteCompany(id: number): Promise<void> {
    const { count } = await this.client.from("deals").select("id", { count: "exact", head: true }).eq("company_id", id);
    if (count) throw new Error("Firma ma deale, najpierw je usuń lub przepnij");
    const { error } = await this.client.from("companies").delete().eq("id", id);
    if (error) throw new Error(error.message);
  }

  async createContact(contact: NewContact): Promise<Contact> {
    return unwrap(await this.client.from("contacts").insert(contact).select().single());
  }

  async updateContact(id: number, patch: Partial<Omit<Contact, "id">>): Promise<Contact> {
    return unwrap(await this.client.from("contacts").update(patch).eq("id", id).select().single());
  }

  async deleteContact(id: number): Promise<void> {
    const { error } = await this.client.from("contacts").delete().eq("id", id);
    if (error) throw new Error(error.message);
  }

  async createProduct(product: NewProduct): Promise<Product> {
    return productRow(unwrap(await this.client.from("products").insert(product).select().single()));
  }

  async updateProduct(id: number, patch: Partial<Omit<Product, "id">>): Promise<Product> {
    return productRow(unwrap(await this.client.from("products").update(patch).eq("id", id).select().single()));
  }

  async deleteProduct(id: number): Promise<void> {
    await this.updateProduct(id, { active: false });
  }

  async uploadProductImage(id: number, file: File): Promise<Product> {
    const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
    const path = `${String(id).padStart(4, "0")}_${Date.now()}.${ext}`;
    const { error } = await this.client.storage.from("products").upload(path, file, { upsert: true, contentType: file.type });
    if (error) throw new Error(error.message);
    return this.updateProduct(id, { image_path: path });
  }

  async addComment(entity: CommentEntity, entityId: number, body: string): Promise<Comment> {
    return unwrap(await this.client.from("comments").insert({ entity_type: entity, entity_id: entityId, kind: "comment", author_id: CURRENT_USER_ID, body }).select().single());
  }

  async deleteComment(id: number): Promise<void> {
    const { error } = await this.client.from("comments").delete().eq("id", id);
    if (error) throw new Error(error.message);
  }
}
