.PHONY: install scan test-demo

install:
	npm install

## Usage: make scan path=/path/to/repo   (defaults to current directory if omitted)
scan:
	@node bin/scan.js $(or $(path),.)

## Runs the scanner against this repo itself — a quick sanity check after any change
test-demo:
	@node bin/scan.js .
