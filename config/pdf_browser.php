<?php

/*
|--------------------------------------------------------------------------
| Headless browser paths for Browsershot (expose PDFs)
|--------------------------------------------------------------------------
|
| All empty by default, which keeps Browsershot's own lookup (global npm
| Puppeteer, system Chrome) as on the Jenkins hosts. The Docker `pdf` flavor
| sets these because Node, Puppeteer and Chromium live in non-standard places.
|
*/

return [
    'node_binary' => env('BROWSERSHOT_NODE_BINARY'),
    'node_modules_path' => env('BROWSERSHOT_NODE_MODULES_PATH'),
    'chrome_path' => env('BROWSERSHOT_CHROME_PATH'),
];
