<?php

namespace Tests\Unit\Support;

use App\Support\TaskPresenter;
use Tests\TestCase;

/**
 * Contract check for the eager-load that backs a task's category quick-action.
 *
 * DB-free on purpose: the deal -> lead behaviour itself is covered by
 * TaskPresenterDealLeadTest (needs a MySQL database), but this guard runs
 * anywhere and catches the regression that actually bites in production — a
 * column left out of the select, which makes Eloquent lazy-load it per row.
 */
class TaskPresenterRelationsTest extends TestCase
{
    public function test_it_eager_loads_the_deal_contact(): void
    {
        $relation = collect(TaskPresenter::RELATIONS)->first(
            fn (string $candidate) => str_starts_with($candidate, 'deals.contact')
        );

        $this->assertNotNull(
            $relation,
            'TaskPresenter::RELATIONS must eager-load deals.contact so a task on a deal can resolve its lead.'
        );
    }

    public function test_the_deal_contact_select_covers_every_column_the_summary_reads(): void
    {
        $relation = collect(TaskPresenter::RELATIONS)->first(
            fn (string $candidate) => str_starts_with($candidate, 'deals.contact')
        );

        // leadSummary() reads these, and PermissionService::checkAccess() reads
        // added_by / lead_owner for the 'added' / 'owned' rules.
        foreach ([
            'client_name',
            'company_name',
            'mobile',
            'client_email',
            'added_by',
            'lead_owner',
        ] as $column) {
            $this->assertStringContainsString(
                $column,
                (string) $relation,
                "deals.contact must select {$column}, or Eloquent lazy-loads it per deal."
            );
        }
    }
}
