import Button from "@/Components/Redesign/primitives/Button";
import Icon from "@/Components/Redesign/primitives/Icon";
import {
    REDESIGN_TOKENS as T,
    REDESIGN_TYPE,
} from "@/Components/Redesign/tokens";
import { useTd } from "@/Hooks/useDynamicTranslation";
import useTranslation from "@/Hooks/useTranslation";
import type { SlaSettings } from "./types";

const HOUR = 3600;
const MINUTE = 60;

interface SlaParts {
    hours: number;
    minutes: number;
    seconds: number;
}

/** Always re-derived from the total, never tracked as its own state — so a
 *  minutes field that ends up holding "90" self-corrects to +1 hour on the
 *  next render instead of needing its own rollover logic. */
function splitSeconds(totalSeconds: number): SlaParts {
    const clamped = Math.max(0, Math.floor(totalSeconds));

    return {
        hours: Math.floor(clamped / HOUR),
        minutes: Math.floor((clamped % HOUR) / MINUTE),
        seconds: clamped % MINUTE,
    };
}

export default function FirstContactSlaTab({
    settings,
    seconds,
    hasChanges,
    saving,
    onSecondsChange,
    onSave,
}: {
    settings: SlaSettings;
    seconds: number;
    hasChanges: boolean;
    saving: boolean;
    onSecondsChange: (seconds: number) => void;
    onSave: () => void;
}) {
    const { t } = useTranslation();
    const { td } = useTd();

    const clampTotal = (value: number) =>
        Math.max(settings.min_seconds, Math.min(settings.max_seconds, value));

    const parts = splitSeconds(seconds);

    const updatePart = (unit: keyof SlaParts, value: number) => {
        if (!Number.isFinite(value)) return;

        const next: SlaParts = { ...parts, [unit]: Math.max(0, Math.floor(value)) };

        onSecondsChange(
            clampTotal(next.hours * HOUR + next.minutes * MINUTE + next.seconds),
        );
    };

    const unitField = (
        id: string,
        label: string,
        value: number,
        unit: keyof SlaParts,
        max?: number,
    ) => (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <label
                htmlFor={id}
                style={{
                    fontSize: REDESIGN_TYPE.CAPTION,
                    fontWeight: 700,
                    letterSpacing: "0.05em",
                    textTransform: "uppercase",
                    color: T.TEXT_MUTED,
                }}
            >
                {label}
            </label>
            <input
                id={id}
                type="number"
                className="dr-input"
                min={0}
                max={max}
                value={value}
                disabled={saving}
                onChange={(e) => updatePart(unit, Number(e.target.value))}
                style={{ width: 96, fontSize: REDESIGN_TYPE.BODY }}
            />
        </div>
    );

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
                    "How long an agent has to make first contact with a new lead — down to the minute or second for a team chasing hot leads. Drives the Contacted within SLA figure and the overdue-contact column on the team dashboard.",
                    { source: "en" },
                )}
            </p>

            <div style={{ display: "flex", alignItems: "flex-end", gap: 14 }}>
                {unitField(
                    "first-contact-sla-hours",
                    td("Hours", { source: "en" }),
                    parts.hours,
                    "hours",
                    Math.floor(settings.max_seconds / HOUR),
                )}
                {unitField(
                    "first-contact-sla-minutes",
                    td("Minutes", { source: "en" }),
                    parts.minutes,
                    "minutes",
                    59,
                )}
                {unitField(
                    "first-contact-sla-seconds",
                    td("Seconds", { source: "en" }),
                    parts.seconds,
                    "seconds",
                    59,
                )}
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
