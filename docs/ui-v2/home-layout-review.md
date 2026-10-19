# Home — Hero Dashboard + Bento layout review

Historical Home-only stage; the user subsequently authorized [all customer layouts](layout-system-review.md).

Scope at that stage: the first screen in the supplied layout sequence. Stop after Home review; discovery, service detail, booking, payment, tracking, chat and profile layouts are not changed by this pass.

## Layout decisions

- Compact OTOCH header and greeting from the existing stored user object. No fabricated user details.
- Prominent care hero using the existing brand palette/illustration at reduced intensity. Duplicate explanatory copy is removed; service selection instructions remain in the service section.
- One primary care CTA in a fixed footer above the existing bottom tabs. The exact existing handler still resets the booking draft and opens `/booking/catalog`.
- Urgent-care guidance is directly below the hero. It states that OTOCH is not an emergency service and retains the direct `tel:103` action. It never creates an emergency booking/SOS flow.
- Actual active booking from the unchanged orders API/filter; same order-detail destination. Empty and error states retained.
- Existing four service groups appear as a two-column bento grid at widths >=380 and fontScale <1.3; smaller/large-type screens use one column. All groups and route parameters remain. No invented price/duration on category cards.
- No carousel: the current Home has no supported secondary guidance/package/recent-services dataset. Essential actions remain visible.
- Existing four navigation destinations retained; no fake Chat tab, nurse selection or unsupported filters.

## Implementation boundary

`App/app/(tabs)/index.tsx` contains the Home layout changes. `Screen` in `App/components/ui/index.tsx` gains an optional footer slot; callers without a footer keep the same default layout/padding. Home alone uses the slot. No API/service/model/backend changes.

## Checks

Typecheck and cache-free lint PASS, 222/222 regression PASS, iOS/Android/web export PASS. Browser uses synthetic session + mock HTTP: 320/390/768px with no horizontal overflow/runtime errors, CTA stays at the same y-coordinate after scrolling, new-booking/category/order navigation and error state pass. The `tel:103` handler is checked in source; no real phone call is executed.

Native font scaling/safe area and real device acceptance remain pending. This is a visual implementation/review result, not production or full backend acceptance. No commit/push/merge in this pass.
