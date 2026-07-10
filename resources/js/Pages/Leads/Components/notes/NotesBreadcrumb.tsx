import React from "react";
import useTranslation from "@/Hooks/useTranslation";
import { Breadcrumb } from "antd";

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
    const { t } = useTranslation();
    const breadcrumbItems = [
        {
            title: (
                <span
                    className="flex items-center cursor-pointer hover:text-blue-600 transition-colors"
                    onClick={() => onNavigate("list")}
                >
                    {/* <FileTextOutlined className="mr-1" /> */}
                    {t("pages.leads.notes.breadcrumb")}
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
                        {t("pages.leads.notes.breadcrumb_new")}
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
                                {noteTitle || t("pages.leads.notes.breadcrumb_fallback")}
                            </span>
                        ),
                    },
                    {
                        title: (
                            <span className="flex items-center text-blue-600">
                                {/* <EditOutlined className="mr-1" /> */}
                                {t("pages.leads.notes.breadcrumb_edit")}
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
                        {noteTitle || t("pages.leads.notes.breadcrumb_fallback")}
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
