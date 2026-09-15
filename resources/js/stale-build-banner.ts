import { hardRefresh, startStaleBuildWatcher } from "./lib/staleBuildCheck";

const BANNER_ID = "stale-build-banner";

function bootIdFromMeta(): string | null {
    const el = document.querySelector('meta[name="app-build"]');
    const value = el?.getAttribute("content")?.trim();
    return value ? value : null;
}

function showBanner(): void {
    if (document.getElementById(BANNER_ID)) {
        return;
    }

    const bar = document.createElement("div");
    bar.id = BANNER_ID;
    bar.setAttribute("role", "status");
    bar.style.cssText = [
        "position:fixed",
        "top:0",
        "left:0",
        "right:0",
        "z-index:1450",
        "background:#fffbeb",
        "color:#b45309",
        "border-bottom:1px solid #fde68a",
        "padding:10px 16px",
        "font:500 14px/1.4 'IBM Plex Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif",
        "text-align:center",
    ].join(";");

    bar.appendChild(
        document.createTextNode(
            "A new version of the application is available. ",
        ),
    );

    const button = document.createElement("button");
    button.type = "button";
    button.textContent = "Refresh now";
    button.style.cssText =
        "background:none;border:none;padding:0;color:#b45309;font:inherit;text-decoration:underline;cursor:pointer;";
    button.addEventListener("click", () => {
        void hardRefresh();
    });
    bar.appendChild(button);
    document.body.prepend(bar);
}

const bootId = bootIdFromMeta();
if (bootId) {
    startStaleBuildWatcher({
        bootId,
        onStale: showBanner,
    });
}
