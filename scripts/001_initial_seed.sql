-- Create default admin user (password: admin123)
-- Password hash for 'admin123' using bcrypt
INSERT INTO "User" (id, email, name, password, role, "createdAt", "updatedAt")
VALUES (
  gen_random_uuid()::text,
  'admin@achyutamfruitam.com',
  'Admin User',
  '$2a$10$rqK8F3PZQz9YqW3jXK7Wj.dHqWJZqV3YdG3qKjH5fWqN0WqH0WqH0',
  'ADMIN',
  NOW(),
  NOW()
);

-- Insert default SKUs
-- CATEGORY 1: FRUIT BOMB
INSERT INTO "Product" (id, sku, name, category, "originalCost", "sellingPrice", active, "createdAt", "updatedAt")
VALUES
  (gen_random_uuid()::text, '1', 'Mango B', 'FRUIT_BOMB', 162, 250, true, NOW(), NOW()),
  (gen_random_uuid()::text, '2', 'Dadam B', 'FRUIT_BOMB', 117, 190, true, NOW(), NOW()),
  (gen_random_uuid()::text, '3', 'Orange B', 'FRUIT_BOMB', 117, 190, true, NOW(), NOW()),
  (gen_random_uuid()::text, '4', 'Apple B', 'FRUIT_BOMB', 117, 190, true, NOW(), NOW()),
  (gen_random_uuid()::text, '5', 'Musk Melon B', 'FRUIT_BOMB', 117, 190, true, NOW(), NOW()),
  (gen_random_uuid()::text, '6', 'Guava B', 'FRUIT_BOMB', 117, 190, true, NOW(), NOW()),

  -- CATEGORY 2: REAL FRUIT ICE CREAM (Premium - 90 Rs)
  (gen_random_uuid()::text, '7', 'Mulberry', 'ICE_CREAM', 45, 90, true, NOW(), NOW()),
  (gen_random_uuid()::text, '8', 'Custard Apple', 'ICE_CREAM', 45, 90, true, NOW(), NOW()),
  (gen_random_uuid()::text, '9', 'Strawbery', 'ICE_CREAM', 45, 90, true, NOW(), NOW()),
  (gen_random_uuid()::text, '10', 'Coconut', 'ICE_CREAM', 45, 90, true, NOW(), NOW()),
  (gen_random_uuid()::text, '11', 'Guava', 'ICE_CREAM', 45, 90, true, NOW(), NOW()),
  (gen_random_uuid()::text, '12', 'Chocolate', 'ICE_CREAM', 45, 90, true, NOW(), NOW()),
  (gen_random_uuid()::text, '13', 'Cookies Cream', 'ICE_CREAM', 45, 90, true, NOW(), NOW()),
  (gen_random_uuid()::text, '14', 'Kesar Pista', 'ICE_CREAM', 45, 90, true, NOW(), NOW()),
  (gen_random_uuid()::text, '15', 'Kaju Gulkand', 'ICE_CREAM', 45, 90, true, NOW(), NOW()),
  (gen_random_uuid()::text, '16', 'Pan Masala', 'ICE_CREAM', 45, 90, true, NOW(), NOW()),
  (gen_random_uuid()::text, '17', 'Kaju Katli', 'ICE_CREAM', 45, 90, true, NOW(), NOW()),
  (gen_random_uuid()::text, '18', 'Musk Melon', 'ICE_CREAM', 45, 90, true, NOW(), NOW()),
  (gen_random_uuid()::text, '19', 'Litchi', 'ICE_CREAM', 45, 90, true, NOW(), NOW()),
  (gen_random_uuid()::text, '20', 'Achyutam Sp', 'ICE_CREAM', 45, 90, true, NOW(), NOW()),
  (gen_random_uuid()::text, '30', 'Biscoff', 'ICE_CREAM', 45, 90, true, NOW(), NOW()),

  -- CATEGORY 2: REAL FRUIT ICE CREAM (Standard - 80 Rs)
  (gen_random_uuid()::text, '21', 'Jamun', 'ICE_CREAM', 40, 80, true, NOW(), NOW()),
  (gen_random_uuid()::text, '22', 'Kiwi', 'ICE_CREAM', 40, 80, true, NOW(), NOW()),
  (gen_random_uuid()::text, '23', 'Imli', 'ICE_CREAM', 40, 80, true, NOW(), NOW()),
  (gen_random_uuid()::text, '24', 'Chikoo', 'ICE_CREAM', 40, 80, true, NOW(), NOW()),
  (gen_random_uuid()::text, '25', 'Mango', 'ICE_CREAM', 40, 80, true, NOW(), NOW()),
  (gen_random_uuid()::text, '26', 'Pineapple', 'ICE_CREAM', 40, 80, true, NOW(), NOW()),
  (gen_random_uuid()::text, '27', 'Dadam', 'ICE_CREAM', 40, 80, true, NOW(), NOW()),
  (gen_random_uuid()::text, '28', 'Orange', 'ICE_CREAM', 40, 80, true, NOW(), NOW()),
  (gen_random_uuid()::text, '29', 'Grapes', 'ICE_CREAM', 40, 80, true, NOW(), NOW()),
  (gen_random_uuid()::text, '31', 'Kaju Anjeer', 'ICE_CREAM', 40, 80, true, NOW(), NOW()),

  -- CATEGORY 2: REAL FRUIT ICE CREAM (Premium Berry - 120 Rs)
  (gen_random_uuid()::text, '32', 'Raspbery', 'ICE_CREAM', 78, 120, true, NOW(), NOW()),
  (gen_random_uuid()::text, '33', 'Bluebery', 'ICE_CREAM', 78, 120, true, NOW(), NOW()),

  -- CATEGORY 3: KULFI
  (gen_random_uuid()::text, '34', 'Mango K', 'KULFI', 25, 50, true, NOW(), NOW()),
  (gen_random_uuid()::text, '35', 'Chocolate K', 'KULFI', 25, 50, true, NOW(), NOW()),
  (gen_random_uuid()::text, '36', 'Strawbery K', 'KULFI', 25, 50, true, NOW(), NOW()),
  (gen_random_uuid()::text, '37', 'Mawa Malai K', 'KULFI', 25, 50, true, NOW(), NOW()),
  (gen_random_uuid()::text, '38', 'Jamun K', 'KULFI', 25, 50, true, NOW(), NOW()),
  (gen_random_uuid()::text, '39', 'Kesar Pista K', 'KULFI', 25, 50, true, NOW(), NOW()),
  (gen_random_uuid()::text, '40', 'Chikoo K', 'KULFI', 25, 50, true, NOW(), NOW()),
  (gen_random_uuid()::text, '41', 'Orange K', 'KULFI', 25, 50, true, NOW(), NOW()),

  -- CATEGORY 4: MIX DISH
  (gen_random_uuid()::text, '42', 'Mix Dish', 'MIX_DISH', 45, 120, true, NOW(), NOW());

-- Initialize stock for all products with 0 stock
INSERT INTO "StockCurrent" ("id", "productId", "currentStock", "updatedAt")
SELECT 
  gen_random_uuid()::text,
  id,
  0,
  NOW()
FROM "Product";
