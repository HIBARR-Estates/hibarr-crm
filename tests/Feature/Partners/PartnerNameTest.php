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
}
