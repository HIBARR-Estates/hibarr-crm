import { useState } from "react";
import { DatePicker } from "antd";
import dayjs from "dayjs";
import { formatCompanyDate } from "@/lib/companyDateTime";
import useTranslation from "@/Hooks/useTranslation";
import Button from "@/Components/Redesign/primitives/Button";
import Icon from "@/Components/Redesign/primitives/Icon";
import type { DealTimelineDateRange } from "../../hooks/useDealTimeline";
import { REDESIGN_TOKENS as T } from "@/Components/Redesign/tokens";

interface DealTimelineDateRangeControlProps {
    value: DealTimelineDateRange | null;
    onChange: (range: DealTimelineDateRange | null) => void;
}

export function DealTimelineDateRangeControl({
    value,
    onChange,
}: DealTimelineDateRangeControlProps) {
    const { t } = useTranslation();
    const [open, setOpen] = useState(false);

    const label = value
        ? `${formatCompanyDate(value.from)} – ${formatCompanyDate(value.to)}`
        : t("pages.deals.timeline.date_range_placeholder");

    return (
        <div className="relative">
            <Button
                variant="ghost"
                icon={<Icon name="calendar" size={12} />}
                onClick={() => setOpen(true)}
                style={
                    value
                        ? {
                              color: T.BLUE,
                              borderColor: T.BLUE_MID,
                              background: T.BLUE_LIGHT,
                          }
                        : undefined
                }
            >
                {label}
            </Button>
            <DatePicker.RangePicker
                open={open}
                onOpenChange={setOpen}
                value={value ? [dayjs(value.from), dayjs(value.to)] : null}
                onChange={(dates) => {
                    if (!dates || !dates[0] || !dates[1]) {
                        onChange(null);
                        return;
                    }
                    onChange({
                        from: dates[0].format("YYYY-MM-DD"),
                        to: dates[1].format("YYYY-MM-DD"),
                    });
                    setOpen(false);
                }}
                allowClear
                style={{
                    width: 0,
                    height: 0,
                    padding: 0,
                    border: 0,
                    opacity: 0,
                    position: "absolute",
                    right: 0,
                    top: 0,
                    pointerEvents: open ? "auto" : "none",
                }}
            />
        </div>
    );
}
