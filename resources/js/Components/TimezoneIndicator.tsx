import { useMemo, useState } from "react";
import { Button, Popover } from "antd";
import { ClockCircleOutlined, RightOutlined } from "@ant-design/icons";
import { router } from "@inertiajs/react";
import { useTd } from "@/Hooks/useDynamicTranslation";
import { useUserDateTime } from "@/Hooks/useUserDateTime";
import { isUserDateTimeEnabled } from "@/lib/userDateTime";
import {
    timezoneChipLabel,
    timezoneCity,
    timezoneUtcOffset,
} from "@/lib/timezoneLabel";
import {
    REDESIGN_FONT_STACK,
    REDESIGN_RADIUS,
    REDESIGN_TOKENS as T,
    REDESIGN_TYPE,
} from "@/Components/Redesign/tokens";

const PREFERENCES_URL = "/account/settings/preferences";

export default function TimezoneIndicator() {
    const { td } = useTd();
    const { timezone } = useUserDateTime();
    const [open, setOpen] = useState(false);

    const city = useMemo(() => timezoneCity(timezone), [timezone]);
    const offset = useMemo(() => timezoneUtcOffset(timezone), [timezone]);
    const chipLabel = useMemo(() => timezoneChipLabel(timezone), [timezone]);
    const showOffsetBesideCity = !(city === "UTC" && offset === "UTC");

    if (!isUserDateTimeEnabled()) {
        return null;
    }

    const content = (
        <div
            style={{
                width: 268,
                fontFamily: REDESIGN_FONT_STACK,
            }}
        >
            <div style={{ padding: "14px 16px 12px" }}>
                <div
                    style={{
                        fontSize: 11,
                        fontWeight: 600,
                        letterSpacing: "0.08em",
                        textTransform: "uppercase",
                        color: T.TEXT_HINT,
                    }}
                >
                    {td("Timezone", { source: "en" })}
                </div>
                <div
                    style={{
                        marginTop: 8,
                        display: "flex",
                        alignItems: "baseline",
                        gap: 8,
                        minWidth: 0,
                    }}
                >
                    <span
                        style={{
                            fontSize: REDESIGN_TYPE.DISPLAY,
                            fontWeight: 600,
                            color: T.TEXT,
                            letterSpacing: "-0.03em",
                            lineHeight: 1.15,
                        }}
                    >
                        {city}
                    </span>
                    {showOffsetBesideCity && (
                        <span
                            style={{
                                fontSize: REDESIGN_TYPE.BODY,
                                color: T.TEXT_MUTED,
                                fontVariantNumeric: "tabular-nums",
                            }}
                        >
                            {offset}
                        </span>
                    )}
                </div>
                <div
                    style={{
                        marginTop: 4,
                        fontSize: REDESIGN_TYPE.CAPTION,
                        color: T.TEXT_HINT,
                        letterSpacing: "0.01em",
                    }}
                >
                    {timezone}
                </div>
                <p
                    style={{
                        margin: "12px 0 0",
                        fontSize: REDESIGN_TYPE.BODY,
                        color: T.TEXT_MUTED,
                        lineHeight: 1.45,
                    }}
                >
                    {td("Times on this page are shown in this zone.", {
                        source: "en",
                    })}
                </p>
            </div>
            <div
                style={{
                    borderTop: `1px solid ${T.BORDER_SOFT}`,
                    background: T.SURFACE_2,
                    padding: "6px 8px",
                }}
            >
                <Button
                    type="link"
                    size="small"
                    onClick={() => {
                        setOpen(false);
                        router.visit(PREFERENCES_URL);
                    }}
                    className="flex w-full items-center justify-between !px-2"
                    style={{
                        color: T.BLUE,
                        height: 32,
                        fontSize: REDESIGN_TYPE.BODY,
                    }}
                >
                    <span>
                        {td("Change in Preferences", { source: "en" })}
                    </span>
                    <RightOutlined style={{ fontSize: 10 }} />
                </Button>
            </div>
        </div>
    );

    return (
        <Popover
            content={content}
            trigger="click"
            placement="bottomRight"
            arrow={{ pointAtCenter: true }}
            open={open}
            onOpenChange={setOpen}
            styles={{
                body: {
                    padding: 0,
                    overflow: "hidden",
                    borderRadius: REDESIGN_RADIUS.MD,
                    boxShadow:
                        "0 10px 28px rgba(22, 41, 77, 0.10), 0 1px 3px rgba(22, 41, 77, 0.06)",
                },
            }}
        >
            <Button
                icon={<ClockCircleOutlined />}
                aria-label={`${td("Timezone", { source: "en" })}: ${chipLabel}`}
                aria-expanded={open}
                className="inline-flex items-center"
            >
                <span className="hidden whitespace-nowrap tabular-nums sm:inline">
                    {chipLabel}
                </span>
            </Button>
        </Popover>
    );
}
