import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { router } from "@inertiajs/react";
import DashboardLayout from "../../Components/DashboardLayout";
import PageLayout from "../../Components/PageLayout";
import useTranslation from "@/Hooks/useTranslation";
import {
    Button,
    App,
    Drawer,
    Form,
    Input,
    Select,
    Dropdown,
    Popconfirm,
    Card,
    Space,
    InputNumber,
    Upload,
    Tag,
    Tooltip,
    Empty,
    Divider,
    Progress,
    Typography,
    Image,
    Badge,
    Tabs,
    Alert,
} from "antd";
import { DataTable } from "@/Components/DataTable";
import type { LaravelPaginationMeta } from "@/Components/DataTable";
import type {
    MenuProps,
    TableColumnsType,
    UploadFile,
    UploadProps,
} from "antd";
import type { PageProps } from "../../Components/DashboardLayout";
import {
    PlusOutlined,
    EditOutlined,
    DeleteOutlined,
    MoreOutlined,
    EnvironmentOutlined,
    UploadOutlined,
    CloseOutlined,
    CarOutlined,
    RocketOutlined,
    CameraOutlined,
    InfoCircleOutlined,
    CheckCircleOutlined,
    PictureOutlined,
    ThunderboltOutlined,
} from "@ant-design/icons";
import type {
    ProjectLocation,
    CreateProjectLocationInput,
} from "../../Types/developerProject";
import { useApiMutate } from "@/lib/api/client/useApiMutate";
import { ApiSuccessResponse } from "@/lib/api/types";
import {
    useLocationFormUpload,
    LocationFormValues,
} from "@/Hooks/useLocationFormUpload";
import { useGenerateDescription } from "@/lib/ai";
import { useApiQuery } from "@/lib/api/client/useApiQuery";
import type { PropertyEnumValues } from "@/Types";

const { Text, Title } = Typography;

const FIXED_AIRPORT_NAMES = [
    "ERCAN INTERNATIONAL",
    "PAPHOS INTERNATIONAL",
    "LARNACA INTERNATIONAL",
];

// ============================================
// Types
// ============================================

interface PaginationData {
    data: ProjectLocation[];
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
}

export interface IndexProps extends PageProps {
    pageTitle: string;
    locations: PaginationData;
    filters: {
        search?: string;
    };
}

// ============================================
// Image Upload Component
// ============================================

interface ImageUploaderProps {
    value?: UploadFile[];
    onChange?: (fileList: UploadFile[]) => void;
    existingUrl?: string;
    placeholder?: string;
    maxCount?: number;
}

const ImageUploader: React.FC<ImageUploaderProps> = ({
    value = [],
    onChange,
    existingUrl,
    placeholder = "Upload Image",
    maxCount = 1,
}) => {
    const handleChange: UploadProps["onChange"] = ({ fileList }) => {
        onChange?.(fileList);
    };

    const uploadButton = (
        <div className="flex flex-col items-center justify-center p-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-blue-400 transition-colors cursor-pointer bg-gray-50 hover:bg-blue-50">
            <UploadOutlined className="text-2xl text-gray-400 mb-2" />
            <span className="text-sm text-gray-500">{placeholder}</span>
        </div>
    );

    // Show existing image if no new file selected
    if (existingUrl && value.length === 0) {
        return (
            <div className="relative group">
                <Image
                    src={existingUrl}
                    alt="Current image"
                    className="rounded-lg object-cover"
                    width={120}
                    height={80}
                    fallback="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAMIAAADDCAYAAADQvc6UAAABRWlDQ1BJQ0MgUHJvZmlsZQAAKJFjYGASSSwoyGFhYGDIzSspCnJ3UoiIjFJgf8LAwSDCIMogwMCcmFxc4BgQ4ANUwgCjUcG3awyMIPqyLsis7PPOq3QdDFcvjV3jOD1boQVTPQrgSkktTgbSf4A4LbmgqISBgTEFyFYuLykAsTuAbJEioKOA7DkgdjqEvQHEToKwj4DVhAQ5A9k3gGyB5IxEoBmML4BsnSQk8XQkNtReEOBxcfXxUQg1Mjc0dyHgXNJBSWpFCYh2zi+oLMpMzyhRcASGUqqCZ16yno6CkYGRAQMDKMwhqj/fAIcloxgHQqxAjIHBEugw5sUIsSQpBobtQPdLciLEVJYzMPBHMDBsayhILEqEO4DxG0txmrERhM29nYGBddr//5/DGRjYNRkY/l7////39v///y4Dmn+LgeHANwDrkl1AuO+pmgAAADhlWElmTU0AKgAAAAgAAYdpAAQAAAABAAAAGgAAAAAAAqACAAQAAAABAAAAwqADAAQAAAABAAAAwwAAAAD9b/HnAAAHlklEQVR4Ae3dP3PTWBSGcbGzM6GCKqlIBRV0dHRJFarQ0eUT8LH4BnRU0NHR0UEFVdIlFRV7TzRksomPY8uykTk/zewQfKw/9teleIf0wNIWVAuZEACh..."
                />
                <Upload
                    accept="image/*"
                    showUploadList={false}
                    beforeUpload={() => false}
                    onChange={handleChange}
                    maxCount={maxCount}
                    className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                    <div className="absolute inset-0 bg-black bg-opacity-50 rounded-lg flex items-center justify-center">
                        <CameraOutlined className="text-white text-xl" />
                    </div>
                </Upload>
            </div>
        );
    }

    return (
        <Upload
            accept="image/*"
            listType="picture-card"
            fileList={value}
            onChange={handleChange}
            beforeUpload={() => false}
            maxCount={maxCount}
            className="location-uploader"
        >
            {value.length < maxCount && uploadButton}
        </Upload>
    );
};

