import dayjs from "dayjs";

const PHP_TO_DAYJS: Record<string, string> = {
    d: "DD",
    D: "ddd",
    j: "D",
    l: "dddd",
    N: "E",
    S: "Do",
    w: "d",
    z: "DDD",
    W: "W",
    F: "MMMM",
    m: "MM",
    M: "MMM",
    n: "M",
    Y: "YYYY",
    y: "YY",
    a: "a",
    A: "A",
    g: "h",
    G: "H",
    h: "hh",
    H: "HH",
    i: "mm",
    s: "ss",
};

export function mapPhpToDayjsFormat(format: string): string {
    return format
        .split("")
        .map((char) => PHP_TO_DAYJS[char] || char)
        .join("");
}

export function formatDueDateForApi(isoDate: string, dateFormat: string): string {
    return dayjs(`${isoDate}T12:00:00`).format(mapPhpToDayjsFormat(dateFormat));
}
