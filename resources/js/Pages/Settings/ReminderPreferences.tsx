import React, { useState, useEffect } from "react";
import {
    Card,
    Form,
    InputNumber,
    Select,
    Button,
    Switch,
    Space,
    Typography,
    Table,
    Popconfirm,
    App,
    Tooltip,
    Alert,
    Divider,
    Skeleton,
} from "antd";
import {
    PlusOutlined,
    DeleteOutlined,
    SaveOutlined,
    UndoOutlined,
    BellOutlined,
    ClockCircleOutlined,
    InfoCircleOutlined,
} from "@ant-design/icons";
import DashboardLayout from "@/Components/DashboardLayout";
import PageLayout from "@/Components/PageLayout";
import useTranslation from "@/Hooks/useTranslation";
import { useApiMutate } from "@/lib/api/client/useApiMutate";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";

const { Title, Text, Paragraph } = Typography;
const { Option } = Select;

interface Reminder {
    time: number;
    type: "minute" | "hour" | "day";
}

interface PreferenceData {
    id?: number;
    reminders: Reminder[];
    is_active: boolean;
    is_custom: boolean;
}

interface PreferencesResponse {
    preferences: {
        meeting: PreferenceData;
        task: PreferenceData;
        all: PreferenceData;
    };
    defaults: Reminder[];
}

const DEFAULT_REMINDERS: Reminder[] = [
    { time: 1, type: "hour" },
    { time: 30, type: "minute" },
    { time: 15, type: "minute" },
    { time: 5, type: "minute" },
];

const REMINDER_TYPE_OPTIONS = [
    { value: "minute", label: "Minutes" },
    { value: "hour", label: "Hours" },
    { value: "day", label: "Days" },
];

