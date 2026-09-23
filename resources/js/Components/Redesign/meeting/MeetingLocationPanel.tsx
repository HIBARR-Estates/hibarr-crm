import { message } from "antd";
import { useTd } from "@/Hooks/useDynamicTranslation";
import useTranslation from "@/Hooks/useTranslation";
import type { DealFollowup } from "@/Types/api/deal-followup";
import {
    toWorkspaceMeetingListItem,
    type WorkspaceMeetingListItem,
} from "@/Pages/Deals/Redesign/adapters/meetingListAdapter";
import Icon from "@/Components/Redesign/primitives/Icon";
import {
    REDESIGN_RADIUS as R,
    REDESIGN_TOKENS as T,
} from "@/Components/Redesign/tokens";
import { copyToClipboard } from "@/lib/utils";
import {
    meetingContactPhone,
    phoneTelHref,
} from "./meetingContactPhone";

interface MeetingLocationPanelProps {
    meeting: DealFollowup;
    /**
     * Whether join / call actions should show. Past/cancelled meetings still
     * show the place or number for reference, without primary CTAs.
     */
    actionable?: boolean;
    className?: string;
}

/**
 * Where the meeting happens — with a CTA that matches the location kind.
 *
 * Video already had "Join meeting". Phone and in-person were only a muted
 * line (and often hidden when it restated the platform pill), so a phone
 * meeting offered no way to dial and a physical one never named the place
 * clearly. This panel is the single place every meeting viewer uses.
 */
export default function MeetingLocationPanel({
    meeting,
    actionable = true,
    className,
}: MeetingLocationPanelProps) {
    const item = toWorkspaceMeetingListItem(meeting);

    if (item.locationType === "video" && item.meetingLink) {
        return (
            <VideoLocation
                item={item}
                actionable={actionable}
                className={className}
            />
        );
    }

    if (item.locationType === "phone") {
        return (
            <PhoneLocation
                meeting={meeting}
                actionable={actionable}
                className={className}
            />
        );
    }

    if (item.locationType === "in_person") {
        return (
            <PhysicalLocation item={item} className={className} />
        );
    }

    // Video platform with no link yet (e.g. Zoho still generating).
    if (item.locationType === "video") {
        return (
            <div
                className={`flex items-center gap-3 rounded-lg ${className ?? ""}`}
                style={{
                    background: T.BLUE_LIGHT,
                    border: `1px solid ${T.BLUE_MID}`,
                    padding: "12px 14px",
                }}
            >
                <span
                    className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg"
                    style={{ background: T.WHITE }}
                >
                    <Icon name="video" size={17} color={T.BLUE} />
                </span>
                <div className="min-w-0 flex-1">
                    <div
                        className="mb-0.5 font-semibold uppercase"
                        style={{
                            fontSize: 12,
                            letterSpacing: "0.05em",
                            color: T.BLUE,
                        }}
                    >
                        {item.platformLabel}
                    </div>
                    <div
                        className="font-semibold"
                        style={{ fontSize: 14, color: T.NAVY }}
                    >
                        {item.locationDisplay}
                    </div>
                </div>
            </div>
        );
    }

    return null;
}

