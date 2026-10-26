<?php

namespace App\Email\Http\Controllers;

use App\Email\Adapters\Zoho\ZohoMailAdapter;
use App\Email\Adapters\Zoho\ZohoMailClient;
use App\Email\Adapters\Zoho\ZohoOAuth;
use App\Email\Connections\ConnectionManager;
use App\Email\Exceptions\MailTransportException;
use App\Email\Models\EmailConnection;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\Response;

/**
 * Browser OAuth for a user's own Zoho mailbox. The authorization code is
 * exchanged here and the refresh token is stored on that user's connection.
 */
class ZohoOAuthController
{
    public function __construct(
        private readonly ZohoOAuth $oauth,
        private readonly ZohoMailClient $mail,
        private readonly ConnectionManager $connections,
    ) {}

    public function redirect(Request $request): RedirectResponse|JsonResponse
    {
        try {
            $this->oauth->assertConfigured();
            $state = Str::random(40);
            $returnTo = $this->returnTo($request);

            $request->session()->put('email.zoho.oauth', [
                'state' => $state,
                'return_to' => $returnTo,
            ]);

            return redirect()->away($this->oauth->authorizationUrl($state));
        } catch (MailTransportException $exception) {
            return $this->fail($request, $exception->errorCode, '/');
        }
    }

    public function callback(Request $request): RedirectResponse|JsonResponse
    {
        $pending = $request->session()->pull('email.zoho.oauth');
        $returnTo = is_array($pending) ? (string) ($pending['return_to'] ?? '/') : '/';
        $expected = is_array($pending) ? (string) ($pending['state'] ?? '') : '';
        $given = (string) $request->query('state', '');

        if ($expected === '' || ! hash_equals($expected, $given)) {
            return $this->fail($request, 'oauth_state', $returnTo);
        }

        if ($request->filled('error') || ! is_string($request->query('code')) || $request->query('code') === '') {
            return $this->fail($request, 'oauth_denied', $returnTo);
        }

        try {
            $token = $this->oauth->exchange((string) $request->query('code'));
            $mailbox = $this->mail->mailboxes($token->accessToken)[0] ?? null;
        } catch (MailTransportException $exception) {
            return $this->fail($request, $exception->errorCode, $returnTo);
        }

        if ($mailbox === null) {
            return $this->fail($request, 'mailbox_not_found', $returnTo);
        }

        /** @var User $user */
        $user = $request->user();

        $existing = EmailConnection::withoutGlobalScopes()
            ->where('user_id', $user->id)
            ->where('company_id', $user->company_id)
            ->where('identity_email', $mailbox['email'])
            ->first();

        if ($existing !== null && $existing->provider !== ZohoMailAdapter::PROVIDER) {
            return $this->fail($request, 'already_connected', $returnTo);
        }

        $credentials = [
            'refresh_token' => $token->refreshToken,
            'access_token' => $token->accessToken,
            'expires_at' => time() + $token->expiresIn,
            'account_id' => $mailbox['account_id'],
        ];

        $connection = $existing !== null
            ? $this->connections->reconnect($existing, $credentials)
            : $this->connections->connect($user, [
                'provider' => ZohoMailAdapter::PROVIDER,
                'identity_email' => $mailbox['email'],
                'from_email' => $mailbox['email'],
            ], $credentials);

        if ($request->expectsJson()) {
            return response()->json(['connection' => $this->present($connection)], $existing !== null ? 200 : 201);
        }

        return redirect()->to($this->withQuery($returnTo, 'email_connected', '1'));
    }

    private function returnTo(Request $request): string
    {
        $return = (string) $request->query('return', '/');

        if (! str_starts_with($return, '/') || str_starts_with($return, '//')) {
            return '/';
        }

        return $return;
    }

    private function fail(Request $request, string $code, string $returnTo): RedirectResponse|JsonResponse
    {
        if ($request->expectsJson()) {
            return response()->json(['message' => $code], Response::HTTP_UNPROCESSABLE_ENTITY);
        }

        return redirect()->to($this->withQuery($returnTo, 'email_connect_error', $code));
    }

    private function withQuery(string $path, string $key, string $value): string
    {
        $separator = str_contains($path, '?') ? '&' : '?';

        return $path.$separator.rawurlencode($key).'='.rawurlencode($value);
    }

    /**
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
            'last_error_code' => $connection->last_error_code,
        ];
    }
}
