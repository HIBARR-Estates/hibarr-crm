import { useState } from "react";
import { DatePicker } from "antd";
import dayjs from "dayjs";
import useTranslation from "@/Hooks/useTranslation";
import DealButton from "../primitives/DealButton";
import DealIcon from "../primitives/DealIcon";
import type { DealTimelineDateRange } from "../../hooks/useDealTimeline";
import { DEAL_REDESIGN_TOKENS as T } from "../../tokens";

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
        ? `${dayjs(value.from).format("MMM D")} – ${dayjs(value.to).format("MMM D")}`
        : t("pages.deals.timeline.date_range_placeholder");

    return (
        <div className="relative">
            <DealButton
                variant="ghost"
                icon={<DealIcon name="calendar" size={12} />}
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
            </DealButton>
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
