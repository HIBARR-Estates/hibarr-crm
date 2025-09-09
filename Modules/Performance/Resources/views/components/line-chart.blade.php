<div {{ $attributes }}></div>
<script>
function initializeChart() {
    const chartData = @json($chartData) || [];
    const allDates = @json($allDates) || [];
    const colors = @json($colors) || ['#7cd6fd'];

    if (chartData.length === 0 || allDates.length === 0) {
        console.error('Chart data or dates are empty');
        return;
    }

    // Prepare datasets with proper start and end dates
    const datasets = chartData.map(obj => {
        const values = allDates.map(date => {
            // If date is before objective start date, return 0
            if (date < obj.start_date) {
                return 0;
            }

            // Find matching data point
            const point = obj.data.find(item => item.x === date);
            if (point) {
                return point.y;
            }

            // Only interpolate values up to the last check-in date
            if (date <= obj.end_date) {
                // For dates between start and end with no check-in,
                // find the last known value before this date
                const lastKnownPoint = obj.data
                    .filter(item => item.x <= date)
                    .sort((a, b) => b.x.localeCompare(a.x))[0];

                    return lastKnownPoint ? lastKnownPoint.y : 0; // Default to 0 if no last known point
                }

            // For dates after the last check-in, maintain the final value
            const finalPoint = obj.data[obj.data.length - 1];
            return finalPoint ? finalPoint.y : 0;
        });

        return {
            name: obj.name,
            values: values
        };
    });

    frappe.chart = new frappe.Chart("#{{ $attributes['id'] }}", {
        data: {
            labels: allDates,
            datasets: datasets
        },
        type: 'line',
        height: {{ $attributes['height'] }},
        colors: colors, // Use dynamic colors
        // colors: ['#7cd6fd', '#743ee2', '#ff5858', '#ffc107'],
        axisOptions: {
            xIsSeries: true,
        },
        yAxis: {
            title: 'Percentage (%)',
            min: 0,
            max: 100,
        },
        // tooltipOptions: {
        //     formatTooltipX: d => moment(d).format('MMM D, YYYY'),
        //     formatTooltipY: d => d + '%'
        // },
        tooltipOptions: {
            formatTooltipX: d => moment(d).format('MMM D, YYYY'),
            formatTooltipY: d => {
                // Limit objective name length to 20 characters with "..." if longer
                const truncatedName = d.length > 15 ? d.slice(0, 15) + "..." : d;
                return truncatedName + '%';
            }
        },
        lineOptions: {
            hideDots: 0,
            heatline: 0,
        }
    });
}

initializeChart();
</script>
