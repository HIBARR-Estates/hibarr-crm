import { useMemo, useState } from "react";
import { usePage } from "@inertiajs/react";
import { Dropdown, type MenuProps } from "antd";
import type { PageProps } from "@/Components/DashboardLayout";
import { AgentCardControls, AgentCardFilters, AgentCardSearch, matchesCardSearch } from "@/Components/Redesign/agent";
import Button from "@/Components/Redesign/primitives/Button";
import Icon from "@/Components/Redesign/primitives/Icon";
import { useTd } from "@/Hooks/useDynamicTranslation";
import useTranslation from "@/Hooks/useTranslation";
import { isDealEffectivelyLocked } from "@/lib/dealOutcome";
import {
    canManageDealExposes,
    downloadDealExpose,
    exposeStatusMeta,
    formatExposeDate,
} from "@/Pages/Deals/Redesign/adapters/dealExposeAdapter";
import AddExposeModal from "@/Pages/Deals/Redesign/components/workspace/AddExposeModal";
import useDealExposes from "@/Pages/Deals/Redesign/hooks/useDealExposes";
import type { AppPermission } from "@/Types/permission";
import type { Deal } from "@/Types/api/deals";
import type { DealExposeStatus } from "@/Types/api/dealExposes";
import SectionCard, { SectionEmpty, SectionNoMatch, SectionSkeleton } from "./SectionCard";

type ExposeFilter = "all" | "sent" | "not_sent";
const STATUS_PILL: Record<DealExposeStatus, string> = { not_sent: "gray", shown: "blue", accepted: "green", not_accepted: "red" };

/**
 * What the buyer has been shown: the deal's exposés, each with its status
 * (canvas L8-04). Its own card now; flights are a separate one. Adds through
 * the deal page's own dialog.
 */
export default function ExposesSection({ deal, canEdit }: { deal: Deal; canEdit: boolean }) {
    const { t } = useTranslation();
    const { td } = useTd();
    const { props: pageProps } = usePage<PageProps>();
    const permissions = pageProps.auth?.permissions as AppPermission | undefined;
    const { exposes, loading, saving, isUploadingFile, uploadProgress, uploadBytesLoaded, uploadBytesTotal, cancelUpload, addExpose } =
        useDealExposes({ type: "deal", dealId: deal.id });
    const [addSource, setAddSource] = useState<"linked" | "manual" | null>(null);
    const [query, setQuery] = useState("");
    const [filter, setFilter] = useState<ExposeFilter>("all");

    const editable = canEdit && !isDealEffectivelyLocked(deal) && canManageDealExposes(permissions);
    const currencySymbol = deal.currency?.currency_symbol || "£";
    const hasBoth = useMemo(
        () => exposes.some((expose) => expose.status === "not_sent") && exposes.some((expose) => expose.status !== "not_sent"),
        [exposes],
    );
    const shown = exposes.filter((expose) => {
        if (filter === "sent" && expose.status === "not_sent") return false;
        if (filter === "not_sent" && expose.status !== "not_sent") return false;
        return matchesCardSearch(query, expose.title);
    });

    const addMenu: MenuProps["items"] = [
        { key: "linked", label: t("pages.deals.workspace.exposes.add_linked") },
        { key: "manual", label: t("pages.deals.workspace.exposes.add_manual") },
    ];

    return (
        <SectionCard
            id="deal-exposes"
            title={
                <>
                    {t("pages.agent_workspace.deal.exposes.title")}
                    {exposes.length > 0 ? <span className="agent-card__count"> · {exposes.length}</span> : null}
                </>
            }
            action={
                editable ? (
                    <Dropdown menu={{ items: addMenu, onClick: ({ key }) => setAddSource(key as "linked" | "manual") }} trigger={["click"]}>
                        <span className="agent-contact__menu-anchor">
                            <Button size="sm" className="agent-btn-soft" aria-haspopup="menu">
                                <Icon name="plus" size={12} />
                                {t("pages.agent_workspace.deal.exposes.add")}
                                <Icon name="chevron-down" size={12} />
                            </Button>
                        </span>
                    </Dropdown>
                ) : null
            }
            controls={
                exposes.length > 0 ? (
                    <AgentCardControls>
                        <AgentCardSearch value={query} onChange={setQuery} placeholder={t("pages.agent_workspace.deal.exposes.search")} />
                        {hasBoth ? (
                            <AgentCardFilters<ExposeFilter>
                                value={filter}
                                onChange={setFilter}
                                label={t("pages.agent_workspace.contact.cards.filter_aria")}
                                options={[
                                    { value: "all", label: t("pages.agent_workspace.contact.cards.all") },
                                    { value: "sent", label: t("pages.agent_workspace.deal.exposes.sent") },
                                    { value: "not_sent", label: t("pages.agent_workspace.deal.exposes.not_sent") },
                                ]}
                            />
                        ) : null}
                    </AgentCardControls>
                ) : null
            }
        >
            {loading && exposes.length === 0 ? (
                <SectionSkeleton />
            ) : exposes.length === 0 ? (
                <SectionEmpty>{t("pages.agent_workspace.deal.exposes.empty")}</SectionEmpty>
            ) : shown.length === 0 ? (
                <SectionNoMatch />
            ) : (
                <ul className="agent-deal__rows">
                    {shown.map((expose) => {
                        const meta = exposeStatusMeta(expose.status);
                        return (
                            <li key={expose.id}>
                                <button
                                    type="button"
                                    className="agent-deal__row agent-deal__row--expose"
                                    onClick={() => downloadDealExpose(expose)}
                                    disabled={!expose.download_url}
                                >
                                    <span className="agent-deal__thumb" aria-hidden="true">
                                        <Icon name="building" size={20} />
                                    </span>
                                    <span className="agent-deal__row-body">
                                        <span className="agent-deal__row-title">{expose.title}</span>
                                        <span className="agent-deal__row-sub">{formatExposeDate(expose)}</span>
                                    </span>
                                    <span className={`dr-pill dr-pill-${STATUS_PILL[expose.status] ?? "gray"}`}>{td(meta.label, { source: "en" })}</span>
                                </button>
                            </li>
                        );
                    })}
                </ul>
            )}

            {addSource ? (
                <AddExposeModal
                    open
                    source={addSource}
                    dealId={deal.id}
                    currencySymbol={currencySymbol}
                    saving={saving}
                    isUploadingFile={isUploadingFile}
                    uploadProgress={uploadProgress}
                    uploadBytesLoaded={uploadBytesLoaded}
                    uploadBytesTotal={uploadBytesTotal}
                    onCancelUpload={cancelUpload}
                    onSubmit={async (input) => {
                        const failure = await addExpose(input);
                        if (failure === null) setAddSource(null);
                        return failure;
                    }}
                    onClose={() => setAddSource(null)}
                />
            ) : null}
        </SectionCard>
    );
}
