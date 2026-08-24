import { ComponentProps, useCallback, useMemo, useState } from "react";
import useTranslation from "@/Hooks/useTranslation";
import { useDebounce } from "@/Hooks/useDebounce";
import { useFormData } from "@/Hooks/useFormData";
import PeoplePicker, {
    type PersonOption,
} from "@/Components/Redesign/primitives/PeoplePicker";

export type { PersonOption as DealPersonOption } from "@/Components/Redesign/primitives/PeoplePicker";

type BaseProps = Omit<
    ComponentProps<typeof PeoplePicker>,
    "people" | "loading" | "remoteFilter" | "onQueryChange"
>;

interface EmployeeRecord {
    id: number;
    name?: string;
    email?: string;
    designation_name?: string;
    employee_detail?: {
        designation?: { name?: string } | null;
    } | null;
}

interface DealPeoplePickerProps extends BaseProps {
    /**
     * Optional seed list (already on the page). Remote directory is still used
     * for search so view_employees scope can't blank assignee/watcher lookup.
     */
    people?: PersonOption[];
    /** Prefer remote directory (default true). */
    useRemoteDirectory?: boolean;
}

function mapEmployee(employee: EmployeeRecord): PersonOption {
    return {
        id: employee.id,
        name: (employee.name || employee.email || `User #${employee.id}`).trim(),
        designation:
            employee.designation_name ||
            employee.employee_detail?.designation?.name ||
            undefined,
    };
}

/**
 * People picker for deal/lead assignment UIs.
 * Remote-fetches the company employee directory via form-data so permission-
 * scoped page props can't leave assignees / participants / watchers empty.
 */
export default function DealPeoplePicker({
    people: peopleProp,
    useRemoteDirectory = true,
    exclude = [],
    ...props
}: DealPeoplePickerProps) {
    const { t } = useTranslation();
    const [query, setQuery] = useState("");
    const debouncedSearch = useDebounce(query, 300);

    const { data, loading, error } = useFormData<EmployeeRecord>("employees", {
        search: debouncedSearch,
        per_page: 40,
        paginate: false,
        enabled: useRemoteDirectory,
    });

    const handleQueryChange = useCallback((next: string) => {
        setQuery(next);
    }, []);

    const remotePeople = useMemo(
        () => ((data as EmployeeRecord[] | undefined) ?? []).map(mapEmployee),
        [data],
    );

    // Prefer remote results when enabled; fall back to seed list while loading
    // so an empty first paint doesn't flash "no employees".
    const people =
        useRemoteDirectory && (remotePeople.length > 0 || !loading)
            ? remotePeople
            : (peopleProp ?? []);

    const isLoading = useRemoteDirectory && loading;
    const blocked =
        useRemoteDirectory &&
        !isLoading &&
        Boolean(error) &&
        people.length === 0;
    const noDirectory =
        useRemoteDirectory &&
        !isLoading &&
        !error &&
        people.length === 0 &&
        !query.trim();

    const unavailableLabel = t("pages.deals.header.team.employees_unavailable");
    const noneAvailableLabel = t("pages.deals.header.team.no_employees_available");
    const noneLeftLabel = t("pages.deals.header.team.no_employees_left");

    return (
        <PeoplePicker
            {...props}
            people={people}
            exclude={exclude}
            loading={isLoading}
            remoteFilter={useRemoteDirectory}
            onQueryChange={handleQueryChange}
            placeholder={
                props.placeholder ??
                t("pages.deals.header.team.search_employees")
            }
            getEmptyLabel={
                props.getEmptyLabel ??
                ((q) => {
                    if (blocked) return unavailableLabel;
                    if (noDirectory) return noneAvailableLabel;
                    if (!q.trim()) return noneLeftLabel;
                    return `${t("pages.deals.header.team.no_employees_match")} "${q}"`;
                })
            }
        />
    );
}
