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
    LocationAirport,
    LocationInfrastructure,
} from "../../Types/developerProject";
import { useApiMutate } from "@/lib/api/client/useApiMutate";
import { ApiSuccessResponse } from "@/lib/api/types";
import {
    useLocationFormUpload,
    LocationFormValues,
} from "@/Hooks/useLocationFormUpload";
import { useGenerateDescription } from "@/lib/ai";
import { useApiQuery } from "@/lib/api/client/useApiQuery";
import type { CityLookupValue, PropertyEnumValues } from "@/Types";
import HtmlEditor from "@/Components/HtmlEditor";
import { useTd } from "@/Hooks/useDynamicTranslation";

const { Text, Title } = Typography;

interface LocationAirportOption {
    id: number;
    name: string;
    code?: string | null;
    label?: string | null;
    image_url?: string | null;
}

interface LocationAirportsResponse {
    status: string;
    airports: LocationAirportOption[];
}

interface LocationInfrastructureOption {
    id: number;
    name: string;
    icon?: string | null;
    label?: string | null;
    image_url?: string | null;
}

interface LocationInfrastructuresResponse {
    status: string;
    infrastructures: LocationInfrastructureOption[];
}

const humanizeConfigName = (value: string) =>
    value
        .replace(/_/g, " ")
        .replace(/\b\w/g, (char) => char.toUpperCase());

const toNumericId = (value: unknown): number | undefined => {
    if (value === null || value === undefined || value === "") {
        return undefined;
    }

    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
};

const formatAirportLabel = (airport: LocationAirportOption) => {
    const base = airport.label || humanizeConfigName(airport.name);
    return airport.code ? `${base} (${airport.code})` : base;
};

const formatInfrastructureLabel = (item: LocationInfrastructureOption) =>
    item.label || humanizeConfigName(item.name);

const getLocationCity = (location: ProjectLocation) =>
    location.address?.city ?? location.city;

const getLocationArea = (location: ProjectLocation) =>
    location.address?.state ?? location.area;

const resolveLookupName = (
    stored: string | undefined,
    options: Array<{ name: string; label: string }>,
): string | undefined => {
    if (!stored) {
        return undefined;
    }

    if (options.some((option) => option.name === stored)) {
        return stored;
    }

    const byLabel = options.find((option) => option.label === stored);
    return byLabel?.name ?? stored;
};

const resolveAreaName = (
    stored: string | undefined,
    cityName: string | undefined,
    enumValues: PropertyEnumValues,
): string | undefined => {
    if (!stored) {
        return undefined;
    }

    const cityAreas =
        (cityName && enumValues.areas_by_city?.[cityName]) || [];
    const resolvedInCity = resolveLookupName(stored, cityAreas);
    if (resolvedInCity && cityAreas.some((area) => area.name === resolvedInCity)) {
        return resolvedInCity;
    }

    return resolveLookupName(stored, enumValues.areas || []);
};

const getMeaningfulText = (value?: string | null) => {
    if (!value) {
        return "";
    }

    return value
        .replace(/<[^>]*>/g, " ")
        .replace(/&nbsp;/gi, " ")
        .trim();
};

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
    td?: (key: string) => string;
}

