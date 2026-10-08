<?php

namespace App\Email\Http\Controllers;

use App\Email\Enums\HandoffType;
use App\Email\Review\Handoffs;
use App\Email\Review\ReviewQueue;
use App\Models\User;
use DomainException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Explicit handoff / escalate of the signed-in user's own review copies, and
 * accept / reject for the named recipient. Never changes lead_owner.
 */
class HandoffController
{
    public function __construct(
        private readonly Handoffs $handoffs,
        private readonly ReviewQueue $queue,
    ) {}

    public function incoming(Request $request): JsonResponse
    {
        return response()->json([
            'items' => $this->handoffs->presentIncoming($request->user()),
        ]);
    }

    public function colleagues(Request $request): JsonResponse
    {
        $term = $request->validate(['q' => ['required', 'string', 'min:1', 'max:100']])['q'];

        return response()->json([
            'items' => $this->handoffs->colleagues($request->user(), $term),
        ]);
    }

    public function handoff(Request $request, string $copy): JsonResponse
    {
        return $this->request($request, $copy, HandoffType::Handoff);
    }

    public function escalate(Request $request, string $copy): JsonResponse
    {
        return $this->request($request, $copy, HandoffType::Escalate);
    }

    public function accept(Request $request, string $handoff): JsonResponse
    {
        $found = $this->handoffs->findOwnedPending($request->user(), $handoff);
        abort_if($found === null, 404);

        try {
            $resolved = $this->handoffs->accept($request->user(), $found);
        } catch (DomainException $exception) {
            return $this->domainError($exception);
        }

        return response()->json(['handoff' => $this->present($resolved)]);
    }

    public function reject(Request $request, string $handoff): JsonResponse
    {
        $found = $this->handoffs->findOwnedPending($request->user(), $handoff);
        abort_if($found === null, 404);

        try {
            $resolved = $this->handoffs->reject($request->user(), $found);
        } catch (DomainException $exception) {
            return $this->domainError($exception);
        }

        return response()->json(['handoff' => $this->present($resolved)]);
    }

    private function request(Request $request, string $copy, HandoffType $type): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        $found = $this->queue->owned($user)->where('uuid', $copy)->firstOrFail();

        $input = $request->validate([
            'to_user_id' => ['required', 'integer', 'min:1'],
            'note' => ['nullable', 'string', 'max:500'],
        ]);

        $to = User::withoutGlobalScopes()
            ->where('company_id', $user->company_id)
            ->whereKey((int) $input['to_user_id'])
            ->first();

        abort_if($to === null, 404);

        try {
            $handoff = $this->handoffs->request($user, $found, $to, $type, $input['note'] ?? null);
        } catch (DomainException $exception) {
            return $this->domainError($exception);
        }

        return response()->json([
            'handoff' => $this->present($handoff),
            'copy' => [
                'id' => $found->fresh()->uuid,
                'review_status' => $found->fresh()->review_status->value,
                'handoff' => $this->handoffs->presentForCopy($user, $found->fresh()),
            ],
        ], 201);
    }

    /**
     * @return array<string, mixed>
     */
    private function present(\App\Email\Models\EmailHandoff $handoff): array
    {
        return [
            'id' => $handoff->uuid,
            'type' => $handoff->type->value,
            'status' => $handoff->status->value,
            'note' => $handoff->note,
            'from_user_id' => $handoff->from_user_id,
            'to_user_id' => $handoff->to_user_id,
            'resolved_at' => $handoff->resolved_at?->toIso8601String(),
        ];
    }

    private function domainError(DomainException $exception): JsonResponse
    {
        $message = $exception->getMessage();

        $status = match ($message) {
            'not_owner', 'not_recipient' => 404,
            'recipient_cannot_accept' => 403,
            default => 409,
        };

        return response()->json(['message' => $message], $status);
    }
}
