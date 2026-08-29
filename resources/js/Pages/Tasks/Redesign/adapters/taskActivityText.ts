import type { TaskActivityRecord } from "../hooks/useTaskActivity";

/**
 * English source sentence for one activity log entry — wrapped in td() at
 * the render site, same as every other ad-hoc string in this redesign.
 * `type` is TaskHistory.details (see logTaskActivity() call sites across
 * TaskController/TaskService/SubTaskController/TaskFileController/TimelogController).
 */
export function taskActivityText(entry: TaskActivityRecord): string {
    const name = entry.user?.name ?? "Someone";

    switch (entry.type) {
        case "createActivity":
            return `${name} created this task`;
        case "statusActivity":
            return entry.board_column
                ? `${name} moved this task to ${entry.board_column.column_name}`
                : `${name} changed the status`;
        case "fileActivity":
            return `${name} uploaded a file`;
        case "subTaskCreateActivity":
            return entry.sub_task
                ? `${name} added "${entry.sub_task.title}" to the checklist`
                : `${name} added a checklist item`;
        case "subTaskUpdateActivity":
            return entry.sub_task
                ? `${name} updated "${entry.sub_task.title}"`
                : `${name} updated a checklist item`;
        case "assigneeActivity":
            return `${name} updated the assignees`;
        case "timerStartedBy":
            return `${name} started the timer`;
        case "timerStoppedBy":
            return `${name} stopped the timer`;
        case "timerPausedBy":
            return `${name} paused the timer`;
        case "timerResumedBy":
            return `${name} resumed the timer`;
        default:
            return `${name} updated this task`;
    }
}
