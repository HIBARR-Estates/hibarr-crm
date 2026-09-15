import { type ReactNode, useState } from "react";
import { router } from "@inertiajs/react";
import { message } from "antd";
import { useTd } from "@/Hooks/useDynamicTranslation";
import useTranslation from "@/Hooks/useTranslation";
import { useUserDateTime } from "@/Hooks/useUserDateTime";
import Avatar from "@/Components/Redesign/primitives/Avatar";
import Button from "@/Components/Redesign/primitives/Button";
import ConfirmDialog from "@/Components/Redesign/primitives/ConfirmDialog";
import Icon from "@/Components/Redesign/primitives/Icon";
import Segmented from "@/Components/Redesign/primitives/Segmented";
import { Modal } from "@/Components/Redesign/primitives/Modal";
import { initialsFromName } from "@/Components/Redesign/adapters/initials";
import {
    REDESIGN_RADIUS as R,
    REDESIGN_TOKENS as T,
} from "@/Components/Redesign/tokens";
import {
    getMeetingStatusDisplay,
    locationAddsDetail,
    toWorkspaceMeetingListItem,
} from "@/Pages/Deals/Redesign/adapters/meetingListAdapter";
import { resolveMeetingDisplayTimezone } from "../adapters/meetingTimeLabel";
import { meetingRecordLink } from "../adapters/meetingViewModel";
import useMeetingAttendanceConfirmationFlag from "@/Hooks/useMeetingAttendanceConfirmationFlag";
import MeetingConfirmationPanel from "./MeetingConfirmationPanel";
import MeetingCalendarSyncRow from "@/Components/Redesign/meeting/MeetingCalendarSyncRow";
import type { DealFollowup } from "@/Types/api/deal-followup";

interface MeetingDetailCompactProps {
    meeting: DealFollowup;
    canEdit: boolean;
    canDelete: boolean;
    userId?: number;
    onClose: () => void;
    onEdit: () => void;
    onDelete: () => void;
    /** The AI summary, shown under the second tab. */
    summaryPanel: ReactNode;
}

type Panel = "info" | "summary" | "confirmation";

/** One icon + label + value line of the details list. */
function InfoRow({
    icon,
    primary,
    secondary,
    action,
}: {
    icon: string;
    primary: ReactNode;
    secondary?: ReactNode;
    action?: ReactNode;
}) {
    return (
        <div
            className="flex items-center gap-3 py-2.5"
            style={{ borderBottom: `1px solid ${T.BORDER_SOFT}` }}
        >
            <span
                aria-hidden="true"
                className="flex h-[30px] w-[30px] shrink-0 items-center justify-center"
                style={{ background: T.SURFACE_2, borderRadius: R.MD }}
            >
                <Icon name={icon} size={15} color={T.TEXT_MUTED} />
            </span>
            <span className="min-w-0 flex-1">
                <span
                    className="block truncate font-semibold height-auto"
                    style={{
                        fontSize: 13.5,
                        color: T.TEXT,
                        lineHeight: "normal",
                    }}
                >
                    {primary}
                </span>
                {secondary && (
                    <span
                        className="mt-px block truncate"
                        style={{ fontSize: 12, color: T.TEXT_MUTED }}
                    >
                        {secondary}
                    </span>
                )}
            </span>
            {action && <span className="shrink-0">{action}</span>}
        </div>
    );
}

/**
 * The compact meeting dialog — the alternative to `MeetingDetailModal`.
 *
 * Same information, arranged as a scannable list of icon/label/value rows
 * rather than stacked panels, so the whole meeting reads at a glance without
 * scrolling. Built entirely from the redesign's own tokens and primitives:
 * the mockup this follows carried its own palette, and a second palette is
 * how a design system stops being one.
 *
 * RSVP state is deliberately absent for everyone but the organiser — the
 * follow-up model records no per-attendee response, and a row of invented
 * "Pending" badges would read as data.
 */
