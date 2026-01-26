<?php

namespace App\Http\Requests\CustomField;

use App\Models\CustomField;
use App\Http\Requests\CoreRequest;
use Google\Service\BinaryAuthorization\Check;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Validator;

class StoreCustomField extends CoreRequest
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
        Validator::extend('not_custom_fields', function($attribute, $value, $parameters, $validator) {
            $userColumns = Schema::getColumnListing('users');
            $customModules = CustomField::where('custom_field_group_id', $this->module)->pluck('label')->toArray();

            if((!in_array($this->get('label'), $userColumns) || $this->get('label') == '') && !in_array($this->label, $customModules)){
                return true;
            }

            return false;
        });

        $rules = [
            'label'     => 'required|not_custom_fields',
            'required'  => 'required',
            'type'      => 'required'
        ];

        if (in_array($this->type, ['select', 'radio', 'checkbox'])) {
            $rules['value.*'] = 'required';
        }

        if ($this->type === 'repeatable') {
            $rules['linked_field_id'] = 'required|exists:custom_fields,id';
            $rules['value'] = 'required|array';
            $rules['value.*.key'] = 'required|string';
            $rules['value.*.type'] = 'required|string|in:text,number,password,textarea,select,radio,date,checkbox,country,currency,phone,file';
            $rules['value.*.label'] = 'required|string';
        }

        return $rules;
    }

    public function attributes()
    {
        return [
            'value.*' => __('app.value'),
        ];
    }

}
