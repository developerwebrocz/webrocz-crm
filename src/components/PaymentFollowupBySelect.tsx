import { PAYMENT_FOLLOWUP_BY } from "@/lib/domain";

// "Follow-up payment by" in a client's Edit info (Web Solutions / Web Rocz / Web Rocz Pvt Ltd):
// who follows up the client's payments.
export default function PaymentFollowupBySelect({ defaultValue }: { defaultValue?: string | null }) {
  return (
    <label className="block"><span className="eyebrow">Follow-up payment by</span>
      <select name="paymentFollowupBy" defaultValue={defaultValue ?? ""} className="select mt-1">
        <option value="">— Select —</option>
        {PAYMENT_FOLLOWUP_BY.map((v) => <option key={v} value={v}>{v}</option>)}
      </select>
    </label>
  );
}
