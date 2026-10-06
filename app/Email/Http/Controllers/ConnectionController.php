<?php

namespace App\Email\Http\Controllers;

use App\Email\Connections\ConnectionManager;
use App\Email\Connections\CredentialRules;
use App\Email\Models\EmailConnection;
use App\Email\Transport\MailTransportFactory;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Validation\ValidationException;

/**
 * The signed-in user's own mailbox connections. A connection belonging to
 * anyone else — another user or another company — is simply not found.
 */
class ConnectionController
{
    public function __construct(
        private readonly ConnectionManager $connections,
        private readonly MailTransportFactory $transports,
    ) {}

    public function index(Request $request): JsonResponse
    {
        $connections = $this->owned($request->user())->orderBy('id')->get();

        return response()->json([
            'connections' => $connections->map(fn (EmailConnection $connection) => $this->present($connection))->all(),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        $attributes = $request->validate([
            'provider' => ['nullable', 'string', 'max:32'],
            'identity_email' => ['required', 'string', 'email', 'max:255'],
            'from_email' => ['nullable', 'string', 'email', 'max:255'],
            'reply_to_email' => ['nullable', 'string', 'email', 'max:255'],
        ]);

        $attributes['provider'] = $attributes['provider'] ?? (string) config('email.default_provider', '');

        // Fail closed: a provider with no adapter in this environment cannot be connected.
        if (! $this->transports->supports($attributes['provider'])) {
            throw ValidationException::withMessages(['provider' => 'provider_unavailable']);
        }

        $credentials = $this->credentials($request, $attributes['provider']);

        $taken = $this->owned($user)
            ->where('identity_email', strtolower(trim($attributes['identity_email'])))
            ->exists();

        if ($taken) {
            throw ValidationException::withMessages(['identity_email' => 'already_connected']);
        }

        $connection = $this->connections->connect($user, $attributes, $credentials);

        return response()->json(['connection' => $this->present($connection)], 201);
    }

    public function stop(Request $request, string $connection): JsonResponse
    {
        return $this->respond($this->connections->stop($this->find($request, $connection)));
    }

    public function resume(Request $request, string $connection): JsonResponse
    {
        return $this->respond($this->connections->resume($this->find($request, $connection)));
    }

    public function reconnect(Request $request, string $connection): JsonResponse
    {
        $found = $this->find($request, $connection);

        if (! $this->transports->supports($found->provider)) {
            throw ValidationException::withMessages(['provider' => 'provider_unavailable']);
        }

        return $this->respond($this->connections->reconnect($found, $this->credentials($request, $found->provider)));
    }

    public function destroy(Request $request, string $connection): Response
    {
        $this->connections->disconnect($this->find($request, $connection));

        return response()->noContent();
    }

    /**
     * Only the fields the provider's rules name are kept, so nothing else a
     * client sends can end up among the stored secrets.
     *
     * @return array<string, mixed>
     */
    private function credentials(Request $request, string $provider): array
    {
        $rules = CredentialRules::for($provider);

        if ($rules === []) {
            return [];
        }

        return array_filter($request->validate($rules), fn ($value) => $value !== null && $value !== '');
    }

    private function find(Request $request, string $uuid): EmailConnection
    {
        return $this->owned($request->user())->where('uuid', $uuid)->firstOrFail();
    }

    /**
     * Scoped by hand to the user and their company rather than leaning on the
     * session-based company scope.
     */
    private function owned(User $user)
    {
        return EmailConnection::withoutGlobalScopes()
            ->where('user_id', $user->id)
            ->where('company_id', $user->company_id);
    }

    private function respond(EmailConnection $connection): JsonResponse
    {
        return response()->json(['connection' => $this->present($connection)]);
    }

    /**
     * The CRM uuid is the only id that leaves the server; credentials never do.
     *
     * @return array<string, mixed>
     */
    private function present(EmailConnection $connection): array
    {
        return [
            'id' => $connection->uuid,
            'provider' => $connection->provider,
            'identity_email' => $connection->identity_email,
            'from_email' => $connection->from_email,
            'reply_to_email' => $connection->reply_to_email,
            'status' => $connection->status->value,
            'sync_stopped_at' => $connection->sync_stopped_at?->toIso8601String(),
            'last_sync_at' => $connection->last_sync_at?->toIso8601String(),
            'last_error_code' => $connection->last_error_code,
        ];
    }
}
