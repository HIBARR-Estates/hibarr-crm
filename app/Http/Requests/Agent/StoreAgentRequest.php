<?php

namespace App\Http\Requests\Agent;

use App\Http\Requests\CoreRequest;

class StoreAgentRequest extends CoreRequest
{

    public function authorize()
    {
        return true;
    }

    public function rules()
    {
        $rules = [
            'category_id' => 'nullable|array',
            'category_id.*' => 'integer|exists:lead_category,id',
        ];

        if ($this->input('agent_type') === 'existing') {
            $rules['user_id'] = 'required|integer|exists:users,id';
        } else {
            $rules['name'] = 'required|string|max:255';
            $rules['email'] = 'nullable|email:rfc,strict|unique:users,email';
            $rules['mobile'] = 'nullable|string|max:50';
        }

        return $rules;
    }

    public function messages()
    {
        return [
            'user_id.required' => __('messages.selectEmployee'),
            'name.required' => __('messages.fieldRequired', ['field' => __('app.name')]),
            'email.unique' => __('messages.duplicateEntryForEmail'),
        ];
    }

}
