<?php

namespace Modules\Performance\Exports;

use App\Models\EmployeeDetails;
use Carbon\Carbon;
use Maatwebsite\Excel\Concerns\FromCollection;
use Maatwebsite\Excel\Concerns\WithHeadings;
use Maatwebsite\Excel\Concerns\WithStyles;
use Maatwebsite\Excel\Concerns\WithMapping;
use Maatwebsite\Excel\Concerns\WithCustomStartCell;
use Modules\Performance\Entities\GoalType;
use PhpOffice\PhpSpreadsheet\Worksheet\Worksheet;
use Modules\Performance\Entities\Objective;

class ObjectiveMonthlyReport implements FromCollection, WithHeadings, WithStyles, WithMapping, WithCustomStartCell
{
    protected $startDate;
    protected $endDate;

    public function __construct($startDate, $endDate)
    {
        $this->startDate = Carbon::parse($startDate);
        $this->endDate = Carbon::parse($endDate);

        $this->calculateWeekRanges();
    }

    /**
     * Calculate week ranges between start and end date
     */
    protected function calculateWeekRanges()
    {
        $currentDate = $this->startDate->copy();
        $weekNumber = 1;

        while ($currentDate <= $this->endDate) {
            $weekEndDate = $currentDate->copy()->addDays(6);

            // Adjust last week to not exceed end date
            if ($weekEndDate > $this->endDate) {
                $weekEndDate = $this->endDate->copy();
            }

            $this->weekRanges[$weekNumber] = [
                'start' => $currentDate->copy()->startOfDay(),
                'end' => $weekEndDate->copy()->endOfDay(),
                'label' => sprintf(
                    '%s %02d - %s %02d',
                    $currentDate->format('M'),
                    $currentDate->day,
                    $weekEndDate->format('M'),
                    $weekEndDate->day
                )
            ];

            $currentDate = $weekEndDate->copy()->addDay();
            $weekNumber++;
        }

        return $this->weekRanges;
    }

    public function collection()
    {
        // Fetch objectives with their key results and check-ins within the date range
        $objectives = $this->getFilteredObjectives();

        // Prepare data collection
        $data = $this->prepareReportData($objectives);

        return $data;
    }

    /**
     * Get filtered objectives with key results and check-ins
     *
     * @return \Illuminate\Database\Eloquent\Collection
     */
    protected function getFilteredObjectives()
    {
        return Objective::with(['keyResults', 'keyResults.checkIns'])
            ->where(function ($query) {
                // Objective's date range overlaps with report period
                $query->where(function ($q) {
                    $q->where('start_date', '<=', $this->endDate)
                        ->where('end_date', '>=', $this->startDate);
                })
                // Or has check-ins within the report period
                ->orWhereHas('keyResults.checkIns', function ($q) {
                    $q->whereBetween('check_in_date', [$this->startDate, $this->endDate]);
                });
            })->get()

        // Filter objectives based on access and with current period check-ins
        ->filter(function ($objective) {
            // Check view access
            if ($this->checkViewAccess($objective->id)) {
                return false;
            }

            // Ensure the objective has check-ins in the current period
            $hasCurrentPeriodCheckIns = $objective->keyResults->some(function ($kr) {
                return $kr->checkIns->isNotEmpty();
            });

            return $hasCurrentPeriodCheckIns;
        });
    }

    /**
     * Prepare report data from filtered objectives
     *
     * @param \Illuminate\Database\Eloquent\Collection $objectives
     * @return \Illuminate\Support\Collection
     */
    protected function prepareReportData($objectives)
    {
        $data = collect();
        $totalWeeks = count($this->weekRanges);
        $totalSpan = 2 + $totalWeeks + 1;

        // Add grading scale row
        $gradingScaleRow = [
            __('performance::app.gradingScore'),
            '0 - 0.1', '0.1 - 0.2', '0.2 - 0.3', '0.3 - 0.4',
            '0.4 - 0.5', '0.5 - 0.6', '0.6 - 0.7', '0.7 - 0.8', '0.8 - 0.9', '0.9 - 1'
        ];
        $data->push($gradingScaleRow);

        // Add report title row
        $reportTitle = sprintf(
            '%s - %s to %s',
            __('performance::app.okrScoringReport'),
            $this->startDate->format('d M Y'),
            $this->endDate->format('d M Y')
        );
        $data->push([['value' => $reportTitle, 'colspan' => $totalSpan]]);

        // Add period row with dynamic week ranges
        $periodRow = [__('performance::app.id'), __('performance::app.title')];
        foreach ($this->weekRanges as $weekRange) {
            $periodRow[] = $weekRange['label'];
        }
        $periodRow[] = __('performance::app.finalScore');
        $data->push($periodRow);

        // Process objectives
        foreach ($objectives as $objIndex => $objective) {
            $this->processObjectiveData($data, $objIndex, $objective);
        }

        return $data;
    }

