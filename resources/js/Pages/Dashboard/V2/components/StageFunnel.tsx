import { Empty } from "antd";
import { useTd } from "@/Hooks/useDynamicTranslation";

export interface StageFunnelDatum {
    id: number;
    name: string;
    count: number;
}

interface StageFunnelProps {
    data: StageFunnelDatum[];
    /** Shown under each bar once the previous stage has volume to compare against. */
    showConversion?: boolean;
}

/**
 * Horizontal stage funnel. Bar width is relative to the largest stage, not to the
 * first — stages aren't strictly sequential in every pipeline here, so anchoring
 * on the first stage would render most bars as slivers.
 */
export default function StageFunnel({
    data,
    showConversion = true,
}: StageFunnelProps) {
    const { td } = useTd();

    if (!data.length) {
        return <Empty description={td("No pipeline stages to show")} />;
    }

    const max = Math.max(...data.map((stage) => stage.count), 1);

    return (
        <div className="flex flex-col gap-3">
            {data.map((stage, index) => {
                const previous = index > 0 ? data[index - 1] : null;
                const conversion =
                    showConversion && previous && previous.count > 0
                        ? Math.round((stage.count / previous.count) * 100)
                        : null;

                return (
                    <div key={stage.id} className="flex items-center gap-3">
                        <div className="w-40 shrink-0 truncate text-sm text-slate-600">
                            {td(stage.name)}
                        </div>

                        <div className="h-7 flex-1 overflow-hidden rounded bg-slate-100">
                            <div
                                className="flex h-full items-center justify-end rounded bg-sky-500 px-2 transition-all"
                                style={{
                                    width: `${Math.max(
                                        (stage.count / max) * 100,
                                        stage.count > 0 ? 4 : 0,
                                    )}%`,
                                }}
                            >
                                {stage.count > 0 && (
                                    <span className="text-xs font-medium text-white">
                                        {stage.count}
                                    </span>
                                )}
                            </div>
                        </div>

                        <div className="w-16 shrink-0 text-right text-xs text-slate-400">
                            {conversion !== null ? `${conversion}%` : ""}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
