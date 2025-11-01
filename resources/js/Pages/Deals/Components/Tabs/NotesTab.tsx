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
import { Link, usePage } from "@inertiajs/react";
import dayjs from "dayjs";
import { Note } from "@/Types/api/note";
import { ColumnsType } from "antd/es/table";
import { useGenericEntityAction } from "@/Hooks/useGenericEntityAction";
import AddNote from "./notes/AddNote";
import EditNote from "./notes/EditNote";
import DeleteNote from "./notes/DeleteNote";

const { Paragraph } = Typography;

interface Props {
    deal: Deal;
    notes: Note[];
    permissions: Record<string, string>;
}

export default function NotesTab({ deal, notes, permissions }: Props) {
    const { props } = usePage();
    const user = props.auth.user;
    const {
        action,
        handleAction,
        handleClose,
        selected: note,
    } = useGenericEntityAction<Note>();

    const columns: ColumnsType<Note> = [
        {
            title: "Note Details",
            dataIndex: "details",
            key: "details",
            width: "50%",
            render: (_, record) => (
                <div className="max-w-md">
                    <Paragraph
                        onClick={() => handleAction("view")}
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
            render: (_, record) => {
                const canView =
                    permissions.view_deal_note === "all" ||
                    (permissions.view_deal_note === "added" &&
                        record.added_by === user?.id) ||
                    (permissions.view_deal_note === "both" &&
                        record.added_by === user?.id);

                const canEdit =
                    permissions.edit_deal_note === "all" ||
                    (permissions.edit_deal_note === "added" &&
                        record.added_by === user?.id);

                const canDelete =
                    permissions.delete_deal_note === "all" ||
                    (permissions.delete_deal_note === "added" &&
                        record.added_by === user?.id);

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
                                    No notes found
                                </p>
                                {(permissions.add_deal_note === "all" ||
                                    permissions.add_deal_note === "added" ||
                                    permissions.add_deal_note === "both") && (
                                    <Button
                                        type="primary"
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
            {/* Add Note Modal */}
            <AddNote
                open={action === "add"}
                onClose={() => handleClose()}
                deal={deal}
            />

            {/* Edit Note Modal */}
            {note && (
                <EditNote
                    open={action === "edit"}
                    onClose={() => handleClose()}
                    deal={deal}
                    note={note}
                />
            )}

            {/* Delete Note Modal */}
            <DeleteNote
                open={action === "delete"}
                onClose={() => handleClose()}
                note={note}
            />
        </>
    );
}
