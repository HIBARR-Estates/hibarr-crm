import React from "react";
import { Breadcrumb } from "antd";
import { Link } from "@inertiajs/react";
import { HomeOutlined } from "@ant-design/icons";

interface BreadcrumbItem {
    name: string;
    url?: string;
}

interface PageLayoutProps {
    title?: string;
    breadcrumbs?: BreadcrumbItem[];
    children: React.ReactNode;
    filterSection?: React.ReactNode;
    config?: {
        showTitle?: boolean;
    };
}
const defaultConfig = {
    showTitle: false,
};

export default function PageLayout({
    title,
    breadcrumbs = [],
    children,
    filterSection,
    config = defaultConfig,
}: PageLayoutProps) {
    // Generate breadcrumb items
    const breadcrumbItems = [
        {
            title: (
                <Link
                    href="/dashboard"
                    className="text-gray-500 hover:text-blue-600"
                >
                    <HomeOutlined className="mr-1" />
                    Home
                </Link>
            ),
        },
        ...breadcrumbs.map((item, index) => ({
            title: item.url ? (
                <Link
                    href={item.url}
                    className="text-gray-500 hover:text-blue-600"
                >
                    {item.name}
                </Link>
            ) : (
                <span className="text-gray-900">{item.name}</span>
            ),
        })),
    ];

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Page Header/Topbar */}
            <div className="bg-white border-b border-gray-200 px-6 py-4">
                <div className="flex items-center justify-between">
                    <div className="flex-1">
                        <div className="flex items-center space-x-3">
                            {config.showTitle && (
                                <h1 className="text-lg font-semibold text-gray-900 truncate max-w-xs">
                                    {title}
                                </h1>
                            )}

                            {/* Breadcrumbs */}
                            <div className="hidden lg:flex">
                                <Breadcrumb
                                    separator="•"
                                    items={breadcrumbItems}
                                    className="text-xs text-gray-500"
                                />
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Filter Section */}
            {filterSection && (
                <div className="bg-white border-b border-gray-200">
                    {filterSection}
                </div>
            )}

            {/* Main Content */}
            <div className="px-6 py-6">{children}</div>
        </div>
    );
}
