import React, { useEffect, useMemo, useState } from "react";
import { Deferred, usePage } from "@inertiajs/react";
import {
    Alert,
    App,
    Button,
    Card,
    Form,
    Input,
    Modal,
    Popconfirm,
    Select,
    Skeleton,
    Space,
    Switch,
    Table,
    Tag,
    Typography,
} from "antd";
import {
    CalendarOutlined,
    CopyOutlined,
    DeleteOutlined,
    EditOutlined,
    PlusOutlined,
} from "@ant-design/icons";
import DashboardLayout from "@/Components/DashboardLayout";
import PageLayout from "@/Components/PageLayout";
import useTranslation from "@/Hooks/useTranslation";
import useCopyToClipboard from "@/Hooks/useCopyToClipboard";
import useCalendlyLinkMutations, {
    calendlyErrorMessage,
    type CalendlyLinkInput,
    type CalendlyLinkSetting,
    type CalendlyWebhookSetting,
} from "./hooks/useCalendlyLinkMutations";

const { Title, Text, Paragraph } = Typography;

interface ConfigData {
    links: CalendlyLinkSetting[];
    roles: Array<{ id: number; name: string }>;
    meeting_types: Array<{ id: number; name: string }>;
    webhook: CalendlyWebhookSetting;
}

interface LinkFormValues {
    name: string;
    description?: string;
    url: string;
    meeting_type_id?: number | null;
    role_ids: number[];
    is_active: boolean;
}

