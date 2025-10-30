import { PageProps } from "@/Types";
import { Deal } from "@/Types/api/deals";
import { User } from "@/Types/api/users";
import DashboardLayout from "@/Layouts/DashboardLayout";
import { Head } from "@inertiajs/react";
import { Card, Row, Col, Divider } from "antd";
import DealInfoSection from "./Components/DealInfoSection";
import DealTabs from "./Components/DealTabs";
import ActivitySidebar from "./Components/ActivitySidebar";
import "./Components/styles.css";

interface Props extends PageProps {
    deal: Deal;
    productNames: string[];
    customFieldCategories: any[];
    fields: any[];
    notes: any[];
    dealFollowUps: any[];
    proposals: any[];
    histories: any[];
    activities: any[];
    consents: any[];
    gdprSetting: any;
    permissions: Record<string, string>;
    pageTitle: string;
}

export default function Show({
    deal,
    productNames,
    customFieldCategories,
    fields,
    notes,
    dealFollowUps,
    proposals,
    histories,
    activities,
    consents,
    gdprSetting,
    permissions,
    pageTitle,
}: Props) {
    return (
        <DashboardLayout
            title={pageTitle}
            breadcrumbs={[
                { title: "Dashboard", href: route("dashboard") },
                { title: "Deals", href: route("deals.index") },
                { title: pageTitle },
            ]}
        >
            <Head title={pageTitle} />

            <div className="min-h-screen bg-gray-50">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8">
                    {/* Page Header */}
                    <div className="mb-6 sm:mb-8">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                            <div className="min-w-0 flex-1">
                                <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2 truncate">
                                    {deal.name}
                                </h1>
                                <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                                    <div
                                        className="inline-flex items-center px-2 sm:px-3 py-1 rounded-full text-xs sm:text-sm font-medium"
                                        style={{
                                            backgroundColor: `${deal.pipeline?.label_color}20`,
                                            color: deal.pipeline?.label_color,
                                        }}
                                    >
                                        {deal.pipeline?.name}
                                    </div>
                                    <span className="text-gray-400 hidden sm:inline">
                                        →
                                    </span>
                                    <div
                                        className="inline-flex items-center px-2 sm:px-3 py-1 rounded-full text-xs sm:text-sm font-medium"
                                        style={{
                                            backgroundColor: `${deal.lead_stage?.label_color}20`,
                                            color: deal.lead_stage?.label_color,
                                        }}
                                    >
                                        {deal.lead_stage?.name}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Main Content */}
                    <Row gutter={[16, 24]} className="lg:gutter-24">
                        {/* Left Column - Main Content */}
                        <Col xs={24} lg={16} xl={16}>
                            <div className="space-y-4 sm:space-y-6">
                                {/* Deal Information Card */}
                                <Card
                                    className="shadow-sm border-0 rounded-lg overflow-hidden deal-card"
                                    bodyStyle={{ padding: 0 }}
                                >
                                    <DealInfoSection
                                        deal={deal}
                                        productNames={productNames}
                                        customFieldCategories={
                                            customFieldCategories
                                        }
                                        fields={fields}
                                        permissions={permissions}
                                    />
                                </Card>

                                {/* Tabs Section */}
                                <Card
                                    className="shadow-sm border-0 rounded-lg overflow-hidden deal-card"
                                    bodyStyle={{ padding: 0 }}
                                >
                                    <DealTabs
                                        deal={deal}
                                        notes={notes}
                                        dealFollowUps={dealFollowUps}
                                        proposals={proposals}
                                        histories={histories}
                                        consents={consents}
                                        gdprSetting={gdprSetting}
                                        permissions={permissions}
                                    />
                                </Card>
                            </div>
                        </Col>

                        {/* Right Column - Activities Sidebar */}
                        <Col xs={24} lg={8} xl={8}>
                            <div className="lg:sticky lg:top-8">
                                <ActivitySidebar
                                    deal={deal}
                                    activities={activities}
                                    permissions={permissions}
                                />
                            </div>
                        </Col>
                    </Row>
                </div>
            </div>
        </DashboardLayout>
    );
}
