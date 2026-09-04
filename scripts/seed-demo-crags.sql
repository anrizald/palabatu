-- Dummy seed data for local dev: real, well-documented outdoor climbing
-- spots in Indonesia, used to eyeball the directory/map with content that
-- actually looks like the app's vibe instead of placeholder text. Skews
-- toward bouldering and single-pitch toprope/sport crags on purpose --
-- palabatu's actual audience is Indonesian bouldering enthusiasts (see
-- PRODUCT.md), so Gunung Parang (a genuine multi-pitch big wall) is kept
-- as one deliberate outlier rather than the template for the rest. Not a
-- migration -- run by hand against the local Docker DB (never against
-- DATABASE_URL if it points at Neon/production):
--
--   docker exec -i kepalabatu-postgres-1 psql -U user -d palabatu -f - < scripts/seed-demo-crags.sql
--
-- Idempotent: deletes any previous run of this same seed (by crag name)
-- before inserting, so it's safe to re-run after tweaking it.
--
-- Sources (coordinates + facts, checked 2026-09-04):
--   Citatah Cliffs   -- https://en.wikipedia.org/wiki/Citatah_Cliffs
--   Mount Parang     -- https://en.wikipedia.org/wiki/Mount_Parang
--   Siung Beach      -- https://en.wikipedia.org/wiki/Siung_Beach
--   Gunung Batu (Lembang) -- https://climbingaway.fr/en/climbing-areas/gunung-batu
--   Klapanunggal     -- https://www.mountainproject.com/area/120693580/klapanunggal,
--                        https://www.thecrag.com/en/climbing/indonesia/area/5131561908
--   Tebing Suwuk (Kebumen) -- https://www.uplmpaunsoed.com/2024/05/menancapkan-cakar-pada-karang-58-tebing.html
-- Photos are real, CC-BY-SA licensed images from Wikimedia Commons
-- (hotlinked from upload.wikimedia.org -- fine for local dev viewing;
-- swap for real Cloudinary uploads before anything is ever public).
-- Route names/grades below are illustrative, not a claim of an exact real
-- topo -- the crag/rock facts (location, rock type, real grade ranges,
-- climbing style) are the real part.

DO $$
DECLARE
    v_owner uuid := (SELECT id FROM users WHERE username = 'anrizald' LIMIT 1);
    v_citatah_crag uuid;
    v_citatah_wall uuid;
    v_parang_crag uuid;
    v_parang_wall uuid;
    v_siung_crag uuid;
    v_siung_wall uuid;
    v_gnbatu_crag uuid;
    v_gnbatu_boulder uuid;
    v_klapa_crag uuid;
    v_klapa_wall uuid;
    v_suwuk_crag uuid;
    v_suwuk_wall uuid;
