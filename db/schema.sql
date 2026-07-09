-- Longbourn Commerce Stack — Phase 1 schema (catalog + consignment orders)
CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  handle TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  description_html TEXT DEFAULT '',
  product_type TEXT DEFAULT '',
  tags_json TEXT DEFAULT '[]',
  images_json TEXT DEFAULT '[]',
  price_min_cents INTEGER NOT NULL,
  price_max_cents INTEGER NOT NULL,
  currency TEXT DEFAULT 'USD',
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS variants (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL REFERENCES products(id),
  title TEXT NOT NULL,
  price_cents INTEGER NOT NULL,
  currency TEXT DEFAULT 'USD',
  available INTEGER NOT NULL DEFAULT 1,
  image_json TEXT,
  selected_options_json TEXT DEFAULT '[]',
  wholesale_cents INTEGER NOT NULL,  -- consignment: owed to Longbourn per unit sold (50% MSRP)
  position INTEGER NOT NULL DEFAULT 0,
  tags_json TEXT DEFAULT '[]'  -- design-level occasion tags (holiday/thank-you/sympathy/celebration/baby); drives occasion-collection filtering
);
CREATE INDEX IF NOT EXISTS idx_variants_product ON variants(product_id);
-- consigned stock: Wicko holds it, Longbourn owns it until sold; quantity NULL = not yet counted
CREATE TABLE IF NOT EXISTS inventory (
  variant_id TEXT PRIMARY KEY REFERENCES variants(id),
  quantity INTEGER,
  updated_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS collections (
  handle TEXT PRIMARY KEY,
  id TEXT,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  image_json TEXT,
  position INTEGER DEFAULT 0,
  curated INTEGER DEFAULT 0  -- 0 = auto/default membership, 1 = human-curated (Phase 6)
);
CREATE TABLE IF NOT EXISTS collection_products (
  collection_handle TEXT NOT NULL REFERENCES collections(handle),
  product_id TEXT NOT NULL REFERENCES products(id),
  position INTEGER DEFAULT 0,
  PRIMARY KEY (collection_handle, product_id)
);
-- Phase 2+ (created now so the schema ships once)
CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  stripe_session_id TEXT UNIQUE,
  email TEXT, customer_name TEXT, ship_to_json TEXT,
  subtotal_cents INTEGER, shipping_cents INTEGER DEFAULT 0, tax_cents INTEGER DEFAULT 0, total_cents INTEGER,
  currency TEXT DEFAULT 'USD',
  status TEXT NOT NULL DEFAULT 'new',  -- new|packed|shipped|delivered|refunded
  tracking_number TEXT, label_r2_key TEXT,
  settled_month TEXT,  -- YYYY-MM once included in a Longbourn consignment statement
  created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS order_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id TEXT NOT NULL REFERENCES orders(id),
  variant_id TEXT NOT NULL,
  product_title TEXT, variant_title TEXT,
  quantity INTEGER NOT NULL,
  unit_price_cents INTEGER NOT NULL,
  wholesale_cents INTEGER NOT NULL  -- snapshot at time of sale: settlement uses THIS, not current price
);
CREATE TABLE IF NOT EXISTS order_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id TEXT NOT NULL,
  event TEXT NOT NULL,
  detail TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS config (key TEXT PRIMARY KEY, value TEXT);
