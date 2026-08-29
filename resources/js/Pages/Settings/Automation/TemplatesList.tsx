import { useMemo, useState } from "react";
import { PlusOutlined, SearchOutlined } from "@ant-design/icons";
import { Dropdown } from "antd";
import Button from "@/Components/Redesign/primitives/Button";
import Badge from "@/Components/Redesign/primitives/Badge";
import Icon from "@/Components/Redesign/primitives/Icon";
import EmptyState from "@/Components/Redesign/primitives/EmptyState";
import { REDESIGN_TOKENS as T } from "@/Components/Redesign/tokens";
import useTranslation from "@/Hooks/useTranslation";
import { useTd } from "@/Hooks/useDynamicTranslation";
import { useAutomationWorkspace } from "./context/AutomationWorkspaceContext";
import useEmailTemplateMutations from "./hooks/useEmailTemplateMutations";

interface TemplatesListProps {
    onOpenEditor: (id: number) => void;
    onNewTemplate: () => void;
}

type ModeFilter = "all" | "custom" | "plunk_body";

function stripHtml(html: string): string {
    return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function CardSkeleton() {
    return (
        <div className="rounded-[10px] border bg-white p-4 animate-pulse" style={{ borderColor: T.BORDER }}>
            <div className="h-5 w-20 rounded-full mb-3" style={{ background: "#eef1f5" }} />
            <div className="h-4 w-3/4 rounded mb-2" style={{ background: "#eef1f5" }} />
            <div className="h-3 w-1/2 rounded mb-3" style={{ background: "#eef1f5" }} />
            <div className="h-16 rounded-lg" style={{ background: "#eef1f5" }} />
        </div>
    );
}

export default function TemplatesList({ onOpenEditor, onNewTemplate }: TemplatesListProps) {
    const { t } = useTranslation();
    const { td } = useTd();
    const { templates, templatesLoading, catalog } = useAutomationWorkspace();
    const { deleteTemplate, isSaving } = useEmailTemplateMutations();
    const [query, setQuery] = useState("");
    const [mode, setMode] = useState<ModeFilter>("all");

    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();
        return templates.filter((tpl) => {
            if (mode !== "all" && tpl.mode !== mode) return false;
            if (q && !tpl.name.toLowerCase().includes(q)) return false;
            return true;
        });
    }, [templates, mode, query]);

    const modeFilters: { key: ModeFilter; label: string }[] = [
        { key: "all", label: t("app.automation.filters.all") },
        { key: "custom", label: catalog?.templateModes.custom ?? "Custom" },
        { key: "plunk_body", label: catalog?.templateModes.plunk_body ?? "Plunk" },
    ];

    return (
        <div>
            <div className="flex items-end justify-between gap-4 mb-4 flex-wrap">
                <div>
                    <h1 className="m-0 font-bold" style={{ fontSize: 19, color: T.NAVY }}>
                        {t("app.automation.emailTemplates")}
                    </h1>
                    <p className="mt-1 mb-0" style={{ fontSize: 13, color: T.TEXT_MUTED }}>
                        {t("app.automation.templatesSubtitle")}
                    </p>
                </div>
                <div className="flex items-center gap-2.5">
                    <div className="relative">
                        <SearchOutlined className="absolute top-1/2 -translate-y-1/2" style={{ left: 11, color: T.TEXT_HINT }} />
                        <input
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder={t("app.automation.searchTemplates")}
                            className="dr-input"
                            style={{ width: 220, paddingLeft: 32 }}
                        />
                    </div>
                    <Button variant="primary" icon={<PlusOutlined />} onClick={onNewTemplate}>
                        {t("app.automation.newTemplate")}
                    </Button>
                </div>
            </div>

            <div className="flex gap-2 mb-3.5 flex-wrap">
                {modeFilters.map((f) => (
                    <button
                        key={f.key}
                        type="button"
                        className="dr-filter"
                        aria-pressed={mode === f.key}
                        onClick={() => setMode(f.key)}
                    >
                        {f.label}
                    </button>
                ))}
            </div>

            {!templatesLoading && filtered.length === 0 && (
                <div className="py-4">
                    <EmptyState
                        title={
                            templates.length === 0
                                ? t("app.automation.noTemplatesYet")
                                : t("app.automation.noTemplatesFound")
                        }
                        description={
                            templates.length === 0
                                ? t("app.automation.noTemplatesYetDescription")
                                : t("app.automation.noTemplatesFoundDescription")
                        }
                    />
                </div>
            )}

            <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))" }}>
                {templatesLoading && Array.from({ length: 3 }).map((_, i) => <CardSkeleton key={i} />)}
                {!templatesLoading && filtered.map((tpl) => {
                    const deleting = isSaving(tpl.id);
                    return (
                    <div key={tpl.id} className="rounded-[10px] border bg-white p-4 flex flex-col" style={{ borderColor: T.BORDER }}>
                        <div className="flex items-center justify-between mb-2.5">
                            <Badge variant={tpl.mode === "plunk_body" ? "teal" : "blue"}>
                                {catalog?.templateModes[tpl.mode] ?? tpl.mode}
                            </Badge>
                            <Dropdown
                                trigger={["click"]}
                                menu={{
                                    items: [
                                        {
                                            key: "delete",
                                            label: t("app.delete"),
                                            danger: true,
                                            onClick: () => {
                                                if (deleting) return;
                                                if (window.confirm(td("Delete this template? This can't be undone."))) {
                                                    deleteTemplate(tpl.id);
                                                }
                                            },
                                        },
                                    ],
                                }}
                            >
                                <button
                                    type="button"
                                    aria-label={t("app.automation.moreActions")}
                                    disabled={deleting}
                                    className="rounded-[7px] border-0 bg-transparent cursor-pointer flex disabled:opacity-40 disabled:cursor-not-allowed"
                                    style={{ padding: 5, color: T.TEXT_HINT }}
                                >
                                    <Icon name="more-vertical" size={16} />
                                </button>
                            </Dropdown>
                        </div>
                        <button
                            type="button"
                            onClick={() => onOpenEditor(tpl.id)}
                            className="border-0 bg-transparent text-left cursor-pointer p-0"
                            style={{ fontFamily: "inherit" }}
                        >
                            <div style={{ fontSize: 15, fontWeight: 600, color: T.NAVY }}>{tpl.name}</div>
                            <div className="mt-1" style={{ fontSize: 12, color: T.TEXT_MUTED }}>
                                {tpl.subject}
                            </div>
                        </button>
                        <div
                            className="mt-3 rounded-lg overflow-hidden"
                            style={{
                                background: T.SURFACE_2,
                                border: `1px solid ${T.BORDER_SOFT}`,
                                padding: "11px 12px",
                                fontSize: 12,
                                color: T.TEXT_MUTED,
                                lineHeight: 1.55,
                                maxHeight: 66,
                                overflow: "hidden",
                            }}
                        >
                            {stripHtml(tpl.body).slice(0, 160) || t("app.automation.noActivityYet")}
                        </div>
                        <div className="flex items-center justify-between mt-3.5 pt-3 border-t" style={{ borderColor: "#f4f5f7" }}>
                            <span style={{ fontSize: 11, color: T.TEXT_HINT }}>
                                {tpl.automation_actions_count === 0
                                    ? t("app.automation.notUsedYet")
                                    : t("app.automation.usedInCount", { count: tpl.automation_actions_count })}
                                {" · "}
                                {new Date(tpl.updated_at).toLocaleDateString()}
                            </span>
                            <button
                                type="button"
                                onClick={() => onOpenEditor(tpl.id)}
                                className="rounded-[7px] border bg-white cursor-pointer"
                                style={{ padding: "6px 12px", borderColor: T.BORDER, color: T.BLUE, fontSize: 12, fontWeight: 600 }}
                            >
                                {t("app.edit")}
                            </button>
                        </div>
                    </div>
                    );
                })}
            </div>
        </div>
    );
}
