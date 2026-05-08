<style>
    @page {
  size: A4 landscape;
  margin: 0;
}
body {
  margin: 0;
  padding: 0;
  font-family: "Open Sans", "Helvetica Neue", Helvetica, Arial, sans-serif;
  color: #333333;
  background: #ffffff;
  -webkit-print-color-adjust: exact;
}

.page {
  height: 210mm;
  position: relative;
  page-break-after: always;
  overflow: hidden;
  background: white;
}
.page:last-child {
  page-break-after: auto;
}

.bg {
  background-image: var(--bg-image);
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;
  min-height: 100%;
}

.logo img {
  width: 30%;
}

.logo-watermark {
  position: absolute;
  bottom: 20mm;
  right: 45mm;
  width: 100px;
  opacity: 0.8;
}

.expose-title {
  display: flex;
  align-items: center;
  position: relative;
}
.expose-title img {
  position: relative;
  z-index: 2;
}
.expose-title .text {
  height: 3rem;
  border-right: 0.375rem solid #053160;
  border-bottom: 0.375rem solid #053160;
  border-radius: 0 4rem 4rem 0;
  padding: 12px 2rem;
  display: flex;
  align-items: center;
  position: absolute;
  left: 20%;
  z-index: 1;
  padding-left: 2rem;
  white-space: nowrap;
}
.expose-title .text h1 {
  color: #053160;
}
.expose-title .text.blue {
  background-color: #053160;
}
.expose-title .text.blue h1 {
  color: white;
}

.items {
  padding-left: 60px;
}

.item {
  margin-bottom: 1.5rem;
}
.item-header {
  font-size: 16px;
  font-weight: 700;
  color: #053160;
  margin-bottom: 5px;
}
.item-value {
  font-size: 16px;
  color: #053160;
  font-weight: 400;
}
.item-list {
  list-style-type: disc;
  padding-left: 20px;
  margin: 0;
  color: #053160;
  font-size: 16px;
  line-height: 1.6;
}

.featured-grid {
  display: grid;
  grid-template-columns: 58.33% 41.67%;
  grid-template-rows: 1.5fr 1fr;
  gap: 10px;
  height: 100%;
  box-sizing: border-box;
}
.featured-grid > * {
  background-image: var(--bg-image);
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;
  overflow: hidden;
}
.featured-grid .left-column {
  grid-row: 1/3;
}

.quad-grid {
  display: grid;
  grid-template-columns: 50% 50%;
  grid-template-rows: 1fr 1fr;
  gap: 10px;
  height: 100%;
  box-sizing: border-box;
}
.quad-grid > * {
  background-image: var(--bg-image);
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;
  overflow: hidden;
}

.split-page {
  height: 100%;
  position: relative;
  display: flex;
  flex-direction: column;
}
.split-page .expose-title.absolute {
  position: absolute;
  left: 0;
  top: 50%;
  transform: translateY(-50%);
  display: flex;
  align-items: center;
  z-index: 10;
}
.split-page .expose-title .text {
  padding: 0.5rem 2rem 0.5rem 8rem;
}
.split-page .expose-title .text h1 {
  font-size: 32px;
}
.split-page .split-top {
  height: 55%;
  background-image: var(--bg-image);
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;
}
.split-page .split-bottom {
  height: 45%;
  display: flex;
  align-items: center;
  padding: 2rem;
}
.split-page .split-bottom .container {
  max-width: 80%;
}
.split-page .split-bottom p {
  font-size: 16px;
  line-height: 1.8;
  color: #555555;
  text-align: justify;
  margin: 0;
}
.split-page .rock-shape {
  position: absolute;
  right: 2%;
  bottom: 33%;
  width: 264px;
  height: 319px;
  border: 4px solid white;
  overflow: hidden;
  border-radius: 84% 31% 73% 41%/49% 32% 37% 47%;
  transform: translateY(40%);
  z-index: 5;
}
.split-page .rock-shape img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center;
}

.gallery-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  grid-template-rows: repeat(2, 1fr);
  height: 100%;
  gap: 22px;
}

.gallery-item {
  width: 100%;
  height: 100%;
  background: #f5f5f5;
  overflow: hidden;
  border: 0.0625rem solid;
  position: relative;
}
.gallery-item .title {
  position: absolute;
  left: 0;
  bottom: 1.75rem;
  padding: 0.75rem 1.25rem;
  font-size: 16px;
  background: linear-gradient(to right, white 80%, transparent 100%);
}

