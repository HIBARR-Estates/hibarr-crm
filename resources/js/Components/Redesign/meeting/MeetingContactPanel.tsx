import useTranslation from "@/Hooks/useTranslation";
import Icon from "@/Components/Redesign/primitives/Icon";
import { REDESIGN_RADIUS as R, REDESIGN_TOKENS as T } from "@/Components/Redesign/tokens";
import type {
    ContactRequirement,
    MeetingContact,
} from "./meetingContact";

/** More than this many of one kind collapse into "+N more". */
const SHOWN = 2;

function ContactRow({
    icon,
    values,
    missing,
}: {
    icon: "mail" | "phone";
    values: string[];
    missing: string;
}) {
    const { t } = useTranslation();
    const shown = values.slice(0, SHOWN);
    const hidden = values.length - shown.length;

    return (
        <div className="flex items-start gap-2" style={{ fontSize: 13 }}>
            <span
                style={{
                    color: values.length > 0 ? T.TEXT_MUTED : T.AMBER_TEXT,
                    marginTop: 2,
                }}
            >
                <Icon name={icon} size={14} />
            </span>
            {values.length > 0 ? (
                <span className="min-w-0" style={{ color: T.TEXT }}>
                    {shown.join(" · ")}
                    {hidden > 0 && (
                        <span style={{ color: T.TEXT_HINT }}>
                            {" "}
                            {t("pages.meetings.contact.more", { count: hidden })}
                        </span>
                    )}
                </span>
            ) : (
                <span style={{ color: T.AMBER_TEXT, fontWeight: 600 }}>
                    {missing}
                </span>
            )}
        </div>
    );
}

interface MeetingContactPanelProps {
    contact: MeetingContact;
    /** Shows the lead's email(s) and number(s). */
    showCard: boolean;
    /** What the chosen meeting method needs and the lead lacks, if anything. */
    shortfall: ContactRequirement | null;
    /** The lead's name, for the notice. */
    name?: string | null;
}

/**
 * How to reach the person the meeting is with, shown with the person, and —
 * when the way the meeting is set up to run has no way to reach them — why it
 * cannot be saved yet and what to do about it.
 */
export default function MeetingContactPanel({
    contact,
    showCard,
    shortfall,
    name,
}: MeetingContactPanelProps) {
    const { t } = useTranslation();
    const who = name?.trim() || t("pages.meetings.contact.this_lead");

    return (
        <>
            {showCard && (
                <div
                    className="space-y-1.5"
                    style={{
                        background: T.SURFACE_2,
                        border: `1px solid ${T.BORDER_SOFT}`,
                        borderRadius: R.MD,
                        padding: "10px 12px",
                        marginBottom: 16,
                    }}
                    data-testid="meeting-contact"
                >
                    <ContactRow
                        icon="mail"
                        values={contact.emails}
                        missing={t("pages.meetings.contact.no_email")}
                    />
                    <ContactRow
                        icon="phone"
                        values={contact.phones}
                        missing={t("pages.meetings.contact.no_phone")}
                    />
                </div>
            )}

            {shortfall && (
                <div
                    role="alert"
                    className="flex items-start gap-2"
                    style={{
                        background: T.AMBER_BG,
                        border: `1px solid ${T.AMBER_BORDER}`,
                        borderRadius: R.MD,
                        padding: "10px 12px",
                        marginBottom: 16,
                        fontSize: 13,
                        color: T.AMBER,
                    }}
                >
                    <span style={{ marginTop: 1 }}>
                        <Icon name="info" size={15} />
                    </span>
                    <div className="min-w-0">
                        <p className="m-0 font-semibold">
                            {t(`pages.meetings.contact.blocked_${shortfall}`, {
                                name: who,
                            })}
                        </p>
                        <p className="m-0 mt-0.5">
                            {t("pages.meetings.contact.blocked_help")}{" "}
                            {contact.leadId ? (
                                <a
                                    href={route("lead-contact.show", contact.leadId)}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    style={{ color: T.BLUE, fontWeight: 600 }}
                                >
                                    {t("pages.meetings.contact.open_lead")}
                                </a>
                            ) : null}
                        </p>
                    </div>
                </div>
            )}
        </>
    );
}
