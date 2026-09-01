import { useEffect, useMemo, useRef, useState } from "react";
import { SendOutlined } from "@ant-design/icons";
import { useTd } from "@/Hooks/useDynamicTranslation";
import PeoplePicker from "@/Components/Redesign/primitives/PeoplePicker";
import { REDESIGN_TOKENS as T } from "@/Components/Redesign/tokens";
import type { TaskCommentDeleteScope } from "../adapters/taskPermissions";
import type { TaskCommentRecord } from "../hooks/useTaskComments";
import type { TaskActivityRecord } from "../hooks/useTaskActivity";
import {
    extractMentionIds,
    insertMentionChip,
    serializeMentionEditor,
    textBeforeCaret,
} from "../lib/commentMarkup";
import { TASK_ICON } from "../config/taskDesignTokens";
import { buildTaskTimeline } from "../adapters/taskTimeline";
import TaskCommentGroup from "./comments/TaskCommentGroup";
import TaskActivityLogLine from "./comments/TaskActivityLogLine";
import { TaskGlyph } from "./primitives/TaskGlyphs";
import { DETAIL_LABEL } from "./primitives/taskUiStyles";

interface MentionCandidate {
    id: number;
    name: string;
    image?: string | null;
    designation_name?: string;
}

interface TaskCommentsPanelProps {
    comments: TaskCommentRecord[];
    activity: TaskActivityRecord[];
    totalCount: number;
    loading: boolean;
    loadingMore: boolean;
    hasMore: boolean;
    posting: boolean;
    error: string | null;
    people: MentionCandidate[];
    currentUser: { id: number; name: string; image?: string | null };
    canComment: boolean;
    deleteCommentScope?: TaskCommentDeleteScope;
    onMentionOpenChange?: (open: boolean) => void;
    onSubmit: (comment: string, mentionUserIds: number[]) => Promise<boolean>;
    onDelete: (commentId: number) => void;
    onLoadMore: () => Promise<void>;
    /** Task detail modal's close (X) lives here — top-right of the comments rail. */
    onClose: () => void;
}

const MAX_INPUT_HEIGHT = 140;

/**
 * Comments rail on the task detail modal: the thread plus a composer with
 * `@` autocomplete. Mentioned users get an in-app notification server-side.
 */
