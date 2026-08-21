import { useEffect, useMemo, useRef, useState } from "react";
import { SendOutlined } from "@ant-design/icons";
import { useTd } from "@/Hooks/useDynamicTranslation";
import Avatar from "@/Components/Redesign/primitives/Avatar";
import PeoplePicker from "@/Components/Redesign/primitives/PeoplePicker";
import { REDESIGN_TOKENS as T } from "@/Components/Redesign/tokens";
import { initialsFromName } from "@/Components/Redesign/adapters/initials";
import { assigneeTone } from "../config/taskDesignTokens";
import type { TaskCommentRecord } from "../hooks/useTaskComments";

interface MentionCandidate {
    id: number;
    name: string;
    image?: string | null;
    designation_name?: string;
}

interface TaskCommentsPanelProps {
    comments: TaskCommentRecord[];
    /** Total comment count on the task — may exceed `comments.length` while
     *  older pages haven't been fetched yet. */
    totalCount: number;
    loading: boolean;
    /** Fetching an older page via `onLoadMore`. */
    loadingMore: boolean;
    /** Whether an older page still exists to fetch. */
    hasMore: boolean;
    posting: boolean;
    error: string | null;
    /** Employees available to @mention. */
    people: MentionCandidate[];
    currentUser: { id: number; name: string; image?: string | null };
    canComment: boolean;
    /** delete_task_comments scope — controls which comments show a delete control. */
    deleteCommentScope?: string;
    onSubmit: (comment: string, mentionUserIds: number[]) => Promise<boolean>;
    onDelete: (commentId: number) => void;
    onLoadMore: () => Promise<void>;
}

const MAX_INPUT_HEIGHT = 140;

const LABEL: React.CSSProperties = {
    fontSize: 14,
    fontWeight: 700,
    letterSpacing: "0.05em",
    textTransform: "uppercase",
    color: T.TEXT_MUTED,
};

/** Escapes user text before it goes into the stored comment HTML. */
function escapeHtml(value: string): string {
    return value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

/**
 * Renders a stored comment. Mentions were written as `@[Name](id)` markers, so
 * everything else is escaped and only the markers become highlighted chips —
 * comment bodies are never injected as raw HTML.
 */
function renderComment(comment: string): string {
    return escapeHtml(comment).replace(
        /@\[([^\]]+)]\((\d+)\)/g,
        (_match, name: string) => `<span class="tasks-mention">@${name}</span>`,
    );
}

/** Pulls the mentioned user ids back out of a composed comment. */
function extractMentionIds(comment: string): number[] {
    const ids = new Set<number>();
    const pattern = /@\[[^\]]+]\((\d+)\)/g;
    let match = pattern.exec(comment);
    while (match !== null) {
        ids.add(Number(match[1]));
        match = pattern.exec(comment);
    }
    return Array.from(ids);
}

/**
 * Comments rail on the task detail modal: the thread plus a composer with
 * `@` autocomplete. Mentioned users get an in-app notification server-side.
 */
