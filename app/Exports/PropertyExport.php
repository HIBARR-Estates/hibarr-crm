<?php

namespace App\Exports;

use App\Models\Property;
use Carbon\Carbon;
use Maatwebsite\Excel\Concerns\FromCollection;
use Maatwebsite\Excel\Concerns\WithHeadings;
use Maatwebsite\Excel\Concerns\WithMapping;
use Maatwebsite\Excel\Concerns\WithEvents;
use Maatwebsite\Excel\Events\AfterSheet;

class PropertyExport implements FromCollection, WithHeadings, WithMapping, WithEvents
{
    protected $filters;

    public function __construct($filters = [])
    {
        $this->filters = $filters;
    }

    public function collection()
    {
        $query = Property::with('product');

        // Apply filters
        if (!empty($this->filters['property_type'])) {
            $query->where('property_type', $this->filters['property_type']);
        }

        if (!empty($this->filters['sale_type'])) {
            $query->where('sale_type', $this->filters['sale_type']);
        }

        if (!empty($this->filters['status'])) {
            $query->where('status', $this->filters['status']);
        }

        if (!empty($this->filters['city'])) {
            $query->where('city', 'like', '%' . $this->filters['city'] . '%');
        }

        if (!empty($this->filters['min_price'])) {
            $query->where('price', '>=', $this->filters['min_price']);
        }

        if (!empty($this->filters['max_price'])) {
            $query->where('price', '<=', $this->filters['max_price']);
        }

        if (!empty($this->filters['date_from'])) {
            $query->whereDate('created_at', '>=', $this->filters['date_from']);
        }

        if (!empty($this->filters['date_to'])) {
            $query->whereDate('created_at', '<=', $this->filters['date_to']);
        }

        // Apply search if provided
        if (!empty($this->filters['search'])) {
            $search = $this->filters['search'];
            $query->where(function ($q) use ($search) {
                $q->where('title', 'like', '%' . $search . '%')
                  ->orWhere('description', 'like', '%' . $search . '%')
                  ->orWhere('area', 'like', '%' . $search . '%')
                  ->orWhere('city', 'like', '%' . $search . '%');
            });
        }

        return $query->orderBy('created_at', 'desc')->get();
    }

    public function headings(): array
    {
        return [
            'ID',
            'Title',
            'Property Type',
            'Sale Type',
            'Status',
            'Price',
            'City',
            'Area',
            'Land Size',
            'Bedrooms',
            'Bathrooms',
            'Living Room',
            'Floor Number',
            'Floors in Building',
            'Building Age',
            'Furniture Status',
            'Within Site',
            'Title Deed Type',
            'Title Deed Stage',
            'Minimal Rental Period',
            'Rent Payment Interval',
            'Video URL',
            '360 Tour URL',
            'Description',
            'Created At',
            'Updated At',
        ];
    }

    public function map($property): array
    {
        return [
            $property->id,
            $property->title,
            $property->property_type,
            $property->sale_type,
            $property->status,
            $property->price ? number_format($property->price, 2) : '',
            $property->city,
            $property->area,
            $property->land_size ? number_format($property->land_size, 2) : '',
            $property->bedrooms,
            $property->bathrooms,
            $property->living_room,
            $property->floor_number,
            $property->floors_in_building,
            $property->building_age,
            $property->furniture_status,
            $property->within_site ? 'Yes' : 'No',
            $property->title_deed_type,
            $property->title_deed_stage,
            $property->minimal_rental_period,
            $property->rent_payment_interval,
            $property->video_url,
            $property->tour_360_url,
            $property->description,
            $property->created_at ? $property->created_at->format('Y-m-d H:i:s') : '',
            $property->updated_at ? $property->updated_at->format('Y-m-d H:i:s') : '',
        ];
    }

    public function registerEvents(): array
    {
        return [
            AfterSheet::class => function(AfterSheet $event) {
                // Make header row bold
                $event->sheet->getStyle('A1:Z1')->applyFromArray([
                    'font' => [
                        'bold' => true,
                    ],
                ]);

                // Auto-size columns
                foreach (range('A', 'Z') as $column) {
                    $event->sheet->getColumnDimension($column)->setAutoSize(true);
                }
            },
        ];
    }
}