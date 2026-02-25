-- MySQL Database Setup Script
-- ================================
-- Run this in MySQL before starting the Node.js server.
--
-- HOW TO RUN:
--   Option 1 (command line):
--     mysql -u root -p < setup_database.sql
--
--   Option 2 (MySQL Workbench):
--     Open this file and click "Execute"
--
--   Option 3 (phpMyAdmin):
--     Go to SQL tab, paste contents, click Go

-- Create database
CREATE DATABASE IF NOT EXISTS age_gender_db;
USE age_gender_db;

-- Create predictions table
CREATE TABLE IF NOT EXISTS predictions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    image_name VARCHAR(255) NOT NULL,
    predicted_age INT NOT NULL,
    predicted_gender VARCHAR(10) NOT NULL,
    gender_confidence FLOAT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create index for faster queries
CREATE INDEX idx_created_at ON predictions(created_at);
CREATE INDEX idx_gender ON predictions(predicted_gender);

-- Verify setup
SELECT 'Database setup complete!' as message;
SHOW TABLES;
