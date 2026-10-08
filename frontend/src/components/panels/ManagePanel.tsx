import { useState } from 'react'
import axios from 'axios'
import type { PlaceResult } from '../MainMap'
import type { LocationRecord, ItemRecord } from '../RestaurantView'
import Tag from '../Tag'
import SavedItem, { type SavedItemData, type NewSavedItemInput } from '../SavedItem'
import cancelIcon from '../../assets/icons/cancel-x.svg'
import checkmarkIcon from '../../assets/icons/checkmark.svg'

interface ManagePanelProps {
    place: PlaceResult
    location: LocationRecord
    items?: SavedItemData[]
    onRemoveFromList?: () => void
    onUpdateRating?: (rating: number | null) => void
    onUpdateDescription?: (description: string) => void
}

// helper — put this above the component (or in a shared utils file)
function formatRating(rating: string | number): string {
    const num = typeof rating === 'string' ? parseFloat(rating) : rating
    // trims trailing zeros: 8.00 -> "8", 7.50 -> "7.5", 7.25 -> "7.25"
    return num.toFixed(2).replace(/\.?0+$/, '')
}

type ItemUpdate = Partial<Pick<SavedItemData, 'name' | 'price' | 'rating' | 'description'>>

function makeTempId(): string {
    return `temp-${crypto.randomUUID()}`
}

function toNumberOrNull(value: number | string | null | undefined): number | null {
    if (value == null || value === '') return null
    const num = typeof value === 'string' ? Number(value) : value
    return Number.isNaN(num) ? null : num
}

function clamp(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value))
}

