/** The employee an admin was acting for, when this event says so. */
export function onBehalfOfName(
    metadata: { on_behalf_of_name?: unknown } | null | undefined,
): string {
    const name = metadata?.on_behalf_of_name;

    return typeof name === "string" ? name.trim() : "";
}
