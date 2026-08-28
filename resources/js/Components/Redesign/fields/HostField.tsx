import { useCallback, useMemo, useState } from "react";
import { usePage } from "@inertiajs/react";
import type { PageProps } from "@/Components/DashboardLayout";
import Avatar from "@/Components/Redesign/primitives/Avatar";
import Button from "@/Components/Redesign/primitives/Button";
import PeoplePicker, {
    type PersonOption,
} from "@/Components/Redesign/primitives/PeoplePicker";
import { REDESIGN_TOKENS as T } from "@/Components/Redesign/tokens";
import { initialsFromName } from "@/Components/Redesign/adapters/initials";
import { useDebounce } from "@/Hooks/useDebounce";
import { useFormData } from "@/Hooks/useFormData";

interface EmployeeRecord {
    id: number;
    name?: string;
    designation_name?: string;
    email?: string;
    employee_detail?: {
        designation?: { name?: string } | null;
    } | null;
}

interface HostFieldProps {
    value: number | null;
    onChange: (id: number) => void;
    disabled?: boolean;
    changeLabel?: string;
    pickLabel?: string;
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

/** Single-select host picker — mirrors AssigneeField's employee-directory pattern. */
export default function HostField({
    value,
    onChange,
    disabled = false,
    changeLabel = "Change",
    pickLabel = "Select host",
}: HostFieldProps) {
    const { props } = usePage<
        PageProps & { employees?: EmployeeRecord[] }
    >();
    const [picking, setPicking] = useState(false);
    const [query, setQuery] = useState("");
    const debouncedSearch = useDebounce(query, 300);

    const { data, loading, error } = useFormData<EmployeeRecord>("employees", {
        search: debouncedSearch,
        per_page: 40,
        paginate: false,
        enabled: picking && !disabled,
    });

    const handleQueryChange = useCallback((next: string) => {
        setQuery(next);
    }, []);

    const seedPeople = useMemo(() => {
        const list = Array.isArray(props.employees) ? props.employees : [];
        const people = list
            .filter((employee) => employee?.id != null)
            .map(mapEmployee);
        const currentUser = props.auth?.user;
        if (
            currentUser?.id &&
            !people.some((person) => person.id === currentUser.id)
        ) {
            people.unshift({
                id: currentUser.id,
                name: (currentUser.name || "You").trim(),
                designation: "You",
            });
        }
        return people;
    }, [props.employees, props.auth?.user]);

    const remotePeople = useMemo(
        () => ((data as EmployeeRecord[] | undefined) ?? []).map(mapEmployee),
        [data],
    );

    const people =
        remotePeople.length > 0 || !loading ? remotePeople : seedPeople;

    const byId = useMemo(() => {
        const map = new Map(people.map((person) => [person.id, person]));
        for (const person of seedPeople) {
            if (!map.has(person.id)) map.set(person.id, person);
        }
        return map;
    }, [people, seedPeople]);

    const blocked = !loading && Boolean(error) && people.length === 0;
    const current = value != null ? byId.get(value) : undefined;
    const currentName = current?.name ?? (value != null ? `User #${value}` : null);

    return (
        <div>
            <div
                style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    flexWrap: "wrap",
                    marginBottom: 6,
                }}
            >
                {currentName && (
                    <span
                        style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 6,
                            background: T.SURFACE_2,
                            border: `1px solid ${T.BORDER}`,
                            borderRadius: 999,
                            padding: "3px 8px 3px 4px",
                        }}
                    >
                        <Avatar size={20} initials={initialsFromName(currentName)} />
                        <span style={{ fontSize: 12 }}>{currentName}</span>
                    </span>
                )}
                {!disabled && (
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setPicking((current) => !current)}
                    >
                        {value != null ? changeLabel : pickLabel}
                    </Button>
                )}
            </div>
            {picking && !disabled && (
                <PeoplePicker
                    people={people}
                    exclude={value != null ? [value] : []}
                    loading={loading}
                    remoteFilter
                    onQueryChange={handleQueryChange}
                    onPick={(person) => {
                        onChange(person.id);
                        setPicking(false);
                    }}
                    getEmptyLabel={(q) => {
                        if (blocked) {
                            return "Employee directory is unavailable. You may not have permission to view employees.";
                        }
                        if (!loading && people.length === 0 && !q.trim()) {
                            return "No employees available to assign";
                        }
                        if (!q.trim()) return "No employees left to pick";
                        return `No employees match "${q}"`;
                    }}
                />
            )}
        </div>
    );
}