export function ManagePanel({
    place,
    location,
    items: initialItems = [],
    onRemoveFromList,
    onUpdateRating,
    onUpdateDescription
}: ManagePanelProps) {
    const tags = location.tags ?? []
    const [isHoveringStatus, setIsHoveringStatus] = useState(false)
    const [items, setItems] = useState<SavedItemData[]>(initialItems)
    const [isAddingItem, setIsAddingItem] = useState(false)

    // ---- rating editing (0-10) ----
    const [placeRating, setPlaceRating] = useState<number | null>(toNumberOrNull(location.rating))
    const [ratingDraft, setRatingDraft] = useState('')
    const [editingRating, setEditingRating] = useState(false)

    // ---- notes editing ----
    const [notes, setNotes] = useState(location.description ?? '')
    const [notesDraft, setNotesDraft] = useState('')
    const [editingNotes, setEditingNotes] = useState(false)

    function handleRemoveFromList() {
        // TODO: wire this up to the remove-from-list DELETE request
        onRemoveFromList?.()
        setIsHoveringStatus(false)
    }

    async function handleCreateItem(newItem: NewSavedItemInput) {
        // show the item immediately under a temp id, then swap in the saved row
        const tempId = makeTempId()
        const item: SavedItemData = {
            id: tempId,
            name: newItem.name,
            price: newItem.price,
            rating: newItem.rating,
            tags: [],
            description: newItem.description
        }
        setItems((prev) => [...prev, item])
        setIsAddingItem(false)

        try {
            const res = await axios.post<ItemRecord>('http://localhost:8080/item', {
                location_id: location.id,
                ...newItem
            })
            const saved: SavedItemData = {
                id: res.data.id,
                name: res.data.name,
                price: res.data.price,
                rating: res.data.rating,
                tags: [], // a brand-new item can't have tags applied yet
                description: res.data.description
            }
            setItems((prev) => prev.map((i) => (i.id === tempId ? saved : i)))
        } catch (err) {
            console.error(err)
            setItems((prev) => prev.filter((i) => i.id !== tempId))
        }
    }

    function handleCancelAddItem() {
        setIsAddingItem(false)
    }

    // SavedItem keeps its own display state, so this only persists the change
    // and mirrors it into `items`
    async function handleUpdateItem(id: string, fields: ItemUpdate) {
        setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...fields } : i)))
        // still waiting on POST /item for a real id — nothing to patch yet
        if (id.startsWith('temp-')) return

        try {
            await axios.patch(`http://localhost:8080/item/${id}`, fields)
        } catch (err) {
            console.error(err)
        }
    }

    async function updateLocation(fields: { rating?: number | null; description?: string | null }) {
        await axios.patch(`http://localhost:8080/location/${location.id}`, fields)
    }

    // ---- rating handlers ----
    function handleStartEditRating() {
        setRatingDraft(placeRating != null ? String(placeRating) : '')
        setEditingRating(true)
    }

    async function handleConfirmRating() {
        const trimmed = ratingDraft.trim()
        const finalRating =
            trimmed === '' ? null : Number.isNaN(Number(trimmed)) ? placeRating : clamp(Number(trimmed), 0, 10)
        const previousRating = placeRating
        setPlaceRating(finalRating)
        setEditingRating(false)
        onUpdateRating?.(finalRating)

        try {
            await updateLocation({ rating: finalRating })
        } catch (err) {
            console.error(err)
            setPlaceRating(previousRating)
        }
    }

    function handleCancelRating() {
        setEditingRating(false)
    }

    // ---- notes handlers ----
    function handleStartEditNotes() {
        setNotesDraft(notes)
        setEditingNotes(true)
    }

    async function handleConfirmNotes() {
        const previousNotes = notes
        setNotes(notesDraft)
        setEditingNotes(false)
        onUpdateDescription?.(notesDraft)

        try {
            await updateLocation({ description: notesDraft.trim().length > 0 ? notesDraft : null })
        } catch (err) {
            console.error(err)
            setNotes(previousNotes)
        }
    }

    function handleCancelNotes() {
        setEditingNotes(false)
    }

    return (
        <div className="restaurant-info-main">
            <div className="restaurant-header-row">
                <div className="restaurant-title-group">
                    <h1 className="restaurant-name">{place.name}</h1>
                    {editingRating ? (
                        <div className="rating-block rating-edit-row">
                            <span className="rating-label">Your Rating:</span>
                            <input
                                type="number"
                                className="item-input rating-input"
                                min={0}
                                max={10}
                                step={0.5}
                                placeholder="0-10"
                                value={ratingDraft}
                                onChange={(e) => setRatingDraft(e.target.value)}
                                autoFocus
                            />
                            <span className="rating-label">/10</span>
                            <button
                                type="button"
                                className="icon-btn cancel-icon"
                                aria-label="Cancel rating edit"
                                onClick={handleCancelRating}
                            >
                                <img src={cancelIcon} alt="" />
                            </button>
                            <button
                                type="button"
                                className="icon-btn confirm-icon"
                                aria-label="Confirm rating edit"
                                onClick={handleConfirmRating}
                            >
                                <img src={checkmarkIcon} alt="" />
                            </button>
                        </div>
                    ) : (
                        <div className="rating-block">
                            <span className="rating-label">Your Rating:</span>
                            <span className="rating-value">
                                {placeRating != null ? `${formatRating(placeRating)}/10` : 'not rated'}
                            </span>
                            <button
                                type="button"
                                className="icon-btn edit-icon"
                                aria-label="Edit rating"
                                onClick={handleStartEditRating}
                            >
                                ✎
                            </button>
                        </div>
                    )}
                </div>
                <span
                    className={`status-indicator ${isHoveringStatus ? 'in-list-removing' : 'in-list'} select-none`}
                    onMouseEnter={() => setIsHoveringStatus(true)}
                    onMouseLeave={() => setIsHoveringStatus(false)}
                >
                    {isHoveringStatus ? (
                        <>
                            <span className="confirm-delete-label">Remove from list?</span>
                            <button
                                type="button"
                                className="icon-btn cancel-icon"
                                aria-label="Cancel remove from list"
                                onClick={() => setIsHoveringStatus(false)}
                            >
                                <img src={cancelIcon} alt="" />
                            </button>
                            <button
                                type="button"
                                className="icon-btn confirm-icon"
                                aria-label="Confirm remove from list"
                                onClick={handleRemoveFromList}
                            >
                                <img src={checkmarkIcon} alt="" />
                            </button>
                        </>
                    ) : (
                        'Added to list ✓'
                    )}
                </span>
            </div>

            {place.address != null && <p className="address">{place.address}</p>}

            <div className="tag-panel-section">
                <span className="panel-section-label">Tags</span>
                <div className="location-tags-list">
                    {tags.map((tag) => (
                        <Tag key={tag.id} label={tag.label} category={tag.category} />
                    ))}
                    <button type="button" className="tag-add-btn" aria-label="Add a tag">+</button>
                </div>
            </div>

            <hr className="section-divider" />

            <div className="notes-header-row">
                <span className="panel-section-label">Notes</span>
                {!editingNotes && (
                    <button
                        type="button"
                        className="icon-btn edit-icon"
                        aria-label="Edit notes"
                        onClick={handleStartEditNotes}
                    >
                        ✎
                    </button>
                )}
            </div>

            {editingNotes ? (
                <>
                    <textarea
                        className="restaurant-description field-sizing-content resize-none"
                        placeholder="Add notes here..."
                        value={notesDraft}
                        onChange={(e) => setNotesDraft(e.target.value)}
                        autoFocus
                    />
                    <div className="notes-edit-actions">
                        <button
                            type="button"
                            className="icon-btn cancel-icon"
                            aria-label="Cancel notes edit"
                            onClick={handleCancelNotes}
                        >
                            <img src={cancelIcon} alt="" />
                        </button>
                        <button
                            type="button"
                            className="icon-btn confirm-icon"
                            aria-label="Confirm notes edit"
                            onClick={handleConfirmNotes}
                        >
                            <img src={checkmarkIcon} alt="" />
                        </button>
                    </div>
                </>
            ) : (
                <p className="notes-display">
                    {notes.trim().length > 0 ? notes : 'Add notes here...'}
                </p>
            )}

            <div className="orders-panel-section">
                <span className="orders-label">My Items</span>
                <hr className="section-divider" />
                <div className="saved-items-list">
                    {items.length === 0 && !isAddingItem ? (
                        <p className="empty-items-message">No items logged yet.</p>
                    ) : (
                        items.map((item) => (
                            <SavedItem
                                key={item.id}
                                name={item.name}
                                price={item.price}
                                rating={item.rating}
                                tags={item.tags}
                                description={item.description}
                                onUpdateName={(name) => handleUpdateItem(item.id, { name })}
                                onUpdatePrice={(price) => handleUpdateItem(item.id, { price })}
                                onUpdateRating={(rating) => handleUpdateItem(item.id, { rating })}
                                onUpdateDescription={(description) =>
                                    handleUpdateItem(item.id, {
                                        description: description.trim().length > 0 ? description : null
                                    })
                                }
                            />
                        ))
                    )}
                    {isAddingItem && (
                        <SavedItem
                            isNew
                            onCreate={handleCreateItem}
                            onCancelCreate={handleCancelAddItem}
                        />
                    )}
                    {!isAddingItem && (
                        <button
                            type="button"
                            className="add-new-item-box"
                            onClick={() => setIsAddingItem(true)}
                        >
                            + add a new item
                        </button>
                    )}
                </div>
            </div>

        </div>
    )
}

export default ManagePanel