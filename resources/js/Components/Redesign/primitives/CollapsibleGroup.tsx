import { useState, type ReactNode } from "react";
import Icon from "./Icon";
import { REDESIGN_TOKENS as T } from "../tokens";

interface CollapsibleGroupProps {
    title: ReactNode;
    /** Shown next to the chevron while collapsed — e.g. an item count. */
    summary?: ReactNode;
    defaultOpen?: boolean;
    children: ReactNode;
}

/** A single collapsible sub-group within a larger section — e.g. one deal's files under a "Deal files" section. */
export default function CollapsibleGroup({
    title,
    summary,
    defaultOpen = false,
    children,
}: CollapsibleGroupProps) {
    const [open, setOpen] = useState(defaultOpen);

    return (
        <div className="border-b border-[#eef0f3] last:border-b-0">
            <button
                type="button"
                onClick={() => setOpen((prev) => !prev)}
                aria-expanded={open}
                className="flex w-full cursor-pointer items-center gap-2 border-none bg-transparent px-0 py-2.5 text-left"
            >
                <Icon
                    name={open ? "chevron-down" : "chevron-right"}
                    size={13}
                    color={T.TEXT_MUTED}
                />
                <span
                    className="min-w-0 flex-1 truncate font-semibold"
                    style={{ fontSize: 13, color: T.TEXT }}
                >
                    {title}
                </span>
                {!open && summary != null && (
                    <span
                        className="shrink-0 truncate"
                        style={{ fontSize: 12, color: T.TEXT_MUTED, maxWidth: 140 }}
                    >
                        {summary}
                    </span>
                )}
            </button>
            {open && <div className="pb-2 pl-5">{children}</div>}
        </div>
    );
}
