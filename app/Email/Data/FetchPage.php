<?php

namespace App\Email\Data;

final class FetchPage
{
    /** @var list<NormalizedMessage> */
    public readonly array $messages;

    /**
     * @param  iterable<NormalizedMessage>  $messages
     * @param  Checkpoint  $checkpoint  Persist only after these messages are ingested.
     * @param  bool  $hasMore  True when another fetchSince() with this checkpoint would return more.
     */
    public function __construct(
        iterable $messages,
        public readonly Checkpoint $checkpoint,
        public readonly bool $hasMore = false,
    ) {
        $list = [];
        foreach ($messages as $message) {
            if ($message instanceof NormalizedMessage) {
                $list[] = $message;
            }
        }
        $this->messages = $list;
    }

    public static function empty(Checkpoint $checkpoint): self
    {
        return new self([], $checkpoint);
    }

    public function isEmpty(): bool
    {
        return $this->messages === [];
    }
}
