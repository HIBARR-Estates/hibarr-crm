<?php

namespace Modules\CyberSecurity\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreSecurityRequest extends FormRequest
{

    /**
     * Determine if the user is authorized to make this request.
     *
     * @return bool
     */
    public function authorize()
    {
        return true;
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array
     */
    public function rules()
    {
        return match ($this->page) {
            'single-session' => [
                'unique_session' => 'required|in:1,0',
            ],
            default => $this->defaultRules(),
        };

    }

    private function defaultRules()
    {
        $rules = [
            'max_retries' => 'required|integer',
            'lockout_time' => 'required|integer',
            'max_lockouts' => 'required|integer',
            'extended_lockout_time' => 'required|integer',
            'reset_retries' => 'required|integer',
            'alert_after_lockouts' => 'required|integer',
            // 'user_timeout' => 'required|integer',
            'email' => [
                Rule::requiredIf(function() {
                    return $this->alert_after_lockouts > 0;
                }),
                'nullable',
                'email',
            ]
        ];

        if (isWorksuite()) {
            $rules['ip_check'] = 'required|in:1,0';
            $rules['ip'] = [
                    Rule::requiredIf(function() {
                        return $this->ip_check == 1;
                    }),
                    'nullable',
                    'ip',
                ];
        }

        return $rules;
    }

}
