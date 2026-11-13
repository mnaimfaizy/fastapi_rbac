---
name: plain-prose
description: Edit human-read prose into plain, specific sentences. Invoked by the user on a named file or pasted text.
disable-model-invocation: true
argument-hint: "<file path or pasted text>"
metadata:
  agent-kit-scope: user
---

# Plain prose

Edit prose a human will read (a PR body, an issue or PRD body, a README, an ADR, release notes, a QA plan) so every sentence is plain and specific to its subject. The edit rewords and deletes. It keeps the meaning, the tone, and every fact.

Load [DESIGN.md](DESIGN.md) when a rule needs its reason, or before changing this skill.

## Steps

1. **Fix the target.** It is the file or text given as the argument. With no argument, ask which text to edit and stop. If the target is an agent-read file (see Protected regions), say so and stop.
2. **Find the glossary.** Look for the project's glossary (`CONTEXT.md`, `GLOSSARY.md`, or a file the project's `AGENTS.md` / `CLAUDE.md` names as one). Every term it defines is protected. Done when you have the term list, or have confirmed the project has no glossary.
3. **Edit.** Read every sentence outside the protected regions against every rule below and rewrite or delete the ones that fail. Done when each remaining sentence passes all the rules.
4. **Check the facts held.** Compare the result with the original. Every number, name, source, command, and claim in the result appears in the original, with the same subject and unit. Every reworded sentence also keeps its original quantity (singular or plural, "a" or "one", "some" or "all") and its original strength ("ensures" stays a guarantee, "may" stays a possibility). Restore anything that drifted.
5. **Report.** Apply the edit to the file, or return the rewritten text when the input was pasted. Then list, in a few lines, what kinds of change you made and every sentence you flagged under the no-new-facts rule.

## Two rules that outrank the rest

**No new facts.** The edit adds no number, source, example, definition, or claim the original lacked, and no sentence that was not there. A split sentence is the one exception, since its halves carry only what the original said. When a rule calls for a specific the text does not contain (a figure, a named source, a mechanism), keep the sentence as plain as it can be made and flag it in the report as "needs: <what is missing>". The author supplies it.

**Protected regions stay byte-for-byte.**

- Code blocks, inline code, commands, file paths, and URLs.
- Quoted material and anything attributed to someone else.
- Glossary terms, in their defined spelling and capitalisation.
- Fixed template parts: section headings a template requires, header lines such as `TITLE:` or `LABELS:`, and issue-closing keywords such as `Fixes #123`.
- Punctuation and symbols the project's own documents already use, such as dashes and arrows. Match the surrounding house style.
- Agent-read files as a whole: `AGENTS.md`, `CLAUDE.md`, skill files, sub-agent definitions. Their wording is tuned for a model, so this skill leaves them alone.

## Rules

### Say something specific

1. **The sentence belongs to this subject.** If it could sit unchanged in another project's document, it tells the reader nothing about this one. Rewrite it to state what the thing does, or delete it.
2. **A claim names its source.** "Experts believe" and "reports suggest" become the named source when the original gives one. Otherwise delete the claim.
3. **End on a fact.** A closing line states a concrete plan, result, or next step. Delete a closing line that only sums up the mood ("the future looks bright").
4. **Finish the thought in the main clause.** A trailing "-ing" phrase that adds a vague benefit ("ensuring reliability", "highlighting its importance") is deleted, or becomes its own sentence when it holds a real point.

### Say it directly

5. **Say "is" or "has".** "Serves as", "stands as", "boasts", and "features" become "is" or "has". "Is located in" becomes "is in", and stays literal: write "the tests are in", where "live in" or "sit next to" would swap one figure for another.
6. **State the point once.** "Not just X, but Y" becomes Y.
7. **Use the natural count.** List the items that exist, whether that is two or four. A third item added for rhythm goes.
8. **One word per concept.** Pick a term and repeat it. Where the glossary names the term, use that one. When the text uses a term it never defines, flag it as "needs: definition of <term>" and leave the text as it is. A definition is a new claim, so the author writes it.
9. **Name the actor.** "Queries are validated" becomes "the compiler validates queries". Keep the passive only when the actor is unknown or irrelevant.
10. **One idea per sentence.** If a reader would have to backtrack, split the sentence or drop a clause.

### Use plain words

11. **The plain word.** "Utilize" and "leverage" become "use". "Facilitate" becomes "help". "Numerous" becomes "many". "Crucial" and "pivotal" become "important", or go. "Delve into" becomes "look at". "Showcase" becomes "show". "Underscore" becomes "show" or "stress".
12. **The short form.** "In order to" becomes "to". "Due to the fact that" becomes "because". "In the event that" becomes "if". "It is important to note that" goes.
13. **One hedge at most.** "Could potentially possibly" becomes "may". Keep a hedge that reports real uncertainty.

### Address the reader as a writer, not a chatbot

14. **Start with the content.** Openers and closers aimed at a chat partner ("Great question", "Certainly", "I hope this helps", "Let me know if") go. This applies to free-form text. A templated output has no room for them.
