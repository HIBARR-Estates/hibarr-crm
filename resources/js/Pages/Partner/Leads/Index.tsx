import { useState } from "react";
import { Deferred, router } from "@inertiajs/react";
import DashboardLayout from "@/Components/DashboardLayout";
import PageLayout from "@/Components/PageLayout";
import {
    Badge,
    Button,
    EmptyState,
    REDESIGN_TOKENS as T,
    REDESIGN_TYPE as TYPE,
} from "@/Components/Redesign";
import "@/Components/Redesign/redesign.css";
import { useTd } from "@/Hooks/useDynamicTranslation";
import LeadDetailModal from "./components/LeadDetailModal";
import StatusDot from "./components/StatusDot";
import usePartnerLeadDetail from "./hooks/usePartnerLeadDetail";
import type { PartnerLeadRow, PartnerLeadsPage } from "./types";

interface Props {
    pageTitle: string;
    /** Deferred: null for an account with no partner record. */
    leads?: PartnerLeadsPage | null;
    hasAgent: boolean;
}

function RowsSkeleton() {
    return (
        <div>
            {Array.from({ length: 5 }).map((_, index) => (
                <div
                    key={index}
                    className="dr-card"
                    style={{ height: 64, opacity: 0.6 }}
                    aria-hidden
                />
            ))}
        </div>
    );
}

function LeadRow({ lead, onOpen }: { lead: PartnerLeadRow; onOpen: () => void }) {
    const { td } = useTd();

    return (
        <button
            type="button"
            onClick={onOpen}
            className="dr-card"
            style={{
                width: "100%",
                textAlign: "left",
                display: "flex",
                alignItems: "center",
                gap: 16,
                cursor: "pointer",
            }}
        >
            <div style={{ minWidth: 0, flex: 1 }}>
                <div
                    className="truncate"
                    style={{ fontSize: TYPE.BODY_LG, fontWeight: 600, color: T.TEXT }}
                >
                    {lead.name ?? "—"}
                </div>
                <div style={{ marginTop: 4 }}>
                    {lead.status ? (
                        <StatusDot label={lead.status.label} color={lead.status.color} />
                    ) : (
                        <span style={{ fontSize: 13, color: T.TEXT_HINT }}>
                            {td("No status yet", { source: "en" })}
                        </span>
                    )}
                </div>
            </div>

            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, justifyContent: "flex-end" }}>
                {lead.active_deals === 0 ? (
                    <span style={{ fontSize: 13, color: T.TEXT_HINT }}>
                        {td("No active deals", { source: "en" })}
                    </span>
                ) : (
                    <>
                        <Badge variant="blue">
                            {lead.active_deals === 1
                                ? td("1 active deal", { source: "en" })
                                : td(":count active deals", { source: "en" }).replace(
                                      ":count",
                                      String(lead.active_deals),
                                  )}
                        </Badge>
                        {lead.active_deal_statuses.map((stage) => (
                            <StatusDot key={stage.name} label={stage.name} color={stage.color} />
                        ))}
                    </>
                )}
            </div>
        </button>
    );
}

const PartnerLeadsIndex = ({ pageTitle, leads, hasAgent }: Props) => {
    const { td } = useTd();
    const { detail, loading, error, open, close } = usePartnerLeadDetail();
    // Which lead's modal is open; the detail itself lives in usePartnerLeadDetail.
    const [openId, setOpenId] = useState<number | null>(null);

    const show = (id: number) => {
        setOpenId(id);
        open(id);
    };

    const hide = () => {
        setOpenId(null);
        close();
    };

    const go = (page: number) =>
        router.get(route("partner.leads.index"), { page }, { preserveState: true, only: ["leads"] });

    return (
        <PageLayout title={pageTitle} breadcrumbs={[{ name: td("My leads", { source: "en" }) }]}>
            <div className="mx-auto flex w-full max-w-[1100px] flex-col gap-4">
                <div style={{ fontSize: 13, color: T.TEXT_MUTED }}>
                    {td(
                        "The leads you referred. Contact details are not shown. Deals that pay you no commission are left out.",
                        { source: "en" },
                    )}
                </div>

                {!hasAgent ? (
                    <EmptyState
                        title={td("No partner record", { source: "en" })}
                        description={td("This account is not set up as a partner yet.", { source: "en" })}
                    />
                ) : (
                    <Deferred data="leads" fallback={<RowsSkeleton />}>
                        {!leads || leads.data.length === 0 ? (
                            <EmptyState
                                title={td("No referrals yet", { source: "en" })}
                                description={td("Leads you refer will appear here.", { source: "en" })}
                            />
                        ) : (
                            <>
                                <div>
                                    {leads.data.map((lead) => (
                                        <LeadRow key={lead.id} lead={lead} onOpen={() => show(lead.id)} />
                                    ))}
                                </div>

                                {leads.last_page > 1 && (
                                    <div className="flex items-center justify-between">
                                        <span style={{ fontSize: TYPE.CAPTION, color: T.TEXT_MUTED }}>
                                            {leads.from}–{leads.to} {td("of", { source: "en" })} {leads.total}
                                        </span>
                                        <div className="flex gap-2">
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                disabled={leads.current_page <= 1}
                                                onClick={() => go(leads.current_page - 1)}
                                            >
                                                {td("Previous", { source: "en" })}
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                disabled={leads.current_page >= leads.last_page}
                                                onClick={() => go(leads.current_page + 1)}
                                            >
                                                {td("Next", { source: "en" })}
                                            </Button>
                                        </div>
                                    </div>
                                )}
                            </>
                        )}
                    </Deferred>
                )}
            </div>

            <LeadDetailModal
                open={openId !== null}
                detail={detail}
                loading={loading}
                error={error}
                onClose={hide}
            />
        </PageLayout>
    );
};

PartnerLeadsIndex.layout = (page: React.ReactNode) => <DashboardLayout>{page}</DashboardLayout>;

export default PartnerLeadsIndex;
