<?php

namespace Tests\Unit\Email;

use App\Email\Data\EmailAddress;
use App\Email\Support\RfcHeaders;
use PHPUnit\Framework\TestCase;

class RfcHeadersTest extends TestCase
{
    public function test_it_reads_only_the_header_block_and_unfolds_lines(): void
    {
        $headers = RfcHeaders::parse(implode("\r\n", [
            'Message-ID: <reply-1@mail.example.test>',
            'In-Reply-To: <root@mail.example.test>',
            'References: <root@mail.example.test>',
            ' <mid@mail.example.test>',
            'Subject: Re: Villa',
            "\tviewing",
            'X-Empty:',
            '',
            'Subject: this line is body, not a header',
            'Message-ID: <body@mail.example.test>',
        ]));

        $this->assertSame('<reply-1@mail.example.test>', $headers->raw('message-id'));
        $this->assertSame('<root@mail.example.test>', $headers->raw('In-Reply-To'));
        $this->assertSame('<root@mail.example.test> <mid@mail.example.test>', $headers->raw('References'));
        $this->assertSame('Re: Villa viewing', $headers->get('Subject'));
        $this->assertTrue($headers->has('X-Empty'));
        $this->assertNull($headers->get('X-Empty'));
        $this->assertNull($headers->get('Cc'));
        $this->assertFalse($headers->has('Cc'));
    }

    public function test_it_accepts_bare_newlines(): void
    {
        $headers = RfcHeaders::parse("From: lead@example.test\nSubject: Hello\n\nBody");

        $this->assertSame('lead@example.test', $headers->address('From')->address);
        $this->assertSame('Hello', $headers->get('Subject'));
    }

    public function test_it_splits_address_lists_without_breaking_quoted_names(): void
    {
        $headers = RfcHeaders::parse(implode("\r\n", [
            'From: "Doe, Jane" <Jane@Example.test>',
            'To: Agent One <one@agency.test>, "Two, Agent" <two@agency.test>,',
            ' three@agency.test, not-an-address, ONE@agency.test',
            'Cc: undisclosed-recipients:;',
            '',
            '',
        ]));

        $from = $headers->address('From');

        $this->assertSame('jane@example.test', $from->address);
        $this->assertSame('Doe, Jane', $from->name);
        $this->assertSame(
            ['one@agency.test', 'two@agency.test', 'three@agency.test'],
            array_map(fn (EmailAddress $a) => $a->address, $headers->addresses('To')),
        );
        $this->assertSame('Two, Agent', $headers->addresses('To')[1]->name);
        $this->assertSame([], $headers->addresses('Cc'));
        $this->assertNull($headers->address('Reply-To'));
    }

    public function test_it_decodes_encoded_words(): void
    {
        $headers = RfcHeaders::parse(implode("\r\n", [
            'Subject: =?UTF-8?B?QmVzaWNodGlndW5nIGbDvHIgZGllIFZpbGxh?=',
            'From: =?UTF-8?Q?J=C3=BCrgen_M=C3=BCller?= <juergen@example.test>',
            '',
            '',
        ]));

        $this->assertSame('Besichtigung für die Villa', $headers->get('Subject'));
        $this->assertSame('Jürgen Müller', $headers->address('From')->name);
        $this->assertSame('=?UTF-8?B?QmVzaWNodGlndW5nIGbDvHIgZGllIFZpbGxh?=', $headers->raw('Subject'));
    }

    public function test_it_parses_the_original_date_and_survives_a_bad_one(): void
    {
        $good = RfcHeaders::parse("Date: Thu, 01 Oct 2026 11:30:00 +0200 (CEST)\r\n\r\n");
        $bad = RfcHeaders::parse("Date: sometime last week\r\n\r\n");

        $this->assertSame('2026-10-01T11:30:00+02:00', $good->date()->format(DATE_ATOM));
        $this->assertNull($bad->date());
        $this->assertNull(RfcHeaders::parse('')->date());
    }
}
