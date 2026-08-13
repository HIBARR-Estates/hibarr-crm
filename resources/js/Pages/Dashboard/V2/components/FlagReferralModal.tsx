import { useState } from "react";
import { router } from "@inertiajs/react";
import { Modal, ModalField, REDESIGN_TOKENS as T } from "@/Components/Redesign";
import { useTd } from "@/Hooks/useDynamicTranslation";
import type { PartnerReferral } from "../types";

const REASONS = [
    { value: "stalled", label: "Nothing has happened for a while" },
    { value: "wrong_contact", label: "The contact details look wrong" },
    { value: "other", label: "Something else" },
] as const;

/**
 * A partner asking for a look at one of their referrals.
 *
 * Deliberately not a message to the assigned agent: the partner sits outside
 * the trust boundary and has no line to them. This goes to whoever holds
 * manage_partner_flags, and the server re-checks that the referral is actually
 * theirs — the lead id here is a hint, not an authorisation.
 */
export default function FlagReferralModal({
    referral,
    onClose,
}: {
    referral: PartnerReferral | null;
    onClose: () => void;
}) {
    const { td } = useTd();
    const [reason, setReason] = useState<string>("stalled");
    const [message, setMessage] = useState("");
    const [saving, setSaving] = useState(false);

    if (!referral) return null;

    const submit = () => {
        setSaving(true);
        router.post(
            route("partner-flags.store"),
            { lead_id: referral.id, reason, message: message.trim() || null },
            {
                preserveScroll: true,
                only: ["partnerReferrals"],
                onFinish: () => {
                    setSaving(false);
                    onClose();
                },
            },
        );
    };

    return (
        <Modal
            open
            onClose={onClose}
            title={td("Flag this referral")}
            dirty={message.length > 0}
            footer={
                <>
                    <button
                        type="button"
                        className="dr-btn dr-btn-ghost"
                        onClick={onClose}
                    >
                        {td("Cancel")}
                    </button>
                    <button
                        type="button"
                        className="dr-btn dr-btn-primary"
                        disabled={saving}
                        onClick={submit}
                    >
                        {td("Send flag")}
                    </button>
                </>
            }
        >
            <p
                style={{
                    margin: "0 0 16px",
                    fontSize: 14,
                    color: T.TEXT_MUTED,
                    lineHeight: 1.5,
                }}
            >
                {td("About")} <strong>{referral.client}</strong>,{" "}
                {td("referred")} {referral.days_open}
                {td("d ago")}.
            </p>

            <ModalField label={td("What is the problem")}>
                <select
                    className="dr-input"
                    value={reason}
                    onChange={(event) => setReason(event.target.value)}
                >
                    {REASONS.map((option) => (
                        <option key={option.value} value={option.value}>
                            {td(option.label)}
                        </option>
                    ))}
                </select>
            </ModalField>

            <ModalField label={td("Anything to add (optional)")}>
                <textarea
                    className="dr-input"
                    rows={4}
                    maxLength={1000}
                    value={message}
                    onChange={(event) => setMessage(event.target.value)}
                />
            </ModalField>

            <p
                style={{
                    margin: 0,
                    fontSize: 13,
                    color: T.TEXT_MUTED,
                    lineHeight: 1.5,
                }}
            >
                {td(
                    "This reaches the partner team, not the assigned agent. You will see their reply on this row.",
                )}
            </p>
        </Modal>
    );
}
