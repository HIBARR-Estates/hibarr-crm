import axios from "axios";
import { mergeQueryParams } from "@/lib/inertiaQuery";
import type { PaginatedFollowupResponse } from "@/Types/api/deal-followup";

interface InertiaPartialResponse {
    props: {
        meetings: PaginatedFollowupResponse;
    };
}

/**
 * One paginated meetings page, via an Inertia partial request.
 *
 * Used to fetch page N+1 in the background without navigating, so the pager
 * has the next page in hand before it is asked for.
 */
export async function fetchMeetingsPage(
    page: number,
    perPage: number,
    inertiaMeta: { version: string | null; component: string },
): Promise<PaginatedFollowupResponse> {
    const response = await axios.get<InertiaPartialResponse>(
        route("meetings.index"),
        {
            params: mergeQueryParams({ page, per_page: perPage }),
            headers: {
                "X-Inertia": "true",
                "X-Inertia-Version": inertiaMeta.version ?? "",
                "X-Inertia-Partial-Data": "meetings",
                "X-Inertia-Partial-Component": inertiaMeta.component,
                "X-Requested-With": "XMLHttpRequest",
                Accept: "application/json",
            },
        },
    );

    return response.data.props.meetings;
}
