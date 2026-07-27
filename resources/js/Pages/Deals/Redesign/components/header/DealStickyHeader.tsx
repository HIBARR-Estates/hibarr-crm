import { useState } from "react";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import { Deal } from "@/Types/api/deals";
import { useTd } from "@/Hooks/useDynamicTranslation";
import useTranslation from "@/Hooks/useTranslation";
import { useDealPermissions } from "@/Hooks/useDealPermissions";
import { resolveDealOutcome } from "@/lib/dealOutcome";
import DeleteDeal from "@/Features/Deals/DeleteDeal";
import { router } from "@inertiajs/react";
import useDealHeaderData from "../../hooks/useDealHeaderData";
import useDealTeam from "../../hooks/useDealTeam";
import { DEAL_REDESIGN_TOKENS as T } from "../../tokens";
import DealAvatar from "../primitives/DealAvatar";
import DealButton from "../primitives/DealButton";
import DealIcon from "../primitives/DealIcon";
import DealValueBlock from "../primitives/DealValueBlock";
import DealActionsMenu from "./DealActionsMenu";
import DealAgentCard from "./DealAgentCard";
import DealTeamModal from "./DealTeamModal";

dayjs.extend(relativeTime);

interface DealStickyHeaderProps {
    deal: Deal;
    permissions: Record<string, string>;
    employees: any[];
    isRefreshing: boolean;
    onRefresh: () => void;
    onAddNote: () => void;
    onAddTask: () => void;
    onScheduleMeeting: () => void;
    onReplayGuide?: () => void;
}

