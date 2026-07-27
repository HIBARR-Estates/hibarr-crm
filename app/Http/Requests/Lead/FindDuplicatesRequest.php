<?php

namespace App\Http\Requests\Lead;

use App\Http\Requests\CoreRequest;

class FindDuplicatesRequest extends CoreRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [];
    }
}
