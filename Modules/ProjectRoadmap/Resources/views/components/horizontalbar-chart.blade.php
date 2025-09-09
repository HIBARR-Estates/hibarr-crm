<div class="m-auto" style="height: {{ $attributes['height'] }}px; width: {{ $attributes['width'] }}px">
    <canvas {{ $attributes }}></canvas>
</div>
<script>
    var data = {
        labels: [
            $chartData['name'],
        ],
        datasets: [
            foreach($chartData['datasets'] as $dataset)
            {
                label: $dataset['label'],
                values: $dataset['data'],
                backgroundColor: $dataset['backgroundColor'],
            }
        ]
    };
</script>
<script>
    var options = {
        title: {
        display: true,
        text: 'Sales team Activity'
        },
        legend: {
        position: 'bottom'
        },
        scales: {
        xAxes: [{
            display: false,
            stacked: true
        }],
        yAxes: [{
            stacked: true,
            gridLines: {
            display: false
            }
        }]
        },
        elements: {
            rectangle: {
            borderWidth: 0
            }
        }
    }
</script>

<script>
    var ctx = document.getElementById("{{ $attributes['id'] }}");

    var myBarChart = new Chart(ctx, {
        type: 'bar',
        data: data,
        options: options
    });
</script>
