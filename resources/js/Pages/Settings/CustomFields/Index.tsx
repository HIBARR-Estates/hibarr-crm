import { ReactNode, useEffect, useState } from "react";
import { Deferred } from "@inertiajs/react";
import axios from "axios";
import { message } from "antd";
import DashboardLayout from "@/Components/DashboardLayout";
import PageLayout from "@/Components/PageLayout";
import Button from "@/Components/Redesign/primitives/Button";
import Icon from "@/Components/Redesign/primitives/Icon";
import ConfirmDialog from "@/Components/Redesign/primitives/ConfirmDialog";
import { REDESIGN_TOKENS as T } from "@/Components/Redesign/tokens";
import "@/Components/Redesign/redesign.css";
import { useTd } from "@/Hooks/useDynamicTranslation";
import useTranslation from "@/Hooks/useTranslation";

import { ModuleGroup, SettingsField, SettingsCategory, fieldHasRule } from "./types";
import useCustomFieldMutations from "./hooks/useCustomFieldMutations";
import useCustomFieldCategoryMutations from "./hooks/useCustomFieldCategoryMutations";
import FieldsTab from "./components/FieldsTab";
import CategoriesTab from "./components/CategoriesTab";
import VisibilityRulesTab from "./components/VisibilityRulesTab";
import FieldModal from "./components/FieldModal";
import CategoryModal from "./components/CategoryModal";
import VisibilityRuleModal from "./components/VisibilityRuleModal";

type TabKey = "fields" | "categories" | "visibility";

interface Props {
    pageTitle: string;
    moduleGroups: ModuleGroup[];
    fields?: SettingsField[];
    categories?: SettingsCategory[];
}

type ConfirmState =
    | { kind: "field"; id: number; label: string; module: string }
    | { kind: "category"; id: number; label: string };

function TabSkeleton() {
    return (
        <div style={{ padding: "20px 22px 24px", display: "flex", flexDirection: "column", gap: 12 }}>
            {[0, 1, 2].map((i) => (
                <div key={i} className="dr-skeleton" style={{ height: 52, borderRadius: 10 }} />
            ))}
        </div>
    );
}

