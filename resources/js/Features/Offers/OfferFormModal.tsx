import React, { useState, useEffect, useCallback } from "react";
import {
    Drawer,
    Form,
    Input,
    InputNumber,
    Select,
    DatePicker,
    Button,
    Alert,
    Divider,
    Space,
    Checkbox,
    Tag,
    Spin,
    Switch,
    Tooltip,
    Typography,
} from "antd";
import { router } from "@inertiajs/react";
import {
    MinusCircleOutlined,
    PlusOutlined,
    CheckSquareFilled,
    BorderOutlined,
    InfoCircleOutlined,
} from "@ant-design/icons";
import { useApiMutate, useApiQuery } from "@/lib/api/client";
import type { ApiResponse } from "@/lib/api/types";
import {
    generatePropertySubtitle,
    isLoading as getLoadingStatus,
} from "@/lib/utils";
import { errorFormatter } from "@/lib/api/utils/common";
import type {
    Offer,
    OfferFormValues,
    OfferablePivot,
} from "@/Types/api/offers";
import type {
    Developer,
    DeveloperProject,
    DeveloperProjectUnitType,
} from "@/Types/developerProject";
import dayjs from "dayjs";

const { Text } = Typography;

type UnitTypeWithPivot = DeveloperProjectUnitType & { pivot?: OfferablePivot };
type ProjectWithUnitTypes = DeveloperProject & {
    unit_types?: DeveloperProjectUnitType[];
};
type OfferUnitTypeAttachPayload = {
    offerable_type: "unit_type";
    offerable_ids: number[];
};
type OfferUnitTypeTogglePayload = {
    offerable_type: "unit_type";
    offerable_id: number;
};

interface OfferFormModalProps {
    open: boolean;
    onClose: () => void;
    offer?: Offer | null;
    onSuccess?: () => void;
    /** Pre-fill developer when creating from Developer Show page */
    defaultDeveloperId?: number;
}

// ── Lazy unit-type fetcher ──────────────────────────────────
const fetchUnitTypes = async (
    projectId: number,
): Promise<DeveloperProjectUnitType[]> => {
    const res = await fetch(
        route("developer-projects.unit-types.index", { projectId }),
        {
            headers: {
                "X-Requested-With": "XMLHttpRequest",
                Accept: "application/json",
            },
        },
    );
    const json = await res.json();
    return json.unit_types ?? [];
};

// ── CREATE MODE: per-project panel ─────────────────────────
interface ProjectPanelCreateProps {
    project: DeveloperProject;
    checked: boolean;
    onCheckProject: (id: number, checked: boolean) => void;
    unitTypes: DeveloperProjectUnitType[];
    loading: boolean;
    selectedUnitTypeIds: Set<number>;
    onToggleUnitType: (id: number, checked: boolean) => void;
}

