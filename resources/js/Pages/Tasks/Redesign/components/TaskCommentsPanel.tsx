import { useEffect, useMemo, useRef, useState } from "react";
import { useTd } from "@/Hooks/useDynamicTranslation";
import Avatar from "@/Components/Redesign/primitives/Avatar";
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
    loading: boolean;
    posting: boolean;
    error: string | null;
    /** Employees available to @mention. */
    people: MentionCandidate[];
    currentUser: { id: number; name: string; image?: string | null };
    canComment: boolean;
    onSubmit: (comment: string, mentionUserIds: number[]) => Promise<boolean>;
    onDelete: (commentId: number) => void;
}

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
    loading,
    posting,
    error,
    people,
    currentUser,
    canComment,
    onSubmit,
    onDelete,
}: TaskCommentsPanelProps) {
    const { td } = useTd();
    const [draft, setDraft] = useState("");
    const [mentionQuery, setMentionQuery] = useState<string | null>(null);
    const [activeIndex, setActiveIndex] = useState(0);
    const inputRef = useRef<HTMLTextAreaElement>(null);
    const scrollRef = useRef<HTMLDivElement>(null);

    // Keep the newest comment in view as the thread grows.
    useEffect(() => {
        const node = scrollRef.current;
        if (node) node.scrollTop = node.scrollHeight;
    }, [comments.length]);

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

    const insertMention = (person: MentionCandidate) => {
        const input = inputRef.current;
        const caret = input?.selectionStart ?? draft.length;
        const upToCaret = draft.slice(0, caret);
        const at = upToCaret.lastIndexOf("@");
        if (at === -1) return;

        const marker = `@[${person.name}](${person.id}) `;
        const next = draft.slice(0, at) + marker + draft.slice(caret);
        setDraft(next);
        setMentionQuery(null);

        // Put the caret straight after the inserted marker.
        window.requestAnimationFrame(() => {
            const position = at + marker.length;
            input?.focus();
            input?.setSelectionRange(position, position);
        });
    };

    const submit = async () => {
        const value = draft.trim();
        if (!value || posting) return;
        const ok = await onSubmit(value, extractMentionIds(value));
        if (ok) setDraft("");
    };

    return (
        <div
            className="flex min-h-0 flex-shrink-0 flex-col"
            style={{
                width: 320,
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
                    {comments.length}
                </span>
            </div>

            <div
                ref={scrollRef}
                className="min-h-0 flex-1 overflow-y-auto"
                style={{ padding: "14px 18px" }}
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

                {comments.map((comment) => (
                    <div
                        key={comment.id}
                        className="tasks-comment mb-4 flex gap-2.5"
                    >
                        <Avatar
                            size={26}
                            initials={initialsFromName(
                                comment.user?.name ?? "?",
                            )}
                            src={comment.user?.image}
                            tone={assigneeTone(comment.user?.id ?? 0)}
                        />
                        <div className="min-w-0 flex-1">
                            <div className="mb-0.5 flex flex-wrap items-baseline gap-1.5">
                                <span
                                    style={{
                                        fontSize: 14.5,
                                        fontWeight: 700,
                                        color: T.TEXT,
                                    }}
                                >
                                    {comment.is_mine
                                        ? td("You")
                                        : (comment.user?.name ?? td("Unknown"))}
                                </span>
                                <span
                                    style={{
                                        fontSize: 14,
                                        color: T.TEXT_HINT,
                                    }}
                                >
                                    · {comment.created_at_human}
                                </span>
                                {comment.is_mine && (
                                    <button
                                        type="button"
                                        onClick={() => onDelete(comment.id)}
                                        className="tasks-comment-delete ml-auto"
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
                            <div
                                style={{
                                    fontSize: 15,
                                    color: T.TEXT_MUTED,
                                    lineHeight: 1.55,
                                    overflowWrap: "anywhere",
                                }}
                                // Escaped in renderComment; only mention chips
                                // survive as markup.
                                dangerouslySetInnerHTML={{
                                    __html: renderComment(comment.comment),
                                }}
                            />
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
                                zIndex: 5,
                            }}
                        >
                            {matches.map((person, index) => (
                                <button
                                    key={person.id}
                                    type="button"
                                    // mousedown fires before the textarea blurs.
                                    onMouseDown={(event) => {
                                        event.preventDefault();
                                        insertMention(person);
                                    }}
                                    className="flex w-full items-center gap-2.5"
                                    style={{
                                        padding: "8px 10px",
                                        border: "none",
                                        background:
                                            index === activeIndex
                                                ? T.BLUE_LIGHT
                                                : "transparent",
                                        cursor: "pointer",
                                        textAlign: "left",
                                    }}
                                >
                                    <Avatar
                                        size={22}
                                        initials={initialsFromName(person.name)}
                                        src={person.image}
                                        tone={assigneeTone(person.id)}
                                    />
                                    <span
                                        className="min-w-0 flex-1 truncate"
                                        style={{
                                            fontSize: 15,
                                            fontWeight: 600,
                                            color: T.TEXT,
                                        }}
                                    >
                                        {person.name}
                                    </span>
                                    {person.designation_name && (
                                        <span
                                            style={{
                                                fontSize: 13,
                                                color: T.TEXT_HINT,
                                            }}
                                        >
                                            {person.designation_name}
                                        </span>
                                    )}
                                </button>
                            ))}
                        </div>
                    )}

                    <div className="flex items-start gap-2">
                        <Avatar
                            size={26}
                            initials={initialsFromName(currentUser.name)}
                            src={currentUser.image}
                            tone={assigneeTone(currentUser.id)}
                        />
                        <div
                            className="min-w-0 flex-1"
                            style={{
                                border: `1px solid ${T.BORDER}`,
                                borderRadius: 8,
                                padding: "8px 10px",
                                background: T.WHITE,
                            }}
                        >
                            <textarea
                                ref={inputRef}
                                rows={2}
                                value={draft}
                                disabled={posting}
                                placeholder={td("Add a comment, @ to mention")}
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
                                            setMentionQuery(null);
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
                                style={{
                                    width: "100%",
                                    border: "none",
                                    outline: "none",
                                    resize: "none",
                                    fontSize: 15,
                                    lineHeight: 1.5,
                                    color: T.TEXT,
                                    background: "transparent",
                                    fontFamily: "inherit",
                                }}
                            />
                            <div className="mt-1.5 flex items-center justify-between gap-2">
                                <span
                                    style={{ fontSize: 13, color: T.TEXT_HINT }}
                                >
                                    {td("@ to mention")}
                                </span>
                                <button
                                    type="button"
                                    onClick={() => void submit()}
                                    disabled={!draft.trim() || posting}
                                    className="tasks-press"
                                    style={{
                                        padding: "6px 12px",
                                        borderRadius: 6,
                                        background: T.BLUE,
                                        color: T.WHITE,
                                        border: "none",
                                        fontSize: 14,
                                        fontWeight: 600,
                                        cursor: "pointer",
                                        opacity:
                                            !draft.trim() || posting ? 0.45 : 1,
                                    }}
                                >
                                    {posting ? td("Posting…") : td("Comment")}
                                </button>
                            </div>
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