.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 1.5rem;
}
.header .title {
  background: #053160;
  color: white;
  padding: 0.25rem 2rem;
  border-radius: 0 2rem 2rem 0;
  min-width: 150px;
  font-weight: 500;
  font-size: 32px;
}
.header .title.end {
  border-radius: 2rem 0 0 2rem;
}

.overflow-illustration {
  border-radius: 1rem;
  display: flex;
  transition: 0.3s all ease-in-out;
  height: 100%;
  width: 500px;
  height: 500px;
  transform: rotate(-45deg);
}
.overflow-illustration img {
  margin: auto;
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: 2rem;
}

.illustration {
  overflow: hidden;
  transition: 0.3s all ease-in-out;
  height: 100%;
}
.illustration img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.row {
  display: flex;
  height: 100%;
  width: 100%;
}

.col-left {
  width: 60%;
  height: 100%;
  position: relative;
}

.col-right {
  width: 40%;
  height: 100%;
  padding: 15mm;
  display: flex;
  flex-direction: column;
  justify-content: center;
  box-sizing: border-box;
}

.col-half {
  width: 50%;
  box-sizing: border-box;
}

.col-4 {
  width: 33.333333%;
  box-sizing: border-box;
}

.col-5 {
  width: 45.833333%;
  box-sizing: border-box;
}

.col-7 {
  width: 54.166667%;
  box-sizing: border-box;
}

.col-8 {
  width: 66.666667%;
  box-sizing: border-box;
}

.flex-center {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
}

.overview-layout {
  gap: 2rem;
}
.overview-layout .content {
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 1rem;
  padding: 2rem 0;
}
.overview-layout .content p,
.overview-layout .content h1 {
  padding-left: 3%;
}

.container {
  /* padding: 15mm; */
  padding: 8mm;
  height: 100%;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
}

h1 {
  font-size: 40px;
  font-weight: 700;
  color: #053160;
  margin: 0;
  line-height: 1.2;
}
h1 .more {
  font-weight: 400;
}

h2 {
  font-size: 20px;
  font-weight: 400;
  text-transform: uppercase;
  letter-spacing: 2px;
  color: #053160;
  margin: 0 0 25px 0;
  padding-bottom: 15px;
}

h3 {
  font-size: 12px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 1px;
  color: #888888;
  margin: 0 0 5px 0;
}

p {
  font-size: 20px;
  line-height: 1.6;
  color: #555555;
  margin: 0;
}

.text-muted {
  color: #999999;
}

.img-cover {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.img-contain {
  width: 100%;
  height: 100%;
  object-fit: contain;
  display: block;
}

.placeholder-img {
  width: 100%;
  height: 100%;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-size: 14px;
}

.closure {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2rem;
  background: rgba(255, 255, 255, 0.8);
  padding: 20px;
  border-radius: 2rem;
  height: 100%;
  width: 130mm;
  text-align: center;
}
.closure a {
  text-decoration: none;
  font-size: 20px;
  font-weight: 700;
  color: #053160;
}
.closure h2 {
  margin-bottom: 0;
  padding: 0;
}

.footer-brand {
  position: absolute;
  bottom: 15mm;
  left: 15mm;
  font-size: 10px;
  color: #ccc;
  text-transform: uppercase;
  letter-spacing: 1px;
}

.page-num {
  position: absolute;
  bottom: 15mm;
  right: 15mm;
  font-size: 10px;
  color: #ccc;
}

.fw-500 {
  font-weight: 500;
}

.fw-bold {
  font-weight: 700;
}

.infrastructure .infrastructure-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 1rem;
}
.infrastructure .grid-item {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  align-items: center;
}
.infrastructure .grid-item img {
  width: 100%;
  height: auto;
  object-fit: cover;
}
.infrastructure .grid-item span {
  background: #053160;
  color: white;
  padding: 0.125rem 0.5rem;
  text-align: center;
  border-radius: 0.5rem;
  font-size: 14px;
  font-weight: 600;
}
.infrastructure .grid-item p {
  font-size: 14px;
  font-weight: 600;
  color: #053160;
}
.infrastructure .grid-item:last-child:nth-child(odd) {
  grid-column: 1/-1;
  max-width: 50%;
  margin: 0 auto;
}

