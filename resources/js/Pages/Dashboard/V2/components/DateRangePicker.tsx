import { DatePicker } from "antd";
import dayjs, { Dayjs } from "dayjs";
import { useTd } from "@/Hooks/useDynamicTranslation";
import { PERIODS, type DashboardRange } from "../viewConfig";

const { RangePicker } = DatePicker;

interface DateRangePickerProps {
    value: DashboardRange;
    /**
     * Either `{ days }` for a rolling preset or `{ from, to }` for a fixed
     * range — the shape the controller's query string takes.
     */
    onChange: (params: Record<string, string | number>) => void;
}

/**
 * The window control: the same presets as before, plus any range the user
 * cares to drag out.
 *
 * One control rather than a select beside a calendar. antd's own preset panel
 * puts both in the same popover, which is where people already look for them.
 *
 * Picking a preset sends `?days=N`, not the two dates it happens to resolve to
 * today. That keeps "last 30 days" rolling — reload tomorrow and it means
 * tomorrow's 30 days, which is what someone who picked a preset rather than a
 * date meant. A hand-picked range is sent as the dates themselves and stays
 * put, which is equally what that person meant.
 */
export default function DateRangePicker({
    value,
    onChange,
}: DateRangePickerProps) {
    const { td } = useTd();

    const presets = PERIODS.map((option) => ({
        label: td(option.label),
        value: [
            dayjs().subtract(option.days, "day").startOf("day"),
            dayjs().endOf("day"),
        ] as [Dayjs, Dayjs],
    }));

    /**
     * A preset's range is what it resolves to *today*, so comparing the picked
     * dates against those tells us the user clicked the preset rather than
     * landing on the same span by hand. Same span, same numbers either way —
     * this only decides whether the choice keeps rolling.
     */
    const presetDaysFor = (from: Dayjs, to: Dayjs): number | null => {
        const match = PERIODS.find(
            (option) =>
                to.isSame(dayjs(), "day") &&
                from.isSame(dayjs().subtract(option.days, "day"), "day"),
        );

        return match?.days ?? null;
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
            aria-label={td("Period")}
            onChange={(dates) => {
                const [from, to] = dates ?? [];

                if (!from || !to) {
                    return;
                }

                const days = presetDaysFor(from, to);

                onChange(
                    days
                        ? { days }
                        : {
                              from: from.format("YYYY-MM-DD"),
                              to: to.format("YYYY-MM-DD"),
                          },
                );
            }}
        />
    );
}
