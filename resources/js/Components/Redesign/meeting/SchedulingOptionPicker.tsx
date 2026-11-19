import useTranslation from "@/Hooks/useTranslation";
import Icon from "@/Components/Redesign/primitives/Icon";
import { REDESIGN_RADIUS as R, REDESIGN_TOKENS as T } from "@/Components/Redesign/tokens";
import type { CalendlyLinkOption } from "./useCalendlyLinks";

/** "manual" = pick the time in this dialog; a number = that Calendly link's id. */
export type SchedulingChoice = "manual" | number;

interface SchedulingOptionPickerProps {
    value: SchedulingChoice;
    onChange: (value: SchedulingChoice) => void;
    links: CalendlyLinkOption[];
    disabled?: boolean;
}

/**
 * How this meeting gets its date and time: chosen here, or left to one of the
 * Calendly booking pages. Only rendered when there is a booking page to offer,
 * so a company that has set none up never sees it.
 */
export default function SchedulingOptionPicker({
    value,
    onChange,
    links,
    disabled = false,
}: SchedulingOptionPickerProps) {
    const { t } = useTranslation();

    const options: Array<{
        value: SchedulingChoice;
        title: string;
        hint: string;
        icon: "calendar" | "share";
    }> = [
        {
            value: "manual",
            title: t("pages.meetings.calendly.option_manual"),
            hint: t("pages.meetings.calendly.option_manual_hint"),
            icon: "calendar",
        },
        ...links.map((link) => ({
            value: link.id as SchedulingChoice,
            title: link.name,
            hint:
                link.description ||
                t("pages.meetings.calendly.option_link_hint"),
            icon: "share" as const,
        })),
    ];

    return (
        <div style={{ marginBottom: 16 }}>
            <p
                className="font-semibold"
                style={{ fontSize: 13, color: T.TEXT, marginBottom: 8 }}
            >
                {t("pages.meetings.calendly.section_label")}
            </p>
            <div
                role="radiogroup"
                aria-label={t("pages.meetings.calendly.section_label")}
                className="grid gap-2"
                style={{
                    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                }}
            >
                {options.map((option) => {
                    const active = option.value === value;
                    return (
                        <button
                            key={String(option.value)}
                            type="button"
                            role="radio"
                            aria-checked={active}
                            disabled={disabled}
                            onClick={() => onChange(option.value)}
                            className="flex items-start gap-2 text-left"
                            style={{
                                padding: "10px 12px",
                                borderRadius: R.MD,
                                cursor: disabled ? "default" : "pointer",
                                border: `1px solid ${active ? T.BLUE : T.BORDER}`,
                                background: active ? T.BLUE_LIGHT : T.WHITE,
                            }}
                        >
                            <span
                                style={{
                                    color: active ? T.BLUE_DARK : T.TEXT_HINT,
                                    marginTop: 1,
                                }}
                            >
                                <Icon name={option.icon} size={16} />
                            </span>
                            <span className="min-w-0">
                                <span
                                    className="block font-semibold"
                                    style={{
                                        fontSize: 13,
                                        color: active ? T.BLUE_DARK : T.TEXT,
                                    }}
                                >
                                    {option.title}
                                </span>
                                <span
                                    className="mt-px block"
                                    style={{ fontSize: 12, color: T.TEXT_MUTED }}
                                >
                                    {option.hint}
                                </span>
                            </span>
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
