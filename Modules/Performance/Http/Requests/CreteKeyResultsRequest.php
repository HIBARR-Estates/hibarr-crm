<?php

namespace Modules\Performance\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class CreteKeyResultsRequest extends FormRequest
{

    /**
     * Get the validation rules that apply to the request.
     */
    public function rules(): array
    {
        $id = request()->id;

        return [
            'name' => [
                'required',
                'unique:key_results_metrics,name,'.$id.',id,company_id,' . company()->id,
            ],
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
