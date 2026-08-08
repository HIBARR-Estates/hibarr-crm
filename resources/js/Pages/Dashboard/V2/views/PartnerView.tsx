import { Alert, Col, Row, Statistic } from "antd";
import { Deferred } from "@inertiajs/react";
import DashboardPanel, { PanelSkeleton } from "../components/DashboardPanel";
import { useTd } from "@/Hooks/useDynamicTranslation";

interface PartnerStats {
    referredLeads: number;
    convertedLeads: number;
    conversionRate: number | null;
    commissionsByStatus: Record<string, number>;
}

export interface PartnerViewProps {
    partnerStats?: PartnerStats | null;
}

/**
 * External partners sit outside the trust boundary, so this view shows only
 * what they originated: their own referred leads, how many converted, and their
 * own commissions.
 *
 * No deal values, no contact details, and nothing about other partners — that
 * scoping is enforced server-side in DashboardMetricsService::partnerStats(),
 * not by omitting fields here.
 */
export default function PartnerView({ partnerStats }: PartnerViewProps) {
    const { td } = useTd();

    const commissions = partnerStats?.commissionsByStatus ?? {};

    return (
        <Row gutter={[16, 16]}>
            <Col xs={24} lg={12}>
                <DashboardPanel title="Leads you introduced">
                    <Deferred
                        data="partnerStats"
                        fallback={<PanelSkeleton rows={3} />}
                    >
                        {partnerStats ? (
                            <Row gutter={[16, 16]}>
                                <Col span={8}>
                                    <Statistic
                                        title={td("Referred")}
                                        value={partnerStats.referredLeads}
                                    />
                                </Col>
                                <Col span={8}>
                                    <Statistic
                                        title={td("Converted")}
                                        value={partnerStats.convertedLeads}
                                    />
                                </Col>
                                <Col span={8}>
                                    <Statistic
                                        title={td("Conversion")}
                                        value={
                                            partnerStats.conversionRate ?? "—"
                                        }
                                        suffix={
                                            partnerStats.conversionRate !== null
                                                ? "%"
                                                : undefined
                                        }
                                    />
                                </Col>
                            </Row>
                        ) : (
                            <Alert
                                type="info"
                                showIcon
                                message={td("No partner record linked to this account")}
                                description={td(
                                    "Referred leads are attributed through the agent record on your profile.",
                                )}
                            />
                        )}
                    </Deferred>
                </DashboardPanel>
            </Col>

            <Col xs={24} lg={12}>
                <DashboardPanel title="Your commissions">
                    <Deferred
                        data="partnerStats"
                        fallback={<PanelSkeleton rows={3} />}
                    >
                        {Object.keys(commissions).length ? (
                            <Row gutter={[16, 16]}>
                                {Object.entries(commissions).map(
                                    ([status, amount]) => (
                                        <Col span={12} key={status}>
                                            <Statistic
                                                title={td(status)}
                                                value={amount}
                                                precision={2}
                                            />
                                        </Col>
                                    ),
                                )}
                            </Row>
                        ) : (
                            <Alert
                                type="info"
                                showIcon
                                message={td("No commissions recorded yet")}
                            />
                        )}
                    </Deferred>
                </DashboardPanel>
            </Col>
        </Row>
    );
}
