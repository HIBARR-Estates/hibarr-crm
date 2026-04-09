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
            'keycloak_client_id' => 'required_if:keycloak_status,enable|max:255',
            'keycloak_secret_id' => 'required_if:keycloak_status,enable|max:255',
            'keycloak_base_url' => 'required_if:keycloak_status,enable|url|max:255',
            'keycloak_realm' => 'required_if:keycloak_status,enable|max:100',
        ];
    }

}
