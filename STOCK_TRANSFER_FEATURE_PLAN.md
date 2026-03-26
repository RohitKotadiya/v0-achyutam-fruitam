# Stock Transfer Feature - Implementation Plan

## Overview
A complete stock transfer system to manage inventory transfers between your main store and other outlets, with tracking of outgoing transfers, return transfers, and settlement options.

---

## 1. DATABASE SCHEMA

### New Models Required:

#### A. StockTransferOutlet
Store information about other outlets/stores who can receive/send stock.
```
- id (UUID)
- name (String) - Outlet/Store name
- type (Enum: "OUTLET_STORE" | "FRIEND_STORE" | "DISTRIBUTOR")
- mobile (String) - Contact number
- email (String, optional)
- address (String, optional)
- notes (String, optional)
- isActive (Boolean) - Default: true
- createdAt (DateTime)
- updatedAt (DateTime)

Relations:
- stockTransfers (StockTransfer[])
```

#### B. StockTransfer
Main transfer record (outgoing or incoming).
```
- id (UUID)
- transferNo (Int, auto-increment) - For reference
- outletId (String) - Foreign key to StockTransferOutlet
- outlet (StockTransferOutlet) - Relation
- transferType (Enum: "OUTGOING" | "INCOMING") - OUT for lending, IN for return/purchase
- transferDate (DateTime) - When transfer happened
- settlementType (Enum: "LOAN" | "SALE" | "RETURN") 
  - LOAN: Friend borrows, must return stock
  - SALE: Money exchange, update stock permanently
  - RETURN: Returning previously borrowed stock
- settlementStatus (Enum: "PENDING" | "PARTIAL_SETTLED" | "SETTLED")
- settledDate (DateTime, nullable)
- totalValue (Float, optional) - If money is involved
- paidAmount (Float, optional) - Amount already paid (for SALE type)
- paymentMethod (Enum: "CASH" | "ONLINE" | "PENDING")
- remarks (String, optional)
- createdAt (DateTime)
- updatedAt (DateTime)

Relations:
- items (StockTransferItem[])
```

#### C. StockTransferItem
Line items in a transfer (individual products).
```
- id (UUID)
- transferId (String) - Foreign key to StockTransfer
- transfer (StockTransfer) - Relation
- productId (String) - Foreign key to Product
- product (Product) - Relation
- quantity (Float) - Units transferred
- price (Float, optional) - Unit price (if SALE type)
- costPrice (Float) - Cost for tracking value
- remarks (String, optional)

Relations:
- stockTransfers (StockTransfer[])
```

---

## 2. USER INTERFACE - NEW TAB

### Location: Admin Dashboard > New "Stock Transfer" Tab

### 2.1 OUTLETS SECTION (Top)
**Manage Transfer Outlets**
- Add Outlet
  - Name
  - Type (Outlet Store / Friend Store / Distributor)
  - Mobile
  - Email (optional)
  - Address (optional)
  - Notes
- List of all outlets with actions:
  - Edit
  - Delete
  - View transfer history
  - Active/Inactive toggle

### 2.2 TRANSFER STOCK SECTION (Main)

#### Sub-section A: Create New Transfer
Form with:
- Outlet (Dropdown - select from active outlets)
- Transfer Type Radio:
- **OUTGOING (Lending)**: Send stock to outlet
  - **INCOMING (Return/Purchase)**: Outlet returning/selling back stock
- Settlement Type (depending on transfer type):
  - LOAN: Outlet borrows, must return same items
  - SALE: Outlet buys, money exchange
  - RETURN: Returning previously lent stock

**Transfer Items Table** (Dynamic rows):
- Product (Dropdown - if OUTGOING: filter by fruit_bomb category with stock > 0)
- Quantity (Input)
- Unit Price (Input - only visible if SALE type)
- Total Value (Auto-calculated for SALE)
- Remove button

**Summary Section**:
- Total items
- Total quantity transferred
- Total value (if SALE type)

**Actions**:
- Clear/Reset button
- Create Transfer button

#### Sub-section B: Pending Transfers (Conditional Card)
Show list of:
- Outgoing loans waiting for return
- Outgoing sales awaiting settlement
- Display:
  - Outlet name
  - Transfer No
  - Transfer Date
  - Items count
  - Total value
  - Status
  - Days outstanding
  - Actions:
    - Receive Return (for LOAN type) → Opens form to accept return
    - Mark as Settled (for SALE type) → Open settlement form
    - Cancel Transfer
    - View Details

#### Sub-section C: Receive Return / Settlement
When clicking "Receive Return" or "Mark as Settled":
- Show products transferred originally
- User can:
  - Accept full return (add back to stock)
  - Partial return (user inputs different quantities)
  - Update payment status
  - Add remarks
- Update inventory accordingly

---

## 3. TRANSFER FLOW LOGIC

