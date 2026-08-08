import { Empty, Tag } from "antd";
import { Link } from "@inertiajs/react";
import { useTd } from "@/Hooks/useDynamicTranslation";

export interface ActionQueueItem {
    /** Stable key — ids repeat across groups, so callers namespace them. */
    key: string;
    label: string;
    /** Short right-aligned reason, e.g. "6 days overdue". */
    meta: string;
    href?: string;
    severity: "overdue" | "hot" | "stalled";
}

export interface ActionQueueGroup {
    title: string;
    items: ActionQueueItem[];
}

interface ActionQueueProps {
    groups: ActionQueueGroup[];
}

const SEVERITY_COLOR: Record<ActionQueueItem["severity"], string> = {
    overdue: "red",
    hot: "volcano",
    stalled: "gold",
};

/**
 * The agent view's centrepiece: a ranked list of things to act on, not a chart.
 *
 * Groups arrive pre-ranked from the caller — already-late work outranks merely
 * hot work — so this component renders order rather than deciding it.
 */
export default function ActionQueue({ groups }: ActionQueueProps) {
    const { td } = useTd();

    const total = groups.reduce((sum, group) => sum + group.items.length, 0);

    if (total === 0) {
        return <Empty description={td("Nothing needs your attention right now")} />;
    }

    return (
        <div className="flex flex-col gap-5">
            {groups
                .filter((group) => group.items.length > 0)
                .map((group) => (
                    <section key={group.title}>
                        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                            {td(group.title)}{" "}
                            <span className="text-slate-400">
                                ({group.items.length})
                            </span>
                        </h3>

                        <ul className="flex flex-col divide-y divide-slate-100 rounded border border-slate-100">
                            {group.items.map((item) => {
                                const body = (
                                    <div className="flex items-center justify-between gap-3 px-3 py-2 hover:bg-slate-50">
                                        <span className="truncate text-sm text-slate-700">
                                            {item.label}
                                        </span>
                                        <Tag
                                            color={SEVERITY_COLOR[item.severity]}
                                            className="shrink-0"
                                        >
                                            {item.meta}
                                        </Tag>
                                    </div>
                                );

                                return (
                                    <li key={item.key}>
                                        {item.href ? (
                                            <Link href={item.href} className="block">
                                                {body}
                                            </Link>
                                        ) : (
                                            body
                                        )}
                                    </li>
                                );
                            })}
                        </ul>
                    </section>
                ))}
        </div>
    );
}
