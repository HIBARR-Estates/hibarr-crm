import { FormEvent, useState } from "react";
import { router } from "@inertiajs/react";
import DashboardLayout from "@/Components/DashboardLayout";
import PageLayout from "@/Components/PageLayout";
import {
    Button,
    Badge,
    ConfirmDialog,
    EmptyState,
    MenuSelect,
    Pagination,
} from "@/Components/Redesign";
import { initialsFromName } from "@/Components/Redesign/adapters/initials";
import "@/Components/Redesign/redesign.css";
import useTranslation from "@/Hooks/useTranslation";

interface RoleOption {
    id: number;
    name: string;
    display_name: string;
}

interface NamedOption {
    id: number;
    name: string;
}

interface EmployeeRow {
    id: number;
    name: string;
    email: string | null;
    status: string;
    employee_id: string | null;
    department: string | null;
    designation: string | null;
    roles: RoleOption[];
    can_impersonate: boolean;
    impersonate_block: string | null;
}

interface EmployeePage {
    data: EmployeeRow[];
    current_page: number;
    per_page: number;
    total: number;
}

interface Filters {
    search: string;
    status: string;
    department_id: number | null;
    designation_id: number | null;
    role_id: number | null;
    per_page: number;
}

interface Props {
    pageTitle: string;
    filters: Filters;
    employees: EmployeePage;
    departments: NamedOption[];
    designations: NamedOption[];
    roles: RoleOption[];
}

const BLOCK_KEYS: Record<string, string> = {
    self: "app.impersonation.block.self",
    admin: "app.impersonation.block.admin",
    inactive: "app.impersonation.block.inactive",
    login_disabled: "app.impersonation.block.login_disabled",
    unapproved: "app.impersonation.block.unapproved",
    not_employee: "app.impersonation.block.not_employee",
    other_company: "app.impersonation.block.other_company",
    already_impersonating: "app.impersonation.block.already_impersonating",
    not_admin: "app.impersonation.block.not_admin",
};

