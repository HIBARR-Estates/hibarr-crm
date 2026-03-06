<?php

namespace Database\Seeders;

use App\Models\CrmBusinessRule;
use App\Models\CrmEventCategory;
use App\Models\CrmEventType;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Log;

/**
 * Seeds the CRM Event engine configuration tables from config/crm_events.php.
 *
 * - System rows (is_system = true) are upserted on every run.
 * - Admin-created rows (is_system = false) are never touched.
 * - Safe to run repeatedly (idempotent).
 */
class CrmEventSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $config = config('crm_events');

        if (empty($config)) {
            Log::warning('CrmEventSeeder: No crm_events config found. Skipping.');
            return;
        }

        $this->seedCategories($config['categories'] ?? []);
        $this->seedBusinessRules($config['business_rules'] ?? []);
        $this->seedEventTypes($config['event_types'] ?? []);

        $this->command->info('CRM Event engine seeded successfully.');
    }

    /**
     * Seed event categories.
     */
    protected function seedCategories(array $categories): void
    {
        foreach ($categories as $category) {
            CrmEventCategory::withoutGlobalScopes()->updateOrCreate(
                [
                    'slug' => $category['slug'],
                    'company_id' => null, // Global/system categories
                ],
                [
                    'name' => $category['name'],
                    'description' => $category['description'] ?? null,
                    'is_active' => true,
                ]
            );
        }

        $this->command->info('  - Seeded ' . count($categories) . ' event categories.');
    }

    /**
     * Seed business rules.
     */
    protected function seedBusinessRules(array $rules): void
    {
        foreach ($rules as $rule) {
            CrmBusinessRule::withoutGlobalScopes()->updateOrCreate(
                [
                    'slug' => $rule['slug'],
                    'company_id' => null,
                ],
                [
                    'name' => $rule['name'],
                    'description' => $rule['description'] ?? null,
                    'rule_config' => $rule['rule_config'] ?? null,
                    'is_active' => true,
                ]
            );
        }

        $this->command->info('  - Seeded ' . count($rules) . ' business rules.');
    }

    /**
     * Seed event types.
     */
    protected function seedEventTypes(array $eventTypes): void
    {
        foreach ($eventTypes as $eventType) {
            // Resolve category by slug
            $category = CrmEventCategory::withoutGlobalScopes()
                ->where('slug', $eventType['category'])
                ->whereNull('company_id')
                ->first();

            if (!$category) {
                Log::warning("CrmEventSeeder: Category '{$eventType['category']}' not found for event type '{$eventType['slug']}'. Skipping.");
                continue;
            }

            // Resolve business rule by slug (if provided)
            $businessRuleId = null;
            if (!empty($eventType['business_rule'])) {
                $businessRule = CrmBusinessRule::withoutGlobalScopes()
                    ->where('slug', $eventType['business_rule'])
                    ->whereNull('company_id')
                    ->first();

                $businessRuleId = $businessRule?->id;
            }

            CrmEventType::withoutGlobalScopes()->updateOrCreate(
                [
                    'slug' => $eventType['slug'],
                    'category_id' => $category->id,
                    'company_id' => null,
                ],
                [
                    'name' => $eventType['name'],
                    'description' => $eventType['description'] ?? null,
                    'model_type' => $eventType['model_type'] ?? null,
                    'business_rule_id' => $businessRuleId,
                    'is_system' => true,
                    'is_active' => true,
                    'sync_processing' => $eventType['sync_processing'] ?? true,
                    'metadata_schema' => $eventType['metadata_schema'] ?? null,
                ]
            );
        }

        $this->command->info('  - Seeded ' . count($eventTypes) . ' event types.');
    }
}
