<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * The frontend has offered "Highest"/"Urgent" task priorities for a while,
 * but the `tasks.priority` column is still ENUM('low','medium','high') from
 * the original schema. Saving those values gets rejected or (non-strict
 * MySQL) silently stored as '' — which is why the priority pill renders
 * empty for urgent tasks.
 */
return new class extends Migration
{
    private const VALUES = ['low', 'medium', 'high', 'highest', 'urgent'];

    public function up(): void
    {
        $this->alterPriorityEnum(self::VALUES);
    }

    public function down(): void
    {
        DB::table('tasks')->whereIn('priority', ['highest', 'urgent'])->update([
            'priority' => 'high',
        ]);

        $this->alterPriorityEnum(['low', 'medium', 'high']);
    }

    /**
     * @param  list<string>  $values
     */
    private function alterPriorityEnum(array $values): void
    {
        $driver = Schema::getConnection()->getDriverName();

        if ($driver !== 'mysql' && $driver !== 'mariadb') {
            return;
        }

        $enumList = collect($values)
            ->map(fn (string $v) => "'" . str_replace("'", "''", $v) . "'")
            ->implode(',');

        DB::statement(
            "ALTER TABLE `tasks` MODIFY COLUMN `priority` ENUM({$enumList}) NOT NULL DEFAULT 'medium'"
        );
    }
};
