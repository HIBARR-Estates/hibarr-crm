import { useEffect, useMemo } from "react";
import UniversalFilterDrawer from "@/Components/UniversalFilterDrawer";
import { createLeadFilterConfig } from "@/configs/leadFilterConfig";
import { useFilter } from "@/contexts/FilterContext";
import LeadFilterModal from "@/Features/Filters/EntityFilterModal";
import { FormDataType, useFormDataBatch } from "@/Hooks/useFormData";
import usePageSearchAndFilter from "@/Hooks/usePageSearchAndFilter";
import { PEOPLE_RELOAD_KEYS } from "./usePeopleList";
import type { LifecycleStatus } from "./types";

const FORM_DATA_TYPES = [
    "sources",
    "categories",
    "employees",
    "countries",
    "languages",
    "genders",
    "age-ranges",
    "temperatures",
    "lead-agents",
    "lead-utm-sources",
    "lead-utm-mediums",
    "lead-utm-campaigns",
    "lead-utm-contents",
    "lead-utm-terms",
    "lead-utm-audiences",
    "lead-custom-fields",
    "lead-origins",
] as FormDataType[];

interface PeopleFilterModalProps {
    leadLifecycleStatuses: LifecycleStatus[];
    preferredContactTimes?: Array<{ value: string; label: string }>;
    filterV2: boolean;
    /** False while the viewer's saved views are still loading. */
    savedViewsReady: boolean;
    /**
     * Changes whenever the list's filters do (a chip, a view, the search box),
     * so the modal re-reads the URL and never applies a stale draft.
     */
    appliedKey: string;
}

/**
 * The Leads list's own filter modal, pointed at this page: same fields, same
 * saved views, same query-string contract; applying a filter is a partial
 * visit of /agent/people. Loaded the first time Filters is pressed, so the
 * list never pays for the form data or the modal's code up front.
 */
export default function PeopleFilterModal({ leadLifecycleStatuses, preferredContactTimes, filterV2, savedViewsReady, appliedKey }: PeopleFilterModalProps) {
    const { data: formData, loading } = useFormDataBatch(FORM_DATA_TYPES);
    const { openDrawer } = useFilter();

    const filterConfig = useMemo(
        () => ({
            ...createLeadFilterConfig({
                sources: formData.sources || [],
                origins: formData["lead-origins"] || [],
                categories: formData.categories || [],
                employees: formData.employees || [],
                leadAgents: formData["lead-agents"] || [],
                countries: formData.countries || [],
                languages: formData.languages || [],
                genders: formData.genders || [],
                ageRanges: formData["age-ranges"] || [],
                temperatures: formData.temperatures || [],
                preferredContactTimes: preferredContactTimes ?? [],
                utmSources: formData["lead-utm-sources"] || [],
                utmMediums: formData["lead-utm-mediums"] || [],
                utmCampaigns: formData["lead-utm-campaigns"] || [],
                utmContents: formData["lead-utm-contents"] || [],
                utmTerms: formData["lead-utm-terms"] || [],
                utmAudiences: formData["lead-utm-audiences"] || [],
                customFields: formData["lead-custom-fields"] || [],
                leadLifecycleStatuses,
                filterV2,
                excludeFields: ["search"],
            }),
            routeName: "agent.people",
            only: PEOPLE_RELOAD_KEYS,
        }),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [formData, leadLifecycleStatuses, preferredContactTimes, filterV2, appliedKey],
    );

    usePageSearchAndFilter({ filterConfig });

    // Pressing Filters is what mounts this, so it opens as soon as it exists.
    useEffect(() => {
        // After the config effect above has read the URL into the draft.
        const handle = window.setTimeout(openDrawer, 0);
        return () => window.clearTimeout(handle);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return filterV2 ? (
        <LeadFilterModal config={filterConfig} optionsLoading={loading || !savedViewsReady} />
    ) : (
        <UniversalFilterDrawer config={filterConfig} loading={loading} width={960} />
    );
}
