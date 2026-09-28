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