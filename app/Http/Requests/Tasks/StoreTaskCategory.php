<?php

namespace App\Http\Requests\Tasks;

use App\Http\Requests\CoreRequest;

class StoreTaskCategory extends CoreRequest
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
        $categoryId = $this->route('taskCategory');

        return [
            // Ignore the current record on update so re-saving the same name
            // (e.g. editing only the action) doesn't trip the unique rule.
            'category_name' => 'required|unique:task_category,category_name,' . ($categoryId ?: 'null') . ',id,company_id,' . company()->id,
            'action' => 'nullable|in:email,call',
        ];
    }

}
