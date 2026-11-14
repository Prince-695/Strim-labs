package domain

import (
	"crypto/sha256"
	"database/sql/driver"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"time"
)

// StringArray implements database/sql driver.Valuer and sql.Scanner for string slices.
type StringArray []string

// Value implements driver.Valuer for JSON serialization in GORM.
func (a StringArray) Value() (driver.Value, error) {
	if a == nil {
		return "[]", nil
	}
	return json.Marshal(a)
}

// Scan implements sql.Scanner for JSON deserialization from database rows.
func (a *StringArray) Scan(value interface{}) error {
	if value == nil {
		*a = StringArray{}
		return nil
	}
	var bytes []byte
	switch v := value.(type) {
	case []byte:
		bytes = v
	case string:
		bytes = []byte(v)
	default:
		return fmt.Errorf("unsupported type for StringArray: %T", value)
	}
	if len(bytes) == 0 {
		*a = StringArray{}
		return nil
	}
	return json.Unmarshal(bytes, a)
}

// APIKeyScope defines permitted operations for an API key.
type APIKeyScope string

const (
	ScopeIngest    APIKeyScope = "ingest"
	ScopeDiscovery APIKeyScope = "discovery"
	ScopeRead      APIKeyScope = "read"
)

// APIKey represents an authorized programmatic access credential.
type APIKey struct {
	ID         string      `gorm:"primaryKey;size:36" json:"id"`
	ProjectID  string      `gorm:"size:36;not null;index" json:"project_id"`
	OrgID      string      `gorm:"size:36;not null;index" json:"org_id"`
	Name       string      `gorm:"size:100;not null" json:"name"`
	Prefix     string      `gorm:"size:24;not null;index" json:"prefix"`  // e.g. "strim_live_a1b2"
	KeyHash    string      `gorm:"size:64;not null;uniqueIndex" json:"-"` // SHA-256 hex string
	Scopes     StringArray `gorm:"type:text;not null" json:"scopes"`      // JSON array
	ExpiresAt  *time.Time  `json:"expires_at,omitempty"`
	LastUsedAt *time.Time  `json:"last_used_at,omitempty"`
	RevokedAt  *time.Time  `json:"revoked_at,omitempty"`
	GraceUntil *time.Time  `json:"grace_until,omitempty"` // For rotation: remains active until this time
	CreatedAt  time.Time   `gorm:"not null" json:"created_at"`
	UpdatedAt  time.Time   `gorm:"not null" json:"updated_at"`
}

// TableName returns the table name for GORM migrations.
func (APIKey) TableName() string {
	return "api_keys"
}

// IsActive returns true if the key is currently usable (not revoked, not expired, or within active grace period).
func (k *APIKey) IsActive(now time.Time) bool {
	if k.RevokedAt != nil {
		return false
	}
	if k.GraceUntil != nil && now.After(*k.GraceUntil) {
		return false
	}
	if k.ExpiresAt != nil && now.After(*k.ExpiresAt) {
		return false
	}
	return true
}

// HasScope checks if the key contains the requested permission scope.
func (k *APIKey) HasScope(scope APIKeyScope) bool {
	for _, s := range k.Scopes {
		if APIKeyScope(s) == scope {
			return true
		}
	}
	return false
}

// HashSecret computes the SHA-256 hex digest of a raw secret string.
func HashSecret(secret string) string {
	sum := sha256.Sum256([]byte(secret))
	return hex.EncodeToString(sum[:])
}
