import React from "react";
import { Link } from "@inertiajs/react";
import { PersonIcon, BriefcaseIcon } from "@/Components/icons";

export type TaskEntityType = "deal" | "lead" | "property";

export interface TaskEntityLinkProps {
    type: TaskEntityType;
    id: number;
    name: string;
    className?: string;
    iconClassName?: string;
    /** Stops the click from bubbling up to a parent row's onClick (e.g. "open task" handlers). */
    stopPropagation?: boolean;
}

/**
 * Renders the same icon used for Deals/Leads in the main navigation next to the
 * entity's name, as a clickable link to that entity's detail page. Used anywhere
 * a task row/modal needs to surface "this task belongs to Deal X" / "Lead Y".
 */
const TaskEntityLink: React.FC<TaskEntityLinkProps> = ({
    type,
    id,
    name,
    className = "",
    iconClassName = "",
    stopPropagation = true,
}) => {
    if (type === "property") {
        // Properties don't have a nav icon counterpart today; render as plain text link.
        return (
            <span className={`inline-flex items-center gap-1 truncate ${className}`}>
                {name}
            </span>
        );
    }

    const href =
        type === "deal"
            ? route("deals.show", id)
            : route("lead-contact.show", id);

    const Icon = type === "deal" ? BriefcaseIcon : PersonIcon;

    return (
        <Link
            href={href}
            onClick={(e) => {
                if (stopPropagation) e.stopPropagation();
            }}
            className={`inline-flex items-center gap-1 truncate text-sm text-blue-600 underline decoration-blue-300 underline-offset-2 hover:text-blue-800 hover:decoration-blue-600 ${className}`}
        >
            <Icon
                width={11}
                height={11}
                className={`shrink-0 ${iconClassName}`}
            />
            <span className="truncate">{name}</span>
        </Link>
    );
};

export default TaskEntityLink;
