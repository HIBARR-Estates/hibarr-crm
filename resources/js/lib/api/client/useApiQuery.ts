import { AuthType } from "@/Types";
import { usePage } from "@inertiajs/react";
import {
    useQuery,
    useInfiniteQuery,
    keepPreviousData,
} from "@tanstack/react-query";
import axios from "axios";

const getData = async <
    QueryResponse,
    Params extends Record<string, string | number | any> = Record<
        string,
        string | number | any
    >,
>(props: {
    path: string;
    params?: Params;
    auth?: AuthType;
}): Promise<QueryResponse> => {
    const url = `${props.path}`;

    if (url.indexOf("undefined") !== -1) {
        throw new Error("Invalid URL: contains 'undefined'");
    }

    const config = {
        headers: {
            Accept: "application/json",
            ...(props.auth?.user?.company_id
                ? { "X-COMPANY-ID": String(props?.auth?.user?.company_id || 1) }
                : {}),
        },
        params: props?.params,
    };

    const res = await axios.get<QueryResponse>(url, config);
    return res.data;
};

export const useApiQuery = <
    QueryResponse,
    Params extends Record<string, string | number | boolean> = Record<
        string,
        string | number | boolean
    >,
>(input: {
    path: string;
    params?: Params;
    options?: {
        enabled?: boolean;
        refetchInterval?: number | false;
        staleTime?: number;
    };
}) => {
    const { props } = usePage();
    const { auth } = props;

    const { params, path, options } = input;

    const queryData = useQuery({
        queryKey: [path, params],
        queryFn: () =>
            getData<QueryResponse, Params>({
                auth,
                params,
                path,
            }),
        ...options,
    });

    return queryData;
};

export const useApiInfiniteQuery = <
    QueryResponse,
    Params extends { page: number } & Record<string, any> = { page: number },
>(input: {
    path: string;
    params: Params; // required for infinite query to include page
    getNextPageParam: (
        lastPage: QueryResponse,
        allPages: QueryResponse[],
    ) => unknown;
    initialPageParam?: number;
    /** Keeps the previous page's data on screen while a new query key (e.g.
     * a changed filter) loads, instead of resetting to an empty list. */
    keepPreviousPageData?: boolean;
    options?: Partial<{
        staleTime: number;
        cacheTime: number;
        refetchOnWindowFocus: boolean;
    }>;
}) => {
    const { props } = usePage();
    const { auth } = props;

    const {
        params,
        path,
        getNextPageParam,
        initialPageParam = 1,
        keepPreviousPageData = false,
        options,
    } = input;

    const queryData = useInfiniteQuery({
        queryKey: [path, params],
        queryFn: (props) => {
            params.page = props.pageParam as number;
            return getData<QueryResponse, Params>({
                auth,
                params,
                path,
            });
        },
        getNextPageParam,
        initialPageParam,
        ...(keepPreviousPageData ? { placeholderData: keepPreviousData } : {}),

        ...options,
    });

    return queryData;
};
