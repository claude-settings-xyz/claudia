package schema

import (
	"errors"
	"fmt"
	"regexp"
	"strings"
	"time"

	"github.com/dop251/goja"
)

// The schema is built by running Claude Code's own code in an embedded JavaScript
// engine. Chunks are loaded only when the code reads one of their exports. Node,
// Bun and network APIs are replaced by inert stubs, so nothing outside the engine
// is touched.

const evalTimeout = 20 * time.Second

var (
	errNoSettings = errors.New("could not find the settings schema in Claude Code")

	starImport    = regexp.MustCompile(`import\*as ([\w$]+) from"([^"]+)";?`)
	defaultImport = regexp.MustCompile(`import ([\w$]+) from"([^"]+)";?`)
	bareImport    = regexp.MustCompile(`import"([^"]+)";?`)
	dynamicImport = regexp.MustCompile(`(^|[^\w$.])import\(`)
)

const stubSource = `
function __stub() {
  return new Proxy(function () {}, {
    get: function (target, key) {
      if (key === Symbol.toPrimitive) return function () { return '' }
      if (key === 'then') return undefined
      return __stub()
    },
    apply: function () { return __stub() },
    construct: function () { return __stub() },
    has: function () { return true },
  })
}
function __import() { return Promise.reject(new Error('dynamic import is not available')) }
`

var hostNames = map[string]bool{
	"process": true, "Bun": true, "require": true, "module": true,
	"__importMeta": true, "__exports": true, "__expose": true, "__import": true,
}

type evaluator struct {
	vm      *goja.Runtime
	bundle  *bundle
	modules map[int]*goja.Object
	stub    goja.Callable
}

func evaluate(b *bundle) (string, string, error) {
	index, offset := -1, -1
	for i, chunk := range b.chunks {
		if at := strings.Index(chunk, "return{$schema:()=>"); at >= 0 {
			index, offset = i, at
			break
		}
	}
	if index < 0 {
		return "", "", errNoSettings
	}
	chunk := b.chunks[index]
	fields := enclosingFunction(chunk, offset)
	if fields == "" {
		return "", "", errNoSettings
	}

	vm := goja.New()
	if _, err := vm.RunString(stubSource); err != nil {
		return "", "", err
	}
	stub, _ := goja.AssertFunction(vm.Get("__stub"))
	e := &evaluator{vm: vm, bundle: b, modules: map[int]*goja.Object{}, stub: stub}

	timer := time.AfterFunc(evalTimeout, func() { vm.Interrupt("timeout") })
	defer timer.Stop()

	exports := vm.NewObject()
	if err := e.run(chunk, fmt.Sprintf("chunk %d", index), exports, buildSource(chunk, fields)); err != nil {
		return "", "", err
	}
	build, ok := goja.AssertFunction(exports.Get("__exposed"))
	if !ok {
		return "", "", errNoSettings
	}
	result, err := build(goja.Undefined())
	if err != nil {
		return "", "", fmt.Errorf("build the settings schema: %w", err)
	}
	return result.String(), chunkVersion(chunk), nil
}

// buildSource builds the schema the way Claude Code does, as in
// "new X(fields(extra())).whole()". If that code changes, it falls back to
// converting each field on its own.
func buildSource(chunk, fields string) string {
	whole := "null"
	pattern := regexp.MustCompile(`new ([\w$]+)\(` + regexp.QuoteMeta(fields) + `\(([\w$]+)\(\)\)`)
	if m := pattern.FindStringSubmatch(chunk); m != nil {
		whole = fmt.Sprintf("new %s(%s(%s())).whole()", m[1], fields, m[2])
	}
	// The names start with "__" so that they cannot hide names from the chunk.
	return fmt.Sprintf(`__expose(function () {
  var __options = { io: 'input', unrepresentable: 'any' }
  var __whole = null
  try { __whole = %s } catch (__e) {}
  if (__whole && typeof __whole.toJSONSchema === 'function') return JSON.stringify(__whole.toJSONSchema(__options))
  var __fields = %s([]), __properties = {}
  for (var __key in __fields) {
    try { __properties[__key] = __fields[__key]().toJSONSchema(__options) } catch (__e) {}
  }
  return JSON.stringify({ type: 'object', properties: __properties })
})`, whole, fields)
}

