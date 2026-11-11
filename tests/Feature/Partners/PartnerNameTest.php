<?php

namespace Tests\Feature\Partners;

use App\Support\PartnerRole;
use Tests\TestCase;

class PartnerNameTest extends TestCase
{
    public function test_names_are_abbreviated_to_initial_and_surname(): void
    {
        $this->assertSame('S. Al-Rashid', PartnerRole::abbreviateName('Sarah Al-Rashid'));
        $this->assertSame('M. van der Berg', PartnerRole::abbreviateName('Maria van der Berg'));
        $this->assertSame('Madonna', PartnerRole::abbreviateName('Madonna'));
        $this->assertSame('Ö. Yılmaz', PartnerRole::abbreviateName('Özlem Yılmaz'));
        $this->assertNull(PartnerRole::abbreviateName(null));
        $this->assertNull(PartnerRole::abbreviateName('   '));
    }

    public function test_full_name_keeps_every_part_and_drops_blank_names(): void
    {
        $this->assertSame('Sarah Al-Rashid', PartnerRole::fullName('  Sarah Al-Rashid  '));
        $this->assertSame('Madonna', PartnerRole::fullName('Madonna'));
        $this->assertNull(PartnerRole::fullName(null));
        $this->assertNull(PartnerRole::fullName('   '));
    }

    public function test_source_label_prefers_first_touch_utm_over_the_lead_source(): void
    {
        $this->assertSame(
            ['source' => 'google', 'lead_source' => 'Website'],
            PartnerRole::sourceLabels('google', 'Website'),
        );
        $this->assertSame(
            ['source' => 'google', 'lead_source' => null],
            PartnerRole::sourceLabels('  google  ', 'Google'),
        );
        $this->assertSame(
            ['source' => 'Website', 'lead_source' => null],
            PartnerRole::sourceLabels(null, 'Website'),
        );
        $this->assertSame(
            ['source' => 'ig', 'lead_source' => null],
            PartnerRole::sourceLabels('ig', '   '),
        );
        $this->assertSame(
            ['source' => null, 'lead_source' => null],
            PartnerRole::sourceLabels(null, null),
        );
    }
}
