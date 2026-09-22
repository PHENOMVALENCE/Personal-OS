# Personal input formats

Files live in ignored `data/inputs/`. Setup copies empty templates from `examples/inputs/`; examples below are fictional. Replace dates with current dates and use ISO 8601 timestamps with an explicit offset. The code does not validate a formal schema. Use the exact root keys and array/object shapes below.

## Schedule: schedule.json

```json
{"events":[{"title":"Project planning","category":"work","starts_at":"2030-01-15T09:00:00+03:00","ends_at":"2030-01-15T10:00:00+03:00","location":"Home office","notes":"Review priorities"}]}
```

Events starting today appear in today's schedule; future events starting within 24 hours appear as upcoming. Conflicts compare adjacent events sorted by start time, so nested overlaps and overnight events can be missed. `title`, `starts_at` and `ends_at` are needed for useful output; category, location and notes add context.

## Academics: academics.json

```json
{"items":[{"title":"Draft essay","course":"Example course","type":"assignment","due_at":"2030-01-16T17:00:00+03:00","status":"pending","priority":"high"}]}
```

Past-due items are overdue unless `status` is `done`. Due-soon items fall within the next seven days. Priorities use `high`, `medium`, or `low`, with due date taking precedence.

## Communications: communications.json

```json
{"conversations":[{"contact":"Example collaborator","channel":"email","topic":"Planning notes","commitment":"Send draft agenda","last_message_at":"2030-01-14T12:00:00+03:00","awaiting_response_from":"me","needs_follow_up":true,"priority":"medium"}]}
```

An entry is pending when `awaiting_response_from` is `me` OR `needs_follow_up` is true. To close it, update both conditions. Entries sort by priority and age; the high-priority shortlist is capped at eight. This is a manually maintained record, not an inbox connection, and the app does not send messages.

## Responsibilities: responsibilities.json

```json
{"areas":[{"name":"Community project","items":[{"title":"Prepare meeting notes","due_at":"2030-01-17T18:00:00+03:00","status":"pending","priority":"low"}]}]}
```

Items are flattened with their area name. `done` excludes an item from overdue/upcoming lists. Items without a due date are not shown in those lists. Upcoming output is capped at twelve.

## Finance: finance.json

```json
{"bills":[{"title":"Example subscription","amount":25,"due_at":"2030-01-20T12:00:00+03:00","status":"pending"}],"goals":[{"title":"Equipment fund","current_amount":100,"target_amount":500}]}
```

Future bills not marked `paid` are sorted by date and capped at ten. Overdue bills are currently excluded from upcoming output. Amounts are displayed as entered: there is no currency conversion, bank connection, reconciliation or payment processing. Use one consistent currency in your own records.

## Goals: goals.json

```json
{"goals":[{"title":"Finish example project","status":"in progress"}]}
```

These goals are passed through to the dashboard, without automatic progress calculation. Finance goals are a separate array in `finance.json`.

## Validate edits

```powershell
Get-ChildItem data/inputs/*.json | ForEach-Object {
  Get-Content $_.FullName -Raw | ConvertFrom-Json | Out-Null
}
```

This checks JSON syntax only. Missing/malformed files can silently become empty summaries, while bad date values may throw formatting errors. If a section unexpectedly disappears, inspect its input file before assuming there are no outstanding tasks.
