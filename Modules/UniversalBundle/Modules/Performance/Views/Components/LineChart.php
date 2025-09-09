<?php

namespace Modules\Performance\Views\Components;

use Illuminate\View\Component;

class LineChart extends Component
{

    public $chartData;
    public $allDates;
    public $colors;

    /**
     * Create a new component instance.
     *
     * @return void
     */
    public function __construct($chartData, $allDates, $colors)
    {
        $this->chartData = $chartData;
        $this->allDates = $allDates;
        $this->colors = $colors;
    }

    /**
     * Get the view / contents that represent the component.
     *
     * @return \Illuminate\Contracts\View\View|string
     */
    public function render()
    {
        return view('performance::components.line-chart');
    }

}
