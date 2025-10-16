import React from "react";

type Props = {
    mutationFn?: () => Promise<any>;
};

const useApiMutate = ({ mutationFn }: Props) => {
    const [status, setStatus] = React.useState<
        "idle" | "loading" | "success" | "error"
    >("idle");

    const mutateAsync = async () => {
        setStatus("loading");
        try {
            await mutationFn?.();
            setStatus("success");
        } catch (error) {
            setStatus("error");
        }
    };

    const mutate = () => {
        mutateAsync();
    };

    return { status, isLoading: status === "loading", mutate, mutateAsync };
};

export default useApiMutate;
