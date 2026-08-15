import { usePage } from "@inertiajs/react";

/**
 * True when the deal's pipeline has at least one package linked to it
 * (`package_pipeline`, resolved in DealController@show).
 *
 * Such a pipeline sells packages, not individual properties — so the property
 * manager, the recommendations tab and the offers tab are hidden for its deals.
 */
export default function usePipelineHasPackages(): boolean {
    const { props } = usePage<any>();

    return props.pipelineHasPackages === true;
}
