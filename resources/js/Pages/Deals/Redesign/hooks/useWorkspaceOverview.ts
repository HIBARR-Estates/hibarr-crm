import type { DealFollowup } from "@/Types/api/deal-followup";
import type { Note } from "@/Types/api/note";
import type { Task } from "@/Types/api/tasks";
import { useMemo } from "react";
import { useUserDateTime } from "@/Hooks/useUserDateTime";
import { getUserDateTimeContextVersion } from "@/lib/userDateTime";
import useMeetingClockTick from "./useMeetingClockTick";
import {
    toWorkspaceMeetingPreview,
    type WorkspaceMeetingPreview,
} from "../adapters/meetingAdapter";
import { toWorkspaceNotePreview, type WorkspaceNotePreview } from "../adapters/noteAdapter";
import {
    getTaskPriorityWeight,
    toWorkspaceTaskPreview,
    type WorkspaceTaskPreview,
} from "../adapters/taskAdapter";

interface UseWorkspaceOverviewArgs {
    notes?: Note[];
    tasks?: Task[];
    dealFollowUps?: DealFollowup[];
}

interface WorkspaceOverviewData {
    notes: WorkspaceNotePreview[];
    tasks: WorkspaceTaskPreview[];
    meetings: WorkspaceMeetingPreview[];
    upcomingMeetingsCount: number;
    openTasksCount: number;
}

export default function useWorkspaceOverview({
    notes = [],
    tasks = [],
    dealFollowUps = [],
}: UseWorkspaceOverviewArgs): WorkspaceOverviewData {
    useUserDateTime();
    const dateTimeVersion = getUserDateTimeContextVersion();
    const meetingClockTick = useMeetingClockTick(dealFollowUps);
    const mappedNotes = useMemo(() => notes.map(toWorkspaceNotePreview), [notes]);

    const mappedTasks = useMemo(() => {
        return tasks
            .map(toWorkspaceTaskPreview)
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
        return dealFollowUps
            .map(toWorkspaceMeetingPreview)
            .sort((left, right) => {
                if (left.startsAt && right.startsAt) {
                    return left.startsAt.getTime() - right.startsAt.getTime();
                }
                if (left.startsAt && !right.startsAt) return -1;
                if (!left.startsAt && right.startsAt) return 1;
                return left.title.localeCompare(right.title);
            });
    }, [dealFollowUps, dateTimeVersion, meetingClockTick]);

    const openTasksCount = useMemo(
        () => mappedTasks.filter((task) => task.isOpen).length,
        [mappedTasks],
    );
    const upcomingMeetingsCount = useMemo(
        () =>
            mappedMeetings.filter(
                (meeting) => meeting.isUpcoming || meeting.isLive,
            ).length,
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
