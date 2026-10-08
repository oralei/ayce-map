// Shapes a joined `tags` row into the { id, label, category } chip shape the
// frontend's Tag component expects. item_tags carries its own optional
// `category` override (e.g. the same tag can read differently per item);
// location_tags has no such override, so it always falls back to the tag's
// own first category.
export function toTagChipData(
    tag: { id: bigint; name: string; categories: string[] },
    categoryOverride?: string | null
) {
    return {
        id: tag.id,
        label: tag.name,
        category: categoryOverride ?? tag.categories[0] ?? null,
    }
}
 
