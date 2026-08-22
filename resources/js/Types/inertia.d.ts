import { PageProps as InertiaPageProps } from "@inertiajs/core";
import { Currency, TFilter } from "@/Types/common";
import { AuthType } from ".";
import type { NotificationAlertSettingsState } from "@/contexts/NotificationAlertSettingsContext";

declare module "@inertiajs/core" {
    interface PageProps extends InertiaPageProps {
        filters?: TFilter;

        auth: AuthType;
        flash?: {
            success?: string;
            error?: string;
            message?: string;
        };
        company?: Company;
        languages?: Array<{ language_code: string; language_name: string }>;
        salutations?: Array<{ value: string; label: string }>;
        // Page-level reference lists (not globally shared — prefer controller props or useCountries/useCurrencies)
        currencies?: Currency[];
        countries?: Array<Country>;
        categories?: Array<{ id: number; category_name: string }>; //TODO: This needs to be properly considered  or will end up being a union later
        default_language?: string;
        default_currency_symbol?: string;
        default_currency_code?: string;
        isDarkMode?: boolean; // Example additional prop, not implemented yet
        pipelines?: Array<{ id: number; name: string; default: number }>;
        featureFlags?: Record<string, boolean>;
        locale?: string;
        isRtl?: boolean;
        availableLocales?: Record<
            string,
            { name: string; native: string; dir: string; flag: string }
        >;
        notificationAlertSettings?: NotificationAlertSettingsState | null;
    }
}
