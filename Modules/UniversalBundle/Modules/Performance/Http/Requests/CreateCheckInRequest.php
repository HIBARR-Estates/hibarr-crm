<?php

namespace Modules\Performance\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Modules\Performance\Entities\KeyResults;

class CreateCheckInRequest extends FormRequest
{

    protected $originalCurrentValue;
    protected $originalTargetValue;

    /**
     * Get the validation rules that apply to the request.
     */
    public function rules(): array
    {
        $keyResult = KeyResults::where('id', request()->key_result_id)->first();
        $this->originalCurrentValue = $keyResult->current_value;
        $this->originalTargetValue = $keyResult->target_value;

        return [
            'key_result_id' => 'required|exists:key_results,id',
            'current_value' => 'required|numeric',
            'confidence_level' => 'required|in:low,medium,high',
            'check_in_date' => 'required|date_format:"' . company()->date_format . '"',
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
