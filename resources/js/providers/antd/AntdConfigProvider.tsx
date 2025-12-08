import { ConfigProvider, App } from "antd";
import { antdMainThemeConfig } from "./utils";

const AntdConfigProvider: React.FC<{ children: React.ReactNode }> = ({
    children,
}) => {
    return (
        <ConfigProvider theme={antdMainThemeConfig}>
            <App>
                {children}
            </App>
        </ConfigProvider>
    );
};

export default AntdConfigProvider;
