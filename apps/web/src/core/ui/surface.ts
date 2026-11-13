/**
 * How every raised plane draws itself: a real border and one lift.
 *
 * A border, not a ring. A `ring` paints outside the border box, so any scroll ancestor clips
 * it. An `inset-ring` is an inset shadow, which child backgrounds paint straight over. A
 * border sits outside the padding box: nothing inside can cover it, nothing outside can clip
 * it. It costs 1px of layout, and that is fine precisely because every plane wears it, so
 * they all inset their content by the same pixel and headings still line up across panes.
 *
 * Highlighting a plane, say as a drop target, is `data-accent="true"` and nothing else. Every
 * other technique loses a pixel: positioned children (sticky headers, pinned cells, absolutely
 * placed rows) paint over an outline, a ring and an inset shadow alike, in every engine. Only
 * two bands are safe, so the accent uses both: the border, which no descendant can reach, and
 * a frame above the content. The accent brings its own `relative`, so a plane that places
 * itself keeps its own position until it lights up.
 */
export const planeClasses =
    'border shadow-lg data-[accent=true]:relative data-[accent=true]:border-primary data-[accent=true]:after:pointer-events-none data-[accent=true]:after:absolute data-[accent=true]:after:inset-0 data-[accent=true]:after:z-10 data-[accent=true]:after:border data-[accent=true]:after:border-primary'

/**
 * A raised plane. The navigation panel, the table and the detail pane all wear this one
 * string, so they cannot drift apart.
 */
export const surfaceClasses = `surface pointer-events-auto bg-card text-card-foreground ${planeClasses}`

/**
 * The same plane with its chrome removed: no fill, no border, no lift. Content sits straight
 * on the page background, and only the controls inside it draw their own edges.
 */
export const flatSurfaceClasses = 'surface pointer-events-auto'
