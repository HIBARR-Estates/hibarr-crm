import { usePage } from "@inertiajs/react";
import { EXPOSE_SHARE_LINKS_FLAG } from "@/lib/exposeShareLinksFlag";

export default function useExposeShareLinksFlag(): boolean {
    const { props } = usePage();
    const featureFlags = props.featureFlags ?? {};

    return featureFlags[EXPOSE_SHARE_LINKS_FLAG] === true;
}
