import type { ReactNode } from "react";
import Button from "./Button";
import Icon from "./Icon";
import { REDESIGN_TOKENS as T } from "../tokens";

interface EmptyStateAction {
    label: string;
    onClick: () => void;
    /**
     * Defaults to a "plus" glyph, matching the Exposés panel's Add button.
     * Pass `null` for an action that isn't an "add" (e.g. clearing a filter),
     * which renders the label on its own.
     */
    icon?: ReactNode | null;
    disabled?: boolean;
    loading?: boolean;
}

interface EmptyStateProps {
    title?: string;
    description?: string;
    /**
     * Glyph for the circular badge — any name the Icon primitive knows.
     * Give each tab its own so the states stay distinguishable at a glance.
     */
    icon?: string;
    /**
     * Optional call to action. Rendered as the full-size primary button (the
     * same one the Exposés panel header uses) rather than a small/ghost one:
     * an empty tab has nothing else competing for attention, so the primary
     * action should be the obvious thing to click.
     */
    action?: EmptyStateAction;
    /**
     * "status" (default) for an ordinary nothing-here state; "alert" for a
     * failure, which screen readers announce more assertively.
     */
    role?: "status" | "alert";
}

/**
 * The one empty state every Deal/Lead workspace tab uses — layout lifted from
 * the Exposés tab, which is the reference design: dashed card, circular icon
 * badge, title, hint, optional primary action.
 *
 * Entity-agnostic on purpose: it knows nothing about deals, leads or what the
 * tab holds. Callers pass their own copy and icon, so a new tab gets a
 * consistent empty state without copying markup — and a change to the design
 * lands everywhere at once instead of drifting per tab.
 */
export default function EmptyState({
    title,
    description,
    icon = "file-text",
    action,
    role = "status",
}: EmptyStateProps) {
    return (
        <div
            role={role}
            className="rounded-[10px] border border-dashed px-3.5 py-6 text-center"
            style={{ borderColor: T.BORDER, background: T.SURFACE_2 }}
        >
            <div
                aria-hidden="true"
                className={`mx-auto flex h-[38px] w-[38px] items-center justify-center rounded-full${title || description ? " mb-2" : ""}`}
                style={{ background: T.BLUE_LIGHT }}
            >
                <Icon name={icon} size={17} color={T.BLUE_DARK} />
            </div>
            {title && (
                <div
                    className="mb-[3px] text-[13px] font-semibold"
                    style={{ color: T.TEXT }}
                >
                    {title}
                </div>
            )}
            {description && (
                <div
                    className={`text-xs leading-relaxed${title ? "" : " text-[13px] font-semibold"}`}
                    style={{ color: title ? T.TEXT_MUTED : T.TEXT }}
                >
                    {description}
                </div>
            )}
            {action && (
                <Button
                    variant="primary"
                    className="mt-3.5"
                    onClick={action.onClick}
                    disabled={action.disabled}
                    loading={action.loading}
                    icon={
                        action.icon === undefined ? (
                            <Icon name="plus" size={15} />
                        ) : (
                            action.icon
                        )
                    }
                >
                    {action.label}
                </Button>
            )}
        </div>
    );
}
