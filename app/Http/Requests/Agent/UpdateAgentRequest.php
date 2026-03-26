<?php

namespace App\Http\Requests\Agent;

use App\Http\Requests\CoreRequest;

class UpdateAgentRequest extends CoreRequest
{

    public function authorize()
    {
        return true;
    }

    public function rules()
    {
        return [
            'status' => 'sometimes|in:enabled,disabled',
            'category_id' => 'nullable|array',
            'category_id.*' => 'integer|exists:lead_category,id',
            'name' => 'sometimes|string|max:255',
            'email' => 'sometimes|nullable|email:rfc,strict|unique:users,email,' . $this->route('agent'),
            'mobile' => 'sometimes|nullable|string|max:50',
        ];
    }

}
