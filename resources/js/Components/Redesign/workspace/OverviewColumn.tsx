import type { ReactNode } from "react";
import useTranslation from "@/Hooks/useTranslation";
import Button from "../primitives/Button";
import EmptyState from "../primitives/EmptyState";
import { REDESIGN_TOKENS as T } from "../tokens";

export interface OverviewColumnEmptyMeta {
    icon: string;
    title: string;
    hint: string;
    actionLabel: string;
}

export interface OverviewColumnProps {
    title: string;
    count: number;
    total: number;
    onAdd: () => void;
    onViewAll: () => void;
    empty: OverviewColumnEmptyMeta;
    isEmpty: boolean;
    /** Hides add affordances when the user lacks permission. */
    canAdd?: boolean;
    children: ReactNode;
}

/**
 * One column in the Deal/Lead workspace Overview tab (notes / tasks / meetings).
 * Shared so both pages stay aligned — same header, empty state, view-all link.
 */
export default function OverviewColumn({
    title,
    count,
    total,
    onAdd,
    onViewAll,
    empty,
    isEmpty,
    canAdd = true,
    children,
}: OverviewColumnProps) {
    const { t } = useTranslation();
    return (
        <div className="dr-ov-col">
            <div className="mb-2.5 flex items-center justify-between gap-2">
                <span className="dr-label">
                    {title}{" "}
                    <span style={{ fontWeight: 400 }}>· {count}</span>
                </span>
                {!isEmpty && canAdd && (
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={onAdd}
                        aria-label={`${t("pages.deals.workspace.overview.add")} - ${title}`}
                    >
                        + {t("pages.deals.workspace.overview.add")}
                    </Button>
                )}
            </div>
            <div
                className={
                    isEmpty ? "dr-ov-col-empty" : "dr-ov-col-body"
                }
            >
                {isEmpty ? (
                    <EmptyState
                        icon={empty.icon}
                        title={empty.title}
                        description={empty.hint}
                        balancedDescription
                        className="flex flex-col items-center justify-center py-[22px]"
                        style={{ background: T.SURFACE }}
                        action={
                            canAdd
                                ? {
                                      label: `+ ${empty.actionLabel}`,
                                      onClick: onAdd,
                                      icon: null,
                                  }
                                : undefined
                        }
                    />
                ) : (
                    children
                )}
            </div>
            {total > 0 && (
                <button
                    type="button"
                    onClick={onViewAll}
                    className="mt-2 cursor-pointer border-none bg-transparent px-0 py-1.5 text-left text-xs font-semibold"
                    style={{ color: T.BLUE }}
                >
                    {t("pages.deals.workspace.overview.view_all")} →
                </button>
            )}
        </div>
    );
}
