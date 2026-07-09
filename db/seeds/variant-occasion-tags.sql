-- Design-level occasion tags (applied to prod D1 2026-07-08, padded same day)
-- Occasion collections (holiday, thank-you, sympathy, celebration, baby) filter
-- designs by these tags client-side (site/js/collection.js). Pack variants
-- ("Design / Single", "Design / 6-Pack") are matched by design-name prefix.
-- Re-runnable: idempotent UPDATEs.

-- holiday (seasonal)
UPDATE variants SET tags_json='["holiday"]' WHERE title='Merry Christmas' OR title LIKE 'Merry Christmas / %';
UPDATE variants SET tags_json='["holiday"]' WHERE title='Merry Christmas Banner' OR title LIKE 'Merry Christmas Banner / %';
UPDATE variants SET tags_json='["holiday"]' WHERE title='North Pole' OR title LIKE 'North Pole / %';
UPDATE variants SET tags_json='["holiday"]' WHERE title='Peace' OR title LIKE 'Peace / %';
UPDATE variants SET tags_json='["holiday"]' WHERE title='Star of David' OR title LIKE 'Star of David / %';
UPDATE variants SET tags_json='["holiday"]' WHERE title='Wheat Sheaf' OR title LIKE 'Wheat Sheaf / %';

-- thank-you
UPDATE variants SET tags_json='["thank-you"]' WHERE title='Thank You Grey' OR title LIKE 'Thank You Grey / %';
UPDATE variants SET tags_json='["thank-you"]' WHERE title='Thank You Pink' OR title LIKE 'Thank You Pink / %';
UPDATE variants SET tags_json='["thank-you"]' WHERE title='For You Wreath' OR title LIKE 'For You Wreath / %';
UPDATE variants SET tags_json='["thank-you"]' WHERE title='Teacup' OR title LIKE 'Teacup / %';
UPDATE variants SET tags_json='["thank-you"]' WHERE title='Teapot' OR title LIKE 'Teapot / %';

-- sympathy
UPDATE variants SET tags_json='["sympathy"]' WHERE title='Thinking of You' OR title LIKE 'Thinking of You / %';
UPDATE variants SET tags_json='["sympathy"]' WHERE title='Wishing You Well' OR title LIKE 'Wishing You Well / %';
UPDATE variants SET tags_json='["sympathy"]' WHERE title='Blossom' OR title LIKE 'Blossom / %';
UPDATE variants SET tags_json='["sympathy"]' WHERE title='Floral Wreath' OR title LIKE 'Floral Wreath / %';
UPDATE variants SET tags_json='["sympathy"]' WHERE title='Hummingbird' OR title LIKE 'Hummingbird / %';

-- celebration
UPDATE variants SET tags_json='["celebration"]' WHERE title='Bravo' OR title LIKE 'Bravo / %';
UPDATE variants SET tags_json='["celebration"]' WHERE title='Celebrate' OR title LIKE 'Celebrate / %';
UPDATE variants SET tags_json='["celebration"]' WHERE title='Congratulations' OR title LIKE 'Congratulations / %';
UPDATE variants SET tags_json='["celebration"]' WHERE title='Happy Birthday - Grey' OR title LIKE 'Happy Birthday - Grey / %';
UPDATE variants SET tags_json='["celebration"]' WHERE title='Happy Birthday - Pink' OR title LIKE 'Happy Birthday - Pink / %';
UPDATE variants SET tags_json='["celebration"]' WHERE title='Birthday Cake' OR title LIKE 'Birthday Cake / %';
UPDATE variants SET tags_json='["celebration"]' WHERE title='Hearts' OR title LIKE 'Hearts / %';
UPDATE variants SET tags_json='["celebration"]' WHERE title='Love you' OR title LIKE 'Love you / %';
UPDATE variants SET tags_json='["celebration"]' WHERE title='Kiss Me' OR title LIKE 'Kiss Me / %';

-- baby
UPDATE variants SET tags_json='["baby"]' WHERE title='For Baby Lamb' OR title LIKE 'For Baby Lamb / %';
UPDATE variants SET tags_json='["baby"]' WHERE title='Welcome Little One' OR title LIKE 'Welcome Little One / %';
UPDATE variants SET tags_json='["baby"]' WHERE title='Baby Blue' OR title LIKE 'Baby Blue / %';
UPDATE variants SET tags_json='["baby"]' WHERE title='Baby Blush' OR title LIKE 'Baby Blush / %';
UPDATE variants SET tags_json='["baby"]' WHERE title='Dream' OR title LIKE 'Dream / %';
