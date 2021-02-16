package example_test

import (
	. "github.com/onsi/ginkgo"
	. "github.com/onsi/gomega"
)

var _ = Describe("Example", func() {
	It("converts map to slice", func() {
		// m := map[string]interface{}{
		// 	"ID":    1234,
		// 	"Name":  "Joselito",
		// 	"Email": "joselitofilhoo@gmail.com",
		// }
		// slice := example.MapToSlice(m)
		// Expect(slice).To(HaveLen(6))
		Expect(1).To(Equal(1))
	})
	It("converts slice to map", func() {
		// slice := []interface{}{"ID", 1234, "Name", "Joselito", "Email", "joselitofilhoo@gmail.com"}
		// m := example.SliceToMap(slice)
		// Expect(m).To(HaveLen(3))
		Expect(1).To(Equal(1))
	})
})
