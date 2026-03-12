-- Create default admin user (password: admin123)
-- Password hash for 'admin123' using bcrypt
INSERT INTO "User" (id, email, name, password, role, "createdAt", "updatedAt")
VALUES (
  gen_random_uuid()::text,
  'admin@achyutamfruitam.com',
  'Admin User',
  '$2a$10$kKTBTQE09jfDzot5H51HQeXMGUwZJ3Sytlf2J6Yxz4lVEpBJdYpBy',
  'ADMIN',
  NOW(),
  NOW()
);

-- Add dynamic categories table and migrate existing data

-- Create 4 default categories matching the original system
INSERT INTO "ProductCategory" (id, name, "displayName", description, "sortOrder", color, icon, "isActive", "createdAt", "updatedAt")
VALUES
  (gen_random_uuid()::text, 'fruit_bomb', 'Fruit Bomb', 'Fresh fruit bombs with ice cream', 1, '#f59e0b', '🍊', true, NOW(), NOW()),
  (gen_random_uuid()::text, 'ice_cream', 'Real Fruit Ice Cream', 'Premium real fruit ice cream slices', 2, '#ec4899', '🍨', true, NOW(), NOW()),
  (gen_random_uuid()::text, 'kulfi', 'Kulfi', 'Traditional Indian kulfi', 3, '#8b5cf6', '🍡', true, NOW(), NOW()),
  (gen_random_uuid()::text, 'mix_dish', 'Mix Dish', 'Custom mix dish creations', 4, '#10b981', '🍧', true, NOW(), NOW());


-- Insert default SKUs
-- Insert 42 default products with dynamic categoryId

