import { useTd } from "@/Hooks/useDynamicTranslation";
import { REDESIGN_TOKENS as T } from "@/Components/Redesign/tokens";
import { TASK_ICON } from "../../config/taskDesignTokens";
import type { LinkedRecord } from "../../adapters/taskViewModel";
import { TaskGlyph } from "../primitives/TaskGlyphs";
import TaskRecordIcon from "../primitives/TaskRecordIcon";

interface TaskDetailLinksProps {
    links: LinkedRecord[];
}

export default function TaskDetailLinks({ links }: TaskDetailLinksProps) {
    const { td } = useTd();
    if (links.length === 0) return null;

    return (
        <div style={{ marginBottom: 22 }}>
            {links.map((link) => {
                const body = (
                    <>
                        <span
                            className="flex flex-shrink-0 items-center justify-center"
                            style={{
                                width: 28,
                                height: 28,
                                borderRadius: 6,
                                background: link.iconBg,
                                color: link.iconFg,
                            }}
                        >
                            <TaskRecordIcon
                                type={link.type}
                                size={15}
                                color={link.iconFg}
                            />
                        </span>
                        <span
                            style={{
                                fontSize: 15.5,
                                fontWeight: 600,
                                color: T.TEXT,
                            }}
                        >
                            {link.name}
                        </span>
                        <span style={{ fontSize: 14.5, color: T.TEXT_MUTED }}>
                            {td(link.typeLabel)}
                        </span>
                        {link.href && (
                            <span
                                className="ml-auto flex"
                                style={{ color: T.TEXT_HINT }}
                            >
                                <TaskGlyph
                                    d={TASK_ICON.externalLink}
                                    size={15}
                                    strokeWidth={1.5}
                                />
                            </span>
                        )}
                    </>
                );
                const style: React.CSSProperties = {
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "10px 12px",
                    border: `1px solid ${T.BORDER}`,
                    borderRadius: 10,
                    marginBottom: 8,
                    textDecoration: "none",
                };
                return link.href ? (
                    <a
                        key={`${link.type}-${link.name}`}
                        href={link.href}
                        className="tasks-record-row"
                        style={style}
                    >
                        {body}
                    </a>
                ) : (
                    <div key={`${link.type}-${link.name}`} style={style}>
                        {body}
                    </div>
                );
            })}
        </div>
    );
}
