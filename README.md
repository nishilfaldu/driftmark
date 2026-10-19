# driftmark

The site at [driftmark.nishilfaldu.site](https://driftmark.nishilfaldu.site) shows two pull requests to [vercel/streamdown](https://github.com/vercel/streamdown):

- [#685](https://github.com/vercel/streamdown/pull/685) `fix(remend): complete links only in the current block`. A stray `[` in an earlier paragraph no longer adds junk to later text, or hides it.
- [#689](https://github.com/vercel/streamdown/pull/689) `perf(streamdown): repair only the end of a streaming message`. Each update repairs only the last two blocks. It is stacked on [#670](https://github.com/vercel/streamdown/pull/670) and #685.

`prs/` holds each pull request's description and patch.

## The site

A static page with no build step: `index.html`, `styles.css` and `app.js`. The demos run the real code from `vendor/`:

| File | Built from |
| --- | --- |
| `remend-main.js` | `packages/remend/src` at upstream `main` (8b0ca9f) |
| `remend-pr685.js` | `packages/remend/src` at #685 (61ee07e) |
| `tail-repair.js` | `repairStream`, `advanceStableLength` and `parseMarkdownIntoBlocks` from `packages/streamdown`, with that branch's remend, at #689 (43c6616) |
| `marked.js` | marked 18.0.11 |

Each file is an esbuild bundle (`--bundle --format=esm --minify`). To preview, serve the folder, for example `python3 -m http.server`.
