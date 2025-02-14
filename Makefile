PROJECT=mapbox-gl
NODE_BIN=./build/node_modules/.bin

all: check build
.PHONY: all

find = $(foreach dir,$(1),$(foreach d,$(wildcard $(dir)/*),$(call find,$(d),$(2))) $(wildcard $(dir)/$(strip $(2))))

SRC = $(call find, src, *.js)

BUILD = dist/$(PROJECT).js dist/$(PROJECT)-worker.js

DEBUG_FLAG ?= true

%/node_modules: %/package.json
	yarn --cwd $(@D) --no-progress
	touch $@

.SECONDEXPANSION:

%/.dir:
	mkdir --parent $(@D)
	touch $@

build/min/package.json: package.json | $$(@D)/.dir
	jq  '{ version }' < $< > $@

GLSL = $(wildcard src/shaders/*.glsl)

build/min/src/shaders/%.glsl.txt: src/shaders/%.glsl  | $$(@D)/.dir build/node_modules
	$(NODE_BIN)/webpack-glsl-minify \
	    --preserveUniforms=true \
	    --preserveDefines=true \
	    --preserveVariables=true \
		--output=sourceOnly \
		--outDir=build/min \
		--ext=.txt \
		$<

JQ_FILTER = walk(if type == "object" then delpaths([["doc"],["example"],["sdk-support"]]) else . end)

build/min/style-spec/reference/%.json: src/style-spec/reference/%.json  | $$(@D)/.dir
	jq '$(JQ_FILTER)' $< > $@

PREBUILD = \
	build/min/package.json \
	build/min/style-spec/reference/v8.json \
	$(GLSL:%.glsl=build/min/%.glsl.txt)

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

distdir:
	mkdir -p dist

DEPENDENCIES = build/node_modules $(CURDIR)/node_modules src/style-spec/node_modules

dependencies: | $(DEPENDENCIES)

ESBUILD_OPTIONS = --define:global=globalThis --define:DEBUG=$(DEBUG_FLAG)

dist/$(PROJECT).js: $(SRC) | dependencies distdir
	esbuild --bundle src/index.js \
		$(ESBUILD_OPTIONS) \
		--global-name=mapboxgl \
		--outfile=$@

dist/$(PROJECT)-worker.js: $(SRC) | dependencies distdir
	esbuild --bundle src/source/worker.js  \
		$(ESBUILD_OPTIONS) \
		--outfile=$@

lint: dependencies
	$(NODE_BIN)/biome lint
.PHONY: lint

test: test-unit

test-integration: test-render test-query test-expression
.NOTPARALLEL: test-render test-query test-expression

test-unit test-render test-query: export NODE_PATH = build/node_modules

test-unit: dependencies
	node --test test/unit/**/*.test.js

test-expression: dependencies dependencies-integration
	node test/expression.test.js

test-render: dependencies dependencies-integration
	node test/render.test.js

test-query: dependencies dependencies-integration
	node test/query.test.js

dependencies-integration: | test/integration/node_modules test/integration/tiles/node_modules

.PHONY: dependencies-integration test test-integration test-unit test-render test-query

distclean: clean
	rm -fr $(DEPENDENCIES)

clean:
	rm -fr dist build/min

clean-test:
	find test/integration/*-tests -mindepth 2 -type d -not -exec test -e "{}/style.json" \; -print
	# | xargs -t rm -r

.PHONY: clean clean-test distclean