func (e *evaluator) load(path string) goja.Value {
	index, ok := e.bundle.byPath[path]
	if !ok {
		return e.newStub()
	}
	if exports, ok := e.modules[index]; ok {
		return exports
	}
	// Cache before running, so that chunks that import each other see the same object.
	exports := e.vm.NewObject()
	e.modules[index] = exports
	e.run(e.bundle.chunks[index], path, exports, "")
	return exports
}

// run turns a chunk into a function. Imports become lookups on a scope object,
// and exports become getters, which keeps both live like real ES module bindings.
func (e *evaluator) run(src, label string, exports *goja.Object, extra string) error {
	bindings := map[string][2]string{}

	src = namedImport.ReplaceAllStringFunc(src, func(statement string) string {
		m := namedImport.FindStringSubmatch(statement)
		for _, name := range splitNames(m[1]) {
			bindings[name[1]] = [2]string{m[2], name[0]}
		}
		return ""
	})
	src = starImport.ReplaceAllStringFunc(src, func(statement string) string {
		m := starImport.FindStringSubmatch(statement)
		bindings[m[1]] = [2]string{m[2], "*"}
		return ""
	})
	src = defaultImport.ReplaceAllStringFunc(src, func(statement string) string {
		m := defaultImport.FindStringSubmatch(statement)
		bindings[m[1]] = [2]string{m[2], "default"}
		return ""
	})
	src = bareImport.ReplaceAllString(src, "")
	src = dynamicImport.ReplaceAllString(src, "${1}__import(")
	src = strings.ReplaceAll(src, "import.meta", "__importMeta")

	getters := ""
	src = exportList.ReplaceAllStringFunc(src, func(statement string) string {
		m := exportList.FindStringSubmatch(statement)
		var parts []string
		for _, name := range splitNames(m[1]) {
			parts = append(parts, fmt.Sprintf("%q:{get:function(){return %s},enumerable:true}", name[1], name[0]))
		}
		getters = "Object.defineProperties(__exports,{" + strings.Join(parts, ",") + "});"
		return ""
	})

	program, err := goja.Compile(label, "(function(__scope){with(__scope){"+getters+src+"\n"+extra+"}})", false)
	if err != nil {
		return fmt.Errorf("compile %s: %w", label, err)
	}
	wrapper, err := e.vm.RunProgram(program)
	if err != nil {
		return err
	}
	call, _ := goja.AssertFunction(wrapper)
	scope := e.vm.NewDynamicObject(&scope{evaluator: e, bindings: bindings, exports: exports})
	if _, err := call(goja.Undefined(), scope); err != nil {
		var interrupted *goja.InterruptedError
		if errors.As(err, &interrupted) {
			return err
		}
		// Top-level code that needs a real runtime may fail. The definitions
		// before the failure are still usable.
	}
	return nil
}

func (e *evaluator) newStub() goja.Value {
	v, _ := e.stub(goja.Undefined())
	return v
}

type scope struct {
	*evaluator
	bindings map[string][2]string
	exports  *goja.Object
}

func (s *scope) Has(key string) bool {
	_, ok := s.bindings[key]
	return ok || hostNames[key]
}

func (s *scope) Get(key string) goja.Value {
	switch key {
	case "__exports":
		return s.exports
	case "__expose":
		return s.vm.ToValue(func(v goja.Value) { s.exports.Set("__exposed", v) })
	case "__import":
		return s.vm.Get("__import")
	}
	binding, ok := s.bindings[key]
	if !ok || !strings.HasPrefix(binding[0], "/$bunfs/") {
		return s.newStub()
	}
	module := s.load(binding[0])
	if binding[1] == "*" {
		return module
	}
	return module.ToObject(s.vm).Get(binding[1])
}

func (s *scope) Set(string, goja.Value) bool { return false }
func (s *scope) Delete(string) bool          { return false }
func (s *scope) Keys() []string              { return nil }
