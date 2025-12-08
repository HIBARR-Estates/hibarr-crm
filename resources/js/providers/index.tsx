import React from "react";
import ReactQueryProvider from "./react-query/ReactQueryProviders";
import AntdConfigProvider from "./antd/AntdConfigProvider";
import { FilterProvider } from "@/contexts/FilterContext";

export const Providers: React.FC<{ children: React.ReactNode }> = ({
    children,
}) => {
    return (
        <ReactQueryProvider>
            <AntdConfigProvider>
                <FilterProvider>{children}</FilterProvider>
            </AntdConfigProvider>
        </ReactQueryProvider>
    );
};
