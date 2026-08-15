import { useState } from "react";
import { router } from "@inertiajs/react";
import { Modal, ModalField, REDESIGN_TOKENS as T } from "@/Components/Redesign";
import { useTd } from "@/Hooks/useDynamicTranslation";
import type { PartnerFlagRow } from "../types";

/**
 * Partner flags waiting on the team.
 *
 * A partner cannot reach the assigned agent, so this is the only place their
 * escalation lands. Answering it is the whole point — a flag queue with no
 * reply box would just be a second inbox nobody drains.
 */
export default function PartnerFlagQueue({ rows }: { rows: PartnerFlagRow[] }) {
    const { td } = useTd();
    const [answering, setAnswering] = useState<PartnerFlagRow | null>(null);
    const [response, setResponse] = useState("");
    const [saving, setSaving] = useState(false);

    if (!rows.length) {
        return (
            <p style={{ margin: 0, fontSize: 14, color: T.TEXT_MUTED }}>
                {td("No partner has flagged a referral.")}
            </p>
        );
    }

    const submit = () => {
        if (!answering || !response.trim()) return;

        setSaving(true);
        router.post(
            route("partner-flags.resolve", answering.id),
            { response: response.trim(), status: "resolved" },
            {
                preserveScroll: true,
                only: ["openPartnerFlags"],
                onFinish: () => {
                    setSaving(false);
                    setAnswering(null);
                    setResponse("");
                },
            },
        );
    };

    return (
        <>
            <div style={{ display: "flex", flexDirection: "column" }}>
                {rows.map((row, index) => (
                    <div
                        key={row.id}
                        style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 12,
                            padding: "12px 0",
                            borderTop:
                                index === 0
                                    ? undefined
                                    : `1px solid ${T.BORDER_SOFT}`,
                        }}
                    >
                        <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 14, fontWeight: 600 }}>
                                {row.partner ?? td("A partner")}
                                <span
                                    style={{
                                        fontWeight: 400,
                                        color: T.TEXT_MUTED,
                                    }}
                                >
                                    {" · "}
                                    {row.client ?? td("their referral")}
                                </span>
                            </div>
                            <div
                                style={{
                                    fontSize: 13,
                                    color: T.TEXT_MUTED,
                                    marginTop: 2,
                                }}
                            >
                                {td(row.reason.replace(/_/g, " "))}
                                {row.message ? ` · "${row.message}"` : ""}
                            </div>
                        </div>

                        <span
                            className="dr-pill dr-pill-amber"
                            style={{ flex: "none" }}
                        >
                            {row.days_open}d
                        </span>

                        <button
                            type="button"
                            className="dr-btn dr-btn-ghost"
                            style={{ flex: "none" }}
                            onClick={() => setAnswering(row)}
                        >
                            {td("Respond")}
                        </button>
                    </div>
                ))}
            </div>

            {answering && (
                <Modal
                    open
                    onClose={() => setAnswering(null)}
                    title={td("Respond to the partner")}
                    footer={
                        <>
                            <button
                                type="button"
                                className="dr-btn dr-btn-ghost"
                                onClick={() => setAnswering(null)}
                            >
                                {td("Cancel")}
                            </button>
                            <button
                                type="button"
                                className="dr-btn dr-btn-primary"
                                disabled={saving || !response.trim()}
                                onClick={submit}
                            >
                                {td("Send response")}
                            </button>
                        </>
                    }
                >
                    <ModalField label={td("Your response")}>
                        <textarea
                            className="dr-input"
                            rows={4}
                            maxLength={1000}
                            autoFocus
                            value={response}
                            onChange={(event) => setResponse(event.target.value)}
                            placeholder={td(
                                "What has happened, and what happens next",
                            )}
                        />
                    </ModalField>
                    <p
                        style={{
                            margin: "10px 0 0",
                            fontSize: 13,
                            color: T.TEXT_MUTED,
                            lineHeight: 1.5,
                        }}
                    >
                        {td(
                            "The partner sees this on their dashboard. The assigned agent is not notified.",
                        )}
                    </p>
                </Modal>
            )}
        </>
    );
}
