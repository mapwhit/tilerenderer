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
.NOTPARALLEL: test-query test-render

TEST_REPORTER ?= dot

DEPENDENCIES_TEST = test/node_modules
test-unit: dependencies $(DEPENDENCIES_TEST)
	node --test --test-reporter=$(TEST_REPORTER) "test/unit/**/*.test.js"

TEST_INTG_OPTS += --test-reporter=$(TEST_REPORTER)

ifdef TEST_BAIL
  TEST_INTG_OPTS += --test-bail
endif

test-render: dependencies dependencies-integration
	node test/render.test.js $(TEST_INTG_OPTS)

test-render-slow: dependencies dependencies-integration
	find test/integration/render/tests -name style.json -printf '%P\n' | \
		sed -e 's|/style.json||' | \
		xargs -L 200 node --disable-warning=ExperimentalWarning test/render.test.js $(TEST_INTG_OPTS)

test-query: dependencies dependencies-integration
	node test/query.test.js $(TEST_INTG_OPTS)

DEPENDENCIES_INTEGRATION = test/integration/node_modules
dependencies-integration: | $(DEPENDENCIES_TEST) $(DEPENDENCIES_INTEGRATION)

.PHONY: dependencies-integration test test-integration test-unit test-render test-query

ALL_DEPENDENCIES = $(DEPENDENCIES) $(DEPENDENCIES_TEST) $(DEPENDENCIES_INTEGRATION)
distclean: clean
	rm -fr $(ALL_DEPENDENCIES) $(ALL_DEPENDENCIES:node_modules=yarn.lock)

clean:
	rm -fr build

clean-test:
	find test/integration/*/tests -mindepth 2 -type d -not -exec test -e "{}/style.json" \; -print
	# | xargs -t rm -r

.PHONY: clean clean-test distclean

generate-struct-arrays:
	node meta/bin/generate-struct-arrays.js

.PHONY: generate-struct-arrays

generate-style-code:
	node meta/bin/generate-style-code.js

.PHONY: generate-style-code
