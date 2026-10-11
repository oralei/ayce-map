import { useState } from 'react'
import Tag from './Tag'
import TagPicker from './TagPicker'
import type { TagChipData } from './tagCategories'
import type { TagOption } from './tagOptions'
import trashIcon from '../assets/icons/trash.svg'
import cancelIcon from '../assets/icons/cancel-x.svg'
import checkmarkIcon from '../assets/icons/checkmark.svg'

// Shape used wherever a list of order-history items is passed around
// (fetched data, props) — mirrors the `items` table plus its tags.
export interface SavedItemData {
    id: string
    name: string
    price?: number | string | null
    rating?: number | string | null
    tags?: TagChipData[]
    description: string | null
}

// Payload handed back from a "new item" draft once the user confirms it.
export interface NewSavedItemInput {
    name: string
    rating: number | null
    price: number | null
    description: string | null
}

export interface SavedItemProps {
    name?: string
    price?: number | string | null
    rating?: number | string | null
    tags?: TagChipData[]
    description?: string | null
    /** Render as an empty, fully-editable draft with a confirm/cancel footer instead of a saved item. */
    isNew?: boolean
    onDelete?: () => void
    onUpdateName?: (name: string) => void
    onUpdateRating?: (rating: number | null) => void
    onUpdatePrice?: (price: number | null) => void
    onUpdateDescription?: (description: string) => void
    onAddTag?: (tag: TagOption, category: string | null) => void
    onRemoveTag?: (tagId: string) => void
    onCreate?: (item: NewSavedItemInput) => void
    onCancelCreate?: () => void
}

function formatPrice(price: SavedItemProps['price']): string | null {
    if (price == null || price === '') return null
    const value = typeof price === 'string' ? Number(price) : price
    return Number.isNaN(value) ? null : `$${value.toFixed(2)}`
}

function formatRating(rating: number): string {
    // trims trailing zeros: 8.00 -> "8", 7.50 -> "7.5"
    return rating.toFixed(2).replace(/\.?0+$/, '')
}

function toNumberOrNull(value: number | string | null | undefined): number | null {
    if (value == null || value === '') return null
    const num = typeof value === 'string' ? Number(value) : value
    return Number.isNaN(num) ? null : num
}

function clamp(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value))
}

