import React, { useEffect, useState } from "react";
import {
    Card,
    InputNumber,
    Button,
    Space,
    Typography,
    App,
    Skeleton,
} from "antd";
import { ClockCircleOutlined, SaveOutlined } from "@ant-design/icons";
import DashboardLayout from "@/Components/DashboardLayout";
import PageLayout from "@/Components/PageLayout";
import useTranslation from "@/Hooks/useTranslation";
import { useApiMutate } from "@/lib/api/client/useApiMutate";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";

const { Title, Text, Paragraph } = Typography;

interface SettingsData {
    delay_minutes: number | null;
    snooze_minutes: number | null;
    default_delay_minutes: number;
    default_snooze_minutes: number;
}

interface SettingsResponse {
    status: string;
    data: SettingsData;
}

export default function MeetingAttendanceConfirmationSettings({
    pageTitle,
}: {
    pageTitle: string;
}) {
    const { t } = useTranslation();
    const { message } = App.useApp();
    const queryClient = useQueryClient();

    const [delayMinutes, setDelayMinutes] = useState<number | null>(null);
    const [snoozeMinutes, setSnoozeMinutes] = useState<number | null>(null);
    const [hasChanges, setHasChanges] = useState(false);

    const { data, isLoading } = useQuery<SettingsData>({
        queryKey: ["meeting-attendance-confirmation-settings"],
        queryFn: async () => {
            const response = await axios.get<SettingsResponse>(
                route("meeting-attendance-confirmation-settings.data"),
            );
            return response.data.data;
        },
    });

    const updateMutation = useApiMutate<any, any, any>(
        route("meeting-attendance-confirmation-settings.update"),
        "PUT",
    );

    useEffect(() => {
        if (data) {
            setDelayMinutes(data.delay_minutes);
            setSnoozeMinutes(data.snooze_minutes);
            setHasChanges(false);
        }
    }, [data]);

    const handleSave = () => {
        updateMutation.mutate(
            {
                delay_minutes: delayMinutes,
                snooze_minutes: snoozeMinutes,
            },
            {
                onSuccess: (response: any) => {
                    if (response?.status === "success") {
                        message.success(
                            t(
                                "pages.meetings.attendance_confirmation_settings.saved",
                            ),
                        );
                        setHasChanges(false);
                        queryClient.invalidateQueries({
                            queryKey: [
                                "meeting-attendance-confirmation-settings",
                            ],
                        });
                    }
                },
                onError: (error: any) => {
                    message.error(
                        error?.message ||
                            t(
                                "pages.meetings.attendance_confirmation_settings.save_failed",
                            ),
                    );
                },
            },
        );
    };

    const breadcrumbs = [
        { name: t("app.menu.settings"), url: route("profile-settings.index") },
        { name: t("app.menu.meetings") },
    ];

    return (
        <PageLayout
            title={pageTitle}
            breadcrumbs={breadcrumbs}
            config={{ showTitle: true }}
        >
            <div className="max-w-3xl mx-auto">
                <Card className="mb-6">
                    <div className="flex items-start gap-4">
                        <div className="p-3 bg-amber-50 rounded-lg">
                            <ClockCircleOutlined className="text-2xl text-amber-500" />
                        </div>
                        <div className="flex-1">
                            <Title level={4} className="mb-1">
                                {t("app.menu.meetings")}
                            </Title>
                            <Paragraph type="secondary" className="mb-0">
                                {t(
                                    "pages.meetings.attendance_confirmation_settings.description",
                                )}
                            </Paragraph>
                        </div>
                    </div>
                </Card>

                <Card
                    title={
                        <div className="flex items-center gap-2">
                            <ClockCircleOutlined />
                            <span>
                                {t(
                                    "pages.meetings.attendance_confirmation_settings.title",
                                )}
                            </span>
                        </div>
                    }
                >
                    {isLoading ? (
                        <Skeleton active paragraph={{ rows: 3 }} />
                    ) : (
                        <>
                            <div className="mb-5">
                                <Text strong>
                                    {t(
                                        "pages.meetings.attendance_confirmation_settings.delay_label",
                                    )}
                                </Text>
                                <Paragraph
                                    type="secondary"
                                    className="text-sm mb-2"
                                >
                                    {t(
                                        "pages.meetings.attendance_confirmation_settings.delay_help",
                                    )}
                                </Paragraph>
                                <InputNumber
                                    min={1}
                                    max={1440}
                                    value={delayMinutes}
                                    placeholder={String(
                                        data?.default_delay_minutes ?? 5,
                                    )}
                                    onChange={(value) => {
                                        setDelayMinutes(value ?? null);
                                        setHasChanges(true);
                                    }}
                                    style={{ width: 160 }}
                                    addonAfter={t(
                                        "pages.meetings.attendance_confirmation_settings.minutes",
                                    )}
                                />
                            </div>

                            <div className="mb-5">
                                <Text strong>
                                    {t(
                                        "pages.meetings.attendance_confirmation_settings.snooze_label",
                                    )}
                                </Text>
                                <Paragraph
                                    type="secondary"
                                    className="text-sm mb-2"
                                >
                                    {t(
                                        "pages.meetings.attendance_confirmation_settings.snooze_help",
                                    )}
                                </Paragraph>
                                <InputNumber
                                    min={1}
                                    max={1440}
                                    value={snoozeMinutes}
                                    placeholder={String(
                                        data?.default_snooze_minutes ?? 60,
                                    )}
                                    onChange={(value) => {
                                        setSnoozeMinutes(value ?? null);
                                        setHasChanges(true);
                                    }}
                                    style={{ width: 160 }}
                                    addonAfter={t(
                                        "pages.meetings.attendance_confirmation_settings.minutes",
                                    )}
                                />
                            </div>

                            <div className="flex justify-end items-center gap-3 pt-3 border-t border-gray-50">
                                {hasChanges && (
                                    <Text type="warning" className="text-sm">
                                        {t(
                                            "pages.meetings.attendance_confirmation_settings.unsaved",
                                        )}
                                    </Text>
                                )}
                                <Space>
                                    <Button
                                        type="primary"
                                        icon={<SaveOutlined />}
                                        onClick={handleSave}
                                        loading={updateMutation.isPending}
                                        disabled={!hasChanges}
                                    >
                                        {t("app.save")}
                                    </Button>
                                </Space>
                            </div>
                        </>
                    )}
                </Card>
            </div>
        </PageLayout>
    );
}

MeetingAttendanceConfirmationSettings.layout = (page: React.ReactNode) => (
    <DashboardLayout>{page}</DashboardLayout>
);
