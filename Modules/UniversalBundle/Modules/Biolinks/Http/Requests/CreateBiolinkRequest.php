<?php

namespace Modules\Biolinks\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class CreateBiolinkRequest extends FormRequest
{

    /**
     * Get the validation rules that apply to the request.
     */
    public function rules(): array
    {
        return [
            'page_link' => 'required|alpha_dash|max:255|unique:biolinks,page_link,' . $this->route('biolink') . ',id',
        ];
    }

    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        return true;
    }

}
