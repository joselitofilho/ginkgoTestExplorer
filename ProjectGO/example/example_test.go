package example_test

import (
	"example/example"

	. "github.com/onsi/ginkgo"
	. "github.com/onsi/gomega"
)

var _ = BeforeEach(func() {
	By("", func() {})
})

var _ = Describe("Example", func() {

	BeforeEach(func() {})

	It("works", func() {
		By("specific job works", func() {
			Expect(1).To(Equal(1))
		})
		example.Func()
		Expect(2).To(Equal(2))
	})

	It("works 2", func() {})

	PIt("pending", func() {})

	XIt("skipped", func() {})

	When("something happens", func() {
		It("does not works", func() {
			Expect(2).To(Equal(1))
		})
	})

	Measure("it should do a method() hard efficiently", func(b Benchmarker) {
		runtime := b.Time("runtime", func() {
			Expect(1).To(Equal(1))
		})
		Expect(runtime.Seconds()).To(BeNumerically("<", 1), "method() shouldn't take too long.")
	}, 10)
})
