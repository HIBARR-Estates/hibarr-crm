import type { Deal } from "@/Types/api/deals";
import type { DealFollowup } from "@/Types/api/deal-followup";
import type { Task } from "@/Types/api/tasks";
import { useMemo } from "react";
import { toLeadMeetingPreview } from "../adapters/meetingAdapter";
import { getTaskPriorityWeight, toLeadTaskPreview } from "../adapters/taskAdapter";
import type { LeadContextRailData } from "../types";

interface UseLeadContextRailArgs {
    tasks?: Task[];
    leadFollowUps?: DealFollowup[];
    deals?: Deal[];
}

export default function useLeadContextRail({
    tasks = [],
    leadFollowUps = [],
    deals = [],
}: UseLeadContextRailArgs): LeadContextRailData {
    return useMemo(() => {
        const mappedTasks = tasks
            .map(toLeadTaskPreview)
            .filter((t) => t.isOpen)
            .sort((a, b) => {
                const priorityDelta =
                    getTaskPriorityWeight(b.priority) - getTaskPriorityWeight(a.priority);
                if (priorityDelta !== 0) return priorityDelta;
                if (a.dueDate && b.dueDate) return a.dueDate.getTime() - b.dueDate.getTime();
                return a.title.localeCompare(b.title);
            });

        const mappedMeetings = leadFollowUps
            .map(toLeadMeetingPreview)
            .filter((m) => m.isUpcoming)
            .sort((a, b) => {
                if (a.startsAt && b.startsAt) return a.startsAt.getTime() - b.startsAt.getTime();
                return a.title.localeCompare(b.title);
            });

        const nextMeeting = mappedMeetings[0] ?? null;
        const topOpenTask = mappedTasks[0] ?? null;

        return {
            openTasksCount: mappedTasks.length,
            upcomingMeetingsCount: mappedMeetings.length,
            dealsCount: deals.length,
            nextMeeting: nextMeeting
                ? {
                      id: nextMeeting.id,
                      title: nextMeeting.title,
                      startsAtLabel: nextMeeting.startsAtLabel,
                  }
                : null,
            topOpenTask: topOpenTask
                ? {
                      id: topOpenTask.id,
                      title: topOpenTask.title,
                      dueDateLabel: topOpenTask.dueDateLabel,
                      priority: topOpenTask.priority,
                  }
                : null,
        };
    }, [deals.length, leadFollowUps, tasks]);
}
