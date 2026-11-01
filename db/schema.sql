create extension if not exists "pgcrypto";

create table if not exists profile (
  id int primary key default 1,
  name text,
  gender_pref text default 'women',        -- women | men | unisex
  city text default 'Bengaluru',
  budget_band text default 'mid',          -- budget (<₹1000) | mid (₹1000–3000) | premium (₹3000+)
  aesthetics text[] default '{}',
  notes text,                              -- e.g. "prefer modest necklines", "petite"
  updated_at timestamptz default now()
);

create table if not exists uploads (
  id uuid primary key default gen_random_uuid(),
  original_url text not null,
  width int, height int,
  content_hash text,               -- sha256 of the original file (seed script skips duplicates)
  created_at timestamptz default now()
);
alter table uploads add column if not exists content_hash text;

create table if not exists items (
  id uuid primary key default gen_random_uuid(),
  upload_id uuid references uploads(id) on delete cascade,
  cutout_url text,                 -- transparent PNG cutout (main image)
  crop_url text not null,          -- padded rectangle crop (fallback)
  cutout_method text,              -- gemini_mask | browser_bg_removal | crop_only
  bbox jsonb,                      -- {x,y,w,h} normalised 0..1
  category text not null,
  subcategory text,
  primary_color text,
  primary_color_hex text,
  secondary_colors text[] default '{}',
  pattern text, sleeve_length text, sleeve_style text, neckline text,
  fit text, length text, rise text, fabric text, wash text,
  embellishment text, style text, metal_tone text,
  occasion text[] default '{}',
  season text[] default '{}',
  formality int,
  aesthetic text[] default '{}',
  brand_visible text, size text, description text,
  confidence real,
  user_edited boolean default false,
  times_suggested int default 0,
  created_at timestamptz default now()
);

create table if not exists outfits (
  id uuid primary key default gen_random_uuid(),
  name text, style_tag text, occasion text,
  reasoning text, missing_piece text, color_story text,
  item_ids uuid[] not null,
  board_url text,                  -- rendered outfit board PNG
  source text,                     -- anchor | occasion | agent | daily
  is_favorite boolean default false,
  created_at timestamptz default now()
);

create table if not exists trends (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null,          -- one research run
  period text not null,            -- daily | weekly
  title text not null,             -- "Halter-neck tops"
  category text,                   -- taxonomy category
  match_attributes jsonb,          -- taxonomy values, e.g. {"subcategory":["crop_top","tank_top"],"neckline":["halter"]}
  summary text,                    -- what it is
  why_now text,                    -- why it's trending
  how_to_style text,
  heat int,                        -- 1–5
  price_band text,
  search_query text,               -- "white halter neck lace top women"
  sources jsonb,                   -- [{title, url}]
  created_at timestamptz default now()
);

-- Which category group a trend came from (so a daily refresh of 2–3 groups doesn't hide the others).
alter table trends add column if not exists group_key text;

create table if not exists trend_matches (
  trend_id uuid references trends(id) on delete cascade,
  status text,                     -- owned | missing
  owned_item_ids uuid[] default '{}',
  pairs_with_item_ids uuid[] default '{}',
  note text,
  primary key (trend_id)
);

create table if not exists drops (
  id uuid primary key default gen_random_uuid(),
  period text not null,            -- daily | weekly
  for_date date not null,
  outfit_id uuid references outfits(id) on delete set null,
  payload jsonb,                   -- headline, intro, trend ids, smart buys
  created_at timestamptz default now(),
  unique (period, for_date)
);

create table if not exists wishlist (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  category text,
  attributes jsonb,
  why text,
  pairs_with_item_ids uuid[] default '{}',
  trend_id uuid references trends(id) on delete set null,
  search_query text,
  price_band text,
  bought boolean default false,
  created_at timestamptz default now()
);

create table if not exists chat_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null,
  role text not null,              -- user | assistant
  content text,
  cards jsonb,                     -- items, outfits, buy suggestions, sources rendered in the UI
  created_at timestamptz default now()
);

create index if not exists items_category_idx on items (category);
create index if not exists trends_batch_idx on trends (batch_id);
create index if not exists trends_created_idx on trends (created_at desc);
create index if not exists trends_group_idx on trends (group_key, created_at desc);
create index if not exists chat_thread_idx on chat_messages (thread_id, created_at);

insert into profile (id) values (1) on conflict (id) do nothing;
