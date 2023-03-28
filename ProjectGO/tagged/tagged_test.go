//go:build test

package tagged_test

import (
	. "github.com/onsi/ginkgo"
	. "github.com/onsi/gomega"
)

var _ = Describe("Tagged", func() {

	It("works", func() {
		By("specific job works", func() {
			Expect(1).To(Equal(1))
		})
		Expect(1).To(Equal(1))
	})

})
