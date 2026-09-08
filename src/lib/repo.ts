import type { Repo } from "./db";
import { LocalRepo } from "./local";
import { SupabaseRepo } from "./supabase";

const base = import.meta.env.BASE_URL;

/** Supabase when the build carries a project URL, otherwise the bundled snapshot (dev, tests, demo). */
export const createRepo = (): Repo => {
  const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
  if (url && key) return new SupabaseRepo(url, key);
  return new LocalRepo(`${base}snapshot.json`, `${base}product_images/`);
};
