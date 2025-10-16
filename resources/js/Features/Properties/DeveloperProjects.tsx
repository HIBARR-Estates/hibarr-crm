import React from "react";

const DeveloperProjects = () => {
    return (
        <div>
            {/* Will use page layout and will be similar to properties layout */}
            {/* Now the children components will be rendered inside the layout */}
            {/* first of we will have the filters */}
            <div>
                {/* Developer, Developer Project, Property Status and other filters which will be a drawer containing the following - Property Type, Location, Price Range , etc.*/}
            </div>
            {/* it will also have the following above - Add Developer Project, Import, Now the will also be a bulk action that will only show up when items are selected, now this which will be a dropdown of the action and an accompanying button to apply the action*/}
            {/* a table showing the list of developer projects, it  will contain a max of 6 columns and an action column*/}
            {/* The bulk action will include delete, assign to developer , ... */}
            {/* The action column will be a dropdown that includes view, edit, ... */}
        </div>
    );
};

export default DeveloperProjects;
