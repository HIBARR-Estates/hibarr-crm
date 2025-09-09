<?php

namespace Modules\Payroll\Exports;

use Carbon\Carbon;
use Maatwebsite\Excel\Concerns\FromCollection;
use Maatwebsite\Excel\Concerns\WithHeadings;
use Maatwebsite\Excel\Concerns\WithColumnFormatting;
use Maatwebsite\Excel\Concerns\WithEvents;
use Maatwebsite\Excel\Concerns\ShouldAutoSize;
use Maatwebsite\Excel\Events\AfterSheet;
use Modules\Payroll\Entities\SalarySlip;
use PhpOffice\PhpSpreadsheet\Style\NumberFormat;
use PhpOffice\PhpSpreadsheet\Cell\Coordinate;

class SalaryCumulativeReport implements FromCollection, WithHeadings, WithColumnFormatting, WithEvents, ShouldAutoSize
{
    private $startDate;
    private $endDate;
    private $departmentId;
    private $designationId;
    private $columns = [];

    public function __construct($startDate, $endDate, $departmentId, $designationId)
    {
        $this->startDate = $startDate;
        $this->endDate = $endDate;
        $this->departmentId = $departmentId;
        $this->designationId = $designationId;
        $this->columns = 0;
    }

    public function collection()
    {
        $department = $this->departmentId;
        $designation = $this->designationId;

        $start = Carbon::createFromFormat('m-Y', $this->startDate);
        $end = Carbon::createFromFormat('m-Y', $this->endDate);

        $query = SalarySlip::select([
                'salary_slips.id',
                'salary_slips.salary_json',
                'salary_slips.basic_salary',
                'salary_slips.gross_salary',
                'salary_slips.extra_json',
                'salary_slips.company_id',
                'salary_slips.month',
                'salary_slips.year',
                'salary_slips.net_salary',
                'salary_slips.salary_from as pay_date',
                'salary_slips.status',
                'salary_slips.user_id as employee_id',
                'salary_slips.user_id',
                'users.id as emp_employee_id',
                'employee_details.employee_id as empid',
                'teams.team_name as department_name',
                'designations.name as designation_name',
                'salary_slips.expense_claims',
                'salary_groups.group_name as salary_group_name',
                'salary_groups.id as salary_group_id',
            ])
            ->with(['user', 'salary_group', 'user.employeeDetails'])
            ->join('users', 'users.id', '=', 'salary_slips.user_id')
            ->join('employee_details', 'users.id', '=', 'employee_details.user_id')
            ->leftJoin('salary_groups', 'salary_groups.id', '=', 'salary_slips.salary_group_id')
            ->leftJoin('designations', 'designations.id', '=', 'employee_details.designation_id')
            ->leftJoin('teams', 'teams.id', '=', 'employee_details.department_id');

        if ($department !== null && $department !== 'all') {
            $query->where('employee_details.department_id', $department);
        }

        if ($designation !== null && $designation !== 'all') {
            $query->where('employee_details.designation_id', $designation);
        }

        $query->whereRaw('(`salary_slips`.`year` * 100 + `salary_slips`.`month`) >= ' . ($start->year * 100 + $start->month));
        $query->whereRaw('(`salary_slips`.`year` * 100 + `salary_slips`.`month`) <= ' . ($end->year * 100 + $end->month));

        $query->where('salary_slips.status', 'paid');

        $query->orderBy('users.name', 'asc');
        $query->orderByRaw('(`salary_slips`.`year` * 100 + `salary_slips`.`month`) ASC');

        $results = $query->get();

        $columns = ['Month', 'Employee ID', 'Employee Name', 'Department', 'Designation', 'Salary Group', 'Basic Salary'];

        $heads = $this->getDynamicHeadings($results);

        foreach($heads[0] as $hd)
        {
            $columns[] = $hd;
        }

        $columns[] = 'Expense Claim';
        $columns[] = 'Extra Earnings';
        $columns[] = 'Extra Deductions';
        $columns[] = 'Total Earnings';
        $columns[] = 'Total Deductions';
        $columns[] = 'Special Allowance';
        $columns[] = 'Net Salary';

        $headsArray = $heads[0];

        $rows = [
            [''],
            $columns,
        ];

        $processedData = [];

        foreach ($results as $result) {
            $salaryJson = json_decode($result->salary_json, true);
            $basicSalary = $result->basic_salary;

            $totalEarnings = 0;
            $totalEarnings += $basicSalary;
            $totalEarnings += $result->expense_claim;
            $totalDeductions = 0;

            if (!isset($row[$result->emp_employee_id])) {
                $row[$result->emp_employee_id] = [
                    $start->format('F Y') . ' - ' . $end->format('F Y'),
                    $result->empid, // Employee Id
                    ($result->user->name),
                    ($result->department_name) ? $result->department_name : '-',
                    ($result->designation_name) ? $result->designation_name : '-',
                    $result->salary_group_name,
                ];

            }

            $row[$result->emp_employee_id]['basic_salary'] = isset($row[$result->emp_employee_id]['basic_salary']) ? round($basicSalary + $basicSalary * 1, 2) : round($basicSalary * 1, 2);

             // Process salary JSON
            foreach ($headsArray as $head) {

                if(!isset($row[$result->emp_employee_id][$head]))
                {
                    $row[$result->emp_employee_id][$head] = 0;
                }

                if (isset($salaryJson['earnings'][$head])) {
                    $totalEarnings += $salaryJson['earnings'][$head];
                    $row[$result->emp_employee_id][$head] = isset($row[$result->emp_employee_id][$head]) ? round($row[$result->emp_employee_id][$head] + $salaryJson['earnings'][$head], 2) : round($salaryJson['earnings'][$head], 2);
                }
                elseif (isset($salaryJson['deductions'][$head])) {
                    $totalDeductions += $salaryJson['deductions'][$head];
                    $row[$result->emp_employee_id][$head] = isset($row[$result->emp_employee_id][$head]) ? round($row[$result->emp_employee_id][$head] + $salaryJson['deductions'][$head], 2) : round($salaryJson['earnings'][$head], 2);
                }

            }

            // Process extra earnings and deductions
            $extraEarning = isset($result->extra_json['earnings']) ? array_sum($result->extra_json['earnings']) : 0;
            $extraDeduction = isset($result->extra_json['deductions']) ? array_sum($result->extra_json['deductions']) : 0;

            if (isset($result->extra_json)) {
                if (isset($result->extra_json['earnings'])) {
                    foreach ($result->extra_json['earnings'] as $key => $value) {
                        $extraEarning += $value;
                    }
                }

                if (isset($result->extra_json['deductions'])) {
                    foreach ($result->extra_json['deductions'] as $key => $value) {
                        $extraDeduction += $value;
                    }
                }
            }

            $fixedAllowance = ($result->fixed_allowance == 0 || $result->fixed_allowance < 0) ? $result->gross_salary - (round($totalEarnings + $extraEarning, 2)) : $result->fixed_allowance;
            $fixedAllowance = ($fixedAllowance == 0 || $fixedAllowance < 0) ? 0 : $fixedAllowance;

            $row[$result->emp_employee_id]['expense_claim'] = isset($row[$result->emp_employee_id]['expense_claim']) ? round($row[$result->emp_employee_id]['expense_claim'] + $result->expense_claim * 1, 2) : $result->expense_claim * 1;
            $row[$result->emp_employee_id]['extra_earning'] = isset($row[$result->emp_employee_id]['extra_earning']) ? round($row[$result->emp_employee_id]['extra_earning'] + $extraEarning, 2) : $extraEarning;
            $row[$result->emp_employee_id]['extra_deduction'] = isset($row[$result->emp_employee_id]['extra_deduction']) ? round($row[$result->emp_employee_id]['extra_deduction'] + $extraDeduction, 2) : $extraDeduction;
            $row[$result->emp_employee_id]['total_earning'] = isset($row[$result->emp_employee_id]['total_earning']) ? round($row[$result->emp_employee_id]['total_earning'] + $totalEarnings + $extraEarning, 2) : $totalEarnings + $extraEarning;
            $row[$result->emp_employee_id]['total_deduction'] = isset($row[$result->emp_employee_id]['total_deduction']) ? round($row[$result->emp_employee_id]['total_deduction'] + $totalDeductions + $extraDeduction, 2) : $totalDeductions + $extraDeduction;
            $row[$result->emp_employee_id]['special_allowance'] = isset($row[$result->emp_employee_id]['special_allowance']) ? round($row[$result->emp_employee_id]['special_allowance'] + $fixedAllowance, 2) : $fixedAllowance;
            $row[$result->emp_employee_id]['net_salary'] = isset($row[$result->emp_employee_id]['net_salary']) ? round($row[$result->emp_employee_id]['net_salary'] + $result->net_salary, 2) : $result->net_salary;

            $processedData = $row;
        }

        $this->columns = count($columns);

        foreach ($processedData as $key => $rowData) {
            $rows[] = $rowData;
        }

        return collect($rows);

    }

