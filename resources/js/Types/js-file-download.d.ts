declare module "js-file-download" {
    function download(
        data: Blob | string,
        filename: string,
        mime?: string
    ): void;
    export = download;
}
