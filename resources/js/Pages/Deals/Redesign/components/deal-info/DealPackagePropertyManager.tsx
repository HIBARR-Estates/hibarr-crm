import axios from "axios";
import { Tooltip } from "antd";
import { useFormData } from "@/Hooks/useFormData";
import useTranslation from "@/Hooks/useTranslation";
import { useTd } from "@/Hooks/useDynamicTranslation";
import type { Deal } from "@/Types/api/deals";
import { isDealValueLocked } from "@/lib/dealOutcome";
import DealBadge from "../primitives/DealBadge";
import DealButton from "../primitives/DealButton";
import DealIcon from "../primitives/DealIcon";
import DealMenuSelect from "../primitives/DealMenuSelect";
import { DEAL_REDESIGN_TOKENS as T } from "../../tokens";
import usePipelineHasPackages from "../../hooks/usePipelineHasPackages";
import useSinglePackageMode from "../../hooks/useSinglePackageMode";

/**
 * 1:1 port of v2.2's PackagePropertyManager (deal-v2-2.jsx:3118-3315) — the
 * shared packages/properties editor for the Deal info Overview. Packages are
 * fully inline (add/replace/remove via menus); properties are listed inline
 * with detach + "View", while "+ Add property" opens the existing rich
 * attach modal (project units, price/floor overrides, offers) which v2.2's
 * mock inline search does not cover.
 */

type BadgeVariant = "green" | "navy" | "gray" | "blue";

const PROPERTY_STATUS_VARIANT: Record<string, BadgeVariant> = {
    available: "green",
    under_offer: "navy",
    sold: "gray",
    rented: "blue",
    withdrawn: "gray",
};

// Stable ref so useFormData doesn't refetch on every render.
const PACKAGE_PARAMS = { paginate: false, per_page: 100 };

function formatMoney(amount: number | null | undefined, symbol: string) {
    if (amount == null) return "—";
    return `${symbol}${Number(amount).toLocaleString()}`;
}

interface PackagePoolItem {
    id: number;
    name: string;
    value?: number;
}

interface DealPackagePropertyManagerProps {
    deal: Deal;
    canEdit: boolean;
    restrictPackageOrProperty: boolean;
    onFieldUpdate: (
        fieldName: string,
        value: unknown,
        type?: "details" | "contact" | "custom_field" | "hibarr_field",
    ) => Promise<void>;
    packagesLoading: boolean;
    onManageProperties: () => void;
    onRefresh: () => Promise<void> | void;
}

