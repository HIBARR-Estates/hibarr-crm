import { Button, Modal } from "@/Components/Redesign";
import useTranslation from "@/Hooks/useTranslation";

export interface ConnectMailboxModalProps {
    open: boolean;
    onClose: () => void;
}

/**
 * Shown when the Email Quick action is available (flag + allowlist) but the
 * signed-in user has no mailbox connection yet. Full connect form is E-33.
 */
export default function ConnectMailboxModal({
    open,
    onClose,
}: ConnectMailboxModalProps) {
    const { t } = useTranslation();

    return (
        <Modal
            open={open}
            title={t("pages.email.connect.title")}
            onClose={onClose}
            closeAriaLabel={t("pages.email.connect.close")}
            closeOnBackdrop
            footer={
                <Button type="button" variant="primary" onClick={onClose}>
                    {t("pages.email.connect.close")}
                </Button>
            }
        >
            <p className="m-0 text-sm leading-relaxed text-dr-text-muted">
                {t("pages.email.connect.body")}
            </p>
        </Modal>
    );
}
