import { useTd } from "@/Hooks/useDynamicTranslation";
import DealPanelHeader from "../../primitives/DealPanelHeader";
import type useDealStageFocus from "../../../hooks/useDealStageFocus";
import { DEAL_REDESIGN_TOKENS as T } from "../../../tokens";

type StageFocusData = ReturnType<typeof useDealStageFocus>;

interface WorkspaceStageFocusCardProps {
    focus: StageFocusData;
    onViewAll: () => void;
}

export default function WorkspaceStageFocusCard({
    focus,
    onViewAll,
}: WorkspaceStageFocusCardProps) {
    const { td } = useTd();

    return (
        <section className="mb-3 overflow-hidden rounded-[10px] border border-[#e2e5ea] bg-white">
            <DealPanelHeader
                title={td("Stage focus")}
                rightSlot={
                    <button
                        type="button"
                        onClick={onViewAll}
                        className="border-none bg-transparent text-[11px] font-semibold tracking-[0.03em] text-white/85 hover:text-white"
                    >
                        {td("All fields")}
                    </button>
                }
            />
            <div className="px-[13px] py-[11px]">
                <div className="mb-2 flex items-center gap-1.5 text-[11px] text-[#9ca3af]">
                    <span
                        className="inline-block h-1.5 w-1.5 rounded-full"
                        style={{ background: T.BLUE }}
                    />
                    {focus.hasStageFocusMapping
                        ? `${td(focus.stageName)} — ${td("stage-specific focus")}`
                        : `${td(focus.stageName)} — ${td("to complete")}`}
                </div>

                {focus.missingItems.length === 0 ? (
                    <p className="text-[13px] font-medium text-[#047857]">
                        {td("All tracked fields complete for this stage")}
                    </p>
                ) : (
                    focus.missingItems.map((item) => (
                        <div
                            key={item.key}
                            className="mb-1.5 flex items-baseline justify-between gap-3"
                        >
                            <span className="text-xs text-[#5b6472]">
                                {td(item.label)}
                            </span>
                            <span className="text-xs italic text-[#9ca3af]">
                                {td("Not set")}
                            </span>
                        </div>
                    ))
                )}

                <div className="mt-3 border-t border-[#e2e5ea] pt-2.5">
                    <div className="mb-1 flex justify-between">
                        <span className="text-[11px] text-[#9ca3af]">
                            {td("Stage completion")}
                        </span>
                        <span className="text-[11px] text-[#5b6472]">
                            {focus.filledCount} {td("of")} {focus.totalCount}
                        </span>
                    </div>
                    <div className="h-[3px] overflow-hidden rounded-sm bg-[#e8eaed]">
                        <div
                            className="h-full rounded-sm"
                            style={{
                                width: `${focus.completionPercent}%`,
                                background: T.BLUE,
                            }}
                        />
                    </div>
                </div>
            </div>
        </section>
    );
}
