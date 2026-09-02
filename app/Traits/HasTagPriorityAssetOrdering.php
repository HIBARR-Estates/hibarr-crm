<?php

namespace App\Traits;

/**
 * Shared by DeveloperProject and DeveloperProjectUnitType thumbnail()
 * relations: order an asset table so a `cover`-tagged row wins, then a
 * `hero`-tagged row, then insertion order.
 */
trait HasTagPriorityAssetOrdering
{
    /**
     * ORDER BY expression prioritizing `cover`-tagged rows, then `hero`,
     * then everything else, based on a JSON `tags` column on $table.
     *
     * Only MySQL and SQLite are implemented — any other driver falls back to
     * the constant '2', which disables cover/hero prioritization (every row
     * ties, so ordering falls through to whatever `orderBy` follows this).
     */
    protected function tagPriorityOrderSql(string $table): string
    {
        return match ($this->getConnection()->getDriverName()) {
            'mysql' => "
                CASE
                    WHEN JSON_CONTAINS(COALESCE({$table}.tags, '[]'), '\"cover\"') THEN 0
                    WHEN JSON_CONTAINS(COALESCE({$table}.tags, '[]'), '\"hero\"') THEN 1
                    ELSE 2
                END
            ",
            'sqlite' => "
                CASE
                    WHEN EXISTS (
                        SELECT 1 FROM json_each(COALESCE({$table}.tags, '[]'))
                        WHERE json_each.value = 'cover'
                    ) THEN 0
                    WHEN EXISTS (
                        SELECT 1 FROM json_each(COALESCE({$table}.tags, '[]'))
                        WHERE json_each.value = 'hero'
                    ) THEN 1
                    ELSE 2
                END
            ",
            default => '2',
        };
    }
}
