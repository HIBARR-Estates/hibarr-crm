import Button from "@/Components/Redesign/primitives/Button";
import Icon from "@/Components/Redesign/primitives/Icon";
import {
    REDESIGN_TOKENS as T,
    REDESIGN_TYPE,
} from "@/Components/Redesign/tokens";
import { useTd } from "@/Hooks/useDynamicTranslation";
import useTranslation from "@/Hooks/useTranslation";
import type { SlaSettings } from "./types";

export default function FirstContactSlaTab({
    settings,
    hours,
    hasChanges,
    saving,
    onHoursChange,
    onSave,
}: {
    settings: SlaSettings;
    hours: number;
    hasChanges: boolean;
    saving: boolean;
    onHoursChange: (hours: number) => void;
    onSave: () => void;
}) {
    const { t } = useTranslation();
    const { td } = useTd();

    const clampHours = (value: number) =>
        Math.max(settings.min_hours, Math.min(settings.max_hours, value));

    return (
        <div>
            <p
                style={{
                    margin: "0 0 16px",
                    fontSize: REDESIGN_TYPE.BODY,
                    color: T.TEXT_MUTED,
                    lineHeight: 1.45,
                    maxWidth: 560,
                }}
            >
                {td(
                    "How long an agent has to make first contact with a new lead. Drives the Contacted within SLA figure and the overdue-contact column on the team dashboard.",
                    { source: "en" },
                )}
            </p>

            <label
                htmlFor="first-contact-sla-hours"
                style={{
                    display: "block",
                    fontSize: REDESIGN_TYPE.CAPTION,
                    fontWeight: 700,
                    letterSpacing: "0.05em",
                    textTransform: "uppercase",
                    color: T.TEXT_MUTED,
                    marginBottom: 8,
                }}
            >
                {td("Hours to first contact", { source: "en" })}
            </label>
            <div
                style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                }}
            >
                <input
                    id="first-contact-sla-hours"
                    type="number"
                    className="dr-input"
                    min={settings.min_hours}
                    max={settings.max_hours}
                    value={hours}
                    disabled={saving}
                    onChange={(e) => {
                        const next = Number(e.target.value);
                        if (!Number.isFinite(next)) return;
                        onHoursChange(clampHours(next));
                    }}
                    style={{ width: 120, fontSize: REDESIGN_TYPE.BODY }}
                />
                <span
                    style={{
                        fontSize: REDESIGN_TYPE.BODY,
                        color: T.TEXT_MUTED,
                    }}
                >
                    {td("hours", { source: "en" })}
                </span>
            </div>

            <div
                style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "flex-end",
                    gap: 12,
                    marginTop: 18,
                    paddingTop: 16,
                    borderTop: `1px solid ${T.BORDER_SOFT}`,
                }}
            >
                {hasChanges && (
                    <span
                        style={{
                            fontSize: REDESIGN_TYPE.CAPTION,
                            color: T.AMBER_TEXT,
                        }}
                    >
                        {td("You have unsaved changes", {
                            source: "en",
                        })}
                    </span>
                )}
                <Button
                    variant="primary"
                    icon={<Icon name="check" size={15} />}
                    onClick={onSave}
                    loading={saving}
                    disabled={!hasChanges}
                >
                    {t("app.save")}
                </Button>
            </div>
        </div>
    );
}