    public function getDynamicHeadings($salarySlips)
    {
        $dynamicHeading = [];
        $earnings = [];
        $deductions = [];

        foreach($salarySlips as $salary){
            $headings = json_decode($salary->salary_json);

            if(isset($headings->earnings)){
                $earnings = array_keys((array)$headings->earnings);
                $dynamicHeading = array_merge($dynamicHeading, $earnings);
            }

            if(isset($headings->deductions)){
                $deductions = array_keys((array)$headings->deductions);
                $dynamicHeading = array_merge($dynamicHeading, $deductions);
            }

            $dynamicHeading = array_unique($dynamicHeading);
        }

        return [$dynamicHeading, $earnings, $deductions];
    }

    public function headings(): array
    {
        $startMonth = Carbon::createFromFormat('m-Y', $this->startDate);
        $endMonth = Carbon::createFromFormat('m-Y', $this->endDate);

        return [
            [company()->company_name . ' - '.__('payroll::modules.payroll.salaryReport')],
            [],
            ['Start:', $startMonth->format('F Y'), '', 'End:', $endMonth->format('F Y'), '', 'Generated On:', Carbon::now()->timezone(company()->timezone)->format('jS F, Y, g:i a')],
        ];
    }

    public function columnFormats(): array
    {
        return [
            'A' => NumberFormat::FORMAT_TEXT,
            'B' => NumberFormat::FORMAT_TEXT,
            'C' => NumberFormat::FORMAT_TEXT,
            'D' => NumberFormat::FORMAT_TEXT,
            'E' => NumberFormat::FORMAT_TEXT,
            'F' => NumberFormat::FORMAT_TEXT
        ];
    }

