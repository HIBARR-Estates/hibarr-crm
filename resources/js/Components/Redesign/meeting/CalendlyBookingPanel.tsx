import useTranslation from "@/Hooks/useTranslation";
import useCopyToClipboard from "@/Hooks/useCopyToClipboard";
import AssigneeField from "@/Components/Redesign/fields/AssigneeField";
import Button from "@/Components/Redesign/primitives/Button";
import Icon from "@/Components/Redesign/primitives/Icon";
import { ModalField } from "@/Components/Redesign/primitives/Modal";
import { REDESIGN_RADIUS as R, REDESIGN_TOKENS as T } from "@/Components/Redesign/tokens";
import type { CalendlyLinkOption, CalendlyTarget } from "./useCalendlyLinks";

interface CalendlyBookingPanelProps {
    link: CalendlyLinkOption;
    recordType: CalendlyTarget["type"];
    /** Colleagues added to the booking as guests (user ids). */
    guestIds: number[];
    onGuestsChange: (ids: number[]) => void;
    /** The link is being rebuilt for a changed guest list — don't hand out the old one. */
    refreshing: boolean;
}

/**
 * What the dialog shows in place of the meeting form once a booking page is
 * chosen: there is nothing to fill in, because the guest picks the time on
 * that page. Says in plain words what happens next, lets the agent decide who
 * from the team joins the booking as a guest, and lets them copy the link to
 * send it on instead of opening it themselves.
 */
export default function CalendlyBookingPanel({
    link,
    recordType,
    guestIds,
    onGuestsChange,
    refreshing,
}: CalendlyBookingPanelProps) {
    const { t } = useTranslation();
    const { copy, copied, copyFailed } = useCopyToClipboard();

    return (
        <div>
            <div
                style={{
                    background: T.BLUE_LIGHT,
                    border: `1px solid ${T.BORDER}`,
                    borderRadius: R.MD,
                    padding: "16px 18px",
                }}
            >
                <div className="flex items-start gap-3">
                    <span style={{ color: T.BLUE_DARK, marginTop: 2 }}>
                        <Icon name="calendar" size={18} />
                    </span>
                    <div className="min-w-0">
                        <p
                            className="font-semibold"
                            style={{ fontSize: 14, color: T.TEXT }}
                        >
                            {t("pages.meetings.calendly.panel_title")}
                        </p>
                        <p
                            className="mt-1"
                            style={{ fontSize: 13, color: T.TEXT_MUTED }}
                        >
                            {recordType === "deal"
                                ? t("pages.meetings.calendly.panel_body_deal")
                                : t("pages.meetings.calendly.panel_body_lead")}
                        </p>
                        <p
                            className="mt-2"
                            style={{ fontSize: 12, color: T.TEXT_HINT }}
                        >
                            {t("pages.meetings.calendly.prefilled_note", {
                                page: link.name,
                            })}
                        </p>
                    </div>
                </div>
            </div>

            <div style={{ marginTop: 16 }}>
                <ModalField label={t("pages.meetings.calendly.guests_label")}>
                    <AssigneeField
                        value={guestIds}
                        onChange={onGuestsChange}
                        addLabel={t("pages.meetings.calendly.guests_add")}
                        doneLabel={t("pages.meetings.calendly.guests_done")}
                        removeLabel={t("pages.meetings.calendly.guests_remove")}
                    />
                    <p
                        style={{
                            margin: "6px 0 0",
                            fontSize: 12,
                            color: T.TEXT_MUTED,
                        }}
                    >
                        {guestIds.length === 0
                            ? t("pages.meetings.calendly.guests_none")
                            : t("pages.meetings.calendly.guests_hint")}
                    </p>
                </ModalField>
            </div>

            <div className="flex justify-end">
                <Button
                    size="sm"
                    variant="ghost"
                    disabled={refreshing}
                    icon={<Icon name={copied ? "check" : "copy"} size={13} />}
                    onClick={() => void copy(link.url)}
                >
                    {copyFailed
                        ? t("pages.meetings.calendly.copy_failed")
                        : copied
                          ? t("pages.meetings.calendly.copied")
                          : t("pages.meetings.calendly.copy")}
                </Button>
            </div>
        </div>
    );
}
