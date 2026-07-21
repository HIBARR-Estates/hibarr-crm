import { useMemo, useState } from "react";
import { usePage } from "@inertiajs/react";
import { useTd } from "@/Hooks/useDynamicTranslation";
import useTranslation from "@/Hooks/useTranslation";
import { useApiMutate } from "@/lib/api/client";
import type { ApiResponse } from "@/lib/api/types";
import { isLoading } from "@/lib/utils";
import type { Deal } from "@/Types/api/deals";
import type { DealFollowup } from "@/Types/api/deal-followup";
import ViewFollowup from "@/Pages/Deals/Components/Tabs/followups/ViewFollowup";
import {
    getMeetingStatusTone,
    toWorkspaceMeetingListItem,
} from "../../adapters/meetingListAdapter";
import DealBulkActionBar from "../primitives/DealBulkActionBar";
import DealButton from "../primitives/DealButton";
import DealConfirmDialog from "../primitives/DealConfirmDialog";
import DealIcon from "../primitives/DealIcon";
import DealSelectCheckbox from "../primitives/DealSelectCheckbox";
import { DEAL_REDESIGN_TOKENS as T } from "../../tokens";
import DealMeetingDetailModal from "./DealMeetingDetailModal";
import { useDealWorkspace } from "../../context/DealWorkspaceContext";

interface WorkspaceMeetingsTabProps {
    deal: Deal;
    followUps: DealFollowup[];
    meetingTypes: Array<{ id: number; name: string; color?: string }>;
    permissions: Record<string, string>;
    onScheduleMeeting: () => void;
}

function canAddMeeting(
    permissions: Record<string, string>,
    deal: Deal,
): boolean {
    const canAdd =
        permissions.add_lead_follow_up === "all" ||
        permissions.add_lead_follow_up === "added";
    const closedStage =
        deal.lead_stage?.slug === "win" || deal.lead_stage?.slug === "lost";

    return canAdd && !closedStage && deal.next_follow_up !== "no";
}

function canEditMeeting(
    permissions: Record<string, string>,
    followup: DealFollowup,
    userId?: number,
): boolean {
    return (
        permissions.edit_lead_follow_up === "all" ||
        (permissions.edit_lead_follow_up === "added" &&
            followup.added_by?.id === userId)
    );
}

function canDeleteMeeting(
    permissions: Record<string, string>,
    followup: DealFollowup,
    userId?: number,
): boolean {
    if (!followup.added_by) return false;

    return (
        permissions.delete_lead_follow_up === "all" ||
        (permissions.delete_lead_follow_up === "added" &&
            followup.added_by?.id === userId)
    );
}

/** v2.2 status pill tones (deal-v2-2.jsx:2293). */

const PLATFORM_PILL: Record<string, string> = {
    blue: "dr-pill-blue",
    green: "dr-pill-green",
    gray: "dr-pill-gray",
};

/** v2.2 MeetingsTab (deal-v2-2.jsx:2285-2414): clickable cards opening the
 * detail modal, select mode with bulk complete/cancel, tone-mapped pills. */
