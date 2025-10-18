import React from "react";
import ReactQueryProvider from "./react-query/ReactQueryProviders";
import AntdConfigProvider from "./antd/AntdConfigProvider";

export const Providers: React.FC<{ children: React.ReactNode }> = ({
    children,
}) => {
    return (
        <ReactQueryProvider>
            <AntdConfigProvider>{children}</AntdConfigProvider>
        </ReactQueryProvider>
    );
};
