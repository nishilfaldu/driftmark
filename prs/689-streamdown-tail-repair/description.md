> **Stacked on #670 and #685.** Only the last two commits are new: [perf(streamdown): repair only the end of a streaming message](https://github.com/nishilfaldu/streamdown/commit/43c6616e69aefcaab0285c700d8cbe844a59c4b4) and [fix(streamdown): repair the whole message where remend reads all of it](https://github.com/nishilfaldu/streamdown/commit/a785125). Please review those commits. The commit before it is #685, adapted to #670. I'll rebase onto `main` once both merge.

## Description

On every streaming update, Streamdown runs remend over the whole message, plus three regex checks for footnotes and link definitions. So each update costs more than the one before.

With #670 and #685, remend only completes syntax in the last block. For example, it adds the closing `**` to `Two **bold`. It does not change the blocks before it. So the repair of those blocks is wasted work.

This PR repairs only the end of the message: the last two blocks. `parseMarkdownIntoBlocks` already treats at least the last two blocks as still open, and never reuses them from its cache. Streamdown remembers where the blocks before them end (the stable length) and does not repair that text again. The three checks scan only the end of the text.

<img width="1960" height="950" alt="streamdown-tail-repair-window" src="https://github.com/user-attachments/assets/b950c553-e5a0-40c8-a284-9d22e54e51fe" />

In a 20,000-token answer sent 8 tokens per update, the last update repairs 128 characters instead of 84,840:

<img width="2560" height="794" alt="streamdown-tail-repair-chars" src="https://github.com/user-attachments/assets/20087aa5-5330-4209-a90a-1cca355173ed" />

## Type of Change

- [x] Performance improvement

## Related Issues

Depends on #670 and #685. Repairing only the end gives the same output as repairing everything only when remend completes syntax in the current block alone. #670 does this for bold and italic, #685 for links.

The changeset check fails on #670's `minor` changeset, as it does on #670 itself.

## Changes Made

- New `lib/stream-repair.ts`. Each message keeps a stable length: the end of every block except the last two. Later updates repair only the text after it, and put the kept text in front.
- The stable length moves forward only on an update where remend changed nothing. Two texts exist on each update: the text the model sent, and the repaired text. Streamdown splits the repaired text into blocks. Remend can add a closer that the block parser reads as a new block. For example, after `# Three [link` and a newline, it adds `](streamdown:incomplete-link)` on its own line. The repaired text then has one block more than the model sent. This extra block would put the stable length one block too late. When remend changes nothing, both texts are the same, so the stable length is correct. Remend changes nothing on 79–91% of updates, so this rule costs almost nothing.

<img width="1960" height="942" alt="streamdown-tail-repair-rule" src="https://github.com/user-attachments/assets/28a49e71-f783-4539-a20b-1d8c48aac046" />

- The stable length stops before the first block with math: `$`, `\(` or `\[`, or `$$` anywhere. Remend tracks math across the whole message, so text after a math delimiter can repair differently without the text before it. A fenced code block counts only when it holds `$$`, because remend ignores other delimiters in code.
- Full repair, as today, when the text is rewritten instead of extended, the remend options change, the text has `\r` line endings, custom remend `handlers` are set, or `parseMarkdownIntoBlocksFn`, `allowedTags` or `literalTagContent` is set.
- `lib/parse-blocks.tsx`: the footnote and link-definition checks keep their previous result and scan only where a new match can end.

## Results

Main-thread busy time for one 20,000-token answer. Production build of Streamdown 2.7.0 with an earlier version of this change, Chrome, Apple M1, median of 5 runs. Both sides use remend 1.4.0, without #670 and #685. The earlier version moved the stable length on more updates. Offline, the two rules repair the same amount of text.

| Speed | Answer | 2.7.0 | With this change |
| --- | --- | ---: | ---: |
| 200 tokens/s | Mixed | 16.4 s | 15.1 s (−7.9%) |
| 200 tokens/s | Code-heavy | 14.5 s | 14.7 s (+1.3%, noise) |
| 200 tokens/s | Table-heavy | 20.7 s | 20.2 s (−2.3%, noise) |
| 1,000 tokens/s | Mixed | 7.0 s | 6.4 s (−8.4%) |
| 1,000 tokens/s | Code-heavy | 6.7 s | 5.9 s (−11.4%) |
| 1,000 tokens/s | Table-heavy | 10.6 s | 10.7 s (+0.3%, noise) |

Time per update still grows with the length of the answer, but more slowly (mixed answer, 200 tokens/s):

<img width="2560" height="1074" alt="streamdown-tail-repair-time" src="https://github.com/user-attachments/assets/068ddd3a-10c7-40be-870d-98d4ea97ea20" />

Table-heavy answers barely change. Most of their time goes to rendering the growing table again on each update, which this PR doesn't touch.

## Testing

- [x] All existing tests pass
- [x] Added new tests for the changes: `stream-repair.test.ts`, 8 tests. They check that end-only repair gives the same text as a full repair at every prefix, with and without `inlineKatex`, on fixed and random text with math, code and emphasis. They also check custom handlers, and that each incremental check gives the same answer as its full regex.
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


