CREATE DATABASE IF NOT EXISTS option_chains;

USE option_chains;

CREATE TABLE IF NOT EXISTS option_daily_quotes (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  symbol VARCHAR(32) NOT NULL,
  data_date DATE NOT NULL,
  trade_date DATE NOT NULL,
  expiry_date DATE NOT NULL,
  strike DECIMAL(12, 4) NOT NULL,
  option_type ENUM('CALL', 'PUT') NOT NULL,
  bid DECIMAL(12, 4) NULL,
  ask DECIMAL(12, 4) NULL,
  last_price DECIMAL(12, 4) NULL,
  volume INT NULL,
  open_interest INT NULL,
  implied_volatility DECIMAL(10, 6) NULL,
  source VARCHAR(64) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uniq_option_daily (
    symbol,
    data_date,
    expiry_date,
    strike,
    option_type
  ),
  KEY idx_symbol_data_date (symbol, data_date),
  KEY idx_data_date_symbol (data_date, symbol),
  KEY idx_symbol_expiry_data_date (symbol, expiry_date, data_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
