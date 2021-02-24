package another_test

import (
	"example/another"

	. "github.com/onsi/ginkgo"
	. "github.com/onsi/gomega"
)

var _ = Describe("Another", func() {

	It("works", func() {
		By("specific job works", func() {
			Expect(1).To(Equal(1))
		})
		another.Func()
		Expect(1).To(Equal(1))
	})

})