    /**
     * Process individual objective data
     *
     * @param Collection $data
     * @param int $objIndex
     * @param Objective $objective
     */
    protected function processObjectiveData(&$data, $objIndex, $objective)
    {
        $keyResultsCount = count($objective->keyResults);

        if ($keyResultsCount === 0)
        {
            return;
        }

        $objectiveWeekTotals = array_fill(1, count($this->weekRanges), 0);
        $finalScoreTotal = 0;
        $keyResultData = [];

        foreach ($objective->keyResults as $krIndex => $keyResult) {
            $weeklyScoreData = $this->getScoresByWeeks($keyResult);
            $weeklyScores = $weeklyScoreData['scores'];

            // Add weekly scores to total
            foreach ($weeklyScores as $week => $score) {
                $objectiveWeekTotals[$week] += floatval($score);
            }

            // Calculate final score
            $finalScore = $this->calculateFinalScore($weeklyScoreData);
            $finalScoreTotal += floatval($finalScore);

            $keyResultData[] = [
                'Objective' => __('performance::app.kr') .' - '. ($krIndex + 1),
                'Key Result' => $keyResult->title,
                'weeklyScores' => $weeklyScores,
                'finalScore' => $finalScore
            ];
        }

        // Add objective total row
        $this->addObjectiveTotalRow($data, $objIndex, $objective, $objectiveWeekTotals, $finalScoreTotal, $keyResultsCount);

        // Add individual key result rows
        $this->addKeyResultRows($data, $keyResultData);
    }

    /**
     * Add objective total row to data collection
     *
     * @param Collection $data
     * @param int $objIndex
     * @param Objective $objective
     * @param array $weekTotals
     * @param float $finalScoreTotal
     * @param int $keyResultsCount
     */
    protected function addObjectiveTotalRow($data, $objIndex, $objective, $weekTotals, $finalScoreTotal, $keyResultsCount)
    {
        $totalRow = [__('performance::app.obj') .' - '. ($objIndex + 1), $objective->title];

        foreach ($weekTotals as $weekTotal) {
            $weeklyAverage = $keyResultsCount > 0 ? $weekTotal / $keyResultsCount : 0;
            $totalRow[] = number_format($weeklyAverage, 2, '.', '');
        }

        $totalRow[] = number_format($keyResultsCount > 0 ? $finalScoreTotal / $keyResultsCount : 0, 2, '.', '');
        $data->push($totalRow);
    }

    /**
     * Add key result rows to data collection
     *
     * @param Collection $data
     * @param array $keyResultData
     */
    protected function addKeyResultRows(&$data, $keyResultData)
    {
        foreach ($keyResultData as $krData) {
            $row = [$krData['Objective'], $krData['Key Result']];
            $row = array_merge($row, array_values($krData['weeklyScores']));
            $row[] = $krData['finalScore'];
            $data->push($row);
        }
    }

    protected function getScoresByWeeks($keyResult)
    {
        $scores = array_fill(1, count($this->weekRanges), 0.00);

        $uniqueScoredWeeks = [];
        $processedWeeks = [];

        foreach ($keyResult->checkIns as $checkIn) {
            $checkInDate = Carbon::parse($checkIn->check_in_date);

            // Find which week this check-in belongs to
            $weekNumber = $this->findWeekNumber($checkInDate);

            if ($weekNumber !== null) {
                if (isset($processedWeeks[$weekNumber])) {
                    $scores[$weekNumber] = floatval($scores[$weekNumber]) + ($checkIn->objective_percentage / 100);
                }
                else {
                    $scores[$weekNumber] = $checkIn->objective_percentage / 100;
                    $processedWeeks[$weekNumber] = true;
                }

                $scores[$weekNumber] = min(round($scores[$weekNumber], 2), 1.0);
                $uniqueScoredWeeks[$weekNumber] = true;
            }
        }

        // Format scores
        foreach ($scores as $week => $score) {
            $scores[$week] = number_format($score, 2, '.', '');
        }

        return [
            'scores' => $scores,
            'uniqueWeeks' => count($uniqueScoredWeeks)
        ];
    }