export default function MeetingDetailCompact({
    meeting: meetingProp,
    canEdit,
    canDelete,
    userId,
    onClose,
    onEdit,
    onDelete,
    summaryPanel,
}: MeetingDetailCompactProps) {
    const { td } = useTd();
    const { t } = useTranslation();
    const { formatDate, formatDateTime } = useUserDateTime();
    const [panel, setPanel] = useState<Panel>("info");
    const [confirmDelete, setConfirmDelete] = useState(false);
    const [showAllAttendees, setShowAllAttendees] = useState(false);
    // Patched locally the moment a confirmation saves, so the tab flips to
    // its read-only state right away rather than waiting on the next reload.
    const [confirmationPatch, setConfirmationPatch] =
        useState<Partial<DealFollowup> | null>(null);
    const meeting = confirmationPatch
        ? { ...meetingProp, ...confirmationPatch }
        : meetingProp;
    const showConfirmationTab = useMeetingAttendanceConfirmationFlag();

    const item = toWorkspaceMeetingListItem(meeting);
    const attendees = meeting.participant_users ?? [];
    const ATTENDEES_COLLAPSED_LIMIT = 4;
    const visibleAttendees = showAllAttendees
        ? attendees
        : attendees.slice(0, ATTENDEES_COLLAPSED_LIMIT);
    const hiddenAttendeeCount = attendees.length - visibleAttendees.length;
    const hostId = meeting.host_id ?? meeting.added_by?.id;
    const record = meetingRecordLink(meeting);
    const canConfirmAttendance = Boolean(userId && hostId === userId);

    const copyLink = () => {
        if (!item.meetingLink) return;
        navigator.clipboard
            ?.writeText(item.meetingLink)
            .then(() => message.success(td("Link copied")))
            .catch(() => message.error(td("Could not copy the link")));
    };

    return (
        <>
            <Modal
                open
                onClose={onClose}
                closeOnBackdrop
                // ~56% roomier than the original 460px (two rounds of "make
                // it bigger" — 460 → 600 → 720) — enough for the record name,
                // its stage pill and the attendee rows without wrapping.
                maxWidth={720}
                title={td(item.title)}
                subtitle={
                    <span className="mt-1.5 flex flex-wrap gap-1.5">
                        {(() => {
                            const status = getMeetingStatusDisplay(item);
                            return (
                                <span className={`dr-pill ${status.tone}`}>
                                    <span
                                        aria-hidden="true"
                                        className="rounded-full"
                                        style={{
                                            width: 6,
                                            height: 6,
                                            background: status.dotColor,
                                        }}
                                    />
                                    {td(status.label, { source: "en" })}
                                </span>
                            );
                        })()}
                    </span>
                }
                footer={
                    <>
                        <span style={{ flex: 1 }} />
                        {canDelete && (
                            <Button
                                variant="ghost"
                                style={{ color: T.RED }}
                                onClick={() => setConfirmDelete(true)}
                            >
                                {t("pages.deals.common.delete")}
                            </Button>
                        )}
                        {canEdit && (
                            <Button variant="primary" onClick={onEdit}>
                                {t("pages.deals.common.edit")}
                            </Button>
                        )}
                    </>
                }
            >
                <div className="mb-4">
                    <Segmented<Panel>
                        value={panel}
                        onChange={setPanel}
                        fullWidth
                        variant="raised"
                        ariaLabel={td("Meeting views")}
                        options={[
                            { value: "info", label: td("Meeting info") },
                            { value: "summary", label: td("Summary") },
                            ...(showConfirmationTab
                                ? [
                                      {
                                          value: "confirmation" as const,
                                          label: td("Meeting outcome"),
                                      },
                                  ]
                                : []),
                        ]}
                    />
                </div>

                {panel === "confirmation" ? (
                    <MeetingConfirmationPanel
                        meeting={meeting}
                        canConfirm={canConfirmAttendance}
                        allowEditLogged
                        onSaved={(patch) =>
                            setConfirmationPatch((prev) => ({
                                ...prev,
                                ...patch,
                            }))
                        }
                    />
                ) : panel === "summary" ? (
                    summaryPanel
                ) : (
                    <>
                        <div
                            className="mb-4"
                            style={{ borderTop: `1px solid ${T.BORDER_SOFT}` }}
                        >
                            {record && (
                                <InfoRow
                                    icon={
                                        record.type === "deal"
                                            ? "briefcase"
                                            : "user"
                                    }
                                    primary={
                                        record.href ? (
                                            <button
                                                type="button"
                                                className="dr-meeting-record text-left"
                                                onClick={() =>
                                                    record.href &&
                                                    router.visit(record.href)
                                                }
                                            >
                                                {td(record.name)}
                                            </button>
                                        ) : (
                                            td(record.name)
                                        )
                                    }
                                    secondary={
                                        record.type === "deal"
                                            ? td("Deal")
                                            : td("Lead")
                                    }
                                />
                            )}

                            <InfoRow
                                icon="calendar"
                                primary={formatDate(item.startsAt, "-")}
                                secondary={
                                    meeting.created_at
                                        ? `${td("Created")} ${formatDateTime(meeting.created_at)}`
                                        : undefined
                                }
                            />

                            <InfoRow
                                icon="clock"
                                primary={item.timeRangeLabel}
                                secondary={`${item.durationMinutes} ${t(
                                    "pages.deals.workspace.meetings.min_label",
                                )} · ${resolveMeetingDisplayTimezone(meeting.timezone)}`}
                            />

                            <InfoRow
                                icon={
                                    item.locationType === "video"
                                        ? "video"
                                        : item.locationType === "phone"
                                          ? "phone"
                                          : "map-pin"
                                }
                                primary={td(item.platformLabel, {
                                    source: "en",
                                })}
                                secondary={
                                    locationAddsDetail(item)
                                        ? td(item.locationDisplay)
                                        : undefined
                                }
                                action={
                                    item.meetingLink ? (
                                        <div className="flex items-center gap-2">
                                            {(item.isUpcoming || item.isLive) && (
                                                <a
                                                    href={item.meetingLink}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="dr-btn dr-btn-primary no-underline"
                                                    style={{
                                                        fontSize: 12.5,
                                                        padding: "6px 12px",
                                                    }}
                                                >
                                                    {t(
                                                        "pages.meetings.card.actions.join_meeting",
                                                    )}
                                                </a>
                                            )}
                                            <button
                                                type="button"
                                                onClick={copyLink}
                                                aria-label={td("Copy link")}
                                                className="flex h-[30px] w-[30px] shrink-0 items-center justify-center"
                                                style={{
                                                    border: `1px solid ${T.BORDER}`,
                                                    borderRadius: R.MD,
                                                    background: T.WHITE,
                                                    cursor: "pointer",
                                                }}
                                            >
                                                <Icon
                                                    name="copy"
                                                    size={14}
                                                    color={T.TEXT_MUTED}
                                                />
                                            </button>
                                        </div>
                                    ) : undefined
                                }
                            />

                            <MeetingCalendarSyncRow
                                meeting={meeting}
                                userId={userId}
                            />
                        </div>

                        <div className="mb-4">
                            <div
                                className="mb-2.5 flex items-center gap-1.5 font-semibold"
                                style={{ fontSize: 12.5, color: T.TEXT_MUTED }}
                            >
                                <span>
                                    {t(
                                        "pages.deals.workspace.meetings.attendees",
                                    )}
                                </span>
                                <span
                                    style={{
                                        fontWeight: 400,
                                        color: T.TEXT_HINT,
                                    }}
                                >
                                    {attendees.length}
                                </span>
                            </div>

                            {attendees.length === 0 ? (
                                <div
                                    className="italic"
                                    style={{
                                        fontSize: 13,
                                        color: T.TEXT_MUTED,
                                    }}
                                >
                                    {t("pages.deals.common.none")}
                                </div>
                            ) : (
                                <>
                                    <div className="flex flex-col gap-2">
                                        {visibleAttendees.map((person) => (
                                            <div
                                                key={person.id}
                                                className="flex items-center gap-2.5"
                                            >
                                                <Avatar
                                                    type="participant"
                                                    size={28}
                                                    initials={initialsFromName(
                                                        person.name,
                                                    )}
                                                />
                                                <span
                                                    className="flex-1 truncate font-medium"
                                                    style={{ fontSize: 13 }}
                                                >
                                                    {person.name}
                                                </span>
                                                {person.id === hostId && (
                                                    <span className="dr-pill dr-pill-blue">
                                                        {td("Organizer")}
                                                    </span>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                    {attendees.length >
                                        ATTENDEES_COLLAPSED_LIMIT && (
                                        <button
                                            type="button"
                                            onClick={() =>
                                                setShowAllAttendees(
                                                    (current) => !current,
                                                )
                                            }
                                            className="mt-2 font-semibold"
                                            style={{
                                                background: "none",
                                                border: "none",
                                                padding: 0,
                                                cursor: "pointer",
                                                fontFamily: "inherit",
                                                fontSize: 12.5,
                                                color: T.BLUE,
                                            }}
                                        >
                                            {showAllAttendees
                                                ? td("Show fewer")
                                                : `${td("Show")} ${hiddenAttendeeCount} ${td("more")}`}
                                        </button>
                                    )}
                                </>
                            )}
                        </div>

                        {meeting.remark && (
                            <div>
                                <div
                                    className="mb-2.5 font-semibold"
                                    style={{
                                        fontSize: 12.5,
                                        color: T.TEXT_MUTED,
                                    }}
                                >
                                    {t(
                                        "pages.deals.workspace.meetings.agenda_label",
                                    )}
                                </div>
                                <div
                                    className="whitespace-pre-line"
                                    style={{
                                        fontSize: 13,
                                        lineHeight: 1.55,
                                        color: T.TEXT_MUTED,
                                        background: T.SURFACE_2,
                                        borderRadius: R.LG,
                                        padding: "12px 14px",
                                    }}
                                >
                                    {meeting.remark}
                                </div>
                            </div>
                        )}
                    </>
                )}
            </Modal>

            <ConfirmDialog
                open={confirmDelete}
                title={td("Delete this meeting?")}
                message={td("The meeting and its reminders are removed.")}
                confirmLabel={t("pages.deals.common.delete")}
                danger
                onConfirm={() => {
                    setConfirmDelete(false);
                    onDelete();
                }}
                onCancel={() => setConfirmDelete(false)}
            />
        </>
    );
}