BEGIN
    -- Clean up any previous run of this seed first. problems.crag_id_fkey/
    -- boulder_id_fkey have no ON DELETE CASCADE (unlike boulders.crag_id_fkey),
    -- so problems must go before crags.
    DELETE FROM problems WHERE crag_id IN (SELECT id FROM crags WHERE name IN ('Tebing Citatah 48', 'Gunung Parang', 'Pantai Siung', 'Gunung Batu (Lembang)', 'Klapanunggal', 'Tebing Suwuk'));
    DELETE FROM crags WHERE name IN ('Tebing Citatah 48', 'Gunung Parang', 'Pantai Siung', 'Gunung Batu (Lembang)', 'Klapanunggal', 'Tebing Suwuk');

    -- 1. Tebing Citatah 48 -- Padalarang, West Bandung Regency, West Java.
    -- Limestone karst, ~48m, the most beginner-friendly of the three
    -- Citatah cliffs (48/90/125), ~25 routes, warm-up area and toilets
    -- on site.
    INSERT INTO crags (id, name, lat, lng, directions, access_notes, created_by, image_urls)
    VALUES (
        gen_random_uuid(),
        'Tebing Citatah 48',
        -6.8234, 107.4362,
        'From Padalarang, head toward Cipatat on the Bandung-Cianjur highway (Jl. Raya Padalarang-Cianjur); the karst cliffs are on the roadside around Citatah village, about 5km out. Marked by roadside limestone quarries.',
        'On-site warm-up area and toilets. Beginner-friendly compared to Citatah 90/125 nearby. Local guides available.',
        v_owner,
        '["https://upload.wikimedia.org/wikipedia/commons/e/e4/Bukit_Kapur_-_Marmer%2C_Citatah_Cipatat%2C_Kab._Bandung_Barat_-_panoramio.jpg"]'::jsonb
    ) RETURNING id INTO v_citatah_crag;

    INSERT INTO boulders (id, crag_id, name, image_urls, rock_type, type, created_by)
    VALUES (
        gen_random_uuid(), v_citatah_crag, 'Dinding Utama (Main Wall)',
        '["https://upload.wikimedia.org/wikipedia/commons/b/b0/Stone_Garden%2C_Citatah%2C_Padalarang%2C_25022017.jpg"]'::jsonb,
        'limestone', 'wall', v_owner
    ) RETURNING id INTO v_citatah_wall;

    INSERT INTO problems (id, name, grade, boulder_id, crag_id, descent, notes, created_by) VALUES
        (gen_random_uuid(), 'Jalur Pemula', '5+', v_citatah_wall, v_citatah_crag, 'Walk-off from the top.', 'Good first route, positive holds throughout.', v_owner),
        (gen_random_uuid(), 'Sisi Kanan', '6a', v_citatah_wall, v_citatah_crag, 'Walk-off from the top.', 'Technical footwork on the right-hand line.', v_owner),
        (gen_random_uuid(), 'Overhang Kecil', '6b+', v_citatah_wall, v_citatah_crag, 'Lower off, walk-off also possible.', 'Short bulge two-thirds up, otherwise pretty juggy.', v_owner);

    -- 2. Gunung Parang -- Purwakarta Regency, West Java. Andesite monolith
    -- between the two arms of the Jatiluhur Reservoir, "the Mecca of
    -- Indonesian rock climbing" since the sport started here in 1980s
    -- Indonesia. Three towers, 600m of cliff. Also hosts one of Southeast
    -- Asia's tallest via ferrata routes.
    INSERT INTO crags (id, name, lat, lng, directions, access_notes, created_by, image_urls)
    VALUES (
        gen_random_uuid(),
        'Gunung Parang',
        -6.591389, 107.346667,
        'Purwakarta Regency, about 2 hours from Bandung / 3 hours from Jakarta, between the two arms of Jatiluhur Reservoir. Sky Cave / Badega Gunung Parang basecamp marks the start.',
        'Managed by the local community group Badega Gunung Parang. Best climbing season June-October (lower rainfall). Hot and humid midday -- start early.',
        v_owner,
        '["https://upload.wikimedia.org/wikipedia/commons/1/19/Gunung_Parang%2C_Purwakarta%2C_Jawa_Barat.jpg"]'::jsonb
    ) RETURNING id INTO v_parang_crag;

    INSERT INTO boulders (id, crag_id, name, image_urls, rock_type, type, created_by)
    VALUES (
        gen_random_uuid(), v_parang_crag, 'Menara 2 (Tower 2)',
        '["https://upload.wikimedia.org/wikipedia/commons/a/ab/Mount_Parang_Cliff.jpg", "https://upload.wikimedia.org/wikipedia/commons/7/76/Mount_Parang_Via_Ferrata.jpg"]'::jsonb,
        'andesite', 'wall', v_owner
    ) RETURNING id INTO v_parang_wall;

    -- The one deliberate non-boulder/non-toprope entry in this seed: Gunung
    -- Parang's cliffs run up to 600m, so any real line here is genuinely
    -- multi-pitch (10+ rope-lengths), not a short single-pitch sport route.
    -- height_m below is a conservative estimate inside that documented
    -- range, not a claim of an exact measured topo -- exact per-route
    -- length/pitch count isn't available from the sources above.
    INSERT INTO problems (id, name, grade, boulder_id, crag_id, height_m, landing_hazards, notes, created_by) VALUES
        (gen_random_uuid(), 'Jalur Klasik', '6a+', v_parang_wall, v_parang_crag, 300, NULL, 'One of the original lines up the tower. Multi-pitch, roughly 10 pitches to the top -- bring a full rack and plan for a full day.', v_owner),
        (gen_random_uuid(), 'Menara Tengah', '6c', v_parang_wall, v_parang_crag, 380, NULL, 'Sustained face climbing over many pitches, scant holds as the rock is known for.', v_owner),
        (gen_random_uuid(), 'Scant Holds', '7a', v_parang_wall, v_parang_crag, 420, 'Loose rock reported on the upper pitches -- test holds.', 'Hardest line on this face, small crimps only, multi-pitch to the summit.', v_owner);

    -- 3. Pantai Siung (Siung Beach) -- Tepus, Gunungkidul Regency,
    -- Yogyakarta. Limestone sea cliffs, ~250 bolted routes across blocks
    -- A-K, YDS 5.9-5.13. Most popular climbing area in the Yogyakarta
    -- region.
    INSERT INTO crags (id, name, lat, lng, directions, access_notes, created_by, image_urls)
    VALUES (
        gen_random_uuid(),
        'Pantai Siung',
        -8.18194, 110.68278,
        'Via the Yogyakarta-Wonosari-Tepus route, about 3 hours / 70km from Yogyakarta city. Entrance ticket booth at the road in. Public bus to Wonosari, then ojek for the final stretch.',
        'Entrance fee at the gate. Basic facilities (parking, toilets, food stalls); "Kedai Panjat Moro Seneng" nearby for lodging/showers. Some bolts and anchors around the crag are old and corroded -- inspect before committing, especially on less-travelled lines.',
        v_owner,
        '["https://upload.wikimedia.org/wikipedia/commons/1/1b/Pantai_Siung_Gunung_Kidul_Yogyakarta.jpg"]'::jsonb
    ) RETURNING id INTO v_siung_crag;

    INSERT INTO boulders (id, crag_id, name, image_urls, rock_type, type, created_by)
    VALUES (
        gen_random_uuid(), v_siung_crag, 'Blok A',
        '["https://upload.wikimedia.org/wikipedia/commons/a/a7/WATU_TOGOG_PANTAI_SIUNG.jpg"]'::jsonb,
        'limestone', 'wall', v_owner
    ) RETURNING id INTO v_siung_wall;

    INSERT INTO problems (id, name, grade, boulder_id, crag_id, landing_hazards, notes, created_by) VALUES
        (gen_random_uuid(), 'Blok A Slab', '5.9', v_siung_wall, v_siung_crag, NULL, 'Easy-angle slab, good route to warm up on before the steeper blocks.', v_owner),
        (gen_random_uuid(), 'Karang Berduri', '5.11a', v_siung_wall, v_siung_crag, 'Sharp pockets, tape recommended.', 'Sea-cliff limestone with pockets and sharp edges.', v_owner),
        (gen_random_uuid(), 'Overhang Laut', '5.12c', v_siung_wall, v_siung_crag, 'Check bolts/hangers before clipping -- corrosion reported on older hardware crag-wide.', 'Steep, powerful moves out the roof.', v_owner);

    -- 4. Gunung Batu (Lembang) -- Bandung Barat, West Java. Andesite
    -- outcrop, genuinely a bouldering destination: 10-25 problems from
    -- Font 3a to 6c, up to ~25m tall (some highball), 5-minute approach,
    -- kids-friendly. This is the app's core audience's spot.
    INSERT INTO crags (id, name, lat, lng, directions, access_notes, created_by, image_urls)
    VALUES (
        gen_random_uuid(),
        'Gunung Batu (Lembang)',
        -6.830413, 107.635168,
        'Lembang, Bandung Barat. Short (~5 minute) uphill approach from the roadside parking.',
        'Kid-friendly approach and terrain. Landings are uneven/steep in places -- bring a crash pad and a spotter, don''t rely on bare ground.',
        v_owner,
        '["https://upload.wikimedia.org/wikipedia/commons/a/a9/Gunung_Batu.jpg"]'::jsonb
    ) RETURNING id INTO v_gnbatu_crag;

    INSERT INTO boulders (id, crag_id, name, image_urls, rock_type, type, created_by)
    VALUES (
        gen_random_uuid(), v_gnbatu_crag, 'Boulder Utama',
        '[]'::jsonb, 'andesite', 'boulder', v_owner
    ) RETURNING id INTO v_gnbatu_boulder;

    INSERT INTO problems (id, name, grade, boulder_id, crag_id, notes, created_by) VALUES
        (gen_random_uuid(), 'Jugs Warmup', '5', v_gnbatu_boulder, v_gnbatu_crag, 'Big jugs and side pulls, good first problem of the session.', v_owner),
        (gen_random_uuid(), 'Dihedral Kanan', '6A', v_gnbatu_boulder, v_gnbatu_crag, 'Corner/dihedral feature, crimps and pockets.', v_owner),
        (gen_random_uuid(), 'Sloper Problem', '6B+', v_gnbatu_boulder, v_gnbatu_crag, 'Slopers over a bulge, needs good footwork more than power.', v_owner);

    -- 5. Klapanunggal -- Bogor Regency, West Java, ~50km southeast of
    -- Jakarta. Old limestone quarry faces turned climbing area, the spot
    -- for Jabotabek climbers since the 1980s. "Arpam Arch" mixes moderate
    -- limestone lines with harder roof climbs.
    INSERT INTO crags (id, name, lat, lng, directions, access_notes, created_by, image_urls)
    VALUES (
        gen_random_uuid(),
        'Klapanunggal',
        -6.4704, 106.94848,
        'From Jakarta, take the Jagorawi toll, exit toward Cileungsi/Klapanunggal. About 50km southeast of Jakarta.',
        'Some original cliffs (tebing depan) were destroyed by ongoing limestone mining -- confirm an area is still standing before heading out. Camping possible on site; abandoned mining huts and mess buildings around.',
        v_owner,
        '["https://upload.wikimedia.org/wikipedia/commons/b/b4/Bukit_karst_klapanunggal.jpg"]'::jsonb
    ) RETURNING id INTO v_klapa_crag;

    INSERT INTO boulders (id, crag_id, name, image_urls, rock_type, type, created_by)
    VALUES (
        gen_random_uuid(), v_klapa_crag, 'Arpam Arch',
        '["https://upload.wikimedia.org/wikipedia/commons/2/29/Bekas_Tambang_Batu_Kapur_di_Klapanunggal%2C_Bogor.jpg"]'::jsonb,
        'limestone', 'wall', v_owner
    ) RETURNING id INTO v_klapa_wall;

    INSERT INTO problems (id, name, grade, boulder_id, crag_id, notes, created_by) VALUES
        (gen_random_uuid(), 'Arch Moderate', '5+', v_klapa_wall, v_klapa_crag, 'One of the friendlier lines through the arch, good toprope for beginners.', v_owner),
        (gen_random_uuid(), 'Quarry Face', '6a', v_klapa_wall, v_klapa_crag, 'Old quarry wall, positive edges most of the way.', v_owner),
        (gen_random_uuid(), 'Into the Roof', '7a+', v_klapa_wall, v_klapa_crag, 'One of the newer, harder lines into the roof of the arch.', v_owner);

    -- 6. Tebing Suwuk -- Desa Logending, Kecamatan Ayah, Kabupaten Kebumen,
    -- Central Java. Karst rock, two facing sides (an 8m easier side and a
    -- 20m taller side with fewer holds), no fixed bolts/hangers -- trad
    -- gear only. Same coastal karst belt as the well-known Karang Bolong
    -- caves nearby.
    INSERT INTO crags (id, name, lat, lng, directions, access_notes, created_by, image_urls)
    VALUES (
        gen_random_uuid(),
        'Tebing Suwuk',
        -7.72972, 109.39583,
        'Desa Logending, Kecamatan Ayah, Kabupaten Kebumen. Short walk from roadside food stalls to the cliff base.',
        'No fixed hangers/bolts on the rock -- bring removable trad protection. Flat area between the two cliff faces fits about 3 tents for camping.',
        v_owner,
        '["https://upload.wikimedia.org/wikipedia/commons/4/44/Gua_Karang_Bolong_di_Kabupaten_Kebumen_Indonesia.jpg"]'::jsonb
    ) RETURNING id INTO v_suwuk_crag;

    INSERT INTO boulders (id, crag_id, name, image_urls, rock_type, type, created_by)
    VALUES (
        gen_random_uuid(), v_suwuk_crag, 'Sisi Pendek (Short Side)',
        '[]'::jsonb, 'limestone', 'wall', v_owner
    ) RETURNING id INTO v_suwuk_wall;

    INSERT INTO problems (id, name, grade, boulder_id, crag_id, height_m, notes, created_by) VALUES
        (gen_random_uuid(), 'Jalur Awal', '5.4', v_suwuk_wall, v_suwuk_crag, 8, 'Plenty of hand and foot holds, good beginner toprope on the shorter face.', v_owner),
        (gen_random_uuid(), 'Sisi Tinggi', '5.8', v_suwuk_wall, v_suwuk_crag, 20, 'The taller, smoother face -- fewer holds and more vertical than the short side.', v_owner);

    RAISE NOTICE 'Seeded 6 crags: Tebing Citatah 48 (%), Gunung Parang (%), Pantai Siung (%), Gunung Batu Lembang (%), Klapanunggal (%), Tebing Suwuk (%)',
        v_citatah_crag, v_parang_crag, v_siung_crag, v_gnbatu_crag, v_klapa_crag, v_suwuk_crag;
END $$;
