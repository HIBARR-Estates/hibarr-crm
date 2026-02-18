import React, { useState, useMemo, useCallback } from "react";
import {
    Form,
    Select,
    Row,
    Col,
    Button,
    Modal,
    Input,
    Divider,
    message,
    Alert,
} from "antd";
import { PlusOutlined, InfoCircleOutlined } from "@ant-design/icons";
import type { FormInstance } from "antd/lib/form";
import type { PrimaryCategory, PropertyEnumValues } from "@/Types";
import type { DeveloperProjectUnitType } from "@/Types/developerProject";
import { usePage } from "@inertiajs/react";
import { useApiMutate } from "@/lib/api/client/useApiMutate";
import { useApiQuery } from "@/lib/api/client/useApiQuery";
import { SPECIFICATION_FIELDS } from "../fieldConfig";
import { useFormOptions } from "../useFormOptions";

const { Option } = Select;

interface CoreDetailsSectionProps {
    form: FormInstance;
    primaryCategory: PrimaryCategory;
    enumValues?: PropertyEnumValues;
    isSalesManager?: boolean;
    onUnitTypeSelect?: (unitType: DeveloperProjectUnitType | null) => void;
    lockedFields?: Set<string>;
}

interface DeveloperOption {
    id: number;
    name: string;
    project_list?: string[] | null;
}

interface DeveloperProject {
    id: number;
    name: string;
    developer_id?: number | null;
    developer?: { id: number; name: string } | null;
    location?: { id: number; name: string } | null;
}