/* Project-specific styles */
.unit-type-card {
  border: 2px solid #e8e8e8;
  border-radius: 1rem;
  overflow: hidden;
  height: 100%;
  display: flex;
  flex-direction: column;
}
.unit-type-card .card-image {
  height: 55%;
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;
  background-color: #f0f0f0;
}
.unit-type-card .card-body {
  padding: 1rem 1.25rem;
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
}
.unit-type-card .card-title {
  font-size: 22px;
  font-weight: 700;
  color: #053160;
  margin-bottom: 0.5rem;
}
.unit-type-card .card-subtitle {
  font-size: 14px;
  color: #888;
  margin-bottom: 0.75rem;
}
.unit-type-card .card-specs {
  display: flex;
  gap: 1rem;
  flex-wrap: wrap;
  margin-bottom: 0.5rem;
}
.unit-type-card .card-specs .spec {
  font-size: 13px;
  color: #555;
}
.unit-type-card .card-specs .spec strong {
  color: #053160;
}
.unit-type-card .card-price {
  font-size: 20px;
  font-weight: 700;
  color: #053160;
  margin-top: auto;
}

.unit-types-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 24px;
  height: 100%;
}

.facilities-list {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.75rem 2rem;
  padding-left: 0;
  list-style: none;
  margin: 0;
}
.facilities-list li {
  font-size: 16px;
  color: #053160;
  padding: 0.5rem 0;
  border-bottom: 1px solid #eee;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}
.facilities-list li::before {
  content: "✓";
  color: #053160;
  font-weight: 700;
  font-size: 14px;
}

.project-stats {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1.5rem;
  margin-top: 1.5rem;
}
.project-stats .stat-item {
  text-align: center;
  padding: 1rem;
  background: #f8f9fa;
  border-radius: 0.75rem;
}
.project-stats .stat-item .stat-value {
  font-size: 28px;
  font-weight: 700;
  color: #053160;
}
.project-stats .stat-item .stat-label {
  font-size: 12px;
  color: #888;
  text-transform: uppercase;
  letter-spacing: 1px;
  margin-top: 0.25rem;
}
</style>

@php
    $pageNum = 1;
@endphp

<!-- PAGE 1: HERO -->
<div class="page bg" style="--bg-image: url('{{ $data['assets']['hero'][0] ?? 'https://minio.hibarr.org/backend-uploads/backend-uploads/1778197940203-011a688d-cover-image-project.png' }}')">
    <div class="container">
        <div class="logo">
            <img src="{{ $data['branding']['logo_expose'] }}" alt="hibarr-expose-logo" />
        </div>
    </div>

    <div
        style="
            position: absolute;
            bottom: 60mm;
            left: -7.9mm;
            color: red;
            text-shadow: 2px 2px 8px rgba(0, 0, 0, 0.6);
            z-index: 5;
        "
    >
        <div class="name_space">
            <img
                src="https://minio.hibarr.org/backend-uploads/backend-uploads/1778193858830-ad66988e-name-space.png"
                alt="name_space"
            />
        </div>
    </div>

    @if(!empty($data['client']['name']))
      <div
          class="customer-name"
          style="
              position: absolute;
              top: 155mm;
              left: 40mm;
              color: #001529;
              font-size: 40px;
              font-weight: 500;
              text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.5);
              z-index: 100;
          "
      >
          {{ $data['client']['name'] }}
      </div>
    @endif
    <div class="page-num">{{ str_pad($pageNum++, 2, '0', STR_PAD_LEFT) }}</div>
</div>

