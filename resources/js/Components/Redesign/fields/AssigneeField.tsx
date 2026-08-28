import { useCallback, useEffect, useMemo, useState } from "react";
import { usePage } from "@inertiajs/react";
import type { PageProps } from "@/Components/DashboardLayout";
import Avatar from "@/Components/Redesign/primitives/Avatar";
import Button from "@/Components/Redesign/primitives/Button";
import Icon from "@/Components/Redesign/primitives/Icon";
import PeoplePicker, {
    type PersonOption,
} from "@/Components/Redesign/primitives/PeoplePicker";
import { REDESIGN_TOKENS as T } from "@/Components/Redesign/tokens";
import { initialsFromName } from "@/Components/Redesign/adapters/initials";
import { useTd } from "@/Hooks/useDynamicTranslation";
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

interface AssigneeFieldProps {
    value: number[];
    onChange: (ids: number[]) => void;
    disabled?: boolean;
    /** Ids in `value` that can't be removed (e.g. the deal agent / lead owner when they aren't the meeting host). */
    lockedIds?: number[];
    /** Ids that can't be picked via "+ Add" at all (e.g. the meeting host — tracked separately, never also a participant). */
    excludeIds?: number[];
    /** Shown when the user tries to remove a locked id. Receives the person's display name. Defaults to a generic explanation. */
    lockedRemovalMessage?: (name: string) => string;
    removeLabel?: string;
    addLabel?: string;
    doneLabel?: string;
}

const LOCKED_REMOVAL_ERROR_TIMEOUT_MS = 5000;

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

/** Assignee chip field with inline people picker (remote employee directory). */
export default function AssigneeField({
    value,
    onChange,
    disabled = false,
    lockedIds = [],
    excludeIds = [],
    lockedRemovalMessage,
    removeLabel = "Remove",
    addLabel = "+ Add",
    doneLabel = "Done",
}: AssigneeFieldProps) {
    const { td } = useTd();
    const { props } = usePage<
        PageProps & { employees?: EmployeeRecord[] }
    >();
    const [adding, setAdding] = useState(false);
    const [query, setQuery] = useState("");
    const debouncedSearch = useDebounce(query, 300);
    const [removalError, setRemovalError] = useState<string | null>(null);

    const { data, loading, error } = useFormData<EmployeeRecord>("employees", {
        search: debouncedSearch,
        per_page: 40,
        paginate: false,
        enabled: adding && !disabled,
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
        // Also resolve chips from seed so already-picked people always label.
        for (const person of seedPeople) {
            if (!map.has(person.id)) map.set(person.id, person);
        }
        return map;
    }, [people, seedPeople]);

    const blocked = !loading && Boolean(error) && people.length === 0;

    // Clear a stale error once the underlying lock state has actually moved
    // on (e.g. this id is no longer locked), and auto-dismiss after a beat.
    useEffect(() => {
        if (!removalError) return;
        const timeout = window.setTimeout(
            () => setRemovalError(null),
            LOCKED_REMOVAL_ERROR_TIMEOUT_MS,
        );
        return () => window.clearTimeout(timeout);
    }, [removalError]);

    useEffect(() => {
        setRemovalError(null);
    }, [lockedIds]);

    const handleRemoveAttempt = (id: number, name: string) => {
        if (lockedIds.includes(id)) {
            setRemovalError(
                lockedRemovalMessage
                    ? lockedRemovalMessage(name)
                    : td(
                          `${name} can't be removed from this meeting while they aren't the host.`,
                          { source: "en" },
                      ),
            );
            return;
        }
        setRemovalError(null);
        onChange(value.filter((x) => x !== id));
    };

    return (
        <div>
            <div
                style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    flexWrap: "wrap",
                    marginBottom: 6,
                }}
            >
                {value.map((id) => {
                    const person = byId.get(id);
                    const name = person?.name ?? `User #${id}`;
                    const locked = lockedIds.includes(id);
                    return (
                        <span
                            key={id}
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
                            <Avatar
                                size={20}
                                initials={initialsFromName(name)}
                            />
                            <span style={{ fontSize: 12 }}>{name}</span>
                            {!disabled && (
                                <button
                                    type="button"
                                    aria-label={`${removeLabel} ${name}`}
                                    onClick={() => handleRemoveAttempt(id, name)}
                                    style={{
                                        background: "none",
                                        border: "none",
                                        cursor: "pointer",
                                        color: locked
                                            ? T.TEXT_HINT
                                            : T.TEXT_MUTED,
                                        display: "flex",
                                        padding: 2,
                                    }}
                                >
                                    <Icon
                                        name={locked ? "lock" : "x"}
                                        size={11}
                                    />
                                </button>
                            )}
                        </span>
                    );
                })}
                <Button
                    variant="ghost"
                    size="sm"
                    disabled={disabled}
                    onClick={() => setAdding((current) => !current)}
                >
                    {adding ? doneLabel : addLabel}
                </Button>
            </div>
            {removalError && (
                <p
                    role="alert"
                    style={{
                        fontSize: 12,
                        color: T.RED,
                        margin: "0 0 6px",
                    }}
                >
                    {removalError}
                </p>
            )}
            {adding && !disabled && (
                <PeoplePicker
                    people={people}
                    exclude={[...value, ...excludeIds]}
                    loading={loading}
                    remoteFilter
                    onQueryChange={handleQueryChange}
                    onPick={(person) => onChange([...value, person.id])}
                    getEmptyLabel={(q) => {
                        if (blocked) {
                            return "Employee directory is unavailable. You may not have permission to view employees.";
                        }
                        if (!loading && people.length === 0 && !q.trim()) {
                            return "No employees available to assign";
                        }
                        if (!q.trim()) return "No employees left to add";
                        return `No employees match "${q}"`;
                    }}
                />
            )}
        </div>
    );
}
