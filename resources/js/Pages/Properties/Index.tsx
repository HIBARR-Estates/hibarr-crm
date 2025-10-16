import React, { useState, useCallback, useEffect } from "react";
import { Link, router, usePage } from "@inertiajs/react";
import DashboardLayout from "../../Components/DashboardLayout";
import PageLayout from "../../Components/PageLayout";
import CreateProperty from "./Create";
import FilterBox, {
    FilterItem,
    SearchFilter,
} from "../../Components/FilterBox";
import ConfirmationModal from "../../Components/Common/ConfirmationModal";
import ImportModal from "../../Components/Common/ImportModal";
import ExportModal from "../../Components/Common/ExportModal";
import {
    Table,
    Button,
    Space,
    Dropdown,
    Input,
    Select,
    DatePicker,
    Drawer,
    Form,
    Row,
    Col,
    Tag,
    message,
    Modal,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import type { MenuProps } from "antd";
import {
    PlusOutlined,
    DownloadOutlined,
    MoreOutlined,
    EditOutlined,
    EyeOutlined,
    DeleteOutlined,
    ImportOutlined,
    ExclamationCircleOutlined,
} from "@ant-design/icons";
import { TableRowSelection } from "antd/es/table/interface";
import { set } from "lodash";
import { Property } from "@/Types";

const { Search } = Input;
const { Option } = Select;
const { RangePicker } = DatePicker;

interface QuickActionOption {
    label: string;
    value: string;
    status?: string;
}

interface Product {
    id: number;
    name: string;
}

interface Project {
    id: number;
    project_name: string;
    project_admin: {
        id: number;
        name: string;
    } | null;
}

interface Developer {
    id: number;
    name: string;
    email: string;
}

interface PaginationData {
    data: Property[];
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
    from: number;
    to: number;
}

interface IndexProps {
    pageTitle: string;
    properties: PaginationData;
    products: Product[];
    projects: Project[];
    developers: Developer[];
    filters: {
        search?: string;
        property_type?: string;
        sale_type?: string;
        status?: string;
        city?: string;
        min_price?: string;
        max_price?: string;
    };
}

export default function Index({
    pageTitle,
    properties,
    products,
    projects,
    developers,
    filters,
}: IndexProps) {
    const [property, setProperty] = useState<Property>();
    const [selectedRowKeys, setSelectedRowKeys] = useState<number[]>([]);
    const [filterDrawerVisible, setFilterDrawerVisible] = useState(false);
    const [createDrawerVisible, setCreateDrawerVisible] = useState(false);
    const [quickActionType, setQuickActionType] = useState<string>("");
    const [loading, setLoading] = useState(false);
    const [form] = Form.useForm();
    const [searchValue, setSearchValue] = useState(filters.search || "");
    const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
    const [propertyToDelete, setPropertyToDelete] = useState<Property | null>(
        null
    );
    const [deleteLoading, setDeleteLoading] = useState(false);

    // Import modal state
    const [importModalVisible, setImportModalVisible] = useState(false);
    const [importLoading, setImportLoading] = useState(false);

    // Export modal state
    const [exportModalVisible, setExportModalVisible] = useState(false);
    const [exportLoading, setExportLoading] = useState(false);

    // Bulk action modals state
    const [bulkDeleteConfirmOpen, setBulkDeleteConfirmOpen] = useState(false);
    const [bulkDeleteLoading, setBulkDeleteLoading] = useState(false);
    const [assignProjectModalOpen, setAssignProjectModalOpen] = useState(false);
    const [assignProjectLoading, setAssignProjectLoading] = useState(false);
    const [changeStatusModalOpen, setChangeStatusModalOpen] = useState(false);
    const [changeStatusLoading, setChangeStatusLoading] = useState(false);
    const [selectedDeveloper, setSelectedDeveloper] = useState<number | null>(
        null
    );
    const [selectedProject, setSelectedProject] = useState<number | null>(null);
    const [selectedStatus, setSelectedStatus] = useState<string>("");
    const [projectForm] = Form.useForm();
    const [statusForm] = Form.useForm();

    // Check URL for create parameter to show drawer
    useEffect(() => {
        const urlParams = new URLSearchParams(window.location.search);
        const showCreate = urlParams.get("create") === "true";
        setCreateDrawerVisible(showCreate);
    }, []);

    // Handle drawer visibility and URL update
    const handleCreateDrawerToggle = useCallback((visible: boolean) => {
        setCreateDrawerVisible(visible);

        if (visible) {
            // Add create parameter to URL without full navigation
            const url = new URL(window.location.href);
            url.searchParams.set(property ? "edit" : "create", "true");
            window.history.pushState({}, "", url.toString());
        } else {
            setProperty(undefined);
            // Remove create parameter from URL
            const url = new URL(window.location.href);
            url.searchParams.delete("create");
            window.history.pushState({}, "", url.toString());
        }
    }, []);

    // Handle browser back/forward button
    useEffect(() => {
        const handlePopState = () => {
            const urlParams = new URLSearchParams(window.location.search);
            const showCreate = urlParams.get("create") === "true";
            setCreateDrawerVisible(showCreate);
        };

        window.addEventListener("popstate", handlePopState);
        return () => window.removeEventListener("popstate", handlePopState);
    }, []);

    // Quick action options
    const quickActionOptions: QuickActionOption[] = [
        { label: "Delete", value: "delete" },
        { label: "Assign to Project", value: "assign_to_project" },
        {
            label: "Change Status",
            value: "change-status",
        },
    ];

    // Initialize form with current filters
    React.useEffect(() => {
        form.setFieldsValue(filters);
    }, [filters, form]);

    // Breadcrumbs for the page
    const breadcrumbs = [{ name: "Properties" }];

    const formatCurrency = (amount: number): string => {
        return new Intl.NumberFormat("en-US", {
            style: "currency",
            currency: "USD",
            minimumFractionDigits: 0,
        }).format(amount);
    };

    const getStatusColor = (status: string): string => {
        const colors: Record<string, string> = {
            Available: "green",
            "Under offer": "orange",
            Sold: "red",
            Rented: "blue",
            Withdrawn: "default",
        };
        return colors[status] || "default";
    };

    const getPropertyTypeColor = (type: string): string => {
        const colors: Record<string, string> = {
            Villa: "purple",
            Apartment: "blue",
            House: "green",
            Office: "orange",
            Shop: "red",
            Warehouse: "default",
        };
        return colors[type] || "default";
    };

    // Handle search
    const handleSearch = useCallback(
        (value: string) => {
            const newFilters = { ...filters, search: value };
            router.get(route("properties.index"), newFilters, {
                preserveState: true,
                preserveScroll: true,
            });
        },
        [filters]
    );

    // Handle quick filter changes (for the filter bar)
    const handleQuickFilter = useCallback(
        (key: string, value: string) => {
            const newFilters = { ...filters, [key]: value } as any;
            // Remove empty values
            if (value === "" || value === "all") {
                delete newFilters[key];
            }
            router.get(route("properties.index"), newFilters, {
                preserveState: true,
                preserveScroll: true,
            });
        },
        [filters]
    );

    // Reset filters
    const handleResetQuickFilters = useCallback(() => {
        setSearchValue("");
        router.get(
            route("properties.index"),
            {},
            {
                preserveState: true,
                preserveScroll: true,
            }
        );
    }, []);

    // Handle filter form submission
    const handleFilterSubmit = useCallback(
        (values: any) => {
            const newFilters = { ...filters, ...values };
            // Remove empty values
            Object.keys(newFilters).forEach((key) => {
                if (
                    newFilters[key] === "" ||
                    newFilters[key] === null ||
                    newFilters[key] === undefined
                ) {
                    delete newFilters[key];
                }
            });

            router.get(route("properties.index"), newFilters, {
                preserveState: true,
                preserveScroll: true,
            });
            setFilterDrawerVisible(false);
        },
        [filters]
    );

    // Reset filters
    const handleResetFilters = useCallback(() => {
        form.resetFields();
        router.get(
            route("properties.index"),
            {},
            {
                preserveState: true,
                preserveScroll: true,
            }
        );
        setFilterDrawerVisible(false);
    }, [form]);

    // Handle bulk actions
    const handleQuickAction = useCallback(() => {
        if (!quickActionType || selectedRowKeys.length === 0) {
            message.warning("Please select an action and items");
            return;
        }

        const selectedAction = quickActionOptions.find(
            (option) => option.value === quickActionType
        );

        if (quickActionType === "delete") {
            setBulkDeleteConfirmOpen(true);
        } else if (quickActionType === "assign_to_project") {
            setAssignProjectModalOpen(true);
        } else if (quickActionType === "change-status") {
            if (selectedAction && "status" in selectedAction) {
                setSelectedStatus(selectedAction.status || "");
            }
            setChangeStatusModalOpen(true);
        }
    }, [quickActionType, selectedRowKeys, quickActionOptions]);

    // Handle single property deletion
    const handleDeleteProperty = () => {
        if (!propertyToDelete) return;

        setDeleteLoading(true);
        router.delete(route("properties.destroy", propertyToDelete.id), {
            onSuccess: () => {
                message.success("Property deleted successfully");
                setDeleteConfirmOpen(false);
                setPropertyToDelete(null);
                setDeleteLoading(false);
            },
            onError: () => {
                message.error("Failed to delete property");
                setDeleteLoading(false);
            },
        });
    };

    const openDeleteConfirmation = (property: Property) => {
        setPropertyToDelete(property);
        setDeleteConfirmOpen(true);
    };

    const closeDeleteConfirmation = () => {
        if (!deleteLoading) {
            setDeleteConfirmOpen(false);
            setPropertyToDelete(null);
        }
    };

    // Bulk action handlers
    const handleBulkDelete = () => {
        setBulkDeleteLoading(true);
        router.post(
            route("properties.bulk_action"),
            {
                property_ids: selectedRowKeys,
                action_type: "delete",
            },
            {
                onSuccess: () => {
                    message.success("Properties deleted successfully");
                    setSelectedRowKeys([]);
                    setQuickActionType("");
                    setBulkDeleteConfirmOpen(false);
                },
                onError: () => {
                    message.error("Failed to delete properties");
                },
                onFinish: () => {
                    setBulkDeleteLoading(false);
                },
            }
        );
    };

    const handleAssignToProject = () => {
        projectForm.validateFields().then((values) => {
            setAssignProjectLoading(true);
            router.post(
                route("properties.bulk_action"),
                {
                    property_ids: selectedRowKeys,
                    action_type: "assign_to_project",
                    project_id: values.project_id,
                },
                {
                    onSuccess: () => {
                        message.success(
                            "Properties assigned to project successfully"
                        );
                        setSelectedRowKeys([]);
                        setQuickActionType("");
                        setAssignProjectModalOpen(false);
                        projectForm.resetFields();
                    },
                    onError: () => {
                        message.error("Failed to assign properties to project");
                    },
                    onFinish: () => {
                        setAssignProjectLoading(false);
                    },
                }
            );
        });
    };

    const handleChangeStatus = () => {
        statusForm.validateFields().then((values) => {
            setChangeStatusLoading(true);
            router.post(
                route("properties.bulk_action"),
                {
                    property_ids: selectedRowKeys,
                    action_type: "change_status",
                    status: values.status,
                },
                {
                    onSuccess: () => {
                        message.success(
                            "Properties status changed successfully"
                        );
                        setSelectedRowKeys([]);
                        setQuickActionType("");
                        setChangeStatusModalOpen(false);
                        statusForm.resetFields();
                    },
                    onError: () => {
                        message.error("Failed to change properties status");
                    },
                    onFinish: () => {
                        setChangeStatusLoading(false);
                    },
                }
            );
        });
    };

    // Import handler
    const handleImport = (formData: FormData) => {
        console.log("handleImport called with formData:", formData);

        // Debug: Log FormData contents
        for (let pair of formData.entries()) {
            console.log("FormData entry:", pair[0], pair[1]);
        }

        setImportLoading(true);

        // Convert FormData to object for Inertia
        const formDataObject: { [key: string]: File | string } = {};
        formData.forEach((value, key) => {
            formDataObject[key] = value;
        });

        console.log("FormData object:", formDataObject);

        router.post(route("properties.import.store"), formDataObject, {
            forceFormData: true, // Force Inertia to send as FormData
            onSuccess: (response) => {
                console.log("Import success:", response);
                message.success("Import completed successfully");
                setImportModalVisible(false);
                // Refresh the properties list
                router.reload();
            },
            onError: (errors) => {
                console.error("Import errors:", errors);
                const errorMessage = Object.values(errors).flat().join(", ");
                message.error(errorMessage || "Import failed");
            },
            onFinish: () => {
                setImportLoading(false);
            },
        });
    };

    // Export handler
    const handleExport = (exportFilters: any) => {
        setExportLoading(true);

        // Create a form and submit it to trigger file download
        const form = document.createElement("form");
        form.method = "POST";
        form.action = route("properties.export");
        form.style.display = "none";

        // Add CSRF token
        const csrfToken = document
            .querySelector('meta[name="csrf-token"]')
            ?.getAttribute("content");
        if (csrfToken) {
            const csrfInput = document.createElement("input");
            csrfInput.type = "hidden";
            csrfInput.name = "_token";
            csrfInput.value = csrfToken;
            form.appendChild(csrfInput);
        }

        // Add export filters
        Object.keys(exportFilters).forEach((key) => {
            if (
                exportFilters[key] !== undefined &&
                exportFilters[key] !== null &&
                exportFilters[key] !== ""
            ) {
                const input = document.createElement("input");
                input.type = "hidden";
                input.name = key;
                input.value = exportFilters[key];
                form.appendChild(input);
            }
        });

        document.body.appendChild(form);
        form.submit();
        document.body.removeChild(form);

        // Close modal and reset loading state
        setTimeout(() => {
            setExportLoading(false);
            setExportModalVisible(false);
            message.success("Export started successfully");
        }, 1000);
    };

    const filteredProjects = selectedDeveloper
        ? projects.filter(
              (project) => project.project_admin?.id === selectedDeveloper
          )
        : projects;

    // Table row selection
    const rowSelection: TableRowSelection<Property> = {
        selectedRowKeys,
        onChange: (newSelectedRowKeys: React.Key[], items) => {
            setSelectedRowKeys(items.map((item) => item.id));
        },
    };

    // Action dropdown for each row
    const getActionItems = (record: Property): MenuProps["items"] => [
        {
            key: "view",
            label: (
                <Link href={route("properties.show", record.id)}>
                    <EyeOutlined className="mr-2" />
                    View
                </Link>
            ),
        },
        {
            key: "edit",
            label: (
                <button
                    onClick={() => {
                        setProperty(record);
                        handleCreateDrawerToggle(true);
                    }}
                >
                    <EditOutlined className="mr-2" />
                    Edit
                </button>
            ),
        },
        {
            type: "divider",
        },
        {
            key: "delete",
            label: (
                <span className="text-red-600">
                    <DeleteOutlined className="mr-2" />
                    Delete
                </span>
            ),
            onClick: () => openDeleteConfirmation(record),
        },
    ];

    // Table columns
    const columns: ColumnsType<Property> = [
        {
            title: "Title",
            dataIndex: "title",
            key: "title",
            width: 250,
            render: (title: string, record: Property) => (
                <div>
                    <Link
                        href={route("properties.show", record.id)}
                        className="font-medium text-blue-600 hover:text-blue-800"
                    >
                        {title}
                    </Link>
                    {record.product && (
                        <div className="text-xs text-gray-500 mt-1">
                            Product: {record.product.name}
                        </div>
                    )}
                </div>
            ),
        },
        {
            title: "Type",
            dataIndex: "property_type",
            key: "property_type",
            width: 120,
            render: (type: string) => (
                <Tag color={getPropertyTypeColor(type)}>
                    {type.replace("_", " ").toUpperCase()}
                </Tag>
            ),
        },
        {
            title: "Sale Type",
            dataIndex: "sale_type",
            key: "sale_type",
            width: 100,
            render: (saleType: string) => (
                <Tag color={saleType === "For Sale" ? "red" : "blue"}>
                    {saleType}
                </Tag>
            ),
        },
        {
            title: "Price",
            dataIndex: "price",
            key: "price",
            width: 120,
            render: (price: number, record: Property) => (
                <div className="font-medium">
                    {formatCurrency(price)}
                    {record.sale_type === "rent" && (
                        <span className="text-xs text-gray-500">/month</span>
                    )}
                </div>
            ),
        },
        {
            title: "Location",
            key: "location",
            width: 150,
            render: (_, record: Property) => (
                <div>
                    <div className="font-medium">{record.city}</div>
                    <div className="text-xs text-gray-500">{record.area}</div>
                </div>
            ),
        },
        {
            title: "Details",
            key: "details",
            width: 120,
            render: (_, record: Property) => (
                <div className="text-sm">
                    {record.bedrooms && <div>🛏️ {record.bedrooms} bed</div>}
                    {record.bathrooms && <div>🚿 {record.bathrooms} bath</div>}
                </div>
            ),
        },
        {
            title: "Status",
            dataIndex: "status",
            key: "status",
            width: 120,
            render: (status: string) => (
                <Tag color={getStatusColor(status)}>{status}</Tag>
            ),
        },
        {
            title: "Actions",
            key: "actions",
            width: 80,
            fixed: "right",
            render: (_, record: Property) => (
                <Dropdown
                    menu={{ items: getActionItems(record) }}
                    trigger={["click"]}
                    placement="bottomRight"
                >
                    <Button type="text" icon={<MoreOutlined />} />
                </Dropdown>
            ),
        },
    ];

    return (
        <DashboardLayout>
            <PageLayout
                title={pageTitle}
                breadcrumbs={breadcrumbs}
                filterSection={
                    <FilterBox
                        onReset={handleResetQuickFilters}
                        showReset={Object.keys(filters).length > 0}
                    >
                        {/* Search Filter */}
                        <SearchFilter
                            placeholder="Search properties by title, description, or location..."
                            value={searchValue}
                            onChange={setSearchValue}
                            onSearch={handleSearch}
                        />

                        {/* Property Type Filter */}
                        <FilterItem label="Type">
                            <Select
                                value={filters.property_type || "all"}
                                onChange={(value) =>
                                    handleQuickFilter("property_type", value)
                                }
                                style={{ minWidth: 150 }}
                                size="middle"
                                placeholder="All Types"
                                showSearch
                                optionFilterProp="children"
                            >
                                <Option value="all">All Types</Option>
                                {/* Housing Types */}
                                <Option value="Villa">Villa</Option>
                                <Option value="Twin Villa">Twin Villa</Option>
                                <Option value="Apartment">Apartment</Option>
                                <Option value="Family Home">Family Home</Option>
                                <Option value="Townhouse">Townhouse</Option>
                                <Option value="Loft">Loft</Option>
                                <Option value="Penthouse">Penthouse</Option>
                                <Option value="Bungalow">Bungalow</Option>
                                <Option value="Commercial Property">
                                    Commercial Property
                                </Option>
                                <Option value="Block of apartments">
                                    Block of Apartments
                                </Option>
                                <Option value="Complete Building">
                                    Complete Building
                                </Option>
                                <Option value="Abandoned Building">
                                    Abandoned Building
                                </Option>
                                <Option value="Residence">Residence</Option>
                                <Option value="Half Construction">
                                    Half Construction
                                </Option>
                                <Option value="Time Share">Time Share</Option>
                                {/* Land Types */}
                                <Option value="Residentially Zoned Land">
                                    Residentially Zoned Land
                                </Option>
                                <Option value="Field">Field</Option>
                                <Option value="Residentially and Commercially Zoned Land">
                                    Res. & Com. Zoned Land
                                </Option>
                                <Option value="Commercially Zoned Land">
                                    Commercially Zoned Land
                                </Option>
                                <Option value="Industrially Zoned land">
                                    Industrially Zoned Land
                                </Option>
                                <Option value="Tourism Zoned Land">
                                    Tourism Zoned Land
                                </Option>
                                <Option value="Olive Grove">Olive Grove</Option>
                                {/* Commercial Types */}
                                <Option value="Shop">Shop</Option>
                                <Option value="Hotel">Hotel</Option>
                                <Option value="Workplace">Workplace</Option>
                                <Option value="Warehouse">Warehouse</Option>
                                <Option value="Workplace for sale">
                                    Workplace for Sale
                                </Option>
                                <Option value="Office">Office</Option>
                            </Select>
                        </FilterItem>

                        {/* Sale Type Filter */}
                        <FilterItem label="Sale Type">
                            <Select
                                value={filters.sale_type || "all"}
                                onChange={(value) =>
                                    handleQuickFilter("sale_type", value)
                                }
                                style={{ minWidth: 120 }}
                                size="middle"
                                placeholder="All"
                            >
                                <Option value="all">All</Option>
                                <Option value="For Sale">For Sale</Option>
                                <Option value="For Rent">For Rent</Option>
                                <Option value="For Daily Rental">
                                    For Daily Rental
                                </Option>
                            </Select>
                        </FilterItem>

                        {/* Status Filter */}
                        <FilterItem label="Status">
                            <Select
                                value={filters.status || "all"}
                                onChange={(value) =>
                                    handleQuickFilter("status", value)
                                }
                                style={{ minWidth: 130 }}
                                size="middle"
                                placeholder="All Status"
                            >
                                <Option value="all">All Status</Option>
                                <Option value="Available">
                                    <span>
                                        <span className="inline-block w-2 h-2 bg-green-500 rounded-full mr-2"></span>
                                        Available
                                    </span>
                                </Option>
                                <Option value="Under offer">
                                    <span>
                                        <span className="inline-block w-2 h-2 bg-orange-500 rounded-full mr-2"></span>
                                        Under Offer
                                    </span>
                                </Option>
                                <Option value="Sold">
                                    <span>
                                        <span className="inline-block w-2 h-2 bg-red-500 rounded-full mr-2"></span>
                                        Sold
                                    </span>
                                </Option>
                                <Option value="Rented">
                                    <span>
                                        <span className="inline-block w-2 h-2 bg-blue-500 rounded-full mr-2"></span>
                                        Rented
                                    </span>
                                </Option>
                                <Option value="Withdrawn">
                                    <span>
                                        <span className="inline-block w-2 h-2 bg-gray-500 rounded-full mr-2"></span>
                                        Withdrawn
                                    </span>
                                </Option>
                            </Select>
                        </FilterItem>

                        {/* City Filter */}
                        <FilterItem label="City">
                            <Input
                                placeholder="Enter city"
                                value={filters.city || ""}
                                onChange={(e) =>
                                    handleQuickFilter("city", e.target.value)
                                }
                                style={{ minWidth: 120 }}
                                size="middle"
                                allowClear
                            />
                        </FilterItem>

                        {/* Price Range Filter */}
                        <FilterItem label="Price Range">
                            <Select
                                value={
                                    filters.min_price && filters.max_price
                                        ? `${filters.min_price}-${filters.max_price}`
                                        : "all"
                                }
                                onChange={(value) => {
                                    if (value === "all") {
                                        handleQuickFilter("min_price", "");
                                        handleQuickFilter("max_price", "");
                                    } else {
                                        const [min, max] = value.split("-");
                                        handleQuickFilter("min_price", min);
                                        handleQuickFilter("max_price", max);
                                    }
                                }}
                                style={{ minWidth: 150 }}
                                size="middle"
                                placeholder="Any Price"
                            >
                                <Option value="all">Any Price</Option>
                                <Option value="0-100000">$0 - $100K</Option>
                                <Option value="100000-250000">
                                    $100K - $250K
                                </Option>
                                <Option value="250000-500000">
                                    $250K - $500K
                                </Option>
                                <Option value="500000-1000000">
                                    $500K - $1M
                                </Option>
                                <Option value="1000000-2000000">
                                    $1M - $2M
                                </Option>
                                <Option value="2000000-999999999">$2M+</Option>
                            </Select>
                        </FilterItem>
                    </FilterBox>
                }
            >
                <div className="max-w-7xl mx-auto space-y-6">
                    {/* Header with Actions */}
                    <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                        <div className="flex items-center gap-3">
                            <Button
                                type="primary"
                                icon={<PlusOutlined />}
                                onClick={() => handleCreateDrawerToggle(true)}
                            >
                                Add Property
                            </Button>
                            <Button
                                type="primary"
                                icon={<ImportOutlined />}
                                onClick={() => setImportModalVisible(true)}
                            >
                                Import Properties
                            </Button>
                        </div>

                        <div className="flex items-center gap-3">
                            {/* Bulk Actions - Only show when items are selected */}
                            {selectedRowKeys.length > 0 && (
                                <div className="flex items-center gap-2 bg-blue-50 px-3 py-2 rounded-lg border border-blue-200">
                                    <span className="text-sm text-blue-700">
                                        {selectedRowKeys.length} selected
                                    </span>
                                    <Select
                                        placeholder="Choose action"
                                        value={quickActionType}
                                        onChange={setQuickActionType}
                                        style={{ width: 180 }}
                                        size="small"
                                    >
                                        {quickActionOptions.map((option) => (
                                            <Option
                                                key={option.value}
                                                value={option.value}
                                            >
                                                {option.label}
                                            </Option>
                                        ))}
                                    </Select>
                                    <Button
                                        type="primary"
                                        size="small"
                                        loading={loading}
                                        disabled={!quickActionType}
                                        onClick={handleQuickAction}
                                    >
                                        Apply
                                    </Button>
                                </div>
                            )}

                            <Button
                                icon={<DownloadOutlined />}
                                onClick={() => setExportModalVisible(true)}
                            >
                                Export
                            </Button>
                        </div>
                    </div>

                    {/* Properties Table */}
                    <div className="bg-white rounded-lg shadow">
                        <Table
                            columns={columns}
                            dataSource={properties.data}
                            rowKey="id"
                            rowSelection={rowSelection}
                            pagination={{
                                current: properties.current_page,
                                total: properties.total,
                                pageSize: properties.per_page,
                                showSizeChanger: true,
                                showQuickJumper: true,
                                showTotal: (total, range) =>
                                    `${range[0]}-${range[1]} of ${total} properties`,
                                onChange: (page, pageSize) => {
                                    router.get(
                                        route("properties.index"),
                                        {
                                            ...filters,
                                            page,
                                            per_page: pageSize,
                                        },
                                        {
                                            preserveState: true,
                                            preserveScroll: true,
                                        }
                                    );
                                },
                            }}
                            scroll={{ x: 1200 }}
                            size="small"
                        />
                    </div>

                    {/* Advanced Filters Drawer */}
                    <Drawer
                        title="Advanced Filters"
                        placement="right"
                        width={400}
                        onClose={() => setFilterDrawerVisible(false)}
                        open={filterDrawerVisible}
                        extra={
                            <Space>
                                <Button onClick={handleResetFilters}>
                                    Reset
                                </Button>
                                <Button
                                    type="primary"
                                    onClick={() => form.submit()}
                                >
                                    Apply Filters
                                </Button>
                            </Space>
                        }
                    >
                        <Form
                            form={form}
                            layout="vertical"
                            onFinish={handleFilterSubmit}
                        >
                            <Form.Item
                                label="Property Type"
                                name="property_type"
                            >
                                <Select
                                    placeholder="Select property type"
                                    allowClear
                                >
                                    <Option value="Villa">Villa</Option>
                                    <Option value="Apartment">Apartment</Option>
                                    <Option value="House">House</Option>
                                    <Option value="Office">Office</Option>
                                    <Option value="Shop">Shop</Option>
                                    <Option value="Warehouse">Warehouse</Option>
                                </Select>
                            </Form.Item>

                            <Form.Item label="Sale Type" name="sale_type">
                                <Select
                                    placeholder="Select sale type"
                                    allowClear
                                >
                                    <Option value="For Sale">For Sale</Option>
                                    <Option value="For Rent">For Rent</Option>
                                    <Option value="For Daily Rental">
                                        For Daily Rental
                                    </Option>
                                </Select>
                            </Form.Item>

                            <Form.Item label="Status" name="status">
                                <Select placeholder="Select status" allowClear>
                                    <Option value="Available">Available</Option>
                                    <Option value="Under offer">
                                        Under Offer
                                    </Option>
                                    <Option value="Sold">Sold</Option>
                                    <Option value="Rented">Rented</Option>
                                    <Option value="Withdrawn">Withdrawn</Option>
                                </Select>
                            </Form.Item>

                            <Form.Item label="City" name="city">
                                <Input placeholder="Enter city name" />
                            </Form.Item>

                            <Row gutter={16}>
                                <Col span={12}>
                                    <Form.Item
                                        label="Min Price"
                                        name="min_price"
                                    >
                                        <Input type="number" placeholder="0" />
                                    </Form.Item>
                                </Col>
                                <Col span={12}>
                                    <Form.Item
                                        label="Max Price"
                                        name="max_price"
                                    >
                                        <Input
                                            type="number"
                                            placeholder="1000000"
                                        />
                                    </Form.Item>
                                </Col>
                            </Row>
                        </Form>
                    </Drawer>

                    {/* Create Property Drawer */}
                    <Drawer
                        title="Create New Property"
                        placement="right"
                        size="large"
                        open={createDrawerVisible}
                        onClose={() => handleCreateDrawerToggle(false)}
                        // width="80%"
                        // style={{ maxWidth: "1200px" }}
                    >
                        <CreateProperty
                            visible={createDrawerVisible}
                            property={property}
                            setProperty={setProperty}
                            products={products}
                            onClose={() => handleCreateDrawerToggle(false)}
                            onSuccess={() => {
                                handleCreateDrawerToggle(false);
                                // Refresh the properties list
                                router.reload();
                                message.success(
                                    "Property created successfully"
                                );
                            }}
                        />
                    </Drawer>
                </div>

                {/* Delete Confirmation Modal */}
                <ConfirmationModal
                    open={deleteConfirmOpen}
                    onClose={closeDeleteConfirmation}
                    onSubmit={{
                        fn: handleDeleteProperty,
                        loading: deleteLoading,
                    }}
                    title="Delete Property"
                    description={
                        propertyToDelete
                            ? `Are you sure you want to delete "${propertyToDelete.title}"? This action cannot be undone.`
                            : "Are you sure you want to delete this property? This action cannot be undone."
                    }
                    icon={<DeleteOutlined className="text-red-500 text-3xl" />}
                    confirmText="Yes, Delete"
                    cancelText="Cancel"
                    confirmType="primary"
                    confirmDanger={true}
                />

                {/* Bulk Delete Confirmation Modal */}
                <ConfirmationModal
                    open={bulkDeleteConfirmOpen}
                    onClose={() =>
                        !bulkDeleteLoading && setBulkDeleteConfirmOpen(false)
                    }
                    onSubmit={{
                        fn: handleBulkDelete,
                        loading: bulkDeleteLoading,
                    }}
                    title="Delete Selected Properties"
                    description={`Are you sure you want to delete ${selectedRowKeys.length} selected properties? This action cannot be undone.`}
                    icon={<DeleteOutlined className="text-red-500 text-3xl" />}
                    confirmText="Yes, Delete All"
                    cancelText="Cancel"
                    confirmType="primary"
                    confirmDanger={true}
                />

                {/* Assign to Project Modal */}
                <Modal
                    title="Assign Properties to Project"
                    open={assignProjectModalOpen}
                    onCancel={() =>
                        !assignProjectLoading &&
                        setAssignProjectModalOpen(false)
                    }
                    footer={[
                        <Button
                            key="cancel"
                            onClick={() => setAssignProjectModalOpen(false)}
                            disabled={assignProjectLoading}
                        >
                            Cancel
                        </Button>,
                        <Button
                            key="submit"
                            type="primary"
                            loading={assignProjectLoading}
                            onClick={handleAssignToProject}
                        >
                            Assign to Project
                        </Button>,
                    ]}
                >
                    <div className="mb-4">
                        <p>
                            You are about to assign {selectedRowKeys.length}{" "}
                            properties to a project.
                        </p>
                    </div>
                    <Form form={projectForm} layout="vertical">
                        <Form.Item
                            name="developer_id"
                            label="Select Developer"
                            rules={[
                                {
                                    required: true,
                                    message: "Please select a developer",
                                },
                            ]}
                        >
                            <Select
                                placeholder="Choose a developer"
                                onChange={(value) => {
                                    setSelectedDeveloper(value);
                                    projectForm.setFieldsValue({
                                        project_id: undefined,
                                    });
                                }}
                                showSearch
                                // filterOption={(input, option) =>
                                //     (option?.children as string)
                                //         ?.toLowerCase()
                                //         .includes(input.toLowerCase())
                                // }
                            >
                                {developers.map((developer) => (
                                    <Option
                                        key={developer.id}
                                        value={developer.id}
                                    >
                                        {developer.name} ({developer.email})
                                    </Option>
                                ))}
                            </Select>
                        </Form.Item>
                        <Form.Item
                            name="project_id"
                            label="Select Project"
                            rules={[
                                {
                                    required: true,
                                    message: "Please select a project",
                                },
                            ]}
                        >
                            <Select
                                placeholder="Choose a project"
                                disabled={!selectedDeveloper}
                                showSearch
                                // filterOption={(input, option) =>
                                //     (option?.children as string)
                                //         ?.toLowerCase()
                                //         .includes(input.toLowerCase())
                                // }
                            >
                                {filteredProjects.map((project) => (
                                    <Option key={project.id} value={project.id}>
                                        {project.project_name}
                                    </Option>
                                ))}
                            </Select>
                        </Form.Item>
                    </Form>
                </Modal>

                {/* Change Status Modal */}
                <Modal
                    title="Change Properties Status"
                    open={changeStatusModalOpen}
                    onCancel={() =>
                        !changeStatusLoading && setChangeStatusModalOpen(false)
                    }
                    footer={[
                        <Button
                            key="cancel"
                            onClick={() => setChangeStatusModalOpen(false)}
                            disabled={changeStatusLoading}
                        >
                            Cancel
                        </Button>,
                        <Button
                            key="submit"
                            type="primary"
                            loading={changeStatusLoading}
                            onClick={handleChangeStatus}
                        >
                            Change Status
                        </Button>,
                    ]}
                >
                    <div className="mb-4">
                        <p>
                            You are about to change the status of{" "}
                            {selectedRowKeys.length} properties.
                        </p>
                    </div>
                    <Form
                        form={statusForm}
                        layout="vertical"
                        initialValues={{ status: selectedStatus }}
                    >
                        <Form.Item
                            name="status"
                            label="Select New Status"
                            rules={[
                                {
                                    required: true,
                                    message: "Please select a status",
                                },
                            ]}
                        >
                            <Select
                                placeholder="Choose new status"
                                options={[
                                    {
                                        label: "Available",
                                        value: "Available",
                                    },
                                    {
                                        label: "Under offer",
                                        value: "Under offer",
                                    },
                                    {
                                        label: "Sold",
                                        value: "Sold",
                                    },
                                    {
                                        label: "Withdrawn",
                                        value: "Withdrawn",
                                    },
                                ]}
                            />
                        </Form.Item>
                    </Form>
                </Modal>

                {/* Import Modal */}
                <ImportModal
                    visible={importModalVisible}
                    onClose={() => setImportModalVisible(false)}
                    onSubmit={handleImport}
                    loading={importLoading}
                    title="Import Properties"
                    sampleDownloadUrl={route("properties.sample_import")}
                    description="Import multiple properties at once using an Excel file. Make sure to follow the template format for successful import."
                    acceptedFileTypes=".xlsx,.xls"
                    maxFileSize={10}
                />

                {/* Export Modal */}
                <ExportModal
                    visible={exportModalVisible}
                    onClose={() => setExportModalVisible(false)}
                    onExport={handleExport}
                    loading={exportLoading}
                    title="Export Properties"
                    description="Configure filters and export property data to Excel format."
                />
            </PageLayout>
        </DashboardLayout>
    );
}
