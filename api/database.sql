DROP DATABASE expense_tracker;
CREATE DATABASE IF NOT EXISTS expense_tracker;
USE expense_tracker;

-- ==========================================
-- USERS
-- ==========================================
CREATE TABLE users (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(50) NOT NULL,
    age INT,
    email VARCHAR(100) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ==========================================
-- USER SETTINGS
-- ==========================================
CREATE TABLE user_settings (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL UNIQUE,
    currency VARCHAR(10) DEFAULT 'USD',
    date_format VARCHAR(20) DEFAULT 'YYYY-MM-DD',
    theme VARCHAR(20) DEFAULT 'light',
    timezone VARCHAR(50) DEFAULT 'UTC',
    budget_warning_percent INT DEFAULT 80,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ==========================================
-- SYSTEM CATEGORIES (seed data)
-- ==========================================
CREATE TABLE system_categories (
    id INT PRIMARY KEY AUTO_INCREMENT,
    category_name VARCHAR(50) UNIQUE NOT NULL,
    icon VARCHAR(50) DEFAULT 'tag'
);

-- ==========================================
-- CATEGORIES
-- ==========================================
CREATE TABLE categories (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT,
    category_name VARCHAR(50) NOT NULL,
    is_system BOOLEAN DEFAULT FALSE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

ALTER TABLE categories ADD CONSTRAINT unique_user_category UNIQUE(user_id, category_name);

-- ==========================================
-- EXPENSES
-- ==========================================
CREATE TABLE expenses (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    category_id INT NOT NULL,
    title VARCHAR(100) NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    expense_date DATE NOT NULL,
    notes TEXT,
    expense_type ENUM('expense', 'transfer') DEFAULT 'expense',
    payment_method ENUM('cash', 'card', 'upi', 'bank', 'wallet') DEFAULT 'cash',
    is_recurring BOOLEAN DEFAULT FALSE,
    recurring_frequency ENUM('daily', 'weekly', 'monthly', 'yearly') NULL,
    merchant_name VARCHAR(100),
    attachment_url TEXT,
    tags VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE
);

-- ==========================================
-- INCOME
-- ==========================================
CREATE TABLE income (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    source VARCHAR(100) NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    income_date DATE NOT NULL,
    income_type ENUM('salary', 'freelance', 'bonus', 'investment', 'gift', 'other') DEFAULT 'other',
    is_recurring BOOLEAN DEFAULT FALSE,
    recurring_frequency ENUM('daily', 'weekly', 'monthly', 'yearly') NULL,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ==========================================
-- BUDGETS
-- ==========================================
CREATE TABLE budgets (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    month INT NOT NULL,
    year INT NOT NULL,
    budget_amount DECIMAL(10,2) NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

ALTER TABLE budgets ADD CONSTRAINT unique_user_month_year UNIQUE(user_id, month, year);

-- ==========================================
-- NOTIFICATIONS
-- ==========================================
CREATE TABLE notifications (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    title VARCHAR(200) NOT NULL,
    message TEXT,
    type ENUM('warning', 'info', 'success', 'danger') DEFAULT 'info',
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ==========================================
-- INDEXES
-- ==========================================
CREATE INDEX idx_expenses_user ON expenses(user_id);
CREATE INDEX idx_expenses_date ON expenses(expense_date);
CREATE INDEX idx_income_user ON income(user_id);
CREATE INDEX idx_income_date ON income(income_date);
CREATE INDEX idx_categories_user ON categories(user_id);
CREATE INDEX idx_budgets_user ON budgets(user_id);
CREATE INDEX idx_notifications_user ON notifications(user_id);
CREATE INDEX idx_expenses_type ON expenses(expense_type);

-- ==========================================
-- SEED SYSTEM CATEGORIES
-- ==========================================
INSERT INTO system_categories (category_name, icon) VALUES
('Food', 'utensils'),
('Transport', 'car'),
('Shopping', 'shopping-bag'),
('Healthcare', 'heartbeat'),
('Bills', 'file-invoice'),
('Entertainment', 'film'),
('Education', 'book'),
('Investment', 'chart-line'),
('Travel', 'plane');
