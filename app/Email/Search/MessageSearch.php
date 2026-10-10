<?php

namespace App\Email\Search;

use App\Email\Models\EmailFile;
use App\Email\Models\EmailMessage;
use App\Email\Support\SafePreview;
use Illuminate\Database\Eloquent\Builder;

/**
 * Narrows a set of messages to those matching a search term: participants,
 * subject, body text, or the name of an attached file.
 *
 * It only ever narrows. The set it is given has already been limited to what
 * the user may read (EmailAccess), so nothing here can widen what they see —
 * and a snippet is cut only from a message that survived that.
 */
class MessageSearch
{
    public const MIN_LENGTH = 2;

    private const SNIPPET_RADIUS = 80;

    /**
     * @param  Builder  $messages  A query over email_messages.
     */
    public function filter(Builder $messages, string $term): Builder
    {
        $like = '%'.$this->escape(mb_strtolower(trim($term))).'%';

        $withFile = EmailFile::withoutGlobalScopes()
            ->whereNotNull('message_id')
            ->whereRaw("LOWER(filename) LIKE ? ESCAPE '!'", [$like])
            ->select('message_id');

        return $messages->where(function ($query) use ($like, $withFile) {
            foreach (['subject', 'from_email', 'from_name', 'text_body'] as $column) {
                $query->orWhereRaw("LOWER({$column}) LIKE ? ESCAPE '!'", [$like]);
            }

            // Recipients are stored as JSON; matching its text finds both addresses and names.
            foreach (['to_recipients', 'cc_recipients'] as $column) {
                $query->orWhereRaw("LOWER(CAST({$column} AS CHAR)) LIKE ? ESCAPE '!'", [$like]);
            }

            $query->orWhereIn('id', $withFile);
        });
    }

    /**
     * Plain text around the first place the term appears in the body, or the
     * start of the message when it matched somewhere else (a name, a file).
     */
    public function snippet(EmailMessage $message, string $term): ?string
    {
        $text = SafePreview::from($message->text_body, $message->html_raw, PHP_INT_MAX);

        if ($text === null) {
            return null;
        }

        $position = mb_stripos($text, trim($term));

        if ($position === false) {
            return SafePreview::from($text);
        }

        $start = max(0, $position - self::SNIPPET_RADIUS);
        $length = mb_strlen(trim($term)) + 2 * self::SNIPPET_RADIUS;

        return ($start > 0 ? '…' : '')
            .trim(mb_substr($text, $start, $length))
            .($start + $length < mb_strlen($text) ? '…' : '');
    }

    private function escape(string $term): string
    {
        return str_replace(['!', '%', '_'], ['!!', '!%', '!_'], $term);
    }
}
