import type { TaskCommentRecord } from "../hooks/useTaskComments";
import type { TaskActivityRecord } from "../hooks/useTaskActivity";
import type { TaskCommentGroupData } from "../components/comments/TaskCommentGroup";

export type TaskTimelineItem =
    | { kind: "comments"; key: string; group: TaskCommentGroupData }
    | { kind: "log"; key: string; entry: TaskActivityRecord };

/**
 * Comments and activity log entries interleaved by timestamp, matching what
 * the user actually asked for — "log entries in between comments". Only
 * consecutive same-author *comments* still group under one avatar; a log
 * entry always breaks a run, so an "X moved to Done" line never gets
 * folded into a chat bubble on either side of it.
 */
export function buildTaskTimeline(
    comments: TaskCommentRecord[],
    activity: TaskActivityRecord[],
): TaskTimelineItem[] {
    const timestampOf = (value: string | null) => value ?? "";

    const tagged: Array<
        | { kind: "comment"; ts: string; comment: TaskCommentRecord }
        | { kind: "log"; ts: string; entry: TaskActivityRecord }
    > = [
        ...comments.map((comment) => ({
            kind: "comment" as const,
            ts: timestampOf(comment.created_at),
            comment,
        })),
        ...activity.map((entry) => ({
            kind: "log" as const,
            ts: timestampOf(entry.created_at),
            entry,
        })),
    ];

    tagged.sort((a, b) => a.ts.localeCompare(b.ts));

    const items: TaskTimelineItem[] = [];
    for (const row of tagged) {
        if (row.kind === "log") {
            items.push({ kind: "log", key: `log-${row.entry.id}`, entry: row.entry });
            continue;
        }

        const last = items[items.length - 1];
        const sameAuthorGroup =
            last?.kind === "comments" &&
            last.group.is_mine === row.comment.is_mine &&
            (last.group.user?.id ?? null) === (row.comment.user?.id ?? null);

        if (sameAuthorGroup) {
            last.group.items.push(row.comment);
        } else {
            items.push({
                kind: "comments",
                key: `comments-${row.comment.id}`,
                group: {
                    user: row.comment.user,
                    is_mine: row.comment.is_mine,
                    items: [row.comment],
                },
            });
        }
    }

    return items;
}
