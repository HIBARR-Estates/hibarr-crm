import type { IntegrationOrigin } from "@/Types/api/note";
import Icon from "./Icon";
import { REDESIGN_TOKENS as T } from "../tokens";

const ORIGIN_ICON: Record<string, string> = {
    sally: "message-circle",
    max: "spark",
    meeting_bot: "bot",
};

const ORIGIN_LABEL: Record<string, string> = {
    sally: "Created by Sally",
    max: "Created by Max",
    meeting_bot: "Created by Meeting Bot",
};

interface IntegrationOriginBadgeProps {
    origin: IntegrationOrigin | null | undefined;
    size?: number;
    className?: string;
}

/** Marks a note/task created by an integration (Sally, Max, or a meeting bot) — renders nothing for CRM-user-created records. */
export default function IntegrationOriginBadge({
    origin,
    size = 13,
    className,
}: IntegrationOriginBadgeProps) {
    if (!origin || !ORIGIN_ICON[origin]) return null;
    return (
        <span
            className={`inline-flex shrink-0 items-center${className ? ` ${className}` : ""}`}
            style={{ color: T.TEXT_MUTED }}
            title={ORIGIN_LABEL[origin]}
        >
            <Icon name={ORIGIN_ICON[origin]} size={size} />
        </span>
    );
}
