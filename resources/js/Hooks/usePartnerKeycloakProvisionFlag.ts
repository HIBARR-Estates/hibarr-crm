import { usePage } from "@inertiajs/react";

export const PARTNER_KEYCLOAK_PROVISION_FLAG = "crm.partner-keycloak-provision";

/**
 * crm.partner-keycloak-provision — when on, inviting a partner creates their
 * Keycloak identity and the identity provider emails them to set a password.
 * Off, only the CRM welcome mail goes out. Shared via Inertia's featureFlags
 * prop (see HandleInertiaRequests).
 */
export default function usePartnerKeycloakProvisionFlag(): boolean {
    const { props } = usePage();
    const featureFlags = props.featureFlags ?? {};

    return featureFlags[PARTNER_KEYCLOAK_PROVISION_FLAG] === true;
}
