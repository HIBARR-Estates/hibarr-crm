import { useCallback, useEffect, useState } from "react";
import axios from "axios";

export interface TaskCommentUser {
    id: number;
    name: string;
    image?: string | null;
}

export interface TaskCommentRecord {
    id: number;
    comment: string;
    created_at: string | null;
    created_at_human: string | null;
    is_mine: boolean;
    user: TaskCommentUser | null;
}

/**
 * Loads and posts comments for one task. Mentions are sent as explicit user
 * ids (the composer knows exactly who was picked), so the server never has to
 * parse names back out of the comment body.
 */
export default function useTaskComments(taskId: number | null) {
    const [comments, setComments] = useState<TaskCommentRecord[]>([]);
    const [loading, setLoading] = useState(false);
    const [posting, setPosting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (taskId === null) {
            setComments([]);
            return;
        }

        let cancelled = false;
        setLoading(true);
        setError(null);

        axios
            .get(route("tasks.comments.index", taskId))
            .then((response) => {
                if (cancelled) return;
                setComments(response.data?.data?.comments ?? []);
            })
            .catch(() => {
                if (!cancelled) setError("Couldn't load comments");
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });

        return () => {
            cancelled = true;
        };
    }, [taskId]);

    const addComment = useCallback(
        async (comment: string, mentionUserIds: number[]) => {
            if (taskId === null || !comment.trim()) return false;

            setPosting(true);
            setError(null);
            try {
                const response = await axios.post(
                    route("tasks.comments.store", taskId),
                    { comment, mention_user_ids: mentionUserIds },
                );
                const created = response.data?.data?.comment;
                if (created) setComments((prev) => [...prev, created]);
                return true;
            } catch {
                setError("Couldn't post that comment");
                return false;
            } finally {
                setPosting(false);
            }
        },
        [taskId],
    );

    const deleteComment = useCallback(async (commentId: number) => {
        try {
            await axios.delete(route("tasks.comments.destroy", commentId));
            setComments((prev) =>
                prev.filter((comment) => comment.id !== commentId),
            );
        } catch {
            setError("Couldn't delete that comment");
        }
    }, []);

    return { comments, loading, posting, error, addComment, deleteComment };
}
