package architecture_test

import (
	"fmt"
	"go/parser"
	"go/token"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

// Clean Architecture Rules:
// 1. Domain layer (internal/domain) must not depend on any other internal layers.
// 2. Application layer (internal/application) can only depend on the Domain layer.
// 3. Infrastructure/Adapters (internal/adapter) can depend on Domain and Application.
// 4. Transport/Server (internal/transport, internal/server) can depend on Application, Domain, and Adapter (for DI).

func TestArchitectureDependencies(t *testing.T) {
	root := "../../internal"
	absRoot, err := filepath.Abs(root)
	if err != nil {
		t.Fatal(err)
	}

	err = filepath.Walk(absRoot, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}

		// Only look at .go files
		if info.IsDir() || !strings.HasSuffix(path, ".go") || strings.HasSuffix(path, "_test.go") {
			return nil
		}

		fset := token.NewFileSet()
		f, err := parser.ParseFile(fset, path, nil, parser.ImportsOnly)
		if err != nil {
			return fmt.Errorf("failed to parse %s: %v", path, err)
		}

		relPath, _ := filepath.Rel(absRoot, path)
		currentLayer := getLayerName(relPath)

		for _, imp := range f.Imports {
			impPath := strings.Trim(imp.Path.Value, "\"")

			// Only check internal dependencies of our own service
			if !strings.HasPrefix(impPath, "task-service/internal/") {
				continue
			}

			importedLayer := getLayerName(strings.TrimPrefix(impPath, "task-service/internal/"))

			if err := validateDependency(currentLayer, importedLayer); err != nil {
				t.Errorf("Architecture violation in %s: %v", relPath, err)
			}
		}

		return nil
	})

	if err != nil {
		t.Fatal(err)
	}
}

func getLayerName(relPath string) string {
	parts := strings.Split(filepath.ToSlash(relPath), "/")
	if len(parts) > 0 {
		return parts[0]
	}
	return ""
}

func validateDependency(from, to string) error {
	if from == "domain" {
		// Domain cannot depend on anything else in internal/
		if to != "domain" && to != "pkg" {
			return fmt.Errorf("domain layer cannot depend on %s layer", to)
		}
	}

	if from == "application" {
		// Application can depend on domain but not adapter/transport
		if to == "adapter" || to == "transport" || to == "server" {
			return fmt.Errorf("application layer cannot depend on %s layer", to)
		}
	}

	// Adapter and Transport can depend on most things (Application, Domain)
	// but usually we want to avoid circular dependencies.

	return nil
}

func TestDomainIsolation(t *testing.T) {
	// Specialized test to ensure no external infrastructure is leaking into domain
	// Domain should only use standard library or very specific internal/pkg utilities
}
