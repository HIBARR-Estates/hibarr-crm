import type { ReactNode } from "react";
import useTranslation from "@/Hooks/useTranslation";
import Icon from "@/Components/Redesign/primitives/Icon";
import { REDESIGN_RADIUS as R, REDESIGN_TOKENS as T } from "@/Components/Redesign/tokens";

export interface MeetingsOverviewStats {
    upcoming: number;
    this_week: number;
    live: number;
    completed: number;
}

interface StatTileProps {
    badge: ReactNode;
    badgeBg: string;
    value: number;
    label: string;
}

function StatTile({ badge, badgeBg, value, label }: StatTileProps) {
    return (
        <div
            className="flex items-center gap-3.5 p-4"
            style={{
                background: T.WHITE,
                border: `1px solid ${T.BORDER}`,
                borderRadius: 10,
            }}
        >
            <span
                aria-hidden="true"
                className="inline-flex h-11 w-11 shrink-0 items-center justify-center"
                style={{ background: badgeBg, borderRadius: R.MD }}
            >
                {badge}
            </span>
            <div>
                <div
                    className="font-bold leading-none"
                    style={{ fontSize: 24, color: T.NAVY }}
                >
                    {value}
                </div>
                <div
                    className="mt-1"
                    style={{ fontSize: 13, color: T.TEXT_MUTED }}
                >
                    {label}
                </div>
            </div>
        </div>
    );
}

export default function MeetingsStats({
    stats,
}: {
    stats: MeetingsOverviewStats;
}) {
    const { t } = useTranslation();

    return (
        <div className="mb-7 grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatTile
                badge={<Icon name="calendar" size={20} color={T.BLUE} />}
                badgeBg={T.BLUE_LIGHT}
                value={stats.upcoming}
                label={t("app.meetings.stats.upcoming")}
            />
            <StatTile
                badge={<Icon name="clock" size={20} color={T.NAVY} />}
                badgeBg={T.NAVY_SOFT}
                value={stats.this_week}
                label={t("app.meetings.stats.this_week")}
            />
            <StatTile
                badge={
                    <span
                        className="animate-pulse rounded-full"
                        style={{ width: 11, height: 11, background: T.RED }}
                    />
                }
                badgeBg={T.RED_SOFT}
                value={stats.live}
                label={t("app.meetings.stats.live_now")}
            />
            <StatTile
                badge={<Icon name="check-square" size={20} color={T.GREEN} />}
                badgeBg={T.GREEN_LIGHT}
                value={stats.completed}
                label={t("app.meetings.stats.completed")}
            />
        </div>
    );
}
