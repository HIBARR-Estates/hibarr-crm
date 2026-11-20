import ClickToCallButton from "@/Components/ClickToCallButton";
import Icon from "@/Components/Redesign/primitives/Icon";
import useTranslation from "@/Hooks/useTranslation";
import type { DealFollowup } from "@/Types/api/deal-followup";
import { meetingCallTarget } from "@/Components/Redesign/meeting/meetingContactPhone";

interface MeetingCallButtonProps {
    meeting: DealFollowup;
    bucket: "upcoming" | "live" | "past";
    /** Button look; matches the neighbouring actions of the surface it sits on. */
    className?: string;
}

/**
 * "Call" on a phone meeting, through the softphone.
 *
 * A video meeting has a Join button; a phone meeting had nothing, so the one
 * thing you do when it starts — ring the client — meant leaving the page to
 * find a number. This is the same button the lead and deal pages use, handed
 * the meeting's own record and numbers, so the call goes out on the user's
 * line and is logged against the lead or deal the meeting belongs to.
 *
 * Only for a phone meeting that has not finished, and only for someone who can
 * place a CRM call: the underlying button renders nothing for anyone else, so
 * no gap is left where it would have been.
 */
export default function MeetingCallButton({
    meeting,
    bucket,
    className = "dr-btn dr-btn-ghost dr-btn-sm",
}: MeetingCallButtonProps) {
    const { t } = useTranslation();

    if (meeting.location !== "phone" || bucket === "past") return null;

    const target = meetingCallTarget(meeting);
    if (!target) return null;

    return (
        <ClickToCallButton
            phone={target.phones[0].phone}
            phones={target.phones}
            entity={target.entity}
            variant="link"
            className={className}
            title={t("pages.telephony.call")}
            ariaLabel={t("pages.telephony.call")}
            dataAction="call"
        >
            <Icon name="phone" size={13} />
            {t("pages.telephony.call")}
        </ClickToCallButton>
    );
}
