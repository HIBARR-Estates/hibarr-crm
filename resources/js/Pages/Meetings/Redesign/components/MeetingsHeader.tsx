import { useTd } from "@/Hooks/useDynamicTranslation";
import useTranslation from "@/Hooks/useTranslation";
import Button from "@/Components/Redesign/primitives/Button";
import Icon from "@/Components/Redesign/primitives/Icon";
import Segmented from "@/Components/Redesign/primitives/Segmented";
import { REDESIGN_TOKENS as T, REDESIGN_TYPE } from "@/Components/Redesign/tokens";
import type { MeetingsViewMode } from "../adapters/meetingViewModel";

interface MeetingsHeaderProps {
    view: MeetingsViewMode;
    onViewChange: (view: MeetingsViewMode) => void;
    onRefresh: () => void;
    refreshing: boolean;
    onSchedule: () => void;
    canSchedule: boolean;
}

export default function MeetingsHeader({
    view,
    onViewChange,
    onRefresh,
    refreshing,
    onSchedule,
    canSchedule,
}: MeetingsHeaderProps) {
    const { td } = useTd();
    const { t } = useTranslation();

    return (
        <div className="flex flex-wrap items-start justify-between gap-4 pb-4">
            <div className="flex flex-col gap-1">
                <h1
                    className="m-0 font-bold leading-tight"
                    style={{
                        fontSize: REDESIGN_TYPE.DISPLAY,
                        color: T.NAVY,
                    }}
                >
                    {t("app.meetings.my_meetings")}
                </h1>
                <p className="m-0" style={{ fontSize: 13, color: T.TEXT_MUTED }}>
                    {td("Everything scheduled across your leads and deals.")}
                </p>
            </div>

            <div className="flex items-center gap-2.5">
                <Segmented<MeetingsViewMode>
                    value={view}
                    onChange={onViewChange}
                    variant="raised"
                    ariaLabel={td("Meeting view")}
                    options={[
                        {
                            value: "cards",
                            label: td("Cards"),
                            icon: <Icon name="grid" size={14} />,
                        },
                        {
                            value: "calendar",
                            label: td("Calendar"),
                            icon: <Icon name="calendar" size={14} />,
                        },
                    ]}
                />

                <Button
                    variant="ghost"
                    onClick={onRefresh}
                    disabled={refreshing}
                    icon={
                        <Icon
                            name="refresh"
                            size={15}
                            className={refreshing ? "animate-spin" : undefined}
                        />
                    }
                >
                    {td("Refresh")}
                </Button>

                {canSchedule && (
                    <Button
                        variant="primary"
                        onClick={onSchedule}
                        icon={<Icon name="plus" size={15} />}
                    >
                        {t("app.meetings.actions.schedule")}
                    </Button>
                )}
            </div>
        </div>
    );
}