// ============================================
// Form Drawer Component
// ============================================

interface LocationFormDrawerProps {
    open: boolean;
    onClose: () => void;
    location?: ProjectLocation | null;
    onSuccess: () => void;
}

const LocationFormDrawer: React.FC<LocationFormDrawerProps> = ({
    open,
    onClose,
    location,
    onSuccess,
}) => {
    const [form] = Form.useForm<LocationFormValues>();
    const { modal } = App.useApp();
    const [activeTab, setActiveTab] = useState("basic");
    const isEditing = !!location;
    const selectedCity = Form.useWatch("address_city", form);
    const isInitialCity = useRef(true);

    const buildFixedAirports = useCallback(
        (existingAirports?: ProjectLocation["airports"]) => {
            const source = existingAirports || [];

            return FIXED_AIRPORT_NAMES.map((airportName, index) => {
                const byName = source.find(
                    (airport) =>
                        airport?.name?.trim().toUpperCase() ===
                        airportName.toUpperCase(),
                );
                const fallback = source[index];
                const current = byName || fallback;

                return {
                    name: airportName,
                    travelTimeInMin: current?.travelTimeInMin ?? 0,
                };
            });
        },
        [],
    );

    const fixedAirportExistingUrls = useMemo(
        () =>
            FIXED_AIRPORT_NAMES.map((airportName, index) => {
                const source = location?.airports || [];
                const byName = source.find(
                    (airport) =>
                        airport?.name?.trim().toUpperCase() ===
                        airportName.toUpperCase(),
                );
                const fallback = source[index];
                return (byName || fallback)?.image;
            }),
        [location?.airports],
    );

    const { data: enumValues } = useApiQuery<PropertyEnumValues>({
        path: route("properties.enum_values"),
        options: { enabled: open },
    });

    const cityOptions = useMemo(() => {
        const cities = enumValues?.cities || [];
        return cities.map((c) => ({
            value: c.name,
            label: c.label,
        }));
    }, [enumValues?.cities]);

    const areaOptions = useMemo(() => {
        if (!selectedCity || !enumValues?.areas_by_city) {
            return [];
        }

        const areas = enumValues.areas_by_city[selectedCity] || [];
        return areas.map((a) => ({
            value: a.name,
            label: a.label,
        }));
    }, [selectedCity, enumValues?.areas_by_city]);

    const locationDescriptionValidator = useCallback(
        (formData: Record<string, any>) => {
            const missing: string[] = [];
            const name = String(formData.name ?? "").trim();
            const hasContext =
                String(formData.description ?? "").trim() !== "" ||
                String(formData.address_street ?? "").trim() !== "" ||
                String(formData.address_city ?? "").trim() !== "" ||
                String(formData.address_state ?? "").trim() !== "" ||
                String(formData.address_country ?? "").trim() !== "" ||
                (formData.attractions?.length || 0) > 0 ||
                (formData.infrastructure?.length || 0) > 0 ||
                (formData.airports?.length || 0) > 0;

            if (!name) {
                missing.push("Location Name");
            }

            if (!hasContext) {
                missing.push("Description or address details");
            }

            return { sufficient: missing.length === 0, missing };
        },
        [],
    );

    const {
        isEnabled: aiEnabled,
        isGenerating: isGeneratingDescription,
        error: descriptionError,
        insufficientMessage,
        generate: generateDescription,
    } = useGenerateDescription({
        endpoint: route("properties.ai-description"),
        featureContext: "location_description",
        validateFormData: locationDescriptionValidator,
    });

    // File upload hook
    const { isUploading, uploadProgress, processAndSubmit } =
        useLocationFormUpload();

    // API mutations
    const createMutation = useApiMutate<
        CreateProjectLocationInput,
        ProjectLocation,
        ApiSuccessResponse<ProjectLocation>
    >(route("project-locations.store"), "POST", () => {
        form.resetFields();
        onClose();
        onSuccess();
    });

    const updateMutation = useApiMutate<
        CreateProjectLocationInput,
        ProjectLocation,
        ApiSuccessResponse<ProjectLocation>
    >(
        location ? route("project-locations.update", location.id) : "",
        "PUT",
        () => {
            form.resetFields();
            onClose();
            onSuccess();
        },
    );

    const isLoading =
        isUploading || createMutation.isPending || updateMutation.isPending;

    const handleSubmit = async () => {
        try {
            const values = await form.validateFields();

            // Process files and transform to API payload
            const payload = await processAndSubmit(values, location);

            // Submit via API
            if (isEditing && location) {
                updateMutation.mutate(payload);
            } else {
                createMutation.mutate(payload);
            }
        } catch (error) {
            console.error("Validation failed:", error);
        }
    };

    const handleGenerateDescription = useCallback(async () => {
        const values = form.getFieldsValue(true);
        const existingDescription = values.description;

        const doGenerate = async () => {
            const description = await generateDescription(values);
            if (description) {
                form.setFieldValue("description", description);
            }
        };

        if (existingDescription?.trim()) {
            modal.confirm({
                title: "Replace existing description?",
                content:
                    "This will replace the current location description with an AI-generated version.",
                okText: "Replace",
                cancelText: "Cancel",
                onOk: doGenerate,
            });
        } else {
            await doGenerate();
        }
    }, [form, generateDescription, modal]);

    // Reset form when drawer opens/closes or location changes
    useEffect(() => {
        if (open && location) {
            form.setFieldsValue({
                name: location.name,
                description: location.description || undefined,
                address_street: location.address?.street,
                address_city: location.address?.city,
                address_state: location.address?.state,
                address_country: location.address?.country,
                address_postalCode: location.address?.postalCode,
                attractions:
                    location.attractions?.map((a) => ({
                        name: a.name,
                        content: a.content || [],
                    })) || [],
                infrastructure:
                    location.infrastructure?.map((i) => ({
                        name: i.name,
                        travelTimeInMin: i.travelTimeInMin,
                    })) || [],
                airports: buildFixedAirports(location.airports),
            });
        } else if (open) {
            form.resetFields();
            form.setFieldValue("airports", buildFixedAirports());
        }
        setActiveTab("basic");
    }, [open, location, form, buildFixedAirports]);

    useEffect(() => {
        if (open) {
            isInitialCity.current = true;
        }
    }, [open]);

    useEffect(() => {
        if (!open) {
            return;
        }

        if (isInitialCity.current) {
            isInitialCity.current = false;
            return;
        }

        form.setFieldValue("address_state", undefined);
    }, [selectedCity, form, open]);

    const tabItems = [
        {
            key: "basic",
            label: (
                <span className="flex items-center gap-2">
                    <InfoCircleOutlined />
                    Basic Info
                </span>
            ),
            children: (
                <div className="flex flex-col gap-y-4">
                    <Form.Item
                        name="name"
                        label="Location Name"
                        rules={[
                            {
                                required: true,
                                message: "Please enter a location name",
                            },
                        ]}
                    >
                        <Input placeholder="e.g., Kyrenia Waterfront" />
                    </Form.Item>

                    <div className="flex items-center justify-between gap-3">
                        <label className="ant-form-item-label">
                            <span>Description</span>
                        </label>
                        {aiEnabled && (
                            <Button
                                size="small"
                                icon={<ThunderboltOutlined />}
                                onClick={handleGenerateDescription}
                                loading={isGeneratingDescription}
                            >
                                {isGeneratingDescription
                                    ? "Generating..."
                                    : "Generate with AI"}
                            </Button>
                        )}
                    </div>
                    <Form.Item name="description" noStyle>
                        <Input.TextArea
                            placeholder="Describe this location and its key features..."
                            rows={3}
                            showCount
                            maxLength={500}
                            disabled={isGeneratingDescription}
                        />
                    </Form.Item>
                    {insufficientMessage && (
                        <Alert
                            message={insufficientMessage}
                            type="info"
                            showIcon
                            closable
                        />
                    )}
                    {descriptionError && (
                        <Alert
                            message={descriptionError}
                            type="error"
                            showIcon
                            closable
                        />
                    )}

                    <Divider orientation="left" plain>
                        <Text type="secondary">
                            <EnvironmentOutlined className="mr-2" />
                            Address Details
                        </Text>
                    </Divider>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* <Form.Item
                            name="address_street"
                            label="Street Address"
                            className="md:col-span-2"
                        >
                            <Input placeholder="123 Main Street" />
                        </Form.Item> */}

                        <Form.Item
                            name="address_city"
                            label="City"
                            rules={[
                                {
                                    required: true,
                                    message: "Please select a city",
                                },
                            ]}
                        >
                            <Select
                                options={cityOptions}
                                placeholder="Select city"
                                showSearch
                                optionFilterProp="label"
                            />
                        </Form.Item>

                        <Form.Item
                            name="address_state"
                            label="Area / District"
                            rules={[
                                {
                                    required: true,
                                    message: "Please select an area",
                                },
                            ]}
                        >
                            <Select
                                options={areaOptions}
                                placeholder={
                                    selectedCity
                                        ? "Select area"
                                        : "Select city first"
                                }
                                showSearch
                                optionFilterProp="label"
                                disabled={!selectedCity}
                            />
                        </Form.Item>

                        <Form.Item name="address_country" label="Country">
                            <Input placeholder="Country" />
                        </Form.Item>

                        <Form.Item
                            name="address_postalCode"
                            label="Postal Code"
                        >
                            <Input placeholder="Postal Code" />
                        </Form.Item>
                    </div>

                    <Divider orientation="left" plain>
                        <Text type="secondary">
                            <PictureOutlined className="mr-2" />
                            Map Image
                        </Text>
                    </Divider>

                    {/* <Form.Item
                        name="map_image"
                        label="Location Map"
                        valuePropName="value"
                        getValueFromEvent={(e) =>
                            Array.isArray(e) ? e : e?.fileList
                        }
                        extra="Upload an image showing the location on a map"
                    >
                        <ImageUploader
                            existingUrl={location?.map_url || undefined}
                            placeholder="Upload Map Image"
                        />
                    </Form.Item> */}
                </div>
            ),
        },
        {
            key: "attractions",
            label: (
                <span className="flex items-center gap-2">
                    <CameraOutlined />
                    Attractions
                </span>
            ),
            children: (
                <div>
                    <Alert
                        message="Nearby Attractions"
                        description="Add points of interest near this location. Include images and descriptions for the expose PDF."
                        type="info"
                        showIcon
                        className="mb-4"
                    />

                    <Form.List name="attractions">
                        {(fields, { add, remove }) => (
                            <div className="flex flex-col gap-y-4">
                                {fields.length === 0 ? (
                                    <Empty
                                        image={Empty.PRESENTED_IMAGE_SIMPLE}
                                        description="No attractions added yet"
                                    >
                                        <Button
                                            type="primary"
                                            icon={<PlusOutlined />}
                                            onClick={() =>
                                                add({
                                                    name: "",
                                                    content: [],
                                                })
                                            }
                                        >
                                            Add First Attraction
                                        </Button>
                                    </Empty>
                                ) : (
                                    <>
                                        {fields.map(
                                            ({ key, name, ...restField }) => (
                                                <Card
                                                    key={key}
                                                    size="small"
                                                    className="border-l-4 border-l-blue-500"
                                                    title={
                                                        <span className="text-sm">
                                                            Attraction{" "}
                                                            {name + 1}
                                                        </span>
                                                    }
                                                    extra={
                                                        <Button
                                                            type="text"
                                                            danger
                                                            icon={
                                                                <CloseOutlined />
                                                            }
                                                            onClick={() =>
                                                                remove(name)
                                                            }
                                                        />
                                                    }
                                                >
                                                    <Form.Item
                                                        {...restField}
                                                        name={[name, "name"]}
                                                        label="Attraction Name"
                                                        rules={[
                                                            {
                                                                required: true,
                                                                message:
                                                                    "Required",
                                                            },
                                                        ]}
                                                    >
                                                        <Input placeholder="e.g., Historic Castle" />
                                                    </Form.Item>

                                                    <Form.Item
                                                        {...restField}
                                                        name={[name, "content"]}
                                                        label="Description"
                                                        extra="Add paragraphs describing this attraction"
                                                    >
                                                        <Input.TextArea
                                                            placeholder="Describe the attraction..."
                                                            rows={2}
                                                        />
                                                    </Form.Item>

                                                    <div className="grid grid-cols-2 gap-4">
                                                        <Form.Item
                                                            {...restField}
                                                            name={[
                                                                name,
                                                                "primary_image",
                                                            ]}
                                                            label="Primary Image"
                                                            valuePropName="value"
                                                            getValueFromEvent={(
                                                                e,
                                                            ) =>
                                                                Array.isArray(e)
                                                                    ? e
                                                                    : e?.fileList
                                                            }
                                                        >
                                                            <ImageUploader
                                                                existingUrl={
                                                                    location
                                                                        ?.attractions?.[
                                                                        name
                                                                    ]?.images
                                                                        ?.primary
                                                                }
                                                                placeholder="Primary"
                                                            />
                                                        </Form.Item>

                                                        <Form.Item
                                                            {...restField}
                                                            name={[
                                                                name,
                                                                "secondary_image",
                                                            ]}
                                                            label="Secondary Image"
                                                            valuePropName="value"
                                                            getValueFromEvent={(
                                                                e,
                                                            ) =>
                                                                Array.isArray(e)
                                                                    ? e
                                                                    : e?.fileList
                                                            }
                                                        >
                                                            <ImageUploader
                                                                existingUrl={
                                                                    location
                                                                        ?.attractions?.[
                                                                        name
                                                                    ]?.images
                                                                        ?.secondary
                                                                }
                                                                placeholder="Secondary"
                                                            />
                                                        </Form.Item>
                                                    </div>
                                                </Card>
                                            ),
                                        )}

                                        <Button
                                            type="dashed"
                                            onClick={() =>
                                                add({ name: "", content: [] })
                                            }
                                            block
                                            icon={<PlusOutlined />}
                                        >
                                            Add Another Attraction
                                        </Button>
                                    </>
                                )}
                            </div>
                        )}
                    </Form.List>
                </div>
            ),
        },
        {
            key: "infrastructure",
            label: (
                <span className="flex items-center gap-2">
                    <CarOutlined />
                    Infrastructure
                </span>
            ),
            children: (
                <div>
                    <div className="mb-4">
                        <Alert
                            message="Nearby Infrastructure"
                            description="Add hospitals, shopping centers, schools, and other key infrastructure with travel times."
                            type="info"
                            showIcon
                        />
                    </div>

                    <Form.List name="infrastructure">
                        {(fields, { add, remove }) => (
                            <div className="flex flex-col gap-y-4">
                                {fields.length === 0 ? (
                                    <Empty
                                        image={Empty.PRESENTED_IMAGE_SIMPLE}
                                        description="No infrastructure added yet"
                                    >
                                        <Button
                                            type="primary"
                                            icon={<PlusOutlined />}
                                            onClick={() =>
                                                add({
                                                    name: "",
                                                    travelTimeInMin: 0,
                                                })
                                            }
                                        >
                                            Add First Item
                                        </Button>
                                    </Empty>
                                ) : (
                                    <>
                                        {fields.map(
                                            ({ key, name, ...restField }) => (
                                                <Card
                                                    key={key}
                                                    size="small"
                                                    className="border-l-4 border-l-green-500"
                                                    title={
                                                        <span className="text-sm">
                                                            Infrastructure{" "}
                                                            {name + 1}
                                                        </span>
                                                    }
                                                    extra={
                                                        <Button
                                                            type="text"
                                                            danger
                                                            icon={
                                                                <CloseOutlined />
                                                            }
                                                            onClick={() =>
                                                                remove(name)
                                                            }
                                                        />
                                                    }
                                                >
                                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                                        <Form.Item
                                                            {...restField}
                                                            name={[
                                                                name,
                                                                "name",
                                                            ]}
                                                            label="Name"
                                                            rules={[
                                                                {
                                                                    required: true,
                                                                    message:
                                                                        "Required",
                                                                },
                                                            ]}
                                                            className="md:col-span-2"
                                                        >
                                                            <Input placeholder="e.g., City Hospital" />
                                                        </Form.Item>

                                                        <Form.Item
                                                            {...restField}
                                                            name={[
                                                                name,
                                                                "travelTimeInMin",
                                                            ]}
                                                            label="Travel Time"
                                                        >
                                                            <InputNumber
                                                                min={0}
                                                                max={999}
                                                                addonAfter="min"
                                                                placeholder="0"
                                                                className="w-full"
                                                            />
                                                        </Form.Item>
                                                    </div>

                                                    <Form.Item
                                                        {...restField}
                                                        name={[name, "image"]}
                                                        label="Image"
                                                        valuePropName="value"
                                                        getValueFromEvent={(
                                                            e,
                                                        ) =>
                                                            Array.isArray(e)
                                                                ? e
                                                                : e?.fileList
                                                        }
                                                    >
                                                        <ImageUploader
                                                            existingUrl={
                                                                location
                                                                    ?.infrastructure?.[
                                                                    name
                                                                ]?.image
                                                            }
                                                            placeholder="Upload Image"
                                                        />
                                                    </Form.Item>
                                                </Card>
                                            ),
                                        )}

                                        <Button
                                            type="dashed"
                                            onClick={() =>
                                                add({
                                                    name: "",
                                                    travelTimeInMin: 0,
                                                })
                                            }
                                            block
                                            icon={<PlusOutlined />}
                                        >
                                            Add Another Item
                                        </Button>
                                    </>
                                )}
                            </div>
                        )}
                    </Form.List>
                </div>
            ),
        },
        {
            key: "airports",
            label: (
                <span className="flex items-center gap-2">
                    <RocketOutlined />
                    Airports
                </span>
            ),
            children: (
                <div>
                    <Alert
                        message="Nearby Airports"
                        description="Travel times for the three supported airports."
                        type="info"
                        showIcon
                        className="mb-4"
                    />

                    <div className="flex flex-col gap-y-4">
                        {FIXED_AIRPORT_NAMES.map((airportName, index) => (
                            <Card
                                key={airportName}
                                size="small"
                                className="border-l-4 border-l-orange-500"
                                title={
                                    <span className="text-sm">
                                        Airport {index + 1}
                                    </span>
                                }
                            >
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <Form.Item
                                        name={["airports", index, "name"]}
                                        label="Airport Name"
                                        className="md:col-span-2"
                                        initialValue={airportName}
                                    >
                                        <Input disabled />
                                    </Form.Item>

                                    <Form.Item
                                        name={[
                                            "airports",
                                            index,
                                            "travelTimeInMin",
                                        ]}
                                        label="Travel Time"
                                    >
                                        <InputNumber
                                            min={0}
                                            max={999}
                                            addonAfter="min"
                                            placeholder="0"
                                            className="w-full"
                                        />
                                    </Form.Item>
                                </div>

                                <Form.Item
                                    name={["airports", index, "image"]}
                                    label="Image"
                                    valuePropName="value"
                                    getValueFromEvent={(e) =>
                                        Array.isArray(e) ? e : e?.fileList
                                    }
                                >
                                    <ImageUploader
                                        existingUrl={
                                            fixedAirportExistingUrls[index]
                                        }
                                        placeholder="Upload Image"
                                    />
                                </Form.Item>
                            </Card>
                        ))}
                    </div>
                </div>
            ),
        },
    ];

    return (
        <Drawer
            title={
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                        <EnvironmentOutlined className="text-blue-600 text-lg" />
                    </div>
                    <div>
                        <div className="font-semibold">
                            {isEditing
                                ? "Edit Location"
                                : "Create New Location"}
                        </div>
                        <div className="text-sm text-gray-500 font-normal">
                            {isEditing
                                ? "Update location details and configuration"
                                : "Add a new project location with details"}
                        </div>
                    </div>
                </div>
            }
            open={open}
            onClose={() => !isLoading && onClose()}
            width={720}
            destroyOnClose
            footer={
                <div className="flex justify-between items-center">
                    {isUploading && (
                        <div className="flex-1 mr-4">
                            <Progress
                                percent={uploadProgress}
                                size="small"
                                status="active"
                            />
                        </div>
                    )}
                    <Space className={isUploading ? "" : "ml-auto"}>
                        <Button onClick={onClose} disabled={isLoading}>
                            Cancel
                        </Button>
                        <Button
                            type="primary"
                            loading={isLoading}
                            onClick={handleSubmit}
                            icon={
                                isLoading ? undefined : <CheckCircleOutlined />
                            }
                        >
                            {isEditing ? "Update Location" : "Create Location"}
                        </Button>
                    </Space>
                </div>
            }
        >
            <Form
                form={form}
                layout="vertical"
                requiredMark="optional"
                className="location-form"
            >
                <Tabs
                    activeKey={activeTab}
                    onChange={setActiveTab}
                    items={tabItems}
                    type="card"
                />
            </Form>
        </Drawer>
    );
};

