import { Button } from "antd";
import { CheckCircleOutlined, PlusOutlined } from "@ant-design/icons";
import useTranslation from "@/Hooks/useTranslation";

interface Props {
    onDone: () => void;
    onBookAnother: () => void;
}

const MeetingSuccessStep: React.FC<Props> = ({ onDone, onBookAnother }) => {
    const { t } = useTranslation();

    return (
        <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
            <CheckCircleOutlined className="text-5xl text-green-500 mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
                {t("app.meetings.success.title")}
            </h3>
            <p className="text-sm text-gray-500 mb-8 max-w-sm">
                {t("app.meetings.success.description")}
            </p>
            <div className="flex flex-col sm:flex-row gap-3 w-full max-w-xs">
                <Button type="primary" block onClick={onBookAnother} icon={<PlusOutlined />}>
                    {t("app.meetings.success.book_another")}
                </Button>
                <Button block onClick={onDone}>
                    {t("app.meetings.success.done")}
                </Button>
            </div>
        </div>
    );
};

export default MeetingSuccessStep;
