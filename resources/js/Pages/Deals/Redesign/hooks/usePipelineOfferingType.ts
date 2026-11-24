import { usePage } from "@inertiajs/react";

export type PipelineOfferingType = "property" | "package" | "both";

/**
 * Explicit deal-pipeline offering: which selector(s) the deal info panel shows.
 */
export default function usePipelineOfferingType(): PipelineOfferingType {
    const { props } = usePage<any>();
    if (
        props.pipelineOfferingType === "package" ||
        props.pipelineOfferingType === "property" ||
        props.pipelineOfferingType === "both"
    ) {
        return props.pipelineOfferingType;
    }
    // Legacy fallback while older responses still ship only the boolean.
    return props.pipelineHasPackages === true ? "package" : "property";
}
