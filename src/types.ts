export type StageSemantic = "open" | "won" | "lost";

export interface Stage {
  code: string;
  name: string;
  semantic: StageSemantic;
  sort: number;
  color: string;
}

export interface Person {
  id: number;
  name: string;
  active: boolean;
}

export interface Company {
  id: number;
  name: string;
  nip: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  company_type: string | null;
  comment: string | null;
  owner_id: number | null;
  created_at: string;
  updated_at: string;
}

export interface Contact {
  id: number;
  first_name: string;
  last_name: string | null;
  phone: string | null;
  email: string | null;
  position: string | null;
  company_id: number | null;
  created_at: string;
}

export interface Product {
  id: number;
  name: string;
  slug: string | null;
  price: number;
  unit: string;
  active: boolean;
  sort: number;
  group_name: string | null;
  image_path: string | null;
  created_at: string;
}

export interface Deal {
  id: number;
  title: string;
  company_id: number | null;
  contact_id: number | null;
  stage_code: string;
  amount: number;
  currency: string;
  begin_date: string | null;
  close_date: string | null;
  closed: boolean;
  repeat_customer: boolean;
  owner_id: number | null;
  comment: string | null;
  source: string | null;
  created_at: string;
  updated_at: string;
  moved_at: string | null;
  previous_stage_code: string | null;
}

export interface DealLine {
  id: number;
  deal_id: number;
  product_id: number | null;
  product_name: string;
  price: number;
  quantity: number;
  discount_rate: number;
  discount_sum: number;
  sort: number;
}

export interface StageHistory {
  id: number;
  deal_id: number;
  stage_code: string;
  moved_at: string;
  moved_by: number | null;
}

export type CommentEntity = "deal" | "company" | "contact";

export type CommentKind = "comment" | "task";

export interface Comment {
  id: number;
  entity_type: CommentEntity;
  entity_id: number;
  kind: CommentKind;
  author_id: number | null;
  body: string;
  deadline: string | null;
  completed: boolean;
  created_at: string;
  files: { name: string; url: string }[];
}

export interface Snapshot {
  stages: Stage[];
  people: Person[];
  companies: Company[];
  contacts: Contact[];
  products: Product[];
  deals: Deal[];
  deal_lines: DealLine[];
  stage_history: StageHistory[];
  comments: Comment[];
}

export type NewDeal = Omit<Deal, "id" | "created_at" | "updated_at" | "amount" | "moved_at" | "previous_stage_code">;
export type NewLine = Omit<DealLine, "id" | "deal_id">;
export type NewCompany = Omit<Company, "id" | "created_at" | "updated_at">;
export type NewContact = Omit<Contact, "id" | "created_at">;
export type NewProduct = Omit<Product, "id" | "created_at">;
