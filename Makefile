PROJECT=tilerenderer
NODE_BIN=./meta/node_modules/.bin

all: check build
.PHONY: all

find = $(foreach dir,$(1),$(foreach d,$(wildcard $(dir)/*),$(call find,$(d),$(2))) $(wildcard $(dir)/$(strip $(2))))

SRC = $(call find, src, *.js)

BUILD = build/$(PROJECT).js build/$(PROJECT)-worker.js

DEBUG_FLAG ?= true

%/node_modules: %/package.json
	yarn --cwd $(@D) --no-progress
	touch $@

.SECONDEXPANSION:

%/.dir:
	mkdir --parent $(@D)
	touch $@

build/min/package.json: package.json | $$(@D)/.dir
	jq  '{ version, type }' < $< > $@

GLSL = $(wildcard src/shaders/*.glsl)

build/min/src/shaders/%.glsl.js: src/shaders/%.glsl  | $$(@D)/.dir meta/node_modules
	$(NODE_BIN)/glsl-minify \
	    --preserveUniforms \
	    --preserveDefines \
	    --preserveVariables \
		--output=source \
		--esModule \
		--outDir=build/min \
		$<

PREBUILD = \
	build/min/package.json \
	$(GLSL:%.glsl=build/min/%.glsl.js)

prebuild: $(PREBUILD)
.PHONY: prebuild

check: lint test
.PHONY: check

build: $(PREBUILD)
build: $(BUILD)
.PHONY: build

dist: DEBUG_FLAG=false
dist: build
.PHONY: dist

DEPENDENCIES = meta/node_modules $(CURDIR)/node_modules

dependencies: | $(DEPENDENCIES)

define ESBUILD_OPTIONS
	--define:global=globalThis \
	--define:DEBUG=$(DEBUG_FLAG) \
	--tree-shaking=true \
	--minify \
	--target=es2020 \
	--metafile=${@:.js=.meta.json} \
	--outfile=$@
endef

build/$(PROJECT).js: $(SRC) | dependencies
	$(NODE_BIN)/esbuild --bundle src/index.js --global-name=mapboxgl $(ESBUILD_OPTIONS)

build/$(PROJECT)-worker.js: $(SRC) | dependencies
	$(NODE_BIN)/esbuild --bundle src/worker.js $(ESBUILD_OPTIONS)

lint: | meta/node_modules
	$(NODE_BIN)/biome ci
.PHONY: lint

format: | meta/node_modules
	$(NODE_BIN)/biome check --write
.PHONY: format

test: test-unit prebuild

test-integration: test-query test-render

TEST_REPORTER ?= dot

DEPENDENCIES_TEST = test/node_modules
test-unit: dependencies $(DEPENDENCIES_TEST)
	node --test --test-reporter=$(TEST_REPORTER) "test/unit/**/*.test.js"

RENDER_TESTS := "test/integration/render/tests/*/render.test.js"
QUERY_TESTS := "test/integration/query/tests/*/query.test.js"

TEST_INTG_OPTS += --test-concurrency=true
ifdef TEST_FILTER
  TEST_INTG_OPTS += --test-name-pattern=$(TEST_FILTER)
  # when filter is provided it is more efficient to run main test file
  RENDER_TESTS := "test/integration/render/tests/render-all.test.js"
  QUERY_TESTS := "test/integration/query/tests/query-all.test.js"
endif
ifdef TEST_REPORTER
  TEST_INTG_OPTS += --test-reporter=$(TEST_REPORTER)
endif

test-render: dependencies dependencies-integration render-test-files
	node --test $(TEST_INTG_OPTS) $(RENDER_TESTS)

test-query: dependencies dependencies-integration query-test-files
	node --test $(TEST_INTG_OPTS) $(QUERY_TESTS)

DEPENDENCIES_INTEGRATION = test/integration/node_modules
dependencies-integration: | $(DEPENDENCIES_TEST) $(DEPENDENCIES_INTEGRATION)

RENDER_TEST_FILES := $(shell find test/integration/render/tests -mindepth 1 -maxdepth 1 -type d)
render-test-files: $(patsubst %, %/render.test.js, $(RENDER_TEST_FILES))

%/render.test.js: test/integration/lib/render/template.js
	@cp $^ $@

.SECONDARY: render-test-files

QUERY_TEST_FILES := $(shell find test/integration/query/tests -mindepth 1 -maxdepth 1 -type d)
query-test-files: $(patsubst %, %/query.test.js, $(QUERY_TEST_FILES))

%/query.test.js: test/integration/lib/query/template.js
	@cp $^ $@

.SECONDARY: query-test-files

test-coverage: dependencies dependencies-integration render-test-files query-test-files
	node --test --experimental-test-coverage \
		--test-concurrency=true \
		"test/unit/**/*.test.js" \
		"test/integration/render/tests/*/render.test.js" \
		"test/integration/query/tests/*/query.test.js"

.PHONY: dependencies-integration test test-integration test-unit test-render test-query test-coverage

ALL_DEPENDENCIES = $(DEPENDENCIES) $(DEPENDENCIES_TEST) $(DEPENDENCIES_INTEGRATION)
distclean: clean clean-test
	rm -fr $(ALL_DEPENDENCIES) $(ALL_DEPENDENCIES:node_modules=yarn.lock)

clean:
	rm -fr build

clean-test:
	git clean --quiet -X -f test/integration/*/tests

.PHONY: clean clean-test distclean

generate-struct-arrays:
	node meta/bin/generate-struct-arrays.js

.PHONY: generate-struct-arrays

generate-style-code:
	node meta/bin/generate-style-code.js

.PHONY: generate-style-code
