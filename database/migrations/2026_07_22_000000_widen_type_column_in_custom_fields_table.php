<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Widen custom_fields.type from varchar(10) to varchar(30).
 * The new 'multiSelectCountry' type (18 chars) does not fit the original
 * 10-char column used by all previously registered types.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('custom_fields', function (Blueprint $table) {
            $table->string('type', 30)->change();
        });
    }

    public function down(): void
    {
        $hasOversizedTypes = DB::table('custom_fields')
            ->whereRaw('CHAR_LENGTH(type) > 10')
            ->exists();

        if ($hasOversizedTypes) {
            throw new \RuntimeException(
                'Refusing to roll back: custom_fields.type contains values longer than '
                . '10 characters (e.g. "multiSelectCountry") that would be truncated by '
                . 'narrowing the column back to varchar(10). Resolve or remove those rows first.'
            );
        }

        Schema::table('custom_fields', function (Blueprint $table) {
            $table->string('type', 10)->change();
        });
    }
};
