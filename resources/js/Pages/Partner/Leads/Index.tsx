import { useState } from "react";
import { Deferred } from "@inertiajs/react";
import DashboardLayout from "@/Components/DashboardLayout";
import PageLayout from "@/Components/PageLayout";
import {
    Badge,
    Button,
    EmptyState,
    REDESIGN_TOKENS as T,
    REDESIGN_TYPE as TYPE,
} from "@/Components/Redesign";
import EntityListHeader from "@/Components/Redesign/primitives/EntityListHeader";
import "@/Components/Redesign/redesign.css";
import { useTd } from "@/Hooks/useDynamicTranslation";
import LeadDetailModal from "./components/LeadDetailModal";
import StatusDot from "./components/StatusDot";
import usePartnerLeadDetail from "./hooks/usePartnerLeadDetail";
import usePartnerLeadFilters from "./hooks/usePartnerLeadFilters";
import type { PartnerLeadFilters, PartnerLeadOptions, PartnerLeadRow, PartnerLeadsPage } from "./types";

interface Props {
    pageTitle: string;
    filters: PartnerLeadFilters;
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

const NO_OPTIONS: PartnerLeadOptions = { statuses: [], stages: [] };

const PartnerLeadsIndex = ({ pageTitle, filters: initialFilters, leads, hasAgent }: Props) => {
    const { td } = useTd();
    const { detail, loading, error, open, close } = usePartnerLeadDetail();
    // Which lead's modal is open; the detail itself lives in usePartnerLeadDetail.
    const [openId, setOpenId] = useState<number | null>(null);
    const { filters, searchText, setSearchText, setFilter, clear, goToPage, activeCount, busy } =
        usePartnerLeadFilters(initialFilters);

    const options = leads?.options ?? NO_OPTIONS;

    const show = (id: number) => {
        setOpenId(id);
        open(id);
    };

    const hide = () => {
        setOpenId(null);
        close();
    };

    const title = td("Referred leads", { source: "en" });

    const controls = hasAgent ? (
        <div className="flex flex-wrap items-center gap-2" style={{ width: "100%" }}>
            <input
                className="dr-input"
                type="search"
                style={{ minWidth: 220, flex: "1 1 220px", maxWidth: 320 }}
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                placeholder={td("Search by name…", { source: "en" })}
                aria-label={td("Search leads by name", { source: "en" })}
            />
            <select
                className="dr-input"
                style={{ width: "auto" }}
                value={filters.status ?? ""}
                onChange={(e) => setFilter("status", e.target.value === "" ? null : Number(e.target.value))}
                aria-label={td("Filter by status", { source: "en" })}
            >
                <option value="">{td("All statuses", { source: "en" })}</option>
                {options.statuses.map((status) => (
                    <option key={status.id} value={status.id}>
                        {status.label}
                    </option>
                ))}
            </select>
            <select
                className="dr-input"
                style={{ width: "auto" }}
                value={filters.deals ?? ""}
                onChange={(e) => setFilter("deals", (e.target.value || null) as PartnerLeadFilters["deals"])}
                aria-label={td("Filter by active deals", { source: "en" })}
            >
                <option value="">{td("Any deals", { source: "en" })}</option>
                <option value="with">{td("With active deals", { source: "en" })}</option>
                <option value="without">{td("No active deals", { source: "en" })}</option>
            </select>
            <select
                className="dr-input"
                style={{ width: "auto" }}
                value={filters.stage ?? ""}
                onChange={(e) => setFilter("stage", e.target.value || null)}
                aria-label={td("Filter by deal status", { source: "en" })}
            >
                <option value="">{td("All deal statuses", { source: "en" })}</option>
                {options.stages.map((stage) => (
                    <option key={stage} value={stage}>
                        {stage}
                    </option>
                ))}
            </select>
            {activeCount > 0 && (
                <Button variant="ghost" size="sm" onClick={clear}>
                    {td("Clear filters", { source: "en" })}
                </Button>
            )}
        </div>
    ) : undefined;

    return (
        <PageLayout title={pageTitle} breadcrumbs={[{ name: title }]} mainContentClassName="p-0">
            <EntityListHeader
                title={title}
                subtitle={td("The leads you have referred, with their status and active deals.", {
                    source: "en",
                })}
                toolbarLeft={controls}
            />

            <div
                className="mx-auto flex w-full max-w-[1100px] flex-col gap-4 px-3 py-4 sm:px-6"
                style={{ opacity: busy ? 0.6 : 1, transition: "opacity .15s" }}
            >
                {!hasAgent ? (
                    <EmptyState
                        title={td("No partner record", { source: "en" })}
                        description={td("This account is not set up as a partner yet.", { source: "en" })}
                    />
                ) : (
                    <Deferred data="leads" fallback={<RowsSkeleton />}>
                        {!leads || leads.data.length === 0 ? (
                            activeCount > 0 ? (
                                <EmptyState
                                    title={td("No leads match", { source: "en" })}
                                    description={td("Try a different search or clear the filters.", { source: "en" })}
                                />
                            ) : (
                                <EmptyState
                                    title={td("No referrals yet", { source: "en" })}
                                    description={td("Leads you refer will appear here.", { source: "en" })}
                                />
                            )
                        ) : (
                            <>
                                <div>
                                    {leads.data.map((lead) => (
                                        <LeadRow key={lead.id} lead={lead} onOpen={() => show(lead.id)} />
                                    ))}
                                </div>

                                <div className="flex items-center justify-between">
                                    <span style={{ fontSize: TYPE.CAPTION, color: T.TEXT_MUTED }}>
                                        {leads.from}–{leads.to} {td("of", { source: "en" })} {leads.total}
                                    </span>
                                    {leads.last_page > 1 && (
                                        <div className="flex gap-2">
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                disabled={leads.current_page <= 1}
                                                onClick={() => goToPage(leads.current_page - 1)}
                                            >
                                                {td("Previous", { source: "en" })}
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                disabled={leads.current_page >= leads.last_page}
                                                onClick={() => goToPage(leads.current_page + 1)}
                                            >
                                                {td("Next", { source: "en" })}
                                            </Button>
                                        </div>
                                    )}
                                </div>
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