<!-- PAGE 2: PROJECT OVERVIEW -->
<div class="page bg">
  @php
    $unitTypesOverview = $data['unit_types'] ?? null;
    if (is_array($unitTypesOverview)) {
      $unitTypesOverview = collect($unitTypesOverview)
        ->map(function ($unitType) {
          if (is_array($unitType)) {
            return $unitType['display_label'] ?? $unitType['property_type'] ?? null;
          }

          return is_string($unitType) ? $unitType : null;
        })
        ->filter()
        ->unique()
        ->implode(', ');
    }

    $facilitiesOverview = $data['facilities'] ?? null;
    $facilitiesOverviewList = [];
    if (is_array($facilitiesOverview)) {
      if (!empty($data['facility_labels']) && is_array($data['facility_labels'])) {
        $facilitiesOverviewList = collect($data['facility_labels'])->filter()->values()->all();
      } else {
        $facilitiesOverviewList = collect($facilitiesOverview)
          ->map(function ($facility) {
            if (is_array($facility)) {
              return $facility['label'] ?? $facility['name'] ?? null;
            }

            return is_string($facility) ? $facility : null;
          })
          ->filter()
          ->values()
          ->all();
      }
    } elseif (is_string($facilitiesOverview) && $facilitiesOverview !== '') {
      $facilitiesOverviewList = [$facilitiesOverview];
    }
  @endphp
    <img
        src="https://minio.hibarr.org/backend-uploads/backend-uploads/1778220690459-2ef518d6-project-overview-space-for-img.png"
        alt="Project Overview Space"
        style="
            width: 100%;
            height: auto;
            object-fit: cover;
            position: absolute;
            z-index: 2;
            top: 0;
            right: 0;
        "
    />
    <img
        src="{{ $data['assets']['area'][0] ?? $data['assets']['hero'][0] ?? 'https://minio.hibarr.org/backend-uploads/backend-uploads/1778197940203-011a688d-cover-image-project.png' }}" 
        alt="Project illustration"
        style="
            width: 100%;
            height: auto;
            object-fit: cover;
            position: absolute;
            z-index: 1;
            top: 0;
            right: 0;
        "
    />
    <div class="container">
        <div class="row" style="position: relative; z-index: 10">
            <div class="col-half" style="padding-top: 80mm">
                <div class="items">
                    @if(!empty($data['city']))
                    <div class="item">
                        <h3 class="item-header">CITY</h3>
                        <div class="item-value">{{ $data['city'] }}</div>
                    </div>
                    @endif @if(!empty($unitTypesOverview))
                    <div class="item">
                        <h3 class="item-header">TYPES</h3>
                      <div class="item-value">{{ $unitTypesOverview }}</div>
                    </div>
                    @endif @if(!empty($data['completion_date']))
                    <div class="item">
                        <h3 class="item-header">COMPLETION DATE</h3>
                        <div class="item-value">
                            {{ $data['completion_date'] }}
                        </div>
                    </div>
                    @endif @if(!empty($facilitiesOverviewList))
                    <div class="item">
                        <h3 class="item-header">FACILITIES</h3>
                        <ul class="item-list">
                            @foreach($facilitiesOverviewList as $facility)
                              <li>{{ $facility }}</li>
                            @endforeach
                        </ul>
                    </div>
                    @endif
                </div>
            </div>
        </div>
    </div>

    <div class="page-num">{{ str_pad($pageNum++, 2, '0', STR_PAD_LEFT) }}</div>
</div>

<!-- PAGE 3: PROJECT STATS -->
@if(!empty($data['number_of_units']) || !empty($data['number_of_blocks']) || !empty($data['project_total_area_sqm']) || !empty($data['description']))
<div class="page">
    <div class="split-page">
        <div class="split-top" style="--bg-image: url('{{ $data['assets']['exterior'][0] ?? $data['assets']['hero'][0] ?? 'property/images/test.png' }}')"></div>
        <div class="split-bottom">
            <div class="container" style="width: 100%; max-width: 100%;">
                <div style="display: flex; gap: 3rem; align-items: center;">
                    <div style="flex: 1;">
                        <p style="font-size: 16px; line-height: 1.8;">
                            {{ !empty($data['description']) ? Str::limit(strip_tags($data['description']), 350) : '' }}
                        </p>
                    </div>
                    <div style="flex: 1;">
                        <div class="project-stats">
                            @if(!empty($data['number_of_units']))
                            <div class="stat-item">
                                <div class="stat-value">{{ $data['number_of_units'] }}</div>
                                <div class="stat-label">Total Units</div>
                            </div>
                            @endif
                            @if(!empty($data['number_of_blocks']))
                            <div class="stat-item">
                                <div class="stat-value">{{ $data['number_of_blocks'] }}</div>
                                <div class="stat-label">Blocks</div>
                            </div>
                            @endif
                            @if(!empty($data['project_total_area_sqm']))
                            <div class="stat-item">
                                <div class="stat-value">{{ number_format($data['project_total_area_sqm'], 0) }}</div>
                                <div class="stat-label">Total m²</div>
                            </div>
                            @endif
                            @if(!empty($data['number_of_phases']))
                            <div class="stat-item">
                                <div class="stat-value">{{ $data['number_of_phases'] }}</div>
                                <div class="stat-label">Phases</div>
                            </div>
                            @endif
                            @if($data['rental_guarantee'] ?? false)
                            <div class="stat-item">
                                <div class="stat-value">✓</div>
                                <div class="stat-label">Rental Guarantee</div>
                            </div>
                            @endif
                        </div>
                    </div>
                </div>
            </div>
        </div>
        <div class="expose-title blue absolute">
            <img style="width: 80%" src="{{ $data['branding']['logo_rounded'] }}" alt="rounded" />
            <div class="text blue">
                <h1 class="fw-500">{{ strtoupper($data['title'] ?? 'PROJECT') }}</h1>
            </div>
        </div>
    </div>
    <div class="page-num">{{ str_pad($pageNum++, 2, '0', STR_PAD_LEFT) }}</div>
