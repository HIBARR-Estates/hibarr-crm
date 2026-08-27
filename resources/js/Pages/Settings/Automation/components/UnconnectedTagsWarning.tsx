import Icon from "@/Components/Redesign/primitives/Icon";
import { REDESIGN_TOKENS as T } from "@/Components/Redesign/tokens";
import useTranslation from "@/Hooks/useTranslation";
import { findUnconnectedTags } from "../adapters/mergeTags";
import { FieldOptionGroup } from "../config/builderFields";
import { EmailTemplate } from "../types";

interface UnconnectedTagsWarningProps {
    template?: EmailTemplate;
    /** `mergeTagGroups(subjectType, catalog)` for the automation this
     * template is attached to — subject-type aware, so a Deal-only tag
     * correctly flags on a lead-subject automation and not the reverse. */
    validGroups: FieldOptionGroup[];
}

/**
 * Flags {{tags}} in the selected template that this automation can't
 * resolve — e.g. a Deal-only tag like {{motivation}} used by a lead-subject
 * automation. DealAutomationService::resolveTagValue() doesn't error on an
 * unresolvable tag, it just sends it blank, so this is the only place that
 * catches it before the automation goes live.
 */
export default function UnconnectedTagsWarning({ template, validGroups }: UnconnectedTagsWarningProps) {
    const { t } = useTranslation();

    if (!template) return null;

    const unconnected = findUnconnectedTags(template, validGroups);
    if (unconnected.length === 0) return null;

    return (
        <div
            className="rounded-lg flex items-start gap-2"
            style={{ background: T.AMBER_SOFT, border: `1px solid ${T.AMBER_MID}`, padding: "10px 12px", fontSize: 12, color: T.AMBER }}
        >
            <span style={{ marginTop: 1 }}>
                <Icon name="info" size={13} />
            </span>
            <span>
                {t("app.automation.unconnectedTagsHint")}{" "}
                <strong style={{ fontFamily: "ui-monospace, monospace" }}>
                    {unconnected.map((tag) => `{{${tag}}}`).join(", ")}
                </strong>
            </span>
        </div>
    );
}
