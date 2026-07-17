import { useMemo, useState } from "react";
import { router } from "@inertiajs/react";
import { useTd } from "@/Hooks/useDynamicTranslation";
import { useFormData } from "@/Hooks/useFormData";
import { useDealPermissions } from "@/Hooks/useDealPermissions";
import ManageDealPropertiesModal from "@/Features/Deals/Properties/AttachPropertiesModal";
import type { Deal } from "@/Types/api/deals";
import DealIcon from "../../primitives/DealIcon";
import DealMenuSelect from "../../primitives/DealMenuSelect";
import useDealPackages from "../../../hooks/useDealPackages";
import { DEAL_REDESIGN_TOKENS as T } from "../../../tokens";

interface PackageOption {
    id: number;
    name: string;
    value?: number;
}

interface PackagePropertyManagerProps {
    deal: Deal;
    restrictPackageOrProperty: boolean;
}

/**
 * Compact packages/properties editor for the Dossier, ported from v2.2's
 * PackagePropertyManager (deal-v2-2.jsx:3120-3315). Packages attach/detach via
 * the real `package_id` inline-update; properties attach via the existing
 * ManageDealPropertiesModal. Respects the "1 package or property" CRM limit.
 */
export default function PackagePropertyManager({
    deal,
    restrictPackageOrProperty,
}: PackagePropertyManagerProps) {
    const { td } = useTd();
    const permissions = useDealPermissions(deal);
    const { addPackage, removePackage, saving } = useDealPackages(deal);
    const [propertyModalOpen, setPropertyModalOpen] = useState(false);

    const packages = deal.packages ?? [];
    const products = deal.products ?? [];
    const isLocked = !!deal.is_locked;
    const canEdit = permissions.canEdit;

    const hasPackage = packages.length > 0;
    const hasProperty = products.length > 0;
    const totalAttached = packages.length + products.length;
    const overLimit = restrictPackageOrProperty && totalAttached > 1;

    const showPackagesSection =
        !restrictPackageOrProperty || !hasProperty || overLimit;
    const showPropertiesSection =
        !restrictPackageOrProperty || !hasPackage || overLimit;
    const showPackageAdd =
        canEdit &&
        !isLocked &&
        showPackagesSection &&
        (!restrictPackageOrProperty || packages.length === 0);
    const showPropertyAdd =
        canEdit &&
        !isLocked &&
        showPropertiesSection &&
        (!restrictPackageOrProperty || products.length === 0);

    const { data } = useFormData<PackageOption>("packages", {
        per_page: 50,
        paginate: false,
        enabled: showPackageAdd,
    });
    const availablePackages = useMemo(
        () =>
            ((data as PackageOption[] | undefined) ?? []).filter(
                (option) => !packages.some((pkg) => pkg.id === option.id),
            ),
        [data, packages],
    );

    const currencySymbol = deal.currency?.currency_symbol || "";
    const money = (value?: number | null) =>
        value == null ? "" : `${currencySymbol}${Number(value).toLocaleString()}`;

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
                        style={{
                            color: T.TEXT_MUTED,
                            borderBottom: `1px solid ${T.BORDER_SOFT}`,
                        }}
                    >
                        {restrictPackageOrProperty ? td("Package") : td("Packages")}
                    </div>
                    {packages.length === 0 ? (
                        <div className="mb-2 text-xs italic" style={{ color: T.TEXT_MUTED }}>
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
                                            {money(pkg.value)}
                                        </div>
                                    )}
                                </div>
                                {canEdit && !isLocked && (
                                    <button
                                        type="button"
                                        className="dr-btn dr-btn-sm cursor-pointer"
                                        style={{
                                            color: T.RED,
                                            background: "transparent",
                                            border: "none",
                                        }}
                                        disabled={saving}
                                        aria-label={`${td("Remove")} ${pkg.name}`}
                                        onClick={() => removePackage(pkg.id)}
                                    >
                                        {td("Remove")}
                                    </button>
                                )}
                            </div>
                        ))
                    )}
                    {showPackageAdd && (
                        <div className="mb-2">
                            <DealMenuSelect
                                value={null}
                                placeholder={`+ ${td("Add package")}`}
                                size="sm"
                                width={150}
                                disabled={saving || availablePackages.length === 0}
                                options={availablePackages.map((option) => ({
                                    value: option.id,
                                    label: option.value
                                        ? `${option.name} · ${money(option.value)}`
                                        : option.name,
                                }))}
                                onChange={(value) => addPackage(Number(value))}
                            />
                        </div>
                    )}
                </>
            )}

            {showPropertiesSection && (
                <>
                    <div
                        className="mb-2 mt-1 pb-1.5 text-[11px] font-bold uppercase tracking-[0.05em]"
                        style={{
                            color: T.TEXT_MUTED,
                            borderBottom: `1px solid ${T.BORDER_SOFT}`,
                        }}
                    >
                        {restrictPackageOrProperty ? td("Property") : td("Properties")}
                    </div>
                    {products.length === 0 ? (
                        <div className="mb-2 text-xs italic" style={{ color: T.TEXT_MUTED }}>
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
                    {showPropertyAdd && (
                        <div className="mb-1">
                            <button
                                type="button"
                                className="dr-btn dr-btn-sm cursor-pointer"
                                style={{
                                    background: T.WHITE,
                                    color: T.TEXT_MUTED,
                                    border: `1px solid ${T.BORDER}`,
                                }}
                                onClick={() => setPropertyModalOpen(true)}
                            >
                                + {td("Add property")}
                            </button>
                        </div>
                    )}
                </>
            )}

            <ManageDealPropertiesModal
                open={propertyModalOpen}
                onClose={() => setPropertyModalOpen(false)}
                deal={deal}
                onRefresh={() => router.reload({ only: ["deal"] })}
            />
        </div>
    );
}
