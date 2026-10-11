import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { fetchTagOptions, groupByCategory, UNCATEGORIZED, type TagOption } from './tagOptions'

export interface TagPickerProps {
    /** Tags already on the location/item — shown checked and not clickable. */
    appliedTagIds: string[]
    /** `category` is the category the tag was picked from (null for uncategorized tags). */
    onSelect: (tag: TagOption, category: string | null) => void
}

// gap between the + button and the menu
const MENU_OFFSET = 4
// keep menus this far from the viewport edges
const VIEWPORT_MARGIN = 8
// matches max-height on .tag-picker-menu / .tag-picker-flyout in App.css
const MENU_MAX_HEIGHT = 260
// matches min-width on .tag-picker-menu / .tag-picker-flyout in App.css
const MENU_MIN_WIDTH = 160

// .tag-picker-flyout border width in App.css (it has no padding)
const FLYOUT_INSET = 2

interface MenuPosition {
    top: number
    left: number
}

interface OpenFlyout {
    category: string
    top: number
    // set one or the other: opens to the right of the menu by default, flips
    // to the left when there isn't room
    left?: number
    right?: number
}

function clampTop(top: number): number {
    return Math.max(VIEWPORT_MARGIN, Math.min(top, window.innerHeight - MENU_MAX_HEIGHT - VIEWPORT_MARGIN))
}

// Dropdown of tag categories; hovering a category flies its tags out to the
// side. Rendered into document.body with fixed positioning so the scrolling
// .info-panel can't clip it.
export function TagPicker({ appliedTagIds, onSelect }: TagPickerProps) {
    const [menuPosition, setMenuPosition] = useState<MenuPosition | null>(null)
    const [flyout, setFlyout] = useState<OpenFlyout | null>(null)
    const [tags, setTags] = useState<TagOption[] | null>(null)
    const [loadError, setLoadError] = useState(false)

    const buttonRef = useRef<HTMLButtonElement>(null)
    const menuRef = useRef<HTMLDivElement>(null)
    const flyoutRef = useRef<HTMLDivElement>(null)

    const open = menuPosition != null

    function close() {
        setMenuPosition(null)
        setFlyout(null)
    }

    function handleToggle() {
        if (open) {
            close()
            return
        }
        const rect = buttonRef.current!.getBoundingClientRect()
        setMenuPosition({
            top: clampTop(rect.bottom + MENU_OFFSET),
            left: Math.min(rect.left, window.innerWidth - MENU_MIN_WIDTH - VIEWPORT_MARGIN),
        })

        setLoadError(false)
        fetchTagOptions()
            .then(setTags)
            .catch((err) => {
                console.error(err)
                setLoadError(true)
            })
    }

    function handleHoverCategory(category: string, row: HTMLElement) {
        const rowRect = row.getBoundingClientRect()
        const menuRect = menuRef.current!.getBoundingClientRect()
        // pull the flyout up by its own border so its first row lines up with this one
        const top = clampTop(rowRect.top - FLYOUT_INSET)
        // overlap the menu's border so the two read as one connected shape
        const fitsRight = menuRect.right + MENU_MIN_WIDTH + VIEWPORT_MARGIN <= window.innerWidth
        setFlyout(
            fitsRight
                ? { category, top, left: menuRect.right - 2 }
                : { category, top, right: window.innerWidth - menuRect.left - 2 }
        )
    }

    function handleSelect(tag: TagOption, category: string) {
        // UNCATEGORIZED is only a display bucket, not a real category
        onSelect(tag, category === UNCATEGORIZED ? null : category)
        close()
    }

    // close on outside click, Escape, and any scroll/resize that would leave
    // the fixed-position menu floating away from its button
    useEffect(() => {
        if (!open) return

        const isInside = (target: EventTarget | null) =>
            target instanceof Node &&
            [buttonRef, menuRef, flyoutRef].some((ref) => ref.current?.contains(target))

        const handleMouseDown = (e: MouseEvent) => {
            if (!isInside(e.target)) close()
        }
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') close()
        }
        // scrolling a long menu itself shouldn't close it
        const handleScroll = (e: Event) => {
            if (!isInside(e.target)) close()
        }

        document.addEventListener('mousedown', handleMouseDown)
        document.addEventListener('keydown', handleKeyDown)
        window.addEventListener('scroll', handleScroll, true)
        window.addEventListener('resize', close)
        return () => {
            document.removeEventListener('mousedown', handleMouseDown)
            document.removeEventListener('keydown', handleKeyDown)
            window.removeEventListener('scroll', handleScroll, true)
            window.removeEventListener('resize', close)
        }
    }, [open])

    const groups = tags ? groupByCategory(tags) : []
    const flyoutTags = flyout ? groups.find((g) => g.category === flyout.category)?.tags ?? [] : []

    return (
        <>
            <button
                ref={buttonRef}
                type="button"
                className={`tag-add-btn${open ? ' is-open' : ''}`}
                aria-label="Add a tag"
                aria-haspopup="menu"
                aria-expanded={open}
                onClick={handleToggle}
            >
                +
            </button>

            {open &&
                createPortal(
                    <>
                        <div ref={menuRef} className="tag-picker-menu" role="menu" style={menuPosition}>
                            {loadError ? (
                                <div className="tag-picker-empty">couldn't load tags</div>
                            ) : tags == null ? (
                                <div className="tag-picker-empty">loading…</div>
                            ) : groups.length === 0 ? (
                                <div className="tag-picker-empty">no tags yet</div>
                            ) : (
                                groups.map(({ category }) => (
                                    <div
                                        key={category}
                                        role="menuitem"
                                        aria-haspopup="menu"
                                        aria-expanded={flyout?.category === category}
                                        className={`tag-picker-row${flyout?.category === category ? ' is-active' : ''}`}
                                        onMouseEnter={(e) => handleHoverCategory(category, e.currentTarget)}
                                        onClick={(e) => handleHoverCategory(category, e.currentTarget)}
                                    >
                                        <span className="tag-picker-label">{category}</span>
                                        <span className="tag-picker-arrow" aria-hidden="true">›</span>
                                    </div>
                                ))
                            )}
                        </div>

                        {flyout && (
                            <div
                                ref={flyoutRef}
                                className="tag-picker-flyout"
                                role="menu"
                                aria-label={flyout.category}
                                style={{ top: flyout.top, left: flyout.left, right: flyout.right }}
                            >
                                {flyoutTags.map((tag) => {
                                    const applied = appliedTagIds.includes(tag.id)
                                    return (
                                        <button
                                            key={tag.id}
                                            type="button"
                                            role="menuitem"
                                            className={`tag-picker-row${applied ? ' is-applied' : ''}`}
                                            disabled={applied}
                                            onClick={() => handleSelect(tag, flyout.category)}
                                        >
                                            <span className="tag-picker-label">{tag.name}</span>
                                            {applied && <span className="tag-picker-check" aria-hidden="true">✓</span>}
                                        </button>
                                    )
                                })}
                            </div>
                        )}
                    </>,
                    document.body
                )}
        </>
    )
}

export default TagPicker
