import type { PublishedTemplate } from "@/Types/qualification";
import { useTd } from "@/Hooks/useDynamicTranslation";
import LeadV2Modal, { LeadV2ModalHeader } from "./LeadV2Modal";

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
    const titleId = "template-picker-title";

    return (
        <LeadV2Modal
            open={open}
            onClose={onClose}
            labelledBy={titleId}
            ariaLabel={td("Choose qualification template")}
        >
            <LeadV2ModalHeader
                title={td("Choose qualification template")}
                titleId={titleId}
                subtitle={
                    <>
                        {td("For")} {leadName} —{" "}
                        {td("pick the script that matches this conversation")}
                    </>
                }
                onClose={onClose}
            />

            <div className="v2-modal-body" style={{ paddingBottom: 20 }}>
                {loading ? (
                    <p
                        style={{
                            margin: 0,
                            fontSize: 13,
                            color: "var(--lr-text-dim)",
                        }}
                    >
                        {td("Loading templates…")}
                    </p>
                ) : templates.length === 0 ? (
                    <p
                        style={{
                            margin: 0,
                            fontSize: 13,
                            color: "var(--lr-text-dim)",
                        }}
                    >
                        {td("No published templates available.")}
                    </p>
                ) : (
                    <div
                        style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: 10,
                        }}
                    >
                        {templates.map((template) => (
                            <button
                                key={template.id}
                                type="button"
                                className="v2-template-card"
                                onClick={() => onSelect(template.id)}
                            >
                                <div
                                    style={{
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "space-between",
                                        gap: 10,
                                    }}
                                >
                                    <span
                                        style={{
                                            fontSize: 15,
                                            fontWeight: 700,
                                            color: "var(--lr-text)",
                                        }}
                                    >
                                        {template.name}
                                    </span>
                                    <span className="v2-pill v2-pill-gray">
                                        v{template.version}
                                    </span>
                                </div>
                                {template.description ? (
                                    <span
                                        style={{
                                            fontSize: 12.5,
                                            color: "var(--lr-text-muted)",
                                            lineHeight: 1.4,
                                        }}
                                    >
                                        {template.description}
                                    </span>
                                ) : null}
                            </button>
                        ))}
                    </div>
                )}
            </div>
        </LeadV2Modal>
    );
}
