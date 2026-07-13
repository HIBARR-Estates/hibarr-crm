import { useMemo } from "react";
import type { Lead } from "@/Types/api/leads";
import type { DealFollowup } from "@/Types/api/deal-followup";
import type { Task } from "@/Types/api/tasks";
import { computeMission } from "./computeMission";
import type { LeadMission } from "../types";
import { toLeadMeetingPreview } from "../adapters/meetingAdapter";
import { toLeadTaskPreview } from "../adapters/taskAdapter";
import useLeadBantChecks from "./useLeadBantChecks";
import type { LeadQualificationAnswer } from "@/Types/qualification";
import type { QualificationOutcome } from "@/Types/qualification";

interface UseLeadMissionArgs {
    lead: Lead;
    leadName: string;
    tasks: Task[];
    leadFollowUps: DealFollowup[];
    flowActive: boolean;
    outcome: QualificationOutcome | null;
    qualificationAnswers?: LeadQualificationAnswer[];
    /** True when a First Contact CRM event exists (or was just logged). */
    contactLogged: boolean;
    qualificationEnabled?: boolean;
}

export default function useLeadMission({
    lead,
    leadName,
    tasks,
    leadFollowUps,
    flowActive,
    outcome,
    qualificationAnswers,
    contactLogged,
    qualificationEnabled = true,
}: UseLeadMissionArgs): LeadMission {
    const { captures } = useLeadBantChecks({
        lead,
        answers: qualificationAnswers,
        contactLogged,
    });

    const openTasks = useMemo(
        () => tasks.map(toLeadTaskPreview).filter((t) => t.isOpen),
        [tasks],
    );

    const nextMeeting = useMemo(() => {
        const upcoming = leadFollowUps
            .map(toLeadMeetingPreview)
            .filter((m) => m.isUpcoming)
            .sort((a, b) => {
                if (a.startsAt && b.startsAt) {
                    return a.startsAt.getTime() - b.startsAt.getTime();
                }
                return 0;
            });
        return upcoming[0] ?? null;
    }, [leadFollowUps]);

    return useMemo(
        () =>
            computeMission({
                leadName,
                leadPhone: lead.mobile || lead.cell,
                contactLogged,
                outcome,
                flowActive,
                qualificationEnabled,
                openTasks,
                nextMeeting,
                captures,
            }),
        [
            captures,
            contactLogged,
            flowActive,
            lead.cell,
            lead.mobile,
            leadName,
            nextMeeting,
            openTasks,
            outcome,
            qualificationEnabled,
        ],
    );
}
