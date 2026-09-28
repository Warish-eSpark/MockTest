USE mock_test_platform;

INSERT INTO countries (name, code) VALUES ('India', 'IN') ON DUPLICATE KEY UPDATE name = VALUES(name);
INSERT INTO sectors (name, slug) VALUES ('Education', 'education'), ('Government', 'government') ON DUPLICATE KEY UPDATE name = VALUES(name);
INSERT INTO categories (sector_id, name, slug)
SELECT s.id, 'Teaching', 'teaching' FROM sectors s WHERE s.slug = 'education'
ON DUPLICATE KEY UPDATE name = VALUES(name);

INSERT INTO organizations (country_id, name, slug)
SELECT c.id, 'Bihar Public Service Commission', 'bpsc' FROM countries c WHERE c.code = 'IN'
ON DUPLICATE KEY UPDATE name = VALUES(name);
INSERT INTO organizations (country_id, name, slug)
SELECT c.id, 'Bihar School Examination Board', 'bseb' FROM countries c WHERE c.code = 'IN'
ON DUPLICATE KEY UPDATE name = VALUES(name);
INSERT INTO organizations (country_id, name, slug)
SELECT c.id, 'Central Board of Secondary Education', 'cbse' FROM countries c WHERE c.code = 'IN'
ON DUPLICATE KEY UPDATE name = VALUES(name);

INSERT INTO exams (country_id, category_id, organization_id, name, slug, status, badge, visual_tone, visual_symbol)
SELECT c.id, cat.id, org.id, 'BPSC TRE 4.0', 'bpsc-tre-4', 'published', 'Popular', 'saffron', '✦'
FROM countries c JOIN categories cat ON cat.slug = 'teaching' JOIN organizations org ON org.slug = 'bpsc'
ON DUPLICATE KEY UPDATE status = VALUES(status), badge = VALUES(badge);
INSERT INTO exams (country_id, category_id, organization_id, name, slug, status, badge, visual_tone, visual_symbol)
SELECT c.id, cat.id, org.id, 'Bihar STET', 'bihar-stet', 'published', 'Trending', 'blue', '◒'
FROM countries c JOIN categories cat ON cat.slug = 'teaching' JOIN organizations org ON org.slug = 'bseb'
ON DUPLICATE KEY UPDATE status = VALUES(status), badge = VALUES(badge);
INSERT INTO exams (country_id, category_id, organization_id, name, slug, status, badge, visual_tone, visual_symbol)
SELECT c.id, cat.id, org.id, 'CTET', 'ctet', 'published', 'New series', 'mint', '⌁'
FROM countries c JOIN categories cat ON cat.slug = 'teaching' JOIN organizations org ON org.slug = 'cbse'
ON DUPLICATE KEY UPDATE status = VALUES(status), badge = VALUES(badge);