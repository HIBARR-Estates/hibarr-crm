<?php

namespace Tests\Unit;

use App\Support\DealExportFields;
use PHPUnit\Framework\TestCase;

/**
 * The export writes whatever columns the client asks for, so the allowlist is
 * the only thing standing between a field picker and arbitrary attribute reads.
 */
class DealExportFieldsTest extends TestCase
{
    public function test_unknown_keys_are_dropped(): void
    {
        $fields = DealExportFields::filterRequested([
            'name',
            'password',
            'company_id',
        ]);

        $this->assertSame(['name'], $fields);
    }

    public function test_client_column_order_is_preserved_and_duplicates_dropped(): void
    {
        $fields = DealExportFields::filterRequested([
            'stage',
            'name',
            'stage',
            'id',
        ]);

        $this->assertSame(['stage', 'name', 'id'], $fields);
    }

    public function test_headings_line_up_with_the_requested_fields(): void
    {
        $fields = ['name', 'stage', 'agent'];

        $this->assertSame(
            ['Deal name', 'Stage', 'Agent'],
            DealExportFields::headings($fields)
        );
    }

    public function test_relations_are_collected_without_duplicates(): void
    {
        $relations = DealExportFields::relationsFor([
            'contact_name',
            'contact_email',
            'stage',
        ]);

        sort($relations);
        $this->assertSame(['contact', 'leadStage'], $relations);
    }

    public function test_every_field_resolves_to_a_case_rather_than_the_null_default(): void
    {
        // A key present in definitions() but missing from resolve()'s match
        // would silently export a blank column.
        $reflected = new \ReflectionMethod(DealExportFields::class, 'resolve');
        $source = file(__DIR__.'/../../app/Support/DealExportFields.php');
        $body = implode('', array_slice(
            $source,
            $reflected->getStartLine(),
            $reflected->getEndLine() - $reflected->getStartLine()
        ));

        foreach (DealExportFields::allowedKeys() as $key) {
            $this->assertStringContainsString("'{$key}' =>", $body, "resolve() has no case for '{$key}'");
        }
    }
}
