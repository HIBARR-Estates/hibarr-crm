import { useTd } from "@/Hooks/useDynamicTranslation";
import type { Deal } from "@/Types/api/deals";
import DealPanelHeader from "../../primitives/DealPanelHeader";

interface WorkspaceDealDetailsCardProps {
    deal: Deal;
}

function ReadField({
    label,
    value,
}: {
    label: string;
    value: string | null | undefined;
}) {
    return (
        <div className="mb-3.5">
            <div className="mb-1 text-[11px] uppercase tracking-[0.05em] text-[#9ca3af]">
                {label}
            </div>
            <div
                className={`text-[13px] leading-relaxed ${
                    value ? "text-[#1a1f2e]" : "italic text-[#9ca3af]"
                }`}
            >
                {value || "Not set"}
            </div>
        </div>
    );
}

export default function WorkspaceDealDetailsCard({
    deal,
}: WorkspaceDealDetailsCardProps) {
    const { td } = useTd();
    const packageLabel =
        deal.packages?.map((pkg) => pkg.name).filter(Boolean).join(", ") || null;
    const propertiesLabel =
        deal.hibarr_fields?.interested_in ||
        deal.hibarr_fields?.message ||
        null;

    return (
        <section className="mb-3 overflow-hidden rounded-[10px] border border-[#e2e5ea] bg-white">
            <DealPanelHeader title={td("Deal details")} />
            <div className="p-[13px]">
                <ReadField label={td("Package selected")} value={packageLabel} />
                <ReadField
                    label={td("Properties they'd like to buy")}
                    value={propertiesLabel}
                />
                <ReadField
                    label={td("Pipeline")}
                    value={deal.pipeline?.name ? td(deal.pipeline.name) : null}
                />
                <ReadField
                    label={td("Stage")}
                    value={deal.lead_stage?.name ? td(deal.lead_stage.name) : null}
                />
            </div>
        </section>
    );
}
