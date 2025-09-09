<?php

namespace Modules\Performance\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class CreateKeyResultsRequest extends FormRequest
{

    /**
     * Get the validation rules that apply to the request.
     */
    public function rules(): array
    {
        $id = request()->key_results_id;

        return [
            'objective_id' => 'required|integer|exists:objectives,id',
            'title' => [
                'required',
                'unique:key_results,title,'.$id.',id,company_id,' . company()->id,
            ],
            'metrics_id' => 'required|integer|exists:key_results_metrics,id',
            'target_value' => 'required|numeric',
            'current_value' => 'required|numeric',
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