</div>
@endif

<!-- PAGE: EXTERIOR GRID / FEATURED IMAGES -->
@if(!empty($data['assets']['exterior']))
<div class="page">
    <div class="container">
        <div class="featured-grid">
            <div class="left-column"  style="--bg-image: url('{{ $data['assets']['exterior'][0] ?? 'property/images/test.png' }}')"></div>
            <div class="right-top"    style="--bg-image: url('{{ $data['assets']['exterior'][1] ?? $data['assets']['exterior'][0] ?? 'property/images/test.png' }}')"></div>
            <div class="right-bottom" style="--bg-image: url('{{ $data['assets']['exterior'][2] ?? $data['assets']['exterior'][0] ?? 'property/images/test.png' }}')"></div>
        </div>
    </div>

    <div class="logo-watermark">
        <img src="{{ $data['branding']['logo_white'] }}" alt="hibarr-logo" />
    </div>
    <div class="page-num">{{ str_pad($pageNum++, 2, '0', STR_PAD_LEFT) }}</div>
</div>
@endif

<!-- PAGE: Full background exterior -->
@if(!empty($data['assets']['exterior'][3]))
<div class="page">
    <div class="container">
        <div class="bg" style="--bg-image: url('{{ $data['assets']['exterior'][3] }}')">
            <div class="logo-watermark">
                <img src="{{ $data['branding']['logo_white'] }}" alt="hibarr-logo" />
            </div>
        </div>
    </div>
    <div class="page-num">{{ str_pad($pageNum++, 2, '0', STR_PAD_LEFT) }}</div>
</div>
@endif

<!-- PAGE: FACILITIES GALLERY -->
@if(!empty($data['assets']['facilities']) || !empty($data['facility_labels']))
<div class="page">
    <div class="container">
        <div class="header">
            <span class="title">FACILITIES</span>
            <img style="width: 12%" src="{{ $data['company']['logo'] ?? $data['branding']['logo_full'] }}" alt="logo" />
        </div>

        <div class="gallery-grid">
            @php
                $amenityImages = $data['assets']['facilities'] ?? $data['assets']['exterior'] ?? [];
                $amenityNames  = $data['facility_labels'] ?? $data['exterior_features'] ?? [];
            @endphp

            @for($i = 0; $i < 6; $i++)
                <div class="gallery-item">
                    <div class="placeholder-img">
                        @if(isset($amenityImages[$i]))
                            <img src="{{ $amenityImages[$i] }}" alt="amenity {{ $i+1 }}" style="width:100%;height:100%;object-fit:cover;" />
                        @else
                            Facility {{ $i+1 }}
                        @endif
                    </div>
                    <div class="title">
                        <span>{{ $amenityNames[$i] ?? 'Facility ' . ($i+1) }}</span>
                    </div>
                </div>
            @endfor
        </div>
    </div>
    <div class="page-num">{{ str_pad($pageNum++, 2, '0', STR_PAD_LEFT) }}</div>
</div>
@endif

<!-- PAGE: FACILITIES LIST (if more than 6 facilities) -->
@if(count($data['facility_labels'] ?? []) > 6)
<div class="page">
    <div class="container">
        <div class="header">
            <span class="title">ALL FACILITIES</span>
            <img style="width: 12%" src="{{ $data['company']['logo'] ?? $data['branding']['logo_full'] }}" alt="logo" />
        </div>

        <div style="flex: 1; display: flex; align-items: center;">
            <ul class="facilities-list">
                @foreach($data['facility_labels'] as $facility)
                    <li>{{ $facility }}</li>
                @endforeach
            </ul>
        </div>
    </div>
    <div class="logo-watermark">
        <img src="{{ $data['branding']['logo_white'] }}" alt="hibarr-logo" />
    </div>
    <div class="page-num">{{ str_pad($pageNum++, 2, '0', STR_PAD_LEFT) }}</div>