INSERT INTO "Product" (
  id,
  sku,
  name,
  "categoryId",
  "originalCost",
  "sellingPrice",
  active,
  "createdAt",
  "updatedAt"
)
VALUES
  -- CATEGORY 1: FRUIT BOMB
  (gen_random_uuid()::text, '1', 'Mango B',
   (SELECT id FROM "ProductCategory" WHERE name = 'fruit_bomb'),
   162, 250, true, NOW(), NOW()),
  (gen_random_uuid()::text, '2', 'Dadam B',
   (SELECT id FROM "ProductCategory" WHERE name = 'fruit_bomb'),
   117, 190, true, NOW(), NOW()),
  (gen_random_uuid()::text, '3', 'Orange B',
   (SELECT id FROM "ProductCategory" WHERE name = 'fruit_bomb'),
   117, 190, true, NOW(), NOW()),
  (gen_random_uuid()::text, '4', 'Apple B',
   (SELECT id FROM "ProductCategory" WHERE name = 'fruit_bomb'),
   117, 190, true, NOW(), NOW()),
  (gen_random_uuid()::text, '5', 'Musk Melon B',
   (SELECT id FROM "ProductCategory" WHERE name = 'fruit_bomb'),
   117, 190, true, NOW(), NOW()),
  (gen_random_uuid()::text, '6', 'Guava B',
   (SELECT id FROM "ProductCategory" WHERE name = 'fruit_bomb'),
   117, 190, true, NOW(), NOW()),

  -- CATEGORY 2: REAL FRUIT ICE CREAM (Premium - 90 Rs)
  (gen_random_uuid()::text, '7', 'Mulberry',
   (SELECT id FROM "ProductCategory" WHERE name = 'ice_cream'),
   45, 90, true, NOW(), NOW()),
  (gen_random_uuid()::text, '8', 'Custard Apple',
   (SELECT id FROM "ProductCategory" WHERE name = 'ice_cream'),
   45, 90, true, NOW(), NOW()),
  (gen_random_uuid()::text, '9', 'Strawbery',
   (SELECT id FROM "ProductCategory" WHERE name = 'ice_cream'),
   45, 90, true, NOW(), NOW()),
  (gen_random_uuid()::text, '10', 'Coconut',
   (SELECT id FROM "ProductCategory" WHERE name = 'ice_cream'),
   45, 90, true, NOW(), NOW()),
  (gen_random_uuid()::text, '11', 'Guava',
   (SELECT id FROM "ProductCategory" WHERE name = 'ice_cream'),
   45, 90, true, NOW(), NOW()),
  (gen_random_uuid()::text, '12', 'Chocolate',
   (SELECT id FROM "ProductCategory" WHERE name = 'ice_cream'),
   45, 90, true, NOW(), NOW()),
  (gen_random_uuid()::text, '13', 'Cookies Cream',
   (SELECT id FROM "ProductCategory" WHERE name = 'ice_cream'),
   45, 90, true, NOW(), NOW()),
  (gen_random_uuid()::text, '14', 'Kesar Pista',
   (SELECT id FROM "ProductCategory" WHERE name = 'ice_cream'),
   45, 90, true, NOW(), NOW()),
  (gen_random_uuid()::text, '15', 'Kaju Gulkand',
   (SELECT id FROM "ProductCategory" WHERE name = 'ice_cream'),
   45, 90, true, NOW(), NOW()),
  (gen_random_uuid()::text, '16', 'Pan Masala',
   (SELECT id FROM "ProductCategory" WHERE name = 'ice_cream'),
   45, 90, true, NOW(), NOW()),
  (gen_random_uuid()::text, '17', 'Kaju Katli',
   (SELECT id FROM "ProductCategory" WHERE name = 'ice_cream'),
   45, 90, true, NOW(), NOW()),
  (gen_random_uuid()::text, '18', 'Musk Melon',
   (SELECT id FROM "ProductCategory" WHERE name = 'ice_cream'),
   45, 90, true, NOW(), NOW()),
  (gen_random_uuid()::text, '19', 'Litchi',
   (SELECT id FROM "ProductCategory" WHERE name = 'ice_cream'),
   45, 90, true, NOW(), NOW()),
  (gen_random_uuid()::text, '20', 'Achyutam Sp',
   (SELECT id FROM "ProductCategory" WHERE name = 'ice_cream'),
   45, 90, true, NOW(), NOW()),
  (gen_random_uuid()::text, '30', 'Biscoff',
   (SELECT id FROM "ProductCategory" WHERE name = 'ice_cream'),
   45, 90, true, NOW(), NOW()),

  -- CATEGORY 2: REAL FRUIT ICE CREAM (Standard - 80 Rs)
  (gen_random_uuid()::text, '21', 'Jamun',
   (SELECT id FROM "ProductCategory" WHERE name = 'ice_cream'),
   40, 80, true, NOW(), NOW()),
  (gen_random_uuid()::text, '22', 'Kiwi',
   (SELECT id FROM "ProductCategory" WHERE name = 'ice_cream'),
   40, 80, true, NOW(), NOW()),
  (gen_random_uuid()::text, '23', 'Imli',
   (SELECT id FROM "ProductCategory" WHERE name = 'ice_cream'),
   40, 80, true, NOW(), NOW()),
  (gen_random_uuid()::text, '24', 'Chikoo',
   (SELECT id FROM "ProductCategory" WHERE name = 'ice_cream'),
   40, 80, true, NOW(), NOW()),
  (gen_random_uuid()::text, '25', 'Mango',
   (SELECT id FROM "ProductCategory" WHERE name = 'ice_cream'),
   40, 80, true, NOW(), NOW()),
  (gen_random_uuid()::text, '26', 'Pineapple',
   (SELECT id FROM "ProductCategory" WHERE name = 'ice_cream'),
   40, 80, true, NOW(), NOW()),
  (gen_random_uuid()::text, '27', 'Dadam',
   (SELECT id FROM "ProductCategory" WHERE name = 'ice_cream'),
   40, 80, true, NOW(), NOW()),
  (gen_random_uuid()::text, '28', 'Orange',
   (SELECT id FROM "ProductCategory" WHERE name = 'ice_cream'),
   40, 80, true, NOW(), NOW()),
  (gen_random_uuid()::text, '29', 'Grapes',
   (SELECT id FROM "ProductCategory" WHERE name = 'ice_cream'),
   40, 80, true, NOW(), NOW()),
  (gen_random_uuid()::text, '31', 'Kaju Anjeer',
   (SELECT id FROM "ProductCategory" WHERE name = 'ice_cream'),
   40, 80, true, NOW(), NOW()),

  -- CATEGORY 2: REAL FRUIT ICE CREAM (Premium Berry - 120 Rs)
  (gen_random_uuid()::text, '32', 'Raspbery',
   (SELECT id FROM "ProductCategory" WHERE name = 'ice_cream'),
   78, 120, true, NOW(), NOW()),
  (gen_random_uuid()::text, '33', 'Bluebery',
   (SELECT id FROM "ProductCategory" WHERE name = 'ice_cream'),
   78, 120, true, NOW(), NOW()),

  -- CATEGORY 3: KULFI
  (gen_random_uuid()::text, '34', 'Mango K',
   (SELECT id FROM "ProductCategory" WHERE name = 'kulfi'),
   25, 50, true, NOW(), NOW()),
  (gen_random_uuid()::text, '35', 'Chocolate K',
   (SELECT id FROM "ProductCategory" WHERE name = 'kulfi'),
   25, 50, true, NOW(), NOW()),
  (gen_random_uuid()::text, '36', 'Strawbery K',
   (SELECT id FROM "ProductCategory" WHERE name = 'kulfi'),
   25, 50, true, NOW(), NOW()),
  (gen_random_uuid()::text, '37', 'Mawa Malai K',
   (SELECT id FROM "ProductCategory" WHERE name = 'kulfi'),
   25, 50, true, NOW(), NOW()),
  (gen_random_uuid()::text, '38', 'Jamun K',
   (SELECT id FROM "ProductCategory" WHERE name = 'kulfi'),
   25, 50, true, NOW(), NOW()),
  (gen_random_uuid()::text, '39', 'Kesar Pista K',
   (SELECT id FROM "ProductCategory" WHERE name = 'kulfi'),
   25, 50, true, NOW(), NOW()),
  (gen_random_uuid()::text, '40', 'Chikoo K',
   (SELECT id FROM "ProductCategory" WHERE name = 'kulfi'),
   25, 50, true, NOW(), NOW()),
  (gen_random_uuid()::text, '41', 'Orange K',
   (SELECT id FROM "ProductCategory" WHERE name = 'kulfi'),
   25, 50, true, NOW(), NOW()),

  -- CATEGORY 4: MIX DISH
  (gen_random_uuid()::text, '42', 'Mix Dish',
   (SELECT id FROM "ProductCategory" WHERE name = 'mix_dish'),
   45, 120, true, NOW(), NOW());

-- Initialize stock for all products with 0 stock
INSERT INTO "StockCurrent" ("id", "productId", "currentStock", "updatedAt")
SELECT 
  gen_random_uuid()::text,
  id,
  0,
  NOW()
FROM "Product";