const CoreDetailsSection: React.FC<CoreDetailsSectionProps> = ({
    form,
    primaryCategory,
    enumValues,
    isSalesManager = false,
    onUnitTypeSelect,
    lockedFields = new Set<string>(),
}) => {
    const { props } = usePage<any>();
    const [developerProjects, setDeveloperProjects] = useState<
        DeveloperProject[]
    >((props?.developerProjects || []) as DeveloperProject[]);
    const [developers, setDevelopers] = useState<DeveloperOption[]>(
        (props?.developers || []) as DeveloperOption[],
    );

    const {
        propertyTypeOptions,
        saleTypeOptions,
        statusOptions,
        unitStyleOptions,
    } = useFormOptions(enumValues, primaryCategory);
    const specFields = SPECIFICATION_FIELDS[primaryCategory];

    // Track within_site and selected developer for cascading
    const withinSite = Form.useWatch("within_site", form);
    const selectedDeveloperId = Form.useWatch("_selected_developer_id", form);

    // Filter projects by selected developer
    const filteredProjects = useMemo(() => {
        if (!selectedDeveloperId) return developerProjects;
        return developerProjects.filter(
            (p) => p.developer_id === selectedDeveloperId,
        );
    }, [selectedDeveloperId, developerProjects]);

    // Track selected project for unit type cascade
    const selectedProjectId = Form.useWatch("developer_project_id", form);

    // Track associated construction company for cascading project list
    const associatedCompanyValue = Form.useWatch(
        "associated_construction_company",
        form,
    );

    // Derive the developer's project_list based on selected associated construction company (developer project name)
    const associatedProjectList = useMemo(() => {
        if (!associatedCompanyValue) return [];
        // Find the developer project by name
        const project = developerProjects.find(
            (p) => p.name === associatedCompanyValue,
        );
        if (!project?.developer_id) return [];
        // Find the developer and return their project_list
        const developer = developers.find((d) => d.id === project.developer_id);
        return developer?.project_list ?? [];
    }, [associatedCompanyValue, developerProjects, developers]);

    // Fetch unit types for the selected project
    const { data: unitTypesData, isLoading: unitTypesLoading } = useApiQuery<{
        unit_types: DeveloperProjectUnitType[];
    }>({
        path: selectedProjectId
            ? route("developer-projects.unit-types.index", {
                  projectId: selectedProjectId,
              })
            : "",
        options: { enabled: !!selectedProjectId },
    });
    const unitTypes = unitTypesData?.unit_types ?? [];

    // Handle unit type selection
    const handleUnitTypeChange = useCallback(
        (value: number | undefined) => {
            if (!value) {
                onUnitTypeSelect?.(null);
                return;
            }
            const selected = unitTypes.find((ut) => ut.id === value);
            onUnitTypeSelect?.(selected ?? null);
        },
        [unitTypes, onUnitTypeSelect],
    );

    // Inline add modal state
    const [addDeveloperOpen, setAddDeveloperOpen] = useState(false);
    const [addProjectOpen, setAddProjectOpen] = useState(false);
    const [newDeveloperName, setNewDeveloperName] = useState("");
    const [newProjectName, setNewProjectName] = useState("");

    // Mutations for inline add
    const developerMutation = useApiMutate<{ name: string }, any, any>(
        route("developers.store"),
        "POST",
        (response: any) => {
            const created = response?.developer;
            if (created) {
                setDevelopers((prev) =>
                    [...prev, { id: created.id, name: created.name }].sort(
                        (a, b) => a.name.localeCompare(b.name),
                    ),
                );
                form.setFieldValue("_selected_developer_id", created.id);
            }
            setAddDeveloperOpen(false);
            setNewDeveloperName("");
        },
    );

    const projectMutation = useApiMutate<
        { name: string; developer_id?: number },
        any,
        any
    >(route("developer-projects.store"), "POST", (response: any) => {
        const created = response?.project;
        if (created) {
            const newProject: DeveloperProject = {
                id: created.id,
                name: created.name,
                developer_id: created.developer_id,
                developer: created.developer,
                location: created.location,
            };
            setDeveloperProjects((prev) =>
                [...prev, newProject].sort((a, b) =>
                    a.name.localeCompare(b.name),
                ),
            );
            form.setFieldValue("developer_project_id", created.id);
        }
        setAddProjectOpen(false);
        setNewProjectName("");
    });

    // Unit style change handler (multi-select)
    const handleUnitStyleChange = (value: string[]) => {
        if (value?.includes("studio")) {
            form.setFieldValue("bedrooms", 0);
            form.setFieldValue("living_room", undefined);
        }
    };

    // When within_site toggled off, clear project & unit type selection
    const handleWithinSiteChange = useCallback(
        (value: boolean | undefined) => {
            if (!value) {
                form.setFieldValue("_selected_developer_id", undefined);
                form.setFieldValue("developer_project_id", undefined);
                form.setFieldValue("developer_project_unit_type_id", undefined);
                form.setFieldValue(
                    "associated_construction_company",
                    undefined,
                );
                form.setFieldValue(
                    "associated_construction_company_project",
                    undefined,
                );
                onUnitTypeSelect?.(null);
            }
        },
        [form, onUnitTypeSelect],
    );

    // When associated construction company changes, clear associated project
    const handleAssociatedCompanyChange = useCallback(
        (value: string | undefined) => {
            form.setFieldValue(
                "associated_construction_company_project",
                undefined,
            );
        },
        [form],
    );

    // When developer changes, clear project & unit type selection
    const handleDeveloperChange = useCallback(
        (value: number | undefined) => {
            form.setFieldValue("developer_project_id", undefined);
            form.setFieldValue("developer_project_unit_type_id", undefined);
            onUnitTypeSelect?.(null);
        },
        [form, onUnitTypeSelect],
    );

    // When project changes, clear unit type selection
    const handleProjectChange = useCallback(
        (value: number | undefined) => {
            form.setFieldValue("developer_project_unit_type_id", undefined);
            onUnitTypeSelect?.(null);
        },
        [form, onUnitTypeSelect],
    );

    // Inline add: create a new developer (construction company)
    const handleAddDeveloper = () => {
        if (!newDeveloperName.trim()) {
            message.warning("Please enter a company name");
            return;
        }
        developerMutation.mutate({ name: newDeveloperName.trim() });
    };

    // Inline add: create a new project under the selected developer
    const handleAddProject = () => {
        if (!newProjectName.trim()) {
            message.warning("Please enter a project name");
            return;
        }
        projectMutation.mutate({
            name: newProjectName.trim(),
            developer_id: selectedDeveloperId || undefined,
        });
    };

    const showProjectFields = primaryCategory !== "land";

    return (
        <>
            <Row gutter={[16, 0]}>
                {/* Property Type */}
                <Col xs={24} md={12}>
                    <Form.Item
                        name="property_type"
                        label="Property Type"
                        rules={[
                            {
                                required: true,
                                message: "Please select property type",
                            },
                        ]}
                    >
                        <Select
                            placeholder="Select property type"
                            showSearch
                            optionFilterProp="children"
                            disabled={lockedFields.has("property_type")}
                        >
                            {propertyTypeOptions.map((o) => (
                                <Option key={o.value} value={o.value}>
                                    {o.label}
                                </Option>
                            ))}
                        </Select>
                    </Form.Item>
                </Col>

                {/* Status */}
                <Col xs={24} md={12}>
                    <Form.Item
                        name="status"
                        label="Property Status"
                        rules={[
                            { required: true, message: "Please select status" },
                        ]}
                    >
                        <Select placeholder="Select status">
                            {statusOptions.map((o) => (
                                <Option key={o.value} value={o.value}>
                                    {o.label}
                                </Option>
                            ))}
                        </Select>
                    </Form.Item>
                </Col>

                {/* Sale Type */}
                <Col xs={24} md={12}>
                    <Form.Item
                        name="sale_type"
                        label="Sale Type"
                        rules={[
                            {
                                required: true,
                                message: "Please select sale type",
                            },
                        ]}
                    >
                        <Select placeholder="Select sale type">
                            {saleTypeOptions.map((o) => (
                                <Option key={o.value} value={o.value}>
                                    {o.label}
                                </Option>
                            ))}
                        </Select>
                    </Form.Item>
                </Col>

                {/* Unit Style — residential only, multi-select */}
                {specFields.unitStyle && (
                    <Col xs={24} md={12}>
                        <Form.Item name="unit_style" label="Unit Style">
                            <Select
                                mode="multiple"
                                placeholder="Select unit style(s)"
                                allowClear
                                onChange={handleUnitStyleChange}
                                disabled={lockedFields.has("unit_style")}
                            >
                                {unitStyleOptions.map((o) => (
                                    <Option key={o.value} value={o.value}>
                                        {o.label}
                                    </Option>
                                ))}
                            </Select>
                        </Form.Item>
                    </Col>
                )}

                {/* Residence / Project flow — not applicable for land */}
                {showProjectFields && (
                    <>
                        <Col span={24}>
                            <Divider
                                plain
                                className="!my-2 !text-xs !text-gray-400"
                            >
                                Residence / Project
                            </Divider>
                        </Col>

                        {/* Is this property in a residence or project? */}
                        <Col xs={24} md={12}>
                            <Form.Item
                                name="within_site"
                                label="Is this property in a residence or project?"
                            >
                                <Select
                                    placeholder="Select"
                                    allowClear
                                    onChange={handleWithinSiteChange}
                                >
                                    <Option value={true}>Yes</Option>
                                    <Option value={false}>No</Option>
                                </Select>
                            </Form.Item>
                        </Col>

                        {/* Cascading: Construction Company → Project */}
                        {withinSite === true && (
                            <>
                                {/* Construction Company (Developer) */}
                                <Col xs={24} md={12}>
                                    <Form.Item
                                        name="_selected_developer_id"
                                        label="Construction Company"
                                        tooltip="Select or add the construction company / developer"
                                    >
                                        <Select
                                            placeholder="Select construction company"
                                            allowClear
                                            showSearch
                                            optionFilterProp="children"
                                            onChange={handleDeveloperChange}
                                            dropdownRender={(menu) =>
                                                isSalesManager ? (
                                                    <>
                                                        {menu}
                                                        <Divider className="!my-1" />
                                                        <Button
                                                            type="text"
                                                            icon={
                                                                <PlusOutlined />
                                                            }
                                                            className="w-full text-left"
                                                            onClick={() =>
                                                                setAddDeveloperOpen(
                                                                    true,
                                                                )
                                                            }
                                                        >
                                                            Add new company
                                                        </Button>
                                                    </>
                                                ) : (
                                                    menu
                                                )
                                            }
                                        >
                                            {developers.map((dev) => (
                                                <Option
                                                    key={dev.id}
                                                    value={dev.id}
                                                >
                                                    {dev.name}
                                                </Option>
                                            ))}
                                        </Select>
                                    </Form.Item>
                                </Col>

                                {/* Project Name (DeveloperProject) */}
                                <Col xs={24} md={12}>
                                    <Form.Item
                                        name="developer_project_id"
                                        label="Project Name"
                                        tooltip="Select or add the project / residence name"
                                    >
                                        <Select
                                            placeholder={
                                                selectedDeveloperId
                                                    ? "Select project"
                                                    : "Select a company first, or pick from all projects"
                                            }
                                            allowClear
                                            showSearch
                                            optionFilterProp="children"
                                            onChange={handleProjectChange}
                                            dropdownRender={(menu) =>
                                                isSalesManager ? (
                                                    <>
                                                        {menu}
                                                        <Divider className="!my-1" />
                                                        <Button
                                                            type="text"
                                                            icon={
                                                                <PlusOutlined />
                                                            }
                                                            className="w-full text-left"
                                                            onClick={() =>
                                                                setAddProjectOpen(
                                                                    true,
                                                                )
                                                            }
                                                        >
                                                            Add new project
                                                        </Button>
                                                    </>
                                                ) : (
                                                    menu
                                                )
                                            }
                                        >
                                            {filteredProjects.map((project) => (
                                                <Option
                                                    key={project.id}
                                                    value={project.id}
                                                >
                                                    {project.name}
                                                    {project.location && (
                                                        <span className="text-gray-400 ml-2">
                                                            (
                                                            {
                                                                project.location
                                                                    .name
                                                            }
                                                            )
                                                        </span>
                                                    )}
                                                </Option>
                                            ))}
                                        </Select>
                                    </Form.Item>
                                </Col>

                                {/* Associated Construction Company */}
                                <Col xs={24} md={12}>
                                    <Form.Item
                                        name="associated_construction_company"
                                        label="Associated Construction Company"
                                        tooltip="Select the construction company project associated with this property"
                                    >
                                        <Select
                                            placeholder="Select construction company project"
                                            allowClear
                                            showSearch
                                            optionFilterProp="children"
                                            onChange={
                                                handleAssociatedCompanyChange
                                            }
                                        >
                                            {developerProjects.map(
                                                (project) => (
                                                    <Option
                                                        key={project.id}
                                                        value={project.name}
                                                    >
                                                        {project.name}
                                                    </Option>
                                                ),
                                            )}
                                        </Select>
                                    </Form.Item>
                                </Col>

                                {/* Associated Construction Company Project */}
                                {associatedCompanyValue &&
                                    associatedProjectList.length > 0 && (
                                        <Col xs={24} md={12}>
                                            <Form.Item
                                                name="associated_construction_company_project"
                                                label="Associated Company Project"
                                                tooltip="Select the specific project from the construction company's project list"
                                            >
                                                <Select
                                                    placeholder="Select project"
                                                    allowClear
                                                    showSearch
                                                    optionFilterProp="children"
                                                >
                                                    {associatedProjectList.map(
                                                        (projectName) => (
                                                            <Option
                                                                key={
                                                                    projectName
                                                                }
                                                                value={
                                                                    projectName
                                                                }
                                                            >
                                                                {projectName}
                                                            </Option>
                                                        ),
                                                    )}
                                                </Select>
                                            </Form.Item>
                                        </Col>
                                    )}

                                {/* Unit Type (4th cascade) */}
                                {selectedProjectId && (
                                    <Col xs={24} md={12}>
                                        <Form.Item
                                            name="developer_project_unit_type_id"
                                            label="Unit Type"
                                            tooltip="Select the unit type to auto-fill specifications. Matching fields will be locked."
                                        >
                                            <Select
                                                placeholder={
                                                    unitTypesLoading
                                                        ? "Loading unit types…"
                                                        : "Select unit type"
                                                }
                                                allowClear
                                                showSearch
                                                optionFilterProp="children"
                                                loading={unitTypesLoading}
                                                onChange={handleUnitTypeChange}
                                                notFoundContent={
                                                    unitTypesLoading
                                                        ? "Loading…"
                                                        : "No unit types for this project"
                                                }
                                            >
                                                {unitTypes.map((ut) => (
                                                    <Option
                                                        key={ut.id}
                                                        value={ut.id}
                                                    >
                                                        {ut.display_label ??
                                                            ut.reference_code ??
                                                            `Unit Type #${ut.id}`}
                                                    </Option>
                                                ))}
                                            </Select>
                                        </Form.Item>
                                        {form.getFieldValue(
                                            "developer_project_unit_type_id",
                                        ) && (
                                            <Alert
                                                type="info"
                                                showIcon
                                                icon={<InfoCircleOutlined />}
                                                message="Fields matching this unit type have been auto-filled and locked."
                                                className="!mb-4 !-mt-2"
                                            />
                                        )}
                                    </Col>
                                )}
                            </>
                        )}
                    </>
                )}
            </Row>

            {/* Add Developer Modal */}
            <Modal
                title="Add Construction Company"
                open={addDeveloperOpen}
                onOk={handleAddDeveloper}
                onCancel={() => {
                    setAddDeveloperOpen(false);
                    setNewDeveloperName("");
                }}
                confirmLoading={developerMutation.isPending}
                okText="Create"
                destroyOnClose
            >
                <Input
                    placeholder="Company name"
                    value={newDeveloperName}
                    onChange={(e) => setNewDeveloperName(e.target.value)}
                    onPressEnter={handleAddDeveloper}
                    autoFocus
                />
            </Modal>

            {/* Add Project Modal */}
            <Modal
                title="Add Project"
                open={addProjectOpen}
                onOk={handleAddProject}
                onCancel={() => {
                    setAddProjectOpen(false);
                    setNewProjectName("");
                }}
                confirmLoading={projectMutation.isPending}
                okText="Create"
                destroyOnClose
            >
                {selectedDeveloperId && (
                    <p className="text-gray-500 text-sm mb-2">
                        Under:{" "}
                        <strong>
                            {
                                developers.find(
                                    (d) => d.id === selectedDeveloperId,
                                )?.name
                            }
                        </strong>
                    </p>
                )}
                <Input
                    placeholder="Project name"
                    value={newProjectName}
                    onChange={(e) => setNewProjectName(e.target.value)}
                    onPressEnter={handleAddProject}
                    autoFocus
                />
            </Modal>
        </>
    );
};

export default CoreDetailsSection;
