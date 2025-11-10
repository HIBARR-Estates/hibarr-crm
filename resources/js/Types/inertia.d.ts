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
        default_currency_symbol?: string;
        default_currency_code?: string;
        isDarkMode?: boolean; // Example additional prop, not implemented yet
    }
}
