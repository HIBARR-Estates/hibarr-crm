import { SaveOutlined, WarningOutlined } from "@ant-design/icons";
import {
    Form,
    Input,
    Select,
    InputNumber,
    Card,
    Row,
    Col,
    Divider,
    Button,
    Alert,
} from "antd";
import { PropertyFormProps } from "./PropertyForm";
import { Property } from "@/Types";
import { useEffect, useState, useRef, useMemo, useCallback } from "react";
import { DeveloperProjectOption } from "@/Types/developerProject";
import { usePage } from "@inertiajs/react";
import { PageProps } from "@/Components/DashboardLayout";
import CurrencyInput from "@/Components/CurrencyInput";
import { parsePropertyPrice } from "@/lib/utils";

const { Option } = Select;
const { TextArea } = Input;

interface DeveloperOption {
    id: number;
    name: string;
}

// Property type categories for better organization
const PROPERTY_CATEGORIES = {
    housing: {
        label: "Housing",
        types: [
            "Apartment",
            "Villa",
            "Semi-Detached Villa",
            "Bungalow",
            "Townhouse",
            "Complete Building",
            "Ruin",
        ],
    },
    land: {
        label: "Land",
        types: [
            "Residentially Zoned Land",
            "Field",
            "Residentially and Commercially Zoned Land",
            "Commercially Zoned Land",
            "Industrially Zoned land",
            "Tourism Zoned Land",
            "Olive Grove",
        ],
    },
    commercial: {
        label: "Commercial Real Estate",
        types: [
            "Shop",
            "Hotel",
            "Workplace",
            "Warehouse",
            "Workplace for sale",
            "Office",
        ],
    },
};

const SALE_TYPES = ["For Sale", "For Rent", "For Daily Rental"];
const STATUS_OPTIONS = ["Available", "Under offer", "Sold", "Withdrawn"];

interface BasicInfoTabProps extends Pick<
    PropertyFormProps,
    | "onCancel"
    | "loading"
    | "submitText"
    | "cancelText"
    | "data"
    | "onSubmit"
    | "setErrors"
    | "onErrorsClear"
> {
    setProperty?: (property: Property | undefined) => void;
}

