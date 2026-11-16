import dayjs from "dayjs";
import timezonePlugin from "dayjs/plugin/timezone";
import utc from "dayjs/plugin/utc";
import { dayKeyIn } from "../timeState";
import { companyTimeDayjsFormat } from "@/lib/companyDateTime";

dayjs.extend(utc);
dayjs.extend(timezonePlugin);

type Translate = (key: string, params?: Record<string, string | number>) => string;

/** "0:08": how long the call has been ringing. */
export function ringClock(startedAt: number, nowMs: number): string {
    const seconds = Math.max(0, Math.floor((nowMs - startedAt) / 1000));
    return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

/** "2 days ago" in the viewer's language, from an instant. */
export function agoText(iso: string, nowMs: number, locale: string): string {
    const diffMs = Date.parse(iso) - nowMs;
    const formatter = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
    const minutes = Math.round(diffMs / 60_000);
    if (Math.abs(minutes) < 60) return formatter.format(minutes, "minute");
    const hours = Math.round(diffMs / 3_600_000);
    if (Math.abs(hours) < 24) return formatter.format(hours, "hour");
    return formatter.format(Math.round(diffMs / 86_400_000), "day");
}

/** "Presentation today 15:00": the meeting's title and when, within the next two days. */
export function meetingText(title: string | null, iso: string, nowMs: number, timeZone: string, locale: string, t: Translate): string {
    const value = timeZone ? dayjs(iso).tz(timeZone) : dayjs(iso);
    const time = value.format(companyTimeDayjsFormat());
    const today = dayKeyIn(nowMs, timeZone);
    const day = dayKeyIn(Date.parse(iso), timeZone);
    const diff = Math.round((Date.parse(`${day}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000);
    const name = title?.trim() || t("pages.agent_workspace.incoming.meeting_fallback");
    if (diff <= 0) return t("pages.agent_workspace.incoming.meeting_today", { title: name, time });
    if (diff === 1) return t("pages.agent_workspace.incoming.meeting_tomorrow", { title: name, time });
    const weekday = new Intl.DateTimeFormat(locale, { weekday: "long", timeZone: timeZone || undefined }).format(new Date(iso));
    return t("pages.agent_workspace.incoming.meeting_later", { title: name, day: weekday, time });
}
