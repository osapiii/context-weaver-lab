# Recording Pipeline Status — Design QA

## Reference

- Source: `codex-clipboard-30f4f294-eb9d-4a2b-9474-d14dd47e6dcb.png`
- Target: replace the low-information accordion list with a two-column master/detail operations view.

## Implemented checks

- Two-column layout with a responsive stacked fallback.
- Left-side job selection, source recording preview, scanning state, and generated clip rollup.
- Right-side current-operation emphasis, always-visible 12-step status grid, counters, and live terminal.
- Visually distinct completed, processing, pending, skipped, partial-error, and error states.
- Selecting a job updates the video, step details, retry actions, and subscribed event stream.
- Source video resolves from the pipeline `sourceGcsUri` through Firebase Storage.
- Targeted ESLint passed and Nuxt static generation completed.

## Visual verification

- Firebase Hosting preview and development Hosting both deployed successfully.
- In-app browser reached the development sign-in page.
- Development authentication failed with a Firebase network request error before the StoryVault screen could render.
- Because the authenticated modal could not be captured, same-state visual comparison and viewport polish remain blocked.

## Remaining QA

- Capture the open status modal at desktop width after authentication succeeds.
- Confirm the scan line remains within the video frame.
- Confirm the 12-step grid, terminal height, and long Japanese titles at the actual modal width.
- Check the stacked layout at the tablet breakpoint.

final result: blocked
