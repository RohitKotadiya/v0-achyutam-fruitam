-- Add dynamic categories table and migrate existing data

-- Create 4 default categories matching the original system
INSERT INTO "ProductCategory" (id, name, "displayName", description, "sortOrder", color, icon, "isActive", "createdAt", "updatedAt")
VALUES
  (gen_random_uuid()::text, 'fruit_bomb', 'Fruit Bomb', 'Fresh fruit bombs with ice cream', 1, '#f59e0b', '🍊', true, NOW(), NOW()),
  (gen_random_uuid()::text, 'ice_cream', 'Real Fruit Ice Cream', 'Premium real fruit ice cream slices', 2, '#ec4899', '🍨', true, NOW(), NOW()),
  (gen_random_uuid()::text, 'kulfi', 'Kulfi', 'Traditional Indian kulfi', 3, '#8b5cf6', '🍡', true, NOW(), NOW()),
  (gen_random_uuid()::text, 'mix_dish', 'Mix Dish', 'Custom mix dish creations', 4, '#10b981', '🍧', true, NOW(), NOW());

-- Update existing products to use dynamic category IDs
UPDATE "Product" SET "categoryId" = (SELECT id FROM "ProductCategory" WHERE name = 'fruit_bomb') WHERE "category" = 'FRUIT_BOMB';
UPDATE "Product" SET "categoryId" = (SELECT id FROM "ProductCategory" WHERE name = 'ice_cream') WHERE "category" = 'ICE_CREAM';
UPDATE "Product" SET "categoryId" = (SELECT id FROM "ProductCategory" WHERE name = 'kulfi') WHERE "category" = 'KULFI';
UPDATE "Product" SET "categoryId" = (SELECT id FROM "ProductCategory" WHERE name = 'mix_dish') WHERE "category" = 'MIX_DISH';
