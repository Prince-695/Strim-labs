package ids_test

import (
	"testing"

	"github.com/Prince-695/strim/backend/internal/platform/ids"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestUUIDv7Generator(t *testing.T) {
	gen := ids.NewUUIDv7Generator()

	id1, err := gen.NewUUIDv7()
	require.NoError(t, err)
	assert.NotEmpty(t, id1)

	id2 := gen.MustNewUUIDv7()
	assert.NotEmpty(t, id2)
	assert.NotEqual(t, id1, id2)
}