const LocationFormDrawer: React.FC<LocationFormDrawerProps> = ({
    open,
    onClose,
    location,
    onSuccess,
    td = (key) => key,
}) => {
    const [form] = Form.useForm<LocationFormValues>();
    const { modal } = App.useApp();
    const [activeTab, setActiveTab] = useState("basic");
    const isEditing = !!location;
    const selectedCity = Form.useWatch("address_city", form);
    const selectedArea = Form.useWatch("address_state", form);
    const previousCityRef = useRef<string | undefined>();

    const { data: enumValues } = useApiQuery<PropertyEnumValues>({
        path: route("properties.enum_values"),
        options: { enabled: open },
    });

    const { data: airportData } = useApiQuery<LocationAirportsResponse>({
        path: route("project-locations.airports"),
        options: { enabled: open },
    });

    const { data: infrastructureData } =
        useApiQuery<LocationInfrastructuresResponse>({
            path: route("project-locations.infrastructures"),
            options: { enabled: open },
        });

    const cityOptions = useMemo(() => {
        const cities = enumValues?.cities || [];
        return cities.map((c) => ({
            value: c.name,
            label: c.label,
            description: c.description,
        }));
    }, [enumValues?.cities]);

    const airportOptions = useMemo(() => {
        const options = (airportData?.airports || []).map((airport) => ({
            value: airport.id,
            label: formatAirportLabel(airport),
        }));
        const knownIds = new Set(options.map((option) => option.value));

        location?.airports?.forEach((airport) => {
            const id = toNumericId(airport.airport_id);
            if (id !== undefined && !knownIds.has(id)) {
                options.push({
                    value: id,
                    label: airport.name || `Airport #${id}`,
                });
                knownIds.add(id);
            }
        });

        return options;
    }, [airportData?.airports, location?.airports]);

    const infrastructureOptions = useMemo(() => {
        const options = (infrastructureData?.infrastructures || []).map(
            (item) => ({
                value: item.id,
                label: formatInfrastructureLabel(item),
            }),
        );
        const knownIds = new Set(options.map((option) => option.value));

        location?.infrastructure?.forEach((item) => {
            const id = toNumericId(item.infrastructure_id);
            if (id !== undefined && !knownIds.has(id)) {
                options.push({
                    value: id,
                    label: item.name || `Infrastructure #${id}`,
                });
                knownIds.add(id);
            }
        });

        return options;
    }, [infrastructureData?.infrastructures, location?.infrastructure]);

    const airportById = useMemo(
        () =>
            Object.fromEntries(
                (airportData?.airports || []).map((airport) => [
                    airport.id,
                    airport,
                ]),
            ),
        [airportData?.airports],
    );

    const infrastructureById = useMemo(
        () =>
            Object.fromEntries(
                (infrastructureData?.infrastructures || []).map((item) => [
                    item.id,
                    item,
                ]),
            ),
        [infrastructureData?.infrastructures],
    );

    const areaOptions = useMemo(() => {
        if (!selectedCity || !enumValues?.areas_by_city) {
            return [];
        }

        const areas = enumValues.areas_by_city[selectedCity] || [];
        const options = areas.map((a) => ({
            value: a.name,
            label: a.label,
        }));
        const knownValues = new Set(options.map((option) => option.value));

        if (location && selectedCity) {
            const storedArea = getLocationArea(location);
            const resolvedArea = resolveAreaName(
                storedArea,
                selectedCity,
                enumValues,
            );

            if (
                resolvedArea &&
                !knownValues.has(resolvedArea) &&
                storedArea
            ) {
                const matchedArea = areas.find(
                    (area) => area.name === resolvedArea,
                );
                options.push({
                    value: resolvedArea,
                    label: matchedArea?.label || storedArea,
                });
            }
        }

        return options;
    }, [selectedCity, enumValues, location]);

    const selectedCityDescription = useMemo(() => {
        const selected = cityOptions.find(
            (city) => city.value === selectedCity,
        );
        if (typeof selected?.description !== "string") {
            return "";
        }
        return selected.description;
    }, [cityOptions, selectedCity]);

    const autoLocationName = useMemo(() => {
        const cityLabel =
            cityOptions.find((city) => city.value === selectedCity)?.label ||
            "";
        const areaLabel =
            areaOptions.find((area) => area.value === selectedArea)?.label ||
            "";

        return [areaLabel, cityLabel].filter(Boolean).join(", ");
    }, [areaOptions, cityOptions, selectedArea, selectedCity]);

    const locationDescriptionValidator = useCallback(
        (formData: Record<string, any>) => {
            const missing: string[] = [];
            const name = String(formData.name ?? "").trim();
            const descriptionText = getMeaningfulText(formData.description);
            const hasContext =
                descriptionText !== "" ||
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

    const resolveAirportId = useCallback(
        (airport: LocationAirport) => {
            const airports = airportData?.airports || [];
            const numericId = toNumericId(airport.airport_id);

            if (
                numericId !== undefined &&
                airports.some((item) => item.id === numericId)
            ) {
                return numericId;
            }

            if (airport.name) {
                const match = airports.find(
                    (item) =>
                        item.name === airport.name ||
                        formatAirportLabel(item) === airport.name,
                );
                if (match) {
                    return match.id;
                }
            }

            return numericId;
        },
        [airportData?.airports],
    );

    const resolveInfrastructureId = useCallback(
        (item: LocationInfrastructure) => {
            const infrastructures = infrastructureData?.infrastructures || [];
            const numericId = toNumericId(item.infrastructure_id);

            if (
                numericId !== undefined &&
                infrastructures.some((entry) => entry.id === numericId)
            ) {
                return numericId;
            }

            if (item.name) {
                const match = infrastructures.find(
                    (entry) =>
                        entry.name === item.name ||
                        formatInfrastructureLabel(entry) === item.name,
                );
                if (match) {
                    return match.id;
                }
            }

            return numericId;
        },
        [infrastructureData?.infrastructures],
    );

    // Reset form when drawer opens/closes or location changes
    useEffect(() => {
        if (!open) {
            return;
        }

        if (!location) {
            previousCityRef.current = undefined;
            form.resetFields();
            form.setFieldValue("airports", []);
            form.setFieldValue("infrastructure", []);
            setActiveTab("basic");
            return;
        }

        previousCityRef.current = undefined;

        form.setFieldsValue({
            name: location.name,
            description: location.description || undefined,
            address_street: location.address?.street,
            address_country: location.address?.country,
            address_postalCode: location.address?.postalCode,
            attractions:
                location.attractions?.map((a) => ({
                    name: a.name,
                    content: Array.isArray(a.content)
                        ? a.content.length === 1
                            ? a.content[0]
                            : a.content.join("")
                        : typeof a.content === "string"
                          ? a.content
                          : "",
                })) || [],
        });
        setActiveTab("basic");
    }, [open, location, form]);

    // Populate city/area after enum values load so Select options are available
    useEffect(() => {
        if (!open || !location || !enumValues?.cities) {
            return;
        }

        const cities = enumValues.cities as CityLookupValue[];
        const resolvedCity = resolveLookupName(getLocationCity(location), cities);
        const resolvedArea = resolveAreaName(
            getLocationArea(location),
            resolvedCity,
            enumValues,
        );

        form.setFieldsValue({
            address_city: resolvedCity,
            address_state: resolvedArea,
        });
    }, [open, location, form, enumValues]);

    // Populate airport/infrastructure selects after lookup options are loaded
    useEffect(() => {
        if (!open || !location) {
            return;
        }

        if (!airportData?.airports || !infrastructureData?.infrastructures) {
            return;
        }

        form.setFieldsValue({
            infrastructure:
                location.infrastructure?.map((item) => ({
                    infrastructure_id: resolveInfrastructureId(item),
                    travelTimeInMin: item.travelTimeInMin,
                })) || [],
            airports:
                location.airports?.map((airport) => ({
                    airport_id: resolveAirportId(airport),
                    travelTimeInMin: airport.travelTimeInMin,
                })) || [],
        });
    }, [
        open,
        location,
        form,
        airportData?.airports,
        infrastructureData?.infrastructures,
        resolveAirportId,
        resolveInfrastructureId,
    ]);

    useEffect(() => {
        if (!open) {
            previousCityRef.current = undefined;
            return;
        }

        if (selectedCity === undefined) {
            return;
        }

        if (previousCityRef.current === undefined) {
            previousCityRef.current = selectedCity;
            return;
        }

        if (previousCityRef.current !== selectedCity) {
            form.setFieldValue("address_state", undefined);
            previousCityRef.current = selectedCity;
        }
    }, [selectedCity, form, open]);

    useEffect(() => {
        if (!open) {
            return;
        }

        form.setFieldValue("name", autoLocationName || undefined);
    }, [autoLocationName, form, open]);

    useEffect(() => {
        if (!open || !selectedCityDescription) {
            return;
        }

        if (form.isFieldTouched("description")) {
            return;
        }

        const currentDescription = form.getFieldValue("description");
        if (getMeaningfulText(currentDescription)) {
            return;
        }

        form.setFieldValue("description", selectedCityDescription);
    }, [form, open, selectedCityDescription]);

    const tabItems = [
        {
            key: "basic",
            label: (
                <span className="flex items-center gap-2">
                    <InfoCircleOutlined />
                    {td("Basic Info")}
                </span>
            ),
            children: (
                <div className="flex flex-col gap-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Form.Item
                            name="address_city"
                            label={td("City")}
                            rules={[
                                {
                                    required: true,
                                    message: td("Please select a city"),
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
                            label={td("Area / District")}
                        >
                            <Select
                                options={areaOptions}
                                placeholder={
                                    selectedCity
                                        ? "Select area/district"
                                        : location?.area || "Select city first"
                                }
                                showSearch
                                optionFilterProp="label"
                                disabled={!selectedCity}
                            />
                        </Form.Item>
                    </div>

                    {/* <Form.Item
                        name="name"
                        label="Location Name"
                        rules={[
                            {
                                required: true,
                                message:
                                    "Location name is generated from area and city",
                            },
                        ]}
                    >
                        <Input
                            placeholder="Auto-generated from area and city"
                            disabled
                        />
                    </Form.Item> */}

                    <div className="flex items-center justify-between gap-3">
                        <label className="ant-form-item-label">
                            <span>{td("Description")}</span>
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
                        <HtmlEditor
                            placeholder="Describe this location and its key features..."
                            disabled={isGeneratingDescription}
                            height={220}
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
            forceRender: true,
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
                                                    content: "",
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
                                                        extra="Rich text shown on the expose PDF attraction page"
                                                    >
                                                        <HtmlEditor
                                                            key={key}
                                                            placeholder="Describe the attraction..."
                                                            height={180}
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
                                                add({ name: "", content: "" })
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
                                                    infrastructure_id:
                                                        undefined,
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
                                                                "infrastructure_id",
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
                                                            <Select
                                                                options={
                                                                    infrastructureOptions
                                                                }
                                                                placeholder="Select infrastructure"
                                                                showSearch
                                                                optionFilterProp="label"
                                                            />
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
                                                                ]?.image ||
                                                                infrastructureById[
                                                                    form.getFieldValue(
                                                                        [
                                                                            "infrastructure",
                                                                            name,
                                                                            "infrastructure_id",
                                                                        ],
                                                                    )
                                                                ]?.image_url ||
                                                                undefined
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
                                                    infrastructure_id:
                                                        undefined,
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
                        description="Select from managed airports and add as many as needed with travel time."
                        type="info"
                        showIcon
                        className="mb-4"
                    />

                    <Form.List name="airports">
                        {(fields, { add, remove }) => (
                            <div className="flex flex-col gap-y-4">
                                {fields.length === 0 ? (
                                    <Empty
                                        image={Empty.PRESENTED_IMAGE_SIMPLE}
                                        description="No airports added yet"
                                    >
                                        <Button
                                            type="primary"
                                            icon={<PlusOutlined />}
                                            onClick={() =>
                                                add({
                                                    airport_id: undefined,
                                                    travelTimeInMin: 0,
                                                })
                                            }
                                        >
                                            Add First Airport
                                        </Button>
                                    </Empty>
                                ) : (
                                    <>
                                        {fields.map(
                                            ({ key, name, ...restField }) => (
                                                <Card
                                                    key={key}
                                                    size="small"
                                                    className="border-l-4 border-l-orange-500"
                                                    title={
                                                        <span className="text-sm">
                                                            Airport {name + 1}
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
                                                                "airport_id",
                                                            ]}
                                                            label="Airport"
                                                            rules={[
                                                                {
                                                                    required: true,
                                                                    message:
                                                                        "Required",
                                                                },
                                                            ]}
                                                            className="md:col-span-2"
                                                        >
                                                            <Select
                                                                options={
                                                                    airportOptions
                                                                }
                                                                placeholder="Select airport"
                                                                showSearch
                                                                optionFilterProp="label"
                                                            />
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
                                                                    ?.airports?.[
                                                                    name
                                                                ]?.image ||
                                                                airportById[
                                                                    form.getFieldValue(
                                                                        [
                                                                            "airports",
                                                                            name,
                                                                            "airport_id",
                                                                        ],
                                                                    )
                                                                ]?.image_url ||
                                                                undefined
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
                                                    airport_id: undefined,
                                                    travelTimeInMin: 0,
                                                })
                                            }
                                            block
                                            icon={<PlusOutlined />}
                                        >
                                            Add Another Airport
                                        </Button>
                                    </>
                                )}
                            </div>
                        )}
                    </Form.List>
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
    const { td } = useTd();
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
                title: td("Location"),
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
                        </div>
                    </div>
                ),
            },
            {
                title: td("Address"),
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
                title: td("Details"),
                key: "details",
                render: (_, record) => (
                    <div className="flex items-center gap-2">
                        {(record.attractions?.length || 0) > 0 && (
                            <Tooltip title={td("Attractions")}>
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
                            <Tooltip title={td("Infrastructure")}>
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
                            <Tooltip title={td("Airports")}>
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
                                    {td("No details")}
                                </span>
                            )}
                    </div>
                ),
            },
            {
                title: td("Map"),
                key: "map",
                align: "center",
                width: 80,
                render: (_, record) =>
                    record.map_url ? (
                        <Tooltip title={td("Map image available")}>
                            <Badge status="success" />
                        </Tooltip>
                    ) : (
                        <Tooltip title={td("No map image")}>
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
                            label: td("Edit"),
                            onClick: () => handleEdit(record),
                        },
                        { type: "divider" },
                        {
                            key: "delete",
                            icon: <DeleteOutlined />,
                            label: (
                                <Popconfirm
                                    title={td("Delete Location")}
                                    description={
                                        <span>
                                            {td(
                                                "Are you sure you want to delete",
                                            )}{" "}
                                            <strong>{record.name}</strong>?{" "}
                                            {td("This cannot be undone.")}
                                        </span>
                                    }
                                    onConfirm={() => handleDelete(record)}
                                    okText={td("Delete")}
                                    cancelText={td("Cancel")}
                                    okButtonProps={{ danger: true }}
                                    placement="left"
                                >
                                    <span className="text-red-600 w-full inline-block">
                                        {td("Delete")}
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
        [handleEdit, handleDelete, td],
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
                                    {td("Project Locations")}
                                </Title>
                                <Text type="secondary">
                                    {td(
                                        "Manage locations for your developer projects and expose configurations",
                                    )}
                                </Text>
                            </div>
                            <Button
                                type="primary"
                                icon={<PlusOutlined />}
                                onClick={handleAdd}
                            >
                                {td("New Location")}
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
                                        {td("No locations created yet")}
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
                td={td}
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
