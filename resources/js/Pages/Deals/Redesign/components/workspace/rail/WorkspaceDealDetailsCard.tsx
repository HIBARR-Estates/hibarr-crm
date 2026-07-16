import { useTd } from "@/Hooks/useDynamicTranslation";
import type { Deal } from "@/Types/api/deals";
import DealPanelHeader from "../../primitives/DealPanelHeader";
import PackagePropertyManager from "./PackagePropertyManager";

interface WorkspaceDealDetailsCardProps {
    deal: Deal;
    restrictPackageOrProperty: boolean;
    onManagePackagesProperties?: () => void;
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
    restrictPackageOrProperty,
    onManagePackagesProperties,
}: WorkspaceDealDetailsCardProps) {
    const { td } = useTd();

    return (
        <section className="mb-3 overflow-hidden rounded-[10px] border border-[#e2e5ea] bg-white">
            <DealPanelHeader title={td("Deal details")} />
            <div className="p-[13px]">
                <ReadField
                    label={td("Pipeline")}
                    value={deal.pipeline?.name ? td(deal.pipeline.name) : null}
                />
                <ReadField
                    label={td("Stage")}
                    value={deal.lead_stage?.name ? td(deal.lead_stage.name) : null}
                />
                <PackagePropertyManager
                    deal={deal}
                    restrictPackageOrProperty={restrictPackageOrProperty}
                    onManage={onManagePackagesProperties}
                />
            </div>
        </section>
    );
}
