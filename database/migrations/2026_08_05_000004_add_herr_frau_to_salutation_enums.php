<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Salutation::Herr / Frau were added to the PHP enum, but the MySQL columns on
 * users + leads still only accept mr/mrs/miss/dr/sir/madam. Invalid values are
 * either rejected or (non-strict MySQL) stored as '' — so Herr/Frau never stick.
 */
return new class extends Migration
{
    private const VALUES = ['mr', 'mrs', 'miss', 'dr', 'sir', 'madam', 'herr', 'frau'];

    private const TABLES = ['leads', 'users'];

    public function up(): void
    {
        $this->alterSalutationEnum(self::VALUES);
    }

    public function down(): void
    {
        // Drop rows that would become invalid before shrinking the enum.
        foreach (self::TABLES as $table) {
            if (! Schema::hasColumn($table, 'salutation')) {
                continue;
            }
            DB::table($table)->whereIn('salutation', ['herr', 'frau'])->update([
                'salutation' => null,
            ]);
        }

        $this->alterSalutationEnum(['mr', 'mrs', 'miss', 'dr', 'sir', 'madam']);
    }

    /**
     * @param  list<string>  $values
     */
    private function alterSalutationEnum(array $values): void
    {
        $driver = Schema::getConnection()->getDriverName();

        // SQLite (and others without a hard ENUM) already accept the string value.
        if ($driver !== 'mysql' && $driver !== 'mariadb') {
            return;
        }

        $enumList = collect($values)
            ->map(fn (string $v) => "'" . str_replace("'", "''", $v) . "'")
            ->implode(',');

        foreach (self::TABLES as $table) {
            if (! Schema::hasColumn($table, 'salutation')) {
                continue;
            }

            DB::statement(
                "ALTER TABLE `{$table}` MODIFY COLUMN `salutation` ENUM({$enumList}) NULL"
            );
        }
    }
};
