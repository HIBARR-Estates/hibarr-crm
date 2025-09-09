<?php

namespace Modules\ProjectRoadmap\Views\Components;

use Illuminate\View\Component;

class HorizontalBarChart extends Component
{
    public $chartData;

    /**
     * Create a new component instance.
     *
     * @return void
     */
    public function __construct($chartData)
    {

        $this->chartData = $chartData;
    }

    /**
     * Get the view / contents that represent the component.
     *
     * @return \Illuminate\View\View|string
     */
    public function render()
    {
        return view('projectroadmap::components.horizontalbar-chart');
    }
}
