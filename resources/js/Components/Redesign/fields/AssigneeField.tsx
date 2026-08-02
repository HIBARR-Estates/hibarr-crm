import { useMemo, useState } from "react";
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

interface EmployeeRecord {
    id: number;
    name: string;
    designation_name?: string;
}

interface AssigneeFieldProps {
    value: number[];
    onChange: (ids: number[]) => void;
    disabled?: boolean;
    removeLabel?: string;
    addLabel?: string;
    doneLabel?: string;
}

/** Assignee chip field with inline people picker. */
export default function AssigneeField({
    value,
    onChange,
    disabled = false,
    removeLabel = "Remove",
    addLabel = "+ Add",
    doneLabel = "Done",
}: AssigneeFieldProps) {
    const { props } = usePage<PageProps & { employees?: EmployeeRecord[] }>();
    const [adding, setAdding] = useState(false);

    const employees = props.employees ?? [];
    const people: PersonOption[] = useMemo(
        () =>
            employees.map((employee) => ({
                id: employee.id,
                name: employee.name,
                designation: employee.designation_name,
            })),
        [employees],
    );
    const byId = useMemo(
        () => new Map(people.map((person) => [person.id, person])),
        [people],
    );

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
                                    onClick={() =>
                                        onChange(value.filter((x) => x !== id))
                                    }
                                    style={{
                                        background: "none",
                                        border: "none",
                                        cursor: "pointer",
                                        color: T.TEXT_MUTED,
                                        display: "flex",
                                        padding: 2,
                                    }}
                                >
                                    <Icon name="x" size={11} />
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
            {adding && !disabled && (
                <PeoplePicker
                    people={people}
                    exclude={value}
                    onPick={(person) => onChange([...value, person.id])}
                />
            )}
        </div>
    );
}
