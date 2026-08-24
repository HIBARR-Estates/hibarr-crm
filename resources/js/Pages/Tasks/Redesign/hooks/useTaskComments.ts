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

/** Comments fetched per page — both the initial load and each "load earlier". */
const PAGE_SIZE = 30;

/**
 * Loads and posts comments for one task. Mentions are sent as explicit user
 * ids (the composer knows exactly who was picked), so the server never has to
 * parse names back out of the comment body.
 *
 * Only the most recent page loads up front; older comments are fetched a
 * page at a time via `loadMore()` so a long-running task's thread doesn't
 * ship its entire history on every open.
 */
export default function useTaskComments(taskId: number | null) {
    const [comments, setComments] = useState<TaskCommentRecord[]>([]);
    const [totalCount, setTotalCount] = useState(0);
    const [loading, setLoading] = useState(false);
    const [loadingMore, setLoadingMore] = useState(false);
    const [hasMore, setHasMore] = useState(false);
    const [posting, setPosting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (taskId === null) {
            setComments([]);
            setHasMore(false);
            return;
        }

        let cancelled = false;
        setLoading(true);
        setError(null);

        axios
            .get(route("tasks.comments.index", taskId), {
                params: { per_page: PAGE_SIZE },
            })
            .then((response) => {
                if (cancelled) return;
                setComments(response.data?.data?.comments ?? []);
                setHasMore(Boolean(response.data?.data?.has_more));
                setTotalCount(Number(response.data?.data?.total ?? 0));
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

    const loadMore = useCallback(async () => {
        if (taskId === null || loadingMore || !hasMore || comments.length === 0) {
            return;
        }
        setLoadingMore(true);
        setError(null);
        try {
            const response = await axios.get(
                route("tasks.comments.index", taskId),
                { params: { per_page: PAGE_SIZE, before_id: comments[0].id } },
            );
            const older: TaskCommentRecord[] = response.data?.data?.comments ?? [];
            setComments((prev) => [...older, ...prev]);
            setHasMore(Boolean(response.data?.data?.has_more));
        } catch {
            setError("Couldn't load earlier comments");
        } finally {
            setLoadingMore(false);
        }
    }, [taskId, comments, hasMore, loadingMore]);

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
                if (created) {
                    setComments((prev) => [...prev, created]);
                    setTotalCount((prev) => prev + 1);
                }
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
            setTotalCount((prev) => Math.max(0, prev - 1));
        } catch {
            setError("Couldn't delete that comment");
        }
    }, []);

    return {
        comments,
        totalCount,
        loading,
        loadingMore,
        hasMore,
        posting,
        error,
        addComment,
        deleteComment,
        loadMore,
    };
}
