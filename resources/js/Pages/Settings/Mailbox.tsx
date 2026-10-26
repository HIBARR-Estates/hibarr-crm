import { Link, router, usePage } from "@inertiajs/react";
import DashboardLayout, { type PageProps } from "@/Components/DashboardLayout";
import PageLayout from "@/Components/PageLayout";
import ConnectMailboxModal from "@/Email/ConnectMailboxModal";
import useTranslation from "@/Hooks/useTranslation";
import "@/Components/Redesign/redesign.css";

type MailboxSettingsProps = {
    pageTitle: string;
};

export default function MailboxSettings({ pageTitle }: MailboxSettingsProps) {
    const { t } = useTranslation();
    const { props } = usePage<PageProps>();
    const breadcrumbs = [{ name: t("app.menu.settings_menu.mailbox") }];
    const pilotUrl = props.emailPilot?.manageUrl;

    return (
        <DashboardLayout>
            <PageLayout
                title={pageTitle}
                breadcrumbs={breadcrumbs}
                config={{ showTitle: true }}
            >
                <div className="mx-auto flex max-w-3xl flex-col gap-4">
                    {pilotUrl ? (
                        <Link
                            href={pilotUrl}
                            className="text-sm"
                            onClick={(event) => {
                                event.preventDefault();
                                router.visit(pilotUrl);
                            }}
                        >
                            {t("pages.email.pilot.open_from_mailbox")}
                        </Link>
                    ) : null}
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