    protected function findWeekNumber(Carbon $date)
    {
        foreach ($this->weekRanges as $weekNumber => $range) {
            if ($date->between($range['start'], $range['end'])) {
                return $weekNumber;
            }
        }
        return null;
    }

    protected function calculateFinalScore($scoreData)
    {
        $scores = $scoreData['scores'];
        $uniqueWeeks = $scoreData['uniqueWeeks'];

        if ($uniqueWeeks === 0) {
            return '0.00';
        }

        $nonZeroScores = array_filter($scores, function($score) {
            return floatval($score) > 0;
        });

        if (empty($nonZeroScores)) {
            return '0.00';
        }

        $totalScore = array_sum($nonZeroScores);
        return number_format($totalScore / $uniqueWeeks, 2, '.', '');
    }

    protected function addRowsToCollection($data, $objIndex, $objective, $weekTotals, $finalScoreTotal, $keyResultsCount, $keyResultData)
    {
        // Add objective total row
        $totalRow = [__('performance::app.obj') .' - '. ($objIndex + 1), $objective->title];

        foreach ($weekTotals as $weekTotal) {
            $weeklyAverage = $weekTotal / $keyResultsCount;
            $totalRow[] = number_format($weeklyAverage, 2, '.', '');
        }

        $totalRow[] = number_format($finalScoreTotal / $keyResultsCount, 2, '.', '');
        $data->push($totalRow);

        // Add individual key result rows
        foreach ($keyResultData as $krData) {
            $row = [$krData['Objective'], $krData['Key Result']];
            $row = array_merge($row, array_values($krData['weeklyScores']));
            $row[] = $krData['finalScore'];
            $data->push($row);
        }
    }

    public function headings(): array
    {
        // Leave empty as we are adding custom headers manually in the collection
        return [];
    }

    public function startCell(): string
    {
        return 'A1';
    }

    /**
     * Convert number to Excel column letter (handles columns beyond 'Z')
     *
     * @param int $n Column number (1-based)
     * @return string Excel column letter(s)
     */
    protected function getColumnLetter($n)
    {
        $letter = '';
        while ($n > 0) {
            $n--;
            $letter = chr(65 + ($n % 26)) . $letter;
            $n = intdiv($n, 26);
        }
        return $letter;
    }

    protected function isEmptyOrZero($value)
    {
        return (
            $value === null ||
            $value === '' ||
            $value === '0' ||
            $value === '0.00' ||
            $value === 0 ||
            $value === 0.00 ||
            trim((string)$value) === ''
        );
    }

