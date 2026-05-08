import { useMemo, useCallback } from "react";
import DashboardLayout from "@/Components/DashboardLayout";
import PageLayout from "@/Components/PageLayout";
import BulkAgentActionSelector from "@/Features/Agents/BulkActions/BulkAgentActionSelector";
import { AGENT_TABLE_COLUMNS } from "@/Features/Agents/Columns";
import SaveAgentModal from "@/Features/Agents/SaveAgentModal";
import ImportAgents from "@/Features/Agents/ImportAgents";
import DeleteAgent from "@/Features/Agents/DeleteAgent";
import { useGenericEntityAction } from "@/Hooks/useGenericEntityAction";
import useGenericTableRowSelection from "@/Hooks/useGenericTableRowSelection";
import { Agent, AgentIndexProps } from "@/Types/api/agents";
import {
    PlusOutlined,
    EditOutlined,
    EyeOutlined,
    DeleteOutlined,
    ImportOutlined,
    FilterOutlined,
    ReloadOutlined,
} from "@ant-design/icons";
import { Link, router } from "@inertiajs/react";
import { Button, MenuProps, Select } from "antd";
import { DataTable } from "@/Components/DataTable";
import type { LaravelPaginationMeta } from "@/Components/DataTable";
import { useState } from "react";
import UniversalSearchBox from "@/Components/UniversalSearchBox";
import usePageRefresh from "@/Hooks/usePageRefresh";
import useTranslation from "@/Hooks/useTranslation";