function CustomFieldsSettingsBody({ pageTitle, moduleGroups, fields: initialFields, categories: initialCategories }: Props) {
    const { td } = useTd();
    const { t } = useTranslation();
    const [tab, setTab] = useState<TabKey>("fields");
    const [fields, setFields] = useState<SettingsField[]>([]);
    const [categories, setCategories] = useState<SettingsCategory[]>([]);
    const [seeded, setSeeded] = useState(false);

    // Deferred props resolve once; seed local state (the source of truth for
    // mutations from here on) the first time both arrive rather than
    // re-syncing on every prop change.
    useEffect(() => {
        if (seeded || !initialFields || !initialCategories) return;
        setFields(initialFields);
        setCategories(initialCategories);
        setSeeded(true);
    }, [seeded, initialFields, initialCategories]);

    const fieldMutations = useCustomFieldMutations({ setFields });
    const categoryMutations = useCustomFieldCategoryMutations({ setCategories, moduleGroups });

    const [fieldModalOpen, setFieldModalOpen] = useState(false);
    const [editingField, setEditingField] = useState<SettingsField | null>(null);
    const [defaultModuleId, setDefaultModuleId] = useState<number | null>(moduleGroups[0]?.id ?? null);

    const [categoryModalOpen, setCategoryModalOpen] = useState(false);
    const [editingCategory, setEditingCategory] = useState<SettingsCategory | null>(null);

    const [ruleModalOpen, setRuleModalOpen] = useState(false);
    const [ruleModalFieldId, setRuleModalFieldId] = useState<number | null>(null);

    const [confirm, setConfirm] = useState<ConfirmState | null>(null);
    const [confirmLoading, setConfirmLoading] = useState(false);

    const openAdd = () => {
        if (tab === "categories") {
            setEditingCategory(null);
            setCategoryModalOpen(true);
        } else if (tab === "visibility") {
            setRuleModalFieldId(null);
            setRuleModalOpen(true);
        } else {
            setEditingField(null);
            setFieldModalOpen(true);
        }
    };

    const handleEditField = (field: SettingsField) => {
        setEditingField(field);
        setFieldModalOpen(true);
    };

    const handleDeleteField = (field: SettingsField) => {
        setConfirm({ kind: "field", id: field.id, label: field.label, module: field.module });
    };

    const handleEditCategory = (category: SettingsCategory) => {
        setEditingCategory(category);
        setCategoryModalOpen(true);
    };

    const handleDeleteCategory = (category: SettingsCategory) => {
        setConfirm({ kind: "category", id: category.id, label: category.name });
    };

    const handleOpenRuleBuilder = (field: SettingsField) => {
        setFieldModalOpen(false);
        setRuleModalFieldId(field.id);
        setRuleModalOpen(true);
    };

    const handleRuleSaved = (fieldId: number, ruleSet: SettingsField["show_rule_set"]) => {
        setFields((prev) => prev.map((f) => (f.id === fieldId ? { ...f, show_rule_set: ruleSet } : f)));
    };

    const handleRemoveRule = async (field: SettingsField) => {
        try {
            const res = await axios.post(
                route("custom-fields.save-rule-set", field.id),
                { rule_set: { enabled: false, default_visibility: true, group: { group_operator: "AND", criteria: [] } } },
                { headers: { Accept: "application/json" } },
            );
            if (res.data?.rule_set) {
                handleRuleSaved(field.id, res.data.rule_set);
                message.success(td("Rule removed", { source: "en" }));
            } else {
                message.error(res.data?.message || t("messages.somethingWentWrong"));
            }
        } catch (error: any) {
            message.error(error?.response?.data?.message || t("messages.somethingWentWrong"));
        }
    };

    const handleConfirm = async () => {
        if (!confirm) return;
        setConfirmLoading(true);
        if (confirm.kind === "field") {
            await fieldMutations.deleteField(confirm.id);
        } else {
            await categoryMutations.deleteCategory(confirm.id);
        }
        setConfirmLoading(false);
        setConfirm(null);
    };

    const rulesCount = fields.filter(fieldHasRule).length;

    const tabs: { key: TabKey; label: string; count: number }[] = [
        { key: "fields", label: td("Fields", { source: "en" }), count: fields.length },
        { key: "categories", label: td("Categories", { source: "en" }), count: categories.length },
        { key: "visibility", label: td("Visibility rules", { source: "en" }), count: rulesCount },
    ];

    const addLabel =
        tab === "categories"
            ? td("Add category", { source: "en" })
            : tab === "visibility"
              ? td("Add rule", { source: "en" })
              : td("Add field", { source: "en" });

    const confirmCopy = (() => {
        if (!confirm) return null;
        if (confirm.kind === "field") {
            return {
                title: td("Delete field?", { source: "en" }),
                message: td(`This removes “${confirm.label}” and its stored values from ${confirm.module} records. It can't be undone.`, { source: "en" }),
                confirmLabel: td("Delete field", { source: "en" }),
            };
        }
        return {
            title: td("Delete category?", { source: "en" }),
            message: td(`This removes the “${confirm.label}” category. Fields in it keep their data but lose the grouping. It can't be undone.`, { source: "en" }),
            confirmLabel: td("Delete category", { source: "en" }),
        };
    })();

    return (
        <PageLayout
            breadcrumbs={[
                { name: t("app.menu.settings"), url: route("settings-overview.index") },
                { name: pageTitle },
            ]}
        >
            <div className="max-w-screen-2xl mx-auto w-full" style={{ padding: "8px 0 32px" }}>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 20, marginBottom: 20 }}>
                    <div>
                        <div style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: T.TEXT_HINT, marginBottom: 6 }}>
                            {td("Settings", { source: "en" })}
                        </div>
                        <h1 style={{ margin: 0, fontSize: 19, fontWeight: 700, color: T.NAVY, letterSpacing: "-0.01em" }}>
                            {td("Custom fields", { source: "en" })}
                        </h1>
                        <p style={{ margin: "6px 0 0", fontSize: 14, color: T.TEXT_MUTED, maxWidth: 560 }}>
                            {td(
                                "Define the extra data captured on each record type. Group fields into categories and control when they appear with visibility rules.",
                                { source: "en" },
                            )}
                        </p>
                    </div>
                    <Button variant="primary" onClick={openAdd} icon={<Icon name="plus" size={15} />}>
                        {addLabel}
                    </Button>
                </div>

                <div style={{ background: T.WHITE, border: `1px solid ${T.BORDER}`, borderRadius: 10, overflow: "hidden" }}>
                    <div role="tablist" style={{ display: "flex", alignItems: "center", gap: 24, padding: "0 22px", borderBottom: `1px solid ${T.BORDER}` }}>
                        {tabs.map((item) => {
                            const active = tab === item.key;
                            return (
                                <button
                                    key={item.key}
                                    role="tab"
                                    aria-selected={active}
                                    onClick={() => setTab(item.key)}
                                    style={{
                                        position: "relative",
                                        background: "none",
                                        border: "none",
                                        padding: "14px 0 12px",
                                        cursor: "pointer",
                                        fontSize: 14,
                                        fontWeight: active ? 600 : 500,
                                        color: active ? T.NAVY : T.TEXT_MUTED,
                                        display: "flex",
                                        alignItems: "center",
                                        gap: 8,
                                    }}
                                >
                                    {item.label}
                                    <span
                                        style={{
                                            fontSize: 12,
                                            fontWeight: 600,
                                            color: active ? T.BLUE_DARK : T.TEXT_MUTED,
                                            background: active ? T.BLUE_LIGHT : T.GRAY_MID,
                                            borderRadius: 999,
                                            padding: "1px 8px",
                                        }}
                                    >
                                        {item.count}
                                    </span>
                                    {active && (
                                        <span style={{ position: "absolute", left: 0, right: 0, bottom: -1, height: 2, background: T.BLUE, borderRadius: 2 }} />
                                    )}
                                </button>
                            );
                        })}
                    </div>

                    <Deferred data={["fields", "categories"]} fallback={<TabSkeleton />}>
                        {tab === "fields" ? (
                            <FieldsTab
                                fields={fields}
                                moduleGroups={moduleGroups}
                                onEdit={handleEditField}
                                onDelete={handleDeleteField}
                                onReorder={(moduleName, orderedIds) => {
                                    const group = moduleGroups.find((g) => g.name === moduleName);
                                    if (group) setDefaultModuleId(group.id);
                                    fieldMutations.reorderFields(orderedIds);
                                }}
                            />
                        ) : tab === "categories" ? (
                            <CategoriesTab
                                categories={categories}
                                fields={fields}
                                onEdit={handleEditCategory}
                                onDelete={handleDeleteCategory}
                                onReorder={categoryMutations.reorderCategories}
                            />
                        ) : (
                            <VisibilityRulesTab
                                fields={fields}
                                onEdit={(field) => {
                                    setRuleModalFieldId(field.id);
                                    setRuleModalOpen(true);
                                }}
                                onRemove={handleRemoveRule}
                                onAdd={() => {
                                    setRuleModalFieldId(null);
                                    setRuleModalOpen(true);
                                }}
                            />
                        )}
                    </Deferred>
                </div>
            </div>

            <FieldModal
                open={fieldModalOpen}
                moduleGroups={moduleGroups}
                categories={categories}
                editingField={editingField}
                defaultModuleId={defaultModuleId}
                saving={fieldMutations.saving}
                onClose={() => setFieldModalOpen(false)}
                onSave={(draft, original) =>
                    original ? fieldMutations.updateField(original.id, draft, original) : fieldMutations.createField(draft)
                }
                onOpenRuleBuilder={handleOpenRuleBuilder}
            />

            <CategoryModal
                open={categoryModalOpen}
                moduleGroups={moduleGroups}
                editingCategory={editingCategory}
                defaultModuleId={defaultModuleId}
                saving={categoryMutations.saving}
                onClose={() => setCategoryModalOpen(false)}
                onSave={(draft) =>
                    editingCategory ? categoryMutations.updateCategory(editingCategory.id, draft) : categoryMutations.createCategory(draft)
                }
            />

            <VisibilityRuleModal
                open={ruleModalOpen}
                availableFields={fields}
                initialFieldId={ruleModalFieldId}
                onClose={() => setRuleModalOpen(false)}
                onSaved={handleRuleSaved}
            />

            <ConfirmDialog
                open={!!confirm}
                title={confirmCopy?.title ?? ""}
                message={confirmCopy?.message ?? ""}
                confirmLabel={confirmCopy?.confirmLabel}
                danger
                confirmLoading={confirmLoading}
                onConfirm={handleConfirm}
                onCancel={() => setConfirm(null)}
            />
        </PageLayout>
    );
}

export default function CustomFieldsSettings(props: Props) {
    return <CustomFieldsSettingsBody {...props} />;
}

CustomFieldsSettings.layout = (page: ReactNode) => <DashboardLayout>{page}</DashboardLayout>;
