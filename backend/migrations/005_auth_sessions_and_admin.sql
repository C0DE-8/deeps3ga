ALTER TABLE accounts
  ADD COLUMN email VARCHAR(190) NULL UNIQUE AFTER username,
  ADD COLUMN role ENUM('player', 'admin') NOT NULL DEFAULT 'player' AFTER password_hash,
  ADD COLUMN last_login_at TIMESTAMP NULL AFTER role;

CREATE TABLE account_sessions (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  account_id BIGINT UNSIGNED NOT NULL,
  token_hash CHAR(64) NOT NULL UNIQUE,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  revoked_at TIMESTAMP NULL,
  INDEX idx_account_sessions_lookup (token_hash, expires_at, revoked_at),
  CONSTRAINT fk_account_sessions_account FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE
);