const ProjectPanelCreate: React.FC<ProjectPanelCreateProps> = ({
    project,
    checked,
    onCheckProject,
    unitTypes,
    loading,
    selectedUnitTypeIds,
    onToggleUnitType,
}) => {
    const selectedCount = unitTypes.filter((ut) =>
        selectedUnitTypeIds.has(ut.id),
    ).length;
    const allSelected =
        unitTypes.length > 0 && selectedCount === unitTypes.length;

    const handleSelectAll = () => {
        unitTypes.forEach((ut) => onToggleUnitType(ut.id, !allSelected));
    };

    return (
        <div
            className={`border rounded-lg mb-2 overflow-hidden transition-colors ${
                checked ? "border-blue-300" : "border-gray-200"
            }`}
        >
            {/* Project header row */}
            <div
                className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer select-none ${
                    checked ? "bg-blue-50" : "bg-gray-50 hover:bg-gray-100"
                }`}
                onClick={() => onCheckProject(project.id, !checked)}
            >
                <Checkbox
                    checked={checked}
                    onChange={(e) => {
                        e.stopPropagation();
                        onCheckProject(project.id, e.target.checked);
                    }}
                    onClick={(e) => e.stopPropagation()}
                />
                <span className="font-medium text-sm text-gray-800 flex-1">
                    {project.name}
                </span>
                {checked && unitTypes.length > 0 && !loading && (
                    <span className="text-xs text-blue-500 font-medium">
                        {selectedCount}/{unitTypes.length} unit types
                    </span>
                )}
                {loading && <Spin size="small" />}
            </div>

            {/* Unit types body */}
            {checked && (
                <div className="bg-white px-3 py-2 border-t border-gray-100">
                    {loading ? (
                        <div className="flex items-center gap-2 py-3 text-gray-400 text-xs justify-center">
                            <Spin size="small" />
                            <span>Loading unit types…</span>
                        </div>
                    ) : unitTypes.length === 0 ? (
                        <p className="text-xs text-gray-400 py-2 text-center">
                            No unit types defined for this project yet.
                        </p>
                    ) : (
                        <>
                            {/* Select-all row */}
                            <div className="flex items-center justify-between mb-2 pb-1.5 border-b border-gray-100">
                                <Text className="text-xs text-gray-500">
                                    Choose unit types this offer applies to
                                </Text>
                                <Button
                                    type="link"
                                    size="small"
                                    className="p-0 h-auto text-xs"
                                    icon={
                                        allSelected ? (
                                            <CheckSquareFilled />
                                        ) : (
                                            <BorderOutlined />
                                        )
                                    }
                                    onClick={handleSelectAll}
                                >
                                    {allSelected
                                        ? "Deselect all"
                                        : "Select all"}
                                </Button>
                            </div>

                            <div className="space-y-1">
                                {unitTypes.map((ut) => {
                                    const isChecked = selectedUnitTypeIds.has(
                                        ut.id,
                                    );
                                    return (
                                        <div
                                            key={ut.id}
                                            className={`flex items-center gap-2.5 rounded-md px-2 py-1.5 cursor-pointer transition-colors ${
                                                isChecked
                                                    ? "bg-blue-50 hover:bg-blue-100"
                                                    : "hover:bg-gray-50"
                                            }`}
                                            onClick={() =>
                                                onToggleUnitType(
                                                    ut.id,
                                                    !isChecked,
                                                )
                                            }
                                        >
                                            <Checkbox
                                                checked={isChecked}
                                                onChange={(e) =>
                                                    onToggleUnitType(
                                                        ut.id,
                                                        e.target.checked,
                                                    )
                                                }
                                                onClick={(e) =>
                                                    e.stopPropagation()
                                                }
                                            />
                                            <span className="text-sm text-gray-700 flex-1 leading-snug">
                                                {ut.display_label ||
                                                    `${ut.primary_category} — ${ut.property_type ?? "N/A"}`}
                                            </span>
                                            {ut.bedrooms != null && (
                                                <Tag className="text-xs shrink-0">
                                                    {ut.bedrooms} bed
                                                </Tag>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </>
                    )}
                </div>
            )}
        </div>
    );
};

// ── EDIT MODE: per-project panel ───────────────────────────
interface ProjectPanelEditProps {
    project: ProjectWithUnitTypes;
    attachedUnitTypes: UnitTypeWithPivot[];
    offerId: number;
    onRefetch: () => void;
}

const ProjectPanelEdit: React.FC<ProjectPanelEditProps> = ({
    project,
    attachedUnitTypes,
    offerId,
    onRefetch,
}) => {
    const [loadingIds, setLoadingIds] = useState<Set<number>>(new Set());
    const { mutateAsync: attachUnitType } = useApiMutate<
        OfferUnitTypeAttachPayload,
        unknown,
        ApiResponse<unknown>
    >(route("offers.attach", offerId), "POST", onRefetch);
    const { mutateAsync: enableUnitType } = useApiMutate<
        OfferUnitTypeTogglePayload,
        unknown,
        ApiResponse<unknown>
    >(route("offers.enable", offerId), "POST", onRefetch);
    const { mutateAsync: disableUnitType } = useApiMutate<
        OfferUnitTypeTogglePayload,
        unknown,
        ApiResponse<unknown>
    >(route("offers.disable", offerId), "POST", onRefetch);

    const allProjectUnitTypes: DeveloperProjectUnitType[] =
        (project as any).unit_types ?? [];
    const attachedById = new Map(attachedUnitTypes.map((ut) => [ut.id, ut]));
    const activeCount = attachedUnitTypes.filter(
        (ut) => ut.pivot?.is_active !== false,
    ).length;

    const setLoading = (id: number, on: boolean) =>
        setLoadingIds((prev) => {
            const s = new Set(prev);
            on ? s.add(id) : s.delete(id);
            return s;
        });

    const handleToggle = async (unitTypeId: number, enable: boolean) => {
        setLoading(unitTypeId, true);
        try {
            const attached = attachedById.get(unitTypeId);

            if (!attached) {
                await attachUnitType({
                    offerable_type: "unit_type",
                    offerable_ids: [unitTypeId],
                });

                return;
            }

            const payload: OfferUnitTypeTogglePayload = {
                offerable_type: "unit_type",
                offerable_id: unitTypeId,
            };

            if (enable) {
                await enableUnitType(payload);
            } else {
                await disableUnitType(payload);
            }
        } catch {
            return;
        } finally {
            setLoading(unitTypeId, false);
        }
    };

    return (
        <div className="border rounded-lg mb-2 overflow-hidden border-gray-200">
            {/* Project header */}
            <div className="flex items-center gap-3 px-3 py-2.5 bg-gray-50 border-b border-gray-100">
                <span className="font-medium text-sm text-gray-800 flex-1">
                    {project.name}
                </span>
                <Tag color={activeCount > 0 ? "blue" : "default"}>
                    {activeCount} active unit type{activeCount !== 1 ? "s" : ""}
                </Tag>
            </div>

            {/* Unit types */}
            <div className="px-3 py-2 bg-white">
                {allProjectUnitTypes.length === 0 ? (
                    <p className="text-xs text-gray-400 py-2 text-center">
                        No unit types in this project.
                    </p>
                ) : (
                    <div className="space-y-1">
                        {allProjectUnitTypes.map((ut) => {
                            const attached = attachedById.get(ut.id);
                            const isActive = attached
                                ? attached.pivot?.is_active !== false
                                : false;
                            const isNew = !attached;
                            const isLoading = loadingIds.has(ut.id);

                            return (
                                <div
                                    key={ut.id}
                                    className="flex items-center gap-2.5 rounded-md px-2 py-1.5 hover:bg-gray-50 transition-colors"
                                >
                                    <Switch
                                        size="small"
                                        checked={isActive}
                                        loading={isLoading}
                                        onChange={(checked) =>
                                            handleToggle(ut.id, checked)
                                        }
                                    />
                                    <span
                                        className={`text-sm flex-1 leading-snug ${
                                            isActive
                                                ? "text-gray-800"
                                                : "text-gray-400"
                                        }`}
                                    >
                                        {generatePropertySubtitle(ut)}
                                    </span>
                                    {ut.bedrooms != null && (
                                        <Tag className="text-xs shrink-0">
                                            {ut.bedrooms} bed
                                        </Tag>
                                    )}
                                    {isNew && (
                                        <Tooltip title="Added after broadcast — toggle on to attach">
                                            <Tag
                                                color="orange"
                                                className="text-xs shrink-0"
                                            >
                                                New
                                            </Tag>
                                        </Tooltip>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
};

// ── Main component ──────────────────────────────────────────
const OfferFormModal: React.FC<OfferFormModalProps> = ({
    open,
    onClose,
    offer,
    onSuccess,
    defaultDeveloperId,
}) => {
    const [form] = Form.useForm<OfferFormValues>();
    const [errors, setErrors] = useState<string[]>([]);
    const isEditing = !!offer;

    const offerType = Form.useWatch("type", form);
    const selectedDeveloperId = Form.useWatch("developer_id", form);

    // ── CREATE mode state ───────────────────────────────────
    const [checkedProjectIds, setCheckedProjectIds] = useState<Set<number>>(
        new Set(),
    );
    const [unitTypesByProject, setUnitTypesByProject] = useState<
        Record<number, DeveloperProjectUnitType[]>
    >({});
    const [loadingProjectIds, setLoadingProjectIds] = useState<Set<number>>(
        new Set(),
    );
    const [selectedUnitTypeIds, setSelectedUnitTypeIds] = useState<Set<number>>(
        new Set(),
    );

    // Fetch developers
    const { data: developersData } = useApiQuery<{
        status: string;
        developers: Developer[];
    }>({
        path: route("developers.all"),
        options: { enabled: open },
    });
    const developers = developersData?.developers ?? [];

    // Fetch projects for selected developer (create mode)
    const { data: projectsData } = useApiQuery<{
        status: string;
        projects: DeveloperProject[];
    }>({
        path: route("developer-projects.all"),
        options: { enabled: open && !!selectedDeveloperId },
    });
    const developerProjects = (projectsData?.projects ?? []).filter(
        (p) => p.developer_id === selectedDeveloperId,
    );

    // Fetch full offer details when editing (includes developerProjects.unit_types + unitTypes)
    const { data: offerDetailData, refetch: refetchDetail } = useApiQuery<{
        status: string;
        offer: Offer & {
            developer_projects?: (DeveloperProject & {
                unit_types?: DeveloperProjectUnitType[];
            })[];
            unit_types?: UnitTypeWithPivot[];
        };
    }>({
        path: isEditing && offer?.id ? route("offers.show", offer.id) : "",
        options: { enabled: open && isEditing && !!offer?.id },
    });
    const offerDetail = offerDetailData?.offer;
    const editProjects = offerDetail?.developer_projects ?? [];
    const editAttachedUnitTypes = (offerDetail?.unit_types ??
        []) as UnitTypeWithPivot[];

    // Group attached unit types by project for edit panels
    const attachedByProject = useCallback(
        (projectId: number) =>
            editAttachedUnitTypes.filter(
                (ut) => ut.developer_project_id === projectId,
            ),
        [editAttachedUnitTypes],
    );

    // ── Lazy fetch unit types for a project (create mode) ──
    const loadProjectUnitTypes = useCallback(
        async (projectId: number) => {
            if (unitTypesByProject[projectId]) return; // already loaded
            setLoadingProjectIds((prev) => new Set([...prev, projectId]));
            try {
                const units = await fetchUnitTypes(projectId);
                setUnitTypesByProject((prev) => ({
                    ...prev,
                    [projectId]: units,
                }));
            } finally {
                setLoadingProjectIds((prev) => {
                    const s = new Set(prev);
                    s.delete(projectId);
                    return s;
                });
            }
        },
        [unitTypesByProject],
    );

    const handleCheckProject = useCallback(
        async (projectId: number, checked: boolean) => {
            if (checked) {
                setCheckedProjectIds((prev) => new Set([...prev, projectId]));
                await loadProjectUnitTypes(projectId);
            } else {
                setCheckedProjectIds((prev) => {
                    const s = new Set(prev);
                    s.delete(projectId);
                    return s;
                });
                // Deselect all unit types belonging to this project
                const unitTypes = unitTypesByProject[projectId] ?? [];
                setSelectedUnitTypeIds((prev) => {
                    const s = new Set(prev);
                    unitTypes.forEach((ut) => s.delete(ut.id));
                    return s;
                });
            }
        },
        [loadProjectUnitTypes, unitTypesByProject],
    );

    const handleToggleUnitType = useCallback((id: number, checked: boolean) => {
        setSelectedUnitTypeIds((prev) => {
            const s = new Set(prev);
            checked ? s.add(id) : s.delete(id);
            return s;
        });
    }, []);

    // ── Mutations ───────────────────────────────────────────
    const { mutate: createOffer, status: createStatus } = useApiMutate<
        any,
        any,
        ApiResponse<any>
    >(route("offers.store"), "POST");

    const { mutate: updateOffer, status: updateStatus } = useApiMutate<
        any,
        any,
        ApiResponse<any>
    >(isEditing ? route("offers.update", offer?.id) : "", "PUT");

    // ── Reset on open ───────────────────────────────────────
    useEffect(() => {
        if (open && isEditing && offer) {
            form.setFieldsValue({
                developer_id: offer.developer_id ?? undefined,
                name: offer.name,
                description: offer.description,
                links: offer.links ?? [],
                type: offer.type,
                value: offer.value ? Number(offer.value) : undefined,
                max_discount_amount: offer.max_discount_amount,
                starts_at: offer.starts_at
                    ? (dayjs(offer.starts_at) as any)
                    : null,
                ends_at: offer.ends_at ? (dayjs(offer.ends_at) as any) : null,
            });
        } else if (open && !isEditing) {
            form.resetFields();
            form.setFieldsValue({
                type: "percentage",
                developer_id: defaultDeveloperId,
            });
            setCheckedProjectIds(new Set());
            setUnitTypesByProject({});
            setLoadingProjectIds(new Set());
            setSelectedUnitTypeIds(new Set());
        }
    }, [open, offer, isEditing, form, defaultDeveloperId]);

    // If defaultDeveloperId provided, auto-load its projects & mark them lazily
    useEffect(() => {
        if (!open || isEditing) return;
        // Reset project state when developer changes
        setCheckedProjectIds(new Set());
        setUnitTypesByProject({});
        setSelectedUnitTypeIds(new Set());
    }, [selectedDeveloperId, open, isEditing]);

    // ── Submit (create mode only) ───────────────────────────
    const handleSubmit = () => {
        form.validateFields().then((values) => {
            setErrors([]);
            const payload = {
                ...values,
                project_ids: Array.from(checkedProjectIds),
                unit_type_ids: Array.from(selectedUnitTypeIds),
                starts_at: values.starts_at
                    ? dayjs(values.starts_at).format("YYYY-MM-DD")
                    : null,
                ends_at: values.ends_at
                    ? dayjs(values.ends_at).format("YYYY-MM-DD")
                    : null,
            };

            const callback = {
                onSuccess: () => {
                    handleCancel();
                    if (onSuccess) {
                        onSuccess();
                    } else {
                        router.reload();
                    }
                },
                onError: (err: any) => {
                    const responseErrors = errorFormatter(err)?.errors || [];
                    setErrors(Object.values(responseErrors).flat() as string[]);
                },
            };

            if (isEditing) {
                updateOffer(payload, callback);
            } else {
                createOffer(payload, callback);
            }
        });
    };

    const handleCancel = () => {
        form.resetFields();
        setErrors([]);
        onClose();
    };

    const loading =
        getLoadingStatus({ status: createStatus }) ||
        getLoadingStatus({ status: updateStatus });

    const totalSelectedUnitTypes = selectedUnitTypeIds.size;

    return (
        <Drawer
            title={
                <div className="flex items-center gap-2">
                    <span>{isEditing ? "Edit Offer" : "Create Offer"}</span>
                    {!isEditing && totalSelectedUnitTypes > 0 && (
                        <Tag color="blue" className="font-normal">
                            {totalSelectedUnitTypes} unit type
                            {totalSelectedUnitTypes !== 1 ? "s" : ""} selected
                        </Tag>
                    )}
                </div>
            }
            placement="right"
            size="large"
            open={open}
            onClose={handleCancel}
            destroyOnHidden
            footer={
                <div className="flex justify-end gap-3">
                    <Button onClick={handleCancel}>Cancel</Button>
                    <Button
                        type="primary"
                        onClick={handleSubmit}
                        loading={loading}
                    >
                        {isEditing ? "Save Changes" : "Create Offer"}
                    </Button>
                </div>
            }
        >
            {errors.length > 0 && (
                <Alert
                    type="error"
                    className="mb-4"
                    message="Validation Errors"
                    description={
                        <ul className="list-disc list-inside">
                            {errors.map((e, i) => (
                                <li key={i}>{e}</li>
                            ))}
                        </ul>
                    }
                    closable
                    onClose={() => setErrors([])}
                />
            )}

            <Form form={form} layout="vertical">
                {/* ── Developer (locked in edit) ── */}
                {isEditing ? (
                    <div className="mb-4">
                        <label className="block text-xs font-medium text-gray-500 mb-1">
                            Developer
                        </label>
                        <div className="px-3 py-2 bg-gray-50 rounded border border-gray-200 text-sm text-gray-700">
                            {offer?.developer?.name ?? "—"}
                        </div>
                    </div>
                ) : (
                    <Form.Item
                        name="developer_id"
                        label="Developer (Construction Company)"
                        rules={[
                            {
                                required: true,
                                message: "Please select a developer",
                            },
                        ]}
                    >
                        <Select
                            placeholder="Select a developer…"
                            showSearch
                            filterOption={(input, option) =>
                                (option?.label ?? "")
                                    .toString()
                                    .toLowerCase()
                                    .includes(input.toLowerCase())
                            }
                            options={developers.map((d) => ({
                                label: d.name,
                                value: d.id,
                            }))}
                        />
                    </Form.Item>
                )}

                {/* ── Project + Unit Type selection ── */}
                {!isEditing && selectedDeveloperId && (
                    <div className="mb-5">
                        <div className="flex items-center gap-2 mb-2">
                            <label className="text-sm font-medium text-gray-700">
                                Projects &amp; Unit Types
                            </label>
                            <Tooltip title="Select which projects and unit types this offer applies to. Unit types are the primary entry point — offers are resolved at the unit type level.">
                                <InfoCircleOutlined className="text-gray-400 text-xs" />
                            </Tooltip>
                            {checkedProjectIds.size > 0 && (
                                <span className="ml-auto text-xs text-gray-400">
                                    {checkedProjectIds.size} project
                                    {checkedProjectIds.size !== 1
                                        ? "s"
                                        : ""}{" "}
                                    selected
                                </span>
                            )}
                        </div>

                        {developerProjects.length === 0 ? (
                            <p className="text-sm text-gray-400 py-3 text-center border border-dashed border-gray-200 rounded-lg">
                                No projects found for this developer.
                            </p>
                        ) : (
                            developerProjects.map((project) => (
                                <ProjectPanelCreate
                                    key={project.id}
                                    project={project}
                                    checked={checkedProjectIds.has(project.id)}
                                    onCheckProject={handleCheckProject}
                                    unitTypes={
                                        unitTypesByProject[project.id] ?? []
                                    }
                                    loading={loadingProjectIds.has(project.id)}
                                    selectedUnitTypeIds={selectedUnitTypeIds}
                                    onToggleUnitType={handleToggleUnitType}
                                />
                            ))
                        )}

                        {checkedProjectIds.size > 0 &&
                            selectedUnitTypeIds.size === 0 && (
                                <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
                                    <InfoCircleOutlined />
                                    No unit types selected — the offer won't
                                    apply to any properties until unit types are
                                    attached.
                                </p>
                            )}
                    </div>
                )}

                {/* ── Edit mode: project + unit type tree ── */}
                {isEditing && (
                    <div className="mb-5">
                        <div className="flex items-center gap-2 mb-2">
                            <label className="text-sm font-medium text-gray-700">
                                Unit Types
                            </label>
                            <Tooltip title="Toggle individual unit types on or off. 'New' unit types were added after the offer was broadcast — switch them on to attach.">
                                <InfoCircleOutlined className="text-gray-400 text-xs" />
                            </Tooltip>
                        </div>

                        {!offerDetail ? (
                            <div className="flex justify-center py-6">
                                <Spin />
                            </div>
                        ) : editProjects.length === 0 ? (
                            <p className="text-sm text-gray-400 py-3 text-center border border-dashed border-gray-200 rounded-lg">
                                No projects attached. Use the Offer Detail view
                                to attach projects.
                            </p>
                        ) : (
                            editProjects.map((project) => (
                                <ProjectPanelEdit
                                    key={project.id}
                                    project={project as ProjectWithUnitTypes}
                                    attachedUnitTypes={attachedByProject(
                                        project.id,
                                    )}
                                    offerId={offer!.id}
                                    onRefetch={refetchDetail}
                                />
                            ))
                        )}
                    </div>
                )}

                <Divider className="my-4" />

                {/* ── Offer name + description ── */}
                <Form.Item
                    name="name"
                    label="Offer Name"
                    rules={[
                        {
                            required: true,
                            message: "Please enter the offer name",
                        },
                    ]}
                >
                    <Input placeholder="e.g. Summer 2026 Early Bird" />
                </Form.Item>

                <Form.Item name="description" label="Description">
                    <Input.TextArea
                        rows={3}
                        placeholder="Optional description"
                    />
                </Form.Item>

                {/* ── Links ── */}
                <Form.List name="links">
                    {(fields, { add, remove }) => (
                        <div className="mb-4">
                            <label className="block text-sm font-medium mb-1.5">
                                Links
                            </label>
                            {fields.map(({ key, name, ...restField }) => (
                                <Space
                                    key={key}
                                    className="flex mb-2"
                                    align="start"
                                >
                                    <Form.Item
                                        {...restField}
                                        name={[name, "label"]}
                                        rules={[
                                            {
                                                required: true,
                                                message: "Label required",
                                            },
                                        ]}
                                        className="mb-0"
                                    >
                                        <Input placeholder="Label" />
                                    </Form.Item>
                                    <Form.Item
                                        {...restField}
                                        name={[name, "url"]}
                                        rules={[
                                            {
                                                required: true,
                                                message: "URL required",
                                            },
                                            {
                                                type: "url",
                                                message: "Enter a valid URL",
                                            },
                                        ]}
                                        className="mb-0 flex-1"
                                    >
                                        <Input placeholder="https://…" />
                                    </Form.Item>
                                    <MinusCircleOutlined
                                        className="mt-2 text-red-500 cursor-pointer"
                                        onClick={() => remove(name)}
                                    />
                                </Space>
                            ))}
                            <Button
                                type="dashed"
                                onClick={() => add()}
                                icon={<PlusOutlined />}
                                size="small"
                            >
                                Add Link
                            </Button>
                        </div>
                    )}
                </Form.List>

                <Divider className="my-4" />

                {/* ── Discount type + value ── */}
                <div className="grid grid-cols-2 gap-4">
                    <Form.Item
                        name="type"
                        label="Discount Type"
                        rules={[
                            { required: true, message: "Please select a type" },
                        ]}
                    >
                        <Select
                            options={[
                                {
                                    label: "Percentage (%)",
                                    value: "percentage",
                                },
                                { label: "Fixed Amount", value: "fixed" },
                                {
                                    label: "Perks / Non-monetary",
                                    value: "perks",
                                },
                            ]}
                            onChange={() => {
                                if (form.getFieldValue("type") !== "perks") {
                                    form.setFieldsValue({
                                        value: undefined,
                                        max_discount_amount: undefined,
                                    });
                                }
                            }}
                        />
                    </Form.Item>

                    {offerType !== "perks" && (
                        <Form.Item
                            name="value"
                            label="Discount Value"
                            rules={[
                                {
                                    required: true,
                                    message: "Please enter the discount value",
                                },
                                {
                                    type: "number",
                                    min: 0.01,
                                    message: "Must be greater than 0",
                                },
                                ...(offerType === "percentage"
                                    ? [
                                          {
                                              type: "number" as const,
                                              max: 100,
                                              message:
                                                  "Percentage cannot exceed 100",
                                          },
                                      ]
                                    : []),
                            ]}
                        >
                            <InputNumber
                                className="w-full"
                                placeholder={
                                    offerType === "percentage"
                                        ? "e.g. 10"
                                        : "e.g. 5000"
                                }
                                suffix={offerType === "percentage" ? "%" : ""}
                                min={0.01}
                                max={
                                    offerType === "percentage" ? 100 : undefined
                                }
                            />
                        </Form.Item>
                    )}
                </div>

                {offerType === "percentage" && (
                    <Form.Item
                        name="max_discount_amount"
                        label="Max Discount Cap"
                        tooltip="Maximum absolute discount amount when using percentage. Leave empty for no cap."
                    >
                        <InputNumber
                            className="w-full"
                            placeholder="e.g. 50 000"
                            min={0}
                        />
                    </Form.Item>
                )}

                {/* ── Date range ── */}
                <div className="grid grid-cols-2 gap-4">
                    <Form.Item name="starts_at" label="Start Date">
                        <DatePicker className="w-full" />
                    </Form.Item>
                    <Form.Item name="ends_at" label="End Date">
                        <DatePicker className="w-full" />
                    </Form.Item>
                </div>
            </Form>
        </Drawer>
    );
};

export default OfferFormModal;
