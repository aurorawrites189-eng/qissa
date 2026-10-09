-- ============================================================================
-- Qissa — seed data: story categories
-- Apply after the main schema:  supabase/migrations/0001_schema.sql
-- Safe to re-run: ON CONFLICT (slug) DO NOTHING keeps existing rows intact.
-- ============================================================================

insert into public.categories (slug, name_en, name_ur, is_kids)
values
  -- Kids' categories (is_kids = true) ---------------------------------------
  ('moral-stories',   'Moral Stories',     'اخلاقی کہانیاں',        true),
  ('animal-stories',  'Animal Stories',    'جانوروں کی کہانیاں',     true),
  ('fairy-tales',     'Fairy Tales',       'پریوں کی کہانیاں',        true),
  ('adventure',       'Adventure',         'مہم جوئی',               true),
  ('kindness',        'Kindness',          'مہربانی',                true),
  ('educational',     'Educational',       'تعلیمی',                 true),
  ('science-nature',  'Science & Nature',  'سائنس اور فطرت',          true),
  ('bedtime',         'Bedtime Stories',   'سونے سے پہلے کی کہانیاں', true),
  -- General categories (is_kids = false) ------------------------------------
  ('articles',        'Articles',          'مضامین',                 false),
  ('short-stories',   'Short Stories',     'افسانے',                 false),
  ('poetry',          'Poetry',            'شاعری',                  false),
  ('essays',          'Essays',            'مقالات',                 false),
  ('travel',          'Travel',            'سفرنامے',                false),
  ('technology',      'Technology',        'ٹیکنالوجی',              false)
on conflict (slug) do nothing;
