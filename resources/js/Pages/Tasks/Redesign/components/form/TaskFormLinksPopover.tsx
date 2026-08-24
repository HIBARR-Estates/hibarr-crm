import type { CSSProperties } from "react";
import { createPortal } from "react-dom";
import { useTd } from "@/Hooks/useDynamicTranslation";
import { REDESIGN_TOKENS as T } from "@/Components/Redesign/tokens";
import {
    RECORD_TYPES,
    TASK_ICON,
    type RecordTypeKey,
} from "../../config/taskDesignTokens";
import type { RecordPoolItem, TaskFormValues } from "../../adapters/taskFormValues";
import { TaskGlyph } from "../primitives/TaskGlyphs";
import TaskRecordIcon from "../primitives/TaskRecordIcon";

const RECORD_TABS: RecordTypeKey[] = ["lead", "deal", "property", "project"];

interface TaskFormLinksPopoverProps {
    open: boolean;
    positionStyle: CSSProperties | null;
    onClose: () => void;
    recordType: RecordTypeKey;
    onRecordType: (type: RecordTypeKey) => void;
    recordQuery: string;
    onRecordQuery: (query: string) => void;
    recordOptions: RecordPoolItem[];
    links: TaskFormValues["links"];
    onToggleLink: (id: number, name: string) => void;
}

/** Linked-records picker, anchored under the form's "linked items" pill. */
export default function TaskFormLinksPopover({
    open,
    positionStyle,
    onClose,
    recordType,
    onRecordType,
    recordQuery,
    onRecordQuery,
    recordOptions,
    links,
    onToggleLink,
}: TaskFormLinksPopoverProps) {
    const { td } = useTd();
    if (!open || !positionStyle || typeof document === "undefined") return null;

    return createPortal(
        <>
            <div
                role="presentation"
                onClick={(event) => {
                    event.stopPropagation();
                    onClose();
                }}
                style={{ position: "fixed", inset: 0, zIndex: 59 }}
            />
            <div
                className="tasks-reveal flex flex-col gap-2.5"
                onClick={(event) => event.stopPropagation()}
                style={{
                    ...positionStyle,
                    width: 360,
                    padding: 12,
                    background: T.WHITE,
                    border: `1px solid ${T.BORDER}`,
                    borderRadius: 12,
                    boxShadow: "0 16px 36px rgba(22,41,77,0.16)",
                }}
            >
                <div className="flex flex-wrap gap-1.5">
                    {RECORD_TABS.map((key) => {
                        const def = RECORD_TYPES[key];
                        const active = recordType === key;
                        return (
                            <button
                                key={key}
                                type="button"
                                onClick={() => onRecordType(key)}
                                className="tasks-press inline-flex items-center gap-1.5"
                                style={{
                                    padding: "6px 11px",
                                    borderRadius: 8,
                                    fontSize: 14,
                                    fontWeight: 600,
                                    cursor: "pointer",
                                    background: active ? T.NAVY : T.WHITE,
                                    color: active ? T.WHITE : T.TEXT_MUTED,
                                    border: `1px solid ${active ? T.NAVY : T.BORDER}`,
                                }}
                            >
                                <TaskRecordIcon type={key} size={13} />
                                {td(def.label)}
                            </button>
                        );
                    })}
                </div>

                <div
                    style={{
                        border: `1px solid ${T.BORDER}`,
                        borderRadius: 8,
                        overflow: "hidden",
                    }}
                >
                    <input
                        value={recordQuery}
                        onChange={(event) => onRecordQuery(event.target.value)}
                        aria-label={`${td("Search")} ${td(RECORD_TYPES[recordType].plural)}`}
                        placeholder={`${td("Search")} ${td(RECORD_TYPES[recordType].plural)}`}
                        style={{
                            width: "100%",
                            padding: "9px 12px",
                            border: "none",
                            borderBottom: `1px solid ${T.BORDER_SOFT}`,
                            fontSize: 15,
                        }}
                    />
                    <div style={{ maxHeight: 180, overflowY: "auto" }}>
                        {recordOptions.map((option) => {
                            const def = RECORD_TYPES[recordType];
                            const picked = links.some(
                                (link) =>
                                    link.type === recordType &&
                                    link.id === option.id,
                            );
                            return (
                                <button
                                    key={option.id}
                                    type="button"
                                    aria-pressed={picked}
                                    onClick={() =>
                                        onToggleLink(option.id, option.name)
                                    }
                                    className="tasks-record-row flex w-full items-center gap-2.5"
                                    style={{
                                        padding: "9px 12px",
                                        border: "none",
                                        borderBottom: "1px solid #f2f4f7",
                                        background: picked
                                            ? T.BLUE_LIGHT
                                            : T.WHITE,
                                        cursor: "pointer",
                                        textAlign: "left",
                                    }}
                                >
                                    <span
                                        className="flex flex-shrink-0 items-center justify-center"
                                        style={{
                                            width: 26,
                                            height: 26,
                                            borderRadius: 6,
                                            background: def.iconBg,
                                        }}
                                    >
                                        <TaskRecordIcon
                                            type={recordType}
                                            size={14}
                                            color={def.iconFg}
                                        />
                                    </span>
                                    <span className="flex min-w-0 flex-1 flex-col">
                                        <span
                                            className="truncate"
                                            style={{
                                                fontSize: 16,
                                                fontWeight: picked ? 600 : 500,
                                                color: T.TEXT,
                                            }}
                                        >
                                            {option.name}
                                        </span>
                                        {option.meta && (
                                            <span
                                                className="truncate"
                                                style={{
                                                    fontSize: 14,
                                                    color: T.TEXT_MUTED,
                                                }}
                                            >
                                                {option.meta}
                                            </span>
                                        )}
                                    </span>
                                    {picked && (
                                        <TaskGlyph
                                            d={TASK_ICON.check}
                                            size={15}
                                            color={T.BLUE}
                                        />
                                    )}
                                </button>
                            );
                        })}
                        {recordOptions.length === 0 && (
                            <div
                                style={{
                                    padding: "14px 12px",
                                    fontSize: 15,
                                    color: T.TEXT_HINT,
                                }}
                            >
                                {td("Nothing matches that search.")}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </>,
        document.body,
    );
}
