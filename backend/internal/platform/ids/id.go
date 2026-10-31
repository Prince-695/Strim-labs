package ids

import "github.com/google/uuid"

// IDGenerator provides time-ordered UUIDv7 generation for entity IDs.
type IDGenerator interface {
	NewUUIDv7() (string, error)
	MustNewUUIDv7() string
}

type uuidv7Generator struct{}

// NewUUIDv7Generator returns an IDGenerator using google/uuid V7.
func NewUUIDv7Generator() IDGenerator {
	return &uuidv7Generator{}
}

func (g *uuidv7Generator) NewUUIDv7() (string, error) {
	id, err := uuid.NewV7()
	if err != nil {
		return "", err
	}
	return id.String(), nil
}

func (g *uuidv7Generator) MustNewUUIDv7() string {
	id, err := uuid.NewV7()
	if err != nil {
		// Fallback to V4 if V7 clock sequence fails in rare circumstances
		return uuid.NewString()
	}
	return id.String()
}
