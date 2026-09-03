// Package hype holds a single global, public click counter -- the
// "semangatin yuk" / Allez cheer button on the under-construction curtain
// (palabatu-fe's UnderConstruction.tsx). Deliberately minimal: one row, no
// ownership, no auth, no per-endpoint rate limit -- the whole point is that
// anyone can click it as many times as they want (see handler.go's doc
// comment). Seeded at a random phantom value by migrations/0019 rather than
// starting at zero, so the page never opens looking unused.
package hype

import "context"

func GetCount(ctx context.Context) (int, error) {
	return getCount(ctx)
}

func Click(ctx context.Context) (int, error) {
	return incrementCount(ctx)
}
