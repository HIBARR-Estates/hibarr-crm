import { useState } from "react";
import { router } from "@inertiajs/react";
import {
    Button,
    Modal,
    ModalField,
    REDESIGN_TOKENS as T,
} from "@/Components/Redesign";
import SearchableSelect from "@/Components/Redesign/primitives/SearchableSelect";
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
 * The lead id is a hint. The server re-checks that this account introduced
 * the lead before it stores the flag.
 */
export default function FlagReferralModal({
    open,
    referrals,
    onClose,
}: {
    open: boolean;
    referrals: PartnerReferral[];
    onClose: () => void;
}) {
    const { td } = useTd();
    const [leadId, setLeadId] = useState<number | null>(null);
    const [reason, setReason] = useState<string>("stalled");
    const [message, setMessage] = useState("");
    const [saving, setSaving] = useState(false);

    const close = () => {
        if (saving) return;
        setLeadId(null);
        setReason("stalled");
        setMessage("");
        onClose();
    };

    const submit = () => {
        if (leadId === null) return;

        setSaving(true);
        router.post(
            route("partner-flags.store"),
            {
                lead_id: leadId,
                reason,
                message: message.trim() || null,
            },
            {
                preserveScroll: true,
                only: ["partnerFlags", "partnerReferrals"],
                onSuccess: () => {
                    setLeadId(null);
                    setReason("stalled");
                    setMessage("");
                    onClose();
                },
                onFinish: () => setSaving(false),
            },
        );
    };

    return (
        <Modal
            open={open}
            onClose={close}
            title={td("Flag this referral", { source: "en" })}
            dirty={leadId !== null || message.length > 0}
            footer={
                <>
                    <Button variant="ghost" onClick={close} disabled={saving}>
                        {td("Cancel", { source: "en" })}
                    </Button>
                    <Button
                        variant="primary"
                        loading={saving}
                        disabled={leadId === null}
                        onClick={submit}
                    >
                        {td("Send flag", { source: "en" })}
                    </Button>
                </>
            }
        >
            <ModalField label={td("Referral", { source: "en" })}>
                <SearchableSelect<number>
                    className="w-full"
                    popupMatchSelectWidth
                    value={leadId ?? undefined}
                    placeholder={td("Choose a referral", { source: "en" })}
                    notFoundContent={td("No matching referral", { source: "en" })}
                    options={referrals.map((row) => ({
                        value: row.id,
                        label:
                            row.client ?? td("Unnamed referral", { source: "en" }),
                    }))}
                    onChange={(value) => setLeadId(value ?? null)}
                />
            </ModalField>

            <ModalField label={td("What is the problem", { source: "en" })}>
                <SearchableSelect<string>
                    className="w-full"
                    popupMatchSelectWidth
                    value={reason}
                    options={REASONS.map((option) => ({
                        value: option.value,
                        label: td(option.label, { source: "en" }),
                    }))}
                    onChange={(value) => setReason(value)}
                />
            </ModalField>

            <ModalField label={td("Anything to add (optional)", { source: "en" })}>
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
                    "This reaches the partner team, not the assigned agent. You will see their reply on this card.",
                    { source: "en" },
                )}
            </p>
        </Modal>
    );
}
