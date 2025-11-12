import React from "react";
import { Lead } from "@/Types/api/leads";
import { LeadNote } from "@/Types/api/lead-note";
import { Link, usePage } from "@inertiajs/react";
import {
    Table,
    Button,
    Dropdown,
    MenuProps,
    Typography,
    Avatar,
    Tooltip,
    Empty,
} from "antd";
import {
    MoreOutlined,
    UserOutlined,
    EyeOutlined,
    EditOutlined,
    DeleteOutlined,
    PlusOutlined,
} from "@ant-design/icons";
import { ColumnsType } from "antd/es/table";
import { useGenericEntityAction } from "@/Hooks/useGenericEntityAction";
import dayjs from "dayjs";

const { Paragraph } = Typography;

interface Props {
    lead: Lead;
    notes: LeadNote[];
    permissions: Record<string, string>;
}

export default function LeadNotesTab({ lead, notes, permissions }: Props) {
    const { props } = usePage();
    const user = props.auth.user;
    const {
        action,
        handleAction,
        handleClose,
        selected: note,
    } = useGenericEntityAction<LeadNote>();

    const columns: ColumnsType<LeadNote> = [
        {
            title: "Note Details",
            dataIndex: "details",
            key: "details",
            width: "50%",
            render: (_, record) => (
                <div className="max-w-md">
                    <Paragraph
                        ellipsis={{
                            rows: 3,
                            expandable: false,
                        }}
                        className="mb-0 text-sm"
                    >
                        {record.details}
                    </Paragraph>
                </div>
            ),
        },
        {
            title: "Title",
            dataIndex: "title",
            key: "title",
            width: "25%",
            render: (title: string, record) => (
                <div className="space-y-1">
                    <span className="font-medium text-gray-900">{title}</span>
                    <div className="flex items-center space-x-2 text-xs text-gray-500">
                        <Avatar
                            size="small"
                            src={record.added_by_user?.image_url}
                            icon={<UserOutlined />}
                        />
                        <span>Added by {record.added_by_user?.name || "Unknown"}</span>
                    </div>
                </div>
            ),
        },
        {
            title: "Created On",
            dataIndex: "created_at",
            key: "created_at",
            width: "20%",
            render: (date: string) => (
                <Tooltip
                    title={dayjs(date).format("MMMM DD, YYYY [at] h:mm A")}
                >
                    <span className="text-sm text-gray-600">
                        {dayjs(date).format("MMM DD, YYYY")}
                    </span>
                </Tooltip>
            ),
        },
        {
            title: "Actions",
            key: "actions",
            width: "10%",
            render: (_, record) => {
                const canView =
                    permissions.view_lead_note === "all" ||
                    (permissions.view_lead_note === "added" &&
                        record.added_by === user?.id) ||
                    (permissions.view_lead_note === "both" &&
                        record.added_by === user?.id);

                const canEdit =
                    permissions.edit_lead_note === "all" ||
                    (permissions.edit_lead_note === "added" &&
                        record.added_by === user?.id);

                const canDelete =
                    permissions.delete_lead_note === "all" ||
                    (permissions.delete_lead_note === "added" &&
                        record.added_by === user?.id);

                const menuItems: MenuProps["items"] = [
                    ...(canView
                        ? [
                              {
                                  key: "view",
                                  label: (
                                      <Link
                                          href={route(
                                              "lead-notes.show",
                                              record.id
                                          )}
                                      >
                                          <EyeOutlined className="mr-2" />
                                          View
                                      </Link>
                                  ),
                              },
                          ]
                        : []),
                    ...(canEdit
                        ? [
                              {
                                  key: "edit",
                                  label: (
                                      <span>
                                          <EditOutlined className="mr-2" />
                                          Edit
                                      </span>
                                  ),
                                  onClick: () => handleAction("edit", record),
                              },
                          ]
                        : []),
                    ...(canDelete
                        ? [
                              {
                                  key: "delete",
                                  onClick: () => handleAction("delete", record),
                                  label: (
                                      <span className="text-red-600">
                                          <DeleteOutlined className="mr-2" />
                                          Delete
                                      </span>
                                  ),
                                  danger: true,
                              },
                          ]
                        : []),
                ];

                return menuItems.length > 0 ? (
                    <Dropdown menu={{ items: menuItems }} trigger={["click"]}>
                        <Button
                            type="text"
                            icon={<MoreOutlined />}
                            size="small"
                        />
                    </Dropdown>
                ) : null;
            },
        },
    ];

    return (
        <>
            {notes.length === 0 && (
                <div className="p-8">
                    <Empty
                        description={
                            <div className="text-center">
                                <p className="text-gray-500 mb-2">
                                    No notes found for this lead
                                </p>
                                {(permissions.add_lead_note === "all" ||
                                    permissions.add_lead_note === "added" ||
                                    permissions.add_lead_note === "both") && (
                                    <Button
                                        type="primary"
                                        icon={<PlusOutlined />}
                                        onClick={() => handleAction("add")}
                                    >
                                        Create First Note
                                    </Button>
                                )}
                            </div>
                        }
                    />
                </div>
            )}
            
            {notes.length > 0 && (
                <div className="p-6">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-lg font-medium text-gray-900">
                            Notes ({notes.length})
                        </h3>
                        {(permissions.add_lead_note === "all" ||
                            permissions.add_lead_note === "added" ||
                            permissions.add_lead_note === "both") && (
                            <Button
                                type="primary"
                                icon={<PlusOutlined />}
                                onClick={() => handleAction("add")}
                            >
                                Add Note
                            </Button>
                        )}
                    </div>

                    <Table
                        columns={columns}
                        dataSource={notes}
                        rowKey="id"
                        pagination={{
                            pageSize: 10,
                            showSizeChanger: true,
                            showQuickJumper: true,
                            showTotal: (total) => `Total ${total} notes`,
                        }}
                        className="notes-table"
                    />
                </div>
            )}

            {/* Add Note Modal - You would need to implement this */}
            {/* <AddLeadNote
                open={action === "add"}
                onClose={() => handleClose()}
                lead={lead}
            /> */}

            {/* Edit Note Modal - You would need to implement this */}
            {/* {note && (
                <EditLeadNote
                    open={action === "edit"}
                    onClose={() => handleClose()}
                    lead={lead}
                    note={note}
                />
            )} */}

            {/* Delete Note Modal - You would need to implement this */}
            {/* <DeleteLeadNote
                open={action === "delete"}
                onClose={() => handleClose()}
                note={note}
            /> */}
        </>
    );
}