function VideoLocation({
    item,
    actionable,
    className,
}: {
    item: WorkspaceMeetingListItem;
    actionable: boolean;
    className?: string;
}) {
    const { t } = useTranslation();
    const link = item.meetingLink!;

    return (
        <div
            className={`flex items-center gap-3 rounded-lg ${className ?? ""}`}
            style={{
                background: T.BLUE_LIGHT,
                border: `1px solid ${T.BLUE_MID}`,
                padding: "12px 14px",
            }}
        >
            <span
                className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg"
                style={{ background: T.WHITE }}
            >
                <Icon name="video" size={17} color={T.BLUE} />
            </span>
            <div className="min-w-0 flex-1">
                <div
                    className="mb-0.5 font-semibold uppercase"
                    style={{
                        fontSize: 12,
                        letterSpacing: "0.05em",
                        color: T.BLUE,
                    }}
                >
                    {t("pages.deals.workspace.meetings.meeting_link")}
                </div>
                <a
                    href={link}
                    target="_blank"
                    rel="noopener noreferrer"
                    title={link}
                    className="block truncate font-medium underline"
                    style={{ fontSize: 13, color: T.NAVY }}
                >
                    {link}
                </a>
            </div>
            {actionable && (
                <a
                    href={link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="dr-btn dr-btn-primary no-underline"
                    style={{ flexShrink: 0 }}
                >
                    <Icon name="video" size={14} />
                    {t("pages.deals.workspace.meetings.join_meeting")}
                </a>
            )}
        </div>
    );
}

function PhoneLocation({
    meeting,
    actionable,
    className,
}: {
    meeting: DealFollowup;
    actionable: boolean;
    className?: string;
}) {
    const { t } = useTranslation();
    const { td } = useTd();
    const phone = meetingContactPhone(meeting);
    const tel = phoneTelHref(phone);

    const copyNumber = async () => {
        if (!phone) return;
        try {
            await copyToClipboard(phone);
            message.success(
                t("pages.deals.workspace.meetings.phone_number_copied"),
            );
        } catch {
            message.error(td("Could not copy the number"));
        }
    };

    return (
        <div
            className={`flex items-center gap-3 rounded-lg ${className ?? ""}`}
            style={{
                background: T.SURFACE_2,
                border: `1px solid ${T.BORDER}`,
                padding: "12px 14px",
            }}
        >
            <span
                className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg"
                style={{ background: T.WHITE, border: `1px solid ${T.BORDER}` }}
            >
                <Icon name="phone" size={17} color={T.NAVY} />
            </span>
            <div className="min-w-0 flex-1">
                <div
                    className="mb-0.5 font-semibold uppercase"
                    style={{
                        fontSize: 12,
                        letterSpacing: "0.05em",
                        color: T.TEXT_MUTED,
                    }}
                >
                    {t("pages.deals.workspace.meetings.phone_call")}
                </div>
                {phone ? (
                    <div
                        className="truncate font-semibold"
                        style={{ fontSize: 14, color: T.NAVY }}
                    >
                        {phone}
                    </div>
                ) : (
                    <div style={{ fontSize: 13, color: T.TEXT_MUTED }}>
                        {t("pages.deals.workspace.meetings.no_phone_on_file")}
                    </div>
                )}
            </div>
            {phone && (
                <div
                    className="flex flex-shrink-0 flex-wrap items-center justify-end gap-2"
                >
                    <button
                        type="button"
                        className="dr-btn dr-btn-ghost dr-btn-sm"
                        onClick={copyNumber}
                        aria-label={t(
                            "pages.deals.workspace.meetings.copy_number",
                        )}
                    >
                        <Icon name="copy" size={14} />
                        {t("pages.deals.workspace.meetings.copy_number")}
                    </button>
                    {actionable && tel && (
                        <a
                            href={tel}
                            className="dr-btn dr-btn-primary dr-btn-sm no-underline"
                        >
                            <Icon name="phone" size={14} />
                            {t("pages.deals.workspace.meetings.call_contact")}
                        </a>
                    )}
                </div>
            )}        </div>
    );
}

function PhysicalLocation({
    item,
    className,
}: {
    item: WorkspaceMeetingListItem;
    className?: string;
}) {
    const { t } = useTranslation();
    const place = item.locationDisplay;

    return (
        <div
            className={`flex items-center gap-3 rounded-lg ${className ?? ""}`}
            style={{
                background: "#edf7f1",
                border: `1px solid #c6e4d2`,
                padding: "12px 14px",
            }}
        >
            <span
                className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg"
                style={{ background: T.WHITE }}
            >
                <Icon name="map-pin" size={17} color="#177a5b" />
            </span>
            <div className="min-w-0 flex-1">
                <div
                    className="mb-0.5 font-semibold uppercase"
                    style={{
                        fontSize: 12,
                        letterSpacing: "0.05em",
                        color: "#177a5b",
                    }}
                >
                    {t("pages.deals.workspace.meetings.meeting_place")}
                </div>
                <div
                    className="font-semibold"
                    style={{
                        fontSize: 14,
                        color: T.NAVY,
                        lineHeight: 1.35,
                        borderRadius: R.MD,
                    }}
                >
                    {place}
                </div>
            </div>
        </div>
    );
}
