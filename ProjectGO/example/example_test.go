package example_test

import (
	. "github.com/onsi/ginkgo"
	. "github.com/onsi/gomega"
)

var _ = Describe("Example", func() {
	FWhen("1", func() {
		It("1.1", func() {
			By("1.1.1", func() {
				Expect(1).To(Equal(2))
			})

			Expect(1).To(Equal(2))
		})
	})

	It("converts map to slice", func() {
		// m := map[string]interface{}{
		// 	"ID":    1234,
		// 	"Name":  "Joselito",
		// 	"Email": "joselitofilhoo@gmail.com",
		// }
		// slice := example.MapToSlice(m)
		// Expect(slice).To(HaveLen(6))
		Expect(1).To(Equal(2))
	})
	It("converts slice to map", func() {
		// slice := []interface{}{"ID", 1234, "Name", "Joselito", "Email", "joselitofilhoo@gmail.com"}
		// m := example.SliceToMap(slice)
		// Expect(m).To(HaveLen(3))
		Expect(1).To(Equal(1))
	})
})
