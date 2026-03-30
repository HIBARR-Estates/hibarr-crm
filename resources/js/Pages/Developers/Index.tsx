import { useState, useCallback, useEffect } from "react";
import { Link, router, usePage } from "@inertiajs/react";
import DashboardLayout from "../../Components/DashboardLayout";
import PageLayout from "../../Components/PageLayout";
import {
    Button,
    Input,
    Empty,
    Row,
    Col,
    Dropdown,
    Popconfirm,
} from "antd";
import type { MenuProps } from "antd";
import type { PageProps } from "../../Components/DashboardLayout";
import { Plus, Pencil, Trash2, MoreHorizontal, Landmark } from "lucide-react";
import type { Developer } from "../../Types/developerProject";
import { useApiMutate } from "@/lib/api/client/useApiMutate";
import { ApiSuccessResponse } from "@/lib/api/types";
import DeveloperFormModal from "@/Features/Developers/DeveloperFormModal";

// ============================================
// Types
// ============================================

interface PaginationData {
    data: Developer[];
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
    from: number;
    to: number;
}

export interface IndexProps extends PageProps {
    pageTitle: string;
    developers: PaginationData;
    filters: {
        search?: string;
    };
}

// ============================================
// Components
// ============================================

// Developer Card Component
interface DeveloperCardProps {
    developer: Developer;
    onEdit: (developer: Developer) => void;
    onDelete: (developer: Developer) => void;
}

const DeveloperCard: React.FC<DeveloperCardProps> = ({
    developer,
    onEdit,
    onDelete,
}) => {
    const menuItems: MenuProps["items"] = [
        {
            key: "edit",
            icon: <Pencil size={13} />,
            label: "Edit",
            onClick: () => onEdit(developer),
        },
        {
            key: "delete",
            icon: <Trash2 size={13} />,
            label: (
                <Popconfirm
                    title="Delete Developer"
                    description="Are you sure you want to delete this developer? Projects will be unassigned."
                    onConfirm={() => onDelete(developer)}
                    okText="Delete"
                    okButtonProps={{ danger: true }}
                    cancelText="Cancel"
                >
                    <span className="text-red-500">Delete</span>
                </Popconfirm>
            ),
            danger: true,
        },
    ];

    return (
        <div className="group relative bg-white border border-gray-200 rounded-sm overflow-hidden hover:shadow-sm transition-shadow duration-200 cursor-pointer">
            {/* ··· action menu */}
            <div
                className="absolute top-2 right-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity duration-150"
                onClick={(e) => e.stopPropagation()}
            >
                <Dropdown menu={{ items: menuItems }} trigger={["click"]} placement="bottomRight">
                    <button className="w-7 h-7 flex items-center justify-center bg-white/90 rounded-md shadow text-gray-500 hover:bg-white transition-colors cursor-pointer">
                        <MoreHorizontal size={16} />
                    </button>
                </Dropdown>
            </div>

            {/* ── Logo ── */}
            <Link href={route("developers.show", developer.id)}>
                <div className="h-36 flex items-center justify-center px-6">
                    {developer.logo_url ? (
                        <img
                            src={developer.logo_url}
                            alt={developer.name}
                            className="max-h-20 max-w-[90%] object-contain"
                        />
                    ) : (
                        <Landmark size={50} strokeWidth={1.2} className="text-gray-300" />
                    )}
                </div>
            </Link>
        </div>
    );
};

// ============================================
// Main Component
// ============================================

const Index = ({ pageTitle, developers, filters }: IndexProps) => {
    const [modalOpen, setModalOpen] = useState(false);
    const [selectedDeveloper, setSelectedDeveloper] =
        useState<Developer | null>(null);
    const [developerToDelete, setDeveloperToDelete] =
        useState<Developer | null>(null);
    const [searchValue, setSearchValue] = useState(filters.search || "");

    // Delete mutation
    const deleteMutation = useApiMutate<
        Record<string, never>,
        null,
        ApiSuccessResponse<null>
    >(
        developerToDelete
            ? route("developers.destroy", developerToDelete.id)
            : "",
        "DELETE",
        () => {
            setDeveloperToDelete(null);
            router.reload({ only: ["developers"] });
        },
    );

    // Trigger delete when developerToDelete is set
    useEffect(() => {
        if (developerToDelete) {
            deleteMutation.mutate({});
        }
    }, [developerToDelete]);

    const handleAdd = () => {
        setSelectedDeveloper(null);
        setModalOpen(true);
    };

    const handleEdit = (developer: Developer) => {
        setSelectedDeveloper(developer);
        setModalOpen(true);
    };

    const handleDelete = useCallback((developer: Developer) => {
        setDeveloperToDelete(developer);
    }, []);

    const handleSuccess = useCallback(() => {
        router.reload({ only: ["developers"] });
    }, []);

    const handleSearch = useCallback((value: string) => {
        router.get(
            route("developers.index"),
            { search: value || undefined },
            { preserveState: true, preserveScroll: true },
        );
    }, []);

    return (
        <PageLayout title={pageTitle} breadcrumbs={[{ name: "Developers" }]}>
            <div className="max-w-7xl mx-auto">
                <Button
                    type="primary"
                    icon={<Plus size={14} />}
                    onClick={handleAdd}
                >
                    Add Company
                </Button>
                {/* Search */}
                <div className="mb-6 mt-4 flex justify-between">
                    <Input.Search
                        placeholder="Search developers..."
                        allowClear
                        value={searchValue}
                        onChange={(e) => setSearchValue(e.target.value)}
                        onSearch={handleSearch}
                        style={{ maxWidth: 400 }}
                    />
                </div>

                {/* Developer Cards Grid */}
                {developers.data.length === 0 ? (
                    <Empty
                        image={Empty.PRESENTED_IMAGE_SIMPLE}
                        description="No developers found"
                    >
                        <Button type="primary" onClick={handleAdd}>
                            Create Developer
                        </Button>
                    </Empty>
                ) : (
                    <Row gutter={[24, 24]}>
                        {developers.data.map((developer) => (
                            <Col
                                key={developer.id}
                                xs={24}
                                sm={12}
                                md={8}
                                lg={6}
                            >
                                <DeveloperCard
                                    developer={developer}
                                    onEdit={handleEdit}
                                    onDelete={handleDelete}
                                />
                            </Col>
                        ))}
                    </Row>
                )}

                {/* Pagination */}
                {developers.last_page > 1 && (
                    <div className="mt-6 flex justify-center">
                        {/* Simple pagination - can be enhanced */}
                        <div className="flex gap-2">
                            {Array.from(
                                { length: developers.last_page },
                                (_, i) => i + 1,
                            ).map((page) => (
                                <Button
                                    key={page}
                                    type={
                                        page === developers.current_page
                                            ? "primary"
                                            : "default"
                                    }
                                    size="small"
                                    onClick={() =>
                                        router.get(
                                            route("developers.index"),
                                            { ...filters, page },
                                            { preserveState: true },
                                        )
                                    }
                                >
                                    {page}
                                </Button>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* Form Modal */}
            <DeveloperFormModal
                open={modalOpen}
                onClose={() => setModalOpen(false)}
                developer={selectedDeveloper}
                onSuccess={handleSuccess}
            />
        </PageLayout>
    );
};

Index.layout = (page: React.ReactNode) => (
    <DashboardLayout>{page}</DashboardLayout>
);

export default Index;
