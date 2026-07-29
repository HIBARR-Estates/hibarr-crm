import { usePage } from "@inertiajs/react";
import { setCompanyTimeFormat } from "@/lib/taskDateTime";

/**
 * Publishes company.time_format into the shared task/date formatters so
 * every task time display respects App Settings (12h vs 24h).
 * Runs during render (like setDealDateLocale) so the first paint is correct.
 */
export default function CompanyDateTimeSync() {
    const { props } = usePage<{
        company?: { time_format?: string } | null;
    }>();

    setCompanyTimeFormat(props.company?.time_format);

    return null;
}
