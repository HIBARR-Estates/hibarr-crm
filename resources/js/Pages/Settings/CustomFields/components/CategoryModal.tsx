import { useEffect, useState } from "react";
import { Modal, ModalField } from "@/Components/Redesign/primitives/Modal";
import MenuSelect from "@/Components/Redesign/primitives/MenuSelect";
import Button from "@/Components/Redesign/primitives/Button";
import Icon from "@/Components/Redesign/primitives/Icon";
import { useTd } from "@/Hooks/useDynamicTranslation";
import { message } from "antd";
import { CategoryDraft, ModuleGroup, SettingsCategory } from "../types";

interface Props {
    open: boolean;
    moduleGroups: ModuleGroup[];
    editingCategory: SettingsCategory | null;
    defaultModuleId: number | null;
    saving: boolean;
    onClose: () => void;
    onSave: (draft: CategoryDraft) => Promise<SettingsCategory | null>;
}

function emptyDraft(moduleId: number | null): CategoryDraft {
    return { name: "", custom_field_group_id: moduleId ?? "", order: 0 };
}

function draftFromCategory(category: SettingsCategory): CategoryDraft {
    return { name: category.name, custom_field_group_id: category.custom_field_group_id, order: category.order };
}

export default function CategoryModal({
    open,
    moduleGroups,
    editingCategory,
    defaultModuleId,
    saving,
    onClose,
    onSave,
}: Props) {
    const { td } = useTd();
    const [draft, setDraft] = useState<CategoryDraft>(() => emptyDraft(defaultModuleId));

    useEffect(() => {
        if (!open) return;
        setDraft(editingCategory ? draftFromCategory(editingCategory) : emptyDraft(defaultModuleId));
    }, [open, editingCategory, defaultModuleId]);

    const isEditing = !!editingCategory;
    const patch = (partial: Partial<CategoryDraft>) => setDraft((prev) => ({ ...prev, ...partial }));

    const handleSave = async () => {
        if (!draft.name.trim()) {
            message.error(td("Enter a category name", { source: "en" }));
            return;
        }
        if (!draft.custom_field_group_id) {
            message.error(td("Select a module", { source: "en" }));
            return;
        }
        const saved = await onSave(draft);
        if (saved) onClose();
    };

    return (
        <Modal
            open={open}
            title={isEditing ? td("Edit category", { source: "en" }) : td("Add category", { source: "en" })}
            onClose={onClose}
            dirty={draft.name.trim().length > 0}
            maxWidth={460}
            footer={
                <>
                    <Button variant="ghost" onClick={onClose} disabled={saving}>
                        {td("Cancel", { source: "en" })}
                    </Button>
                    <Button variant="primary" onClick={handleSave} loading={saving} icon={<Icon name="check" size={15} />}>
                        {isEditing ? td("Save changes", { source: "en" }) : td("Create category", { source: "en" })}
                    </Button>
                </>
            }
        >
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <ModalField
                    label={
                        <>
                            {td("Name", { source: "en" })} <span style={{ color: "#b91c1c" }}>*</span>
                        </>
                    }
                >
                    <input
                        className="dr-input"
                        style={{ width: "100%", padding: "11px 12px", fontSize: 14 }}
                        value={draft.name}
                        onChange={(e) => patch({ name: e.target.value })}
                        placeholder={td("e.g. Qualification", { source: "en" })}
                    />
                </ModalField>
                <ModalField label={td("Module", { source: "en" })}>
                    <MenuSelect
                        value={draft.custom_field_group_id}
                        onChange={(v) => patch({ custom_field_group_id: Number(v) })}
                        options={moduleGroups.map((g) => ({ value: g.id, label: g.name }))}
                        fullWidth
                    />
                </ModalField>
                <ModalField label={td("Order sequence", { source: "en" })}>
                    <input
                        type="number"
                        className="dr-input"
                        style={{ padding: "11px 12px", fontSize: 14 }}
                        value={draft.order}
                        onChange={(e) => patch({ order: Number(e.target.value) || 0 })}
                    />
                </ModalField>
            </div>
        </Modal>
    );
}