const Index = ({
    pageTitle,
    agents,
    categories,
    filters,
    permissions,
    roles,
}: AgentIndexProps) => {
    const {
        handleAction,
        handleClose,
        action,
        selected: agent,
    } = useGenericEntityAction<Agent>();

    const { selectedEntities, rowSelection, clearSelected } =
        useGenericTableRowSelection<Agent>();

    const handleCreateAgent = useCallback(() => {
        handleAction("add");
    }, [handleAction]);

    const handleImportAgents = useCallback(() => {
        handleAction("import");
    }, [handleAction]);

    const getActionItems = useCallback(
        (record: Agent): MenuProps["items"] => {
            const items: MenuProps["items"] = [];

            items.push({
                key: "view",
                label: (
                    <Link href={route("agents.show", record.id)}>
                        <EyeOutlined className="mr-2" />
                        {t("app.view")}
                    </Link>
                ),
            });

            if (permissions.edit_lead_agent !== "none") {
                items.push({
                    key: "edit",
                    label: (
                        <span>
                            <EditOutlined className="mr-2" />
                            {t("app.edit")}
                        </span>
                    ),
                    onClick: () => handleAction("edit", record),
                });
            }

            if (permissions.delete_lead_agent !== "none") {
                items.push(
                    { type: "divider" },
                    {
                        key: "delete",
                        label: (
                            <span className="text-red-600">
                                <DeleteOutlined className="mr-2" />
                                {t("app.delete")}
                            </span>
                        ),
                        onClick: () => handleAction("delete", record),
                    },
                );
            }

            return items;
        },
        [handleAction, permissions],
    );

    const columns = useMemo(
        () => AGENT_TABLE_COLUMNS(getActionItems),
        [getActionItems],
    );

    const { refresh, isRefreshing } = usePageRefresh();
    const { t } = useTranslation();

    // Simple inline filters
    const [statusFilter, setStatusFilter] = useState<string | undefined>(
        filters.status,
    );
    const [categoryFilter, setCategoryFilter] = useState<string | undefined>(
        filters.category_id,
    );

    const applyFilter = (key: string, value: string | undefined) => {
        const params: Record<string, string | undefined> = {
            ...filters,
            [key]: value,
            page: undefined,
        };
        // Remove undefined keys
        Object.keys(params).forEach(
            (k) => params[k] === undefined && delete params[k],
        );
        router.get(route("agents.index"), params, {
            preserveState: true,
            preserveScroll: true,
        });
    };

    return (
        <>
            <PageLayout
                title={t("app.agents.title")}
                breadcrumbs={[{ name: t("app.agents.title") }]}
                searchComp={
                    <UniversalSearchBox
                        placeholder={t("app.agents.search_placeholder")}
                        className="w-full"
                    />
                }
            >
                <div className="max-w-7xl mx-auto space-y-6">
                    <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                        <div className="flex items-center gap-3">
                            {permissions.add_lead_agent !== "none" && (
                                <Button
                                    type="primary"
                                    icon={<PlusOutlined />}
                                    onClick={handleCreateAgent}
                                >
                                    {t("app.agents.actions.add")}
                                </Button>
                            )}
                            {permissions.add_lead_agent !== "none" && (
                                <Button
                                    type="text"
                                    icon={<ImportOutlined />}
                                    onClick={handleImportAgents}
                                >
                                    {t("app.import")}
                                </Button>
                            )}
                        </div>

                        <div className="flex items-center gap-3">
                            <Button
                                icon={<ReloadOutlined spin={isRefreshing} />}
                                onClick={refresh}
                                disabled={isRefreshing}
                                type="text"
                            >
                                {t("app.common.actions.refresh")}
                            </Button>
                            <Select
                                placeholder={t("app.agents.filters.status")}
                                value={statusFilter}
                                onChange={(v) => {
                                    setStatusFilter(v);
                                    applyFilter("status", v);
                                }}
                                allowClear
                                style={{ width: 130 }}
                                size="small"
                                options={[
                                    { label: t("app.agents.status.active"), value: "enabled" },
                                    { label: t("app.agents.status.disabled"), value: "disabled" },
                                ]}
                            />
                            <Select
                                placeholder={t("app.agents.filters.category")}
                                value={categoryFilter}
                                onChange={(v) => {
                                    setCategoryFilter(v);
                                    applyFilter("category_id", v);
                                }}
                                allowClear
                                style={{ width: 160 }}
                                size="small"
                                options={categories.map((c) => ({
                                    label: c.category_name,
                                    value: String(c.id),
                                }))}
                                showSearch
                                filterOption={(input, option) =>
                                    (option?.label ?? "")
                                        .toLowerCase()
                                        .includes(input.toLowerCase())
                                }
                            />

                            {selectedEntities.length > 0 && (
                                <BulkAgentActionSelector
                                    selectedEntityIds={selectedEntities.map(
                                        ({ id }) => id,
                                    )}
                                    clearSelected={clearSelected}
                                    roles={roles}
                                />
                            )}
                        </div>
                    </div>

                    <DataTable
                        columns={columns}
                        dataSource={agents.data}
                        rowKey="id"
                        rowSelection={rowSelection}
                        paginationData={{
                            current_page: agents.current_page,
                            last_page: agents.last_page,
                            per_page: agents.per_page,
                            total: agents.total,
                            from: agents.from ?? null,
                            to: agents.to ?? null,
                        }}
                        onPageChange={(page) => {
                            router.get(
                                route("agents.index"),
                                { ...filters, page },
                                { preserveState: true, preserveScroll: true },
                            );
                        }}
                        scroll={{ x: 1000, y: "calc(100vh - 280px)" }}
                        size="small"
                    />
                </div>
            </PageLayout>

            <SaveAgentModal
                open={["add", "edit"].includes(action ?? "")}
                onClose={handleClose}
                agent={action === "edit" ? agent : undefined}
            />

            <ImportAgents
                open={action === "import"}
                onClose={() => handleClose()}
            />

            <DeleteAgent
                open={action === "delete"}
                onClose={() => handleClose()}
                agent={agent}
            />
        </>
    );
};

Index.layout = (page: React.ReactNode) => (
    <DashboardLayout>{page}</DashboardLayout>
);

export default Index;
