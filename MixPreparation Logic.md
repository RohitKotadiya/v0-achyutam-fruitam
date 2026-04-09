I’ll inspect the main mix preparation, sale, and batch APIs plus the admin/pos screens, then give you a full current-flow summary without making any changes.

Read [](file:///d%3A/AFM%20POS%20PWA/v0-achyutam-fruitam/app/api/inventory/mix-prepare/route.ts)

Read [](file:///d%3A/AFM%20POS%20PWA/v0-achyutam-fruitam/app/api/inventory/mix-batches/route.ts)

Read [](file:///d%3A/AFM%20POS%20PWA/v0-achyutam-fruitam/app/api/inventory/mix-batches/%5Bid%5D/route.ts)

Read [](file:///d%3A/AFM%20POS%20PWA/v0-achyutam-fruitam/app/api/bills/save/route.ts)

I’ve mapped backend logic; next I’m checking the UI flow wiring (where mix entry, mix batches, refresh/apply controls are mounted) so you get full end-to-end behavior.

Searched for regex `forcedSubTab|forcedPrepareMixView|hideSubTabList|prepareMixView` (`**/app/admin/page.tsx`), 6 results

Searched for regex `fetchMixBatches|handlePrepareMix|handleUpdateBatchPreparedQty|mixBusyMessage|isFetchingMixBatches` (`**/components/admin/inventory-tab.tsx`), 20 results

Read [](file:///d%3A/AFM%20POS%20PWA/v0-achyutam-fruitam/components/admin/inventory-tab.tsx#1330-1330), lines 1330 to 1725

Read [](file:///d%3A/AFM%20POS%20PWA/v0-achyutam-fruitam/app/admin/page.tsx#220-220), lines 220 to 232

Read [](file:///d%3A/AFM%20POS%20PWA/v0-achyutam-fruitam/app/pos/page.tsx#520-520), lines 520 to 620

Read [](file:///d%3A/AFM%20POS%20PWA/v0-achyutam-fruitam/app/pos/page.tsx#820-820), lines 820 to 910

Read [](file:///d%3A/AFM%20POS%20PWA/v0-achyutam-fruitam/app/admin/page.tsx#160-160), lines 160 to 210

I’m grabbing the key schema models so the explanation includes exact data fields and relationships used by mix prep and batch sales.

Read [](file:///d%3A/AFM%20POS%20PWA/v0-achyutam-fruitam/prisma/schema.prisma#145-145), lines 145 to 275

No code was changed.  
Here is the current live logic in your POS for mix preparation and mix batches.

**1. Where Mix Batch UI is mounted**
1. Admin has two dedicated tabs that both use the same Inventory component:
   page.tsx
2. Mix Entry tab opens Inventory in prepare mode with entry view.
3. Mix Batches tab opens Inventory in prepare mode with batches view.

**2. Mix Preparation Creation Flow (Entry tab)**
1. User enters target SKU, source category, prepared quantity, ingredient SKUs + qty.
2. UI submits to:
   route.ts
3. API validates:
   - target SKU exists
   - source category exists
   - prepared quantity > 0
   - at least one ingredient
   - each ingredient exists, belongs to source category, has enough stock
   - ingredient cannot be same as target product
4. API computes:
   - totalIngredientCost
   - costUnits (sum of ingredient qty)
   - unitCostPerCostUnit = totalIngredientCost / costUnits
5. In one DB transaction:
   - Inserts one MixPreparation row with:
     producedUnits = preparedQuantity
     producedUnitsRemaining = preparedQuantity
     costUnitsRemaining = costUnits
   - Inserts MixPreparationIngredient rows
   - Deducts ingredient stock from StockCurrent
   - Adds prepared target stock to StockCurrent
6. Relevant models:
   schema.prisma

**3. What Happens When You Sell in POS**
1. POS sends bill save request to:
   route.ts
2. POS can add product as normal or via mix popup:
   page.tsx
3. Bill save now does batch-wise logic by product, not only by isMixDish flag:
   - Finds all billed productIds
   - Checks current StockCurrent sufficiency first
   - Detects which billed products are batch-managed (exist in MixPreparation)
   - For each batch-managed product:
     - loads open batches where producedUnitsRemaining > 0
     - consumes FIFO by date/createdAt
     - blocks sale if requested units > available open batch units
     - decrements producedUnitsRemaining and costUnitsRemaining per batch
4. So yes, this enforces your rule:
   - If first batch has 5 prepared units, that batch cannot supply 10 by itself
   - Consumption moves across open batches FIFO
   - If total open batch units are insufficient, bill fails
5. After batch handling, bill flow continues:
   - decrements StockCurrent for each sold product
   - stores Bill + BillItem rows
   - stores line cost/profit data

**4. Mix Batches Listing Logic (Batches tab)**
1. Batches are fetched from:
   route.ts
2. API uses dynamic + no-store headers (fresh data each refresh).
3. Query builds per-product batch windows using next batch date (LEAD).
4. Sold units shown per batch are calculated as:
   - max(produced - producedRemaining, bill qty within that batch window)
   - capped to produced units
5. Also returns ingredients list, remaining units, cost remaining, zero-cost remaining.

**5. Batch Update Logic (Apply in Batches tab)**
1. Apply button calls:
   [app/api/inventory/mix-batches/[id]/route.ts](app/api/inventory/mix-batches/[id]/route.ts)
2. Rules enforced:
   - cannot update closed batch (remaining <= 0)
   - cannot reduce prepared below already consumed units
3. On valid update:
   - updates producedUnits, preparedQuantity, producedUnitsRemaining
   - adjusts target StockCurrent by delta remaining
4. In UI:
   - closed batch shows Closed and Apply disabled
   - during request, row input/action disabled and shows Applying...
   - refresh button has spinner state
   Source UI:
   inventory-tab.tsx

**6. Net Behavior Across Whole POS**
1. Mix creation increases target stock and opens a batch.
2. Selling batch-managed products consumes open batches FIFO.
3. Batch closes automatically when producedUnitsRemaining reaches 0.
4. Closed batches cannot be updated from Action column.
5. Mix Batches screen shows prepared, sold, and remaining per batch with filters/pagination.

If you want next, I can give a concrete example with numbers (Batch A 5, Batch B 7, Sale 9) exactly as your code would process it.