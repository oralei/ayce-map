import axios from 'axios'

// shape of a row from GET /tags — every tag a user can pick from
export interface TagOption {
    id: string // bigint serialized as string — see prisma.ts BigInt.toJSON shim
    name: string
    categories: string[]
}

export interface TagCategoryGroup {
    category: string
    tags: TagOption[]
}

// bucket for tags that don't list any category
export const UNCATEGORIZED = 'other'

// one shared request for every picker on the page; cleared on failure so the
// next picker that opens can retry
let tagOptionsRequest: Promise<TagOption[]> | null = null

export function fetchTagOptions(): Promise<TagOption[]> {
    if (!tagOptionsRequest) {
        tagOptionsRequest = axios
            .get<{ tags: TagOption[] }>('http://localhost:8080/tags')
            .then((res) => res.data.tags)
            .catch((err) => {
                tagOptionsRequest = null
                throw err
            })
    }
    return tagOptionsRequest
}

// A tag shows up under every category it lists, so the same tag can appear
// in more than one group. Categories are alphabetical with UNCATEGORIZED last.
export function groupByCategory(tags: TagOption[]): TagCategoryGroup[] {
    const groups = new Map<string, TagOption[]>()
    for (const tag of tags) {
        const categories = tag.categories.length > 0 ? tag.categories : [UNCATEGORIZED]
        for (const category of categories) {
            const group = groups.get(category)
            if (group) group.push(tag)
            else groups.set(category, [tag])
        }
    }

    return [...groups.entries()]
        .map(([category, groupTags]) => ({ category, tags: groupTags }))
        .sort((a, b) => {
            if (a.category === UNCATEGORIZED) return 1
            if (b.category === UNCATEGORIZED) return -1
            return a.category.localeCompare(b.category)
        })
}