    public function styles(Worksheet $sheet)
    {
        // Get the number of weeks for dynamic column spanning
        $weeksCount = count($this->weekRanges);

        // Calculate last column using the new method
        // Adding 3 to account for: ID column (1) + Title column (1) + weeks + Final score (1)
        $lastColumnNumber = 2 + $weeksCount + 1;
        $lastColumn = $this->getColumnLetter($lastColumnNumber);

        // Set width for ID and title column
        $sheet->getColumnDimension('A')->setWidth(16);
        $sheet->getColumnDimension('B')->setWidth(25);

        // Set width for week columns (starts from column C)
        for ($i = 0; $i < $weeksCount; $i++) {
            $columnLetter = $this->getColumnLetter($i + 3); // +3 because we start from C (3rd column)
            $sheet->getColumnDimension($columnLetter)->setWidth(15);
        }

        // Set width for final score column
        $sheet->getColumnDimension($lastColumn)->setWidth(20);

        // Rest of your existing styles code, but using $lastColumn instead of the chr() calculation
        $sheet->getStyle('A:' . $lastColumn)->getAlignment()
            ->setVertical(\PhpOffice\PhpSpreadsheet\Style\Alignment::VERTICAL_CENTER);

        // Style the GRADING SCORE text as bold
        $sheet->getStyle('A1')->getFont()->setBold(true);
        $sheet->getStyle('A1')->getAlignment()
            ->setHorizontal(\PhpOffice\PhpSpreadsheet\Style\Alignment::HORIZONTAL_LEFT);

        // Style OKR SCORING REPORT
        $mergeRange = 'A2:' . $lastColumn . '2';

        $sheet->mergeCells($mergeRange);
        $sheet->getStyle('A2')->getAlignment()
            ->setHorizontal(\PhpOffice\PhpSpreadsheet\Style\Alignment::HORIZONTAL_CENTER);
        $sheet->getStyle('A2')->getFont()->setBold(true);

        // Set row height for all rows
        $sheet->getDefaultRowDimension()->setRowHeight(20);

        // Apply vertical alignment to all cells
        $sheet->getStyle('A:' . $lastColumn)->getAlignment()
            ->setVertical(\PhpOffice\PhpSpreadsheet\Style\Alignment::VERTICAL_CENTER);

        // Style the GRADING SCORE row (row 1)
        $this->styleGradingScoreRow($sheet);

        // Style the PERIOD row (row 3)
        $this->stylePeriodRow($sheet, $lastColumn);

        $dataStartRow = 4; // Data starts from row 4
        $currentRow = $dataStartRow;

        // Get all objectives with their key results
        $objectives = $this->getFilteredObjectives();

        foreach ($objectives as $objective) {
            $keyResults = $objective->keyResults;
            $keyResultsCount = $keyResults->count();

            if ($keyResultsCount > 0) {
                $hasCurrentPeriodCheckIns = $keyResults->some(function ($kr) {
                    return $kr->checkIns->isNotEmpty();
                });

                if (!$hasCurrentPeriodCheckIns) {
                    continue;
                }

                // Style objective total row
                if ($keyResultsCount > 0) {
                    $this->styleTotalRowFirstTwoColumns($sheet, $currentRow);

                    // Apply colors to score cells
                    for ($i = 0; $i < $weeksCount + 1; $i++) { // +1 for final score
                        $column = $this->getColumnLetter($i + 3);
                        $cellCoordinate = $column . $currentRow;

                        try {
                            $cell = $sheet->getCell($cellCoordinate);
                            $value = $cell->getValue();

                            if ($this->isEmptyOrZero($value)) {
                                $color = 'ff3333'; // Red for empty/zero
                            }
                            else {
                                $numericValue = floatval(str_replace(',', '', (string)$value));
                                $color = $this->getColorForScore($numericValue);
                            }

                            $sheet->getStyle($cellCoordinate)->getFill()
                                ->setFillType(\PhpOffice\PhpSpreadsheet\Style\Fill::FILL_SOLID)
                                ->getStartColor()
                                ->setARGB($color);

                            $sheet->getStyle($cellCoordinate)->getAlignment()
                                ->setHorizontal(\PhpOffice\PhpSpreadsheet\Style\Alignment::HORIZONTAL_CENTER);
                        } catch (\Exception $e) {
                            error_log("Error processing cell {$cellCoordinate}: " . $e->getMessage());
                            continue;
                        }
                    }

                    $this->styleTotalRow($sheet, $currentRow, $lastColumn);
                    $currentRow++;
                }

                // Style key result rows
                foreach ($keyResults as $keyResult) {
                    $this->applyScoreColors($sheet, $currentRow, $weeksCount);
                    $currentRow++;
                }
            }
        }
    }

    /**
     * Style the first two columns of the total row with a specific color
     */
    protected function styleTotalRowFirstTwoColumns(Worksheet $sheet, int $row)
    {
        // Apply ccf5ff color to first two columns (A and B)
        $columns = ['A', 'B'];

        foreach ($columns as $column) {
            $cell = $column . $row;
            $sheet->getStyle($cell)->getFill()
                ->setFillType(\PhpOffice\PhpSpreadsheet\Style\Fill::FILL_SOLID)
                ->getStartColor()
                ->setARGB('ccf5ff');
        }
    }

