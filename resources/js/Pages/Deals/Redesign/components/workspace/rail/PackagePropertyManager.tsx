import { useCallback, useMemo, useState } from "react";
import axios from "axios";
import { useTd } from "@/Hooks/useDynamicTranslation";
import useTranslation from "@/Hooks/useTranslation";
import { useFormData } from "@/Hooks/useFormData";
import { useDealPermissions } from "@/Hooks/useDealPermissions";
import { isDealEffectivelyLocked } from "@/lib/dealOutcome";
import ManageDealPropertiesModal from "@/Features/Deals/Properties/AttachPropertiesModal";
import type { Deal } from "@/Types/api/deals";
import DealIcon from "../../primitives/DealIcon";
import DealMenuSelect from "../../primitives/DealMenuSelect";
import useDealPackages from "../../../hooks/useDealPackages";
import { useDealWorkspace } from "../../../context/DealWorkspaceContext";
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
    const { t } = useTranslation();
    const permissions = useDealPermissions(deal);
    const { addPackage, removePackage, saving } = useDealPackages(deal);
    const { setDeal } = useDealWorkspace();
    const [propertyModalOpen, setPropertyModalOpen] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [removingProductId, setRemovingProductId] = useState<number | null>(
        null,
    );

    const refreshDeal = useCallback(async () => {
        setRefreshing(true);
        try {
            const response = await axios.get(route("deals.refresh", deal.id));
            if (response.data?.status === "success" && response.data?.data) {
                setDeal(response.data.data);
            }
        } finally {
            setRefreshing(false);
        }
    }, [deal.id, setDeal]);

    // Mirrors DealPackagePropertyManager's removeProperty (Deal Info tab) — the
    // Dossier rail only ever had an "add" control for properties.
    const removeProperty = useCallback(
        async (productId: number) => {
            setRemovingProductId(productId);
            try {
                await axios.delete(
                    route("deals.properties.destroy", [deal.id, productId]),
                );
                await refreshDeal();
            } finally {
                setRemovingProductId(null);
            }
        },
        [deal.id, refreshDeal],
    );

    const packages = deal.packages ?? [];
    const products = deal.products ?? [];
    const isLocked = isDealEffectivelyLocked(deal);
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
        ? t("pages.deals.dossier.banner_over_limit")
        : hasPackage
          ? t("pages.deals.dossier.banner_package_deal")
          : hasProperty
            ? t("pages.deals.dossier.banner_property_deal")
            : t("pages.deals.dossier.banner_single_limit");

    return (
        <div>
            {restrictPackageOrProperty && (
                <div
                    className="mb-3 flex items-start gap-2 rounded-lg border px-2.5 py-2 text-[12px] leading-relaxed"
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
                        className="mb-2 pb-1.5 text-[12px] font-bold uppercase tracking-[0.05em]"
                        style={{
                            color: T.TEXT_MUTED,
                            borderBottom: `1px solid ${T.BORDER_SOFT}`,
                        }}
                    >
                        {restrictPackageOrProperty
                            ? t("pages.deals.dossier.package_singular")
                            : t("pages.deals.dossier.package_plural")}
                    </div>
                    {packages.length === 0 ? (
                        <div className="mb-2 text-xs italic" style={{ color: T.TEXT_MUTED }}>
                            {t("pages.deals.dossier.no_packages")}
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
                                        <div className="text-[12px]" style={{ color: T.TEXT_MUTED }}>
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
                                        aria-label={`${t("pages.deals.common.remove")} ${pkg.name}`}
                                        onClick={() => removePackage(pkg.id)}
                                    >
                                        {t("pages.deals.common.remove")}
                                    </button>
                                )}
                            </div>
                        ))
                    )}
                    {showPackageAdd && (
                        <div className="mb-2">
                            <DealMenuSelect
                                value={null}
                                placeholder={`+ ${t("pages.deals.dossier.add_package")}`}
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
                        className="mb-2 mt-1 flex items-center gap-1.5 pb-1.5 text-[12px] font-bold uppercase tracking-[0.05em]"
                        style={{
                            color: T.TEXT_MUTED,
                            borderBottom: `1px solid ${T.BORDER_SOFT}`,
                        }}
                    >
                        {restrictPackageOrProperty
                            ? t("pages.deals.dossier.property_singular")
                            : t("pages.deals.dossier.property_plural")}
                        {refreshing && (
                            <span
                                aria-hidden="true"
                                className="animate-spin rounded-full border-2 border-solid border-current border-t-transparent normal-case"
                                style={{ width: 10, height: 10 }}
                            />
                        )}
                    </div>
                    {products.length === 0 ? (
                        <div className="mb-2 text-xs italic" style={{ color: T.TEXT_MUTED }}>
                            {t("pages.deals.dossier.no_properties_attached")}
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
                                    {product.property?.price != null && (
                                        <div className="text-[12px]" style={{ color: T.TEXT_MUTED }}>
                                            {money(product.property.price)}
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
                                        disabled={removingProductId === product.id}
                                        aria-label={`${t("pages.deals.common.remove")} ${product.property?.title || product.name}`}
                                        onClick={() => removeProperty(product.id)}
                                    >
                                        {t("pages.deals.common.remove")}
                                    </button>
                                )}
                            </div>
                        ))
                    )}
                    {showPropertyAdd && (
                        <div className="mb-4">
                            <button
                                type="button"
                                className="dr-btn dr-btn-sm cursor-pointer"
                                style={{
                                    background: T.WHITE,
                                    color: T.TEXT_MUTED,
                                    border: `1px solid ${T.BORDER}`,
                                    opacity: refreshing ? 0.6 : 1,
                                }}
                                disabled={refreshing}
                                onClick={() => setPropertyModalOpen(true)}
                            >
                                + {t("pages.deals.dossier.add_property")}
                            </button>
                        </div>
                    )}
                </>
            )}

            <ManageDealPropertiesModal
                open={propertyModalOpen}
                onClose={() => setPropertyModalOpen(false)}
                deal={deal}
                onRefresh={refreshDeal}
            />
        </div>
    );
}