export default function DealStickyHeader({
    deal,
    permissions,
    employees,
    isRefreshing,
    onRefresh,
    onAddNote,
    onAddTask,
    onScheduleMeeting,
    onReplayGuide,
}: DealStickyHeaderProps) {
    const { td } = useTd();
    const { t } = useTranslation();
    const header = useDealHeaderData(deal);
    const team = useDealTeam(deal);
    const dealPermissions = useDealPermissions(deal);
    const [deleteOpen, setDeleteOpen] = useState(false);

    const outcome = resolveDealOutcome(deal);
    const isLocked = !!deal.is_locked || outcome === "won";
    const createdRel = deal.created_at ? dayjs(deal.created_at).fromNow() : "--";
    const updatedRel = deal.updated_at ? dayjs(deal.updated_at).fromNow() : "--";

    return (
        <div data-tour="deal-sticky-header">
            {isLocked && (
                <div
                    role="alert"
                    className="mb-4 w-full flex items-center gap-2.5 rounded-[10px] px-3.5 py-2.5 text-[13px] font-medium"
                    style={{
                        background: T.AMBER_BANNER,
                        border: "1px solid #fde68a",
                        color: T.AMBER,
                    }}
                >
                    <DealIcon name="info" size={15} />
                    {!deal.is_locked && outcome === "won"
                        ? t("pages.deals.locked_message_won")
                        : t("pages.deals.locked_message")}
                </div>
            )}

            <div className="">
                <div className="flex flex-wrap items-start justify-between gap-6">
                    <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                            <h1 className="text-[20px] font-bold tracking-[-0.01em] text-[#1a1f2e]">
                                {td(header.title)}
                            </h1>
                            {outcome && (
                                <span
                                    className={`dr-pill ${
                                        outcome === "won"
                                            ? "dr-pill-green"
                                            : "dr-pill-red"
                                    }`}
                                >
                                    {outcome === "won"
                                        ? t("pages.deals.header.won")
                                        : t("pages.deals.header.lost")}
                                </span>
                            )}
                            {isLocked && (
                                <span className="dr-pill dr-pill-amber">
                                    {t("pages.deals.header.locked")}
                                </span>
                            )}
                            <DealActionsMenu
                                onAddNote={onAddNote}
                                onAddTask={onAddTask}
                                onScheduleMeeting={onScheduleMeeting}
                                onDelete={() => setDeleteOpen(true)}
                                onReplayGuide={onReplayGuide}
                                canDelete={dealPermissions.canDelete}
                                canAddNote={
                                    !dealPermissions.isWatcherOnly &&
                                    (permissions.add_deal_note === "all" ||
                                        permissions.add_deal_note === "added" ||
                                        permissions.add_deal_note === "both")
                                }
                                canAddTask={
                                    !dealPermissions.isWatcherOnly &&
                                    (permissions.add_tasks === "all" ||
                                        permissions.add_tasks === "added" ||
                                        permissions.add_tasks === "both")
                                }
                                canScheduleMeeting={
                                    !dealPermissions.isWatcherOnly &&
                                    (permissions.add_lead_follow_up === "all" ||
                                        permissions.add_lead_follow_up ===
                                            "added")
                                }
                            />
                            <DealButton
                                variant="ghost"
                                size="sm"
                                onClick={onRefresh}
                                disabled={isRefreshing}
                            >
                                {isRefreshing
                                    ? t("pages.deals.common.refreshing")
                                    : t("pages.deals.common.refresh")}
                            </DealButton>
                        </div>

                        <div className="mt-1 text-xs text-[#5b6472]">
                            {t("pages.deals.header.created_label")} {createdRel} ·{" "}
                            {t("pages.deals.header.updated_label")} {updatedRel}
                        </div>

                        <div className="mt-2 flex flex-wrap items-center gap-2">
                            <span className="text-xs text-[#5b6472]">
                                {t("pages.deals.header.participants_label")}
                            </span>
                            {team.participants.length === 0 && (
                                <span className="text-xs italic text-[#5b6472]">
                                    {t("pages.deals.common.none")}
                                </span>
                            )}
                            {team.participants.map((participant) => (
                                <span
                                    key={participant.id}
                                    className="inline-flex items-center gap-1.5 rounded-full border border-[#e2e5ea] bg-white py-[3px] pl-1 pr-2.5"
                                >
                                    <DealAvatar
                                        type="participant"
                                        size={20}
                                        initials={participant.initials}
                                    />
                                    <span className="text-xs font-medium">
                                        {participant.name}
                                    </span>
                                </span>
                            ))}
                            <span className="ml-1 text-xs text-[#5b6472]">
                                {t("pages.deals.header.watchers_label")}
                            </span>
                            {team.watchers.length === 0 && (
                                <span className="text-xs italic text-[#5b6472]">
                                    {t("pages.deals.common.none")}
                                </span>
                            )}
                            {team.watchers.map((watcher) => (
                                <span
                                    key={watcher.id}
                                    className="inline-flex items-center gap-1.5 rounded-full border border-[#e2e5ea] bg-white py-[3px] pl-1 pr-2.5"
                                >
                                    <DealAvatar
                                        type="watcher"
                                        size={20}
                                        initials={watcher.initials}
                                    />
                                    <span className="text-xs font-medium text-[#5b6472]">
                                        {watcher.name}
                                    </span>
                                </span>
                            ))}
                            <DealButton
                                variant="ghost"
                                size="sm"
                                onClick={() => team.setTeamModalOpen(true)}
                            >
                                {t("pages.deals.header.manage_team")}
                            </DealButton>
                        </div>
                    </div>

                    <div className="flex items-start gap-[18px]">
                        <div data-tour="deal-value">
                            <DealValueBlock deal={deal} canEdit={dealPermissions.canEdit} />
                        </div>
                        {deal.close_date && (
                            <div className="flex flex-col items-start">
                                <span className="text-xs text-[#5b6472]">
                                    {t("pages.deals.info.fields.close_date")}
                                </span>
                                <span className="text-sm font-semibold text-[#1a1f2e]">
                                    {header.closeDate}
                                </span>
                            </div>
                        )}
                        <DealAgentCard
                            dealId={deal.id}
                            agent={team.agent}
                            canEdit={dealPermissions.canEdit}
                            onManageTeam={() => team.setTeamModalOpen(true)}
                        />
                    </div>
                </div>
            </div>

            <DealTeamModal
                open={team.teamModalOpen}
                onClose={() => team.setTeamModalOpen(false)}
                dealId={deal.id}
                agent={team.agent}
                participants={team.participants}
                watchers={team.watchers}
                employees={employees ?? []}
                canEdit={dealPermissions.canEdit}
            />

            <DeleteDeal
                open={deleteOpen}
                onClose={() => setDeleteOpen(false)}
                deal={deal}
                handleSuccessCallback={() => router.visit(route("deals.index"))}
            />
        </div>
    );
}
