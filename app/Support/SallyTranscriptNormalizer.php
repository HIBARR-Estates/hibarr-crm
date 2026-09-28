<?php

namespace App\Support;

/**
 * Normalizes Sally transcript payloads: plain string and/or timed speaker segments.
 */
class SallyTranscriptNormalizer
{
    /**
     * @return array{transcript: ?string, transcript_segments: ?array<int, array<string, mixed>>}
     */
    public static function normalize(mixed $transcript, mixed $transcriptSegments = null): array
    {
        $segments = null;

        if (is_array($transcriptSegments) && $transcriptSegments !== []) {
            $segments = self::normalizeSegments($transcriptSegments);
        } elseif (is_array($transcript) && self::looksLikeSegmentList($transcript)) {
            $segments = self::normalizeSegments($transcript);
        }

        if (is_string($transcript)) {
            $text = trim($transcript);

            return [
                'transcript' => $text !== '' ? $text : null,
                'transcript_segments' => $segments,
            ];
        }

        if ($segments !== null) {
            return [
                'transcript' => self::segmentsToString($segments),
                'transcript_segments' => $segments,
            ];
        }

        return [
            'transcript' => null,
            'transcript_segments' => null,
        ];
    }

    /**
     * @param  array<int, mixed>  $raw
     * @return array<int, array<string, mixed>>
     */
    public static function normalizeSegments(array $raw): array
    {
        $segments = [];
        foreach ($raw as $index => $entry) {
            if (is_string($entry)) {
                $text = trim($entry);
                if ($text === '') {
                    continue;
                }
                $segments[] = [
                    'id' => null,
                    'text' => $text,
                    'speakerName' => null,
                    'startTime' => null,
                    'endTime' => null,
                    'sortOrder' => $index,
                ];

                continue;
            }

            if (! is_array($entry)) {
                continue;
            }

            $text = self::segmentText($entry);
            if ($text === '') {
                continue;
            }

            $speaker = self::segmentSpeaker($entry);
            $sortOrder = isset($entry['sortOrder']) && is_numeric($entry['sortOrder'])
                ? (int) $entry['sortOrder']
                : $index;

            $segments[] = [
                'id' => isset($entry['id']) && is_string($entry['id']) ? $entry['id'] : null,
                'text' => $text,
                'speakerName' => $speaker,
                'startTime' => isset($entry['startTime']) && is_numeric($entry['startTime'])
                    ? (float) $entry['startTime']
                    : null,
                'endTime' => isset($entry['endTime']) && is_numeric($entry['endTime'])
                    ? (float) $entry['endTime']
                    : null,
                'sortOrder' => $sortOrder,
            ];
        }

        usort($segments, function (array $a, array $b): int {
            $order = ($a['sortOrder'] ?? 0) <=> ($b['sortOrder'] ?? 0);
            if ($order !== 0) {
                return $order;
            }

            return ($a['startTime'] ?? 0.0) <=> ($b['startTime'] ?? 0.0);
        });

        return array_values($segments);
    }

    /**
     * @param  array<int, array<string, mixed>>  $segments
     */
    public static function segmentsToString(array $segments): ?string
    {
        if ($segments === []) {
            return null;
        }

        $lines = [];
        foreach ($segments as $segment) {
            $text = trim((string) ($segment['text'] ?? ''));
            if ($text === '') {
                continue;
            }
            $speaker = $segment['speakerName'] ?? null;
            $lines[] = is_string($speaker) && $speaker !== ''
                ? $speaker.': '.$text
                : $text;
        }

        $joined = trim(implode("\n", $lines));

        return $joined !== '' ? $joined : null;
    }

    /**
     * @param  array<int, mixed>  $list
     */
    private static function looksLikeSegmentList(array $list): bool
    {
        foreach ($list as $entry) {
            if (is_array($entry)) {
                return true;
            }
        }

        return false;
    }

    /**
     * @param  array<string, mixed>  $entry
     */
    private static function segmentText(array $entry): string
    {
        foreach (['text', 'content', 'message'] as $key) {
            if (isset($entry[$key]) && is_string($entry[$key])) {
                return trim($entry[$key]);
            }
        }

        return '';
    }

    /**
     * @param  array<string, mixed>  $entry
     */
    private static function segmentSpeaker(array $entry): ?string
    {
        foreach (['speakerName', 'speaker', 'name'] as $key) {
            if (isset($entry[$key]) && is_string($entry[$key]) && trim($entry[$key]) !== '') {
                return trim($entry[$key]);
            }
        }

        return null;
    }
}
