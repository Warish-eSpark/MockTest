CREATE DATABASE IF NOT EXISTS mock_test_platform CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE mock_test_platform;

CREATE TABLE IF NOT EXISTS countries (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(120) NOT NULL,
  code CHAR(2) NOT NULL UNIQUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sectors (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(120) NOT NULL,
  slug VARCHAR(140) NOT NULL UNIQUE,
  active TINYINT(1) NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS categories (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  sector_id BIGINT UNSIGNED NULL,
  name VARCHAR(120) NOT NULL,
  slug VARCHAR(140) NOT NULL UNIQUE,
  active TINYINT(1) NOT NULL DEFAULT 1,
  FOREIGN KEY (sector_id) REFERENCES sectors(id)
);

CREATE TABLE IF NOT EXISTS organizations (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  country_id BIGINT UNSIGNED NULL,
  name VARCHAR(180) NOT NULL,
  slug VARCHAR(200) NOT NULL UNIQUE,
  official_url VARCHAR(500) NULL,
  FOREIGN KEY (country_id) REFERENCES countries(id)
);

CREATE TABLE IF NOT EXISTS exams (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  country_id BIGINT UNSIGNED NULL,
  category_id BIGINT UNSIGNED NULL,
  organization_id BIGINT UNSIGNED NULL,
  name VARCHAR(180) NOT NULL,
  slug VARCHAR(200) NOT NULL UNIQUE,
  description TEXT NULL,
  status ENUM('draft', 'published', 'archived') NOT NULL DEFAULT 'draft',
  badge VARCHAR(40) NULL,
  visual_tone VARCHAR(30) NOT NULL DEFAULT 'saffron',
  visual_symbol VARCHAR(8) NOT NULL DEFAULT '✦',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (country_id) REFERENCES countries(id),
  FOREIGN KEY (category_id) REFERENCES categories(id),
  FOREIGN KEY (organization_id) REFERENCES organizations(id),
  INDEX idx_exams_discovery (status, category_id, updated_at)
);

CREATE TABLE IF NOT EXISTS exam_editions (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  exam_id BIGINT UNSIGNED NOT NULL,
  name VARCHAR(180) NOT NULL,
  slug VARCHAR(200) NOT NULL UNIQUE,
  status ENUM('draft', 'published', 'archived') NOT NULL DEFAULT 'draft',
  exam_date DATE NULL,
  source_url VARCHAR(500) NULL,
  FOREIGN KEY (exam_id) REFERENCES exams(id),
  INDEX idx_editions_exam (exam_id, status)
);

CREATE TABLE IF NOT EXISTS subjects (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  exam_id BIGINT UNSIGNED NOT NULL,
  name VARCHAR(160) NOT NULL,
  slug VARCHAR(180) NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  FOREIGN KEY (exam_id) REFERENCES exams(id),
  UNIQUE KEY uq_subject_exam_slug (exam_id, slug)
);

CREATE TABLE IF NOT EXISTS topics (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  subject_id BIGINT UNSIGNED NOT NULL,
  parent_id BIGINT UNSIGNED NULL,
  name VARCHAR(160) NOT NULL,
  slug VARCHAR(180) NOT NULL,
  FOREIGN KEY (subject_id) REFERENCES subjects(id),
  FOREIGN KEY (parent_id) REFERENCES topics(id),
  UNIQUE KEY uq_topic_subject_slug (subject_id, slug)
);

CREATE TABLE IF NOT EXISTS rule_profiles (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  exam_id BIGINT UNSIGNED NOT NULL,
  version INT NOT NULL,
  name VARCHAR(160) NOT NULL,
  option_count TINYINT UNSIGNED NOT NULL DEFAULT 4,
  marks_per_correct DECIMAL(8,3) NOT NULL DEFAULT 1,
  penalty_wrong DECIMAL(8,3) NOT NULL DEFAULT 0,
  penalty_unanswered DECIMAL(8,3) NOT NULL DEFAULT 0,
  special_option_key CHAR(1) NULL,
  penalty_special DECIMAL(8,3) NOT NULL DEFAULT 0,
  source_url VARCHAR(500) NULL,
  effective_from DATE NULL,
  status ENUM('draft', 'published', 'archived') NOT NULL DEFAULT 'draft',
  FOREIGN KEY (exam_id) REFERENCES exams(id),
  UNIQUE KEY uq_rule_exam_version (exam_id, version)
);

CREATE TABLE IF NOT EXISTS test_series (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  exam_id BIGINT UNSIGNED NOT NULL,
  name VARCHAR(180) NOT NULL,
  slug VARCHAR(200) NOT NULL UNIQUE,
  description TEXT NULL,
  access_type ENUM('free', 'premium') NOT NULL DEFAULT 'free',
  status ENUM('draft', 'published', 'archived') NOT NULL DEFAULT 'draft',
  FOREIGN KEY (exam_id) REFERENCES exams(id),
  INDEX idx_series_exam_status (exam_id, status)
);

CREATE TABLE IF NOT EXISTS tests (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  test_series_id BIGINT UNSIGNED NOT NULL,
  rule_profile_id BIGINT UNSIGNED NOT NULL,
  name VARCHAR(180) NOT NULL,
  test_type ENUM('full', 'section', 'subject', 'topic', 'mini', 'pyq', 'live') NOT NULL,
  question_count INT UNSIGNED NOT NULL DEFAULT 0,
  duration_minutes INT UNSIGNED NOT NULL DEFAULT 0,
  total_marks DECIMAL(8,3) NOT NULL DEFAULT 0,
  status ENUM('draft', 'published', 'archived') NOT NULL DEFAULT 'draft',
  FOREIGN KEY (test_series_id) REFERENCES test_series(id),
  FOREIGN KEY (rule_profile_id) REFERENCES rule_profiles(id),
  INDEX idx_tests_catalog (test_series_id, status, test_type)
);

CREATE TABLE IF NOT EXISTS questions (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  subject_id BIGINT UNSIGNED NULL,
  topic_id BIGINT UNSIGNED NULL,
  stem TEXT NOT NULL,
  explanation TEXT NULL,
  status ENUM('draft', 'in_review', 'approved', 'published', 'archived') NOT NULL DEFAULT 'draft',
  version INT NOT NULL DEFAULT 1,
  FOREIGN KEY (subject_id) REFERENCES subjects(id),
  FOREIGN KEY (topic_id) REFERENCES topics(id),
  INDEX idx_questions_review (status, subject_id, topic_id)
);

CREATE TABLE IF NOT EXISTS question_options (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  question_id BIGINT UNSIGNED NOT NULL,
  option_key CHAR(1) NOT NULL,
  option_text TEXT NOT NULL,
  is_correct TINYINT(1) NOT NULL DEFAULT 0,
  sort_order TINYINT UNSIGNED NOT NULL,
  FOREIGN KEY (question_id) REFERENCES questions(id),
  UNIQUE KEY uq_question_option (question_id, option_key)
);

CREATE TABLE IF NOT EXISTS users (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  display_name VARCHAR(120) NOT NULL,
  role ENUM('student', 'editor', 'reviewer', 'admin') NOT NULL DEFAULT 'student',
  status ENUM('active', 'disabled') NOT NULL DEFAULT 'active',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS entitlements (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  test_series_id BIGINT UNSIGNED NULL,
  starts_at DATETIME NOT NULL,
  expires_at DATETIME NULL,
  source VARCHAR(40) NOT NULL DEFAULT 'purchase',
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (test_series_id) REFERENCES test_series(id),
  INDEX idx_entitlements_access (user_id, starts_at, expires_at)
);

CREATE TABLE IF NOT EXISTS exam_levels (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  exam_id BIGINT UNSIGNED NOT NULL,
  slug VARCHAR(160) NOT NULL,
  name VARCHAR(160) NOT NULL,
  audience VARCHAR(220) NULL,
  sort_order INT NOT NULL DEFAULT 0,
  FOREIGN KEY (exam_id) REFERENCES exams(id),
  UNIQUE KEY uq_exam_level (exam_id, slug)
);

CREATE TABLE IF NOT EXISTS subject_catalog (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(180) NOT NULL UNIQUE,
  slug VARCHAR(200) NOT NULL UNIQUE,
  description TEXT NULL
);

CREATE TABLE IF NOT EXISTS exam_level_subjects (
  exam_level_id BIGINT UNSIGNED NOT NULL,
  subject_id BIGINT UNSIGNED NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  PRIMARY KEY (exam_level_id, subject_id),
  FOREIGN KEY (exam_level_id) REFERENCES exam_levels(id),
  FOREIGN KEY (subject_id) REFERENCES subject_catalog(id)
);

CREATE TABLE IF NOT EXISTS subject_topics (
  subject_id BIGINT UNSIGNED NOT NULL,
  topic_id BIGINT UNSIGNED NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  PRIMARY KEY (subject_id, topic_id),
  FOREIGN KEY (subject_id) REFERENCES subject_catalog(id),
  FOREIGN KEY (topic_id) REFERENCES topics(id)
);

CREATE TABLE IF NOT EXISTS user_sessions (
  token_hash CHAR(64) PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  expires_at DATETIME NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id),
  INDEX idx_sessions_expiry (expires_at)
);

CREATE TABLE IF NOT EXISTS test_attempts (
  id CHAR(36) PRIMARY KEY,
  user_id BIGINT UNSIGNED NULL,
  test_slug VARCHAR(200) NOT NULL,
  test_title VARCHAR(200) NOT NULL,
  exam_name VARCHAR(180) NOT NULL,
  question_snapshot JSON NOT NULL,
  rule_snapshot JSON NOT NULL,
  answers JSON NOT NULL,
  reviewed JSON NOT NULL,
  duration_seconds INT UNSIGNED NOT NULL,
  started_at DATETIME NOT NULL,
  submitted_at DATETIME NULL,
  result_snapshot JSON NULL,
  FOREIGN KEY (user_id) REFERENCES users(id),
  INDEX idx_attempt_user (user_id, started_at),
  INDEX idx_attempt_test (test_slug, started_at)
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  actor_user_id BIGINT UNSIGNED NULL,
  action VARCHAR(80) NOT NULL,
  entity_type VARCHAR(80) NOT NULL,
  entity_id VARCHAR(120) NOT NULL,
  details JSON NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (actor_user_id) REFERENCES users(id),
  INDEX idx_audit_actor_date (actor_user_id, created_at),
  INDEX idx_audit_entity (entity_type, entity_id, created_at)
);

CREATE TABLE IF NOT EXISTS test_questions (
  test_id BIGINT UNSIGNED NOT NULL,
  question_id BIGINT UNSIGNED NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  marks DECIMAL(8,3) NULL,
  PRIMARY KEY (test_id, question_id),
  UNIQUE KEY uq_test_question_order (test_id, sort_order),
  FOREIGN KEY (test_id) REFERENCES tests(id),
  FOREIGN KEY (question_id) REFERENCES questions(id)
);

CREATE TABLE IF NOT EXISTS question_assets (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  question_id BIGINT UNSIGNED NOT NULL,
  option_id BIGINT UNSIGNED NULL,
  media_url VARCHAR(1000) NOT NULL,
  mime_type VARCHAR(120) NOT NULL,
  alt_text VARCHAR(300) NULL,
  sort_order INT NOT NULL DEFAULT 0,
  FOREIGN KEY (question_id) REFERENCES questions(id),
  FOREIGN KEY (option_id) REFERENCES question_options(id)
);

CREATE TABLE IF NOT EXISTS exam_notifications (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  exam_id BIGINT UNSIGNED NULL,
  title VARCHAR(240) NOT NULL,
  organization VARCHAR(180) NOT NULL,
  category VARCHAR(120) NOT NULL,
  summary TEXT NOT NULL,
  status ENUM('open', 'closing_soon', 'announced', 'closed') NOT NULL DEFAULT 'announced',
  published_at DATETIME NOT NULL,
  official_source_url VARCHAR(1000) NOT NULL,
  official_apply_url VARCHAR(1000) NULL,
  source_reference VARCHAR(200) NULL,
  created_by BIGINT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (exam_id) REFERENCES exams(id),
  FOREIGN KEY (created_by) REFERENCES users(id),
  INDEX idx_notifications_feed (status, published_at)
);

CREATE TABLE IF NOT EXISTS commerce_plans (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  slug VARCHAR(120) NOT NULL UNIQUE,
  name VARCHAR(160) NOT NULL,
  description TEXT NOT NULL,
  amount_minor INT UNSIGNED NOT NULL,
  currency CHAR(3) NOT NULL DEFAULT 'INR',
  validity_days INT UNSIGNED NULL,
  included_series JSON NULL,
  active TINYINT(1) NOT NULL DEFAULT 1,
  sale_starts_at DATETIME NULL,
  sale_ends_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS coupons (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  code VARCHAR(50) NOT NULL UNIQUE,
  discount_type ENUM('fixed', 'percentage') NOT NULL,
  discount_value DECIMAL(10,2) NOT NULL,
  starts_at DATETIME NULL,
  ends_at DATETIME NULL,
  max_uses INT UNSIGNED NULL,
  uses INT UNSIGNED NOT NULL DEFAULT 0,
  active TINYINT(1) NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS orders (
  id CHAR(36) PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  plan_id BIGINT UNSIGNED NOT NULL,
  coupon_id BIGINT UNSIGNED NULL,
  amount_minor INT UNSIGNED NOT NULL,
  currency CHAR(3) NOT NULL,
  status ENUM('created', 'pending', 'paid', 'failed', 'refunded') NOT NULL DEFAULT 'created',
  provider VARCHAR(40) NOT NULL,
  provider_order_id VARCHAR(180) NULL UNIQUE,
  provider_payment_id VARCHAR(180) NULL UNIQUE,
  tax_details JSON NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  paid_at DATETIME NULL,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (plan_id) REFERENCES commerce_plans(id),
  FOREIGN KEY (coupon_id) REFERENCES coupons(id),
  INDEX idx_orders_user_status (user_id, status, created_at)
);