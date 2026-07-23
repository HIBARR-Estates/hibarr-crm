<?php

namespace Tests\Feature\Database;

use Illuminate\Database\QueryException;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class PipelineScopeUniqueIndexTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        $driver = Schema::getConnection()->getDriverName();
        if (!in_array($driver, ['sqlite', 'pgsql'], true)) {
            $this->markTestSkipped('Pipeline scope unique-index tests target SQLite and PostgreSQL.');

            return;
        }

        Schema::dropIfExists('custom_field_category_scopes');
        Schema::dropIfExists('pipeline_field_scopes');

        Schema::create('custom_field_category_scopes', function (Blueprint $table) {
            $table->id();
            $table->unsignedInteger('company_id')->nullable();
            $table->unsignedBigInteger('category_id');
            $table->unsignedBigInteger('pipeline_id');
            $table->unsignedInteger('pipeline_stage_id')->nullable();
            $table->timestamps();
            $table->unsignedInteger('pipeline_stage_id_norm')
                ->storedAs('COALESCE(pipeline_stage_id, 0)');
        });

        DB::statement(
            'CREATE UNIQUE INDEX cfc_scope_unique ON custom_field_category_scopes '
            . '(category_id, pipeline_id, pipeline_stage_id_norm)'
        );

        Schema::create('pipeline_field_scopes', function (Blueprint $table) {
            $table->id();
            $table->unsignedInteger('company_id')->nullable();
            $table->string('scopeable_type', 50);
            $table->string('scopeable_key', 191);
            $table->string('model', 191);
            $table->unsignedBigInteger('pipeline_id');
            $table->unsignedInteger('pipeline_stage_id')->nullable();
            $table->timestamps();
            $table->unsignedInteger('pipeline_stage_id_norm')
                ->storedAs('COALESCE(pipeline_stage_id, 0)');
        });

        DB::statement(
            'CREATE UNIQUE INDEX pipeline_field_scope_unique ON pipeline_field_scopes '
            . '(scopeable_type, scopeable_key, model, pipeline_id, pipeline_stage_id_norm)'
        );
    }

    protected function tearDown(): void
    {
        Schema::dropIfExists('pipeline_field_scopes');
        Schema::dropIfExists('custom_field_category_scopes');

        parent::tearDown();
    }

    public function test_duplicate_pipeline_wide_category_scope_is_rejected(): void
    {
        $now = now();
        $row = [
            'company_id' => 1,
            'category_id' => 10,
            'pipeline_id' => 20,
            'pipeline_stage_id' => null,
            'created_at' => $now,
            'updated_at' => $now,
        ];

        DB::table('custom_field_category_scopes')->insert($row);

        $this->expectException(QueryException::class);
        DB::table('custom_field_category_scopes')->insert($row);
    }

    public function test_duplicate_pipeline_wide_field_scope_is_rejected(): void
    {
        $now = now();
        $row = [
            'company_id' => 1,
            'scopeable_type' => 'native_field',
            'scopeable_key' => 'category_id',
            'model' => 'deal',
            'pipeline_id' => 20,
            'pipeline_stage_id' => null,
            'created_at' => $now,
            'updated_at' => $now,
        ];

        DB::table('pipeline_field_scopes')->insert($row);

        $this->expectException(QueryException::class);
        DB::table('pipeline_field_scopes')->insert($row);
    }

    public function test_stage_specific_category_scopes_remain_unique_per_stage(): void
    {
        $now = now();

        DB::table('custom_field_category_scopes')->insert([
            'company_id' => 1,
            'category_id' => 10,
            'pipeline_id' => 20,
            'pipeline_stage_id' => 1,
            'created_at' => $now,
            'updated_at' => $now,
        ]);

        DB::table('custom_field_category_scopes')->insert([
            'company_id' => 1,
            'category_id' => 10,
            'pipeline_id' => 20,
            'pipeline_stage_id' => 2,
            'created_at' => $now,
            'updated_at' => $now,
        ]);

        $this->assertSame(2, DB::table('custom_field_category_scopes')->count());
    }
}