    public function registerEvents(): array
    {
        return [
            AfterSheet::class => function (AfterSheet $event) {


                $sheet = $event->sheet->getDelegate();
                $sheet->mergeCells('A1:C1');
                $sheet->getStyle('A1:G1')
                    ->getFont()
                    ->setSize(16)
                    ->setBold(true);

                $sheet->getStyle('A3')->getFont()->setBold(true);
                $sheet->getStyle('D3')->getFont()->setBold(true);
                $sheet->getStyle('G3')->getFont()->setBold(true);
                $sheet->getStyle('A5:' . $sheet->getHighestColumn() . '5')->getFont()->setBold(true);

                $sheet->getStyle('A5:' . $sheet->getHighestColumn() . '5')
                    ->getFill()
                    ->setFillType(\PhpOffice\PhpSpreadsheet\Style\Fill::FILL_SOLID)
                    ->getStartColor()
                    ->setARGB('00d8ff');


                // total rows of the sheet
                $totalRow = $sheet->getHighestRow();

                // Set the label 'Totals:'
                $sheet->setCellValue('F' . ($totalRow + 1), 'Totals:');
                $sheet->getStyle('F' . ($totalRow + 1))->getFont()->setSize(12)->setBold(true);

                // Getting total og the columns
                for ($i = 7; $i <= $this->columns; $i++) {
                    $col = Coordinate::stringFromColumnIndex($i);
                    $sheet->setCellValue($col . ($totalRow + 1), '=SUM(' . $col . '6:' . $col . $totalRow . ')');
                    $sheet->getStyle($col . ($totalRow + 1))->getFont()->setSize(12)->setBold(true);
                }

            }
        ];
    }

    public function properties(): array
    {
        return [
            'creator' => user()->name,
            'lastModifiedBy' => user()->name,
            'title' => company()->company_name,
            'description' => 'Payroll',
            'company' => user()->name,
        ];
    }

}
