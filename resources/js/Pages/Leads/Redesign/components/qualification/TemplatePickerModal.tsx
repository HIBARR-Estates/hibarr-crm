import { Modal } from "@/Components/Redesign";
import type { PublishedTemplate } from "@/Types/qualification";
import { useTd } from "@/Hooks/useDynamicTranslation";

interface TemplatePickerModalProps {
    open: boolean;
    leadName: string;
    templates: PublishedTemplate[];
    loading: boolean;
    onClose: () => void;
    onSelect: (templateId: string) => void;
}

export default function TemplatePickerModal({
    open,
    leadName,
    templates,
    loading,
    onClose,
    onSelect,
}: TemplatePickerModalProps) {
    const { td } = useTd();

    return (
        <Modal
            open={open}
            title={td("Choose qualification template")}
            onClose={onClose}
        >
            <p style={{ margin: "0 0 14px", fontSize: 13, color: "#6b7280" }}>
                {td("Select a script for")}{" "}
                <strong style={{ color: "#1a1f2e" }}>{leadName}</strong>
            </p>

            {loading ? (
                <p style={{ fontSize: 13, color: "#9ca3af", margin: 0 }}>
                    {td("Loading templates…")}
                </p>
            ) : templates.length === 0 ? (
                <p style={{ fontSize: 13, color: "#9ca3af", margin: 0 }}>
                    {td("No published templates available.")}
                </p>
            ) : (
                <div style={{ display: "grid", gap: 10 }}>
                    {templates.map((template) => (
                        <button
                            key={template.id}
                            type="button"
                            className="v2-option"
                            onClick={() => onSelect(template.id)}
                        >
                            <span style={{ minWidth: 0 }}>
                                <span
                                    style={{
                                        display: "block",
                                        fontWeight: 600,
                                        marginBottom: 4,
                                    }}
                                >
                                    {template.name}
                                </span>
                                {template.description && (
                                    <span
                                        style={{
                                            display: "block",
                                            fontSize: 12,
                                            color: "#6b7280",
                                            fontWeight: 400,
                                            lineHeight: 1.4,
                                        }}
                                    >
                                        {template.description}
                                    </span>
                                )}
                            </span>
                            <span className="v2-pill">v{template.version}</span>
                        </button>
                    ))}
                </div>
            )}
        </Modal>
    );
}
