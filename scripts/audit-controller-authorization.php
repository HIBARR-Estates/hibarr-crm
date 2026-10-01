#!/usr/bin/env php
<?php

declare(strict_types=1);

/**
 * Lists controllers with no visible authorization check, grouped by the route
 * file that registers them (HIB-1634 / Phase 3 finding P3-09).
 *
 * A controller counted here is not automatically unprotected: route middleware
 * (auth, api.token, api.token.or.session, admin) may still gate it, and the
 * public login/payment controllers are meant to be reachable. The list is the
 * starting point for the per-controller review, not the finding itself.
 *
 *   php scripts/audit-controller-authorization.php
 *   php scripts/audit-controller-authorization.php --json
 */

const SIGNALS = [
    'abort_403' => '/abort_403\s*\(/',
    'permission()' => '/->permission\s*\(/',
    'hasRole()' => '/hasRole\s*\(/',
    'authorize()' => '/\$this->authorize\s*\(/',
    'Gate' => '/Gate::/',
    'middleware' => "/middleware\s*\(\s*['\"](role|admin|can:)/",
    'checkPermission()' => '/checkPermission\s*\(/',
];

$root = dirname(__DIR__);
$asJson = in_array('--json', array_slice($argv, 1), true);

$controllers = [];
$files = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($root . '/app/Http/Controllers'));

/** @var SplFileInfo $file */
foreach ($files as $file) {
    if (!$file->isFile() || $file->getExtension() !== 'php') {
        continue;
    }

    $class = $file->getBasename('.php');

    if ($class === 'Controller') {
        continue;
    }

    $source = (string)file_get_contents($file->getPathname());
    $signals = [];

    foreach (SIGNALS as $name => $pattern) {
        if (preg_match($pattern, $source)) {
            $signals[] = $name;
        }
    }

    $controllers[$class] = [
        'path' => str_replace($root . '/', '', $file->getPathname()),
        'signals' => $signals,
    ];
}

$routeFiles = [];

foreach (glob($root . '/routes/*.php') ?: [] as $routeFile) {
    $routeFiles[basename($routeFile)] = (string)file_get_contents($routeFile);
}

$unguarded = [];

foreach ($controllers as $class => $controller) {
    if ($controller['signals'] !== []) {
        continue;
    }

    $registeredIn = [];

    foreach ($routeFiles as $name => $contents) {
        if (str_contains($contents, $class . '::class')) {
            $registeredIn[] = $name;
        }
    }

    $unguarded[$class] = [
        'path' => $controller['path'],
        'routes' => $registeredIn === [] ? ['(registered elsewhere)'] : $registeredIn,
    ];
}

ksort($unguarded);

if ($asJson) {
    echo json_encode([
        'controllers' => count($controllers),
        'without_authorization_check' => count($unguarded),
        'details' => $unguarded,
    ], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES), "\n";

    exit(0);
}

printf("%d controllers, %d without a visible authorization check\n\n", count($controllers), count($unguarded));

$grouped = [];

foreach ($unguarded as $class => $controller) {
    $grouped[implode(' + ', $controller['routes'])][] = $class;
}

ksort($grouped);

foreach ($grouped as $routeFile => $classes) {
    printf("%s (%d)\n", $routeFile, count($classes));

    foreach ($classes as $class) {
        printf("    %s\n", $class);
    }

    echo "\n";
}
