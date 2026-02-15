package main

import (
	"fmt"
	"io"
	"net/http"
)

func main() {
	http.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		all, err := io.ReadAll(r.Body)
		if err != nil {
			fmt.Println(err)
			return
		}
		s := string(all)
		fmt.Fprintf(w, "Hello from Go HTTP Server!", s)
	})

	fmt.Println("Server starting on http://localhost:8888")
	if err := http.ListenAndServe(":8888", nil); err != nil {
		fmt.Printf("Server error: %v\n", err)
	}
}
