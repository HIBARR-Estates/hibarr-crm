<?php

/**
 * Audit CRM frontend t("pages.*") keys against resources/lang/eng/pages.php.
 *
 * Handles:
 * - Single- and multi-line t("pages.xxx") / t('pages.xxx')
 * - Template literals t(`pages.xxx.${var}`) expanded with pattern-aware resolvers
 */

$pages = require __DIR__ . '/../resources/lang/eng/pages.php';

function flatten(array $arr, string $prefix = ''): array
{
    $flat = [];
    foreach ($arr as $k => $v) {
        $key = $prefix ? "{$prefix}.{$k}" : $k;
        if (is_array($v)) {
            $flat = array_merge($flat, flatten($v, $key));
        } else {
            $flat[$key] = $v;
        }
    }

    return $flat;
}

/**
 * @return array{static: string[], dynamic: array<int, array{pattern: string, expanded: string[], resolver: string}>}
 */
function extractKeysFromFile(string $content, array $pages): array
{
    $static = [];
    $dynamic = [];

    preg_match_all(
        '/t\s*\(\s*["\'](pages\.[^"\']+)["\']\s*[,)]/s',
        $content,
        $staticMatches
    );
    foreach ($staticMatches[1] as $key) {
        $static[] = trim($key);
    }

    preg_match_all('/t\s*\(\s*`([^`]+)`\s*[,)]/s', $content, $allTemplates);
    $seenPatterns = [];

    foreach ($allTemplates[1] as $pattern) {
        if (!str_starts_with($pattern, 'pages.') || !str_contains($pattern, '${')) {
            continue;
        }

        if (isset($seenPatterns[$pattern])) {
            continue;
        }
        $seenPatterns[$pattern] = true;

        [$expanded, $resolver] = expandDynamicPattern($pattern, $content, $pages);
        $dynamic[] = [
            'pattern'  => $pattern,
            'expanded' => $expanded,
            'resolver' => $resolver,
        ];
    }

    return [
        'static'  => array_unique($static),
        'dynamic' => $dynamic,
    ];
}

/**
 * @return array{0: string[], 1: string}
 */
function expandDynamicPattern(string $pattern, string $fileContent, array $pages): array
{
    if (str_contains($pattern, 'construction_project_photos.asset_tags.${key}')) {
        $values = extractConstStringArray($fileContent, 'ASSET_TAG_KEYS');

        return [mapPatternValues($pattern, $values), 'ASSET_TAG_KEYS'];
    }

    if (str_contains($pattern, 'config.categories.${slug}')) {
        $slugs = array_keys($pages['properties']['config']['categories'] ?? []);

        return [mapPatternValues($pattern, $slugs), 'pages.properties.config.categories'];
    }

    if (str_contains($pattern, 'deals.tabs.${item.key}')) {
        // Only tab items whose label is a JSX element (not a plain string / t() string)
        preg_match_all(
            '/key:\s*["\']([^"\']+)["\']\s*,\s*label:\s*\(/s',
            $fileContent,
            $jsxLabelMatches
        );
        $values = $jsxLabelMatches[1] ?? [];

        return [mapPatternValues($pattern, $values), 'tab items with JSX labels'];
    }

    // Generic fallback: substitute every key: "..." in the file
    preg_match_all('/\bkey:\s*["\']([^"\']+)["\']/', $fileContent, $keyMatches);
    $values = array_unique($keyMatches[1] ?? []);

    return [mapPatternValues($pattern, $values), 'generic key: "..." scan'];
}

/**
 * @return string[]
 */
function extractConstStringArray(string $content, string $constName): array
{
    if (!preg_match('/const\s+' . preg_quote($constName, '/') . '\s*[^=]*=\s*\[(.*?)\];/s', $content, $match)) {
        return [];
    }

    preg_match_all('/["\']([^"\']+)["\']/', $match[1], $values);

    return array_unique($values[1] ?? []);
}

/**
 * @param string[] $values
 * @return string[]
 */
function mapPatternValues(string $pattern, array $values): array
{
    if ($values === []) {
        return [];
    }

    $expanded = [];
    foreach ($values as $value) {
        $expanded[] = preg_replace('/\$\{[^}]+\}/', $value, $pattern);
    }

    return array_unique($expanded);
}

$flat = flatten($pages, 'pages');
$missingStatic = [];
$missingDynamic = [];
$dynamicPatterns = [];

$iterator = new RecursiveIteratorIterator(
    new RecursiveDirectoryIterator(__DIR__ . '/../resources/js')
);

foreach ($iterator as $file) {
    if (!$file->isFile() || !preg_match('/\.tsx?$/', $file->getFilename())) {
        continue;
    }

    $content = file_get_contents($file->getPathname());
    $extracted = extractKeysFromFile($content, $pages);

    foreach ($extracted['static'] as $key) {
        if (!isset($flat[$key])) {
            $missingStatic[$key] = true;
        }
    }

    foreach ($extracted['dynamic'] as $entry) {
        $pattern = $entry['pattern'];
        $dynamicPatterns[$pattern] = [
            'expanded' => $entry['expanded'],
            'resolver' => $entry['resolver'],
        ];

        foreach ($entry['expanded'] as $resolvedKey) {
            if (!isset($flat[$resolvedKey])) {
                $missingDynamic[$resolvedKey] = $pattern;
            }
        }
    }
}

ksort($missingStatic);
ksort($missingDynamic);

if ($dynamicPatterns !== []) {
    echo "DYNAMIC PATTERNS:\n";
    foreach ($dynamicPatterns as $pattern => $info) {
        echo "  `{$pattern}`\n";
        echo "    resolver: {$info['resolver']}\n";
        if ($info['expanded'] === []) {
            echo "    → (no values resolved)\n";
            continue;
        }
        foreach ($info['expanded'] as $resolved) {
            $status = isset($flat[$resolved]) ? 'ok' : 'MISSING';
            echo "    → {$resolved} [{$status}]\n";
        }
    }
    echo "\n";
}

if ($missingStatic !== []) {
    echo "MISSING STATIC KEYS:\n";
    foreach (array_keys($missingStatic) as $key) {
        echo $key . PHP_EOL;
    }
    echo "\n";
}

if ($missingDynamic !== []) {
    echo "MISSING FROM DYNAMIC EXPANSION:\n";
    foreach ($missingDynamic as $key => $pattern) {
        echo "{$key}  (from `{$pattern}`)\n";
    }
    echo "\n";
}

$totalMissing = count($missingStatic) + count($missingDynamic);

if ($totalMissing === 0) {
    echo "TOTAL MISSING: 0\n";
} else {
    echo 'TOTAL MISSING: ' . $totalMissing;
    if ($missingStatic !== [] && $missingDynamic !== []) {
        echo ' (' . count($missingStatic) . ' static, ' . count($missingDynamic) . ' dynamic)';
    } elseif ($missingDynamic !== []) {
        echo ' (' . count($missingDynamic) . ' dynamic)';
    }
    echo "\n";
}

exit($totalMissing > 0 ? 1 : 0);
