-- Migration to add initial_budget column to division_budgets
ALTER TABLE division_budgets ADD COLUMN initial_budget NUMERIC DEFAULT 0;

-- Set initial_budget to equal total_budget for existing rows so they are not 0
UPDATE division_budgets SET initial_budget = total_budget WHERE initial_budget = 0;
