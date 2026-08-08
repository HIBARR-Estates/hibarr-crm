import { Empty, Progress, Tooltip } from "antd";
import { useTd } from "@/Hooks/useDynamicTranslation";

export interface SourceBreakdownRow {
    id: number;
    name: string;
    count: number;
    /** How many of those leads reached a tracked first contact. */
    contacted: number;
}

interface SourceBreakdownProps {
    rows: SourceBreakdownRow[];
    maxRows?: number;
}

/**
 * Lead volume and follow-through by source.
 *
 * Volume and contact rate only — there is deliberately no cost, CPL, or ROI
 * column. No spend data is fed into the CRM for any channel (the Meta
 * integration is outbound Conversions API only), so a cost column here would
 * imply a parity across channels that does not exist.
 */
export default function SourceBreakdown({
    rows,
    maxRows = 10,
}: SourceBreakdownProps) {
    const { td } = useTd();

    const visible = rows.filter((row) => row.count > 0).slice(0, maxRows);

    if (!visible.length) {
        return <Empty description={td("No leads attributed to a source yet")} />;
    }

    const max = Math.max(...visible.map((row) => row.count), 1);

    return (
        <div className="flex flex-col gap-3">
            {visible.map((row) => {
                const contactRate = Math.round((row.contacted / row.count) * 100);

                return (
                    <div key={row.id} className="flex items-center gap-3">
                        <div className="w-32 shrink-0 truncate text-sm text-slate-600">
                            {td(row.name)}
                        </div>

                        <div className="flex-1">
                            <Progress
                                percent={(row.count / max) * 100}
                                showInfo={false}
                                strokeColor="#0ea5e9"
                                size="small"
                            />
                        </div>

                        <div className="w-12 shrink-0 text-right text-sm font-medium text-slate-700">
                            {row.count}
                        </div>

                        <Tooltip
                            title={td("Share of these leads that were contacted")}
                        >
                            <div className="w-14 shrink-0 text-right text-xs text-slate-400">
                                {contactRate}%
                            </div>
                        </Tooltip>
                    </div>
                );
            })}
        </div>
    );
}
