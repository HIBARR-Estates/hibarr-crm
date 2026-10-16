<?php

namespace Tests\Unit\Leads;

use App\Enums\Salutation;
use App\Http\Controllers\Api\DealContactApiController;
use App\Models\Lead;
use App\Services\LeadCoreFieldsService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\App;
use Mockery;
use ReflectionMethod;
use Tests\TestCase;

/**
 * A salutation is stored as a language-neutral code (mr, mrs, dr, ...); the
 * word shown comes from the lead's own language, so a German lead is
 * "Herr Schmidt" to any staff member.
 */
class SalutationLanguageTest extends TestCase
{
    protected function tearDown(): void
    {
        App::setLocale('eng');
        Mockery::close();
        parent::tearDown();
    }

    public function test_label_renders_in_the_requested_locale(): void
    {
        $this->assertSame('Herr', Salutation::Mr->label('de'));
        $this->assertSame('Frau', Salutation::Mrs->label('de'));
        $this->assertSame('Dr.', Salutation::Dr->label('de'));
        $this->assertSame('Bay', Salutation::Mr->label('tr'));
        $this->assertSame('Г-н', Salutation::Mr->label('ru'));
        $this->assertSame('Mr', Salutation::Mr->label('eng'));
    }

    public function test_label_without_a_locale_uses_the_current_locale(): void
    {
        App::setLocale('de');
        $this->assertSame('Herr', Salutation::Mr->label());

        App::setLocale('eng');
        $this->assertSame('Mr', Salutation::Mr->label());
    }

    public function test_a_lead_is_addressed_in_its_own_language(): void
    {
        App::setLocale('eng');

        $this->assertSame('Frau Jane Doe', $this->lead(Salutation::Mrs, ['de'])->client_name_salutation);
        $this->assertSame('Mrs Jane Doe', $this->lead(Salutation::Mrs, ['en'])->client_name_salutation);
    }

    public function test_a_lead_with_no_language_keeps_the_viewers_locale(): void
    {
        App::setLocale('de');
        $this->assertSame('Herr Jane Doe', $this->lead(Salutation::Mr, [])->client_name_salutation);

        App::setLocale('eng');
        $this->assertSame('Mr Jane Doe', $this->lead(Salutation::Mr, [])->client_name_salutation);
    }

    public function test_a_lead_without_a_salutation_is_just_the_name(): void
    {
        $this->assertSame('Jane Doe', $this->lead(null, ['de'])->client_name_salutation);
    }

    public function test_the_api_fills_an_empty_languages_list_from_the_single_language_field(): void
    {
        $service = Mockery::mock(LeadCoreFieldsService::class);
        $service->shouldReceive('read')->andReturn(['languages' => []], ['languages' => ['de']]);
        $service->shouldReceive('supportedLanguageCode')->with('de')->andReturn('de');
        $service->shouldReceive('write')
            ->once()
            ->with(Mockery::type(Lead::class), ['languages' => ['de']]);
        $this->app->instance(LeadCoreFieldsService::class, $service);

        $lead = $this->lead(null, []);

        $this->assertTrue($this->invokeApplyAddressAndDob($lead, new Request(['language' => 'de'])));
    }

    public function test_the_api_ignores_a_language_that_is_not_configured(): void
    {
        $service = Mockery::mock(LeadCoreFieldsService::class);
        $service->shouldReceive('supportedLanguageCode')->with('xx')->andReturn(null);
        $service->shouldNotReceive('write');
        $this->app->instance(LeadCoreFieldsService::class, $service);

        $lead = $this->lead(null, []);

        $this->assertFalse($this->invokeApplyAddressAndDob($lead, new Request(['language' => 'xx'])));
    }

    public function test_the_api_never_replaces_languages_already_on_the_contact(): void
    {
        $service = Mockery::mock(LeadCoreFieldsService::class);
        $service->shouldNotReceive('write');
        $this->app->instance(LeadCoreFieldsService::class, $service);

        $lead = $this->lead(null, ['en', 'tr']);

        $this->assertFalse($this->invokeApplyAddressAndDob($lead, new Request(['language' => 'de'])));
    }

    public function test_an_explicit_languages_list_wins_over_the_single_language_field(): void
    {
        $service = Mockery::mock(LeadCoreFieldsService::class);
        $service->shouldReceive('read')->andReturn(['languages' => []], ['languages' => ['ru']]);
        $service->shouldReceive('write')
            ->once()
            ->with(Mockery::type(Lead::class), ['languages' => ['ru']]);
        $this->app->instance(LeadCoreFieldsService::class, $service);

        $lead = $this->lead(null, []);

        $this->invokeApplyAddressAndDob($lead, new Request(['languages' => ['ru'], 'language' => 'de']));
        $this->addToAssertionCount(1);
    }

    private function lead(?Salutation $salutation, array $languages): Lead
    {
        $lead = new Lead;
        $lead->client_name = 'Jane Doe';
        $lead->salutation = $salutation;
        $lead->languages = $languages;

        return $lead;
    }

    private function invokeApplyAddressAndDob(Lead $lead, Request $request): bool
    {
        $controller = new DealContactApiController;
        $method = new ReflectionMethod($controller, 'applyAddressAndDobToLead');
        $method->setAccessible(true);

        return (bool) $method->invoke($controller, $lead, $request);
    }
}
