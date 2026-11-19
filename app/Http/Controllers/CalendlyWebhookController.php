<?php

namespace App\Http\Controllers;

use App\Models\CalendlyWebhookSetting;
use App\Services\CalendlyBookingService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Illuminate\Support\Facades\Log;

/**
 * Receives Calendly's booking notifications (public route, no session).
 *
 * Two things authenticate a delivery: the unguessable token in the address,
 * which says which company it is for, and Calendly's signature over the body,
 * made with the key the admin saved in settings. Until that key is saved the
 * address accepts nothing, so setting up a link never starts creating meetings
 * by itself.
 *
 * Extends the bare framework controller, not App's: that one prepares a signed-in
 * page (session, GDPR banner, migration check) a machine caller has none of.
 */
class CalendlyWebhookController extends Controller
{
    /** How old a signed delivery may be, in seconds (Calendly's own guidance). */
    private const SIGNATURE_TOLERANCE = 180;

    public function __invoke(Request $request, string $token, CalendlyBookingService $bookings): JsonResponse
    {
        $setting = CalendlyWebhookSetting::findByToken($token);

        if (! $setting || empty($setting->signing_key)) {
            return response()->json(['status' => 'not_found'], 404);
        }

        if (! self::validSignature((string) $request->header('Calendly-Webhook-Signature'), $request->getContent(), $setting->signing_key)) {
            Log::warning('Calendly webhook rejected: bad signature', ['company_id' => $setting->company_id]);

            return response()->json(['status' => 'unauthorized'], 401);
        }

        $body = json_decode($request->getContent(), true);

        if (! is_array($body)) {
            return response()->json(['status' => 'bad_request'], 400);
        }

        $setting->last_received_at = now();
        $setting->save();

        $outcome = $bookings->handle((int) $setting->company_id, $body);

        return response()->json(['status' => 'ok', 'outcome' => $outcome]);
    }

    /**
     * Header format: `t=<unix time>,v1=<hex hmac-sha256 of "<t>.<raw body>">`.
     */
    public static function validSignature(string $header, string $rawBody, string $key, ?int $now = null): bool
    {
        $timestamp = null;
        $signature = null;

        foreach (explode(',', $header) as $part) {
            [$name, $value] = array_pad(explode('=', trim($part), 2), 2, '');

            if ($name === 't') {
                $timestamp = $value;
            } elseif ($name === 'v1') {
                $signature = $value;
            }
        }

        if ($timestamp === null || $signature === null || ! ctype_digit($timestamp)) {
            return false;
        }

        if (abs(($now ?? time()) - (int) $timestamp) > self::SIGNATURE_TOLERANCE) {
            return false;
        }

        return hash_equals(hash_hmac('sha256', $timestamp.'.'.$rawBody, $key), $signature);
    }
}
