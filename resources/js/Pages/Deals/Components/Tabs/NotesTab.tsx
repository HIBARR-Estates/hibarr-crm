import { Deal } from "@/Types/api/deals";
import {
    Table,
    Button,
    Dropdown,
    MenuProps,
    Avatar,
    Tooltip,
    Empty,
} from "antd";
import {
    MoreOutlined,
    EyeOutlined,
    EditOutlined,
    DeleteOutlined,
} from "@ant-design/icons";
import { usePage } from "@inertiajs/react";
import dayjs from "dayjs";
import { Note } from "@/Types/api/note";
import { ColumnsType } from "antd/es/table";
import { useGenericEntityAction } from "@/Hooks/useGenericEntityAction";
import { ContentRenderer } from "@/Components/ContentRenderer";
import AddNote from "./notes/AddNote";
import EditNote from "./notes/EditNote";
import DeleteNote from "./notes/DeleteNote";
import ViewNote from "./notes/ViewNote";
import BulkDealNoteActionSelector from "./notes/bulk/BulkDealNoteActionSelector";
import useGenericTableRowSelection from "@/Hooks/useGenericTableRowSelection";

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
    console.log("notes ....", notes);

    const columns: ColumnsType<Note> = [
        {
            title: "Title",
            dataIndex: "title",
            key: "title",
            width: "25%",
            render: (text: string, record) => {
                const truncatedTitle =
                    text && text.length > 50
                        ? text.substring(0, 50) + "..."
                        : text;

                return (
                    <Tooltip title={text.length > 50 ? text : undefined}>
                        <span
                            className="cursor-pointer hover:text-blue-600 font-medium"
                            onClick={() => handleAction("view", record)}
                        >
                            {truncatedTitle}
                        </span>
                    </Tooltip>
                );
            },
        },
        {
            title: "Details",
            dataIndex: "details",
            key: "details",
            width: "50%",
            render: (_, record) => (
                <div className="max-w-md">
                    <ContentRenderer
                        content={record.details}
                        maxLength={200}
                        showFullContent={false}
                        onClick={() => handleAction("view", record)}
                        className="text-sm"
                    />
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
                                      <span>
                                          <EyeOutlined className="mr-2" />
                                          View
                                      </span>
                                  ),
                                  onClick: () => handleAction("view", record),
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
                                      <span className="">
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

    // Table row selection
    const { selectedEntities, rowSelection, clearSelected } =
        useGenericTableRowSelection<Note>();

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
                <div className="p-6 flex flex-col gap-y-4">
                    <div className="flex justify-end">
                        {selectedEntities.length > 0 && (
                            <BulkDealNoteActionSelector
                                selectedEntityIds={selectedEntities.map(
                                    (e) => e.id
                                )}
                                clearSelected={() => clearSelected()}
                            />
                        )}
                    </div>

                    <Table
                        columns={columns}
                        dataSource={notes}
                        rowKey="id"
                        pagination={{
                            pageSize: 10,
                            showSizeChanger: true,
                            showQuickJumper: false,
                            showTotal: (total) => `Total ${total} notes`,
                        }}
                        className="notes-table"
                        size="small"
                        rowSelection={rowSelection}
                    />
                </div>
            )}
            {/* Add Note Modal */}
            <AddNote
                open={action === "add"}
                onClose={() => handleClose()}
                deal={deal}
            />

            {/* View Note Modal */}
            {note && (
                <ViewNote
                    open={action === "view"}
                    onClose={() => handleClose()}
                    deal={deal}
                    note={note}
                    onEdit={() => handleAction("edit", note)}
                />
            )}

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
