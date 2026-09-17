<?php

namespace Tests\Unit\Support;

use Tests\TestCase;

class CleanHtmlHelperTest extends TestCase
{
    public function test_it_sanitizes_rich_text_for_raw_output(): void
    {
        $this->assertSame('<p>note</p>', clean_html('<p onclick="steal()">note</p><script>alert(1)</script>'));
    }

    public function test_it_handles_empty_and_non_string_values(): void
    {
        $this->assertSame('', clean_html(null));
        $this->assertSame('--', clean_html('--'));
        $this->assertSame('42', clean_html(42));
    }

    public function test_it_keeps_nl2br_line_breaks(): void
    {
        $this->assertSame("one<br />\ntwo", clean_html(nl2br("one\ntwo")));
    }
}