// ============================================
// Main Component
// ============================================

const Index = ({ pageTitle, locations, filters }: IndexProps) => {
    const { t } = useTranslation();
    const [drawerOpen, setDrawerOpen] = useState(false);
    const [selectedLocation, setSelectedLocation] =
        useState<ProjectLocation | null>(null);
    const [locationToDelete, setLocationToDelete] =
        useState<ProjectLocation | null>(null);

    // Delete mutation - path updates when locationToDelete changes
    const deleteMutation = useApiMutate<
        Record<string, never>,
        null,
        ApiSuccessResponse<null>
    >(
        locationToDelete
            ? route("project-locations.destroy", locationToDelete.id)
            : "",
        "DELETE",
        () => {
            setLocationToDelete(null);
            router.reload({ only: ["locations"] });
        },
    );

    // Trigger delete when locationToDelete is set
    useEffect(() => {
        if (locationToDelete && !deleteMutation.isPending) {
            deleteMutation.mutate({});
        }
    }, [locationToDelete]);

    const handleAdd = useCallback(() => {
        setSelectedLocation(null);
        setDrawerOpen(true);
    }, []);

    const handleEdit = useCallback((location: ProjectLocation) => {
        setSelectedLocation(location);
        setDrawerOpen(true);
    }, []);

    const handleClose = useCallback(() => {
        setDrawerOpen(false);
        setSelectedLocation(null);
    }, []);

    const handleSuccess = useCallback(() => {
        router.reload({ only: ["locations"] });
    }, []);

    // Delete handler - sets the location to delete, mutation triggered by useEffect
    const handleDelete = useCallback((location: ProjectLocation) => {
        setLocationToDelete(location);
    }, []);

    // Table columns
    const columns: TableColumnsType<ProjectLocation> = useMemo(
        () => [
            {
                title: "Location",
                dataIndex: "name",
                key: "name",
                render: (name: string, record) => (
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center flex-shrink-0">
                            <EnvironmentOutlined className="text-white text-lg" />
                        </div>
                        <div>
                            <div className="font-medium text-gray-900 capitalize">
                                {name}
                            </div>
                            {record.description && (
                                <div className="text-sm text-gray-500 truncate max-w-xs capitalize">
                                    {record.description}
                                </div>
                            )}
                        </div>
                    </div>
                ),
            },
            {
                title: "Address",
                key: "address",
                render: (_, record) => {
                    const parts = [
                        record.address?.city,
                        record.address?.country,
                    ].filter(Boolean);
                    return parts.length > 0 ? (
                        <span className="text-gray-600">
                            {parts.join(", ")}
                        </span>
                    ) : (
                        <span className="text-gray-400 italic">Not set</span>
                    );
                },
            },
            {
                title: "Details",
                key: "details",
                render: (_, record) => (
                    <div className="flex items-center gap-2">
                        {(record.attractions?.length || 0) > 0 && (
                            <Tooltip title="Attractions">
                                <Tag
                                    icon={<CameraOutlined />}
                                    color="blue"
                                    className="m-0"
                                >
                                    {record.attractions?.length}
                                </Tag>
                            </Tooltip>
                        )}
                        {(record.infrastructure?.length || 0) > 0 && (
                            <Tooltip title="Infrastructure">
                                <Tag
                                    icon={<CarOutlined />}
                                    color="green"
                                    className="m-0"
                                >
                                    {record.infrastructure?.length}
                                </Tag>
                            </Tooltip>
                        )}
                        {(record.airports?.length || 0) > 0 && (
                            <Tooltip title="Airports">
                                <Tag
                                    icon={<RocketOutlined />}
                                    color="orange"
                                    className="m-0"
                                >
                                    {record.airports?.length}
                                </Tag>
                            </Tooltip>
                        )}
                        {!record.attractions?.length &&
                            !record.infrastructure?.length &&
                            !record.airports?.length && (
                                <span className="text-gray-400 italic text-sm">
                                    No details
                                </span>
                            )}
                    </div>
                ),
            },
            {
                title: "Map",
                key: "map",
                align: "center",
                width: 80,
                render: (_, record) =>
                    record.map_url ? (
                        <Tooltip title="Map image available">
                            <Badge status="success" />
                        </Tooltip>
                    ) : (
                        <Tooltip title="No map image">
                            <Badge status="default" />
                        </Tooltip>
                    ),
            },
            {
                title: "",
                key: "actions",
                align: "right",
                width: 60,
                render: (_, record) => {
                    const items: MenuProps["items"] = [
                        {
                            key: "edit",
                            icon: <EditOutlined />,
                            label: "Edit",
                            onClick: () => handleEdit(record),
                        },
                        { type: "divider" },
                        {
                            key: "delete",
                            icon: <DeleteOutlined />,
                            label: (
                                <Popconfirm
                                    title="Delete Location"
                                    description={
                                        <span>
                                            Are you sure you want to delete{" "}
                                            <strong>{record.name}</strong>? This
                                            cannot be undone.
                                        </span>
                                    }
                                    onConfirm={() => handleDelete(record)}
                                    okText="Delete"
                                    cancelText="Cancel"
                                    okButtonProps={{ danger: true }}
                                    placement="left"
                                >
                                    <span className="text-red-600 w-full inline-block">
                                        Delete
                                    </span>
                                </Popconfirm>
                            ),
                            danger: true,
                        },
                    ];

                    return (
                        <Dropdown
                            menu={{ items }}
                            trigger={["click"]}
                            placement="bottomRight"
                        >
                            <Button
                                type="text"
                                icon={<MoreOutlined />}
                                className="text-gray-400 hover:text-gray-600"
                            />
                        </Dropdown>
                    );
                },
            },
        ],
        [handleEdit, handleDelete],
    );

    return (
        <>
            <PageLayout
                title={pageTitle}
                breadcrumbs={[
                    {
                        name: t("app.menu.projects"),
                        url: route("developer-projects.index"),
                    },
                    { name: t("app.project_locations.locations") },
                ]}
            >
                <div className="max-w-7xl mx-auto flex flex-col gap-y-6">
                    {/* Header Card */}
                    <Card className="border-0 shadow-sm">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                            <div>
                                <Title level={4} className="!mb-1">
                                    Project Locations
                                </Title>
                                <Text type="secondary">
                                    Manage locations for your developer projects
                                    and expose configurations
                                </Text>
                            </div>
                            <Button
                                type="primary"
                                icon={<PlusOutlined />}
                                onClick={handleAdd}
                            >
                                New Location
                            </Button>
                        </div>
                    </Card>

                    {/* Table */}
                    <Card className="border-0 shadow-sm">
                        {locations.total === 0 ? (
                            <Empty
                                image={Empty.PRESENTED_IMAGE_SIMPLE}
                                description={
                                    <span className="text-gray-500">
                                        No locations created yet
                                    </span>
                                }
                            >
                                <Button
                                    type="primary"
                                    icon={<PlusOutlined />}
                                    onClick={handleAdd}
                                >
                                    Create Your First Location
                                </Button>
                            </Empty>
                        ) : (
                            <DataTable
                                columns={columns}
                                dataSource={locations.data}
                                rowKey="id"
                                paginationData={{
                                    current_page: locations.current_page,
                                    last_page: locations.last_page,
                                    per_page: locations.per_page,
                                    total: locations.total,
                                    from: null,
                                    to: null,
                                }}
                                onPageChange={(page) => {
                                    router.get(
                                        route("project-locations.index"),
                                        { ...filters, page },
                                        {
                                            preserveState: true,
                                            preserveScroll: true,
                                        },
                                    );
                                }}
                                size="middle"
                                scroll={{ x: 800, y: "calc(100vh - 320px)" }}
                            />
                        )}
                    </Card>
                </div>
            </PageLayout>

            {/* Create/Edit Drawer */}
            <LocationFormDrawer
                open={drawerOpen}
                onClose={handleClose}
                location={selectedLocation}
                onSuccess={handleSuccess}
            />

            {/* Custom styles */}
            <style>{`
                .location-uploader .ant-upload-list-item {
                    border-radius: 8px;
                }
                .location-uploader .ant-upload.ant-upload-select {
                    width: 120px !important;
                    height: 80px !important;
                }
                .location-form .ant-tabs-nav {
                    margin-bottom: 24px;
                }
            `}</style>
        </>
    );
};

Index.layout = (page: React.ReactNode) => (
    <DashboardLayout>{page}</DashboardLayout>
);

export default Index;
