import { ConfigProvider } from "antd";
import { antdMainThemeConfig } from "./utils";

const AntdConfigProvider: React.FC<{ children: React.ReactNode }> = ({
    children,
}) => {
    return (
        <>
            <ConfigProvider theme={antdMainThemeConfig}>
                {children}
            </ConfigProvider>
        </>
    );
};

export default AntdConfigProvider;
