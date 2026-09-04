import Badge from "@/Components/Redesign/primitives/Badge";
import { REDESIGN_TOKENS as T } from "@/Components/Redesign/tokens";
import { useTd } from "@/Hooks/useDynamicTranslation";
import { TdFn } from "@/lib/dynamicTranslation";
import { EmailDeliveryDetail, MailSystem, RunLogEntry } from "../types";

/** Human label for the mail system that actually delivered a message. */
const MAIL_SYSTEM_LABEL: Record<MailSystem, string> = {
    uns: "UNS / Plunk",
    smtp: "PHP mailer (SMTP)",
    unknown: "Unknown",
};

const labelStyle = {
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: "0.05em",
    textTransform: "uppercase" as const,
    color: T.GRAY_DARKER,
};

const valueStyle = { fontSize: 12, color: T.TEXT };

function Field({ label, value }: { label: string; value: string }) {
    return (
        <div>
            <div style={labelStyle}>{label}</div>
            <div className="mt-0.5 break-words" style={valueStyle}>
                {value}
            </div>
        </div>
    );
}

/** Raw provider payload — wide, so it scrolls inside its own box. */
function RawBlock({ label, body }: { label: string; body: string }) {
    return (
        <div>
            <div style={labelStyle}>{label}</div>
            <pre
                className="mt-1 mb-0 overflow-x-auto rounded-md p-2.5"
                style={{
                    background: T.SURFACE_2,
                    border: `1px solid ${T.BORDER}`,
                    fontSize: 11,
                    lineHeight: 1.5,
                    color: T.TEXT_MUTED,
                    maxHeight: 200,
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-word",
                }}
            >
                {body}
            </pre>
        </div>
    );
}

function EmailDelivery({ delivery, td }: { delivery: EmailDeliveryDetail; td: TdFn }) {
    const failed = delivery.status === "failed";

    return (
        <div
            className="rounded-lg p-3 flex flex-col gap-2.5"
            style={{ border: `1px solid ${T.BORDER}`, background: "#fff" }}
        >
            <div className="flex items-center gap-2 flex-wrap">
                <span style={{ fontSize: 13, fontWeight: 600, color: T.TEXT }}>{delivery.recipient}</span>
                <Badge variant={failed ? "red" : "green"}>
                    {failed ? td("Failed") : td("Sent")}
                </Badge>
                <Badge variant={delivery.system === "uns" ? "teal" : "gray"}>
                    {td(MAIL_SYSTEM_LABEL[delivery.system] ?? MAIL_SYSTEM_LABEL.unknown)}
                </Badge>
                {delivery.uns_attempted && delivery.system === "smtp" && (
                    <Badge variant="amber">{td("Fell back from UNS")}</Badge>
                )}
            </div>

            <div className="grid gap-2.5" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))" }}>
                {delivery.response_status !== null && (
                    <Field label={td("UNS response")} value={String(delivery.response_status)} />
                )}
                {delivery.fallback_reason && (
                    <Field label={td("Fallback reason")} value={delivery.fallback_reason} />
                )}
            </div>

            {delivery.error && <RawBlock label={td("Error")} body={delivery.error} />}
            {delivery.response_body && <RawBlock label={td("UNS response body")} body={delivery.response_body} />}
        </div>
    );
}

/**
 * Expanded diagnostics for a Run History row: which mail system handled each
 * recipient and why it failed, or exactly what Meta answered for a conversion
 * event. Falls back to a raw JSON dump for channels with no dedicated view, so
 * a new `details` shape is still readable without a UI change.
 */
export default function RunLogDetailPanel({ entry }: { entry: RunLogEntry }) {
    const { td } = useTd();
    const details = entry.details;

    if (!details) {
        return (
            <div className="px-4.5 py-3" style={{ fontSize: 12, color: T.TEXT_HINT }}>
                {td("No additional detail was recorded for this run.")}
            </div>
        );
    }

    const deliveries = details.deliveries ?? [];
    const meta = details.meta;

    return (
        <div
            className="px-4.5 py-3.5 flex flex-col gap-3.5"
            style={{ background: T.SURFACE_2, borderTop: `1px solid ${T.BORDER}` }}
        >
            {entry.channel === "email" && (
                <>
                    <div className="grid gap-2.5" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))" }}>
                        {details.template_name && <Field label={td("Template")} value={details.template_name} />}
                        <Field
                            label={td("Plunk template")}
                            value={details.plunk_template_id || td("None — rendered in the CRM")}
                        />
                        {details.subject && <Field label={td("Subject")} value={details.subject} />}
                    </div>

                    {deliveries.length === 0 ? (
                        <div style={{ fontSize: 12, color: T.TEXT_HINT }}>
                            {td("No recipient delivery was recorded.")}
                        </div>
                    ) : (
                        <div className="flex flex-col gap-2">
                            {deliveries.map((delivery, i) => (
                                <EmailDelivery key={`${delivery.recipient}-${i}`} delivery={delivery} td={td} />
                            ))}
                        </div>
                    )}
                </>
            )}

            {entry.channel === "meta" && (
                <>
                    <div className="grid gap-2.5" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))" }}>
                        <Field
                            label={td("Phase")}
                            value={details.stage === "queued" ? td("Queued for sending") : td("Meta API response")}
                        />
                        {details.source && (
                            <Field
                                label={td("Triggered by")}
                                value={details.source === "stage_trigger" ? td("Pipeline stage trigger") : td("Automation")}
                            />
                        )}
                        {(details.event_name || meta?.event_name) && (
                            <Field label={td("Event")} value={(details.event_name ?? meta?.event_name) as string} />
                        )}
                        {meta?.status_code != null && (
                            <Field label={td("HTTP status")} value={String(meta.status_code)} />
                        )}
                        {meta?.events_received != null && (
                            <Field label={td("Events received")} value={String(meta.events_received)} />
                        )}
                        {meta?.fbtrace_id && <Field label={td("Meta trace id")} value={meta.fbtrace_id} />}
                        {meta?.pixel_id && <Field label={td("Pixel")} value={meta.pixel_id} />}
                        {meta?.event_id && <Field label={td("Event id")} value={meta.event_id} />}
                    </div>

                    {meta?.error && <RawBlock label={td("Why it failed")} body={meta.error} />}
                    {meta?.error_details && (
                        <RawBlock label={td("Meta error object")} body={JSON.stringify(meta.error_details, null, 2)} />
                    )}
                    {meta?.response_body && <RawBlock label={td("Meta response")} body={meta.response_body} />}
                </>
            )}

            {entry.channel !== "email" && entry.channel !== "meta" && (
                <RawBlock label={td("Detail")} body={JSON.stringify(details, null, 2)} />
            )}
        </div>
    );
}
