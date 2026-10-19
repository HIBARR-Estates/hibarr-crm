<?php

namespace Tests\Unit\Models;

use App\Models\CrmEvent;
use App\Scopes\CompanyScope;
use Tests\TestCase;

/**
 * Regression cover for call events rendering as "Activity updated".
 *
 * System event types (the `call_*` family) are seeded with `company_id IS NULL`
 * so every company shares them. CrmEventType carries a global CompanyScope that
 * filters on the current company, which hid those shared rows and left
 * `event_type: null` on every call event — the timeline then had no slug to
 * describe and fell through to the generic "Activity updated" title.
 *
 * DB-free on purpose: it asserts on the relation's own scope bookkeeping, so it
 * runs in the sqlite-backed unit suite (the MySQL-backed suite is blocked by the
 * pre-existing ALTER TABLE ... CHANGE COLUMN migrations) while still pinning the
 * exact behaviour that broke in production.
 */
class CrmEventSystemEventTypeTest extends TestCase
{
    public function test_event_type_relation_lifts_the_company_scope(): void
    {
        $removed = (new CrmEvent)->eventType()->removedScopes();

        $this->assertContains(
            CompanyScope::class,
            $removed,
            'eventType() must drop CompanyScope, or shared system event types '
            .'(company_id IS NULL) resolve to null and call events lose their slug.'
        );
    }

    public function test_only_the_company_scope_is_lifted(): void
    {
        // The relation is keyed on a foreign key pinned to the event row, so
        // lifting any scope beyond the tenant one would widen it needlessly.
        $removed = (new CrmEvent)->eventType()->removedScopes();

        $this->assertCount(1, $removed, 'Expected exactly one scope removed from eventType().');
    }

    public function test_relation_still_allows_shared_types_and_own_company_only(): void
    {
        $event = new CrmEvent;
        $event->company_id = 42;

        $query = $event->eventType()->getQuery();
        $sql = $query->toSql();
        $bindings = $query->getBindings();

        $this->assertStringContainsString(
            'company_id',
            $sql,
            'The scope was lifted, so the tenant constraint must be re-applied.'
        );
        $this->assertStringContainsString(
            'is null',
            $sql,
            'Shared/system types (company_id IS NULL) must stay reachable.'
        );
        $this->assertContains(
            42,
            $bindings,
            'The event own company must remain allowed.'
        );
    }

    public function test_the_underlying_model_still_keeps_the_company_scope(): void
    {
        // Guards the blast radius: CrmEventType itself must remain tenant-scoped
        // for every other caller — only this one relation opts out.
        $this->assertContains(
            CompanyScope::class,
            $this->registeredScopes(new \App\Models\CrmEventType),
            'CrmEventType must keep CompanyScope globally; the opt-out belongs on the relation.'
        );
    }

    /**
     * Global scopes registered on a model's builder, by class name.
     *
     * @return array<int, class-string>
     */
    private function registeredScopes(\Illuminate\Database\Eloquent\Model $model): array
    {
        $property = new \ReflectionProperty($model->newQuery(), 'scopes');
        $property->setAccessible(true);

        return array_keys($property->getValue($model->newQuery()));
    }
}
