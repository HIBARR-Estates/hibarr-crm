import { AuthType } from "@/Types";
import { usePage } from "@inertiajs/react";
import { useQuery } from "@tanstack/react-query";
import axios from "axios";

const getData = async <
    QueryResponse,
    Params extends Record<string, string | number> = Record<
        string,
        string | number
    >
>(props: {
    path: string;
    params?: Params;
    auth?: AuthType;
}): Promise<QueryResponse | void> => {
    const url = `${props.path}`;

    if (url.indexOf("undefined") !== -1) {
        return;
    }

    const config = {
        headers: {
            Accept: "application/json",
        },
        params: props?.params,
    };

    const res = await axios.get<QueryResponse>(url, config);
    return res.data;
};

export const useApiQuery = <
    QueryResponse,
    Params extends Record<string, string | number> = Record<
        string,
        string | number
    >
>(input: {
    path: string;
    params?: Params;
}) => {
    const { props } = usePage();
    const { auth } = props;

    const { params, path } = input;

    const queryData = useQuery({
        queryKey: [path, params],
        queryFn: () =>
            getData<QueryResponse, Params>({
                auth,
                params,
                path,
            }),
    });

    return queryData;
};
