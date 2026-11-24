import { usePage } from "@inertiajs/react";

/**
 * True when the deal's pipeline is configured as a package offering
 * (`lead_pipelines.offering_type = package`, from DealController@show).
 *
 * Package pipelines sell packages only — property manager, recommendations and
 * offers are hidden. Property pipelines sell properties only.
 */
export default function usePipelineHasPackages(): boolean {
    const { props } = usePage<any>();

    if (props.pipelineOfferingType === "package") return true;
    if (props.pipelineOfferingType === "property") return false;
    // Legacy fallback while older responses still ship only the boolean.
    return props.pipelineHasPackages === true;
}
