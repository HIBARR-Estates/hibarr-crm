import { useTd } from "@/Hooks/useDynamicTranslation";
import { REDESIGN_TOKENS as T } from "@/Components/Redesign/tokens";
import { RECORD_TYPES, TASK_ICON } from "../../config/taskDesignTokens";
import type { TaskLinkRef } from "../../adapters/taskFormValues";
import { TaskGlyph } from "../primitives/TaskGlyphs";
import TaskRecordIcon from "../primitives/TaskRecordIcon";

interface TaskFormLinkChipsProps {
    links: TaskLinkRef[];
    isLocked: (link: TaskLinkRef) => boolean;
    onRemove: (link: TaskLinkRef) => void;
}

/** Linked-record chips stay visible outside the picker popover. */
export default function TaskFormLinkChips({
    links,
    isLocked,
    onRemove,
}: TaskFormLinkChipsProps) {
    const { td } = useTd();
    if (links.length === 0) return null;

    return (
        <div className="flex flex-wrap gap-[7px]">
            {links.map((link) => {
                const def = RECORD_TYPES[link.type];
                const locked = isLocked(link);
                return (
                    <span
                        key={`${link.type}-${link.id}`}
                        className="tasks-chip-in inline-flex items-center gap-[7px]"
                        style={{
                            padding: "5px 8px 5px 7px",
                            borderRadius: 8,
                            background: def.iconBg,
                            border: `1px solid ${T.BORDER}`,
                            fontSize: 14,
                            fontWeight: 600,
                            color: T.NAVY,
                        }}
                    >
                        <TaskRecordIcon
                            type={link.type}
                            size={13}
                            color={def.iconFg}
                        />
                        {link.name}
                        {locked ? (
                            <span
                                title={td(
                                    "Linked from this record and can't be removed here.",
                                )}
                                style={{ fontSize: 13, color: T.TEXT_HINT }}
                            >
                                {td("locked")}
                            </span>
                        ) : (
                            <button
                                type="button"
                                aria-label={`${td("Remove")} ${link.name}`}
                                onClick={() => onRemove(link)}
                                style={{
                                    display: "flex",
                                    background: "transparent",
                                    border: "none",
                                    padding: 1,
                                    cursor: "pointer",
                                }}
                            >
                                <TaskGlyph
                                    d={TASK_ICON.x}
                                    size={12}
                                    color={T.TEXT_MUTED}
                                    strokeWidth={2}
                                />
                            </button>
                        )}
                    </span>
                );
            })}
        </div>
    );
}
