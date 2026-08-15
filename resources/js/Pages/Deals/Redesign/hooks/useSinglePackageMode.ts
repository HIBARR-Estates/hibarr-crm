import { usePage } from "@inertiajs/react";

/**
 * True when the company is configured for one package per deal
 * (`companies.deal_package_mode = single`, shipped as the `dealPackageMode`
 * prop by DealFormDataTrait).
 *
 * The backend already truncates extra packages
 * (PackagePipelineRouterService::normalizePackageIds); this is what keeps the
 * UI from offering an add that would silently be discarded.
 */
export default function useSinglePackageMode(): boolean {
    const { props } = usePage<any>();

    return props.dealPackageMode === "single";
}