</div>
@endif

<!-- PAGES: UNIT TYPE SUMMARIES (2 per page) -->
@if(!empty($data['unit_types']))
    @php
        $unitTypes = $data['unit_types'];
        $chunkedUnitTypes = array_chunk($unitTypes, 2);
    @endphp

    @foreach($chunkedUnitTypes as $chunkIndex => $unitTypePair)
    <div class="page">
        <div class="container">
            @if($chunkIndex === 0)
            <div class="header">
                <span class="title">UNIT TYPES</span>
                <img style="width: 12%" src="{{ $data['company']['logo'] ?? $data['branding']['logo_full'] }}" alt="logo" />
            </div>
            @endif

            <div class="unit-types-grid" style="{{ $chunkIndex > 0 ? 'padding-top: 0;' : '' }}">
                @foreach($unitTypePair as $unitType)
                <div class="unit-type-card">
                    <div class="card-image" style="background-image: url('{{ $unitType['cover_image'] ?? $data['assets']['exterior'][0] ?? 'property/images/test.png' }}');"></div>
                    <div class="card-body">
                        <div class="card-title">{{ $unitType['display_label'] ?? 'Unit Type' }}</div>
                        @if(!empty($unitType['reference_code']))
                        <div class="card-subtitle">{{ $unitType['reference_code'] }}</div>
                        @endif
                        <div class="card-specs">
                            @if(!empty($unitType['bedrooms']))
                            <span class="spec"><strong>{{ $unitType['bedrooms'] }}</strong> Bed</span>
                            @endif
                            @if(!empty($unitType['bathrooms']))
                            <span class="spec"><strong>{{ $unitType['bathrooms'] }}</strong> Bath</span>
                            @endif
                            @if(!empty($unitType['living_area_sqm']))
                            <span class="spec"><strong>{{ $unitType['living_area_sqm'] }}</strong> m²</span>
                            @endif
                            @if(!empty($unitType['total_area_sqm']))
                            <span class="spec"><strong>{{ $unitType['total_area_sqm'] }}</strong> m² gross</span>
                            @endif
                            @if(!empty($unitType['furniture_status']))
                            <span class="spec">{{ ucfirst(str_replace('_', ' ', $unitType['furniture_status'])) }}</span>
                            @endif
                        </div>
                        @if(!empty($unitType['view_types']))
                        <div style="margin-bottom: 0.5rem;">
                            @foreach($unitType['view_types'] as $view)
                            <span style="display: inline-block; background: #f0f4f8; color: #053160; font-size: 11px; padding: 2px 8px; border-radius: 4px; margin-right: 4px;">{{ ucfirst(str_replace('_', ' ', $view)) }}</span>
                            @endforeach
                        </div>
                        @endif
                        @if(!empty($unitType['formatted_price']))
                        <div class="card-price">From {{ $unitType['formatted_price'] }}</div>
                        @endif
                    </div>
                </div>
                @endforeach
            </div>
        </div>

        <div class="logo-watermark">
            <img src="{{ $data['branding']['logo_white'] }}" alt="hibarr-logo" />
        </div>
        <div class="page-num">{{ str_pad($pageNum++, 2, '0', STR_PAD_LEFT) }}</div>
    </div>
    @endforeach
@endif

<!-- PAGE: SITE PLAN -->
@if(!empty($data['assets']['site-plan']))
<div class="page">
    <div class="container">
        <div class="header">
            <span class="title">SITE PLAN</span>
            <img style="width: 12%" src="{{ $data['company']['logo'] ?? $data['branding']['logo_full'] }}" alt="logo" />
        </div>
        <div style="flex-grow: 1; display: flex; align-items: center; justify-content: center; padding: 20px;">
            <img src="{{ $data['assets']['site-plan'][0] }}" style="max-height: 150mm; width: auto;" alt="Site plan" />
        </div>
    </div>
    <div class="page-num">{{ str_pad($pageNum++, 2, '0', STR_PAD_LEFT) }}</div>
</div>
@endif

