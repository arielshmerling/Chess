import React, { useState, useEffect } from 'react';
import BookmarkList from './BookmarksList.jsx'; // Import the new component

// Assume getServerInfo, postServerInfo, gameInfo, game, gameMoves, updateMovesTable are available
// You would typically pass these as props to the component:
// function BookmarksPanel({ getServerInfo, postServerInfo, gameInfo, game, gameMoves, updateMovesTable }) {

function BookmarksPanel() {
    const [bookmarks, setBookmarks] = useState([]);
    const [isPanelOpen, setIsPanelOpen] = useState(false);
    const [editingBookmarkId, setEditingBookmarkId] = useState(null);
    const [newBookmarkName, setNewBookmarkName] = useState('');
    const [isAddingNew, setIsAddingNew] = useState(false);

    // Effect to fetch bookmarks when the component mounts
    useEffect(() => {
        const fetchBookmarks = async () => {
            if (typeof getServerInfo !== 'function') {
                console.error("getServerInfo function is not available.");
                return;
            }
            try {
                const fetchedBookmarks = await getServerInfo("/bookmark");
                setBookmarks(Array.isArray(fetchedBookmarks) ? fetchedBookmarks : []);
            } catch (error) {
                console.error("Failed to fetch bookmarks:", error);
                setBookmarks([]);
            }
        };
        fetchBookmarks();
    }, []);

    // Handler to toggle the visibility of the bookmarks panel
    const togglePanel = () => {
        setIsPanelOpen(!isPanelOpen);
        if (isPanelOpen) {
            setEditingBookmarkId(null);
            setIsAddingNew(false);
            setNewBookmarkName('');
        }
    };

    // Handler to show the input field for adding a new bookmark
    const handleAddBookmarkClick = () => {
        setIsAddingNew(true);
        setNewBookmarkName('');
        setEditingBookmarkId(null);
    };

    // Handler to save a new bookmark
    const handleSaveNewBookmark = async () => {
        if (!newBookmarkName.trim()) {
            alert("Bookmark name cannot be empty.");
            return;
        }

        if (typeof postServerInfo !== 'function' || !gameInfo || !game || !gameMoves) {
            console.error("Required dependencies (postServerInfo, gameInfo, game, gameMoves) are not available.");
            return;
        }

        try {
            const state = game.GameState;
            const strMoves = gameMoves.moves.map(m => JSON.stringify(m));
            const newBookmarkData = {
                gameState: state,
                name: newBookmarkName.trim(),
                gameType: gameInfo.gameType,
                moves: strMoves
            };
            const response = await postServerInfo("/bookmark", newBookmarkData);
            console.log("New bookmark saved:", response);

            const fetchedBookmarks = await getServerInfo("/bookmark");
            setBookmarks(Array.isArray(fetchedBookmarks) ? fetchedBookmarks : []);

            setIsAddingNew(false);
            setNewBookmarkName('');
        } catch (error) {
            console.error("Failed to save new bookmark:", error);
            alert("Failed to save bookmark.");
        }
    };

    // Handler to enter edit mode for a specific bookmark
    const handleEditBookmark = (bookmarkId) => {
        setEditingBookmarkId(bookmarkId);
        setIsAddingNew(false);
    };

    // Handler to save the renamed bookmark
    const handleRenameBookmark = async (bookmarkId, newName) => {
        if (!newName.trim()) {
            alert("Bookmark name cannot be empty.");
            setEditingBookmarkId(null);
            return;
        }

        if (typeof postServerInfo !== 'function' || !gameInfo) {
            console.error("Required dependencies (postServerInfo, gameInfo) are not available.");
            setEditingBookmarkId(null);
            return;
        }

        try {
            const bookmarkToUpdate = bookmarks.find(b => b._id === bookmarkId);
            if (!bookmarkToUpdate) {
                console.error("Bookmark not found for renaming:", bookmarkId);
                setEditingBookmarkId(null);
                return;
            }

            const updatedBookmarkData = {
                id: bookmarkToUpdate._id,
                name: newName.trim(),
                gameType: gameInfo.gameType,
                date: new Date()
            };
            const result = await postServerInfo("/updateBookmark", updatedBookmarkData);
            console.log("Bookmark updated:", result);

            setBookmarks(bookmarks.map(b =>
                b._id === bookmarkId ? { ...b, name: newName.trim(), date: new Date() } : b
            ));

            setEditingBookmarkId(null);
        } catch (error) {
            console.error("Failed to rename bookmark:", error);
            alert("Failed to rename bookmark.");
            setEditingBookmarkId(null);
        }
    };

    // Handler to delete a bookmark
    const handleDeleteBookmark = async (bookmarkId) => {
        if (typeof postServerInfo !== 'function') {
            console.error("Required dependency (postServerInfo) is not available.");
            return;
        }

        try {
            const bookmarkToDelete = bookmarks.find(b => b._id === bookmarkId);
            if (!bookmarkToDelete) {
                console.error("Bookmark not found for deletion:", bookmarkId);
                return;
            }

            const result = await postServerInfo("/deleteBookmark", { id: bookmarkToDelete._id });
            console.log("Bookmark deleted:", result);

            if (result === "OK") {
                setBookmarks(bookmarks.filter(b => b._id !== bookmarkId));
            } else {
                console.error("Server reported error deleting bookmark:", result);
                alert("Failed to delete bookmark on the server.");
            }

        } catch (error) {
            console.error("Failed to delete bookmark:", error);
            alert("Failed to delete bookmark.");
        }
    };

    // Handler to load a bookmark's state
    const handleLoadBookmark = async (bookmark) => {
        if (typeof postServerInfo !== 'function' || !gameInfo || !game || typeof updateMovesTable !== 'function') {
            console.error("Required dependencies (postServerInfo, gameInfo, game, updateMovesTable) are not available.");
            return;
        }

        try {
            if (gameInfo.gameType === "SinglePlayerGame") {
                const result = await postServerInfo("/applyBookmark", { gameId: gameInfo.id, bookarkId: bookmark._id });
                console.log("Applying bookmark:", result);
            } else if (bookmark.moves && bookmark.moves.length > 0) {
                const moves = bookmark.moves.map(m => JSON.parse(m));
                game.loadMoves(moves);
                updateMovesTable(moves);
            }
            game.loadGame(bookmark.state);

            setIsPanelOpen(false);

        } catch (error) {
            console.error("Failed to load bookmark:", error);
            alert("Failed to load bookmark.");
        }
    };

    return (
        <div>
            <button onClick={togglePanel}>
                {isPanelOpen ? 'Hide Bookmarks' : 'Show Bookmarks'}
            </button>

            <div className={`bookmarksPanel ${isPanelOpen ? 'open' : ''}`}>
                <h2>Bookmarks</h2>
                <button onClick={handleAddBookmarkClick}>Add Bookmark</button>

                <BookmarkList
                    bookmarks={bookmarks}
                    isAddingNew={isAddingNew}
                    newBookmarkName={newBookmarkName}
                    onNewBookmarkNameChange={setNewBookmarkName}
                    onSaveNewBookmark={handleSaveNewBookmark}
                    editingBookmarkId={editingBookmarkId}
                    onEditBookmark={handleEditBookmark}
                    onRenameBookmark={handleRenameBookmark}
                    onDeleteBookmark={handleDeleteBookmark}
                    onLoadBookmark={handleLoadBookmark}
                    gameInfo={gameInfo} // Pass gameInfo down
                />
            </div>
        </div>
    );
}

export default BookmarksPanel;
