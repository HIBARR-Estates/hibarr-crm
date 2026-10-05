<?php

namespace Tests\Feature;

use App\Models\Lead;
use App\Models\LeadMarketing;
use App\Models\LeadUtmTouch;
use App\Services\LeadUtmService;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class LeadUtmFirstTouchTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        Config::set('database.default', 'sqlite');
        Config::set('database.connections.sqlite.database', ':memory:');
        DB::purge('sqlite');
        DB::reconnect('sqlite');

        Schema::dropIfExists('lead_utm_touches');
        Schema::dropIfExists('lead_marketing');
        Schema::dropIfExists('leads');

        Schema::create('leads', function (Blueprint $t) {
            $t->increments('id');
            $t->timestamps();
        });
        Schema::create('lead_marketing', function (Blueprint $t) {
            $t->id();
            $t->unsignedInteger('lead_id')->nullable();
            foreach (LeadUtmTouch::UTM_FIELDS as $f) {
                $t->string($f)->nullable();
            }
            $t->timestamps();
        });
        Schema::create('lead_utm_touches', function (Blueprint $t) {
            $t->id();
            $t->unsignedInteger('lead_id');
            foreach (LeadUtmTouch::UTM_FIELDS as $f) {
                $t->string($f)->nullable();
            }
            $t->string('origin', 50)->nullable();
            $t->boolean('is_first_touch')->default(false);
            $t->timestamps();
        });
    }

    public function test_first_utm_is_kept_and_later_ones_are_logged_separately(): void
    {
        $lead = Lead::withoutGlobalScopes()->forceCreate([]);
        $service = new LeadUtmService();

        $service->record($lead, ['utm_source' => 'facebook', 'utm_campaign' => 'launch'], 'api');
        $service->record($lead, ['utm_source' => 'google', 'utm_campaign' => 'retarget'], 'api');
        $service->record($lead, ['utm_source' => 'google', 'utm_campaign' => 'retarget'], 'api'); // repeat

        $marketing = LeadMarketing::where('lead_id', $lead->id)->first();
        $this->assertSame('facebook', $marketing->utm_source);
        $this->assertSame('launch', $marketing->utm_campaign);

        $touches = LeadUtmTouch::where('lead_id', $lead->id)->orderBy('id')->get();
        $this->assertCount(2, $touches);
        $this->assertTrue($touches[0]->is_first_touch);
        $this->assertSame('facebook', $touches[0]->utm_source);
        $this->assertFalse($touches[1]->is_first_touch);
        $this->assertSame('google', $touches[1]->utm_source);
    }

    public function test_empty_utm_is_ignored(): void
    {
        $lead = Lead::withoutGlobalScopes()->forceCreate([]);

        $this->assertNull((new LeadUtmService())->record($lead, ['utm_source' => null, 'utm_medium' => ''], 'api'));
        $this->assertSame(0, LeadUtmTouch::count());
    }

    public function test_untracked_first_touch_is_logged_before_a_later_set(): void
    {
        $lead = Lead::withoutGlobalScopes()->forceCreate([]);
        LeadMarketing::create(['lead_id' => $lead->id, 'utm_source' => 'facebook']);

        (new LeadUtmService())->record($lead, ['utm_source' => 'google'], 'api');

        $touches = LeadUtmTouch::where('lead_id', $lead->id)->orderBy('id')->get();
        $this->assertCount(2, $touches);
        $this->assertTrue($touches[0]->is_first_touch);
        $this->assertSame('facebook', $touches[0]->utm_source);
        $this->assertFalse($touches[1]->is_first_touch);
        $this->assertSame('facebook', LeadMarketing::where('lead_id', $lead->id)->value('utm_source'));
    }
}