export default function TaskCommentsPanel({
    comments,
    totalCount,
    loading,
    loadingMore,
    hasMore,
    posting,
    error,
    people,
    currentUser,
    canComment,
    deleteCommentScope,
    onSubmit,
    onDelete,
    onLoadMore,
}: TaskCommentsPanelProps) {
    const { td } = useTd();
    const [draft, setDraft] = useState("");
    const [mentionQuery, setMentionQuery] = useState<string | null>(null);
    const [activeIndex, setActiveIndex] = useState(0);
    const inputRef = useRef<HTMLTextAreaElement>(null);
    const scrollRef = useRef<HTMLDivElement>(null);
    /** Tracks an `@` inserted by the button click so it can be undone if the
     *  picker gets dismissed (blur/Escape) without anyone selected. */
    const buttonMentionRef = useRef<{ at: number; length: number } | null>(
        null,
    );

    // Jump to the newest comment once the initial page has loaded — but not
    // after "load earlier" prepends older ones (that has its own scroll-
    // anchoring in handleLoadMore) or on every re-render.
    const scrolledRef = useRef(false);
    useEffect(() => {
        if (loading) {
            scrolledRef.current = false;
            return;
        }
        if (scrolledRef.current) return;
        scrolledRef.current = true;
        const node = scrollRef.current;
        if (node) node.scrollTop = node.scrollHeight;
    }, [loading]);

    /** Fetches the previous page while keeping the same comments in view
     *  (anchored to scroll position, not jumping to the top of the list). */
    const handleLoadMore = async () => {
        const node = scrollRef.current;
        const prevHeight = node?.scrollHeight ?? 0;
        const prevTop = node?.scrollTop ?? 0;
        await onLoadMore();
        window.requestAnimationFrame(() => {
            if (!node) return;
            node.scrollTop = node.scrollHeight - prevHeight + prevTop;
        });
    };

    // Auto-grow the composer with its content — starts as a single line,
    // expands up to MAX_INPUT_HEIGHT, then scrolls internally.
    useEffect(() => {
        const node = inputRef.current;
        if (!node) return;
        node.style.height = "auto";
        node.style.height = `${Math.min(node.scrollHeight, MAX_INPUT_HEIGHT)}px`;
    }, [draft]);

    // Consecutive comments from the same author collapse under one
    // avatar/name/time header, chat-style, instead of repeating it per line.
    const commentGroups = useMemo(() => {
        const groups: Array<{
            user: TaskCommentRecord["user"];
            is_mine: boolean;
            items: TaskCommentRecord[];
        }> = [];
        for (const comment of comments) {
            const last = groups[groups.length - 1];
            const sameAuthor =
                last &&
                last.is_mine === comment.is_mine &&
                (last.user?.id ?? null) === (comment.user?.id ?? null);
            if (sameAuthor) {
                last.items.push(comment);
            } else {
                groups.push({
                    user: comment.user,
                    is_mine: comment.is_mine,
                    items: [comment],
                });
            }
        }
        return groups;
    }, [comments]);

    const matches = useMemo(() => {
        if (mentionQuery === null) return [];
        const query = mentionQuery.trim().toLowerCase();
        return people
            .filter((person) => person.id !== currentUser.id)
            .filter((person) =>
                query ? person.name.toLowerCase().includes(query) : true,
            )
            .slice(0, 6);
    }, [mentionQuery, people, currentUser.id]);

    /** Tracks the word right after the caret's nearest unclosed `@`. */
    const syncMentionQuery = (value: string, caret: number) => {
        const upToCaret = value.slice(0, caret);
        const at = upToCaret.lastIndexOf("@");
        if (at === -1) {
            setMentionQuery(null);
            return;
        }
        const fragment = upToCaret.slice(at + 1);
        // A space ends the mention; so does an already-inserted marker.
        if (/[\s\]]/.test(fragment)) {
            setMentionQuery(null);
            return;
        }
        setMentionQuery(fragment);
        setActiveIndex(0);
    };

    const insertMention = (person: { id: number; name: string }) => {
        const input = inputRef.current;
        const caret = input?.selectionStart ?? draft.length;
        const upToCaret = draft.slice(0, caret);
        const at = upToCaret.lastIndexOf("@");
        if (at === -1) return;

        const marker = `@[${person.name}](${person.id}) `;
        const next = draft.slice(0, at) + marker + draft.slice(caret);
        setDraft(next);
        setMentionQuery(null);
        buttonMentionRef.current = null;

        // Put the caret straight after the inserted marker.
        window.requestAnimationFrame(() => {
            const position = at + marker.length;
            input?.focus();
            input?.setSelectionRange(position, position);
        });
    };

    /** Closes the mention picker, quietly removing a still-empty
     *  button-inserted `@` — typed `@`s and picked mentions are left alone. */
    const closeMentionDropdown = () => {
        const pending = buttonMentionRef.current;
        if (pending && mentionQuery === "" && draft.length === pending.length) {
            setDraft((prev) =>
                prev.length === pending.length
                    ? prev.slice(0, pending.at) + prev.slice(pending.at + 1)
                    : prev,
            );
        }
        buttonMentionRef.current = null;
        setMentionQuery(null);
    };

    const submit = async () => {
        const value = draft.trim();
        if (!value || posting) return;
        const ok = await onSubmit(value, extractMentionIds(value));
        if (ok) {
            setDraft("");
            window.requestAnimationFrame(() => {
                const node = scrollRef.current;
                if (node) node.scrollTop = node.scrollHeight;
            });
        }
    };

    /** Inserts "@" at the caret and opens the mention dropdown, same as typing it. */
    const handleInsertAtSymbol = () => {
        const input = inputRef.current;
        const caret = input?.selectionStart ?? draft.length;
        const next = draft.slice(0, caret) + "@" + draft.slice(caret);
        buttonMentionRef.current = { at: caret, length: next.length };
        setDraft(next);
        window.requestAnimationFrame(() => {
            const position = caret + 1;
            input?.focus();
            input?.setSelectionRange(position, position);
            syncMentionQuery(next, position);
        });
    };

    return (
        <div
            className="flex min-h-0 flex-shrink-0 flex-col"
            style={{
                width: 380,
                borderLeft: `1px solid ${T.BORDER_SOFT}`,
                background: T.SURFACE_2,
            }}
        >
            <div
                className="flex flex-shrink-0 items-center gap-2"
                style={{
                    padding: "16px 18px 12px",
                    borderBottom: `1px solid ${T.BORDER_SOFT}`,
                }}
            >
                <span style={LABEL}>{td("Comments")}</span>
                <span
                    style={{
                        fontSize: 14,
                        fontWeight: 600,
                        color: T.TEXT_MUTED,
                        background: T.NAVY_SOFT,
                        borderRadius: 999,
                        padding: "1px 7px",
                    }}
                >
                    {totalCount}
                </span>
            </div>

            <div
                ref={scrollRef}
                className="min-h-0 flex-1 overflow-y-auto"
                style={{ padding: "18px 20px" }}
            >
                {loading && (
                    <p style={{ fontSize: 15, color: T.TEXT_HINT }}>
                        {td("Loading comments…")}
                    </p>
                )}

                {!loading && comments.length === 0 && (
                    <p
                        style={{
                            fontSize: 15,
                            color: T.TEXT_HINT,
                            fontStyle: "italic",
                        }}
                    >
                        {td("No comments yet.")}
                    </p>
                )}

                {!loading && hasMore && (
                    <button
                        type="button"
                        onClick={() => void handleLoadMore()}
                        disabled={loadingMore}
                        className="tasks-press mb-5 block"
                        style={{
                            margin: "0 auto 20px",
                            padding: "5px 12px",
                            border: `1px solid ${T.BORDER}`,
                            borderRadius: 999,
                            background: T.WHITE,
                            fontSize: 13.5,
                            fontWeight: 600,
                            color: T.TEXT_MUTED,
                            cursor: loadingMore ? "default" : "pointer",
                            opacity: loadingMore ? 0.6 : 1,
                        }}
                    >
                        {loadingMore
                            ? td("Loading…")
                            : td("Load earlier comments")}
                    </button>
                )}

                {commentGroups.map((group) => (
                    <div
                        key={group.items[0].id}
                        className="mb-5 flex gap-3"
                    >
                        <Avatar
                            size={32}
                            initials={initialsFromName(
                                group.user?.name ?? "?",
                            )}
                            src={group.user?.image}
                            tone={assigneeTone(group.user?.id ?? 0)}
                        />
                        <div className="min-w-0 flex-1">
                            <div className="mb-1 flex items-baseline gap-1.5">
                                <span
                                    style={{
                                        fontSize: 14.5,
                                        fontWeight: 700,
                                        color: T.TEXT,
                                    }}
                                >
                                    {group.is_mine
                                        ? td("You")
                                        : (group.user?.name ?? td("Unknown"))}
                                </span>
                                <span
                                    style={{
                                        fontSize: 14,
                                        color: T.TEXT_HINT,
                                    }}
                                >
                                    {group.items[0].created_at_human}
                                </span>
                            </div>
                            {group.items.map((comment) => (
                                <div
                                    key={comment.id}
                                    className="tasks-comment flex items-start justify-between gap-2"
                                >
                                    <div
                                        style={{
                                            fontSize: 15,
                                            color: T.TEXT_MUTED,
                                            lineHeight: 1.65,
                                            overflowWrap: "anywhere",
                                        }}
                                        // Escaped in renderComment; only
                                        // mention chips survive as markup.
                                        dangerouslySetInnerHTML={{
                                            __html: renderComment(
                                                comment.comment,
                                            ),
                                        }}
                                    />
                                    {(deleteCommentScope === "all" ||
                                        (deleteCommentScope === "added" &&
                                            comment.is_mine)) && (
                                        <button
                                            type="button"
                                            onClick={() =>
                                                onDelete(comment.id)
                                            }
                                            className="tasks-comment-delete flex-shrink-0"
                                            style={{
                                                background: "transparent",
                                                border: "none",
                                                padding: 0,
                                                fontSize: 14,
                                                color: T.TEXT_HINT,
                                                cursor: "pointer",
                                            }}
                                        >
                                            {td("Delete")}
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>

            {canComment && (
                <div
                    className="relative flex-shrink-0"
                    style={{
                        padding: "12px 18px 16px",
                        borderTop: `1px solid ${T.BORDER_SOFT}`,
                        background: T.WHITE,
                    }}
                >
                    {mentionQuery !== null && matches.length > 0 && (
                        <div
                            className="tasks-reveal"
                            // Rows are plain <button>s, which steal focus on
                            // mousedown; without this the textarea's onBlur
                            // would strip a pending "@" before onPick runs.
                            onMouseDown={(event) => event.preventDefault()}
                            style={{
                                position: "absolute",
                                bottom: "100%",
                                left: 18,
                                right: 18,
                                marginBottom: 6,
                                background: T.WHITE,
                                border: `1px solid ${T.BORDER}`,
                                borderRadius: 10,
                                boxShadow: "0 12px 28px rgba(22,41,77,0.14)",
                                overflow: "hidden",
                                padding: 4,
                                zIndex: 5,
                            }}
                        >
                            <PeoplePicker
                                people={matches.map((person) => ({
                                    id: person.id,
                                    name: person.name,
                                    designation: person.designation_name,
                                    image: person.image,
                                }))}
                                showSearchInput={false}
                                remoteFilter
                                onPick={insertMention}
                            />
                        </div>
                    )}

                    <div className="flex flex-col gap-2">
                        <textarea
                            ref={inputRef}
                            className="tasks-bare-input"
                            rows={1}
                            value={draft}
                            disabled={posting}
                            placeholder={td("Reply or @ mention someone")}
                            onChange={(event) => {
                                setDraft(event.target.value);
                                syncMentionQuery(
                                    event.target.value,
                                    event.target.selectionStart ?? 0,
                                );
                            }}
                            onKeyDown={(event) => {
                                if (
                                    mentionQuery !== null &&
                                    matches.length > 0
                                ) {
                                    if (event.key === "ArrowDown") {
                                        event.preventDefault();
                                        setActiveIndex(
                                            (activeIndex + 1) %
                                                matches.length,
                                        );
                                        return;
                                    }
                                    if (event.key === "ArrowUp") {
                                        event.preventDefault();
                                        setActiveIndex(
                                            (activeIndex -
                                                1 +
                                                matches.length) %
                                                matches.length,
                                        );
                                        return;
                                    }
                                    if (
                                        event.key === "Enter" ||
                                        event.key === "Tab"
                                    ) {
                                        event.preventDefault();
                                        insertMention(matches[activeIndex]);
                                        return;
                                    }
                                    if (event.key === "Escape") {
                                        event.stopPropagation();
                                        closeMentionDropdown();
                                        return;
                                    }
                                }
                                if (
                                    event.key === "Enter" &&
                                    !event.shiftKey
                                ) {
                                    event.preventDefault();
                                    void submit();
                                }
                            }}
                            onBlur={() => {
                                if (mentionQuery !== null) {
                                    closeMentionDropdown();
                                }
                            }}
                            style={{
                                width: "100%",
                                maxHeight: MAX_INPUT_HEIGHT,
                                border: "none",
                                outline: "none",
                                resize: "none",
                                overflowY: "auto",
                                fontSize: 15,
                                lineHeight: 1.5,
                                color: T.TEXT,
                                background: "transparent",
                                fontFamily: "inherit",
                            }}
                        />
                        <div className="flex items-center justify-between">
                            <button
                                type="button"
                                aria-label={td("Mention someone")}
                                title={td("Mention someone")}
                                onClick={handleInsertAtSymbol}
                                disabled={posting}
                                className="tasks-press flex flex-shrink-0 items-center justify-center"
                                style={{
                                    width: 28,
                                    height: 28,
                                    borderRadius: 7,
                                    background: T.WHITE,
                                    color: T.TEXT_MUTED,
                                    border: `1px solid ${T.BORDER}`,
                                    fontSize: 15,
                                    fontWeight: 700,
                                    cursor: posting ? "default" : "pointer",
                                }}
                            >
                                @
                            </button>
                            <button
                                type="button"
                                aria-label={td("Send")}
                                title={td("Send")}
                                onClick={() => void submit()}
                                disabled={!draft.trim() || posting}
                                className="tasks-press flex flex-shrink-0 items-center justify-center"
                                style={{
                                    width: 30,
                                    height: 30,
                                    borderRadius: 999,
                                    background: T.BLUE,
                                    color: T.WHITE,
                                    border: "none",
                                    cursor: "pointer",
                                    opacity:
                                        !draft.trim() || posting ? 0.45 : 1,
                                }}
                            >
                                <SendOutlined style={{ fontSize: 14 }} />
                            </button>
                        </div>
                    </div>

                    {error && (
                        <p
                            style={{
                                marginTop: 8,
                                fontSize: 14,
                                color: T.RED,
                            }}
                        >
                            {error}
                        </p>
                    )}
                </div>
            )}
        </div>
    );
}
