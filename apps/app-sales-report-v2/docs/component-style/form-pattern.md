---
title: Form Pattern
description: React Hook Form + Zod + Server Action conventions. Field components, validation, submission, error display.
load-when: Building a form (manual input, prime cost edit, upload metadata, etc.)
status: skeleton
---

# Form Pattern

> Skeleton — fill code examples khi implement.

## 1. Stack

- **React Hook Form** — form state, registration
- **Zod** — schema validation (shared client/server)
- **shadcn/ui Form** — visual primitives wrap RHF
- **Server Action** — submit handler

## 2. File layout

```
_components/
├── <Entity>FormSchema.ts        ← Zod schema (also exported to server)
├── <Entity>FormFields.tsx       ← field components
└── <Entity>Form.tsx             ← form wrapper + RHF + submit

_actions/
└── save-<entity>.action.ts      ← Server Action, uses same Zod schema
```

## 3. Zod schema (shared)

```
TODO: example
- packages/shared/zod/<entity>.zod.ts
- Used in both Client (form validation) and Server (action input validation)
- Single source of truth for shape
```

## 4. Form skeleton

```
TODO: example
- useForm({ resolver: zodResolver(schema), defaultValues })
- <Form {...form}> <FormField /> ... </Form>
- form.handleSubmit(async (data) => { ... call action ... })
```

## 5. Submission

```
TODO: example
- Server Action returns { success, data?, error? }
- On success: toast + reset form + revalidatePath
- On error: form.setError + toast
```

## 6. Field component types

| Type | shadcn primitive |
|---|---|
| Text | Input |
| Number | Input type=number + valueAsNumber |
| Date | Date Picker (date-fns) |
| Date Range | calendar component |
| Select | Select |
| Multi-select | Combobox |
| File | DropZone (xem upload flow) |
| Checkbox | Checkbox |
| Toggle | Switch |
| Money (VND) | Input + formatter `Intl.NumberFormat('vi-VN')` |

## 7. Validation rules (common)

```
TODO: helpers
- z.string().min(1, 'required')
- z.coerce.number().positive()
- z.string().uuid()
- VND amount: z.coerce.number().int().nonnegative().max(999999999999)
- Date range: z.object({ from: z.date(), to: z.date() }).refine(...)
```

## 8. Error display

- Inline `<FormMessage />` per field
- Toast cho server error (top-right)
- Don't toast cho field-level validation (inline đủ)

## 9. Anti-patterns ❌

- ❌ Uncontrolled inputs (use RHF `register`)
- ❌ Custom validation logic trùng với Zod schema
- ❌ Submit handler không check `success` field
- ❌ Hardcode error messages — qua i18n
- ❌ Reset form không gọi `form.reset()` sau success

## See also

- [_INDEX.md](_INDEX.md)
- [../system-design/server-actions.md](../system-design/server-actions.md)
- [states.md](states.md) — loading state khi submitting
