<?php

namespace Modules\ProjectRoadmap\Views\Components;

use Illuminate\View\Component;

class PolarareaChart extends Component
{
    /**
     * Create a new component instance.
     *
     * @return void
     */
    public function __construct()
    {
        //
    }

    /**
     * Get the view / contents that represent the component.
     *
     * @return \Illuminate\View\View|string
     */
    public function render()
    {
        return view('projectroadmap::components.polararea-chart');
    }
}
