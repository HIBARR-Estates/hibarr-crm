import {
    useEffect,
    useRef,
    useState,
    type CSSProperties,
    type KeyboardEvent,
    type ReactNode,
} from "react";
import { REDESIGN_TOKENS as T } from "../tokens";
import Icon from "./Icon";

const TITLE_STYLE: CSSProperties = {
    fontSize: 20,
    fontWeight: 700,
    letterSpacing: "-0.01em",
    color: T.TEXT,
    margin: 0,
    lineHeight: 1.25,
};

interface EditableTitleProps {
    value: string;
    onSave: (next: string) => Promise<void>;
    canEdit?: boolean;
    /** Non-editable text rendered before the name (e.g. lead salutation). */
    prefix?: ReactNode;
    ariaLabel?: string;
    className?: string;
}

export default function EditableTitle({
    value,
    onSave,
    canEdit = true,
    prefix,
    ariaLabel = "Name",
    className,
}: EditableTitleProps) {
    const [editing, setEditing] = useState(false);
    const [draft, setDraft] = useState(value);
    const [saving, setSaving] = useState(false);
    const [hovered, setHovered] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);
    const ignoreBlurRef = useRef(false);

    useEffect(() => {
        if (!editing) {
            setDraft(value);
        }
    }, [value, editing]);

    useEffect(() => {
        if (!editing) return;
        const input = inputRef.current;
        if (!input) return;
        input.focus();
        input.select();
    }, [editing]);

    const startEditing = () => {
        if (!canEdit || saving) return;
        ignoreBlurRef.current = false;
        setDraft(value);
        setEditing(true);
    };

    const exitEditing = () => {
        setEditing(false);
        setDraft(value);
    };

    const commit = async () => {
        if (saving) return;
        const trimmed = draft.trim();
        if (trimmed === "") {
            exitEditing();
            return;
        }
        if (trimmed === (value ?? "").trim()) {
            setEditing(false);
            return;
        }
        setSaving(true);
        try {
            await onSave(trimmed);
            setEditing(false);
        } catch {
            setDraft(value);
            setEditing(false);
        } finally {
            setSaving(false);
        }
    };

    const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
        if (event.key === "Escape") {
            event.preventDefault();
            ignoreBlurRef.current = true;
            exitEditing();
            return;
        }
        if (event.key === "Enter") {
            event.preventDefault();
            ignoreBlurRef.current = true;
            void commit();
        }
    };

    const showPencil = canEdit && !editing && hovered;

    return (
        <h1
            className={className}
            style={{
                ...TITLE_STYLE,
                display: "flex",
                flexWrap: "wrap",
                alignItems: "baseline",
                minWidth: 0,
                maxWidth: "100%",
            }}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
        >
            {prefix ? (
                <span style={{ whiteSpace: "pre-wrap" }}>{prefix}</span>
            ) : null}
            {editing ? (
                <input
                    ref={inputRef}
                    value={draft}
                    aria-label={ariaLabel}
                    disabled={saving}
                    onChange={(event) => setDraft(event.target.value)}
                    onBlur={() => {
                        if (ignoreBlurRef.current) {
                            ignoreBlurRef.current = false;
                            return;
                        }
                        void commit();
                    }}
                    onKeyDown={onKeyDown}
                    style={{
                        ...TITLE_STYLE,
                        flex: "1 1 8rem",
                        minWidth: 0,
                        width: `${Math.max(draft.length, 8)}ch`,
                        padding: "0 0 1px",
                        border: "none",
                        borderBottom: `1px dashed ${T.BLUE}`,
                        borderRadius: 0,
                        outline: "none",
                        background: "transparent",
                        fontFamily: "inherit",
                        opacity: saving ? 0.6 : 1,
                    }}
                />
            ) : (
                <button
                    type="button"
                    aria-label={canEdit ? `Edit ${ariaLabel}` : ariaLabel}
                    disabled={!canEdit}
                    onClick={startEditing}
                    style={{
                        ...TITLE_STYLE,
                        display: "inline-flex",
                        alignItems: "baseline",
                        gap: 6,
                        minWidth: 0,
                        maxWidth: "100%",
                        padding: 0,
                        border: "none",
                        background: "transparent",
                        textAlign: "left",
                        cursor: canEdit ? "text" : "default",
                        borderBottom: canEdit
                            ? `1px dashed ${hovered ? T.BLUE_MID : "transparent"}`
                            : "1px dashed transparent",
                    }}
                >
                    <span
                        style={{
                            minWidth: 0,
                            overflowWrap: "anywhere",
                            wordBreak: "break-word",
                        }}
                    >
                        {value || "—"}
                    </span>
                    {canEdit ? (
                        <span
                            aria-hidden="true"
                            style={{
                                display: "inline-flex",
                                alignSelf: "center",
                                opacity: showPencil ? 1 : 0,
                                transition: "opacity 120ms ease",
                                color: T.BLUE,
                            }}
                        >
                            <Icon name="edit" size={12} color="currentColor" />
                        </span>
                    ) : null}
                </button>
            )}
        </h1>
    );
}
