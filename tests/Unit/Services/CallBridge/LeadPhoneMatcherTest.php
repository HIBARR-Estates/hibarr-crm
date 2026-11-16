<?php

namespace Tests\Unit\Services\CallBridge;

use App\Models\Lead;
use App\Models\LeadContactMethod;
use App\Services\CallBridge\LeadPhoneMatcher;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

class LeadPhoneMatcherTest extends TestCase
{
    private LeadPhoneMatcher $matcher;

    protected function setUp(): void
    {
        parent::setUp();
        $this->matcher = new LeadPhoneMatcher;
    }

    /** @return array<string, array{0: string, 1: string}> */
    public static function storedFormats(): array
    {
        return [
            'E.164' => ['+905338773001', '905338773001'],
            'spaced' => ['+90 533 877 30 01', '905338773001'],
            'brackets, dash and dot' => ['+90 (533) 877-30.01', '905338773001'],
            'slashes' => ['0533/877/3001', '05338773001'],
            'antd JSON' => ['{"countryCode":"90","areaCode":"533","phoneNumber":"8773001","isoCode":"tr"}', '905338773001'],
            'antd JSON without area code' => ['{"countryCode":"90","areaCode":null,"phoneNumber":"5338773001"}', '905338773001'],
            'antd JSON without country code' => ['{"countryCode":null,"areaCode":"533","phoneNumber":"8773001"}', '5338773001'],
            'phone JSON' => ['{"phone":"+90 533 877 3001"}', '905338773001'],
        ];
    }

    #[DataProvider('storedFormats')]
    public function test_stored_formats_reduce_to_digits(string $stored, string $digits): void
    {
        $this->assertSame($digits, $this->matcher->normalize($stored));
    }

    public function test_national_and_international_forms_of_one_number_match(): void
    {
        foreach (['905338773001', '05338773001', '00905338773001', '5338773001'] as $incoming) {
            $this->assertTrue($this->matcher->matches($incoming, '+90 533 877 30 01'), $incoming);
        }
    }

    public function test_a_different_number_does_not_match(): void
    {
        $this->assertFalse($this->matcher->matches('905338773002', '+905338773001'));
    }

    public function test_short_numbers_must_match_exactly(): void
    {
        $this->assertFalse($this->matcher->matches('73001', '+905338773001'));
        $this->assertTrue($this->matcher->matches('73001', '73001'));
    }

    public function test_a_number_in_any_phone_column_matches_the_lead(): void
    {
        foreach (LeadPhoneMatcher::PHONE_COLUMNS as $column) {
            $lead = $this->lead([$column => '+49 157 9253 0585']);

            $this->assertTrue($this->matcher->leadMatches('015792530585', $lead), $column);
        }
    }

    public function test_a_phone_contact_method_matches_the_lead(): void
    {
        $lead = $this->lead([], [['type' => 'phone', 'identifier' => '+49 157 92530585', 'normalized' => null]]);

        $this->assertTrue($this->matcher->leadMatches('4915792530585', $lead));
    }

    public function test_an_email_contact_method_never_matches(): void
    {
        $lead = $this->lead([], [['type' => 'email', 'identifier' => '15792530585@example.com', 'normalized' => null]]);

        $this->assertFalse($this->matcher->leadMatches('4915792530585', $lead));
    }

    /**
     * @param  array<string, string>  $phones
     * @param  array<int, array<string, ?string>>  $methods
     */
    private function lead(array $phones, array $methods = []): Lead
    {
        $lead = new Lead;
        foreach ($phones as $column => $value) {
            $lead->setAttribute($column, $value);
        }
        $lead->setRelation('contactMethods', collect($methods)->map(
            fn (array $attributes) => (new LeadContactMethod)->forceFill($attributes)
        ));

        return $lead;
    }
}