const CALENDLY_URL = /^https:\/\/([a-z0-9-]+\.)*calendly\.com(\/|\?|#|$)/i;

export default function CalendlyMeetingLinks({
    pageTitle,
}: {
    pageTitle: string;
}) {
    const { t } = useTranslation();
    const { message } = App.useApp();
    const config = (usePage().props as { config?: ConfigData }).config;
    const mutations = useCalendlyLinkMutations();
    const { copy, copied } = useCopyToClipboard();

    // The page's own copy of what the server sent: edits patch it directly
    // rather than reloading the page.
    const [links, setLinks] = useState<CalendlyLinkSetting[]>([]);
    const [webhook, setWebhook] = useState<CalendlyWebhookSetting | null>(null);
    const [signingKey, setSigningKey] = useState("");
    const [editing, setEditing] = useState<CalendlyLinkSetting | "new" | null>(
        null,
    );

    useEffect(() => {
        if (config) {
            setLinks(config.links);
            setWebhook(config.webhook);
        }
    }, [config]);

    const roleNames = useMemo(
        () => new Map((config?.roles ?? []).map((role) => [role.id, role.name])),
        [config?.roles],
    );
    const typeNames = useMemo(
        () =>
            new Map(
                (config?.meeting_types ?? []).map((type) => [type.id, type.name]),
            ),
        [config?.meeting_types],
    );

    const openEditor = (target: CalendlyLinkSetting | "new") => setEditing(target);

    const handleSaveLink = async (values: LinkFormValues) => {
        const input: CalendlyLinkInput = {
            name: values.name.trim(),
            description: values.description?.trim() || null,
            url: values.url.trim(),
            meeting_type_id: values.meeting_type_id ?? null,
            role_ids: values.role_ids ?? [],
            is_active: values.is_active,
        };

        try {
            if (editing && editing !== "new") {
                const saved = await mutations.updateLink(editing.id, input);
                setLinks((current) =>
                    current.map((link) => (link.id === saved.id ? saved : link)),
                );
            } else {
                const saved = await mutations.createLink(input);
                setLinks((current) => [...current, saved]);
            }
            message.success(t("pages.meetings.calendly_settings.saved"));
            setEditing(null);
        } catch (error) {
            message.error(
                calendlyErrorMessage(
                    error,
                    t("pages.meetings.calendly_settings.save_failed"),
                ),
            );
        }
    };

    const handleDeleteLink = async (link: CalendlyLinkSetting) => {
        try {
            await mutations.deleteLink(link.id);
            setLinks((current) => current.filter((item) => item.id !== link.id));
            message.success(t("pages.meetings.calendly_settings.deleted"));
        } catch (error) {
            message.error(
                calendlyErrorMessage(
                    error,
                    t("pages.meetings.calendly_settings.save_failed"),
                ),
            );
        }
    };

    const handleSaveKey = async () => {
        try {
            setWebhook(await mutations.saveSigningKey(signingKey));
            setSigningKey("");
            message.success(t("pages.meetings.calendly_settings.saved"));
        } catch (error) {
            message.error(
                calendlyErrorMessage(
                    error,
                    t("pages.meetings.calendly_settings.save_failed"),
                ),
            );
        }
    };

    const handleRotate = async () => {
        try {
            setWebhook(await mutations.rotateWebhookAddress());
            message.success(t("pages.meetings.calendly_settings.saved"));
        } catch (error) {
            message.error(
                calendlyErrorMessage(
                    error,
                    t("pages.meetings.calendly_settings.save_failed"),
                ),
            );
        }
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
            <div className="max-w-4xl mx-auto">
                <Card className="mb-6">
                    <div className="flex items-start gap-4">
                        <div className="p-3 bg-amber-50 rounded-lg">
                            <CalendarOutlined className="text-2xl text-amber-500" />
                        </div>
                        <div className="flex-1">
                            <Title level={4} className="mb-1">
                                {t("pages.meetings.calendly_settings.title")}
                            </Title>
                            <Paragraph type="secondary" className="mb-0">
                                {t(
                                    "pages.meetings.calendly_settings.description",
                                )}
                            </Paragraph>
                        </div>
                    </div>
                </Card>

                <Deferred
                    data="config"
                    fallback={
                        <Card>
                            <Skeleton active paragraph={{ rows: 5 }} />
                        </Card>
                    }
                >
                    <>
                        <Card
                            className="mb-6"
                            title={t(
                                "pages.meetings.calendly_settings.links_title",
                            )}
                            extra={
                                <Button
                                    type="primary"
                                    icon={<PlusOutlined />}
                                    onClick={() => openEditor("new")}
                                >
                                    {t(
                                        "pages.meetings.calendly_settings.add_link",
                                    )}
                                </Button>
                            }
                        >
                            <Table<CalendlyLinkSetting>
                                rowKey="id"
                                dataSource={links}
                                pagination={false}
                                locale={{
                                    emptyText: t(
                                        "pages.meetings.calendly_settings.empty",
                                    ),
                                }}
                                columns={[
                                    {
                                        title: t(
                                            "pages.meetings.calendly_settings.col_name",
                                        ),
                                        dataIndex: "name",
                                        render: (name: string, link) => (
                                            <div>
                                                <Text strong>{name}</Text>
                                                {link.description && (
                                                    <div>
                                                        <Text
                                                            type="secondary"
                                                            className="text-xs"
                                                        >
                                                            {link.description}
                                                        </Text>
                                                    </div>
                                                )}
                                            </div>
                                        ),
                                    },
                                    {
                                        title: t(
                                            "pages.meetings.calendly_settings.col_meeting_type",
                                        ),
                                        dataIndex: "meeting_type_id",
                                        render: (id: number | null) =>
                                            id ? (typeNames.get(id) ?? "—") : "—",
                                    },
                                    {
                                        title: t(
                                            "pages.meetings.calendly_settings.col_visible_to",
                                        ),
                                        dataIndex: "role_ids",
                                        render: (ids: number[]) =>
                                            ids.length === 0 ? (
                                                <Tag>
                                                    {t(
                                                        "pages.meetings.calendly_settings.everyone",
                                                    )}
                                                </Tag>
                                            ) : (
                                                <Space size={[4, 4]} wrap>
                                                    {ids.map((id) => (
                                                        <Tag key={id}>
                                                            {roleNames.get(id) ??
                                                                id}
                                                        </Tag>
                                                    ))}
                                                </Space>
                                            ),
                                    },
                                    {
                                        title: t(
                                            "pages.meetings.calendly_settings.col_status",
                                        ),
                                        dataIndex: "is_active",
                                        render: (active: boolean) => (
                                            <Tag
                                                color={
                                                    active ? "green" : "default"
                                                }
                                            >
                                                {active
                                                    ? t(
                                                          "pages.meetings.calendly_settings.status_active",
                                                      )
                                                    : t(
                                                          "pages.meetings.calendly_settings.status_hidden",
                                                      )}
                                            </Tag>
                                        ),
                                    },
                                    {
                                        key: "actions",
                                        align: "right" as const,
                                        render: (_: unknown, link) => (
                                            <Space>
                                                <Button
                                                    type="text"
                                                    icon={<EditOutlined />}
                                                    aria-label={t(
                                                        "pages.meetings.calendly_settings.edit_link",
                                                    )}
                                                    onClick={() =>
                                                        openEditor(link)
                                                    }
                                                />
                                                <Popconfirm
                                                    title={t(
                                                        "pages.meetings.calendly_settings.delete_confirm",
                                                    )}
                                                    okButtonProps={{
                                                        danger: true,
                                                    }}
                                                    onConfirm={() =>
                                                        handleDeleteLink(link)
                                                    }
                                                >
                                                    <Button
                                                        type="text"
                                                        danger
                                                        icon={
                                                            <DeleteOutlined />
                                                        }
                                                        aria-label={t(
                                                            "pages.meetings.calendly_settings.delete",
                                                        )}
                                                    />
                                                </Popconfirm>
                                            </Space>
                                        ),
                                    },
                                ]}
                            />
                        </Card>

                        <Card
                            title={t(
                                "pages.meetings.calendly_settings.bookings_title",
                            )}
                        >
                            <Paragraph type="secondary">
                                {t(
                                    "pages.meetings.calendly_settings.bookings_description",
                                )}
                            </Paragraph>

                            {webhook && (
                                <>
                                    <Alert
                                        className="mb-4"
                                        type={
                                            webhook.has_signing_key
                                                ? webhook.last_received_at
                                                    ? "success"
                                                    : "info"
                                                : "warning"
                                        }
                                        showIcon
                                        message={
                                            !webhook.has_signing_key
                                                ? t(
                                                      "pages.meetings.calendly_settings.status_no_key",
                                                  )
                                                : webhook.last_received_at
                                                  ? t(
                                                        "pages.meetings.calendly_settings.status_receiving",
                                                        {
                                                            when: new Date(
                                                                webhook.last_received_at,
                                                            ).toLocaleString(),
                                                        },
                                                    )
                                                  : t(
                                                        "pages.meetings.calendly_settings.status_waiting",
                                                    )
                                        }
                                    />

                                    <div className="mb-5">
                                        <Text strong>
                                            {t(
                                                "pages.meetings.calendly_settings.address_label",
                                            )}
                                        </Text>
                                        <Paragraph
                                            type="secondary"
                                            className="text-sm mb-2"
                                        >
                                            {t(
                                                "pages.meetings.calendly_settings.address_help",
                                            )}
                                        </Paragraph>
                                        <Space.Compact className="w-full">
                                            <Input readOnly value={webhook.url} />
                                            <Button
                                                icon={<CopyOutlined />}
                                                onClick={() =>
                                                    void copy(webhook.url)
                                                }
                                            >
                                                {copied
                                                    ? t(
                                                          "pages.meetings.calendly_settings.copied",
                                                      )
                                                    : t(
                                                          "pages.meetings.calendly_settings.copy",
                                                      )}
                                            </Button>
                                        </Space.Compact>
                                        <Popconfirm
                                            title={t(
                                                "pages.meetings.calendly_settings.rotate_confirm",
                                            )}
                                            onConfirm={handleRotate}
                                        >
                                            <Button
                                                type="link"
                                                className="px-0"
                                                loading={mutations.saving}
                                            >
                                                {t(
                                                    "pages.meetings.calendly_settings.rotate",
                                                )}
                                            </Button>
                                        </Popconfirm>
                                    </div>

                                    <div>
                                        <Text strong>
                                            {t(
                                                "pages.meetings.calendly_settings.key_label",
                                            )}
                                        </Text>
                                        <Paragraph
                                            type="secondary"
                                            className="text-sm mb-2"
                                        >
                                            {t(
                                                "pages.meetings.calendly_settings.key_help",
                                            )}
                                        </Paragraph>
                                        <Space.Compact className="w-full">
                                            <Input.Password
                                                value={signingKey}
                                                onChange={(event) =>
                                                    setSigningKey(
                                                        event.target.value,
                                                    )
                                                }
                                                placeholder={
                                                    webhook.has_signing_key
                                                        ? t(
                                                              "pages.meetings.calendly_settings.key_saved_placeholder",
                                                          )
                                                        : t(
                                                              "pages.meetings.calendly_settings.key_placeholder",
                                                          )
                                                }
                                                autoComplete="off"
                                            />
                                            <Button
                                                type="primary"
                                                onClick={handleSaveKey}
                                                loading={mutations.saving}
                                                disabled={
                                                    signingKey.trim() === ""
                                                }
                                            >
                                                {t("app.save")}
                                            </Button>
                                        </Space.Compact>
                                    </div>
                                </>
                            )}
                        </Card>
                    </>
                </Deferred>
            </div>

            {editing !== null && (
                <LinkEditorModal
                    // Mounted fresh for every open, with its own form, so one
                    // dialog's values can never carry over into the next.
                    key={editing === "new" ? "new" : editing.id}
                    link={editing === "new" ? null : editing}
                    roles={config?.roles ?? []}
                    meetingTypes={config?.meeting_types ?? []}
                    saving={mutations.saving}
                    onSave={handleSaveLink}
                    onClose={() => setEditing(null)}
                />
            )}
        </PageLayout>
    );
}

interface LinkEditorModalProps {
    /** The link being edited, or null when adding a new one. */
    link: CalendlyLinkSetting | null;
    roles: Array<{ id: number; name: string }>;
    meetingTypes: Array<{ id: number; name: string }>;
    saving: boolean;
    onSave: (values: LinkFormValues) => void | Promise<void>;
    onClose: () => void;
}

function LinkEditorModal({
    link,
    roles,
    meetingTypes,
    saving,
    onSave,
    onClose,
}: LinkEditorModalProps) {
    const { t } = useTranslation();
    const [form] = Form.useForm<LinkFormValues>();

    const initialValues: Partial<LinkFormValues> = link
        ? {
              name: link.name,
              description: link.description ?? undefined,
              url: link.url,
              meeting_type_id: link.meeting_type_id,
              role_ids: link.role_ids,
              is_active: link.is_active,
          }
        : { role_ids: [], is_active: true };

    const submit = async () => {
        try {
            await onSave(await form.validateFields());
        } catch {
            // Validation failures are shown on the fields themselves.
        }
    };

    return (
            <Modal
                open
                title={
                    link === null
                        ? t("pages.meetings.calendly_settings.add_link")
                        : t("pages.meetings.calendly_settings.edit_link")
                }
                okText={t("app.save")}
                cancelText={t("app.cancel")}
                confirmLoading={saving}
                onOk={submit}
                onCancel={onClose}
            >
                <Form
                    form={form}
                    layout="vertical"
                    requiredMark={false}
                    initialValues={initialValues}
                >
                    <Form.Item
                        name="name"
                        label={t("pages.meetings.calendly_settings.name_label")}
                        extra={t("pages.meetings.calendly_settings.name_help")}
                        rules={[
                            {
                                required: true,
                                whitespace: true,
                                message: t(
                                    "pages.meetings.calendly_settings.name_required",
                                ),
                            },
                        ]}
                    >
                        <Input maxLength={120} />
                    </Form.Item>
                    <Form.Item
                        name="url"
                        label={t("pages.meetings.calendly_settings.url_label")}
                        extra={t("pages.meetings.calendly_settings.url_help")}
                        rules={[
                            {
                                required: true,
                                whitespace: true,
                                message: t(
                                    "pages.meetings.calendly_settings.url_required",
                                ),
                            },
                            {
                                validator: (_, value?: string) =>
                                    !value || CALENDLY_URL.test(value.trim())
                                        ? Promise.resolve()
                                        : Promise.reject(
                                              new Error(
                                                  t(
                                                      "pages.meetings.calendly_settings.url_invalid",
                                                  ),
                                              ),
                                          ),
                            },
                        ]}
                    >
                        <Input
                            maxLength={500}
                            placeholder="https://calendly.com/your-team/intro-call"
                        />
                    </Form.Item>
                    <Form.Item
                        name="description"
                        label={t(
                            "pages.meetings.calendly_settings.description_label",
                        )}
                        extra={t(
                            "pages.meetings.calendly_settings.description_help",
                        )}
                    >
                        <Input maxLength={255} />
                    </Form.Item>
                    <Form.Item
                        name="meeting_type_id"
                        label={t(
                            "pages.meetings.calendly_settings.meeting_type_label",
                        )}
                        extra={t(
                            "pages.meetings.calendly_settings.meeting_type_help",
                        )}
                    >
                        <Select
                            allowClear
                            placeholder={t(
                                "pages.meetings.calendly_settings.meeting_type_none",
                            )}
                            options={(meetingTypes).map(
                                (type) => ({
                                    value: type.id,
                                    label: type.name,
                                }),
                            )}
                        />
                    </Form.Item>
                    <Form.Item
                        name="role_ids"
                        label={t("pages.meetings.calendly_settings.roles_label")}
                        extra={t("pages.meetings.calendly_settings.roles_help")}
                    >
                        <Select
                            mode="multiple"
                            allowClear
                            placeholder={t(
                                "pages.meetings.calendly_settings.everyone",
                            )}
                            optionFilterProp="label"
                            options={(roles).map((role) => ({
                                value: role.id,
                                label: role.name,
                            }))}
                        />
                    </Form.Item>
                    <Form.Item
                        name="is_active"
                        label={t(
                            "pages.meetings.calendly_settings.active_label",
                        )}
                        extra={t("pages.meetings.calendly_settings.active_help")}
                        valuePropName="checked"
                    >
                        <Switch />
                    </Form.Item>
                </Form>
            </Modal>
    );
}

CalendlyMeetingLinks.layout = (page: React.ReactNode) => (
    <DashboardLayout>{page}</DashboardLayout>
);
