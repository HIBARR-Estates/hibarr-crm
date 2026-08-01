/**
 * Avatar initials from a person's name.
 *
 * Filters empty segments so double spaces and trailing whitespace don't yield
 * `undefined` slots (the old copies produced "J" for "John  Doe").
 */
export function initialsFromName(name?: string | null): string {
    if (!name) return "--";
    const initials = name
        .split(" ")
        .map((part) => part.trim())
        .filter(Boolean)
        .map((part) => part[0])
        .slice(0, 2)
        .join("")
        .toUpperCase();

    return initials || "--";
}

export default initialsFromName;
