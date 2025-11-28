import React from "react";
import { Avatar, Breadcrumb, Dropdown, MenuProps, Switch } from "antd";
import { Head, Link, router, usePage } from "@inertiajs/react";
import { HomeOutlined } from "@ant-design/icons";
import { PageProps } from "./DashboardLayout";
import { useApiMutate } from "@/lib/api/client/useApiMutate";

interface BreadcrumbItem {
    name: string;
    url?: string;
}

interface PageLayoutProps {
    title?: string;
    breadcrumbs?: BreadcrumbItem[];
    children: React.ReactNode;
    searchComp?: React.ReactNode;
    filterSection?: React.ReactNode;
    config?: {
        showTitle?: boolean;
    };
    mainContentClassName?: string;
}
const defaultConfig = {
    showTitle: false,
};

export default function PageLayout({
    title,
    breadcrumbs = [],
    children,
    searchComp,
    filterSection,
    config = defaultConfig,
    mainContentClassName = "px-6 py-6",
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

    const { props } = usePage<PageProps>();
    const { auth, company, appName, sidebar, currentRouteName } = props;
    const { user } = auth;

    // Logout mutation
    const logoutMutation = useApiMutate<{}, any, any>(route("logout"), "POST");

    // User dropdown menu
    const userMenuItems: MenuProps["items"] = [
        {
            key: "logout",
            label: (
                <span
                    onClick={() => {
                        logoutMutation.mutate(
                            {},
                            {
                                onSuccess: () => {
                                    // Redirect to login page on successful logout
                                    window.location.href = route("login");
                                },
                            }
                        );
                    }}
                    className="w-full text-left cursor-pointer"
                >
                    Logout
                </span>
            ),
        },
    ];

    return (
        <>
            <Head title={title} />

            <div className="min-h-screen bg-blue-100/20">
                {/* Page Header/Topbar */}
                <div className="bg-white border-b border-gray-200 px-6 py-4">
                    <div className="flex items-center gap-x-6">
                        <div className="">
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

                        {/* Search Component */}
                        {searchComp && (
                            <div className="flex-1">
                                {/* set a max width so it doesn't stretch too far */}
                                <div className="max-w-lg mx-auto">
                                    {searchComp}
                                </div>
                            </div>
                        )}

                        <Dropdown
                            menu={{ items: userMenuItems }}
                            placement="bottomLeft"
                        >
                            {/* ensure this always at the end */}
                            <div className="flex items-center justify-between cursor-pointer ml-auto">
                                <div className="flex items-center gap-x-2">
                                    <Avatar
                                        src={user?.image_url}
                                        size="small"
                                        alt={user?.name}
                                    >
                                        {user?.name?.charAt(0)}
                                    </Avatar>
                                    <div className="flex flex-col">
                                        <span className="text-sm font-medium truncate">
                                            {appName}
                                        </span>
                                        <span className="text-xs text-gray-500 truncate">
                                            {user?.name}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </Dropdown>
                    </div>
                </div>

                {/* Filter Section */}
                {filterSection && (
                    <div className="bg-white border-b border-gray-200">
                        {filterSection}
                    </div>
                )}

                {/* Main Content */}
                <div className={mainContentClassName}>{children}</div>
            </div>
        </>
    );
}
