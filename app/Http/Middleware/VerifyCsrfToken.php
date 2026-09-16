<?php

namespace App\Http\Middleware;

use Illuminate\Foundation\Http\Middleware\VerifyCsrfToken as Middleware;

class VerifyCsrfToken extends Middleware
{
    /**
     * The URIs that should be excluded from CSRF verification.
     *
     * @var array
     */
    protected $except = [
        // Payment gateway webhook callbacks (routes/web-public.php). List each
        // route explicitly: a new route must opt out of CSRF on purpose.
        'flutterwave-webhook/*',
        'mollie-webhook/*',
        'payfast-webhook/*',
        'paypal-webhook/*',
        'paystack-webhook/*',
        'razorpay-webhook/*',
        'square-webhook/*',
        'verify-webhook/*', // Stripe
        // Public lead and ticket forms
        'lead-form/leadStore',
        'lead-form/ticket-store',
    ];
}
