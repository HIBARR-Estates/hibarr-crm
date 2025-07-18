<?php

namespace App\Http\Requests\CustomField;

use App\Models\CustomField;
use App\Http\Requests\CoreRequest;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Validator;

class UpdateCustomField extends CoreRequest
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
     * Returns the validation rules for updating a custom field, including a custom rule to ensure the label does not conflict with user table columns or existing custom field labels in the same module.
     *
     * @return array The array of validation rules for the request.
     */
    public function rules()
    {
        Validator::extend('not_custom_fields', function($attribute, $value, $parameters, $validator) {
            $userColumns = Schema::getColumnListing('users');
            $customModules = CustomField::where('custom_field_group_id', $this->module)->whereNotIn('id', [$this->id])->pluck('label')->toArray();

            if((!in_array($this->get('label'), $userColumns) || $this->get('label') == '') && !in_array($this->label, $customModules)){
                return true;
            }

            return false;
        });
        return [
            'label'     => 'required|not_custom_fields',
            'required'  => 'required',
            'category' => 'required|exists:custom_field_categories,id',
        ];
    }

}
