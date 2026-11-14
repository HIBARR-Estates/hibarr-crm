import { useCallback, useState } from "react";
import axios from "axios";
import { message } from "antd";
import type {
    Numbering,
    PaymentDocumentSettings,
    PaymentDocumentSettingsForm,
} from "./types";

/**
 * Invoices and receipts settings mutations.
 *
 * Local state is the source of truth: each call patches settings (and the
 * numbering counters) from the response instead of reloading the page.
 */
export default function usePaymentDocumentSettings(
    initial: PaymentDocumentSettings,
    fallbacks: { saved: string; saveFailed: string; uploadFailed: string },
) {
    const [settings, setSettings] = useState<PaymentDocumentSettings>(initial);
    const [numbering, setNumbering] = useState<Numbering | null>(null);
    const [saving, setSaving] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [errors, setErrors] = useState<Record<string, string>>({});

    const fail = (error: any, fallback: string) => {
        const fieldErrors = error?.response?.data?.errors as
            | Record<string, string[]>
            | undefined;
        if (fieldErrors) {
            setErrors(
                Object.fromEntries(
                    Object.entries(fieldErrors).map(([key, list]) => [key, list[0]]),
                ),
            );
        }
        const first = fieldErrors ? Object.values(fieldErrors)[0]?.[0] : undefined;
        message.error(first ?? error?.response?.data?.message ?? fallback);
    };

    const save = useCallback(
        async (values: PaymentDocumentSettingsForm) => {
            setSaving(true);
            setErrors({});
            try {
                const response = await axios.put(
                    route("payment-document-settings.api.update"),
                    values,
                );
                const data = response.data?.data;
                if (data?.settings) setSettings(data.settings);
                if (data?.numbering) setNumbering(data.numbering);
                message.success(response.data?.message ?? fallbacks.saved);
                return true;
            } catch (error) {
                fail(error, fallbacks.saveFailed);
                return false;
            } finally {
                setSaving(false);
            }
        },
        [fallbacks.saved, fallbacks.saveFailed],
    );

    const uploadLogo = useCallback(
        async (file: File) => {
            setUploading(true);
            try {
                const body = new FormData();
                body.append("logo", file);
                const response = await axios.post(
                    route("payment-document-settings.api.logo.store"),
                    body,
                );
                const next = response.data?.data?.settings;
                if (next) setSettings((prev) => ({ ...prev, logo_url: next.logo_url }));
                return true;
            } catch (error) {
                fail(error, fallbacks.uploadFailed);
                return false;
            } finally {
                setUploading(false);
            }
        },
        [fallbacks.uploadFailed],
    );

    const removeLogo = useCallback(async () => {
        setUploading(true);
        try {
            await axios.delete(route("payment-document-settings.api.logo.destroy"));
            setSettings((prev) => ({ ...prev, logo_url: null }));
            return true;
        } catch (error) {
            fail(error, fallbacks.saveFailed);
            return false;
        } finally {
            setUploading(false);
        }
    }, [fallbacks.saveFailed]);

    return {
        settings,
        numbering,
        setNumbering,
        saving,
        uploading,
        errors,
        save,
        uploadLogo,
        removeLogo,
    };
}
