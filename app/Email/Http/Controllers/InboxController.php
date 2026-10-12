<?php

namespace App\Email\Http\Controllers;

use App\Email\Authorization\EmailAccess;
use App\Email\Models\EmailMailboxCopy;
use App\Email\Review\Handoffs;
use App\Email\Review\ReviewQueue;
use App\Email\Search\MessageSearch;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Inertia\Inertia;
use Inertia\Response as InertiaResponse;
use Throwable;

/**
 * The mailbox owner's synced mail, grouped into conversations and filtered
 * by the message date already stored in the CRM.
 */
class InboxController
{
    /** @var list<int> */
    private const PRESETS = [7, 14, 30, 90];

    public function __construct(
        private readonly ReviewQueue $queue,
        private readonly Handoffs $handoffs,
        private readonly EmailAccess $access,
    ) {}

    public function index(Request $request): JsonResponse|InertiaResponse
    {
        $input = $request->validate([
            'preset' => ['nullable', 'in:7,14,30,90'],
            'from' => ['nullable', 'date', 'required_with:to'],
            'to' => ['nullable', 'date', 'required_with:from', 'after_or_equal:from'],
            'state' => ['nullable', 'in:all,needs_review'],
            'q' => ['nullable', 'string', 'min:'.MessageSearch::MIN_LENGTH, 'max:200'],
            'focus' => ['nullable', 'uuid'],
        ]);

        [$from, $to, $preset] = $this->window($input);
        $state = $input['state'] ?? 'all';
        $term = $input['q'] ?? null;

        /** @var User $user */
        $user = $request->user();

        $copies = $this->queue->inbox(
            $user,
            $from,
            $to,
            $state === 'needs_review',
            $term,
        );

        $focus = $input['focus'] ?? null;

        if (is_string($focus) && $copies->contains(fn (EmailMailboxCopy $copy) => $copy->uuid === $focus) === false) {
            $focused = $this->queue->owned($user)->where('uuid', $focus)->first();

            if ($focused !== null) {
                $copies->prepend($focused);
            }
        }

        $items = $this->queue->present($user, $copies, $term);
        $threads = $this->threads($items);

        $payload = [
            'threads' => $threads,
            'preset' => $preset,
            'from' => $from->toDateString(),
            'to' => $to->toDateString(),
            'state' => $state,
            'q' => $term,
            'focusId' => $focus,
            'canCreateLead' => $this->mayAddLeads($user),
            'canViewWorkReport' => $this->access->canViewWorkReport($user),
            'incomingHandoffs' => $this->handoffs->presentIncoming($user),
        ];

        if ($request->header('X-Inertia') || (! $request->expectsJson() && $request->acceptsHtml())) {
            return Inertia::render('Email/Inbox', $payload);
        }

        return response()->json($payload);
    }

    /**
     * @param  array<string, mixed>  $input
     * @return array{0: Carbon, 1: Carbon, 2: int|null}
     */
    private function window(array $input): array
    {
        if (! empty($input['from']) && ! empty($input['to'])) {
            return [
                Carbon::parse($input['from'])->startOfDay(),
                Carbon::parse($input['to'])->endOfDay(),
                null,
            ];
        }

        $days = in_array((int) ($input['preset'] ?? 7), self::PRESETS, true)
            ? (int) ($input['preset'] ?? 7)
            : 7;

        return [now()->subDays($days)->startOfDay(), now()->endOfDay(), $days];
    }

    /**
     * @param  list<array<string, mixed>>  $items
     * @return list<array<string, mixed>>
     */
    private function threads(array $items): array
    {
        $threads = [];

        foreach ($items as $item) {
            $key = is_string($item['conversation_id'] ?? null) ? $item['conversation_id'] : $item['id'];

            if (! isset($threads[$key])) {
                $threads[$key] = [
                    'id' => $key,
                    'subject' => $item['subject'] ?? null,
                    'latest_sent_at' => $item['sent_at'] ?? null,
                    'message_count' => 0,
                    'messages' => [],
                ];
            }

            $threads[$key]['messages'][] = $item;
            $threads[$key]['message_count']++;
        }

        return array_values($threads);
    }

    private function mayAddLeads(User $user): bool
    {
        try {
            return in_array($user->permission('add_lead'), ['all', 'added'], true);
        } catch (Throwable) {
            return false;
        }
    }
}
