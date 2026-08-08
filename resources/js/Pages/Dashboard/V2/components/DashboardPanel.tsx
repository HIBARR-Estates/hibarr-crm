import { Card, Skeleton } from "antd";
import { useTd } from "@/Hooks/useDynamicTranslation";

interface DashboardPanelProps {
    /** English source string — translated at render via td(). */
    title: string;
    /** Optional caveat shown under the title, e.g. a known data limitation. */
    note?: string;
    extra?: React.ReactNode;
    children: React.ReactNode;
}

export default function DashboardPanel({
    title,
    note,
    extra,
    children,
}: DashboardPanelProps) {
    const { td } = useTd();

    return (
        <Card
            size="small"
            title={
                <div className="py-1">
                    <div className="text-sm font-semibold">{td(title)}</div>
                    {note && (
                        <div className="text-xs font-normal text-slate-400">
                            {td(note)}
                        </div>
                    )}
                </div>
            }
            extra={extra}
        >
            {children}
        </Card>
    );
}

/** Fallback for <Deferred> while a panel's data is in flight. */
export function PanelSkeleton({ rows = 4 }: { rows?: number }) {
    return <Skeleton active paragraph={{ rows }} title={false} />;
}
