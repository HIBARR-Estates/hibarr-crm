import { DatePicker } from "antd";
import dayjs, { Dayjs } from "dayjs";
import useTranslation from "@/Hooks/useTranslation";
import {
    ALL_TIME_FROM,
    PERIODS,
    periodLabel,
    type DashboardRange,
    type PeriodOption,
} from "../viewConfig";

const { RangePicker } = DatePicker;

interface DateRangePickerProps {
    value: DashboardRange;
    /**
     * Either `{ days }` / `{ period }` for a rolling preset or `{ from, to }`
     * for a fixed range — the shape the controller's query string takes.
     */
    onChange: (params: Record<string, string | number>) => void;
}

/**
 * The window control: rolling and calendar presets, plus any range the user
 * cares to drag out.
 *
 * One control rather than a select beside a calendar. antd's own preset panel
 * puts both in the same popover, which is where people already look for them.
 *
 * Picking a rolling preset sends `?days=N`; YTD / all-time send `?period=`.
 * That keeps those choices rolling — reload tomorrow and the window still
 * means what the label says. A hand-picked range is sent as the dates
 * themselves and stays put.
 *
 * The active preset is highlighted when the current window matches what that
 * preset resolves to today — including a custom range that happens to land
 * on the same span.
 */
export default function DateRangePicker({
    value,
    onChange,
}: DateRangePickerProps) {
    const { t } = useTranslation();
    const active = activePeriod(value);

    const presets = PERIODS.map((option) => {
        const selected = isSamePeriod(option, active);

        return {
            label: (
                <span
                    className={
                        selected
                            ? "dv2-period-preset is-active"
                            : "dv2-period-preset"
                    }
                >
                    {periodLabel(option, t)}
                </span>
            ),
            value: boundsFor(option),
        };
    });

    /**
     * A preset's range is what it resolves to *today*, so comparing the picked
     * dates against those tells us the user clicked the preset rather than
     * landing on the same span by hand. Same span, same numbers either way —
     * this only decides whether the choice keeps rolling.
     */
    const presetParamsFor = (
        from: Dayjs,
        to: Dayjs,
    ): Record<string, string | number> | null => {
        const option = PERIODS.find((candidate) => {
            const [start, end] = boundsFor(candidate);

            return to.isSame(end, "day") && from.isSame(start, "day");
        });

        if (!option) {
            return null;
        }

        return option.key ? { period: option.key } : { days: option.days };
    };

    return (
        <RangePicker
            className="dr-input"
            style={{ minHeight: 38, width: "auto" }}
            allowClear={false}
            // Future dates describe nothing that has happened yet.
            maxDate={dayjs().endOf("day")}
            value={[dayjs(value.from), dayjs(value.to)]}
            presets={presets}
            aria-label={t("pages.dashboard.views.period_aria")}
            onChange={(dates) => {
                const [from, to] = dates ?? [];

                if (!from || !to) {
                    return;
                }

                onChange(
                    presetParamsFor(from, to) ?? {
                        from: from.format("YYYY-MM-DD"),
                        to: to.format("YYYY-MM-DD"),
                    },
                );
            }}
        />
    );
}

/**
 * Prefer the server's named/rolling key when present; otherwise match the
 * open window against what each preset means today so a hand-picked span
 * that lands on e.g. year-to-date still lights up.
 */
function activePeriod(range: DashboardRange): PeriodOption | null {
    if (range.preset === "ytd" || range.preset === "all") {
        return PERIODS.find((option) => option.key === range.preset) ?? null;
    }

    if (typeof range.preset === "number") {
        return (
            PERIODS.find(
                (option) => "days" in option && option.days === range.preset,
            ) ?? null
        );
    }

    return (
        PERIODS.find((option) => {
            const [start, end] = boundsFor(option);

            return (
                dayjs(range.from).isSame(start, "day") &&
                dayjs(range.to).isSame(end, "day")
            );
        }) ?? null
    );
}

function isSamePeriod(
    option: PeriodOption,
    active: PeriodOption | null,
): boolean {
    if (!active) {
        return false;
    }

    if (option.key || active.key) {
        return option.key === active.key;
    }

    return option.days === active.days;
}

/** Inclusive span matching DashboardDateRange::preset / ::named. */
function boundsFor(option: PeriodOption): [Dayjs, Dayjs] {
    const end = dayjs().endOf("day");

    if (option.key === "ytd") {
        return [dayjs().startOf("year").startOf("day"), end];
    }

    if (option.key === "all") {
        return [dayjs(ALL_TIME_FROM).startOf("day"), end];
    }

    if ("days" in option && option.days !== undefined) {
        // days - 1: today is one of the counted days, matching the server.
        return [
            dayjs()
                .subtract(option.days - 1, "day")
                .startOf("day"),
            end,
        ];
    }

    throw new Error("Invalid PeriodOption: missing key and days");
}
