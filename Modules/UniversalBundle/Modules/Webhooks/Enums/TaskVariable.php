<?php

namespace Modules\Webhooks\Enums;

use Modules\Webhooks\Enums\Variable;

enum TaskVariable: string implements Variable
{
    case heading = '##HEADING##';
    case description = '##DESCRIPTION##';
    case priority = '##PRIORITY##';
    case due_on = '##DUE_ON##';
    case create_on = '##CREATE_ON##';

    public function key(): string
    {
        return match ($this) {
            default => $this->name,
        };
    }

    public static function invalidVariables(): array
    {
        return [
            'id',
            'company',
            'company_id',
            'last_updated_by',
            'added_by',
            'created_by',
            'project_id',
            'task_category_id',
            'board_column_id',
        ];
    }

}
