<?php

namespace Tests\Unit\Security;

use PHPUnit\Framework\TestCase;
use RecursiveDirectoryIterator;
use RecursiveIteratorIterator;

/**
 * Accounts must never be created with a password anyone could guess: seeders,
 * factories and the CSV importers all used to hash the literal 123456.
 */
class NoDefaultPasswordsTest extends TestCase
{

    public function test_no_source_file_hashes_a_well_known_password(): void
    {
        $offenders = [];

        foreach (['app', 'database'] as $directory) {
            $path = dirname(__DIR__, 3) . '/' . $directory;

            /** @var \SplFileInfo $file */
            foreach (new RecursiveIteratorIterator(new RecursiveDirectoryIterator($path)) as $file) {
                if (!$file->isFile() || $file->getExtension() !== 'php') {
                    continue;
                }

                $contents = (string)file_get_contents($file->getPathname());

                foreach (['bcrypt', 'Hash::make'] as $hasher) {
                    // bcrypt(123456), Hash::make('123456'), Hash::make("password") ...
                    $pattern = '/' . preg_quote($hasher, '/') . '\(\s*[\'"]?(123456|password|secret|admin)[\'"]?\s*\)/i';

                    if (preg_match($pattern, $contents)) {
                        $offenders[] = str_replace(dirname(__DIR__, 3) . '/', '', $file->getPathname());
                    }
                }
            }
        }

        $this->assertSame([], array_values(array_unique($offenders)));
    }

}
