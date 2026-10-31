<?php

/**
 * gRPC class check, run inside the built image by scripts/ci/smoke-grpc.sh.
 *
 *   php /ci/check-grpc-classes.php            (APP_DIR defaults to /var/www/html)
 *
 * 1. Every App\Grpc\... class or interface worker.php imports must autoload
 *    (catches a service or interface missing from the image).
 * 2. Every protoc-generated class under app/Grpc/Generated must autoload
 *    (catches a broken PSR-4 lift of protoc's nested output, or an autoload
 *    dump that ran before the generated code was copied in).
 * 3. A generated message must survive a serialize/parse round trip, which
 *    parses its descriptor with the installed google/protobuf runtime
 *    (catches generated-code / runtime version incompatibility).
 */
$root = getenv('APP_DIR') ?: '/var/www/html';
chdir($root);
require $root.'/vendor/autoload.php';

$failures = [];

preg_match_all('/^use (App\\\\Grpc\\\\[^;\s]+);/m', (string) file_get_contents('worker.php'), $imports);
foreach ($imports[1] as $fqcn) {
    if (! class_exists($fqcn) && ! interface_exists($fqcn)) {
        $failures[] = "worker.php import does not autoload: {$fqcn}";
    }
}

$base = $root.'/app/Grpc/Generated';
$generated = 0;
$files = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($base, FilesystemIterator::SKIP_DOTS));
foreach ($files as $file) {
    if ($file->getExtension() !== 'php') {
        continue;
    }
    $relative = substr($file->getPathname(), strlen($base) + 1, -4);
    $fqcn = 'App\\Grpc\\Generated\\'.str_replace('/', '\\', $relative);
    $generated++;
    if (! class_exists($fqcn) && ! interface_exists($fqcn)) {
        $failures[] = "generated class does not autoload: {$fqcn}";
    }
}
if ($generated === 0) {
    $failures[] = "no generated classes found under {$base}";
}

$message = 'App\\Grpc\\Generated\\Deal\\Deal';
try {
    $a = new $message;
    $a->setId(42);
    $b = new $message;
    $b->mergeFromString($a->serializeToString());
    if ($b->getId() !== 42) {
        $failures[] = "{$message} did not round-trip (got ".var_export($b->getId(), true).')';
    }
} catch (Throwable $e) {
    $failures[] = "{$message} round trip failed: ".get_class($e).': '.$e->getMessage();
}

if ($failures) {
    fwrite(STDERR, implode(PHP_EOL, $failures).PHP_EOL);
    exit(1);
}

echo 'ok: '.count($imports[1])." worker.php imports, {$generated} generated classes, protobuf round trip\n";
