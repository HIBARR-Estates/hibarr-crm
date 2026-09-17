<?php

namespace App\Http\Requests\Admin\SocialAuth;

use App\Http\Requests\CoreRequest;

class UpdateRequest extends CoreRequest
{

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array
     */
    public function rules()
    {
        return [
            'google_client_id' => 'required_if:google_status,enable|max:100',
            'google_secret_id' => 'required_if:google_status,enable|max:100',
            'facebook_client_id' => 'required_if:facebook_status,enable|max:100',
            'facebook_secret_id' => 'required_if:facebook_status,enable|max:100',
            'twitter_client_id' => 'required_if:twitter_status,enable|max:100',
            'twitter_secret_id' => 'required_if:twitter_status,enable|max:100',
            'linkedin_client_id' => 'required_if:linkedin_status,enable|max:100',
            'linkedin_secret_id' => 'required_if:linkedin_status,enable|max:100',
            // Keycloak's status checkbox is disabled client-side (always enabled),
            // so it's never actually submitted — gate on the tab instead.
            'keycloak_client_id' => 'required_if:tab,keycloak|max:255',
            'keycloak_secret_id' => 'required_if:tab,keycloak|max:255',
            // Authorization codes and client credentials travel to this host, so
            // plain HTTP is only allowed for a Keycloak running on this machine.
            'keycloak_base_url' => ['required_if:tab,keycloak', 'url', 'max:255', $this->httpsUnlessLocal()],
            'keycloak_realm' => 'required_if:tab,keycloak|max:100',
        ];
    }


    /**
     * Keycloak must be reached over HTTPS, except on localhost where a dev
     * realm typically runs on plain HTTP.
     */
    private function httpsUnlessLocal(): callable
    {
        return function (string $attribute, $value, callable $fail) {
            if (blank($value) || str_starts_with(strtolower((string) $value), 'https://')) {
                return;
            }

            if (in_array(parse_url((string) $value, PHP_URL_HOST), ['localhost', '127.0.0.1', '::1'], true)) {
                return;
            }

            $fail(__('messages.keycloakHttpsRequired'));
        };
    }

}
