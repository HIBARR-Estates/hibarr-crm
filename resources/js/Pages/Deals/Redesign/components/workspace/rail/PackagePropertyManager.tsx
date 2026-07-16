import { useTd } from "@/Hooks/useDynamicTranslation";
import type { Deal } from "@/Types/api/deals";
import DealIcon from "../../primitives/DealIcon";
import { DEAL_REDESIGN_TOKENS as T } from "../../../tokens";

interface PackagePropertyManagerProps {
    deal: Deal;
    restrictPackageOrProperty: boolean;
    onManage?: () => void;
}

/**
 * Compact packages/properties summary ported from v2.2's PackagePropertyManager
 * (deal-v2-2.jsx:3120-3315), shown in the Dossier sidebar. v2.2's component was
 * dual-mode (compact + full, with inline add/replace/remove editing) because its
 * mock had no real backend. In this CRM, package attach/detach already works via
 * the "Packages" field in Deal Info > Overview (DealInfoSectionPanel) and property
 * attach/detach already works via ManageDealPropertiesModal in Deal Info >
 * Property — both real, working mutation surfaces. Rebuilding that editing UI a
 * second time here would just fork it, so this component is read-only display +
 * the same "1 package or property" exclusivity messaging, linking out to Deal
 * Info for edits rather than duplicating the edit controls.
 */
export default function PackagePropertyManager({
    deal,
    restrictPackageOrProperty,
    onManage,
}: PackagePropertyManagerProps) {
    const { td } = useTd();
    const packages = deal.packages ?? [];
    const products = deal.products ?? [];

    const hasPackage = packages.length > 0;
    const hasProperty = products.length > 0;
    const totalAttached = packages.length + products.length;
    const overLimit = restrictPackageOrProperty && totalAttached > 1;

    const showPackagesSection =
        !restrictPackageOrProperty || !hasProperty || overLimit;
    const showPropertiesSection =
        !restrictPackageOrProperty || !hasPackage || overLimit;

    const bannerMessage = overLimit
        ? td(
              "This deal has more packages/properties attached than the current CRM limit of one. Remove items to get back under the limit.",
          )
        : hasPackage
          ? td(
                "This is a package deal. To attach a property instead, remove the package first.",
            )
          : hasProperty
            ? td(
                  "This is a property deal. To attach a package instead, remove the property first.",
              )
            : td("This CRM is configured to allow only one package or property per deal.");

    return (
        <div>
            {restrictPackageOrProperty && (
                <div
                    className="mb-3 flex items-start gap-2 rounded-lg border px-2.5 py-2 text-[11px] leading-relaxed"
                    style={{
                        color: T.AMBER,
                        background: T.AMBER_SOFT,
                        borderColor: T.AMBER_MID,
                    }}
                >
                    <DealIcon name="info" size={13} className="mt-0.5 shrink-0" />
                    <span>{bannerMessage}</span>
                </div>
            )}

            {showPackagesSection && (
                <>
                    <div
                        className="mb-2 pb-1.5 text-[11px] font-bold uppercase tracking-[0.05em]"
                        style={{ color: T.TEXT_MUTED, borderBottom: `1px solid ${T.BORDER_SOFT}` }}
                    >
                        {restrictPackageOrProperty ? td("Package") : td("Packages")}
                    </div>
                    {packages.length === 0 ? (
                        <div
                            className="mb-2 text-xs italic"
                            style={{ color: T.TEXT_MUTED }}
                        >
                            {td("No packages attached")}
                        </div>
                    ) : (
                        packages.map((pkg) => (
                            <div key={pkg.id} className="dr-card flex items-center gap-2">
                                <div
                                    className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-lg"
                                    style={{ background: T.SURFACE_2, border: `1px solid ${T.BORDER}` }}
                                >
                                    <DealIcon name="briefcase" size={12} color={T.TEXT_MUTED} />
                                </div>
                                <div className="min-w-0 flex-1">
                                    <div className="truncate text-xs font-semibold">
                                        {td(pkg.name)}
                                    </div>
                                    {pkg.value != null && (
                                        <div className="text-[11px]" style={{ color: T.TEXT_MUTED }}>
                                            {deal.currency?.currency_symbol || ""}
                                            {Number(pkg.value).toLocaleString()}
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))
                    )}
                </>
            )}

            {showPropertiesSection && (
                <>
                    <div
                        className="mb-2 mt-1 pb-1.5 text-[11px] font-bold uppercase tracking-[0.05em]"
                        style={{ color: T.TEXT_MUTED, borderBottom: `1px solid ${T.BORDER_SOFT}` }}
                    >
                        {restrictPackageOrProperty ? td("Property") : td("Properties")}
                    </div>
                    {products.length === 0 ? (
                        <div
                            className="mb-2 text-xs italic"
                            style={{ color: T.TEXT_MUTED }}
                        >
                            {td("No properties attached")}
                        </div>
                    ) : (
                        products.map((product) => (
                            <div key={product.id} className="dr-card flex items-center gap-2">
                                <div
                                    className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-lg"
                                    style={{ background: T.SURFACE_2, border: `1px solid ${T.BORDER}` }}
                                >
                                    <DealIcon name="building" size={12} color={T.TEXT_MUTED} />
                                </div>
                                <div className="min-w-0 flex-1">
                                    <div className="truncate text-xs font-semibold">
                                        {product.property?.title || product.name}
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </>
            )}

            {onManage && (
                <button
                    type="button"
                    className="mt-1 text-xs font-medium"
                    style={{ color: T.BLUE, background: "none", border: "none", cursor: "pointer", padding: 0 }}
                    onClick={onManage}
                >
                    {td("Manage packages & properties")} ↗
                </button>
            )}
        </div>
    );
}
