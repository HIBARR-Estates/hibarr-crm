import { PageProps as InertiaPageProps } from "@inertiajs/core";
import { Currency, TFilter } from "@/Types/common";
import { AuthType } from ".";

declare module "@inertiajs/core" {
    interface PageProps extends InertiaPageProps {
        filters: TFilter;

        auth: AuthType;
        flash?: {
            success?: string;
            error?: string;
        };
        currencies?: Currency[];
        languages?: Array<{ language_code: string; language_name: string }>;
        salutations?: Array<{ value: string; label: string }>;
        countries?: Array<Country>;
        categories?: Array<{ id: number; category_name: string }>; //TODO: This needs to be properly considered  or will end up being a union later
        default_language?: string;
        default_currency_symbol?: string;
        default_currency_code?: string;
        isDarkMode?: boolean; // Example additional prop, not implemented yet
    }
}
