package another_test

import (
	"testing"

	. "github.com/onsi/ginkgo"
	. "github.com/onsi/gomega"
)

func TestAnotherSuite(t *testing.T) {
	RegisterFailHandler(Fail)
	RunSpecs(t, "Another Suite")
}
