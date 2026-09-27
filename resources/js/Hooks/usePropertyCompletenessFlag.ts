import { usePage } from "@inertiajs/react";
import { PROPERTY_COMPLETENESS_FLAG } from "@/lib/propertyCompletenessFlag";

export default function usePropertyCompletenessFlag(): boolean {
    const { props } = usePage();
    const featureFlags = props.featureFlags ?? {};

    return featureFlags[PROPERTY_COMPLETENESS_FLAG] === true;
}