    protected function stylePeriodRow(Worksheet $sheet, string $lastColumn)
    {
        // Make the PERIOD row bold
        $sheet->getStyle("A3:{$lastColumn}3")->getFont()->setBold(true);

        // Add blue background color to the header row
        $sheet->getStyle("A3:{$lastColumn}3")->getFill()
            ->setFillType(\PhpOffice\PhpSpreadsheet\Style\Fill::FILL_SOLID)
            ->getStartColor()
            ->setARGB('00a3cc');

        // Set text color to white for better readability
        $sheet->getStyle("A3:{$lastColumn}3")->getFont()->getColor()->setARGB('FFFFFF');

        // Left align the "PERIOD" text in A3
        $sheet->getStyle('A3')->getAlignment()
            ->setHorizontal(\PhpOffice\PhpSpreadsheet\Style\Alignment::HORIZONTAL_LEFT);

        // Center align the week columns and final score
        $sheet->getStyle("C3:{$lastColumn}3")->getAlignment()
            ->setHorizontal(\PhpOffice\PhpSpreadsheet\Style\Alignment::HORIZONTAL_CENTER);

        // Add borders between columns
        for ($col = 'A'; $col <= $lastColumn; $col++) {
                $sheet->getStyle("{$col}3")->getBorders()->getRight()
                ->setBorderStyle(\PhpOffice\PhpSpreadsheet\Style\Border::BORDER_THIN);
        }
    }

    /**
     * Style the GRADING SCORE row
     */
    protected function styleGradingScoreRow(Worksheet $sheet)
    {
        // Color the cells based on the grading scale
        $gradingRanges = [
            'B1:D1' => ['0 - 0.1', '0.1 - 0.2', '0.2 - 0.3'], // Red zone (0.00 - 0.30)
            'E1:H1' => ['0.3 - 0.4', '0.4 - 0.5', '0.5 - 0.6', '0.6 - 0.7'], // Yellow zone (0.31 - 0.70)
            'I1:K1' => ['0.7 - 0.8', '0.8 - 0.9', '0.9 - 1.0'] // Green zone (0.71 - 1.00)
        ];

        // Apply colors to each range
        foreach ($gradingRanges as $range => $values) {
            $sheet->getStyle($range)->getFill()
                ->setFillType(\PhpOffice\PhpSpreadsheet\Style\Fill::FILL_SOLID)
                ->getStartColor()
                ->setARGB($this->getColorForRange($range));
        }

        // Center align all cells in the first row
        $sheet->getStyle('A1:K1')->getAlignment()
            ->setHorizontal(\PhpOffice\PhpSpreadsheet\Style\Alignment::HORIZONTAL_CENTER);
    }

    protected function getColorForRange($range)
    {
        if (in_array($range, ['B1:D1'])) {
            return 'ff3333'; // Red
        }
        elseif (in_array($range, ['E1:H1'])) {
            return 'ffff1a'; // Yellow
        }
        else {
            return '59b300'; // Green
        }
    }

    /**
     * Apply colors to score cells in a row
     */
    protected function applyScoreColors(Worksheet $sheet, int $row, int $weeksCount)
    {
        try {
            // Calculate score columns using the new method
            for ($i = 0; $i < $weeksCount + 1; $i++) { // +1 for final score column
                $column = $this->getColumnLetter($i + 3); // +3 because we start from C
                $cellCoordinate = $column . $row;

                // Validate cell coordinate
                if (!\PhpOffice\PhpSpreadsheet\Cell\Coordinate::coordinateIsRange($cellCoordinate)) {
                    // Get cell value safely
                    try {
                        $cell = $sheet->getCell($cellCoordinate);
                        $value = $cell->getValue();

                        // Comprehensive check for empty or zero values
                        $isEmptyOrZero = (
                            $value === null ||
                            $value === '' ||
                            $value === '0' ||
                            $value === '0.00' ||
                            $value === 0 ||
                            $value === 0.00 ||
                            trim((string)$value) === ''
                        );

                        if ($isEmptyOrZero) {
                            // Apply red color for empty or zero scores
                            $sheet->getStyle($cellCoordinate)->getFill()
                                ->setFillType(\PhpOffice\PhpSpreadsheet\Style\Fill::FILL_SOLID)
                                ->getStartColor()
                                ->setARGB('ff3333');
                        }
                        else {
                            $numericValue = is_numeric($value) ? floatval($value) : null;
                            if ($numericValue !== null) {
                                $color = $this->getColorForScore($numericValue);
                                $sheet->getStyle($cellCoordinate)->getFill()
                                    ->setFillType(\PhpOffice\PhpSpreadsheet\Style\Fill::FILL_SOLID)
                                    ->getStartColor()
                                    ->setARGB($color);
                            }
                        }

                        // Center align the cell
                        $sheet->getStyle($cellCoordinate)->getAlignment()
                            ->setHorizontal(\PhpOffice\PhpSpreadsheet\Style\Alignment::HORIZONTAL_CENTER);
                    } catch (\PhpOffice\PhpSpreadsheet\Exception $e) {
                        // Log error or handle invalid cell
                        error_log("Error processing cell {$cellCoordinate}: " . $e->getMessage());
                        continue;
                    }
                }
            }
        } catch (\Exception $e) {
            // Log any other errors that might occur
            error_log("Error in applyScoreColors: " . $e->getMessage());
        }
    }

