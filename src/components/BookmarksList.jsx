import React from 'react';
import BookmarkItem from './BookmarkItem'; // Import the new component

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


function BookmarkList({
    bookmarks,
    isAddingNew,
    newBookmarkName,
    onNewBookmarkNameChange,
    onSaveNewBookmark,
    editingBookmarkId,
    onEditBookmark,
    onRenameBookmark,
    onDeleteBookmark,
    onLoadBookmark,
    gameInfo // Assuming gameInfo is needed for the new bookmark entry
}) {
    return (
        <div className="bookmarksList">
            {/* Input for adding new bookmark - conditionally rendered */}
            {isAddingNew && (
                <div className="bookmark newBookmark">
                    <div className="bookmarkHeader">
                        <div>{formatDate(new Date())}</div>
                        <div>{gameInfo?.gameType}</div> {/* Use optional chaining */}
                    </div>
                    <input
                        type="text"
                        placeholder="Insert bookmark name"
                        value={newBookmarkName}
                        onChange={(e) => onNewBookmarkNameChange(e.target.value)}
                        onKeyPress={(e) => {
                            if (e.key === 'Enter') {
                                onSaveNewBookmark();
                            }
                        }}
                        autoFocus
                    />
                    <button onClick={onSaveNewBookmark}>Save</button>
                </div>
            )}

            {/* List of existing bookmarks */}
            {bookmarks.map(bookmark => (
                <BookmarkItem
                    key={bookmark._id}
                    bookmark={bookmark}
                    isEditing={editingBookmarkId === bookmark._id}
                    onEditClick={onEditBookmark}
                    onRenameBookmark={onRenameBookmark}
                    onDeleteClick={onDeleteBookmark}
                    onLoadClick={onLoadBookmark}
                // Pass ref if needed for auto-focus in BookmarkItem,
                // but BookmarkItem now manages its own ref internally based on isEditing
                />
            ))}
        </div>
    );
}

export default BookmarkList;