export default function BasicInfoTab({
    onCancel,
    loading,
    submitText,
    cancelText,
    setProperty,
    data,
    onSubmit,
    onErrorsClear,
    setErrors,
}: BasicInfoTabProps) {
    const [form] = Form.useForm<
        Omit<Property, "id"> & {
            developer_project_id?: number;
            _selected_developer_id?: number;
        }
    >();
    const { props } = usePage<PageProps>();
    // const defaultCurrencyId = props.company?.currency_id;
    // const currencies = props.currencies || [];
    // TODO: Refactor the property model to use currency id instead of symbol, also this will mean the import template needs to be updated
    const defaultCurrencySymbol = props.default_currency_symbol || "£";

    // Use ref to track previous data ID to prevent unnecessary updates
    const previousDataIdRef = useRef<number | undefined>(undefined);
    const isInitialMountRef = useRef(true);

    // Get developer projects from page props
    const developerProjects = (props?.developerProjects ||
        []) as DeveloperProjectOption[];
    const developers = (props?.developers || []) as DeveloperOption[];

    // Track selected project to manage location field behavior
    const [selectedProjectId, setSelectedProjectId] = useState<number | null>(
        data?.developer_project_id ?? null,
    );
    const [selectedDeveloperId, setSelectedDeveloperId] = useState<
        number | null
    >(() => {
        if (data?.developer_project_id) {
            const project = (
                (props?.developerProjects as DeveloperProjectOption[]) || []
            ).find((p) => p.id === data.developer_project_id);
            return (project as any)?.developer_id ?? null;
        }
        return null;
    });

    // Find the selected project and check if it has a location
    const selectedProject = useMemo(() => {
        if (!selectedProjectId) return null;
        return (
            developerProjects.find((p) => p.id === selectedProjectId) ?? null
        );
    }, [selectedProjectId, developerProjects]);

    const projectHasLocation = useMemo(() => {
        return (
            selectedProject?.location !== undefined &&
            selectedProject?.location !== null
        );
    }, [selectedProject]);

    const withinSite = Form.useWatch("within_site", form);

    // Filter projects by selected developer
    const filteredProjects = useMemo(() => {
        if (!selectedDeveloperId) return developerProjects;
        return developerProjects.filter(
            (p) => (p as any).developer_id === selectedDeveloperId,
        );
    }, [selectedDeveloperId, developerProjects]);

    const handleWithinSiteChange = useCallback(
        (value: boolean | undefined) => {
            if (!value) {
                setSelectedDeveloperId(null);
                setSelectedProjectId(null);
                form.setFieldValue("_selected_developer_id", undefined);
                form.setFieldValue("developer_project_id", undefined);
            }
        },
        [form],
    );

    const handleDeveloperChange = useCallback(
        (value: number | undefined) => {
            setSelectedDeveloperId(value ?? null);
            setSelectedProjectId(null);
            form.setFieldValue("developer_project_id", undefined);
        },
        [form],
    );

    // Populate form when data changes
    useEffect(() => {
        // Only update form on initial mount or when switching to a different property
        const shouldUpdate =
            isInitialMountRef.current || data?.id !== previousDataIdRef.current;

        if (data && shouldUpdate) {
            isInitialMountRef.current = false;
            previousDataIdRef.current = data.id;

            // Normalize price: number, string (numeric/JSON), or object → always { amount, currency } for the form
            const defaultCode = props.default_currency_code || "TRY";
            const priceValue = parsePropertyPrice(data.price, defaultCode);

            // Transform the data to handle null values properly
            const formData: any = {
                ...data,
                price: priceValue,
                developer_project_id: data.developer_project_id ?? undefined,
                exterior_features: data.exterior_features || [],
                interior_features: data.interior_features || [],
                location_features: data.location_features || [],
                photos: data.photos || [],
                add_ons: data.add_ons || [],
                assets: data.assets || [],
            };

            // Use a microtask to defer the update and break the synchronous update cycle
            // Cast: form stores price as { amount, currency } for CurrencyInput; Property type has price as number
            Promise.resolve().then(() => {
                form.setFieldsValue(formData as any);
            });
        } else if (!data) {
            // Reset when data is cleared
            previousDataIdRef.current = undefined;
            isInitialMountRef.current = true;
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [data?.id, props.default_currency_code]);
    const handleSubmit = (values: any) => {
        // Transform the values to match the API expectations
        // Handle price: CurrencyInput returns {amount, currency} object, convert to JSON string for storage
        let priceValue = values.price;
        if (
            priceValue &&
            typeof priceValue === "object" &&
            priceValue.amount !== undefined
        ) {
            // New format: store as JSON string
            priceValue = JSON.stringify(priceValue);
        }

        const { _selected_developer_id, ...cleanValues } = values;

        const formData = {
            ...cleanValues,
            price: priceValue,
            within_site: cleanValues.within_site || false,
            // Handle array fields
            exterior_features: cleanValues.exterior_features || [],
            interior_features: cleanValues.interior_features || [],
            location_features: cleanValues.location_features || [],
            photos: cleanValues.photos || [],
            add_ons: cleanValues.add_ons || [],
        };

        onSubmit(formData);
    };
    return (
        <Form
            form={form}
            layout="vertical"
            onFinish={handleSubmit}
            onFinishFailed={(errorInfo) => {
                console.log("Form validation failed:", errorInfo);
                setErrors?.(
                    errorInfo.errorFields.map((field) => field.errors).flat(),
                );
                // Extract validation errors and add to errors list
                if (onErrorsClear) {
                    onErrorsClear();
                }
            }}
            size="middle"
        >
            <Card title="Basic Property Information" size="small">
                <Row gutter={[16, 16]}>
                    <Col span={24}>
                        <Form.Item
                            name="title"
                            label="Property Title"
                            rules={[
                                {
                                    required: true,
                                    message: "Please enter property title",
                                },
                            ]}
                        >
                            <Input placeholder="Enter property title" />
                        </Form.Item>
                    </Col>

                    <Col span={12}>
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
                                {SALE_TYPES.map((type) => (
                                    <Option key={type} value={type}>
                                        {type}
                                    </Option>
                                ))}
                            </Select>
                        </Form.Item>
                    </Col>

                    <Col span={12}>
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
                            >
                                {Object.entries(PROPERTY_CATEGORIES).map(
                                    ([key, category]) => (
                                        <Select.OptGroup
                                            key={key}
                                            label={category.label}
                                        >
                                            {category.types.map((type) => (
                                                <Option key={type} value={type}>
                                                    {type}
                                                </Option>
                                            ))}
                                        </Select.OptGroup>
                                    ),
                                )}
                            </Select>
                        </Form.Item>
                    </Col>

                    <Col span={24}>
                        <Form.Item
                            name="description"
                            label="Description"
                            rules={[
                                {
                                    required: true,
                                    message:
                                        "Please enter property description",
                                },
                            ]}
                        >
                            <TextArea
                                rows={4}
                                placeholder="Describe the property..."
                            />
                        </Form.Item>
                    </Col>

                    <Col span={12}>
                        <Form.Item
                            name="price"
                            label="Price"
                            rules={[
                                {
                                    required: true,
                                    message: "Please enter price",
                                },
                            ]}
                        >
                            <CurrencyInput
                                placeholder="Enter price"
                                showLabel={false}
                                // min={0}
                                // TODO: Use property product currency if available, and fallback to default company currency, when not sent from ui
                                // prefix={defaultCurrencySymbol}
                                // parser={(value:any) => {
                                //     const num = parseFloat(
                                //         value?.replace(/\$\s?|(,*)/g, "") ||
                                //             "0",
                                //     );
                                //     return num as any;
                                // }}
                            />
                        </Form.Item>
                    </Col>

                    <Col span={12}>
                        <Form.Item
                            name="status"
                            label="Status"
                            initialValue="Available"
                        >
                            <Select placeholder="Select status">
                                {STATUS_OPTIONS.map((status) => (
                                    <Option key={status} value={status}>
                                        {status}
                                    </Option>
                                ))}
                            </Select>
                        </Form.Item>
                    </Col>

                    {/* Residence / Project flow */}
                    <Col span={24}>
                        <Divider
                            plain
                            className="!my-2 !text-xs !text-gray-400"
                        >
                            Residence / Project
                        </Divider>
                    </Col>

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

                    {withinSite === true && (
                        <>
                            <Col xs={24} md={12}>
                                <Form.Item
                                    name="_selected_developer_id"
                                    label="Construction Company"
                                    tooltip="Select the construction company / developer"
                                >
                                    <Select
                                        placeholder="Select construction company"
                                        allowClear
                                        showSearch
                                        optionFilterProp="children"
                                        onChange={handleDeveloperChange}
                                    >
                                        {developers.map((dev) => (
                                            <Option key={dev.id} value={dev.id}>
                                                {dev.name}
                                            </Option>
                                        ))}
                                    </Select>
                                </Form.Item>
                            </Col>

                            <Col xs={24} md={12}>
                                <Form.Item
                                    name="developer_project_id"
                                    label="Project Name"
                                    tooltip="Selecting a project will derive location from the project's location settings"
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
                                        value={selectedProjectId ?? undefined}
                                        onChange={(v: number | undefined) =>
                                            setSelectedProjectId(v ?? null)
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
                                                        ({project.location.name}
                                                        )
                                                    </span>
                                                )}
                                            </Option>
                                        ))}
                                    </Select>
                                </Form.Item>
                            </Col>
                        </>
                    )}

                    {/* Warning when project has no location */}
                    {selectedProjectId && !projectHasLocation && (
                        <Col span={24}>
                            <Alert
                                message="Project has no location configured"
                                description="The selected project does not have a location set. Please enter the city and area manually, or configure the project's location in the Developer Projects section."
                                type="warning"
                                showIcon
                                icon={<WarningOutlined />}
                                className="mb-4"
                            />
                        </Col>
                    )}

                    <Col span={12}>
                        <Form.Item
                            name="city"
                            label="City"
                            tooltip={
                                projectHasLocation
                                    ? "Derived from project location"
                                    : undefined
                            }
                            rules={[
                                {
                                    required: !projectHasLocation,
                                    message: "Please enter city",
                                },
                            ]}
                        >
                            <Input
                                placeholder={
                                    projectHasLocation
                                        ? "From project location"
                                        : "Enter city"
                                }
                                disabled={projectHasLocation}
                                className={
                                    projectHasLocation ? "bg-gray-50" : ""
                                }
                            />
                        </Form.Item>
                    </Col>

                    <Col span={12}>
                        <Form.Item
                            name="area"
                            label="Area/Country"
                            tooltip={
                                projectHasLocation
                                    ? "Derived from project location"
                                    : undefined
                            }
                            rules={[
                                {
                                    required: !projectHasLocation,
                                    message: "Please enter area",
                                },
                            ]}
                        >
                            <Input
                                placeholder={
                                    projectHasLocation
                                        ? "From project location"
                                        : "Enter area or country"
                                }
                                disabled={projectHasLocation}
                                className={
                                    projectHasLocation ? "bg-gray-50" : ""
                                }
                            />
                        </Form.Item>
                    </Col>

                    {/* Block and Unit fields for property identification within a project/location */}
                    <Col span={12}>
                        <Form.Item
                            name="block_name"
                            label="Block / Building"
                            tooltip="Block, building, or tower name/number (e.g., Block B, Tower 1, Phase 2)"
                        >
                            <Input placeholder="e.g., Block B, Tower 1" />
                        </Form.Item>
                    </Col>

                    <Col span={12}>
                        <Form.Item
                            name="unit_number"
                            label="Unit / Apartment Number"
                            tooltip="Unit, apartment, or house number within the block"
                        >
                            <Input placeholder="e.g., 101, A-5, Unit 12" />
                        </Form.Item>
                    </Col>
                </Row>
                <Divider />

                <Row justify="end" gutter={8}>
                    <Col>
                        <Button onClick={onCancel}>{cancelText}</Button>
                    </Col>
                    <Col>
                        <Button
                            type="primary"
                            htmlType="submit"
                            loading={loading}
                            icon={<SaveOutlined />}
                        >
                            {submitText}
                        </Button>
                    </Col>
                </Row>
            </Card>
        </Form>
    );
}
