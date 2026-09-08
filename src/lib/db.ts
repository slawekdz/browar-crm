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

export interface AuthState {
  email: string | null;
}

/**
 * Data access boundary. The whole dataset is small (hundreds of deals), so every adapter
 * loads it once into memory and returns the changed rows after each mutation; the store
 * applies them locally instead of refetching.
 */
export interface Repo {
  readonly mode: "local" | "supabase";
  auth(): Promise<AuthState>;
  signIn(email: string, password: string): Promise<AuthState>;
  signOut(): Promise<void>;
  changePassword(password: string): Promise<void>;

  load(): Promise<Snapshot>;
  imageUrl(path: string | null): string | null;

  createDeal(deal: NewDeal, lines: NewLine[]): Promise<{ deal: Deal; lines: DealLine[]; history: StageHistory }>;
  updateDeal(id: number, patch: Partial<Omit<Deal, "id">>): Promise<Deal>;
  moveDeal(id: number, stageCode: string): Promise<{ deal: Deal; history: StageHistory }>;
  setLines(dealId: number, lines: NewLine[]): Promise<{ deal: Deal; lines: DealLine[] }>;
  deleteDeal(id: number): Promise<void>;

  createCompany(company: NewCompany): Promise<Company>;
  updateCompany(id: number, patch: Partial<Omit<Company, "id">>): Promise<Company>;
  deleteCompany(id: number): Promise<void>;

  createContact(contact: NewContact): Promise<Contact>;
  updateContact(id: number, patch: Partial<Omit<Contact, "id">>): Promise<Contact>;
  deleteContact(id: number): Promise<void>;

  createProduct(product: NewProduct): Promise<Product>;
  updateProduct(id: number, patch: Partial<Omit<Product, "id">>): Promise<Product>;
  deleteProduct(id: number): Promise<void>;
  uploadProductImage(id: number, file: File): Promise<Product>;

  addComment(entity: CommentEntity, entityId: number, input: NewComment): Promise<Comment>;
  updateComment(id: number, patch: Partial<Pick<Comment, "body" | "completed" | "pinned" | "deadline">>): Promise<Comment>;
  deleteComment(id: number): Promise<void>;
}

export const CURRENT_USER_ID = 1; // Sławek: the only account; historical rows keep their Bitrix owner ids