export default function ReminderPreferences() {
    const { t } = useTranslation();
    const { message, modal } = App.useApp();
    const queryClient = useQueryClient();

    const [meetingReminders, setMeetingReminders] = useState<Reminder[]>([
        ...DEFAULT_REMINDERS,
    ]);
    const [isActive, setIsActive] = useState(true);
    const [hasChanges, setHasChanges] = useState(false);

    // Fetch current preferences
    const {
        data: preferencesData,
        isLoading,
        refetch,
    } = useQuery<PreferencesResponse>({
        queryKey: ["reminder-preferences"],
        queryFn: async () => {
            const response = await axios.get(
                route("reminder-preferences.index"),
            );
            return response.data;
        },
    });

    // Update mutation
    const updateMutation = useApiMutate<any, any, any>(
        route("reminder-preferences.update"),
        "POST",
    );

    // Reset mutation
    const resetMutation = useApiMutate<any, any, any>(
        route("reminder-preferences.reset", { entityType: "meeting" }),
        "DELETE",
    );

    // Initialize form with fetched data
    useEffect(() => {
        if (preferencesData?.preferences?.meeting) {
            setMeetingReminders(
                preferencesData.preferences.meeting.reminders ||
                    DEFAULT_REMINDERS,
            );
            setIsActive(
                preferencesData.preferences.meeting.is_active !== false,
            );
            setHasChanges(false);
        }
    }, [preferencesData]);

    const handleAddReminder = () => {
        if (meetingReminders.length >= 20) {
            message.warning("You can add up to 20 reminders.");
            return;
        }
        setMeetingReminders([
            ...meetingReminders,
            { time: 10, type: "minute" },
        ]);
        setHasChanges(true);
    };

    const handleRemoveReminder = (index: number) => {
        if (meetingReminders.length <= 1) {
            message.warning("At least one reminder is required.");
            return;
        }
        const newReminders = meetingReminders.filter((_, i) => i !== index);
        setMeetingReminders(newReminders);
        setHasChanges(true);
    };

    const handleReminderChange = (
        index: number,
        field: keyof Reminder,
        value: number | string,
    ) => {
        const newReminders = [...meetingReminders];
        newReminders[index] = { ...newReminders[index], [field]: value };
        setMeetingReminders(newReminders);
        setHasChanges(true);
    };

    const handleActiveChange = (checked: boolean) => {
        setIsActive(checked);
        setHasChanges(true);
    };

    const handleSave = () => {
        updateMutation.mutate(
            {
                entity_type: "meeting",
                reminders: meetingReminders,
                is_active: isActive,
            },
            {
                onSuccess: (response: any) => {
                    if (response?.status === "success") {
                        message.success(
                            "Reminder preferences saved successfully!",
                        );
                        setHasChanges(false);
                        queryClient.invalidateQueries({
                            queryKey: ["reminder-preferences"],
                        });
                    }
                },
                onError: (error: any) => {
                    message.error(
                        error?.message || "Failed to save preferences",
                    );
                },
            },
        );
    };

    const handleReset = () => {
        modal.confirm({
            title: "Reset to Defaults",
            icon: <InfoCircleOutlined />,
            content:
                "This will reset your reminder preferences to the default values. Continue?",
            okText: "Yes, Reset",
            cancelText: "Cancel",
            onOk: () => {
                resetMutation.mutate(
                    {},
                    {
                        onSuccess: (response: any) => {
                            if (response?.status === "success") {
                                setMeetingReminders(
                                    response.defaults || DEFAULT_REMINDERS,
                                );
                                setIsActive(true);
                                setHasChanges(false);
                                message.success(
                                    "Preferences reset to defaults!",
                                );
                                queryClient.invalidateQueries({
                                    queryKey: ["reminder-preferences"],
                                });
                            }
                        },
                        onError: (error: any) => {
                            message.error(
                                error?.message || "Failed to reset preferences",
                            );
                        },
                    },
                );
            },
        });
    };

    const formatReminderText = (reminder: Reminder): string => {
        const typeLabel =
            reminder.type === "minute"
                ? "minutes"
                : reminder.type === "hour"
                  ? "hours"
                  : "days";
        return `${reminder.time} ${typeLabel}`;
    };

    const columns = [
        {
            title: "Remind Before",
            dataIndex: "time",
            key: "time",
            width: 150,
            render: (_: any, record: Reminder, index: number) => (
                <InputNumber
                    min={0}
                    max={10080}
                    value={record.time}
                    onChange={(value) =>
                        handleReminderChange(index, "time", value || 0)
                    }
                    style={{ width: 100 }}
                    disabled={!isActive}
                />
            ),
        },
        {
            title: "Time Unit",
            dataIndex: "type",
            key: "type",
            width: 150,
            render: (_: any, record: Reminder, index: number) => (
                <Select
                    value={record.type}
                    onChange={(value) =>
                        handleReminderChange(index, "type", value)
                    }
                    style={{ width: 120 }}
                    disabled={!isActive}
                >
                    {REMINDER_TYPE_OPTIONS.map((opt) => (
                        <Option key={opt.value} value={opt.value}>
                            {opt.label}
                        </Option>
                    ))}
                </Select>
            ),
        },
        {
            title: "",
            key: "preview",
            render: (_: any, record: Reminder) => (
                <Text type="secondary" className="text-sm">
                    before meeting
                </Text>
            ),
        },
        {
            title: "Action",
            key: "action",
            width: 80,
            render: (_: any, __: Reminder, index: number) => (
                <Tooltip
                    title={
                        meetingReminders.length <= 1
                            ? "At least one reminder required"
                            : "Remove"
                    }
                >
                    <Button
                        type="text"
                        danger
                        icon={<DeleteOutlined />}
                        onClick={() => handleRemoveReminder(index)}
                        disabled={meetingReminders.length <= 1 || !isActive}
                    />
                </Tooltip>
            ),
        },
    ];

    const breadcrumbs = [
        { name: t("app.menu.settings"), url: route("profile-settings.index") },
        { name: t("app.settings.reminder_preferences") },
    ];

    return (
        <DashboardLayout>
            <PageLayout
                title={t("app.settings.reminder_preferences")}
                breadcrumbs={breadcrumbs}
                config={{ showTitle: true }}
            >
                <div className="max-w-4xl mx-auto">
                    {/* Header Card */}
                    <Card className="mb-6">
                        <div className="flex items-start gap-4">
                            <div className="p-3 bg-blue-50 rounded-lg">
                                <BellOutlined className="text-2xl text-blue-500" />
                            </div>
                            <div className="flex-1">
                                <Title level={4} className="mb-1">
                                    Reminder Preferences
                                </Title>
                                <Paragraph type="secondary" className="mb-0">
                                    Configure when you want to receive reminders
                                    before meetings and events. These settings
                                    will apply to all your upcoming meetings
                                    unless a specific meeting has custom
                                    reminders set.
                                </Paragraph>
                            </div>
                        </div>
                    </Card>

                    {/* Meeting Reminders Card */}
                    <Card
                        title={
                            <div className="flex items-center gap-2">
                                <ClockCircleOutlined />
                                <span>Meeting Reminders</span>
                            </div>
                        }
                        extra={
                            <Space>
                                <Text type="secondary">Enable reminders</Text>
                                <Switch
                                    checked={isActive}
                                    onChange={handleActiveChange}
                                    loading={isLoading}
                                />
                            </Space>
                        }
                    >
                        {isLoading ? (
                            <Skeleton active paragraph={{ rows: 4 }} />
                        ) : (
                            <>
                                {!isActive && (
                                    <Alert
                                        message="Reminders are disabled"
                                        description="Enable reminders to receive notifications before your meetings."
                                        type="warning"
                                        showIcon
                                        className="mb-4"
                                    />
                                )}

                                <Table
                                    dataSource={meetingReminders.map(
                                        (r, i) => ({ ...r, key: i }),
                                    )}
                                    columns={columns}
                                    pagination={false}
                                    size="middle"
                                    className="mb-4"
                                />

                                <Button
                                    type="dashed"
                                    onClick={handleAddReminder}
                                    icon={<PlusOutlined />}
                                    disabled={
                                        meetingReminders.length >= 20 ||
                                        !isActive
                                    }
                                    block
                                >
                                    Add Reminder
                                </Button>

                                <Divider />

                                <div className="flex justify-between items-center">
                                    <Button
                                        icon={<UndoOutlined />}
                                        onClick={handleReset}
                                        loading={resetMutation.isPending}
                                    >
                                        Reset to Defaults
                                    </Button>
                                    <Space>
                                        {hasChanges && (
                                            <Text
                                                type="warning"
                                                className="text-sm"
                                            >
                                                You have unsaved changes
                                            </Text>
                                        )}
                                        <Button
                                            type="primary"
                                            icon={<SaveOutlined />}
                                            onClick={handleSave}
                                            loading={updateMutation.isPending}
                                            disabled={!hasChanges}
                                        >
                                            Save Changes
                                        </Button>
                                    </Space>
                                </div>
                            </>
                        )}
                    </Card>

                    {/* Default Reminders Info */}
                    <Card className="mt-6 bg-gray-50" size="small">
                        <div className="flex items-start gap-3">
                            <InfoCircleOutlined className="text-blue-500 mt-1" />
                            <div>
                                <Text strong>Default Reminders</Text>
                                <Paragraph
                                    type="secondary"
                                    className="mb-0 text-sm"
                                >
                                    If no custom reminders are set, you will
                                    receive reminders at:{" "}
                                    <Text code>1 hour</Text>,{" "}
                                    <Text code>30 minutes</Text>,{" "}
                                    <Text code>15 minutes</Text>, and{" "}
                                    <Text code>5 minutes</Text> before the
                                    meeting.
                                </Paragraph>
                            </div>
                        </div>
                    </Card>
                </div>
            </PageLayout>
        </DashboardLayout>
    );
}
