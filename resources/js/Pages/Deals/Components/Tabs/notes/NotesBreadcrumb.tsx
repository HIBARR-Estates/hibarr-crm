import React from "react";
import { Breadcrumb } from "antd";
import {
    HomeOutlined,
    FileTextOutlined,
    PlusOutlined,
    EditOutlined,
    EyeOutlined,
} from "@ant-design/icons";

export type NotesView = "list" | "add" | "edit" | "view";

interface NotesBreadcrumbProps {
    currentView: NotesView;
    noteTitle?: string;
    onNavigate: (view: NotesView) => void;
}

export const NotesBreadcrumb: React.FC<NotesBreadcrumbProps> = ({
    currentView,
    noteTitle,
    onNavigate,
}) => {
    const breadcrumbItems = [
        {
            title: (
                <span
                    className="flex items-center cursor-pointer hover:text-blue-600 transition-colors"
                    onClick={() => onNavigate("list")}
                >
                    {/* <FileTextOutlined className="mr-1" /> */}
                    Notes
                </span>
            ),
        },
    ];

    switch (currentView) {
        case "add":
            breadcrumbItems.push({
                title: (
                    <span className="flex items-center text-blue-600">
                        {/* <PlusOutlined className="mr-1" /> */}
                        New
                    </span>
                ),
            });
            break;
        case "edit":
            breadcrumbItems.push(
                ...[
                    {
                        title: (
                            <span
                                className="flex items-center cursor-pointer hover:text-blue-600 transition-colors"
                                onClick={() => onNavigate("view")}
                            >
                                {noteTitle || "Note"}
                            </span>
                        ),
                    },
                    {
                        title: (
                            <span className="flex items-center text-blue-600">
                                {/* <EditOutlined className="mr-1" /> */}
                                Edit
                            </span>
                        ),
                    },
                ]
            );
            break;
        case "view":
            breadcrumbItems.push({
                title: (
                    <span className="flex items-center text-blue-600">
                        {/* <EyeOutlined className="mr-1" /> */}
                        {noteTitle || "Note"}
                    </span>
                ),
            });
            break;
    }

    return (
        <>
            <Breadcrumb
                items={breadcrumbItems}
                className="text-xs text-gray-500"
            />
        </>
    );
};
