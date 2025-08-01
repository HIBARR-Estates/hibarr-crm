<?php
namespace App\View\Components\Forms;

use Illuminate\Contracts\View\View;
use Illuminate\View\Component;

class Country extends Component
{
    public $fieldLabel;
    public $fieldRequired;
    public $fieldPlaceholder;
    public $fieldValue;
    public $fieldName;
    public $fieldId;

    public function __construct($fieldLabel, $fieldPlaceholder, $fieldName, $fieldId, $fieldRequired = false, $fieldValue = null)
    {
        $this->fieldLabel = $fieldLabel;
        $this->fieldRequired = $fieldRequired;
        $this->fieldPlaceholder = $fieldPlaceholder;
        $this->fieldValue = $fieldValue;
        $this->fieldName = $fieldName;
        $this->fieldId = $fieldId;
    }

    public function render()
    {
        return view('components.forms.country');
    }
}