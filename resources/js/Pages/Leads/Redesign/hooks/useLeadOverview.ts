import type { LeadNote } from "@/Types/api/lead-note";
import type { DealFollowup } from "@/Types/api/deal-followup";
import type { Task } from "@/Types/api/tasks";
import { useMemo } from "react";
import { toLeadNotePreview } from "../adapters/noteAdapter";
import { toLeadMeetingPreview } from "../adapters/meetingAdapter";
import { getTaskPriorityWeight, toLeadTaskPreview } from "../adapters/taskAdapter";

interface UseLeadOverviewArgs {
    notes?: LeadNote[];
    tasks?: Task[];
    leadFollowUps?: DealFollowup[];
}

export default function useLeadOverview({
    notes = [],
    tasks = [],
    leadFollowUps = [],
}: UseLeadOverviewArgs) {
    const mappedNotes = useMemo(() => notes.map(toLeadNotePreview), [notes]);

    const mappedTasks = useMemo(() => {
        return tasks
            .map(toLeadTaskPreview)
            .sort((left, right) => {
                const priorityDelta =
                    getTaskPriorityWeight(right.priority) - getTaskPriorityWeight(left.priority);
                if (priorityDelta !== 0) return priorityDelta;
                if (left.dueDate && right.dueDate) {
                    return left.dueDate.getTime() - right.dueDate.getTime();
                }
                if (left.dueDate && !right.dueDate) return -1;
                if (!left.dueDate && right.dueDate) return 1;
                return left.title.localeCompare(right.title);
            });
    }, [tasks]);

    const mappedMeetings = useMemo(() => {
        return leadFollowUps
            .map(toLeadMeetingPreview)
            .sort((left, right) => {
                if (left.startsAt && right.startsAt) {
                    return left.startsAt.getTime() - right.startsAt.getTime();
                }
                if (left.startsAt && !right.startsAt) return -1;
                if (!left.startsAt && right.startsAt) return 1;
                return left.title.localeCompare(right.title);
            });
    }, [leadFollowUps]);

    const openTasksCount = useMemo(
        () => mappedTasks.filter((task) => task.isOpen).length,
        [mappedTasks],
    );
    const upcomingMeetingsCount = useMemo(
        () => mappedMeetings.filter((meeting) => meeting.isUpcoming).length,
        [mappedMeetings],
    );

    return {
        notes: mappedNotes,
        tasks: mappedTasks,
        meetings: mappedMeetings,
        upcomingMeetingsCount,
        openTasksCount,
    };
}
