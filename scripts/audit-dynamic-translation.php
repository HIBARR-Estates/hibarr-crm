<?php

/**
 * Audit dynamic translation (td) coverage in CRM frontend.
 *
 * Dynamic content = user/DB-generated text (names, titles, descriptions, remarks).
 * Static UI copy should use t() from useTranslation — not td().
 *
 * Patterns detected:
 *   - Direct: const { td } = useTd() in the same file
 *   - Prop:    td={td} passed to child, or td?: in props interface
 *
 * Run: php scripts/audit-dynamic-translation.php
 */

$root = realpath(__DIR__ . '/..');
$jsRoot = $root . '/resources/js';

/** Fields that typically hold user/DB prose (not IDs, dates, emails). */
$dynamicFieldPattern = '/\b(?:'
    . 'client_name|client_name_salutation|company_name|category_name|column_name|label_name'
    . '|\.name\b|\.title\b|\.heading\b|\.description\b|\.details\b|\.remark\b|\.note\b'
    . '|lead_source\.type|lead_stage\.name|meeting_type\.name|project\.name|property\.title'
    . '|generatePropertySubtitle|ContentRenderer'
    . ')/';

/** Already excluded from audit (person names, system slugs, etc.). */
$ignorePatterns = [
    '/user\.name\b/',
    '/added_by\.name\b/',
    '/\.image_url\b/',
    '/route\(/',
    '/console\.log/',
    '/file\.name\b/',
    '/asset\.name\b/',
    '/card\.title\b/',
    '/pageTitle\b/',
];

/** Known column factory files — should receive td from Index, not useTd locally. */
$columnFactories = [
    'Features/Deals/Columns/index.tsx',
    'Features/Leads/Columns/index.tsx',
    'Features/Properties/Columns/index.tsx',
    'Features/Tasks/Columns/index.tsx',
];

/** Shared leaf components — should accept td prop from parent orchestrator. */
$tdPropComponents = [
    'Features/Tasks/Components/TaskListView.tsx',
    'Features/Tasks/Components/DeleteTask.tsx',
    'Features/Tasks/BulkActions/BulkTaskActionSelector.tsx',
    'Features/Tasks/SaveTask/SaveTaskModal.tsx',
    'Features/Tasks/SaveTask/TaskDetailsDrawer.tsx',
    'Features/Tasks/SaveTask/TaskForm.tsx',
    'Components/Kanban/DealCard.tsx',
    'Components/Kanban/KanbanColumn.tsx',
    'Components/Kanban/KanbanBoard.tsx',
];

function relativePath(string $fullPath, string $root): string
{
    return str_replace('\\', '/', substr($fullPath, strlen($root) + 1));
}

function fileUsesDynamicTranslation(string $content): array
{
    $methods = [];

    if (preg_match('/\buseTd\s*\(/', $content) || preg_match('/useDynamicTranslation/', $content)) {
        $methods[] = 'useTd';
    }

    if (preg_match('/\btd\s*=\s*\(/', $content) || preg_match('/\btd:\s*\(/', $content)) {
        $methods[] = 'td-prop';
    }

    if (preg_match('/\btd\?\s*:\s*\(/', $content)) {
        $methods[] = 'td-prop-interface';
    }

    return array_unique($methods);
}

function lineHasTdWrap(string $line): bool
{
    return (bool) preg_match('/\btd\s*\(/', $line);
}

function shouldIgnoreLine(string $line): bool
{
    global $ignorePatterns;

    if (preg_match('/^\s*(\/\/|\*|import |export type|interface |type )/', $line)) {
        return true;
    }

    foreach ($ignorePatterns as $pattern) {
        if (preg_match($pattern, $line)) {
            return true;
        }
    }

    return false;
}

function recommendedFix(string $relative, array $columnFactories, array $tdPropComponents): string
{
    foreach ($columnFactories as $factory) {
        if (str_contains($relative, $factory)) {
            return 'pass td from Index page into column factory options';
        }
    }

    foreach ($tdPropComponents as $component) {
        if (str_contains($relative, $component)) {
            return 'accept td?: prop from parent orchestrator (TasksTab pattern)';
        }
    }

    if (preg_match('#Pages/[^/]+/Index\.tsx$#', $relative)) {
        return 'add useTd(); pass td to columns/kanban/child modals';
    }

    if (str_contains($relative, 'Components/TasksTab.tsx')) {
        return 'useTd locally; pass td to TaskListView, SaveTaskModal, etc.';
    }

    return 'add useTd() and wrap dynamic values with td(...)';
}

