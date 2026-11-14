import { useState } from "react";
import { Pagination, REDESIGN_TOKENS as T } from "@/Components/Redesign";
import { useTd } from "@/Hooks/useDynamicTranslation";
import type { PartnerFlagThreadItem } from "../types";

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

const PAGE_SIZE = 7;

const STATUS_LABEL: Record<string, string> = {
    open: "Waiting for a reply",
    acknowledged: "Acknowledged",
    resolved: "Replied",
};

/** The flag thread. Raising one happens from the button beside the card title. */
export default function ReferralFlagsCard({
    flags,
}: {
    flags: PartnerFlagThreadItem[];
}) {
    const { td } = useTd();
    const [page, setPage] = useState(1);
    const totalPages = Math.max(1, Math.ceil(flags.length / PAGE_SIZE));
    const safePage = Math.min(page, totalPages);
    const pageFlags = flags.slice(
        (safePage - 1) * PAGE_SIZE,
        safePage * PAGE_SIZE,
    );

    if (!flags.length) {
        return (
            <p style={{ margin: 0, padding: "16px 18px", fontSize: 14, color: T.TEXT_MUTED }}>
                {td("No flags yet.", { source: "en" })}
            </p>
        );
    }

    return (
        <div
            style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                minHeight: 0,
            }}
        >
            <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
                {pageFlags.map((flag, index) => (
                <div
                    key={flag.id}
                    style={{
                        padding: "12px 18px",
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
                            {td(STATUS_LABEL[flag.status] ?? flag.status, {
                                source: "en",
                            })}
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
                ))}
            </div>
            <Pagination
                page={safePage}
                pageSize={PAGE_SIZE}
                totalItems={flags.length}
                onPageChange={setPage}
                onPageSizeChange={() => undefined}
                showPageSize={false}
                itemLabel="flag"
                itemLabelPlural="flags"
            />
        </div>
    );
}
