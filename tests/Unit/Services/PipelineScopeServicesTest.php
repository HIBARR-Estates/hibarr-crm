<?php

namespace Tests\Unit\Services;

use App\Enums\DealPackageMode;
use App\Models\Company;
use App\Models\Deal;
use App\Models\Package;
use App\Services\PackagePipelineRouterService;
use App\Services\PackageRoutingFieldCatalog;
use Tests\TestCase;

class PipelineScopeServicesTest extends TestCase
{
    public function test_normalize_package_ids_enforces_single_mode(): void
    {
        $company = new Company([
            'deal_package_mode' => DealPackageMode::Single->value,
        ]);
        $company->id = 1;
        session(['company' => $company]);

        $router = app(PackagePipelineRouterService::class);
        $normalized = $router->normalizePackageIds([1, 2, 3]);

        $this->assertCount(1, $normalized);
        $this->assertSame(1, $normalized[0]);
    }

    public function test_normalize_package_ids_allows_multiple_in_multiple_mode(): void
    {
        $company = new Company([
            'deal_package_mode' => DealPackageMode::Multiple->value,
        ]);
        $company->id = 1;
        session(['company' => $company]);

        $router = app(PackagePipelineRouterService::class);
        $normalized = $router->normalizePackageIds([1, 2, 3]);

        $this->assertCount(3, $normalized);
    }

    public function test_should_not_route_when_routing_disabled(): void
    {
        $company = new Company([
            'package_pipeline_routing_enabled' => false,
            'deal_package_mode' => DealPackageMode::Multiple->value,
        ]);

        $deal = new Deal([
            'company_id' => 1,
            'is_locked' => false,
        ]);
        $deal->setRelation('company', $company);
        $deal->setRelation('packages', collect([new Package(['id' => 2])]));

        $router = app(PackagePipelineRouterService::class);

        $this->assertSame('routing_disabled', $router->getRoutingSkipReason($deal));
    }

    public function test_should_not_route_when_multiple_packages(): void
    {
        $company = new Company([
            'package_pipeline_routing_enabled' => true,
            'deal_package_mode' => DealPackageMode::Single->value,
        ]);

        $deal = new Deal([
            'company_id' => 1,
            'is_locked' => false,
        ]);
        $deal->setRelation('company', $company);
        $deal->setRelation('packages', collect([
            new Package(['id' => 2]),
            new Package(['id' => 3]),
        ]));

        $router = app(PackagePipelineRouterService::class);

        $this->assertSame('multiple_packages', $router->getRoutingSkipReason($deal));
    }

    public function test_should_not_route_when_multiple_package_mode(): void
    {
        $company = new Company([
            'package_pipeline_routing_enabled' => true,
            'deal_package_mode' => DealPackageMode::Multiple->value,
        ]);

        $deal = new Deal([
            'company_id' => 1,
            'is_locked' => false,
        ]);
        $deal->setRelation('company', $company);
        $deal->setRelation('packages', collect([new Package(['id' => 2])]));

        $router = app(PackagePipelineRouterService::class);

        $this->assertSame('multiple_package_mode', $router->getRoutingSkipReason($deal));
    }

    public function test_enabled_field_keys_treats_empty_array_as_no_fields_enabled(): void
    {
        $company = new Company([
            'id' => 1,
            'package_pipeline_routing_trigger_fields' => [],
        ]);
        session(['company' => $company]);

        $catalog = app(PackageRoutingFieldCatalog::class);

        $this->assertSame([], $catalog->enabledFieldKeys());
        $this->assertFalse($catalog->isFieldEnabled('category_id'));
    }

    public function test_normalize_trigger_rows_allows_present_mode_without_match_value(): void
    {
        $company = new Company([
            'id' => 1,
            'package_pipeline_routing_trigger_fields' => ['category_id'],
        ]);
        session(['company' => $company]);

        $catalog = app(PackageRoutingFieldCatalog::class);
        $normalized = $catalog->normalizeTriggerRows([
            ['field_key' => 'category_id', 'match_mode' => 'present', 'match_value' => ''],
        ]);

        $this->assertCount(1, $normalized);
        $this->assertSame('present', $normalized[0]['match_mode']);
        $this->assertNull($normalized[0]['match_value']);
    }

    public function test_normalize_trigger_rows_skips_exact_mode_without_match_value(): void
    {
        $company = new Company([
            'id' => 1,
            'package_pipeline_routing_trigger_fields' => ['category_id'],
        ]);
        session(['company' => $company]);

        $catalog = app(PackageRoutingFieldCatalog::class);
        $normalized = $catalog->normalizeTriggerRows([
            ['field_key' => 'category_id', 'match_mode' => 'exact', 'match_value' => ''],
        ]);

        $this->assertCount(0, $normalized);
    }

    public function test_normalize_trigger_rows_dedupes_by_field_key_keeping_last(): void
    {
        $company = new Company([
            'id' => 1,
            'package_pipeline_routing_trigger_fields' => ['category_id'],
        ]);
        session(['company' => $company]);

        $catalog = app(PackageRoutingFieldCatalog::class);
        $normalized = $catalog->normalizeTriggerRows([
            ['field_key' => 'category_id', 'match_mode' => 'exact', 'match_value' => 'first'],
            ['field_key' => 'category_id', 'match_mode' => 'exact', 'match_value' => 'second'],
        ]);

        // package_routing_triggers has unique(package_id, field_key) — two rows for
        // the same field would otherwise throw on save, so the later one must win.
        $this->assertCount(1, $normalized);
        $this->assertSame('second', $normalized[0]['match_value']);
    }

    public function test_changed_routing_field_keys_only_includes_enabled_fields(): void
    {
        $company = new Company([
            'id' => 1,
            'package_pipeline_routing_trigger_fields' => ['category_id'],
        ]);
        session(['company' => $company]);

        $catalog = app(PackageRoutingFieldCatalog::class);

        $this->assertSame(
            ['category_id'],
            $catalog->changedRoutingFieldKeysFromPayload([
                'category_id' => 5,
                'product_id' => [1, 2],
            ]),
        );
    }

    public function test_enabled_relation_backed_field_keys_respect_trigger_field_settings(): void
    {
        $company = new Company([
            'id' => 1,
            'package_pipeline_routing_trigger_fields' => ['category_id'],
        ]);
        session(['company' => $company]);

        $catalog = app(PackageRoutingFieldCatalog::class);

        $this->assertSame([], $catalog->enabledRelationBackedFieldKeys());

        $company->package_pipeline_routing_trigger_fields = ['product_id'];
        session(['company' => $company]);
        $catalog = app(PackageRoutingFieldCatalog::class);

        $this->assertSame(['product_id'], $catalog->enabledRelationBackedFieldKeys());
    }

    public function test_build_trigger_fields_from_deal_uses_enabled_fields_only(): void
    {
        $company = new Company([
            'id' => 1,
            'package_pipeline_routing_trigger_fields' => ['category_id'],
        ]);

        $deal = new Deal([
            'category_id' => 9,
        ]);
        $deal->setRelation('products', collect());

        session(['company' => $company]);

        $catalog = app(PackageRoutingFieldCatalog::class);

        $this->assertSame(
            ['category_id' => 9],
            $catalog->buildTriggerFieldsFromDeal($deal, ['category_id', 'product_id']),
        );
    }
}
