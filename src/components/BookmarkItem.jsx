import React, { useRef, useEffect, useState } from 'react';

// Utility function to format date (can be moved outside the component or imported)
const formatDate = (dateString) => {
    const today = new Date(dateString);
    const yyyy = today.getFullYear();
    let mm = today.getMonth() + 1; // Months start at 0!
    let dd = today.getDate();

    if (dd < 10) { dd = "0" + dd; }
    if (mm < 10) { mm = "0" + mm; }

    const time = today.toLocaleTimeString(undefined, { hour12: false });
    return `${dd}/${mm}/${yyyy} ${time}`;
};

function BookmarkItem({
    bookmark,
    isEditing,
    onEditClick,
    onRenameBookmark,
    onDeleteClick,
    onLoadClick
}) {
    const [editedName, setEditedName] = useState(bookmark.name);
    const editInputRef = useRef(null);

    // Effect to focus the input when editing starts for this specific item
    useEffect(() => {
        if (isEditing && editInputRef.current) {
            editInputRef.current.focus();
            editInputRef.current.select();
        }
    }, [isEditing]);

    const handleKeyPress = (e) => {
        if (e.key === 'Enter') {
            onRenameBookmark(bookmark._id, editedName);
        }
    };

    const handleBlur = () => {
        // Auto-save on blur
        onRenameBookmark(bookmark._id, editedName);
    };

    return (
        <div
            key={bookmark._id}
            className={`bookmark ${isEditing ? 'editing' : ''}`}
            onClick={() => onLoadClick(bookmark)} // Load bookmark when the div is clicked
        >
            <div className="bookmarkHeader">
                <div>{formatDate(bookmark.date)}</div>
                <div>{bookmark.gameType}</div>
            </div>
            <div className="bookmarkNameWrapper">
                {isEditing ? (
                    <input
                        type="text"
                        value={editedName}
                        onChange={(e) => setEditedName(e.target.value)}
                        onKeyPress={handleKeyPress}
                        onBlur={handleBlur}
                        ref={editInputRef}
                    />
                ) : (
                    <div
                        className="bookmarkName"
                        onClick={(e) => {
                            e.stopPropagation(); // Prevent loading when clicking the name
                            onEditClick(bookmark._id);
                        }}
                    >
                        {bookmark.name}
                    </div>
                )}
            </div>
            <div className="bookmarkActions">
                {/* Add Edit and Delete buttons */}
                {!isEditing && ( // Hide buttons while editing
                    <>
                        <button onClick={(e) => {
                            e.stopPropagation(); // Prevent loading
                            onEditClick(bookmark._id);
                        }}>Edit</button>
                        <button onClick={(e) => {
                            e.stopPropagation(); // Prevent loading
                            onDeleteClick(bookmark._id);
                        }}>Delete</button>
                    </>
                )}
            </div>
        </div>
    );
}

export default BookmarkItem;