$issues = [];
$covered = [];
$iterator = new RecursiveIteratorIterator(
    new RecursiveDirectoryIterator($jsRoot)
);

foreach ($iterator as $file) {
    if (!$file->isFile() || !preg_match('/\.tsx$/', $file->getFilename())) {
        continue;
    }

    $relative = relativePath($file->getPathname(), $root);
    if (!preg_match('#^(resources/js/(Pages|Features|Components)/)#', $relative)) {
        continue;
    }

    $content = file_get_contents($file->getPathname());
    if (!preg_match($dynamicFieldPattern, $content)) {
        continue;
    }

    $methods = fileUsesDynamicTranslation($content);
    $lines = explode("\n", $content);
    $fileIssues = [];

    foreach ($lines as $i => $line) {
        if (!preg_match($dynamicFieldPattern, $line)) {
            continue;
        }

        if (shouldIgnoreLine($line) || lineHasTdWrap($line)) {
            continue;
        }

        // Skip JSX attribute names like title={deal.name} when value is wrapped on next lines
        if (preg_match('/\btitle=\{[^}]*\.name\}/', $line) && !preg_match('/\{[^}]*\}/', $line)) {
            continue;
        }

        $fileIssues[] = [
            'line' => $i + 1,
            'snippet' => trim(substr($line, 0, 120)),
        ];
    }

    if ($fileIssues === []) {
        if ($methods !== []) {
            $covered[] = $relative;
        }
        continue;
    }

    $issues[$relative] = [
        'methods' => $methods,
        'issues' => $fileIssues,
        'fix' => recommendedFix($relative, $columnFactories, $tdPropComponents),
        'priority' => count($fileIssues) >= 5 ? 'high' : (count($fileIssues) >= 2 ? 'medium' : 'low'),
    ];
}

uksort($issues, fn ($a, $b) => [
    'high' => 0,
    'medium' => 1,
    'low' => 2,
][$issues[$a]['priority']] <=> [
    'high' => 0,
    'medium' => 1,
    'low' => 2,
][$issues[$b]['priority']]);

echo "DYNAMIC TRANSLATION AUDIT\n";
echo str_repeat('=', 60) . "\n\n";

echo "Reference patterns:\n";
echo "  • useTd() locally:  OverviewSection, Deals/Show, TasksTab (orchestrator)\n";
echo "  • td prop drilling: TasksTab → TaskListView, SaveTaskModal, DeleteTask\n";
echo "  • td in factories:  Deals/Index → DEAL_TABLE_COLUMNS({ td })\n\n";

$byPriority = ['high' => [], 'medium' => [], 'low' => []];
foreach ($issues as $file => $info) {
    $byPriority[$info['priority']][] = $file;
}

foreach (['high', 'medium', 'low'] as $priority) {
    $files = $byPriority[$priority];
    if ($files === []) {
        continue;
    }

    echo strtoupper($priority) . " PRIORITY (" . count($files) . " files)\n";
    echo str_repeat('-', 40) . "\n";

    foreach ($files as $file) {
        $info = $issues[$file];
        $coverage = $info['methods'] === []
            ? 'NO td coverage'
            : 'partial (' . implode(', ', $info['methods']) . ')';

        echo "\n  {$file}\n";
        echo "    Coverage: {$coverage}\n";
        echo "    Fix: {$info['fix']}\n";
        echo "    Gaps: " . count($info['issues']) . " line(s)\n";

        foreach (array_slice($info['issues'], 0, 5) as $issue) {
            echo "      L{$issue['line']}: {$issue['snippet']}\n";
        }

        if (count($info['issues']) > 5) {
            $remaining = count($info['issues']) - 5;
            echo "      ... +{$remaining} more\n";
        }
    }

    echo "\n";
}

echo "FILES WITH td COVERAGE AND NO GAPS: " . count($covered) . "\n";
echo "FILES NEEDING ATTENTION: " . count($issues) . "\n";

exit(count($issues) > 0 ? 1 : 0);
