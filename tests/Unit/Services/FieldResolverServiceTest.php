<?php

namespace Tests\Unit\Services;

use App\Models\Deal;
use App\Models\DealFollowUp;
use App\Models\HibarrDealFields;
use App\Services\FieldResolverService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class FieldResolverServiceTest extends TestCase
{
    use RefreshDatabase;

    protected FieldResolverService $service;

    protected function setUp(): void
    {
        parent::setUp();
        $this->service = new FieldResolverService();
    }

    public function test_it_resolves_native_deal_field()
    {
        $deal = Deal::factory()->create([
            'value' => 5000,
        ]);

        $value = $this->service->resolve($deal, 'value');

        $this->assertEquals(5000, $value);
    }

    public function test_it_resolves_hibarr_deal_field()
    {
        $deal = Deal::factory()->create();
        HibarrDealFields::create([
            'deal_id' => $deal->id,
            'interested_in' => 'Apartment',
        ]);

        // Reload relation
        $deal->load('hibarrFields');

        $value = $this->service->resolve($deal, 'interested_in');

        $this->assertEquals('Apartment', $value);
    }

    public function test_it_resolves_custom_field()
    {
        $deal = Deal::factory()->create();
        
        // Create custom field data manually
        $customFieldId = 123;
        DB::table('custom_fields_data')->insert([
            'model' => Deal::CUSTOM_FIELD_MODEL,
            'model_id' => $deal->id,
            'custom_field_id' => $customFieldId,
            'value' => 'Custom Value',
        ]);

        $value = $this->service->resolve($deal, 'custom_field_' . $customFieldId);

        $this->assertEquals('Custom Value', $value);
    }

    public function test_it_resolves_followup_field()
    {
        $deal = Deal::factory()->create();
        
        $followup = new DealFollowUp();
        $followup->deal_id = $deal->id;
        $followup->remark = 'Test Remark';
        $followup->created_at = now();
        $followup->save();

        $value = $this->service->resolve($deal, 'last_followup_remark');

        $this->assertEquals('Test Remark', $value);
    }

    public function test_it_returns_null_for_missing_field()
    {
        $deal = Deal::factory()->create();

        $value = $this->service->resolve($deal, 'non_existent_field');

        $this->assertNull($value);
    }
}
