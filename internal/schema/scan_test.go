package schema

import (
	"strings"
	"testing"
)

func TestEnclosingFunction(t *testing.T) {
	cases := []struct {
		name string
		src  string
		want string
	}{
		{"nested function closed before", `function outer(e,{flag:o=!1}={}){function inner(l){return{x:1}}return{$schema:1}}`, "outer"},
		{"braces in strings", `function a(){let s="}}}{",t='{';return{$schema:1}}`, "a"},
		{"template with expressions", "function a(){let s=`${{x:1}.x}}`;return{$schema:1}}", "a"},
		{"regex with braces", `function a(){let r=/[{}]+\}/g,d=4/2;return{$schema:1}}`, "a"},
		{"comments", "function a(){/* } */ // }\nreturn{$schema:1}}", "a"},
		{"inside inner", `function a(){function b(){return{$schema:1}}}`, "b"},
		{"not inside any", `function a(){}var x={$schema:1}`, ""},
	}
	for _, c := range cases {
		offset := strings.Index(c.src, "{$schema")
		if got := enclosingFunction(c.src, offset); got != c.want {
			t.Errorf("%s: got %q, want %q", c.name, got, c.want)
		}
	}
}

func TestCompareVersions(t *testing.T) {
	if compareVersions("2.1.330", "2.1.99") <= 0 || compareVersions("2.0.0", "2.1.0") >= 0 {
		t.Fatal("versions compare as strings")
	}
}
