<?php

return [
    'menu' => [
        'units' => 'Units',
        'inventory' => 'Inventory',
        'inventoryItems' => 'Inventory Items',
        'dashboard' => 'Dashboard',
        'inventoryStocks' => 'Inventory Stocks',
        'inventoryMovements' => 'Inventory Movements',
        'recipes' => 'Recipes',
        'purchaseOrders' => 'Purchase Orders',
        'reports' => 'Reports',
        'settings' => 'Settings',
        'purchaseOrderSettings' => 'Purchase Order Settings',
        'suppliers' => 'Suppliers',
        'inventoryItemCategories' => 'Inventory Item Categories',
    ],
    'supplier' => [
        'suppliers' => 'Suppliers',
        'suppliersDescription' => 'Manage your restaurant suppliers',
        'addSupplier' => 'Add Supplier',
        'editSupplier' => 'Edit Supplier',
        'deleteSupplier' => 'Delete Supplier',
        'deleteSupplierMessage' => 'Are you sure you want to delete this supplier? This action cannot be undone.',
        'supplierDeleted' => 'Supplier deleted successfully',
        'noSuppliersFound' => 'No suppliers found',
        'searchPlaceholder' => 'Search suppliers by name, email or phone...',
        'name' => 'Name',
        'email' => 'Email',
        'phone' => 'Phone',
        'address' => 'Address',
        'supplierUpdated' => 'Supplier updated successfully',
        'supplierAdded' => 'Supplier added successfully',
        'supplierHasOrders' => 'This supplier has :count purchase orders, you cannot delete it.',
        'supplierInformation' => 'Supplier Information',
    ],
    'unit' => [
        'addUnit' => 'Add Unit',
        'unitName' => 'Unit Name',
        'unitSymbol' => 'Unit Symbol',
        'editUnit' => 'Edit Unit',
        'noUnitFound' => 'No Unit Found',
        'unitAdded' => 'Unit Added Successfully',
        'unitUpdated' => 'Unit Updated Successfully',
        'deleteUnit' => 'Delete Unit',
        'deleteUnitMessage' => 'Are you sure you want to delete this unit?',
        'unitDeleted' => 'Unit Deleted Successfully',
    ],
    'inventoryItem' => [
        'addInventoryItem' => 'Add Inventory Item',
        'name' => 'Item Name',
        'category' => 'Category',
        'unit' => 'Unit',
        'thresholdQuantity' => 'Threshold Quantity',
        'addNew' => 'Add New Inventory Item',
        'basicInfo' => 'Basic Information',
        'thresholdSettings' => 'Threshold Settings',
        'thresholdHelp' => 'Set the minimum quantity at which you want to be notified for restocking.',
        'noInventoryItemFound' => 'No Inventory Item Found',
        'editInventoryItem' => 'Edit Inventory Item',
        'deleteInventoryItem' => 'Delete Inventory Item',
        'deleteInventoryItemMessage' => 'Are you sure you want to delete this inventory item?',
        'inventoryItemDeleted' => 'Inventory Item Deleted Successfully',
        'inventoryItemUpdated' => 'Inventory Item Updated Successfully',
        'inventoryItemAdded' => 'Inventory Item Added Successfully',
        'preferredSupplier' => 'Preferred Supplier',
        'preferredSupplierHelp' => 'Required to create a purchase order when the stock level is below the threshold.',
        'reorderQuantity' => 'Auto Reorder Quantity',
        'reorderQuantityPlaceholder' => 'Enter reorder quantity',
    ],
    'itemCategory' => [
        'addItemCategory' => 'Add Item Category',
        'itemCategoryAdded' => 'Item Category Added Successfully',
        'itemCategoryName' => 'Item Category Name',
        'editItemCategory' => 'Edit Item Category',
        'deleteItemCategory' => 'Delete Item Category',
        'deleteItemCategoryMessage' => 'Are you sure you want to delete this item category?',
        'itemCategoryDeleted' => 'Item Category Deleted Successfully',
        'itemCategoryUpdated' => 'Item Category Updated Successfully',
        'noItemCategoryFound' => 'No Item Category Found',
    ],
    'stock' => [
        'addStockEntry' => 'Add Stock Entry',
        'stockInventory' => 'Stock Inventory',
        'stockInventoryDescription' => 'Manage and monitor your restaurant\'s inventory items',
        'addStockEntryDescription' => 'Enter the details to add new stock to inventory',
        'transactionType' => 'Transaction Type',
        'stockIn' => 'Stock In',
        'stockOut' => 'Stock Out',
        'waste' => 'Waste',
        'transfer' => 'Transfer',
        'selectItem' => 'Select Item',
        'quantity' => 'Quantity',
        'selectSupplier' => 'Select Supplier',
        'expiryDate' => 'Expiry Date',
        'wasteReason' => 'Waste Reason',
        'wasteReasonPlaceholder' => 'Enter waste reason',
        'selectBranch' => 'Select Branch',
        'stockEntryAddedSuccessfully' => 'Stock Entry Added Successfully',
        'expiry' => 'Expiry',
        'spoilage' => 'Spoilage',
        'customerComplaint' => 'Customer Complaint',
        'overPreparation' => 'Over Preparation',
        'other' => 'Other',
        'availableItems' => 'Available Items',
        'lowStockItems' => 'Low Stock Items',
        'outOfStock' => 'Out of Stock',
        'searchPlaceholder' => 'Search items...',
        'allCategories' => 'All Categories',
        'allStatus' => 'All Status',
        'inStock' => 'In Stock',
        'lowStock' => 'Low Stock',
        'clearFilters' => 'Clear Filters',
        'noStockItemsFound' => 'No stock items found',
        'currentStock' => 'Current Stock',
        'stockStatus' => 'Stock Status',
        'minStock' => 'Min Stock',
        'actions' => 'Actions',
        'updateStock' => 'Update Stock',
        'needAttention' => 'items need attention',
        'needsImmediate' => 'Needs immediate action',
        'searchItems' => 'Search items by name or category...',
        'noItemsFound' => 'No items found',
        'searchSupplier' => 'Search supplier by name or phone...',
        'items' => 'items in category',
        'below_threshold' => ':count items below threshold',
        'out_of_stock' => ':count items out of stock',
        'status' => [
            'adequate' => 'In Stock',
            'low-stock' => 'Needs Attention',
            'out-of-stock' => 'Critical'
        ],
        'unitPurchasePrice' => 'Unit Purchase Price',
        'expirationDate' => 'Expiration Date',
        'cost' => 'Cost',
        'totalCost' => 'Total Cost',
    ],
    'movements' => [
        'viewMovement' => 'View Movement',
        'editMovement' => 'Edit Movement',
        'title' => 'Kitchen Inventory Movements',
        'add_stock' => 'Add Stock',
        'print_report' => 'Print Report',
        'movementUpdatedSuccessfully' => 'Movement updated successfully',
        // Stats
        'stock_in' => [
            'title' => 'Stock In',
            'subtitle' => 'Total Incoming Stock'
        ],
        'stock_out' => [
            'title' => 'Stock Out',
            'subtitle' => 'Total Outgoing Stock'
        ],
        'waste' => [
            'title' => 'Waste',
            'subtitle' => 'Total Waste Stock'
        ],
        'transfers' => [
            'title' => 'Transfers',
            'subtitle' => 'Total Stock Transfers'
        ],

        // Filters
        'filters' => [
            'search_placeholder' => 'Search ingredients, staff...',
            'all_types' => 'All Types',
            'all_categories' => 'All Categories',
            'clear_filters' => 'Clear Filters',
            'types' => [
                'in' => 'Stock In',
                'out' => 'Stock Out',
                'waste' => 'Waste',
                'transfer' => 'Transfer'
            ],
            'date_ranges' => [
                'today' => 'Today',
                'week' => 'This Week',
                'month' => 'This Month',
                'quarter' => 'This Quarter'
            ]
        ],

        // Table Headers
        'table' => [
            'date_time' => 'Date/Time',
            'item_category' => 'Item & Category',
            'movement' => 'Movement',
            'quantity_unit' => 'Quantity',
            'supplier' => 'Supplier',
            'staff' => 'Added By',
            'actions' => 'Actions'
        ],

        // Loading State
        'loading' => 'Loading...',

        // Empty State
        'no_movements' => 'No inventory movements found',
        'try_adjusting' => 'Try adjusting your search or filter criteria',

        // Messages
        'edit_restriction_message' => 'For audit purposes, only inventory movements from the last 7 days can be edited. Older transactions are read-only.',
        'edit_restriction_tooltip' => 'Only last 7 days movements can be edited <br> <small>For audit purposes</small>',

        'fields' => [
            'quantity' => 'Quantity',
            'date_time' => 'Date & Time',
            'added_by' => 'Added By',
            'supplier' => 'Supplier',
            'waste_reason' => 'Waste Reason',
            'transfer_branch' => 'Transfer Branch',
            'source_branch' => 'Source Branch',
        ],

        'types' => [
            'in' => 'Stock In',
            'out' => 'Stock Out',
            'waste' => 'Waste',
            'transfer' => 'Transfer',
        ],

        'waste_reasons' => [
            'expiry' => 'Expiry',
            'spoilage' => 'Spoilage',
            'customer_complaint' => 'Customer Complaint',
            'over_preparation' => 'Over Preparation',
            'other' => 'Other',
        ],

        'select_supplier' => 'Select Supplier',
        'select_reason' => 'Select Reason',
        'select_branch' => 'Select Branch',
        'update_movement' => 'Update Movement',
    ],
    'recipe' => [
        'title' => 'Recipe Book',
        'add_recipe' => 'Add Recipe',
        'export' => 'Export',
        'search_placeholder' => 'Search recipes...',
        'no_recipes_found' => 'No recipes found',
        'get_started' => 'Get started by creating a new recipe.',

        // Stats
        'stats' => [
            'total_recipes' => 'Total Recipes',
            'main_courses' => 'Main Courses',
            'avg_prep_time' => 'Avg Prep Time',
        ],

        // Filters
        'filters' => [
            'all_categories' => 'All Categories',
            'sort' => [
                'name' => 'Sort by Name',
                'category' => 'Sort by Category',
                'prep_time' => 'Sort by Prep Time',
            ],
            'clear' => 'Clear Filters',
        ],

        // Recipe Details
        'ingredients_required' => 'Ingredients Required',
        'preparation_time' => 'mins',

        'edit_recipe' => 'Edit Recipe',
        'menu_item' => 'Menu Item',
        'select_menu_item' => 'Select Menu Item',
        'ingredients' => 'Ingredients',
        'add_ingredient' => 'Add Ingredient',
        'ingredient' => 'Ingredient',
        'select_ingredient' => 'Select Ingredient',
        'quantity' => 'Quantity',
        'unit' => 'Unit',
        'select_unit' => 'Select Unit',
        'recipe_saved' => 'Recipe saved successfully',
        'recipe_deleted' => 'Recipe deleted successfully',
        'confirm_delete' => 'Are you sure you want to delete this recipe?',
        'delete_recipe' => 'Delete Recipe',
        'ingredients_cost' => 'Ingredients Cost',
    ],
    'purchaseOrder' => [
        'purchase_order' => 'Purchase Order',
        'created_by' => 'Created By',
        'created_at' => 'Created At',
        // Titles & Labels
        'create_title' => 'Create Purchase Order',
        'edit_title' => 'Edit Purchase Order',
        'view_title' => 'View Purchase Order',
        'supplier' => 'Supplier',
        'select_supplier' => 'Select Supplier',
        'order_date' => 'Order Date',
        'expected_delivery_date' => 'Expected Delivery Date',
        'items' => 'Items',
        'add_item' => 'Add Item',
        'select_item' => 'Select Item',
        'quantity' => 'Quantity',
        'unit_price' => 'Unit Price',
        'subtotal' => 'Subtotal',
        'action' => 'Action',
        'remove' => 'Remove',
        'notes' => 'Notes',
        'save' => 'Save',
        'cancel' => 'Cancel',
        'receive_title' => 'Receive Purchase Order',
        'ordered_quantity' => 'Ordered Quantity',
        'previously_received' => 'Previously Received',
        'receiving_quantity' => 'Receiving Quantity',
        'remaining' => 'Remaining',
        'received_quantity' => 'Received Quantity',
        'receive_items' => 'Receive Items',

        // Messages
        'items_received' => 'Items received successfully.',
        'cannot_receive' => 'This purchase order cannot be received.',
        'invalid_quantity' => 'Invalid receiving quantity.',

        // Stats
        'total_orders' => 'Total Orders',
        'pending_orders' => 'Pending Orders',
        'completed_orders' => 'Completed Orders',
        'total_amount' => 'Total Amount',

        // Status
        'status' => [
            'draft' => 'Draft',
            'sent' => 'Sent',
            'received' => 'Received',
            'partially_received' => 'Partially Received',
            'cancelled' => 'Cancelled'
        ],

        // Actions
        'mark_as_sent' => 'Mark as Sent',
        'send' => 'Send',
        'send_title' => 'Send Purchase Order',
        'send_confirm' => 'Are you sure you want to send this purchase order?',
        'sent_successfully' => 'Purchase order sent successfully',
        'cancel' => 'Cancel Order',
        'cancel_title' => 'Cancel Purchase Order',
        'cancel_confirm' => 'Are you sure you want to cancel this purchase order?',
        'cancelled_successfully' => 'Purchase order cancelled successfully',
        'delete_confirm' => 'Are you sure you want to delete this purchase order?',
        'select_item_placeholder' => 'Select an item...',
        'search_items' => 'Search items...',
        'no_items_found' => 'No items found',
        'type_to_search' => 'Type to search items...',
        'loading_items' => 'Loading items...',
        'default_date' => 'Today',
        'search_placeholder' => 'Search by PO number or supplier...',
        'all_suppliers' => 'All Suppliers',
        'all_status' => 'All Status',
        'select_date_range' => 'Select date range',
        'clear_filters' => 'Clear Filters',
        'po_number' => 'PO Number',
        'actions' => 'Actions',
        'edit' => 'Edit',
        'receive' => 'Receive',
        'delete' => 'Delete',
        'view' => 'View',
        'download_pdf' => 'Download PDF',
        'no_records' => 'No purchase orders found',
        'delete_title' => 'Delete Purchase Order',
        'deleted_successfully' => 'Purchase order deleted successfully',
        'saved_successfully' => 'Purchase order saved successfully',
        'auto_purchase_order_notes' => 'Order created automatically by the system',
        'view_all_purchase_orders' => 'View all purchase orders for this supplier',
        'no_purchase_orders' => 'No purchase orders',
        'purchase_order_received' => 'Purchase Order Received: :po_number',
    ],
    'dashboard' => [
        'title' => 'Inventory Dashboard',
        'filters' => [
            'category' => 'Category Filter',
            'all_categories' => 'All Categories',
            'time_period' => 'Time Period',
            'periods' => [
                'daily' => 'Today',
                'weekly' => 'This Week',
                'monthly' => 'This Month'
            ]
        ],
        'stock' => [
            'items' => 'items',
            'below_threshold' => ':count items below threshold',
            'out_of_stock' => ':count items out of stock',
            'status' => [
                'adequate' => 'In Stock',
                'low-stock' => 'Low Stock',
                'out-of-stock' => 'Out of Stock'
            ]
        ],
        'sections' => [
            'top_moving' => [
                'title' => 'Top Moving Inventory Items',
                'stock' => 'Stock',
                'usage' => 'Usage',
                'waste' => 'Waste'
            ],
            'low_stock' => [
                'title' => 'Low Stock Alerts',
                'alerts' => ':count alerts',
                'current' => 'Current',
                'threshold' => 'Threshold',
                'no_items' => 'No low stock items'
            ],
            'correlation' => [
                'title' => 'Usage-Stock Correlation',
                'current_stock' => 'Current Stock',
                'usage' => 'Usage',
                'stock_added' => 'Stock Added'
            ],
            'expiring_stock' => [
                'title' => 'Expiring Stock',
                'items' => 'items',
                'expires_in' => 'Expires in :days days',
                'stock' => 'Stock'
            ]
        ]
    ],
    'reports' => [
        'title' => 'Inventory Reports',
        'tabs' => [
            'usage' => 'Usage Trends',
            'forecasting' => 'Forecasting',
            'turnover' => 'Turnover Rate',
            'cogs' => 'Cost of Goods Sold'
        ],
        'filters' => [
            'period' => 'Report Period',
            'start_date' => 'Start Date',
            'end_date' => 'End Date',
            'search_items' => 'Search Items',
            'search_placeholder' => 'Search by name...',
            'select_item' => 'Select Item',
            'all_items' => 'All Items',
            'forecast_period' => 'Forecast Period',
            'periods' => [
                'daily' => 'Daily',
                'weekly' => 'Weekly',
                'monthly' => 'Monthly',
                'week' => '7 days',
                'fortnight' => '15 days',
                'month' => '30 days',
                'two_months' => '60 days',
                'quarter' => '90 days'
            ],
        ],
        'usage' => [
            'title' => 'Inventory Usage Analysis',
            'description' => 'Monitor and analyze inventory usage patterns to optimize stock management and identify trends.',
            'total_usage' => 'Total Usage',
            'increase' => 'increase',
            'decrease' => 'decrease',
            'trends_title' => 'Usage Trends',
            'item' => 'Item',
            'quantity' => 'Quantity',
            'date' => 'Date',
            'transaction_type' => 'Transaction Type',
            'historical_usage' => 'Historical Usage',
            'current_usage' => 'Current Usage',
            'per_day' => 'per day',
            'export' => 'Export Report',
            'current_period' => 'Current Period',
            'previous_period' => 'Previous Period'
        ],
        'forecasting' => [
            'title' => 'Inventory Usage Forecast',
            'description' => 'Predict future inventory needs based on historical usage patterns and trends.',
            'historical_usage' => 'Historical Usage',
            'forecasted_usage' => 'Forecasted Usage',
            'current_stock' => 'Current Stock',
            'usage_count' => 'Usage Count',
            'avg_daily_usage' => 'Avg Daily Usage',
            'estimated_days' => 'Estimated Days Left',
            'per_day' => 'per day',
            'days_left' => ':days days',
            'item' => 'Item',
            'forecast_analysis' => 'Forecast Analysis',
            'stock_prediction' => 'Stock Prediction',
            'transaction_count' => ':count transaction|:count transactions',
        ],
        'turnover' => [
            'title' => 'Stock Turnover Analysis',
            'description' => 'Track and analyze inventory turnover rates to optimize stock levels and identify slow-moving items.',
            'turnover_rate' => 'Turnover Rate',
            'current_stock' => 'Current Stock',
            'usage_count' => 'Usage Count',
            'avg_turnover' => 'Average Turnover',
            'top_items' => 'Top Items by Turnover',
            'low_turnover' => 'Low Turnover Items',
            'high_turnover' => 'High Turnover Items',
            'transaction_count' => ':count transaction|:count transactions',
        ],
        'cogs' => [
            'title' => 'Cost of Goods Sold (COGS)',
            'description' => 'Analyze the cost of goods sold to optimize inventory management and improve profitability.',
            'total_cost' => 'Total Cost',
            'cost_per_unit' => 'Cost per Unit',
            'total_units' => 'Total Units',
            'total_cost_of_goods_sold' => 'Total Cost of Goods Sold',
            'filters' => [
                'start_date' => 'Start Date',
                'end_date' => 'End Date',
                'category' => 'Category',
                'all_categories' => 'All Categories',
                'generate_report' => 'Generate Report'
            ],
            'table' => [
                'item' => 'Item',
                'category' => 'Category',
                'quantity_used' => 'Quantity Used',
                'total_cost' => 'Total Cost'
            ],
            'summary' => [
                'total_cogs' => 'Total Cost of Goods Sold'
            ]
        ],
        'common' => [
            'no_data' => 'No data available for the selected period',
            'loading' => 'Loading data...',
            'export_pdf' => 'Export PDF',
            'export_excel' => 'Export Excel',
            'print' => 'Print Report',
            'date_range' => 'Date Range',
            'custom_range' => 'Custom Range',
            'apply' => 'Apply',
            'reset' => 'Reset',
            'status' => [
                'critical' => 'Critical',
                'warning' => 'Warning',
                'good' => 'Good'
            ]
        ],
        'stats' => [
            'total_items' => 'Total Items',
            'total_value' => 'Total Value',
            'avg_usage' => 'Average Usage',
            'trend' => 'Trend',
            'comparison' => [
                'up' => 'Up from last period',
                'down' => 'Down from last period',
                'same' => 'Same as last period'
            ]
        ],
        'chart_labels' => [
            'quantity' => 'Quantity',
            'value' => 'Value',
            'date' => 'Date',
            'items' => 'Items',
            'usage' => 'Usage',
            'stock' => 'Stock',
            'forecast' => 'Forecast',
            'trend' => 'Trend'
        ]
    ],
    'settings' => [
        'allowPurchaseOrder' => 'Allow auto Purchase Order',
        'allowPurchaseOrderDescription' => 'Allow purchase order to be created and sent to suppliers automatically.',
    ],
];
