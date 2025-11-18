import { Deal } from "@/Types/api/deals";

import { Card, Row, Col, Divider, Typography } from "antd";
import DealInfoSection from "./Components/DealInfoSection";
import DealTabs from "./Components/DealTabs";
import ActivitySidebar from "./Components/ActivitySidebar";
// import "./Components/styles.css";
import DashboardLayout, { PageProps } from "@/Components/DashboardLayout";
import PageLayout from "@/Components/PageLayout";
import { Note } from "@/Types/api/note";
import { DealFollowup } from "@/Types/api/deal-followup";
import { DealFile } from "@/Types/api/file";
import { Proposal } from "@/Types/api/proposal";
import QuickActions from "./Components/ActivitySidebar/QuickActions";

interface Props extends PageProps {
    deal: Deal;
    productNames: string[];
    customFieldCategories: any[];
    fields: any[];
    notes: Note[];
    dealFollowUps: DealFollowup[];
    meetingTypes: Array<{ id: number; name: string; color?: string }>;
    files: DealFile[];
    proposals: Proposal[];
    histories: any[];
    consents: any[];
    gdprSetting: any;
    permissions: Record<string, string>;
    pageTitle: string;
}
const { Title } = Typography;

export default function Show({
    deal,
    productNames,
    customFieldCategories,
    fields,
    notes,
    dealFollowUps,
    meetingTypes,
    files,
    proposals,
    histories,
    consents,
    gdprSetting,
    permissions,
    pageTitle,
}: Props) {
    console.log(deal, "DEAL DATA");
    return (
        <DashboardLayout>
            <PageLayout
                title={pageTitle}
                breadcrumbs={[
                    { name: "Dashboard", url: route("dashboard") },
                    { name: "Deals", url: route("deals.index") },
                    { name: pageTitle },
                ]}
            >
                <div className="min-h-screen mx-12">
                    <div className="max-w-10xl mx-auto">
                        {/* Page Header */}
                        <div className="mb-6 sm:mb-8">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                <div className="min-w-0 flex-1">
                                    <Title level={4} className="mb-0">
                                        {deal.name}
                                    </Title>
                                    <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                                        <div
                                            className="inline-flex items-center px-2 sm:px-3 py-1 rounded-full text-xs sm:text-sm font-medium"
                                            style={{
                                                backgroundColor: `${deal.pipeline?.label_color}20`,
                                                color: deal.pipeline
                                                    ?.label_color,
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
                                                color: deal.lead_stage
                                                    ?.label_color,
                                            }}
                                        >
                                            {deal.lead_stage?.name}
                                        </div>
                                    </div>
                                </div>

                                <QuickActions
                                    deal={deal}
                                    permissions={permissions}
                                />
                            </div>
                        </div>

                        {/* Main Content */}
                        <Row gutter={[30, 40]} className="">
                            {/* Left Column - Main Content */}
                            <Col xs={24} lg={16} xl={16}>
                                <div className="flex flex-col gap-y-4 sm:gap-y-6">
                                    {/* Deal Information Card */}
                                    <Card
                                        className="border-0 rounded-lg overflow-hidden deal-card"
                                        bodyStyle={{ padding: 0 }}
                                        variant="outlined"
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
                                        className="border-0 rounded-lg overflow-hidden deal-card"
                                        bodyStyle={{ padding: 0 }}
                                        variant="outlined"
                                    >
                                        <DealTabs
                                            deal={deal}
                                            notes={notes}
                                            dealFollowUps={dealFollowUps}
                                            meetingTypes={meetingTypes}
                                            files={files}
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
                                        permissions={permissions}
                                    />
                                </div>
                            </Col>
                        </Row>
                    </div>
                </div>
            </PageLayout>
        </DashboardLayout>
    );
}
