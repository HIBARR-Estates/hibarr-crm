<?php

namespace Tests\Unit\Support;

use App\Models\Company;
use App\Models\Lead;
use App\Support\LeadLocaleResolver;
use Tests\TestCase;

class LeadLocaleResolverTest extends TestCase
{
    public function test_it_uses_the_leads_first_preferred_language(): void
    {
        $lead = new Lead();
        $lead->languages = ['de', 'en'];

        $this->assertSame('de', LeadLocaleResolver::resolve($lead));
    }

    public function test_it_falls_back_to_company_locale_when_lead_has_no_languages(): void
    {
        $lead = new Lead();
        $lead->languages = [];
        $company = new Company();
        $company->locale = 'tr';

        $this->assertSame('tr', LeadLocaleResolver::resolve($lead, $company));
    }

    public function test_it_maps_english_codes_to_eng_lang_directory(): void
    {
        $lead = new Lead();
        $lead->languages = ['en'];

        $this->assertSame('eng', LeadLocaleResolver::resolve($lead));
    }
}
