//go:build test

package tagged_test

import (
	"testing"

	. "github.com/onsi/ginkgo"
	. "github.com/onsi/gomega"
)

func TestTaggedSuite(t *testing.T) {
	RegisterFailHandler(Fail)
	RunSpecs(t, "Tagged Suite")
}
