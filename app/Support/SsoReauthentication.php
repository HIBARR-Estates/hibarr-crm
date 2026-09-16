<?php

namespace App\Support;

use App\Models\Social;
use App\Models\SocialAuthSetting;
use App\Models\User;

/**
 * Helpers for re-authenticating an already logged-in user through the social
 * provider they sign in with, so that users without a local password they know
 * (SSO-only accounts) can still confirm their identity.
 */
class SsoReauthentication
{

    /**
     * Providers the social callback still accepts, see LoginController::callback.
     */
    private const SUPPORTED_PROVIDERS = ['keycloak'];

    /**
     * The provider this user can re-authenticate with, or null when they have
     * never signed in socially or that provider has since been disabled.
     */
    public static function providerFor(?User $user): ?string
    {
        if (is_null($user)) {
            return null;
        }

        $social = Social::where('user_id', $user->id)->first();

        if (is_null($social) || is_null($social->social_service)) {
            return null;
        }

        if (!in_array($social->social_service, self::SUPPORTED_PROVIDERS, true)) {
            return null;
        }

        return self::enabled($social->social_service) ? $social->social_service : null;
    }

    /**
     * Whether the provider is switched on in the social login settings.
     */
    public static function enabled(string $provider): bool
    {
        $settings = SocialAuthSetting::first();
        $column = $provider . '_status';

        if (is_null($settings) || !isset($settings->$column)) {
            return false;
        }

        return $settings->$column === 'enable';
    }

    /**
     * Does the identity returned by the provider belong to this user?
     */
    public static function identityMatches(?User $user, string $provider, $socialId): bool
    {
        if (is_null($user) || is_null($socialId)) {
            return false;
        }

        $social = Social::where('user_id', $user->id)->first();

        if (is_null($social) || $social->social_service !== $provider) {
            return false;
        }

        return hash_equals((string)$social->social_id, (string)$socialId);
    }

    public static function label(string $provider): string
    {
        return ucfirst(str_replace(['-', '_'], ' ', $provider));
    }

}
