<?php

namespace Tests\Feature\LeadEntries;

use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\LeadAutomationTestCase;

/**
 * The lead automation harness, plus this feature's real tables: the migrations run as written, so a
 * mistake in one fails here rather than on deploy.
 */
abstract class LeadEntryTestCase extends LeadAutomationTestCase
{
    protected function createMinimalSchema(): void
    {
        parent::createMinimalSchema();

        Schema::table('leads', function (Blueprint $table) {
            $table->timestamp('assigned_at')->nullable();
        });

        foreach ([
            '2026_11_25_000001_create_lead_entries_table.php',
            '2026_11_26_000001_add_sla_to_lead_entries_table.php',
            '2026_11_26_000002_create_lead_contact_slas_table.php',
            '2026_11_25_000003_create_lead_assignment_pools_tables.php',
        ] as $file) {
            (require base_path('database/migrations/'.$file))->up();
        }
    }

    protected function makeUser(int $id, string $status = 'active'): int
    {
        DB::table('users')->insert([
            'id' => $id,
            'company_id' => $this->companyId,
            'name' => "User {$id}",
            'email' => "user{$id}@example.com",
            'status' => $status,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        return $id;
    }

    /** @return array<string, mixed> A valid `entry` block, as OL sends it. */
    protected function entryPayload(array $overrides = []): array
    {
        return array_replace_recursive([
            'uuid' => '0193a1c2-0000-7000-8000-000000000001',
            'occurred_at' => '2026-11-20T10:15:03Z',
            'is_new_lead' => true,
            'resolved_by' => 'binding',
            'channel' => [
                'uuid' => '0193a1c2-0000-7000-8000-0000000000c3',
                'key' => 'kickoff_call_de',
                'name' => 'Kickoff call (DE)',
                'type' => 'consultation_booking',
                'family' => 'form',
                'path' => 'consultation_booking/consultation_de/kickoff_call_de',
                'ancestor_uuids' => [
                    '0193a1c2-0000-7000-8000-0000000000a1',
                    '0193a1c2-0000-7000-8000-0000000000b2',
                ],
                'tags' => ['market:de', 'kind:call'],
            ],
            'source' => ['entity_type' => 'crm_meeting_type', 'entity_id' => 4, 'entity_key' => null, 'label' => 'Kickoff'],
            'context' => [
                'referral_agent' => ['ol_agent_id' => 57, 'crm_user_id' => 214],
                'partner' => null,
                'campaign' => ['key' => 'house:spring', 'matched_by' => 'house_config', 'value' => 'spring', 'label' => 'spring', 'attribution_link_uuid' => null],
                'utm' => ['source' => 'meta', 'medium' => 'paid_social', 'campaign' => 'spring'],
            ],
            'form_key' => 'consult_de',
            'language' => 'de',
        ], $overrides);
    }
}
