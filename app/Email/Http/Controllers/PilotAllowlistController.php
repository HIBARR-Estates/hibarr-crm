<?php

namespace App\Email\Http\Controllers;

use App\Email\Pilot\PilotAllowlist;
use DomainException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

/**
 * Admin JSON for the company pilot allowlist. Flag + admin middleware sit on the route;
 * the pilot gate is intentionally absent so an admin can seed the list.
 */
class PilotAllowlistController
{
    public function __construct(private readonly PilotAllowlist $allowlist) {}

    public function index(Request $request): JsonResponse
    {
        return response()->json([
            'entries' => $this->allowlist->presentFor($request->user()),
        ]);
    }

    public function candidates(Request $request): JsonResponse
    {
        $input = $request->validate([
            'q' => ['required', 'string', 'min:2', 'max:200'],
        ]);

        return response()->json([
            'items' => $this->allowlist->candidates($request->user(), $input['q']),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $input = $request->validate([
            'scope' => ['required', 'in:user,company'],
            'user_id' => ['required_if:scope,user', 'nullable', 'integer'],
        ]);

        $entry = $input['scope'] === 'company'
            ? $this->allowlist->addCompany($request->user())
            : $this->allowlist->addUser($request->user(), (int) $input['user_id']);

        return response()->json([
            'entries' => $this->allowlist->presentFor($request->user()),
            'entry_id' => $entry->id,
        ], 201);
    }

    public function destroy(Request $request, int $entry): JsonResponse
    {
        try {
            $this->allowlist->remove($request->user(), $entry);
        } catch (DomainException $exception) {
            if ($exception->getMessage() === 'not_found') {
                throw new NotFoundHttpException;
            }

            throw $exception;
        }

        return response()->json([
            'entries' => $this->allowlist->presentFor($request->user()),
        ]);
    }
}
