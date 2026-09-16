#!/usr/bin/env php
<?php

declare(strict_types=1);

/**
 * Dependency advisory gate.
 *
 * Runs `composer audit` and `npm audit` and fails when an advisory shows up
 * that is not in scripts/security-audit-baseline.json. The baseline is the
 * backlog we already know about, so the build only breaks on something new.
 *
 *   php scripts/security-audit-gate.php            both ecosystems
 *   php scripts/security-audit-gate.php composer   one of composer|npm
 *   php scripts/security-audit-gate.php --update   rewrite the baseline
 *
 * Exit codes: 0 nothing new, 1 new advisories, 2 an audit could not run.
 */

const BASELINE_FILE = __DIR__ . '/security-audit-baseline.json';

$arguments = array_slice($argv, 1);
$update = in_array('--update', $arguments, true);
$ecosystems = array_values(array_filter($arguments, static fn ($a) => !str_starts_with($a, '--')));

if ($ecosystems === []) {
    $ecosystems = ['composer', 'npm'];
}

foreach ($ecosystems as $ecosystem) {
    if (!in_array($ecosystem, ['composer', 'npm'], true)) {
        fwrite(STDERR, "Unknown ecosystem: {$ecosystem}\n");
        exit(2);
    }
}

$baseline = readBaseline();
$found = [];
$exitCode = 0;

foreach ($ecosystems as $ecosystem) {
    $advisories = $ecosystem === 'composer' ? composerAdvisories() : npmAdvisories();

    if ($advisories === null) {
        fwrite(STDERR, "Could not run the {$ecosystem} audit.\n");
        exit(2);
    }

    $found[$ecosystem] = $advisories;
    $known = $baseline[$ecosystem] ?? [];
    $new = array_diff_key($advisories, $known);
    $gone = array_diff_key($known, $advisories);

    printf("%s: %d advisories, %d in the baseline, %d new\n", $ecosystem, count($advisories), count($known), count($new));

    foreach ($new as $key => $description) {
        printf("  NEW  %s — %s\n", $key, $description);
    }

    if ($gone !== [] && !$update) {
        printf("  %d baseline entries no longer apply (run with --update to drop them)\n", count($gone));
    }

    if ($new !== [] && !$update) {
        $exitCode = 1;
    }
}

if ($update) {
    writeBaseline($baseline, $found, $ecosystems);
    printf("Baseline written to %s\n", BASELINE_FILE);
    exit(0);
}

exit($exitCode);

/**
 * @return array<string, array<string, string>>
 */
function readBaseline(): array
{
    if (!is_file(BASELINE_FILE)) {
        return [];
    }

    $decoded = json_decode((string)file_get_contents(BASELINE_FILE), true);

    return is_array($decoded) ? $decoded : [];
}

/**
 * @param array<string, array<string, string>> $baseline
 * @param array<string, array<string, string>> $found
 * @param list<string> $ecosystems
 */
function writeBaseline(array $baseline, array $found, array $ecosystems): void
{
    $contents = [
        'note' => 'Dependency advisories already known on develop. scripts/security-audit-gate.php fails on anything not listed here. Regenerate with --update once an advisory is fixed or accepted.',
        'updated' => gmdate('Y-m-d'),
    ];

    foreach (['composer', 'npm'] as $ecosystem) {
        $entries = in_array($ecosystem, $ecosystems, true)
            ? ($found[$ecosystem] ?? [])
            : ($baseline[$ecosystem] ?? []);

        ksort($entries);
        $contents[$ecosystem] = $entries;
    }

    file_put_contents(BASELINE_FILE, json_encode($contents, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES) . "\n");
}

/**
 * @return array<string, string>|null
 */
function composerAdvisories(): ?array
{
    $json = runCommand('composer audit --locked --format=json --no-interaction --no-ansi');
    $decoded = $json === null ? null : json_decode($json, true);

    if (!is_array($decoded) || !isset($decoded['advisories'])) {
        return null;
    }

    $advisories = [];

    foreach ($decoded['advisories'] as $package => $packageAdvisories) {
        foreach ($packageAdvisories as $advisory) {
            $id = $advisory['cve'] ?: ($advisory['advisoryId'] ?? 'unknown');
            $advisories[$package . ':' . $id] = trim(($advisory['severity'] ?? 'unknown') . ' — ' . ($advisory['title'] ?? ''));
        }
    }

    return $advisories;
}

/**
 * @return array<string, string>|null
 */
function npmAdvisories(): ?array
{
    $json = runCommand('npm audit --omit=dev --json');
    $decoded = $json === null ? null : json_decode($json, true);

    if (!is_array($decoded) || !isset($decoded['vulnerabilities'])) {
        return null;
    }

    $advisories = [];

    foreach ($decoded['vulnerabilities'] as $package => $vulnerability) {
        foreach ($vulnerability['via'] ?? [] as $via) {
            if (!is_array($via)) {
                // A string entry just points at another vulnerable package.
                continue;
            }

            $id = basename((string)($via['url'] ?? '')) ?: (string)($via['source'] ?? 'unknown');
            $advisories[$package . ':' . $id] = trim(($via['severity'] ?? 'unknown') . ' — ' . ($via['title'] ?? ''));
        }
    }

    return $advisories;
}

/**
 * Audits exit non-zero when they find something, so only the output matters.
 */
function runCommand(string $command): ?string
{
    $descriptors = [1 => ['pipe', 'w'], 2 => ['pipe', 'w']];
    $process = proc_open($command, $descriptors, $pipes, dirname(__DIR__));

    if (!is_resource($process)) {
        return null;
    }

    $stdout = (string)stream_get_contents($pipes[1]);
    $stderr = (string)stream_get_contents($pipes[2]);

    foreach ($pipes as $pipe) {
        fclose($pipe);
    }

    proc_close($process);

    if (trim($stdout) === '') {
        fwrite(STDERR, $stderr);

        return null;
    }

    return $stdout;
}
