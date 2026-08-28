import { useCompanyDateTimeFormatVersion } from "@/Components/CompanyDateTimeProvider";
import { useUserDateTimeContextVersion } from "@/Components/UserDateTimeProvider";
import {
    formatUserDate,
    formatUserDateTime,
    formatUserTime,
    getUserDateTimeTimezone,
} from "@/lib/userDateTime";

export {
    formatUserDate,
    formatUserTime,
    formatUserDateTime,
};

/**
 * Format UTC instants for the current viewer.
 * Flag off: same as formatCompany* (browser local + company tokens).
 * Flag on: convert via Inertia viewerTimezone (UserTimezone::forViewer).
 */
export function useUserDateTime(): {
    timezone: string;
    formatDate: typeof formatUserDate;
    formatTime: typeof formatUserTime;
    formatDateTime: typeof formatUserDateTime;
} {
    useCompanyDateTimeFormatVersion();
    useUserDateTimeContextVersion();

    return {
        timezone: getUserDateTimeTimezone(),
        formatDate: formatUserDate,
        formatTime: formatUserTime,
        formatDateTime: formatUserDateTime,
    };
}