### 3.1 OUTGOING TRANSFER (LOAN)
```
User Action: Create OUTGOING + LOAN transfer
↓
System:
1. Validate stock availability for all items
2. Deduct from current stock
3. Create StockTransfer record (status: PENDING)
4. Create StockTransferItem records
5. Show confirmation
6. Status: Waiting for return
```

### 3.2 OUTGOING TRANSFER (SALE)
```
User Action: Create OUTGOING + SALE transfer
↓
System:
1. Validate stock availability
2. Deduct from current stock
3. Create StockTransfer record (status: PENDING)
4. Record unit prices and total value
5. Status: Awaiting payment/settlement
```

### 3.3 INCOMING TRANSFER (RETURN from LOAN)
```
User Action: Outlet returns borrowed stock
↓
System:
1. Try to match to original LOAN transfer
2. Allow partial/full return
3. Add stock back to inventory
4. Mark transfer as SETTLED
5. Create InventoryLog entry
```

### 3.4 INCOMING TRANSFER (RETURN from SALE)
```
User Action: Settle sale (outlet pays, returns stock, or combination)
↓
System:
1. Update payment status
2. Update settled amount
3. If stock returned: Add back to inventory for unreturned qty
4. Keep settled amount tracking
5. Mark SETTLED when fully paid
```

---

## 4. REPORTS & ANALYTICS

New dashboard cards:
- **Outstanding Loans**: Count of pending LOAN transfers
- **Outstanding Sales**: Total pending payment amount
- **Outlet Performance**: List top debtors, returned items statistics
- **Transfer History**: Filter by outlet, date range, type

---

## 5. DATABASE OPERATIONS

### Stock Deduction (Outgoing):
```
For each item in transfer:
  current_stock = Product.currentStock.currentStock
  if current_stock < quantity:
    error("Insufficient stock")
  else:
    new_stock = current_stock - quantity
    StockCurrent.update(productId, new_stock)
```

### Stock Addition (Incoming):
```
For each item in return/settlement:
  current_stock = Product.currentStock.currentStock
  new_stock = current_stock + returned_quantity
  StockCurrent.update(productId, new_stock)
  
Create InventoryLog entry for tracking
```

---

## 6. IMPLEMENTATION STEPS

### Phase 1: Database & API
- [ ] Update Prisma schema with new models
- [ ] Run migration: `npx prisma migrate dev --name add_stock_transfer`
- [ ] Create API endpoints:
  - POST /api/stock-transfer/outlets (Create outlet)
  - GET /api/stock-transfer/outlets (List outlets)
  - PUT /api/stock-transfer/outlets/:id (Update)
  - DELETE /api/stock-transfer/outlets/:id (Delete)
  - POST /api/stock-transfer/create (Create transfer)
  - GET /api/stock-transfer/list (List transfers)
  - POST /api/stock-transfer/:id/receive-return (Receive return)
  - POST /api/stock-transfer/:id/settle (Settle transfer)

### Phase 2: Frontend Components
- [ ] Create admin component: `stock-transfer-tab.tsx`
  - Outlets management section
  - Create transfer form
  - Pending transfers list
  - Receive return modal
  - Settlement modal
- [ ] Create sub-components:
  - `outlet-dialog.tsx` (Add/Edit outlet)
  - `transfer-form.tsx` (Create transfer)
  - `pending-transfers-list.tsx`
  - `receive-return-modal.tsx`
  - `settlement-modal.tsx`

### Phase 3: Settings Integration
- [ ] Add settings toggle: `enableStockTransfer` (default: true)
- [ ] Add tab to admin page: Stock Transfer

### Phase 4: Validation & Polish
- [ ] Test all flows
- [ ] Add error handling
- [ ] Add confirmation dialogs
- [ ] Add success toast notifications

---

## 7. KEY FEATURES

✅ **Outlet Management**: Add/edit/delete outlets
✅ **Flexible Transfer Types**: LOAN / SALE / RETURN
✅ **Automatic Stock Adjustment**: Deduct on outgoing, add on return
✅ **Settlement Tracking**: Monitor pending payments
✅ **Partial Returns**: Accept partial stock returns with reasons
✅ **Audit Trail**: Track all transfers with dates and users
✅ **Dashboard Visibility**: See at a glance who owes what
✅ **Inventory Integration**: Real-time stock updates

---

## 8. SECURITY & VALIDATIONS

- Only admin can manage stock transfers
- Validate stock availability before transfer
- Cannot transfer non-existent products
- Cannot delete outlet with pending transfers (soft delete)
- Audit logging for all transfer operations

---

## 9. FUTURE ENHANCEMENTS

- Auto reminders for overdue returns
- SMS notifications to outlets
- Return authorization (RMA) numbers
- Damaged stock tracking during transfers
- Transfer insurance/fees
- Currency support for multi-store setup
- Batch transfers
