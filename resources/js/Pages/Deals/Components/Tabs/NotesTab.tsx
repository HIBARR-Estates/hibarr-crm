import { Deal } from "@/Types/api/deals";
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
} from "@ant-design/icons";
import { Link } from "@inertiajs/react";
import dayjs from "dayjs";

const { Paragraph } = Typography;

interface Props {
    deal: Deal;
    notes: any[];
    permissions: Record<string, string>;
}

export default function NotesTab({ deal, notes, permissions }: Props) {
    const handleDeleteNote = (noteId: number) => {
        if (confirm("Are you sure you want to delete this note?")) {
            // Handle deletion
            window.location.href = route("deal-notes.destroy", noteId);
        }
    };

    const columns = [
        {
            title: "Note Details",
            dataIndex: "details",
            key: "details",
            width: "50%",
            render: (details: string, record: any) => (
                <div className="max-w-md">
                    <Link
                        href={route("deal-notes.show", record.id)}
                        className="text-gray-900 hover:text-blue-600"
                    >
                        <Paragraph
                            ellipsis={{
                                rows: 3,
                                expandable: false,
                            }}
                            className="mb-0 text-sm"
                        >
                            {details}
                        </Paragraph>
                    </Link>
                </div>
            ),
        },
        {
            title: "Created By",
            dataIndex: "added_by",
            key: "added_by",
            width: "25%",
            render: (addedBy: any) => (
                <div className="flex items-center space-x-2">
                    <Avatar
                        size="small"
                        src={addedBy?.image}
                        icon={<UserOutlined />}
                    />
                    <span className="text-sm">
                        {addedBy?.name || "Unknown"}
                    </span>
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
            width: "5%",
            render: (_, record: any) => {
                const canView =
                    permissions.view_deal_note === "all" ||
                    (permissions.view_deal_note === "added" &&
                        record.added_by?.id === window.user?.id) ||
                    (permissions.view_deal_note === "both" &&
                        record.added_by?.id === window.user?.id);

                const canEdit =
                    permissions.edit_deal_note === "all" ||
                    (permissions.edit_deal_note === "added" &&
                        record.added_by?.id === window.user?.id);

                const canDelete =
                    permissions.delete_deal_note === "all" ||
                    (permissions.delete_deal_note === "added" &&
                        record.added_by?.id === window.user?.id);

                const menuItems: MenuProps["items"] = [
                    ...(canView
                        ? [
                              {
                                  key: "view",
                                  label: (
                                      <Link
                                          href={route(
                                              "deal-notes.show",
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
                                      <Link
                                          href={route(
                                              "deal-notes.edit",
                                              record.id
                                          )}
                                      >
                                          <EditOutlined className="mr-2" />
                                          Edit
                                      </Link>
                                  ),
                              },
                          ]
                        : []),
                    ...(canDelete
                        ? [
                              {
                                  key: "delete",
                                  label: (
                                      <span
                                          className="text-red-600"
                                          onClick={() =>
                                              handleDeleteNote(record.id)
                                          }
                                      >
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

    if (notes.length === 0) {
        return (
            <div className="p-8">
                <Empty
                    description={
                        <div className="text-center">
                            <p className="text-gray-500 mb-2">No notes found</p>
                            {(permissions.add_deal_note === "all" ||
                                permissions.add_deal_note === "added" ||
                                permissions.add_deal_note === "both") && (
                                <Button
                                    type="primary"
                                    onClick={() => {
                                        window.location.href = route(
                                            "deal-notes.create",
                                            { lead: deal.id }
                                        );
                                    }}
                                >
                                    Create First Note
                                </Button>
                            )}
                        </div>
                    }
                />
            </div>
        );
    }

    return (
        <div className="p-6">
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
    );
}
