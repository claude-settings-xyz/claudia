package schema

import "strings"

// enclosingFunction returns the name of the innermost function declaration whose
// body contains offset. It understands just enough JavaScript to skip strings,
// template literals, comments and regular expressions in minified code.
func enclosingFunction(src string, offset int) string {
	type open struct {
		name   string
		braces int
	}
	type pendingFunc struct {
		name   string
		parens int
		ready  bool
	}

	var stack []open
	var templates []int
	var pending *pendingFunc
	braces, parens := 0, 0
	// afterValue means that a "/" is a division, not the start of a regular expression.
	afterValue := false
	i := 0

	skipTemplate := func() {
		for i < len(src) {
			switch {
			case src[i] == '\\':
				i += 2
			case src[i] == '`':
				i++
				return
			case src[i] == '$' && i+1 < len(src) && src[i+1] == '{':
				templates = append(templates, braces)
				braces++
				i += 2
				return
			default:
				i++
			}
		}
	}

	for i < offset && i < len(src) {
		c := src[i]
		switch {
		case c == ' ' || c == '\n' || c == '\t' || c == '\r':
			i++
		case strings.HasPrefix(src[i:], "//"):
			end := strings.IndexByte(src[i:], '\n')
			if end < 0 {
				return ""
			}
			i += end
		case strings.HasPrefix(src[i:], "/*"):
			end := strings.Index(src[i+2:], "*/")
			if end < 0 {
				return ""
			}
			i += end + 4
		case c == '"' || c == '\'':
			i++
			for i < len(src) && src[i] != c {
				if src[i] == '\\' {
					i++
				}
				i++
			}
			i++
			afterValue = true
		case c == '`':
			i++
			skipTemplate()
			afterValue = true
		case isIdentStart(c):
			start := i
			for i < len(src) && isIdentPart(src[i]) {
				i++
			}
			word := src[start:i]
			if word == "function" {
				if name, length, ok := functionHead(src[i:]); ok {
					pending = &pendingFunc{name: name, parens: parens}
					parens++
					i += length
					afterValue = false
					continue
				}
			}
			afterValue = !regexKeywords[word]
		case c >= '0' && c <= '9':
			for i < len(src) && (isIdentPart(src[i]) || src[i] == '.') {
				i++
			}
			afterValue = true
		case c == '/' && !afterValue:
			i++
			inClass := false
			for i < len(src) && (inClass || src[i] != '/') {
				switch src[i] {
				case '\\':
					i++
				case '[':
					inClass = true
				case ']':
					inClass = false
				}
				i++
			}
			i++
			for i < len(src) && src[i] >= 'a' && src[i] <= 'z' {
				i++
			}
			afterValue = true
		default:
			i++
			afterValue = false
			switch c {
			case '(':
				parens++
			case ')':
				parens--
				if pending != nil && parens == pending.parens {
					pending.ready = true
				}
				afterValue = true
			case ']':
				afterValue = true
			case '{':
				if pending != nil && pending.ready {
					stack = append(stack, open{name: pending.name, braces: braces})
					pending = nil
				}
				braces++
			case '}':
				braces--
				if n := len(templates); n > 0 && templates[n-1] == braces {
					templates = templates[:n-1]
					skipTemplate()
					afterValue = true
					continue
				}
				if n := len(stack); n > 0 && stack[n-1].braces == braces {
					stack = stack[:n-1]
				}
				afterValue = true
			}
		}
	}

	if len(stack) == 0 {
		return ""
	}
	return stack[len(stack)-1].name
}

// functionHead reads an optional "*" and name followed by "(".
func functionHead(s string) (name string, length int, ok bool) {
	i := 0
	skipSpace := func() {
		for i < len(s) && (s[i] == ' ' || s[i] == '\n' || s[i] == '\t') {
			i++
		}
	}
	skipSpace()
	if i < len(s) && s[i] == '*' {
		i++
		skipSpace()
	}
	start := i
	for i < len(s) && isIdentPart(s[i]) {
		i++
	}
	name = s[start:i]
	skipSpace()
	if i >= len(s) || s[i] != '(' {
		return "", 0, false
	}
	return name, i + 1, true
}

var regexKeywords = map[string]bool{
	"return": true, "typeof": true, "case": true, "do": true, "else": true, "in": true,
	"of": true, "new": true, "delete": true, "void": true, "throw": true,
	"instanceof": true, "yield": true, "await": true,
}

func isIdentStart(c byte) bool {
	return c == '_' || c == '$' || c >= 0x80 || (c|0x20 >= 'a' && c|0x20 <= 'z')
}

func isIdentPart(c byte) bool {
	return isIdentStart(c) || (c >= '0' && c <= '9')
}