    /**
     * Style the total row with colors and formatting
     */
    protected function styleTotalRow(Worksheet $sheet, int $row, string $lastColumn)
    {
        // Style the entire row
        $range = "A{$row}:{$lastColumn}{$row}";

        // Apply base formatting
        $sheet->getStyle($range)->getFont()->setBold(false);
        $sheet->getStyle($range)->getAlignment()
            ->setHorizontal(\PhpOffice\PhpSpreadsheet\Style\Alignment::HORIZONTAL_CENTER);

        // Add borders to separate objectives
        $sheet->getStyle($range)->getBorders()->getBottom()
            ->setBorderStyle(\PhpOffice\PhpSpreadsheet\Style\Border::BORDER_THIN);
        $sheet->getStyle($range)->getBorders()->getTop()
            ->setBorderStyle(\PhpOffice\PhpSpreadsheet\Style\Border::BORDER_THIN);

        // Left align text in first two columns
        $sheet->getStyle("A{$row}:B{$row}")->getAlignment()
            ->setHorizontal(\PhpOffice\PhpSpreadsheet\Style\Alignment::HORIZONTAL_LEFT);

        // Apply score column formatting
        $scoreRange = "C{$row}:{$lastColumn}{$row}";
        $sheet->getStyle($scoreRange)->getAlignment()
            ->setHorizontal(\PhpOffice\PhpSpreadsheet\Style\Alignment::HORIZONTAL_CENTER);

        // Process each score cell
        for ($col = 'C'; $col <= $lastColumn; $col++) {
            $cell = $col . $row;

            try {
                $cellValue = $sheet->getCell($cell)->getValue();

                // Handle different types of zero/empty values
                if ($cellValue === null || $cellValue === '' ||
                    $cellValue === '0' || $cellValue === '0.00' ||
                    $cellValue === 0 || $cellValue === 0.00 ||
                    trim((string)$cellValue) === '') {

                    $sheet->getStyle($cell)->getFill()
                        ->setFillType(\PhpOffice\PhpSpreadsheet\Style\Fill::FILL_SOLID)
                        ->getStartColor()
                        ->setARGB('ff3333'); // Red for zero/empty values
                }
                else {
                    // Convert to float and apply color based on score
                    $numericValue = floatval(str_replace(',', '', (string)$cellValue));
                    $color = $this->getColorForScore($numericValue);

                    $sheet->getStyle($cell)->getFill()
                        ->setFillType(\PhpOffice\PhpSpreadsheet\Style\Fill::FILL_SOLID)
                        ->getStartColor()
                        ->setARGB($color);
                }
            } catch (\Exception $e) {
                // Log any cell processing errors
                error_log("Error processing cell {$cell}: " . $e->getMessage());
                continue;
            }
        }
    }

    /**
     * Get the color for the score based on the new grading scale
     */
    protected function getColorForScore($score)
    {
        $score = (float)$score;

        // Red for 0.00 to 0.30 (including zero)
        if ($score <= 0.30) {
            return 'ff3333';
        }
        // Yellow for 0.31 to 0.70
        else if ($score <= 0.70) {
            return 'ffff1a';
        }
        // Green for 0.71 to 1.00
        else {
            return '59b300';
        }
    }

