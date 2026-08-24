import axios from "axios";
import { mergeQueryParams } from "@/lib/inertiaQuery";
import type { Task } from "@/Types/Task";

export interface TableTasksPayload {
    data: Task[];
    current_page: number;
    total: number;
    per_page: number;
    last_page: number;
}

interface InertiaPartialResponse {
    props: {
        tableTasks: TableTasksPayload;
    };
}

/**
 * Fetches a single paginated tasks page via an Inertia partial request.
 * Used to prefetch page N+1 without a full navigation.
 */
export async function fetchTableTasksPage(
    page: number,
    perPage: number,
    inertiaMeta: { version: string | null; component: string },
): Promise<TableTasksPayload> {
    const response = await axios.get<InertiaPartialResponse>(
        route("tasks.index"),
        {
            params: mergeQueryParams({ page, per_page: perPage }),
            headers: {
                "X-Inertia": "true",
                "X-Inertia-Version": inertiaMeta.version ?? "",
                "X-Inertia-Partial-Data": "tableTasks",
                "X-Inertia-Partial-Component": inertiaMeta.component,
                "X-Requested-With": "XMLHttpRequest",
                Accept: "application/json",
            },
        },
    );

    return response.data.props.tableTasks;
}
