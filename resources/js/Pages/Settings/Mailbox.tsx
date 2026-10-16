import DashboardLayout from "@/Components/DashboardLayout";
import PageLayout from "@/Components/PageLayout";
import ConnectMailboxModal from "@/Email/ConnectMailboxModal";
import useTranslation from "@/Hooks/useTranslation";
import "@/Components/Redesign/redesign.css";

type MailboxSettingsProps = {
    pageTitle: string;
};

export default function MailboxSettings({ pageTitle }: MailboxSettingsProps) {
    const { t } = useTranslation();
    const breadcrumbs = [{ name: t("app.menu.settings_menu.mailbox") }];

    return (
        <DashboardLayout>
            <PageLayout
                title={pageTitle}
                breadcrumbs={breadcrumbs}
                config={{ showTitle: true }}
            >
                <div className="mx-auto max-w-3xl">
                    <ConnectMailboxModal
                        open
                        variant="page"
                        onClose={() => undefined}
                    />
                </div>
            </PageLayout>
        </DashboardLayout>
    );
}
