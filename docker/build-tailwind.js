const fs = require("fs");
const postcss = require("postcss");
const tailwind = require("@tailwindcss/postcss");
const autoprefixer = require("autoprefixer");

const from = "resources/css/tailwind.css";
const to = "public/css/tailwind.css";

postcss([tailwind(), autoprefixer()])
    .process(fs.readFileSync(from, "utf8"), { from, to })
    .then((result) => {
        const css = result.css
            .replace(
                /img,\s*svg,\s*video,\s*canvas,\s*audio,\s*iframe,\s*embed,\s*object\s*{[^}]*}/g,
                "img, video, canvas, audio, iframe, embed, object { display: block; vertical-align: middle; }",
            )
            .replace(/\.collapse\s*{[^}]*}/g, "");
        fs.mkdirSync("public/css", { recursive: true });
        fs.writeFileSync(to, css);
    })
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
