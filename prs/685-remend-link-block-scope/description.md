## Description

remend completes an unclosed `[` or `](` anywhere in the message. But link text can't continue past the end of a paragraph, list item, heading or table row. So a bracket left in an earlier one breaks the text after it: `](streamdown:incomplete-link)` is added to the end of the text, or everything after the bracket is dropped. The damage stays after the stream ends: with the default `mode="streaming"`, remend runs whether or not the message is still streaming.

This PR completes links and images only in the current block: the paragraph, list item, heading or table row at the end of the text.

<img width="2560" height="1550" alt="remend-link-block-scope" src="https://github.com/user-attachments/assets/3c4014da-cbf8-44cb-a7c1-04401922e4d1" />

## Type of Change

- [x] Bug fix (non-breaking change which fixes an issue)

## Related Issues

Related to #670, which fixes the same problem for bold and italic, not links. This PR is independent and can merge before or after it. If #670 merges first, I'll resolve the conflict in `link-image-handler.ts`.

## Changes Made

- New `findLastInlineBlockStart` finds where the current block starts. It reads backwards from the end and stops at the first blank line, fence, thematic break, heading, list item, or table row, so its cost depends only on the last block.
- When remend looks for an unfinished link or image to complete, it now treats any `[` or `](` before that point as plain text.

## Testing

- [x] All existing tests pass
- [x] Added new tests for the changes: `link-block-scope.test.ts`, 8 tests. 7 fail on `main`; the 8th checks that normal links still complete.
- [x] Manually tested the changes

## Checklist

- [x] My code follows the project's code style
- [x] I have performed a self-review of my own code
- [x] I have commented my code, particularly in hard-to-understand areas
- [ ] I have made corresponding changes to the documentation (not needed)
- [x] My changes generate no new warnings or errors
- [x] I have added tests that prove my fix is effective or that my feature works
- [x] New and existing unit tests pass locally with my changes
- [x] I have created a changeset (`pnpm changeset`)
- [x] All my commits are [signed](https://github.com/vercel/streamdown/blob/main/CONTRIBUTING.md#signing-commits)

## Changeset

- [x] I have created a changeset for these changes

