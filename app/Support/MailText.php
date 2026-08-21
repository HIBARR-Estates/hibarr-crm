<?php

namespace App\Support;

final class MailText
{
    /**
     * Ensure the first letter of each sentence starts with a capital letter.
     */
    public static function capitalizeSentences(string $text): string
    {
        $text = trim($text);
        if ($text === '') {
            return '';
        }

        return (string) preg_replace_callback(
            '/(^|[.!?]\s+)([a-z])/u',
            static fn (array $matches): string => $matches[1].mb_strtoupper($matches[2]),
            $text,
        );
    }
}
