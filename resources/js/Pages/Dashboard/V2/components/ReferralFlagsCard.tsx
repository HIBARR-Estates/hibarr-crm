import { useState } from "react";
import { router } from "@inertiajs/react";
import { REDESIGN_TOKENS as T } from "@/Components/Redesign";
import { useTd } from "@/Hooks/useDynamicTranslation";
import type { PartnerFlagThreadItem, PartnerReferral } from "../types";

const REASONS = [
    { value: "stalled", label: "Nothing has happened for a while" },
    { value: "wrong_contact", label: "The contact details look wrong" },
    { value: "other", label: "Something else" },
] as const;

const REASON_LABEL: Record<string, string> = {
    stalled: "Stalled",
    wrong_contact: "Wrong contact",
    other: "Something else",
};

const STATUS_PILL: Record<string, string> = {
    open: "amber",
    acknowledged: "blue",
    resolved: "green",
};

const STATUS_LABEL: Record<string, string> = {
    open: "Waiting for a reply",
    acknowledged: "Acknowledged",
    resolved: "Replied",
};

/**
 * Raising a flag and reading the team's reply. Nothing else lives here:
 * the referral table is the book, this card is the conversation.
 */
export default function ReferralFlagsCard({
    referrals,
    flags,
}: {
    referrals: PartnerReferral[];
    flags: PartnerFlagThreadItem[];
}) {
    const { td } = useTd();
    const openLeadIds = new Set(
        flags
            .filter(
                (flag) =>
                    flag.status === "open" || flag.status === "acknowledged",
            )
            .map((flag) => flag.lead_id),
    );
    const available = referrals.filter((row) => !openLeadIds.has(row.id));

    const [leadId, setLeadId] = useState<number | "">("");
    const [reason, setReason] = useState<string>("stalled");
    const [message, setMessage] = useState("");
    const [saving, setSaving] = useState(false);

    const submit = () => {
        if (leadId === "") return;

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
                    setLeadId("");
                    setReason("stalled");
                    setMessage("");
                },
                onFinish: () => setSaving(false),
            },
        );
    };

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {available.length ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    <label style={fieldLabel}>
                        {td("Referral", { source: "en" })}
                        <select
                            className="dr-input"
                            value={leadId}
                            onChange={(event) =>
                                setLeadId(
                                    event.target.value
                                        ? Number(event.target.value)
                                        : "",
                                )
                            }
                        >
                            <option value="">
                                {td("Choose a referral", { source: "en" })}
                            </option>
                            {available.map((row) => (
                                <option key={row.id} value={row.id}>
                                    {row.client ??
                                        td("Unnamed referral", { source: "en" })}
                                </option>
                            ))}
                        </select>
                    </label>

                    <label style={fieldLabel}>
                        {td("What is the problem", { source: "en" })}
                        <select
                            className="dr-input"
                            value={reason}
                            onChange={(event) => setReason(event.target.value)}
                        >
                            {REASONS.map((option) => (
                                <option key={option.value} value={option.value}>
                                    {td(option.label, { source: "en" })}
                                </option>
                            ))}
                        </select>
                    </label>

                    <label style={fieldLabel}>
                        {td("Anything to add (optional)", { source: "en" })}
                        <textarea
                            className="dr-input"
                            rows={3}
                            maxLength={1000}
                            value={message}
                            onChange={(event) => setMessage(event.target.value)}
                        />
                    </label>

                    <button
                        type="button"
                        className="dr-btn dr-btn-primary"
                        disabled={saving || leadId === ""}
                        onClick={submit}
                    >
                        {td("Send flag", { source: "en" })}
                    </button>
                </div>
            ) : (
                <p style={{ margin: 0, fontSize: 13, color: T.TEXT_MUTED }}>
                    {td(
                        referrals.length
                            ? "Every active referral already has an open flag."
                            : "No referrals to flag right now.",
                        { source: "en" },
                    )}
                </p>
            )}

            <div
                style={{
                    borderTop: `1px solid ${T.BORDER_SOFT}`,
                    paddingTop: 12,
                    display: "flex",
                    flexDirection: "column",
                }}
            >
                {flags.length === 0 ? (
                    <p style={{ margin: 0, fontSize: 14, color: T.TEXT_MUTED }}>
                        {td("No flags yet.", { source: "en" })}
                    </p>
                ) : (
                    flags.map((flag, index) => (
                        <div
                            key={flag.id}
                            style={{
                                padding: "12px 0",
                                borderTop:
                                    index === 0
                                        ? undefined
                                        : `1px solid ${T.BORDER_SOFT}`,
                            }}
                        >
                            <div
                                style={{
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "space-between",
                                    gap: 8,
                                }}
                            >
                                <div style={{ fontSize: 14, fontWeight: 600 }}>
                                    {flag.client ??
                                        td("Unnamed referral", { source: "en" })}
                                </div>
                                <span
                                    className={`dr-pill dr-pill-${STATUS_PILL[flag.status] ?? "gray"}`}
                                >
                                    {td(
                                        STATUS_LABEL[flag.status] ?? flag.status,
                                        { source: "en" },
                                    )}
                                </span>
                            </div>
                            <div
                                style={{
                                    marginTop: 4,
                                    fontSize: 13,
                                    color: T.TEXT_MUTED,
                                }}
                            >
                                {td(REASON_LABEL[flag.reason] ?? flag.reason, {
                                    source: "en",
                                })}
                                {flag.message ? ` · "${flag.message}"` : ""}
                            </div>
                            {flag.response ? (
                                <div
                                    style={{
                                        marginTop: 8,
                                        fontSize: 13,
                                        lineHeight: 1.45,
                                        color: T.NAVY,
                                    }}
                                >
                                    <span style={{ fontWeight: 600 }}>
                                        {td("Reply", { source: "en" })}:{" "}
                                    </span>
                                    {flag.response}
                                </div>
                            ) : null}
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}

const fieldLabel = {
    display: "flex",
    flexDirection: "column",
    gap: 6,
    fontSize: 12,
    fontWeight: 600,
    color: T.TEXT_MUTED,
} as const;