export default function WorkspaceMeetingsTab({
    deal,
    followUps,
    meetingTypes,
    permissions,
    onScheduleMeeting,
}: WorkspaceMeetingsTabProps) {
    const { td } = useTd();
    const { t } = useTranslation();
    const { props } = usePage();
    const userId = props.auth?.user?.id;
    const { setDealFollowUps } = useDealWorkspace();
    const [selectMode, setSelectMode] = useState(false);
    const [selected, setSelected] = useState<Set<number>>(() => new Set());
    const [confirmBulkCancel, setConfirmBulkCancel] = useState(false);
    const [detailFollowupId, setDetailFollowupId] = useState<number | null>(
        null,
    );
    const [summaryFollowupId, setSummaryFollowupId] = useState<number | null>(
        null,
    );

    const detailFollowup =
        followUps.find((followup) => followup.id === detailFollowupId) ?? null;
    const summaryFollowup =
        followUps.find((followup) => followup.id === summaryFollowupId) ?? null;

    const { mutate: applyBulkAction, status: bulkStatus } = useApiMutate<
        { row_ids: string; action_type: string; status: string },
        null,
        ApiResponse<null>
    >("/account/deals/follow-up-apply-quick-action", "POST");
    const isBulkUpdating = isLoading({ status: bulkStatus });

    const meetings = useMemo(
        () => followUps.map((followup) => toWorkspaceMeetingListItem(followup)),
        [followUps],
    );

    const upcoming = useMemo(
        () => meetings.filter((meeting) => meeting.isUpcoming),
        [meetings],
    );
    const past = useMemo(
        () => meetings.filter((meeting) => meeting.isPast),
        [meetings],
    );

    const showSchedule = canAddMeeting(permissions, deal);
    // Bulk status changes act across authors, so only the full scope gets them.
    const canBulkEdit = permissions.edit_lead_follow_up === "all";

    const toggleSelect = (id: number) =>
        setSelected((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    const exitSelect = () => {
        setSelectMode(false);
        setSelected(new Set());
    };
    const allIds = meetings.map((meeting) => meeting.id);
    const allSelected =
        allIds.length > 0 && allIds.every((id) => selected.has(id));
    const toggleAll = () =>
        setSelected(allSelected ? new Set() : new Set(allIds));

    const applyBulkStatus = (status: string, onDone?: () => void) => {
        applyBulkAction(
            {
                row_ids: Array.from(selected).join(","),
                action_type: "change-status",
                status,
            },
            {
                onSuccess: () => {
                    setDealFollowUps((prev) =>
                        prev.map((followup) =>
                            selected.has(followup.id)
                                ? { ...followup, status }
                                : followup,
                        ),
                    );
                    onDone?.();
                    exitSelect();
                },
            },
        );
    };

    return (
        <>
            <div className="mb-3.5 flex items-center justify-between gap-3">
                <span className="text-xs text-[#5b6472]">
                    {upcoming.length} {t("pages.deals.workspace.meetings.upcoming_label")} ·{" "}
                    {past.length} {t("pages.deals.workspace.meetings.past_label")}
                </span>
                <div className="flex gap-1.5">
                    {meetings.length > 0 && canBulkEdit && (
                        <DealButton
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                                selectMode ? exitSelect() : setSelectMode(true)
                            }
                        >
                            {selectMode ? t("pages.deals.common.cancel") : t("pages.deals.common.select")}
                        </DealButton>
                    )}
                    {showSchedule && (
                        <DealButton
                            variant="primary"
                            size="sm"
                            onClick={onScheduleMeeting}
                        >
                            + {t("pages.deals.workspace.meetings.schedule")}
                        </DealButton>
                    )}
                </div>
            </div>

            {selectMode && (
                <DealBulkActionBar
                    count={selected.size}
                    onClear={() => setSelected(new Set())}
                    clearLabel={t("pages.deals.common.clear")}
                >
                    <button
                        type="button"
                        className="dr-btn dr-btn-sm"
                        style={{ background: T.WHITE, color: T.NAVY }}
                        onClick={toggleAll}
                    >
                        {allSelected
                            ? t("pages.deals.common.deselect_all")
                            : t("pages.deals.common.select_all")}
                    </button>
                    <button
                        type="button"
                        className="dr-btn dr-btn-sm"
                        style={{ background: T.RED, color: T.WHITE }}
                        disabled={!selected.size || isBulkUpdating}
                        onClick={() => setConfirmBulkCancel(true)}
                    >
                        {t("pages.deals.workspace.meetings.cancel_meetings")}
                    </button>
                </DealBulkActionBar>
            )}

            {meetings.length === 0 ? (
                <div className="rounded-lg border border-[#e2e5ea] bg-white px-5 py-9 text-center">
                    <DealIcon
                        name="calendar"
                        size={28}
                        color={T.TEXT_HINT}
                        className="mx-auto mb-2 opacity-50"
                    />
                    <p className="mb-3 text-[13px] text-[#9ca3af]">
                        {t("pages.deals.workspace.meetings.empty")}
                    </p>
                    {showSchedule && (
                        <DealButton
                            variant="primary"
                            size="sm"
                            onClick={onScheduleMeeting}
                        >
                            + {t("pages.deals.workspace.meetings.schedule")}
                        </DealButton>
                    )}
                </div>
            ) : (
                ([
                    { label: "Upcoming" as const, items: upcoming },
                    { label: "Past" as const, items: past },
                ] as const)
                    .filter((section) => section.items.length > 0)
                    .map((section) => {
                        const isPastSection = section.label === "Past";
                        return (
                            <section key={section.label} className="mb-2">
                                <div className="dr-label mb-2">
                                    {section.label === "Upcoming"
                                        ? t("pages.deals.workspace.meetings.section_upcoming")
                                        : t("pages.deals.workspace.meetings.section_past")}
                                </div>
                                {section.items.map((meeting) => (
                                    <div
                                        key={meeting.id}
                                        className="dr-card flex items-start gap-2.5"
                                        style={{
                                            opacity: isPastSection ? 0.8 : 1,
                                        }}
                                    >
                                        {selectMode && (
                                            <div className="pt-0.5">
                                                <DealSelectCheckbox
                                                    checked={selected.has(
                                                        meeting.id,
                                                    )}
                                                    onChange={() =>
                                                        toggleSelect(meeting.id)
                                                    }
                                                    label={`Select meeting ${meeting.title}`}
                                                />
                                            </div>
                                        )}
                                        <button
                                            type="button"
                                            onClick={() =>
                                                selectMode
                                                    ? toggleSelect(meeting.id)
                                                    : setDetailFollowupId(
                                                          meeting.id,
                                                      )
                                            }
                                            aria-label={
                                                selectMode
                                                    ? `Select meeting ${meeting.title}`
                                                    : `Open meeting — ${meeting.title}`
                                            }
                                            className="flex min-w-0 flex-1 cursor-pointer gap-3.5 border-none bg-transparent p-0 text-left"
                                            style={{ color: T.TEXT }}
                                        >
                                            <span
                                                className="w-12 shrink-0 rounded-lg border px-1.5 py-2 text-center"
                                                style={{
                                                    background: isPastSection
                                                        ? T.SURFACE_2
                                                        : T.BLUE_LIGHT,
                                                    borderColor: isPastSection
                                                        ? T.BORDER
                                                        : T.BLUE_MID,
                                                }}
                                            >
                                                <span
                                                    className="block text-[11px] uppercase"
                                                    style={{
                                                        color: T.TEXT_MUTED,
                                                    }}
                                                >
                                                    {meeting.monthLabel}
                                                </span>
                                                <span
                                                    className="block text-base font-bold leading-tight"
                                                    style={{
                                                        color: isPastSection
                                                            ? T.TEXT_MUTED
                                                            : "#14538c",
                                                    }}
                                                >
                                                    {meeting.dayLabel}
                                                </span>
                                            </span>
                                            <span className="min-w-0 flex-1">
                                                <span className="mb-1 flex flex-wrap items-center gap-2">
                                                    <span
                                                        aria-hidden="true"
                                                        className="inline-block h-2 w-2 shrink-0 rounded-full"
                                                        style={{
                                                            background:
                                                                meeting.typeColor ??
                                                                T.TEXT_MUTED,
                                                        }}
                                                        title={`${t(
                                                            "pages.deals.workspace.meetings.meeting_type",
                                                        )}: ${meeting.title}`}
                                                    />
                                                    <span className="text-[13px] font-semibold">
                                                        {meeting.title}
                                                    </span>
                                                    <span
                                                        className={`dr-pill ${
                                                            PLATFORM_PILL[
                                                                meeting
                                                                    .platformBadgeVariant
                                                            ] ?? "dr-pill-gray"
                                                        }`}
                                                    >
                                                        {td(
                                                            meeting.platformLabel,
                                                        )}
                                                    </span>
                                                    <span
                                                        className={`dr-pill ${getMeetingStatusTone(
                                                            meeting.statusLabel,
                                                        )}`}
                                                    >
                                                        {td(
                                                            meeting.statusLabel,
                                                        )}
                                                    </span>
                                                    {meeting.isConcluded &&
                                                        meeting.summaryStatus !==
                                                            "none" &&
                                                        (meeting.summaryStatus ===
                                                        "available" ? (
                                                            <span
                                                                role="button"
                                                                tabIndex={0}
                                                                className="dr-pill dr-pill-teal cursor-pointer"
                                                                onClick={(
                                                                    event,
                                                                ) => {
                                                                    event.stopPropagation();
                                                                    setSummaryFollowupId(
                                                                        meeting.id,
                                                                    );
                                                                }}
                                                                onKeyDown={(
                                                                    event,
                                                                ) => {
                                                                    if (
                                                                        event.key ===
                                                                        "Enter"
                                                                    ) {
                                                                        event.stopPropagation();
                                                                        setSummaryFollowupId(
                                                                            meeting.id,
                                                                        );
                                                                    }
                                                                }}
                                                            >
                                                                {t(
                                                                    "pages.deals.workspace.meetings.view_summary",
                                                                )}
                                                            </span>
                                                        ) : (
                                                            <span className="dr-pill dr-pill-gray">
                                                                {t(
                                                                    "pages.deals.workspace.meetings.ai_summary_pending",
                                                                )}
                                                            </span>
                                                        ))}
                                                </span>
                                                <span
                                                    className="mb-0.5 block truncate text-xs"
                                                    style={{
                                                        color: T.TEXT_MUTED,
                                                    }}
                                                >
                                                    {meeting.timeRangeLabel} ·{" "}
                                                    {meeting.durationMinutes}{" "}
                                                    {t("pages.deals.workspace.meetings.min_label")} ·{" "}
                                                    {td(meeting.locationDisplay)}
                                                </span>
                                                {meeting.attendeesLabel && (
                                                    <span
                                                        className="flex items-center gap-1 text-[11px]"
                                                        style={{
                                                            color: T.TEXT_MUTED,
                                                        }}
                                                    >
                                                        <DealIcon
                                                            name="users"
                                                            size={12}
                                                        />
                                                        <span className="truncate">
                                                            {
                                                                meeting.attendeesLabel
                                                            }
                                                        </span>
                                                    </span>
                                                )}
                                            </span>
                                        </button>
                                    </div>
                                ))}
                            </section>
                        );
                    })
            )}

            <DealMeetingDetailModal
                meeting={detailFollowup}
                deal={deal}
                meetingTypes={meetingTypes}
                canEdit={
                    detailFollowup
                        ? canEditMeeting(permissions, detailFollowup, userId)
                        : false
                }
                canDelete={
                    detailFollowup
                        ? canDeleteMeeting(permissions, detailFollowup, userId)
                        : false
                }
                onClose={() => setDetailFollowupId(null)}
            />

            {summaryFollowup && (
                <ViewFollowup
                    open={!!summaryFollowup}
                    onClose={() => setSummaryFollowupId(null)}
                    followup={summaryFollowup}
                    deal={deal}
                />
            )}

            <DealConfirmDialog
                open={confirmBulkCancel}
                title={`${t("pages.deals.common.cancel")} ${selected.size} ${
                    selected.size === 1
                        ? t("pages.deals.workspace.meetings.item_singular")
                        : t("pages.deals.workspace.meetings.item_plural")
                }?`}
                message={t(
                    "pages.deals.workspace.meetings.cancel_meetings_confirm_message",
                )}
                confirmLabel={t("pages.deals.workspace.meetings.cancel_meetings")}
                danger
                confirmLoading={isBulkUpdating}
                onConfirm={() =>
                    applyBulkStatus("cancelled", () =>
                        setConfirmBulkCancel(false),
                    )
                }
                onCancel={() => setConfirmBulkCancel(false)}
            />
        </>
    );
}
