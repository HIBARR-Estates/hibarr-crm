<?php

namespace Tests\Unit\Support;

use App\Support\SallyTranscriptNormalizer;
use PHPUnit\Framework\TestCase;

class SallyTranscriptNormalizerTest extends TestCase
{
    public function test_normalizes_sally_segment_list_and_builds_plain_text(): void
    {
        $result = SallyTranscriptNormalizer::normalize([
            [
                'id' => 'a2b13b49-10e7-44be-bbb1-db568406af42',
                'text' => 'Hi, Servus Kai.',
                'endTime' => 12.64,
                'sortOrder' => 0,
                'startTime' => 5.12,
                'speakerName' => 'Kai',
            ],
        ]);

        $this->assertSame('Kai: Hi, Servus Kai.', $result['transcript']);
        $this->assertCount(1, $result['transcript_segments']);
        $this->assertSame('Kai', $result['transcript_segments'][0]['speakerName']);
        $this->assertSame(5.12, $result['transcript_segments'][0]['startTime']);
    }

    public function test_accepts_plain_string_transcript(): void
    {
        $result = SallyTranscriptNormalizer::normalize('Full plain transcript.');

        $this->assertSame('Full plain transcript.', $result['transcript']);
        $this->assertNull($result['transcript_segments']);
    }

    public function test_transcript_segments_alias(): void
    {
        $result = SallyTranscriptNormalizer::normalize(null, [
            ['text' => 'Line one', 'speakerName' => 'A', 'sortOrder' => 1],
            ['text' => 'Line two', 'speakerName' => 'B', 'sortOrder' => 0],
        ]);

        $this->assertSame("B: Line two\nA: Line one", $result['transcript']);
        $this->assertSame('B', $result['transcript_segments'][0]['speakerName']);
    }
}
