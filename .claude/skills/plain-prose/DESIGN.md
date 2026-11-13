# Plain prose design

Why the skill is shaped the way it is. The skill carries this file so its rules keep their reasons in any repository it is copied into. Load it when changing the skill, or when a rule in [SKILL.md](SKILL.md) needs its reason.

## Where the rules come from

The rules are a selection from the `unslop` skill in the [cursor/plugins](https://github.com/cursor/plugins) repository, reworded and renumbered. `unslop` lists 28 patterns that mark text as machine-written. This skill keeps the ones that change what a sentence tells its reader, and leaves out the ones that only change its surface.

Left out, and why:

- **The ban on dashes, arrows and sentence fragments.** Many repositories use them on purpose, in templates and in terse reference text. The skill matches the house style it finds instead.
- **The list of metaphor nouns** ("surface", "harness", "primitive"). A project's glossary often defines exactly these words. A fixed list would rewrite defined terms.
- **Punctuation and formatting rules** (curly quotes, heading case, bold). A formatter or a house style settles these better than an editing pass.

## Why the skill is user-invoked

`disable-model-invocation` keeps an agent from running it unasked. An edit to prose is a judgement about what the author meant, so the author chooses the text and reads the result.

## Why agent-read files are protected

An instruction file for a model is tuned differently from prose for a person. It may repeat one coined word on purpose, compress a rule into a fragment, or keep a metaphor because the model already has associations for it. The rules here would undo that, so the skill stops when the target is an `AGENTS.md`, a `CLAUDE.md`, a skill file or a sub-agent definition.

## Why each rule is stated as its target

Each rule says what the sentence should become ("say is or has"), not what to avoid. A rule written as a prohibition puts the unwanted phrase in front of the editor and gives no direction for the rewrite.

## Why the edit adds nothing

Several rules ask for something specific: a named source, a mechanism, a concrete result. An editor that lacks the fact will supply a plausible one. The no-new-facts rule closes that route: the sentence is made as plain as it can be, and the missing fact is flagged for the author as "needs: …".

Three additions to that rule each came from a trial run that went wrong:

- **No added sentences, and no definitions.** One run found a term used four times and never defined, and wrote the definition itself. The definition was probably right, but it was the editor's inference placed in the author's document. Rule 8 now flags an undefined term, and the no-new-facts rule names definitions.
- **Quantity and strength are kept.** One run turned "a simple rule" into "one rule", a plural into a singular, and "this ensures" into a phrase with no guarantee. Each was a small rewording that changed a claim. Step 4 now checks both.
- **Location stays literal.** Runs replaced "is located in" with "lives in" and "sits next to", trading a plain phrase for a figure of speech. Rule 5 now gives "is in".

## What the skill does not do

- **It does not check facts.** It compares the result with the original, never with the code or the diff the text describes. In trials it sometimes noticed a stale statement and reported it, and on a second run of the same file it did not. Treat any such note as a bonus.
- **It does little on templated text.** A pull request body or a commit message written to a fixed template has little filler to remove. Across four such texts a trial found two edits and one flag. The errors in those texts were unsupported claims, which need a check against the diff.
- **It over-applies "name the actor" at times.** A passive sentence whose actor does not matter is better left alone, and the rule says so. Runs still converted a few. Read the diff, and revert a rewrite that reads worse than the original.

## How it was tried

The skill was run on four documents of different ages, each from a fresh session, and every reported change was checked against the diff. On recent documents it made a handful of edits. On an older, hand-written guide it made about two dozen, a third of them deletions of sentences that said nothing. After the three fixes above, a full re-run added no sentence, changed no count of "must", "never", "only" or "always", and kept every glossary term.
