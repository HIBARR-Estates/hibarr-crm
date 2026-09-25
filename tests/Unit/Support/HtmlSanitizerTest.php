<?php

namespace Tests\Unit\Support;

use App\Support\HtmlSanitizer;
use Tests\TestCase;

class HtmlSanitizerTest extends TestCase
{
    private const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

    public function test_it_removes_scripts_and_event_handlers(): void
    {
        $clean = HtmlSanitizer::clean('<p onclick="steal()">hi</p><img src=x onerror=alert(1)><script>alert(1)</script><svg onload=alert(1)></svg>');

        $this->assertStringContainsString('<p>hi</p>', $clean);
        $this->assertStringNotContainsString('onclick', $clean);
        $this->assertStringNotContainsString('onerror', $clean);
        $this->assertStringNotContainsString('<script', $clean);
        $this->assertStringNotContainsString('<svg', $clean);
    }

    public function test_it_removes_javascript_urls_foreign_iframes_and_svg_images(): void
    {
        $clean = HtmlSanitizer::clean(
            '<a href="javascript:alert(1)">x</a>'
            . '<iframe src="https://evil.example/"></iframe>'
            . '<img src="data:image/svg+xml;base64,PHN2ZyBvbmxvYWQ9YWxlcnQoMSk+PC9zdmc+">'
            . '<span style="background:url(javascript:alert(1))">s</span>'
        );

        $this->assertStringNotContainsString('javascript:', $clean);
        $this->assertStringNotContainsString('evil.example', $clean);
        $this->assertStringNotContainsString('svg', $clean);
    }

    public function test_it_cannot_close_a_surrounding_textarea(): void
    {
        $this->assertStringNotContainsString('</textarea>', HtmlSanitizer::clean('</textarea><img src=x onerror=alert(1)>'));
    }

    public function test_it_keeps_quill_formatting(): void
    {
        $html = '<h2>Title</h2><p class="ql-align-center"><strong>bold</strong> <em>i</em> <u>u</u> <s>s</s></p><ol><li class="ql-indent-1">one</li></ol>';

        $this->assertSame($html, HtmlSanitizer::clean($html));
    }

    public function test_it_keeps_quill_2_ordered_list_markup(): void
    {
        $html = '<ol><li data-list="ordered"><span class="ql-ui" contenteditable="false"></span>hshhud</li>'
            . '<li data-list="ordered">jhdhjaief</li>'
            . '<li data-list="ordered">hdfjdfhhfikakbdfvdd</li></ol>';

        $clean = HtmlSanitizer::clean($html);

        $this->assertStringContainsString('<ol>', $clean);
        $this->assertStringContainsString('<li data-list="ordered">', $clean);
        $this->assertStringContainsString('hshhud', $clean);
        $this->assertStringContainsString('jhdhjaief', $clean);
        $this->assertStringContainsString('hdfjdfhhfikakbdfvdd', $clean);
    }

    public function test_it_keeps_quill_list_type_attribute_for_bullets(): void
    {
        $html = '<ol><li data-list="bullet">alpha</li><li data-list="bullet">beta</li></ol>';

        $clean = HtmlSanitizer::clean($html);

        $this->assertStringContainsString('data-list="bullet"', $clean);
        $this->assertStringContainsString('alpha', $clean);
    }

    public function test_it_keeps_colours_and_links_that_open_in_a_new_tab(): void
    {
        $clean = HtmlSanitizer::clean('<p><span style="color: rgb(230, 0, 0);">red</span> <a href="https://example.com" target="_blank" rel="noopener noreferrer">link</a></p>');

        $this->assertStringContainsString('style="color:rgb(230,0,0);"', $clean);
        $this->assertStringContainsString('href="https://example.com"', $clean);
        $this->assertStringContainsString('target="_blank"', $clean);
    }

    public function test_it_keeps_mentions(): void
    {
        $html = '<p><span class="mention" data-index="0" data-denotation-char="@" data-id="12" data-value="Jane Doe"><span contenteditable="false"><span class="ql-mention-denotation-char">@</span>Jane Doe</span></span> hi</p>';

        $this->assertSame($html, HtmlSanitizer::clean($html));
    }

    public function test_it_keeps_images_and_video_embeds(): void
    {
        $clean = HtmlSanitizer::clean('<p><img src="https://crm.example.com/user-uploads/a.png"><img src="' . self::PNG . '"></p>');

        $this->assertStringContainsString('<img src="https://crm.example.com/user-uploads/a.png" alt="" />', $clean);
        $this->assertStringContainsString('<img src="' . self::PNG . '" alt="" />', $clean);

        $video = HtmlSanitizer::clean('<iframe class="ql-video" frameborder="0" allowfullscreen="true" src="https://www.youtube.com/embed/abc123"></iframe>');

        $this->assertStringContainsString('src="https://www.youtube.com/embed/abc123"', $video);
    }

    public function test_plain_text_is_returned_unchanged(): void
    {
        foreach (['Tom & Jerry', 'a < b and c > d', 'I <3 this', "line one\nline two", ''] as $text) {
            $this->assertSame($text, HtmlSanitizer::clean($text));
        }

        $this->assertNull(HtmlSanitizer::clean(null));
    }
}
