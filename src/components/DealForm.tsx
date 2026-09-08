import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import type { NewLine, Stage } from "@/types";
import { useData } from "@/store";
import { CURRENT_USER_ID } from "@/lib/db";
import { today } from "@/lib/dates";
import { Field, Modal } from "./ui";
import { CompanyPicker } from "./Pickers";
import LineEditor from "./LineEditor";

export default function DealForm({ open, onClose, stage, companyId = null, onError }: { open: boolean; onClose: () => void; stage: Stage | null; companyId?: number | null; onError: (m: string) => void }) {
  const { data, createDeal } = useData();
  const navigate = useNavigate();
  const [company, setCompany] = useState<number | null>(companyId);
  const [stageCode, setStageCode] = useState(stage?.code ?? data.stages[0].code);
  const [beginDate, setBeginDate] = useState(today());
  const [comment, setComment] = useState("");
  const [lines, setLines] = useState<NewLine[]>([]);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const repeat = company !== null && data.deals.some((d) => d.company_id === company && d.stage_code === "WON");
      const deal = await createDeal(
        { title: "", company_id: company, contact_id: null, stage_code: stageCode, currency: "PLN", begin_date: beginDate, close_date: null, closed: false, repeat_customer: repeat, owner_id: CURRENT_USER_ID, comment: comment || null, source: null },
        lines,
      );
      onClose();
      navigate(`/deals/${deal.id}`);
    } catch (err) {
      onError(err instanceof Error ? err.message : "Nie udało się zapisać");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title="Nowy deal" open={open} onClose={onClose} wide>
      <form onSubmit={submit} className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Firma" className="sm:col-span-2">
            <CompanyPicker value={company} onChange={(id) => setCompany(id)} />
          </Field>
          <Field label="Etap">
            <select className="input" value={stageCode} onChange={(e) => setStageCode(e.target.value)}>
              {data.stages.map((s) => (
                <option key={s.code} value={s.code}>
                  {s.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Data rozpoczęcia">
            <input className="input" type="date" value={beginDate} onChange={(e) => setBeginDate(e.target.value)} required />
          </Field>
          <Field label="Komentarz" className="sm:col-span-2">
            <input className="input" value={comment} onChange={(e) => setComment(e.target.value)} />
          </Field>
        </div>
        <div>
          <span className="label">Pozycje</span>
          <LineEditor lines={lines} onChange={setLines} />
        </div>
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-ghost" onClick={onClose}>
            Anuluj
          </button>
          <button type="submit" className="btn-primary" disabled={busy}>
            {busy ? "Zapisywanie…" : "Utwórz deal"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
