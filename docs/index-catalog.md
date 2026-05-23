# Index Catalog and Migration Discipline

Last updated: 2026-05-22

## Production policy
1. Production runtime must not auto-create indexes.
2. Index changes are applied via migration script only: `npm run migrate:indexes`.
3. Any index drop/create must have rollback notes before rollout.

## Runtime guard
1. `config/database.js` sets `autoIndex: process.env.NODE_ENV !== 'production'`.

## Managed indexes (named)

### payments
1. `uniq_paymentCode`:
   - Key: `{ paymentCode: 1 }`
   - Unique: `true`
   - Partial: `{ paymentCode: { $type: 'string' } }`
2. `uniq_sepayPaymentId`:
   - Key: `{ sepayPaymentId: 1 }`
   - Unique: `true`
   - Partial: `{ sepayPaymentId: { $type: 'string' } }`
3. `uniq_bankTransactionId`:
   - Key: `{ bankTransactionId: 1 }`
   - Unique: `true`
   - Partial: `{ bankTransactionId: { $type: 'string' } }`

### products
1. `status_createdAt`:
   - Key: `{ status: 1, createdAt: -1 }`
2. `category_status`:
   - Key: `{ category: 1, status: 1 }`
3. `seller_status`:
   - Key: `{ seller: 1, status: 1 }`

### users
1. `googleId_1`:
   - Key: `{ googleId: 1 }`
   - Unique: `true`

### wallettransactions
1. `uniq_wallet_tx_idempotencyKey`:
   - Key: `{ idempotencyKey: 1 }`
   - Unique: `true`
   - Partial: `{ idempotencyKey: { $type: 'string' } }`

## Migration entrypoint
1. Script: `scripts/migrate-indexes.js`
2. Command: `npm run migrate:indexes`
3. Current scope:
   - normalize nullable fields for `payments`
   - drop legacy duplicate index names
   - recreate named target indexes for `payments`, `products`, `users`, `wallettransactions`
4. Safety behavior:
   - script auto-captures index snapshot JSON to `docs/index-snapshots/` before any drop/create.

## Rollback checklist
1. Capture current index state before migration:
   - `db.payments.getIndexes()`
   - `db.products.getIndexes()`
   - `db.users.getIndexes()`
2. If rollback is required:
   - recreate previous indexes from captured manifest
   - drop newly created conflicting indexes by name
   - rerun smoke queries on payment lookup/product listing