export default function TaskCommentsPanel({
    comments,
    activity,
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
    onMentionOpenChange,
    onSubmit,
    onDelete,
    onLoadMore,
    onClose,
}: TaskCommentsPanelProps) {
    const { td } = useTd();
    const [draft, setDraft] = useState("");
    const [mentionQuery, setMentionQuery] = useState<string | null>(null);
    const [activeIndex, setActiveIndex] = useState(0);
    const editorRef = useRef<HTMLDivElement>(null);
    const scrollRef = useRef<HTMLDivElement>(null);

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

    const timeline = useMemo(
        () => buildTaskTimeline(comments, activity),
        [comments, activity],
    );

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

    const mentionDropdownOpen = mentionQuery !== null && matches.length > 0;
    useEffect(() => {
        onMentionOpenChange?.(mentionDropdownOpen);
        return () => onMentionOpenChange?.(false);
    }, [mentionDropdownOpen, onMentionOpenChange]);

    /** `upToCaret` is already the text up to the caret — see `textBeforeCaret`. */
    const syncMentionQuery = (upToCaret: string) => {
        const at = upToCaret.lastIndexOf("@");
        if (at === -1) {
            setMentionQuery(null);
            return;
        }
        const fragment = upToCaret.slice(at + 1);
        if (/[\s\]]/.test(fragment)) {
            setMentionQuery(null);
            return;
        }
        setMentionQuery(fragment);
        setActiveIndex(0);
    };

    /** Re-reads the composer's DOM after a change it didn't dispatch its own input event for. */
    const syncDraftFromDom = () => {
        const root = editorRef.current;
        if (!root) return;
        setDraft(serializeMentionEditor(root));
    };

    const insertMention = (person: { id: number; name: string }) => {
        const root = editorRef.current;
        const selection = window.getSelection();
        if (!root || !selection || selection.rangeCount === 0) return;
        const inserted = insertMentionChip(selection.getRangeAt(0), person);
        if (!inserted) return;
        setMentionQuery(null);
        syncDraftFromDom();
        root.focus();
    };

    const submit = async () => {
        const value = draft.trim();
        if (!value || posting) return;
        const ok = await onSubmit(value, extractMentionIds(value));
        if (ok) {
            setDraft("");
            if (editorRef.current) editorRef.current.innerHTML = "";
            window.requestAnimationFrame(() => {
                const node = scrollRef.current;
                if (node) node.scrollTop = node.scrollHeight;
            });
        }
    };

    /** Inserts a literal "@" to open the mention picker without typing it. */
    const handleInsertAtSymbol = () => {
        const root = editorRef.current;
        if (!root) return;
        root.focus();
        document.execCommand("insertText", false, "@");
        syncDraftFromDom();
        syncMentionQuery(textBeforeCaret(root));
    };

    const canDeleteComment = (comment: TaskCommentRecord) =>
        deleteCommentScope === "all" ||
        (deleteCommentScope === "added" && comment.is_mine);

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
                className="flex flex-shrink-0 items-center justify-between gap-2"
                style={{
                    padding: "16px 18px 12px",
                    borderBottom: `1px solid ${T.BORDER_SOFT}`,
                }}
            >
                <div className="flex items-center gap-2">
                    <span style={DETAIL_LABEL}>{td("Activities")}</span>
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
                <button
                    type="button"
                    aria-label={td("Close")}
                    onClick={onClose}
                    style={{
                        display: "flex",
                        padding: 4,
                        background: "transparent",
                        border: "none",
                        cursor: "pointer",
                        color: T.TEXT_MUTED,
                    }}
                >
                    <TaskGlyph d={TASK_ICON.x} size={17} strokeWidth={1.5} />
                </button>
            </div>

            <div
                ref={scrollRef}
                className="min-h-0 flex-1 overflow-y-auto"
                style={{ padding: "18px 20px" }}
            >
                {loading && (
                    <p style={{ fontSize: 15, color: T.TEXT_HINT }}>
                        {td("Loading activities and comments…")}
                    </p>
                )}

                {!loading && timeline.length === 0 && (
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

                {timeline.map((item) =>
                    item.kind === "log" ? (
                        <TaskActivityLogLine key={item.key} entry={item.entry} />
                    ) : (
                        <TaskCommentGroup
                            key={item.key}
                            group={item.group}
                            canDelete={canDeleteComment}
                            onDelete={onDelete}
                        />
                    ),
                )}
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
                        <div
                            ref={editorRef}
                            className="tasks-comment-editor"
                            contentEditable={!posting}
                            suppressContentEditableWarning
                            role="textbox"
                            aria-multiline="true"
                            aria-label={td("Reply or @ mention someone")}
                            data-placeholder={td(
                                "Reply or @ mention someone",
                            )}
                            onInput={() => {
                                const root = editorRef.current;
                                if (!root) return;
                                setDraft(serializeMentionEditor(root));
                                syncMentionQuery(textBeforeCaret(root));
                            }}
                            onKeyDown={(event) => {
                                if (
                                    mentionQuery !== null &&
                                    matches.length > 0
                                ) {
                                    if (event.key === "ArrowDown") {
                                        event.preventDefault();
                                        setActiveIndex(
                                            (activeIndex + 1) % matches.length,
                                        );
                                        return;
                                    }
                                    if (event.key === "ArrowUp") {
                                        event.preventDefault();
                                        setActiveIndex(
                                            (activeIndex - 1 + matches.length) %
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
                                if (event.key === "Enter" && event.shiftKey) {
                                    event.preventDefault();
                                    document.execCommand("insertLineBreak");
                                    syncDraftFromDom();
                                    return;
                                }
                                if (event.key === "Enter") {
                                    event.preventDefault();
                                    void submit();
                                }
                            }}
                            onBlur={() => {
                                if (mentionQuery !== null) {
                                    setMentionQuery(null);
                                }
                            }}
                            style={{
                                width: "100%",
                                minHeight: 22,
                                maxHeight: MAX_INPUT_HEIGHT,
                                overflowY: "auto",
                                fontSize: 15,
                                lineHeight: 1.5,
                                color: T.TEXT,
                                background: "transparent",
                                fontFamily: "inherit",
                                outline: "none",
                                overflowWrap: "anywhere",
                                whiteSpace: "pre-wrap",
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
