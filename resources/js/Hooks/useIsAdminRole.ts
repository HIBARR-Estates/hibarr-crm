import { usePage } from "@inertiajs/react";

/**
 * True when the signed-in user actually holds the `admin` role.
 *
 * This is deliberately distinct from `useDealPermissions().hasFullDealAccess`,
 * which only reports that the user's `edit_deals` scope is "all" — a manager
 * role can have that without being an admin.
 *
 * Use this (and only this) wherever the backend gates on `hasRole('admin')`,
 * so the UI never offers an action the API will reject. Current backend
 * counterpart: `CrmEventController::userCanManageEvents`.
 */
export default function useIsAdminRole(): boolean {
    const { props } = usePage<any>();

    return Boolean(
        props.auth?.user?.roles?.some(
            (role: { name?: string }) => role?.name === "admin",
        ),
    );
}
