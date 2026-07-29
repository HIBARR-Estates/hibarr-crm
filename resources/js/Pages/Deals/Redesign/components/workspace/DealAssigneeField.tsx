import { useMemo, useState } from "react";
import { usePage } from "@inertiajs/react";
import type { PageProps } from "@/Components/DashboardLayout";
import useTranslation from "@/Hooks/useTranslation";
import DealAvatar from "../primitives/DealAvatar";
import DealButton from "../primitives/DealButton";
import DealIcon from "../primitives/DealIcon";
import DealPeoplePicker, {
    DealPersonOption,
} from "../primitives/DealPeoplePicker";
import { DEAL_REDESIGN_TOKENS as T } from "../../tokens";
import { initialsFromName } from "../../adapters/initials";

interface EmployeeRecord {
    id: number;
    name: string;
    designation_name?: string;
}

interface DealAssigneeFieldProps {
    value: number[];
    onChange: (ids: number[]) => void;
    disabled?: boolean;
}

/** Ported from v2.2's assignee chip field (deal-v2-2.jsx:2055-2081). */
export default function DealAssigneeField({
    value,
    onChange,
    disabled = false,
}: DealAssigneeFieldProps) {
    const { t } = useTranslation();
    const { props } = usePage<PageProps & { employees?: EmployeeRecord[] }>();
    const [adding, setAdding] = useState(false);

    const employees = props.employees ?? [];
    const people: DealPersonOption[] = useMemo(
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
                            <DealAvatar
                                size={20}
                                initials={initialsFromName(name)}
                            />
                            <span style={{ fontSize: 12 }}>{name}</span>
                            {!disabled && (
                                <button
                                    type="button"
                                    aria-label={`${t("pages.deals.common.remove")} ${name}`}
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
                                    <DealIcon name="x" size={11} />
                                </button>
                            )}
                        </span>
                    );
                })}
                <DealButton
                    variant="ghost"
                    size="sm"
                    disabled={disabled}
                    onClick={() => setAdding((current) => !current)}
                >
                    {adding
                        ? t("pages.deals.common.done")
                        : `+ ${t("pages.deals.common.add")}`}
                </DealButton>
            </div>
            {adding && !disabled && (
                <DealPeoplePicker
                    people={people}
                    exclude={value}
                    onPick={(person) => onChange([...value, person.id])}
                />
            )}
        </div>
    );
}
