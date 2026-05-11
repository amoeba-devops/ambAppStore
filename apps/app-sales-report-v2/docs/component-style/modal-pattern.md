---
title: Modal Pattern
description: shadcn Dialog conventions — confirm dialogs, form-in-modal, drawer (mobile), focus trap.
load-when: Building a modal, confirm dialog, side drawer, or any overlay UI.
status: skeleton
---

# Modal Pattern

> Skeleton — fill khi implement upload confirm, prime cost edit modal, etc.

## 1. When to use which

| UI element | Use |
|---|---|
| Confirm action (Yes/No) | shadcn `AlertDialog` |
| Form modal (CRUD) | shadcn `Dialog` |
| Side panel detail | shadcn `Sheet` |
| Inline tooltip | shadcn `Tooltip` |
| Dropdown action menu | shadcn `DropdownMenu` |

## 2. AlertDialog (confirm)

```
TODO: example
- Two-button: Cancel + Confirm
- destructive action → Confirm button = variant="destructive" (red)
- Loading state on Confirm during async
```

Common use cases:
- Continue with partial reports (xem [UPLOAD-FLOW](../analysis/UPLOAD-FLOW-20260511.md))
- Delete confirmation (Prime Cost row, manual input)
- Unfinalize report (Admin only — OI-002)

## 3. Form in Dialog

```
TODO: example
- Dialog wraps form
- Submit button trong DialogFooter
- Close on success
- Keep open on error (preserve user input)
```

## 4. Dialog props checklist

- [ ] `<DialogTitle>` (a11y required, never skip)
- [ ] `<DialogDescription>` (helpful context)
- [ ] `<DialogClose>` X button top-right (default)
- [ ] Focus first input on open (autoFocus)
- [ ] Escape key closes
- [ ] Click outside closes (defaults to true — disable cho destructive)

## 5. Loading state

```
TODO: example
- Disable submit button + spinner during async
- Don't unmount Dialog (preserve state) until done
```

## 6. Anti-patterns ❌

- ❌ Nested modals (Dialog inside Dialog) — refactor to multi-step
- ❌ Skip DialogTitle (a11y fail)
- ❌ Modal cho data display chỉ → dùng inline / new page
- ❌ Modal width fixed cho mobile — must responsive
- ❌ Close modal while async pending — user mất tracking

## See also

- [_INDEX.md](_INDEX.md)
- [form-pattern.md](form-pattern.md)
- [states.md](states.md) — loading state inside modal
- shadcn Dialog: https://ui.shadcn.com/docs/components/dialog