export default function EmployeesIndex({
    pageTitle,
    filters,
    employees,
    departments,
    designations,
    roles,
}: Props) {
    const { t } = useTranslation();
    const [search, setSearch] = useState(filters.search);
    const [pending, setPending] = useState<EmployeeRow | null>(null);
    const [submitting, setSubmitting] = useState(false);

    const filtersActive =
        filters.search !== "" ||
        filters.status !== "active" ||
        filters.department_id !== null ||
        filters.designation_id !== null ||
        filters.role_id !== null;

    const visit = (patch: Partial<Filters> & { page?: number }) => {
        const next = { ...filters, search: search.trim(), ...patch };
        const page = patch.page ?? 1;
        const params: Record<string, string | number> = {
            status: next.status,
            per_page: next.per_page,
            page,
        };

        if (next.search) params.search = next.search;
        if (next.department_id) params.department_id = next.department_id;
        if (next.designation_id) params.designation_id = next.designation_id;
        if (next.role_id) params.role_id = next.role_id;

        router.get(route("settings-employees.index"), params, {
            preserveState: true,
            preserveScroll: true,
            replace: true,
        });
    };

    const onSearch = (event: FormEvent) => {
        event.preventDefault();
        visit({ search: search.trim(), page: 1 });
    };

    const confirmImpersonate = () => {
        if (!pending) return;

        setSubmitting(true);
        router.post(
            route("settings-employees.impersonate", { user: pending.id }),
            {},
            { onFinish: () => setSubmitting(false) },
        );
    };

    const blockTitle = (code: string | null) =>
        code && BLOCK_KEYS[code] ? t(BLOCK_KEYS[code]) : undefined;

    return (
        <PageLayout
            breadcrumbs={[
                {
                    name: t("app.menu.settings"),
                    url: route("settings-overview.index"),
                },
                { name: pageTitle },
            ]}
            config={{ showTitle: true }}
        >
            <div className="mx-auto w-full max-w-screen-2xl space-y-4">
                <p className="max-w-3xl text-xs leading-relaxed text-[#5b6472]">
                    {t("app.impersonation.subtitle")}
                </p>

                <form
                    onSubmit={onSearch}
                    className="flex flex-wrap items-end gap-3"
                >
                    <label className="flex min-w-[220px] flex-1 flex-col gap-1">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-[#5b6472]">
                            {t("app.search")}
                        </span>
                        <input
                            type="search"
                            value={search}
                            onChange={(event) => setSearch(event.target.value)}
                            placeholder={t("app.impersonation.searchPlaceholder")}
                            className="h-9 rounded-md border border-[#e2e5ea] bg-white px-3 text-sm text-[#1a1f2e] outline-none focus:border-[#1890ff]"
                        />
                    </label>

                    <FilterSelect
                        label={t("app.status")}
                        value={filters.status}
                        options={[
                            { value: "active", label: t("app.active") },
                            { value: "deactive", label: t("app.inactive") },
                            {
                                value: "all",
                                label: t("app.impersonation.allStatuses"),
                            },
                        ]}
                        onChange={(value) =>
                            visit({ status: String(value), page: 1 })
                        }
                    />
                    <FilterSelect
                        label={t("app.impersonation.department")}
                        value={filters.department_id ?? ""}
                        options={[
                            {
                                value: "",
                                label: t("app.impersonation.allDepartments"),
                            },
                            ...departments.map((department) => ({
                                value: department.id,
                                label: department.name,
                            })),
                        ]}
                        onChange={(value) =>
                            visit({
                                department_id:
                                    value === "" ? null : Number(value),
                                page: 1,
                            })
                        }
                    />
                    <FilterSelect
                        label={t("app.designation")}
                        value={filters.designation_id ?? ""}
                        options={[
                            {
                                value: "",
                                label: t("app.impersonation.allDesignations"),
                            },
                            ...designations.map((designation) => ({
                                value: designation.id,
                                label: designation.name,
                            })),
                        ]}
                        onChange={(value) =>
                            visit({
                                designation_id:
                                    value === "" ? null : Number(value),
                                page: 1,
                            })
                        }
                    />
                    <FilterSelect
                        label={t("app.impersonation.role")}
                        value={filters.role_id ?? ""}
                        options={[
                            {
                                value: "",
                                label: t("app.impersonation.allRoles"),
                            },
                            ...roles.map((role) => ({
                                value: role.id,
                                label: role.display_name,
                            })),
                        ]}
                        onChange={(value) =>
                            visit({
                                role_id: value === "" ? null : Number(value),
                                page: 1,
                            })
                        }
                    />

                    <Button type="submit" variant="primary" size="sm">
                        {t("app.search")}
                    </Button>
                    {filtersActive && (
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                                setSearch("");
                                visit({
                                    search: "",
                                    status: "active",
                                    department_id: null,
                                    designation_id: null,
                                    role_id: null,
                                    page: 1,
                                });
                            }}
                        >
                            {t("app.impersonation.clearFilters")}
                        </Button>
                    )}
                </form>

                {employees.total === 0 ? (
                    <EmptyState
                        icon="users"
                        title={
                            filtersActive
                                ? t("app.impersonation.noResults")
                                : t("app.impersonation.noEmployees")
                        }
                        description={
                            filtersActive
                                ? t("app.impersonation.noResultsDescription")
                                : t("app.impersonation.noEmployeesDescription")
                        }
                    />
                ) : (
                    <div className="overflow-x-auto rounded-lg border border-[#e2e5ea] bg-white">
                        <table className="w-full table-fixed border-collapse text-left">
                            <colgroup>
                                <col style={{ width: "34%" }} />
                                <col style={{ width: "18%" }} />
                                <col style={{ width: "18%" }} />
                                <col style={{ width: "14%" }} />
                                <col style={{ width: "160px" }} />
                            </colgroup>
                            <thead>
                                <tr className="border-b border-[#e2e5ea] bg-[#f8f9fb] text-[11px] font-bold uppercase tracking-wider text-[#5b6472]">
                                    <th className="px-5 py-3 font-bold">
                                        {t("app.impersonation.employee")}
                                    </th>
                                    <th className="px-5 py-3 font-bold">
                                        {t("app.impersonation.role")}
                                    </th>
                                    <th className="px-5 py-3 font-bold">
                                        {t("app.impersonation.department")}
                                    </th>
                                    <th className="px-5 py-3 font-bold">
                                        {t("app.status")}
                                    </th>
                                    <th className="px-5 py-3 font-bold">
                                        {t("app.action")}
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {employees.data.map((employee) => {
                                    const reason = blockTitle(
                                        employee.impersonate_block,
                                    );

                                    return (
                                        <tr
                                            key={employee.id}
                                            className="border-b border-[#eef0f3] align-middle last:border-b-0"
                                        >
                                            <td className="px-5 py-3.5">
                                                <div className="flex items-center gap-3">
                                                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-600">
                                                        {initialsFromName(
                                                            employee.name,
                                                        )}
                                                    </span>
                                                    <div className="min-w-0">
                                                        <div className="truncate text-sm font-semibold text-[#1a1f2e]">
                                                            {employee.name}
                                                        </div>
                                                        <div className="mt-0.5 truncate text-xs text-[#9ca3af]">
                                                            {employee.email}
                                                            {employee.employee_id
                                                                ? ` · ${employee.employee_id}`
                                                                : ""}
                                                            {employee.designation
                                                                ? ` · ${employee.designation}`
                                                                : ""}
                                                        </div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-5 py-3.5">
                                                <div className="truncate text-sm text-[#1a1f2e]">
                                                    {employee.roles
                                                        .map(
                                                            (role) =>
                                                                role.display_name,
                                                        )
                                                        .join(", ") || "—"}
                                                </div>
                                            </td>
                                            <td className="px-5 py-3.5">
                                                <div className="truncate text-sm text-[#1a1f2e]">
                                                    {employee.department || "—"}
                                                </div>
                                            </td>
                                            <td className="px-5 py-3.5">
                                                <Badge
                                                    variant={
                                                        employee.status ===
                                                        "active"
                                                            ? "green"
                                                            : "gray"
                                                    }
                                                >
                                                    {employee.status === "active"
                                                        ? t("app.active")
                                                        : t("app.inactive")}
                                                </Badge>
                                            </td>
                                            <td className="px-5 py-3.5">
                                                <span title={reason}>
                                                    <Button
                                                        type="button"
                                                        variant="primary"
                                                        size="sm"
                                                        disabled={
                                                            !employee.can_impersonate
                                                        }
                                                        onClick={() =>
                                                            setPending(employee)
                                                        }
                                                    >
                                                        {t(
                                                            "app.impersonation.impersonate",
                                                        )}
                                                    </Button>
                                                </span>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}

                {employees.total > 0 && (
                    <Pagination
                        page={employees.current_page}
                        pageSize={employees.per_page}
                        totalItems={employees.total}
                        itemLabel={t("app.impersonation.employee")}
                        itemLabelPlural={t("app.menu.employees")}
                        onPageChange={(page) => visit({ page })}
                        onPageSizeChange={(per_page) =>
                            visit({ per_page, page: 1 })
                        }
                    />
                )}
            </div>

            <ConfirmDialog
                open={pending !== null}
                title={t("app.impersonation.confirmTitle", {
                    name: pending?.name ?? "",
                })}
                message={t("app.impersonation.confirmMessage", {
                    name: pending?.name ?? "",
                })}
                confirmLabel={t("app.impersonation.impersonate")}
                cancelLabel={t("app.cancel")}
                confirmLoading={submitting}
                onConfirm={confirmImpersonate}
                onCancel={() => {
                    if (!submitting) setPending(null);
                }}
            />
        </PageLayout>
    );
}

function FilterSelect({
    label,
    value,
    options,
    onChange,
}: {
    label: string;
    value: string | number;
    options: { value: string | number; label: string }[];
    onChange: (value: string | number) => void;
}) {
    return (
        <label className="flex flex-col gap-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#5b6472]">
                {label}
            </span>
            <MenuSelect
                value={value}
                options={options}
                onChange={onChange}
                size="sm"
            />
        </label>
    );
}

EmployeesIndex.layout = (page: React.ReactNode) => (
    <DashboardLayout>{page}</DashboardLayout>
);