    protected function getWeeksForObjective($startDate, $endDate, $monthYear)
    {
        // Convert dates to Carbon instances if they aren't already
        $startDate = $startDate instanceof Carbon ? $startDate : Carbon::parse($startDate);
        $endDate = $endDate instanceof Carbon ? $endDate : Carbon::parse($endDate);

        // Get the month we're reporting on
        $reportingMonth = Carbon::createFromFormat('m-Y', $monthYear);
        $monthStart = $reportingMonth->copy()->startOfMonth();
        $monthEnd = $reportingMonth->copy()->endOfMonth();

        // Adjust start date if it's before the month start
        $effectiveStart = $startDate->lt($monthStart) ? $monthStart : $startDate;

        // Adjust end date if it's after the month end
        $effectiveEnd = $endDate->gt($monthEnd) ? $monthEnd : $endDate;

        // Get the week numbers for start and end dates
        $startWeek = $effectiveStart->weekOfMonth;
        $endWeek = $effectiveEnd->weekOfMonth;

        // Calculate total weeks
        $totalWeeks = $endWeek - $startWeek + 1;

        return [
            'startWeek' => $startWeek,
            'endWeek' => $endWeek,
            'totalWeeks' => $totalWeeks,
        ];
    }

    protected function getActiveKeyResults($objective, $startDate, $endDate)
    {
        return $objective->keyResults->filter(function ($keyResult) use ($startDate, $endDate) {
            return $keyResult->checkins->where('check_in_date', '>=', $startDate)
                ->where('check_in_date', '<=', $endDate)
                ->isNotEmpty();
        });
    }

    protected function getLastCheckInDate($objective)
    {
        $lastCheckIn = null;

        foreach ($objective->keyResults as $keyResult) {
            $keyResultLastCheckIn = $keyResult->checkins->last(); // Already ordered by desc

            if ($keyResultLastCheckIn &&
                (!$lastCheckIn || $keyResultLastCheckIn->check_in_date > $lastCheckIn)) {
                $lastCheckIn = $keyResultLastCheckIn->check_in_date;
            }
        }

        return $lastCheckIn;
    }

    protected function getFirstCheckInDate($objective)
    {
        $firstCheckIn = null;

        foreach ($objective->keyResults as $keyResult) {
            $keyResultFirstCheckIn = $keyResult->checkins->first(); // Already ordered by desc

            if ($keyResultFirstCheckIn &&
                (!$firstCheckIn || $keyResultFirstCheckIn->check_in_date < $firstCheckIn)) {
                $firstCheckIn = $keyResultFirstCheckIn->check_in_date;
            }
        }

        return $firstCheckIn;
    }

    public function map($row): array
    {
        return array_map(function($item) {
            if (is_array($item) && isset($item['value']) && isset($item['colspan'])) {
                return $item;
            }

            return $item;
        }, $row);
    }

    protected function checkViewAccess($id)
    {
        $objective = Objective::with('owners')->findOrFail($id);
        $ownerIds = $objective->owners->pluck('id')->toArray();
        $goal = GoalType::find($objective->goal_type);

        $managerIds = EmployeeDetails::whereNotNull('reporting_to')
            ->whereIn('user_id', $ownerIds)
            ->pluck('reporting_to')
            ->toArray();

        $currentUserRoleIds = user()->roles()->pluck('id')->toArray();
        $viewByRoles = json_decode($goal->view_by_roles, true) ?? [];

        return !(($goal && $goal->view_by_owner == 1 && in_array(user()->id, $ownerIds)) ||
            ($goal && $goal->view_by_manager == 1 && in_array(user()->id, $managerIds)) ||
            (!empty($viewByRoles) && array_intersect($currentUserRoleIds, $viewByRoles)) ||
            user()->hasRole('admin') || $objective->created_by == user()->id);
    }

    protected function checkManageAccess($id)
    {
        $objective = Objective::with('owners')->findOrFail($id);
        $ownerIds = $objective->owners->pluck('id')->toArray();
        $goal = GoalType::find($objective->goal_type);

        $managerIds = EmployeeDetails::whereNotNull('reporting_to')
            ->whereIn('user_id', $ownerIds)
            ->pluck('reporting_to')
            ->toArray();

        $currentUserRoleIds = user()->roles()->pluck('id')->toArray();
        $manageByRoles = json_decode($goal->manage_by_roles, true) ?? [];

        return !(user()->hasRole('admin') ||
            $objective->created_by == user()->id ||
            ($goal && $goal->manage_by_owner == 1 && in_array(user()->id, $ownerIds)) ||
            ($goal && $goal->manage_by_manager == 1 && in_array(user()->id, $managerIds)) ||
            (!empty($manageByRoles) && array_intersect($currentUserRoleIds, $manageByRoles)));
    }

}
