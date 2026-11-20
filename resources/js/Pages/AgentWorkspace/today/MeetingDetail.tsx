import { Link, usePage } from "@inertiajs/react";
import Icon from "@/Components/Redesign/primitives/Icon";
import { DEFAULT_MEETING_REMINDERS, reminderLabel } from "@/Components/Redesign/meeting/meetingFormUtils";
import { stripHtmlTags } from "@/Components/Redesign/qualification/qualificationUtils";
import { useTd } from "@/Hooks/useDynamicTranslation";
import useTranslation from "@/Hooks/useTranslation";
import type { ScheduleEntry } from "@/Types/personal-work";

interface MeetingDetailProps {
    meeting: ScheduleEntry;
    /** The video link, when the meeting has one. */
    joinHref: string | null;
    /** Where it happens ("Zoom"), for "Join Zoom". */
    joinLabel: string;
    /** The contact or deal page. */
    record: string | null;
    /** Opens the meeting, where its time is changed. */
    onReschedule: () => void;
}

/**
 * The agenda's next meeting opened up (canvas L7-02): why it is happening (its
 * agenda), who joins (host, attendees and the person it is with) and which
 * reminders go out, then Join, the contact page and Reschedule.
 */
export default function MeetingDetail({ meeting, joinHref, joinLabel, record, onReschedule }: MeetingDetailProps) {
    const { t } = useTranslation();
    const { td } = useTd();
    const viewerId = Number(usePage().props.auth?.user?.id ?? 0);

    const why = stripHtmlTags(meeting.remark ?? "").trim();
    const hostId = Number(meeting.host_id ?? meeting.host?.id ?? 0);
    const host = hostId
        ? hostId === viewerId
            ? t("pages.agent_workspace.agenda.detail.host_you")
            : t("pages.agent_workspace.agenda.detail.host_named", { name: meeting.host?.name ?? "" })
        : null;
    const attendees = (meeting.participant_users ?? []).filter((user) => Number(user.id) !== hostId).map((user) => user.name);
    const who = [host, meeting.person, ...attendees].filter((name): name is string => Boolean(name));
    const reminders = [...DEFAULT_MEETING_REMINDERS, ...(meeting.reminders ?? [])].map((reminder) => td(reminderLabel(reminder), { source: "en" }));

    return (
        <div className="agent-sched__detail">
            <div className="agent-sched__facts">
                <section className="agent-sched__fact">
                    <h4>{t("pages.agent_workspace.agenda.detail.why")}</h4>
                    <p>{why || t("pages.agent_workspace.agenda.detail.no_agenda")}</p>
                </section>
                <section className="agent-sched__fact">
                    <h4>{t("pages.agent_workspace.agenda.detail.who")}</h4>
                    <p>{who.length > 0 ? who.join(" · ") : t("pages.agent_workspace.agenda.detail.nobody")}</p>
                </section>
                <section className="agent-sched__fact">
                    <h4>{t("pages.agent_workspace.agenda.detail.reminders")}</h4>
                    <p>{reminders.join(" · ")}</p>
                </section>
            </div>
            <div className="agent-sched__detail-actions">
                {joinHref ? (
                    <a className="dr-btn dr-btn-primary dr-btn-sm" href={joinHref} target="_blank" rel="noopener noreferrer">
                        <Icon name="video" size={13} />
                        {t("pages.agent_workspace.agenda.detail.join", { platform: joinLabel })}
                    </a>
                ) : null}
                {record ? (
                    <Link className="dr-btn dr-btn-ghost dr-btn-sm" href={record}>
                        {t("pages.agent_workspace.agenda.detail.open_contact")}
                    </Link>
                ) : null}
                <button type="button" className="dr-btn dr-btn-ghost dr-btn-sm" onClick={onReschedule}>
                    {t("pages.agent_workspace.agenda.detail.reschedule")}
                </button>
            </div>
        </div>
    );
}
