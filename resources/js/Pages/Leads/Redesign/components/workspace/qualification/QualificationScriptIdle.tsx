import Button from "@/Components/Redesign/primitives/Button";
import type { PublishedTemplate } from "@/Types/qualification";
import { LEAD_REDESIGN_TOKENS as T } from "../../../types";
import { useTd } from "@/Hooks/useDynamicTranslation";

interface QualificationScriptIdleProps {
    templates: PublishedTemplate[];
    selectedTemplateId: string | null;
    onBegin: () => void;
    isStarting?: boolean;
    templatesLoading?: boolean;
}

export default function QualificationScriptIdle({
    templates,
    selectedTemplateId,
    onBegin,
    isStarting = false,
    templatesLoading = false,
}: QualificationScriptIdleProps) {
    const { td } = useTd();
    const selected = templates.find((t) => t.id === selectedTemplateId);

    if (templatesLoading) {
        return (
            <div
                style={{
                    textAlign: "center",
                    padding: "24px 0",
                    color: T.TEXT_HINT,
                    fontSize: 13,
                }}
            >
                {td("Loading templates...")}
            </div>
        );
    }

    if (templates.length === 0) {
        return (
            <div
                style={{
                    textAlign: "center",
                    padding: "24px 0",
                    color: T.TEXT_MUTED,
                    fontSize: 13,
                }}
            >
                {td("No published qualification templates available")}
            </div>
        );
    }

    const detail = selected
        ? `${selected.name}${selected.version ? ` · v${selected.version}` : ""} — ends with consultation, webinar, follow-up, or disqualify`
        : td(
              "Select a template above, then begin. Ends with consultation, webinar, follow-up, or disqualify",
          );

    return (
        <div style={{ textAlign: "center", padding: "16px 0" }}>
            <p
                style={{
                    fontSize: 13,
                    color: T.TEXT_MUTED,
                    marginBottom: 14,
                }}
            >
                {detail}
            </p>
            <Button
                variant="navy"
                onClick={onBegin}
                loading={isStarting}
                disabled={!selectedTemplateId || isStarting}
                style={{ fontSize: 13, padding: "10px 18px", fontWeight: 600 }}
            >
                {td("Begin script")}
            </Button>
        </div>
    );
}
