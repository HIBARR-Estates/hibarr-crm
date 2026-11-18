import React from "react";
import { Breadcrumb } from "antd";
import {
    HomeOutlined,
    FileTextOutlined,
    PlusOutlined,
    EditOutlined,
    EyeOutlined,
} from "@ant-design/icons";
import { useTd } from "@/Hooks/useDynamicTranslation";

export type NotesView = "list" | "add" | "edit" | "view";

interface NotesBreadcrumbProps {
    currentView: NotesView;
    noteTitle?: string | null;
    onNavigate: (view: NotesView) => void;
}

export const NotesBreadcrumb: React.FC<NotesBreadcrumbProps> = ({
    currentView,
    noteTitle,
    onNavigate,
}) => {
    const { td } = useTd();
    const breadcrumbItems = [
        {
            title: (
                <span
                    className="flex items-center cursor-pointer hover:text-blue-600 transition-colors"
                    onClick={() => onNavigate("list")}
                >
                    {/* <FileTextOutlined className="mr-1" /> */}
                    {td("Notes", { source: "en" })}
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
                        {td("New", { source: "en" })}
                    </span>
                ),
            });
            break;
        case "edit":
            breadcrumbItems.push(
                ...[
                    {
                        title: (
                            <span className="flex items-center">
                                {noteTitle || "Note"}
                            </span>
                        ),
                    },
                    {
                        title: (
                            <span className="flex items-center text-blue-600">
                                {/* <EditOutlined className="mr-1" /> */}
                                {td("Edit", { source: "en" })}
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
