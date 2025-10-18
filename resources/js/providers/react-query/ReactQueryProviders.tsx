import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const queryClient = new QueryClient({
    defaultOptions: {
        mutations: {
            retry: false,
            onError: (err) => {
                console.error("Mutation error:", err);
            },
        },
    },
});

const ReactQueryProvider: React.FC<{ children: React.ReactNode }> = ({
    children,
}) => {
    return (
        <QueryClientProvider client={queryClient}>
            {children}
        </QueryClientProvider>
    );
};

export default ReactQueryProvider;
