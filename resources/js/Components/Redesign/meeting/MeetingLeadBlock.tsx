import { router } from "@inertiajs/react";
import { useTd } from "@/Hooks/useDynamicTranslation";
import useTranslation from "@/Hooks/useTranslation";
import Icon from "@/Components/Redesign/primitives/Icon";
import { REDESIGN_TOKENS as T } from "@/Components/Redesign/tokens";
import type { DealFollowup } from "@/Types/api/deal-followup";
import { meetingLeadInfo } from "./meetingPeople";
import { meetingRecordLink } from "./meetingRecordLink";
import { phoneTelHref } from "./meetingContactPhone";

/**
 * The lead a meeting is with — the point of the meeting — and how to reach
 * them, with the deal it is about (if any) underneath. Where a meeting has no
 * lead on record (a deal booked on its own) it falls back to the deal.
 */
export default function MeetingLeadBlock({
    meeting,
}: {
    meeting: DealFollowup;
}) {
    const { t } = useTranslation();
    const { td } = useTd();
    const lead = meetingLeadInfo(meeting);
    const record = meetingRecordLink(meeting);

    if (!lead) return null;

    const dealHref = meeting.deal ? `/account/deals/${meeting.deal.id}` : null;
    const noWay = !lead.email && lead.phones.length === 0;

    return (
        <div
            className="mb-3"
            data-testid="meeting-lead"
            style={{ minWidth: 0 }}
        >
            <button
                type="button"
                className="flex w-full items-center gap-2 text-left"
                style={{
                    background: "none",
                    border: "none",
                    padding: 0,
                    cursor: "pointer",
                    fontFamily: "inherit",
                }}
                onClick={() => router.visit(route("lead-contact.show", lead.id))}
            >
                <Icon name="user" size={14} color={T.TEXT_MUTED} />
                <span
                    className="truncate font-semibold"
                    style={{
                        fontSize: 14,
                        color: T.NAVY,
                        textDecoration: "underline",
                    }}
                >
                    {td(lead.name)}
                </span>
                <span
                    style={{
                        fontSize: 11,
                        fontWeight: 600,
                        color: T.TEXT_HINT,
                        textTransform: "uppercase",
                        letterSpacing: "0.04em",
                    }}
                >
                    {t("pages.meetings.ui.lead")}
                </span>
            </button>

            <div className="mt-1.5 space-y-1" style={{ paddingLeft: 22 }}>
                <div className="flex items-start gap-2" style={{ fontSize: 13 }}>
                    <span
                        style={{
                            color: lead.email ? T.TEXT_MUTED : T.AMBER_TEXT,
                            marginTop: 2,
                        }}
                    >
                        <Icon name="mail" size={13} />
                    </span>
                    {lead.email ? (
                        <a
                            href={`mailto:${lead.email}`}
                            className="min-w-0 truncate"
                            style={{ color: T.TEXT }}
                        >
                            {lead.email}
                        </a>
                    ) : (
                        <span style={{ color: T.AMBER_TEXT, fontWeight: 600 }}>
                            {t("pages.meetings.contact.no_email")}
                        </span>
                    )}
                </div>
                <div className="flex items-start gap-2" style={{ fontSize: 13 }}>
                    <span
                        style={{
                            color:
                                lead.phones.length > 0
                                    ? T.TEXT_MUTED
                                    : T.AMBER_TEXT,
                            marginTop: 2,
                        }}
                    >
                        <Icon name="phone" size={13} />
                    </span>
                    {lead.phones.length > 0 ? (
                        <span className="min-w-0" style={{ color: T.TEXT }}>
                            {lead.phones.map((phone, index) => (
                                <span key={phone}>
                                    {index > 0 && " · "}
                                    <a
                                        href={phoneTelHref(phone)}
                                        style={{ color: T.TEXT }}
                                    >
                                        {phone}
                                    </a>
                                </span>
                            ))}
                        </span>
                    ) : (
                        <span style={{ color: T.AMBER_TEXT, fontWeight: 600 }}>
                            {t("pages.meetings.contact.no_phone")}
                        </span>
                    )}
                </div>
                {noWay && (
                    <div style={{ fontSize: 12, color: T.AMBER_TEXT }}>
                        {t("pages.meetings.contact.detail_no_way")}
                    </div>
                )}
            </div>

            {record?.type === "deal" && (
                <div
                    className="mt-2 flex items-center gap-2"
                    style={{ fontSize: 13 }}
                >
                    <Icon name="briefcase" size={13} color={T.TEXT_MUTED} />
                    <span style={{ color: T.TEXT_MUTED }}>
                        {t("pages.meetings.contact.about_deal")}
                    </span>
                    <button
                        type="button"
                        className="min-w-0 truncate font-semibold"
                        style={{
                            background: "none",
                            border: "none",
                            padding: 0,
                            cursor: dealHref ? "pointer" : "default",
                            fontFamily: "inherit",
                            color: T.NAVY,
                            textDecoration: dealHref ? "underline" : "none",
                        }}
                        onClick={() => dealHref && router.visit(dealHref)}
                    >
                        {td(record.name)}
                    </button>
                </div>
            )}
        </div>
    );
}
