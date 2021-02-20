package example_test

import (
	. "github.com/onsi/ginkgo"
	. "github.com/onsi/gomega"
)

var _ = Describe("Example", func() {
	It("works", func() {
		By("specific job works", func() {
			Expect(1).To(Equal(1))
		})
		Expect(2).To(Equal(2))
	})

	It("works 2", func() {})

	PIt("pending", func() {})

	XIt("skipped", func() {})

	When("something happens", func() {
		It("does not works", func() {
			Expect(1).To(Equal(2))
		})
	})

	Measure("it should do a method() hard efficiently", func(b Benchmarker) {
		runtime := b.Time("runtime", func() {
			Expect(1).To(Equal(1))
		})
		Expect(runtime.Seconds()).To(BeNumerically("<", 1), "method() shouldn't take too long.")
	}, 10)
})
