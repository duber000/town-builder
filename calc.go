//go:build js && wasm

package main

import (
	"syscall/js"
	"math"
)

func distance(this js.Value, args []js.Value) interface{} {
	x1 := args[0].Float()
	y1 := args[1].Float()
	x2 := args[2].Float()
	y2 := args[3].Float()
	dx := x2 - x1
	dy := y2 - y1
	return js.ValueOf(math.Sqrt(dx*dx + dy*dy))
}

func registerCallbacks() {
	js.Global().Set("calcDistance", js.FuncOf(distance))
}

func main() {
	c := make(chan struct{}, 0)
	registerCallbacks()
	<-c // Keep Go running
}

