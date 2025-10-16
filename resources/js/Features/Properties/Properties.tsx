import React from "react";

const Properties = () => {
    return (
        <div>
            {/* Let's describe the UI */}
            {/* There will be a page layout */}
            {/* Page layout will accept - title, and breadcrumb(which will be an array) */}
            {/* now the children components will be rendered inside the layout */}
            {/* first of we will have the filters */}
            <div>
                {/* Developer, Developer Project, Property Status and other filters which will be a drawer containing the following - Property Type, Location, Price Range , etc.*/}
            </div>
            {/* it will also have the following above - Add Property, Import, Now the will also be a bulk action that will only show up when items are selected, now this which will be a dropdown of the action and an accompanying button to apply the action*/}
            {/* a table showing the list of properties, it  will contain a max of 6 columns and an action column*/}
            {/* The bulk action will include delete, assign to developer project, ... */}
            {/* The action column will be a dropdown that includes view, edit, ... */}
        </div>
    );
};

export default Properties;