<!-- PAGE: PAYMENT PLAN -->
@if(!empty($data['payment_plan']))
<div class="page">
    <div class="container">
        <div class="header">
            <span class="title">PAYMENT PLAN</span>
            <img style="width: 12%" src="{{ $data['company']['logo'] ?? $data['branding']['logo_full'] }}" alt="logo" />
        </div>

        <div style="flex: 1; display: flex; align-items: center; justify-content: center;">
            <table style="width: 80%; border-collapse: collapse; font-size: 16px;">
                <thead>
                    <tr>
                        <th style="background: #053160; color: white; padding: 12px 16px; text-align: left; font-weight: 600;">Stage</th>
                        <th style="background: #053160; color: white; padding: 12px 16px; text-align: right; font-weight: 600;">Percentage</th>
                        <th style="background: #053160; color: white; padding: 12px 16px; text-align: left; font-weight: 600;">Details</th>
                    </tr>
                </thead>
                <tbody>
                    @foreach($data['payment_plan'] as $stage)
                    <tr>
                        <td style="border-bottom: 1px solid #eee; padding: 10px 16px; color: #053160; font-weight: 500;">{{ $stage['stage'] ?? $stage['name'] ?? '—' }}</td>
                        <td style="border-bottom: 1px solid #eee; padding: 10px 16px; text-align: right; color: #053160; font-weight: 700;">{{ $stage['percentage'] ?? $stage['amount'] ?? '—' }}</td>
                        <td style="border-bottom: 1px solid #eee; padding: 10px 16px; color: #555;">{{ $stage['details'] ?? $stage['description'] ?? '' }}</td>
                    </tr>
                    @endforeach
                </tbody>
            </table>
        </div>
    </div>
    <div class="logo-watermark">
        <img src="{{ $data['branding']['logo_white'] }}" alt="hibarr-logo" />
    </div>
    <div class="page-num">{{ str_pad($pageNum++, 2, '0', STR_PAD_LEFT) }}</div>
</div>
@endif

<!-- PAGE: Infrastructure / Distances -->
@if(!empty($data['distances']))
<div class="page">
    <div class="infrastructure">
        <div class="header">
            <span class="title">INFRASTRUCTURE</span>
            <span class="title end">DISTANCES</span>
        </div>

        <div class="container">
            <div class="row">
                <div class="col-5">
                    <div class="infrastructure-grid">
                        @foreach($data['distances'] as $key => $distance)
                            @if($loop->index < 6)
                            <div class="grid-item">
                                <img src="{{ $data['assets']['exterior'][$loop->index] ?? 'property/images/test.png' }}" alt="{{ $distance['name'] ?? $key }}">
                                <span>{{ $distance['name'] ?? ucwords(str_replace('_', ' ', $key)) }}</span>
                                <p>{{ $distance['time'] ?? $distance['distance'] ?? $distance }} {{ is_numeric($distance['time'] ?? $distance['distance'] ?? $distance) ? 'min' : '' }}</p>
                            </div>
                            @endif
                        @endforeach
                    </div>
                </div>
                <div class="col-7"></div>
            </div>
        </div>
    </div>
    <div class="page-num">{{ str_pad($pageNum++, 2, '0', STR_PAD_LEFT) }}</div>
</div>
@endif

<!-- PAGE: Closure / Contact -->
<div class="page">
    <div class="bg" style="--bg-image: url('{{ $data['assets']['hero'][0] ?? 'property/images/test.png' }}'); display: flex; justify-content: flex-end; height: 100%;">
        <div class="container">
            <div class="closure">
                <img style="width: 65%" src="{{ $data['company']['logo'] }}" alt="Logo" />

                <div>
                    <h1>{{ $data['agent']['name'] ?? 'Agent' }}</h1>
                    <p>{{ $data['agent']['position'] ?? 'Real Estate Consultant' }}</p>
                </div>

                <div>
                    <a href="mailto:{{ $data['agent']['email'] ?? '' }}"><h2>{{ $data['agent']['email'] ?? '' }}</h2></a>
                    <a href="tel:{{ str_replace([' ','+'], '', $data['agent']['phone'] ?? '') }}"><h2>{{ $data['agent']['phone'] ?? '' }}</h2></a>
                </div>

                <div>
                    <a href="https://{{ $data['company']['website'] ?? '' }}">{{ $data['company']['website'] ?? '' }}</a>
                    <h2>{{ $data['company']['address'] ?? '' }}</h2>
                </div>
            </div>
        </div>
    </div>
</div>
