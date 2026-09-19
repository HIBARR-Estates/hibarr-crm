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

    public function test_native_column_resolves_plain_deal_attributes_only()
    {
        $deal = Deal::factory()->create();

        $this->assertSame('value', $this->service->nativeColumn($deal, 'value'));
        $this->assertNull($this->service->nativeColumn($deal, 'interested_in')); // hibarr field
        $this->assertNull($this->service->nativeColumn($deal, 'custom_field_123'));
        $this->assertNull($this->service->nativeColumn($deal, 'last_followup_remark'));
        $this->assertNull($this->service->nativeColumn($deal, 'lead_field_client_name'));
        $this->assertNull($this->service->nativeColumn($deal, 'lead_marketing_utm_source'));
    }

    public function test_native_column_resolves_whitelisted_lead_attributes_only()
    {
        $lead = \App\Models\Lead::factory()->create();

        $this->assertSame('client_name', $this->service->nativeColumn($lead, 'client_name'));
        $this->assertSame('client_name', $this->service->nativeColumn($lead, 'lead_field_client_name'));
        $this->assertNull($this->service->nativeColumn($lead, 'custom_field_123'));
        $this->assertNull($this->service->nativeColumn($lead, 'not_a_whitelisted_column'));
    }

    public function test_it_resolves_the_current_value_not_the_pre_save_original()
    {
        // Mirrors exactly what an 'updated' observer sees: Eloquent only
        // calls syncOriginal() after the 'saved' event, which fires *after*
        // 'updated' — so at the point an automation's conditions are
        // evaluated, the model is dirty (attribute assigned, original not
        // yet synced). getRawOriginal() would still return the pre-change
        // value here; resolve() must return the new one.
        $lead = \App\Models\Lead::factory()->create(['client_name' => 'Old Name']);

        $lead->client_name = 'New Name';

        $this->assertEquals('Old Name', $lead->getRawOriginal('client_name'));
        $this->assertEquals('New Name', $this->service->resolve($lead, 'client_name'));
    }
}