export default function DealPackagePropertyManager({
    deal,
    canEdit,
    restrictPackageOrProperty,
    onFieldUpdate,
    packagesLoading,
    onManageProperties,
    onRefresh,
}: DealPackagePropertyManagerProps) {
    const { t } = useTranslation();
    const { td } = useTd();
    // Packages/properties feed the deal value directly, so they stay locked
    // once commission has been distributed, even if the deal itself isn't.
    const valueLocked = isDealValueLocked(deal);
    const isLocked = !canEdit || valueLocked;
    const symbol = deal.currency?.currency_symbol ?? "";

    const packages = deal.packages ?? [];
    const products = deal.products ?? [];
    const packageIds = packages.map((pkg) => pkg.id);

    const { data: packagePoolRaw } = useFormData("packages", PACKAGE_PARAMS);
    const packagePool: PackagePoolItem[] = Array.isArray(packagePoolRaw)
        ? packagePoolRaw
        : [];

    // A package pipeline sells packages, not individual properties.
    const pipelineHasPackages = usePipelineHasPackages();
    // One package per deal: nothing to add once the deal has one.
    const singlePackageMode = useSinglePackageMode();

    const hasPackage = packages.length > 0;
    const hasProperty = products.length > 0;
    const totalAttached = packages.length + products.length;
    const overLimit = restrictPackageOrProperty && totalAttached > 1;

    // Under the restriction, the other section is removed from view entirely
    // once the deal has committed to being a package deal or a property deal —
    // both stay visible over the limit so it can be fixed. (v2.2:3132-3138)
    const showPackagesSection =
        !restrictPackageOrProperty || !hasProperty || overLimit;
    const showPropertiesSection =
        !pipelineHasPackages &&
        (!restrictPackageOrProperty || !hasPackage || overLimit);
    const showPackageAdd =
        !isLocked &&
        showPackagesSection &&
        (!restrictPackageOrProperty || packages.length === 0) &&
        (!singlePackageMode || packages.length === 0);
    const showPropertyAdd =
        !isLocked &&
        showPropertiesSection &&
        (!restrictPackageOrProperty || products.length === 0);

    const savePackages = (ids: number[]) => onFieldUpdate("package_id", ids);
    const addPackage = (id: number) => {
        if (!packageIds.includes(id)) savePackages([...packageIds, id]);
    };
    const replacePackage = (oldId: number, newId: number) =>
        savePackages(packageIds.map((x) => (x === oldId ? newId : x)));
    const removePackage = (id: number) =>
        savePackages(packageIds.filter((x) => x !== id));

    const removeProperty = async (productId: number) => {
        await axios.delete(
            route("deals.properties.destroy", [deal.id, productId]),
        );
        await onRefresh();
    };

    const packageLabel = (p: PackagePoolItem) =>
        p.value != null
            ? `${td(p.name, { source: "en" })} · ${formatMoney(p.value, symbol)}`
            : td(p.name, { source: "en" });

    const iconTile = (name: string) => (
        <div
            style={{
                width: 34,
                height: 34,
                borderRadius: 8,
                background: T.SURFACE_2,
                border: `1px solid ${T.BORDER}`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
            }}
        >
            <DealIcon name={name} size={16} color={T.TEXT_MUTED} />
        </div>
    );

    const sectionHeader = (label: string) => (
        <div
            style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                marginBottom: 16,
                paddingBottom: 6,
                borderBottom: `1px solid ${T.BORDER_SOFT}`,
            }}
        >
            <span className="dr-label">{label}</span>
            {valueLocked && (
                <Tooltip title={t("pages.deals.value_locked_tooltip")}>
                    <span style={{ color: T.TEXT_MUTED, display: "flex" }}>
                        <DealIcon name="lock" size={12} />
                    </span>
                </Tooltip>
            )}
        </div>
    );

    const emptyHint = (text: string) => (
        <div
            style={{
                fontSize: 12,
                color: T.TEXT_MUTED,
                fontStyle: "italic",
                marginBottom: 8,
            }}
        >
            {text}
        </div>
    );

    return (
        <div className="mb-5">
            {restrictPackageOrProperty && (
                <div
                    style={{
                        display: "flex",
                        alignItems: "flex-start",
                        gap: 8,
                        fontSize: 12,
                        color: T.AMBER,
                        background: T.AMBER_SOFT,
                        border: `1px solid ${T.AMBER_MID}`,
                        borderRadius: 8,
                        padding: "9px 11px",
                        marginBottom: 16,
                        lineHeight: 1.5,
                    }}
                >
                    <span style={{ marginTop: 1, flexShrink: 0 }}>
                        <DealIcon name="info" size={13} color={T.AMBER} />
                    </span>
                    <span>
                        {overLimit
                            ? t("pages.deals.dossier.banner_over_limit")
                            : hasPackage
                              ? t("pages.deals.dossier.banner_package_deal")
                              : hasProperty
                                ? t("pages.deals.dossier.banner_property_deal")
                                : t("pages.deals.dossier.banner_single_limit")}
                    </span>
                </div>
            )}

            {showPackagesSection && (
                <>
                    {sectionHeader(
                        restrictPackageOrProperty
                            ? t("pages.deals.info.pkgprop.package")
                            : t("pages.deals.info.fields.packages"),
                    )}
                    {packages.length === 0 &&
                        emptyHint(
                            showPackageAdd
                                ? t("pages.deals.info.pkgprop.pkg_empty_add")
                                : t("pages.deals.info.pkgprop.pkg_empty_locked"),
                        )}
                    {packages.map((pkg) => (
                        <div
                            key={pkg.id}
                            className="dr-card"
                            style={{
                                display: "flex",
                                alignItems: "center",
                                flexWrap: "wrap",
                                gap: 12,
                                padding: "10px 12px",
                            }}
                        >
                            <div
                                style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 12,
                                    flex: "1 1 180px",
                                    minWidth: 0,
                                }}
                            >
                                {iconTile("briefcase")}
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div
                                        style={{ fontSize: 13, fontWeight: 600 }}
                                    >
                                        {td(pkg.name, { source: "en" })}
                                    </div>
                                    {pkg.value != null && (
                                        <div
                                            style={{
                                                fontSize: 12,
                                                color: T.TEXT_MUTED,
                                            }}
                                        >
                                            {formatMoney(pkg.value, symbol)}
                                        </div>
                                    )}
                                </div>
                            </div>
                            {!isLocked && (
                                <div
                                    style={{
                                        display: "flex",
                                        alignItems: "center",
                                        flexWrap: "wrap",
                                        gap: 6,
                                        flexShrink: 0,
                                    }}
                                >
                                    <DealMenuSelect
                                        value=""
                                        placeholder={t(
                                            "pages.deals.info.pkgprop.replace",
                                        )}
                                        size="sm"
                                        align="right"
                                        disabled={packagesLoading}
                                        triggerClassName="dr-btn dr-btn-ghost dr-btn-sm"
                                        options={packagePool
                                            .filter((p) => p.id !== pkg.id)
                                            .map((p) => ({
                                                value: p.id,
                                                label: packageLabel(p),
                                            }))}
                                        onChange={(id) =>
                                            replacePackage(pkg.id, Number(id))
                                        }
                                    />
                                    <DealButton
                                        variant="ghost"
                                        size="sm"
                                        style={{ color: T.RED }}
                                        disabled={packagesLoading}
                                        aria-label={`${t("pages.deals.info.pkgprop.remove")} ${pkg.name}`}
                                        onClick={() => removePackage(pkg.id)}
                                    >
                                        {t("pages.deals.info.pkgprop.remove")}
                                    </DealButton>
                                </div>
                            )}
                        </div>
                    ))}
                    {showPackageAdd && (
                        <div style={{ marginBottom: 18 }}>
                            <DealMenuSelect
                                value=""
                                placeholder={t(
                                    "pages.deals.info.pkgprop.add_package",
                                )}
                                size="sm"
                                width={150}
                                disabled={packagesLoading}
                                options={packagePool
                                    .filter((p) => !packageIds.includes(p.id))
                                    .map((p) => ({
                                        value: p.id,
                                        label: packageLabel(p),
                                    }))}
                                onChange={(id) => addPackage(Number(id))}
                            />
                        </div>
                    )}
                </>
            )}

            {showPropertiesSection && (
                <>
                    {sectionHeader(
                        restrictPackageOrProperty
                            ? t("pages.deals.info.pkgprop.property")
                            : t("pages.deals.info.pkgprop.properties_header"),
                    )}
                    {products.length === 0 &&
                        emptyHint(
                            showPropertyAdd
                                ? t("pages.deals.info.pkgprop.prop_empty_add")
                                : t(
                                      "pages.deals.info.pkgprop.prop_empty_locked",
                                  ),
                        )}
                    {products.map((product) => {
                        const prop = product.property;
                        const title = prop?.title || product.name;
                        const statusKey = prop?.status
                            ? prop.status.toLowerCase().replace(/ /g, "_")
                            : "";
                        const specs = [
                            prop?.price != null
                                ? formatMoney(prop.price, symbol)
                                : null,
                            prop?.bedrooms ? `${prop.bedrooms} bd` : null,
                            prop?.bathrooms ? `${prop.bathrooms} ba` : null,
                            [prop?.area, prop?.city]
                                .filter(Boolean)
                                .join(", ") || null,
                        ]
                            .filter(Boolean)
                            .join(" · ");
                        return (
                            <div
                                key={product.id}
                                className="dr-card"
                                style={{
                                    display: "flex",
                                    alignItems: "center",
                                    flexWrap: "wrap",
                                    gap: 12,
                                    padding: "10px 12px",
                                }}
                            >
                                {iconTile("building")}
                                <div style={{ flex: "1 1 180px", minWidth: 0 }}>
                                    <div
                                        style={{
                                            display: "flex",
                                            alignItems: "center",
                                            gap: 7,
                                            flexWrap: "wrap",
                                        }}
                                    >
                                        <span
                                            style={{
                                                fontSize: 13,
                                                fontWeight: 600,
                                            }}
                                        >
                                            {title}
                                        </span>
                                        {prop?.status && (
                                            <DealBadge
                                                variant={
                                                    PROPERTY_STATUS_VARIANT[
                                                        statusKey
                                                    ] ?? "gray"
                                                }
                                            >
                                                {prop.status.replace(/_/g, " ")}
                                            </DealBadge>
                                        )}
                                    </div>
                                    {specs && (
                                        <div
                                            style={{
                                                fontSize: 12,
                                                color: T.TEXT_MUTED,
                                            }}
                                        >
                                            {specs}
                                        </div>
                                    )}
                                </div>
                                {prop && (
                                    <a
                                        href={route("properties.show", {
                                            id: prop.id,
                                        })}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="dr-btn dr-btn-ghost dr-btn-sm"
                                        style={{ flexShrink: 0 }}
                                    >
                                        {t("pages.deals.info.pkgprop.view")} ↗
                                    </a>
                                )}
                                {!isLocked && (
                                    <DealButton
                                        variant="ghost"
                                        size="sm"
                                        style={{ color: T.RED, flexShrink: 0 }}
                                        aria-label={`${t("pages.deals.info.pkgprop.remove")} ${title}`}
                                        onClick={() => removeProperty(product.id)}
                                    >
                                        {t("pages.deals.info.pkgprop.remove")}
                                    </DealButton>
                                )}
                            </div>
                        );
                    })}
                    {showPropertyAdd && (
                        <div style={{ marginBottom: 18 }}>
                            <DealButton
                                variant="ghost"
                                size="sm"
                                onClick={onManageProperties}
                            >
                                {t("pages.deals.info.pkgprop.add_property")}
                            </DealButton>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
