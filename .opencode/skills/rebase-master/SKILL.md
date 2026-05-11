---
name: rebase-master
description: Rebase the current branch onto the latest remote master, analyze and manually resolve conflicts
license: MIT
compatibility: opencode
metadata:
  audience: developers
  workflow: git-rebase
---

## What I do
- Fetch the latest commit from `origin/master`
- Rebase the current branch onto `origin/master`
- If conflicts occur, analyze each conflicted file and resolve conflicts intelligently by understanding both sides of the changes
- Continue the rebase after resolving each commit's conflicts
- Verify the final result

## When to use me
Use this skill when you need to rebase the current branch onto the latest remote master and want conflicts to be analyzed and resolved with understanding. This is useful for:
- Keeping a feature branch up to date with upstream changes
- Preparing a branch for pull request when master has advanced

## Workflow
1. Run `git branch --show-current` to confirm the current branch
2. Run `git fetch origin master` to get the latest remote master
3. Run `git rebase origin/master` (without strategy flag) to start the rebase
4. If rebase stops due to conflicts:
   - Run `git status` to list conflicted files
   - For each conflicted file, use `git diff` to understand both sides of the conflict
   - Read the conflicted files and analyze the conflict markers (`<<<<<<<`, `=======`, `>>>>>>>`)
   - Resolve conflicts by editing files — keep meaningful changes from both sides where appropriate
   - Run `git add <resolved-file>` to mark conflicts as resolved
   - Run `git rebase --continue` to proceed
   - Repeat until the rebase completes
5. Run `git log --oneline -6` to verify the commit history
6. Run `git status --short` to confirm a clean working tree