export function SavedItem({
    name = 'Item name',
    price = null,
    rating = null,
    tags = [{ id: 'placeholder-tag', label: 'tag' }],
    description = 'Placeholder notes...',
    isNew = false,
    onDelete,
    onUpdateName,
    onUpdateRating,
    onUpdatePrice,
    onUpdateDescription,
    onAddTag,
    onRemoveTag,
    onCreate,
    onCancelCreate
}: SavedItemProps) {
    const [confirmingDelete, setConfirmingDelete] = useState(false)

    // ---- title (name) editing ----
    const [itemName, setItemName] = useState(isNew ? '' : name)
    const [nameDraft, setNameDraft] = useState(name)
    const [editingName, setEditingName] = useState(false)

    // ---- rating editing (0-10) ----
    const [itemRating, setItemRating] = useState<number | null>(isNew ? null : toNumberOrNull(rating))
    const [ratingDraft, setRatingDraft] = useState('')
    const [editingRating, setEditingRating] = useState(false)

    // ---- price editing ----
    const [itemPrice, setItemPrice] = useState<number | null>(isNew ? null : toNumberOrNull(price))
    const [priceDraft, setPriceDraft] = useState('')
    const [editingPrice, setEditingPrice] = useState(false)

    // ---- notes editing ----
    const [notes, setNotes] = useState(isNew ? '' : (description ?? ''))
    const [notesDraft, setNotesDraft] = useState(description ?? '')
    const [editingNotes, setEditingNotes] = useState(false)

    const formattedPrice = formatPrice(itemPrice)

    function handleConfirmDelete() {
        onDelete?.()
        setConfirmingDelete(false)
    }

    // ---- name handlers ----
    function handleStartEditName() {
        setNameDraft(itemName)
        setEditingName(true)
    }

    function handleConfirmName() {
        const trimmed = nameDraft.trim()
        const finalName = trimmed.length > 0 ? trimmed : itemName
        setItemName(finalName)
        setEditingName(false)
        // TODO: wire this up to the update-item PATCH request
        onUpdateName?.(finalName)
    }

    function handleCancelName() {
        setEditingName(false)
    }

    // ---- rating handlers ----
    function handleStartEditRating() {
        setRatingDraft(itemRating != null ? String(itemRating) : '')
        setEditingRating(true)
    }

    function handleConfirmRating() {
        const trimmed = ratingDraft.trim()
        const finalRating =
            trimmed === '' ? null : Number.isNaN(Number(trimmed)) ? itemRating : clamp(Number(trimmed), 0, 10)
        setItemRating(finalRating)
        setEditingRating(false)
        // TODO: wire this up to the update-item PATCH request
        onUpdateRating?.(finalRating)
    }

    function handleCancelRating() {
        setEditingRating(false)
    }

    function handleNewRatingChange(raw: string) {
        if (raw === '') {
            setItemRating(null)
            return
        }
        const num = Number(raw)
        if (!Number.isNaN(num)) setItemRating(clamp(num, 0, 10))
    }

    // ---- price handlers ----
    function handleStartEditPrice() {
        setPriceDraft(itemPrice != null ? String(itemPrice) : '')
        setEditingPrice(true)
    }

    function handleConfirmPrice() {
        const trimmed = priceDraft.trim()
        const finalPrice =
            trimmed === '' ? null : Number.isNaN(Number(trimmed)) ? itemPrice : Math.max(0, Number(trimmed))
        setItemPrice(finalPrice)
        setEditingPrice(false)
        // TODO: wire this up to the update-item PATCH request
        onUpdatePrice?.(finalPrice)
    }

    function handleCancelPrice() {
        setEditingPrice(false)
    }

    function handleNewPriceChange(raw: string) {
        if (raw === '') {
            setItemPrice(null)
            return
        }
        const num = Number(raw)
        if (!Number.isNaN(num)) setItemPrice(Math.max(0, num))
    }

    // ---- notes handlers ----
    function handleStartEditNotes() {
        setNotesDraft(notes)
        setEditingNotes(true)
    }

    function handleConfirmNotes() {
        setNotes(notesDraft)
        setEditingNotes(false)
        // TODO: wire this up to the update-item PATCH request
        onUpdateDescription?.(notesDraft)
    }

    function handleCancelNotes() {
        setEditingNotes(false)
    }

    // ---- new item (create) handler ----
    function handleConfirmCreate() {
        const trimmedName = itemName.trim()
        if (trimmedName.length === 0) return
        onCreate?.({
            name: trimmedName,
            rating: itemRating,
            price: itemPrice,
            description: notes.trim().length > 0 ? notes : null
        })
    }

    return (
        <div className="saved-item">
            <div className="saved-item-main">
                {isNew || editingName ? (
                    <>
                        <input
                            type="text"
                            className="item-input saved-item-name-input"
                            placeholder="Item name"
                            value={isNew ? itemName : nameDraft}
                            onChange={(e) => (isNew ? setItemName(e.target.value) : setNameDraft(e.target.value))}
                            autoFocus
                        />
                        {!isNew && (
                            <>
                                <button
                                    type="button"
                                    className="icon-btn cancel-icon"
                                    aria-label="Cancel name edit"
                                    onClick={handleCancelName}
                                >
                                    <img src={cancelIcon} alt="" />
                                </button>
                                <button
                                    type="button"
                                    className="icon-btn confirm-icon"
                                    aria-label="Confirm name edit"
                                    onClick={handleConfirmName}
                                >
                                    <img src={checkmarkIcon} alt="" />
                                </button>
                            </>
                        )}
                    </>
                ) : (
                    <>
                        <span className="saved-item-name">{itemName}</span>
                        <button
                            type="button"
                            className="icon-btn edit-icon"
                            aria-label="Edit name"
                            onClick={handleStartEditName}
                        >
                            ✎
                        </button>
                    </>
                )}

                <div className="saved-item-actions">
                    {!isNew &&
                        (confirmingDelete ? (
                            <>
                                <span className="confirm-delete-label">Remove item?</span>
                                <button
                                    type="button"
                                    className="icon-btn cancel-icon"
                                    aria-label="Cancel remove"
                                    onClick={() => setConfirmingDelete(false)}
                                >
                                    <img src={cancelIcon} alt="" />
                                </button>
                                <button
                                    type="button"
                                    className="icon-btn confirm-icon"
                                    aria-label="Confirm remove"
                                    onClick={handleConfirmDelete}
                                >
                                    <img src={checkmarkIcon} alt="" />
                                </button>
                            </>
                        ) : (
                            <button
                                type="button"
                                className="icon-btn"
                                aria-label="Remove item"
                                onClick={() => setConfirmingDelete(true)}
                            >
                                <img src={trashIcon} alt="" />
                            </button>
                        ))}
                </div>
            </div>

            <div className="rating-price-row">
                {isNew || editingRating ? (
                    <div className="item-mini-block rating-edit-row">
                        <span className="rating-label">★ Your Rating:</span>
                        <input
                            type="number"
                            className="item-input rating-input"
                            min={0}
                            max={10}
                            step={0.5}
                            placeholder="0-10"
                            value={isNew ? (itemRating ?? '') : ratingDraft}
                            onChange={(e) =>
                                isNew ? handleNewRatingChange(e.target.value) : setRatingDraft(e.target.value)
                            }
                            autoFocus={!isNew}
                        />
                        <span className="rating-label">/10</span>
                        {!isNew && (
                            <>
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
                            </>
                        )}
                    </div>
                ) : (
                    <div className="item-mini-block">
                        <span className="rating-label">★ Your Rating: </span>
                        <span className="rating-label">
                            {itemRating != null ? `${formatRating(itemRating)}/10` : 'not rated'}
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

                {isNew || editingPrice ? (
                    <div className="item-mini-block price-edit-row">
                        <span className="rating-label">Price: $</span>
                        <input
                            type="number"
                            className="item-input price-input"
                            min={0}
                            step={0.01}
                            placeholder="0.00"
                            value={isNew ? (itemPrice ?? '') : priceDraft}
                            onChange={(e) =>
                                isNew ? handleNewPriceChange(e.target.value) : setPriceDraft(e.target.value)
                            }
                            autoFocus={!isNew}
                        />
                        {!isNew && (
                            <>
                                <button
                                    type="button"
                                    className="icon-btn cancel-icon"
                                    aria-label="Cancel price edit"
                                    onClick={handleCancelPrice}
                                >
                                    <img src={cancelIcon} alt="" />
                                </button>
                                <button
                                    type="button"
                                    className="icon-btn confirm-icon"
                                    aria-label="Confirm price edit"
                                    onClick={handleConfirmPrice}
                                >
                                    <img src={checkmarkIcon} alt="" />
                                </button>
                            </>
                        )}
                    </div>
                ) : (
                    <div className="item-mini-block">
                        <span className="rating-label">
                            {formattedPrice != null ? `Price: ${formattedPrice}` : 'Price: not set'}
                        </span>
                        <button
                            type="button"
                            className="icon-btn edit-icon"
                            aria-label="Edit price"
                            onClick={handleStartEditPrice}
                        >
                            ✎
                        </button>
                    </div>
                )}
            </div>

            {!isNew && (
                <>
                    <span className="panel-section-label">Tags</span>
                    <div className="saved-item-tags">
                        {tags.map((tag) => (
                            <Tag
                                key={tag.id}
                                label={tag.label}
                                category={tag.category}
                                onRemove={() => onRemoveTag?.(tag.id)}
                            />
                        ))}
                        <TagPicker
                            appliedTagIds={tags.map((tag) => tag.id)}
                            onSelect={(tag, category) => onAddTag?.(tag, category)}
                        />
                    </div>
                </>
            )}

            <hr className="section-divider" />

            <div className="notes-header-row">
                <span className="panel-section-label">Notes</span>
                {!isNew && !editingNotes && (
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

            {isNew || editingNotes ? (
                <>
                    <textarea
                        className="item-input field-sizing-content resize-none"
                        placeholder="Add notes here..."
                        value={isNew ? notes : notesDraft}
                        onChange={(e) => (isNew ? setNotes(e.target.value) : setNotesDraft(e.target.value))}
                        autoFocus={!isNew}
                    />
                    {!isNew && (
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
                    )}
                </>
            ) : (
                <p className="notes-display">
                    {notes.trim().length > 0 ? notes : 'Add notes here...'}
                </p>
            )}

            {isNew && (
                <div className="new-item-footer">
                    <span className="new-item-label">Add this item?</span>
                    <button
                        type="button"
                        className="icon-btn cancel-icon"
                        aria-label="Cancel new item"
                        onClick={onCancelCreate}
                    >
                        <img src={cancelIcon} alt="" />
                    </button>
                    <button
                        type="button"
                        className="icon-btn confirm-icon"
                        aria-label="Confirm new item"
                        onClick={handleConfirmCreate}
                    >
                        <img src={checkmarkIcon} alt="" />
                    </button>
                </div>
            )}
        </div>
    )
}

export default SavedItem