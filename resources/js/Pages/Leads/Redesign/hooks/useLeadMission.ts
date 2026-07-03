import { useMemo } from "react";
import type { Lead } from "@/Types/api/leads";
import type { LeadNote } from "@/Types/api/lead-note";
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
    notes: LeadNote[];
    tasks: Task[];
    leadFollowUps: DealFollowup[];
    flowActive: boolean;
    outcome: QualificationOutcome | null;
    qualificationAnswers?: LeadQualificationAnswer[];
    contactLoggedOverride?: boolean;
}

export default function useLeadMission({
    lead,
    leadName,
    notes,
    tasks,
    leadFollowUps,
    flowActive,
    outcome,
    qualificationAnswers,
    contactLoggedOverride,
}: UseLeadMissionArgs): LeadMission {
    const contactLogged = useMemo(() => {
        if (contactLoggedOverride) return true;
        return (
            notes.length > 0 ||
            leadFollowUps.length > 0 ||
            tasks.length > 0 ||
            flowActive ||
            Boolean(outcome)
        );
    }, [
        contactLoggedOverride,
        flowActive,
        leadFollowUps.length,
        notes.length,
        outcome,
        tasks.length,
    ]);

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
                if (a.startsAt && b.startsAt) return a.startsAt.getTime() - b.startsAt.getTime();
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
        ],
    );
}
