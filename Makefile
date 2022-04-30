PROJECT=mapbox-gl
NODE_BIN=./build/node_modules/.bin

find = $(foreach dir,$(1),$(foreach d,$(wildcard $(dir)/*),$(call find,$(d),$(2))) $(wildcard $(dir)/$(strip $(2))))

SRC = $(call find, src, *.js)

BUILD = dist/$(PROJECT).js dist/$(PROJECT)-worker.js
DIST = $(BUILD:%.js=%.min.js)

%/node_modules: %/package.json
	yarn --cwd $(@D) --no-progress
	touch $@

%.min.js: %.js
	$(NODE_BIN)/terser \
		--mangle \
		--compress warnings=false \
		--compress drop_console \
		--compress pure_funcs=['assert'] \
		--source-map filename='$@.map' \
		--source-map content='$<.map' \
		--source-map "root='/ui/script'" \
		--output $@ \
		-- $<

%.js: %.debug.js
	$(NODE_BIN)/exorcist --error-on-missing --base $(CURDIR) $@.map < $< > $@

.SECONDEXPANSION:

%/.dir:
	mkdir --parent $(@D)
	touch $@

build/min/package.json: package.json | $$(@D)/.dir
	jq  '{ version }' < $< > $@

GLSL = $(wildcard src/shaders/*.glsl)

build/min/glsl/%.glsl.txt: src/shaders/%.glsl | $$(@D)/.dir
	sed -e '/^$$/d' -e '\/^\s*\/\/.*$$/d' -e 's/^ *//' $< > $@

PREBUILD = build/min/package.json $(GLSL:src/shaders/%.glsl=build/min/glsl/%.glsl.txt)

prebuild: $(PREBUILD)


.PHONY: prebuild

all: check build

check: lint test

build: $(PREBUILD)
build: $(BUILD)

dist: $(DIST)

distdir:
	mkdir -p dist

DEPENDENCIES = build/node_modules $(CURDIR)/node_modules src/style-spec/node_modules

dependencies: | $(DEPENDENCIES)

ifeq "$(BUNDLER)" "esbuild"

ESBUILD_OPTIONS = --loader:.glsl=text --define:global=globalThis

dist/$(PROJECT).js: $(SRC) | dependencies distdir
	esbuild --bundle src/index.js \
		$(ESBUILD_OPTIONS) \
		--global-name=mapboxgl \
		--outfile=$@

dist/$(PROJECT)-worker.js: $(SRC) | dependencies distdir
	esbuild --bundle src/source/worker.js  \
		$(ESBUILD_OPTIONS) \
		--outfile=$@

else

BROWSERIFY_OPTIONS = --debug --transform-path ./build/node_modules

dist/$(PROJECT).debug.js: $(SRC) | dependencies distdir
	$(NODE_BIN)/browserify src/index.js \
		$(BROWSERIFY_OPTIONS) \
		--outfile $@ \
		--standalone mapboxgl

dist/$(PROJECT)-worker.debug.js: $(SRC) | dependencies distdir
	$(NODE_BIN)/browserify src/source/worker.js  \
		$(BROWSERIFY_OPTIONS) \
		--outfile $@

.INTERMEDIATE: dist/$(PROJECT).debug.js dist/$(PROJECT)-worker.debug.js

.DELETE_ON_ERROR: $(BUILD) $(DIST)

endif

lint: dependencies
	$(NODE_BIN)/eslint --cache --ignore-path .gitignore src test

test: test-unit

test-integration: test-render test-query

test-unit: dependencies
	NODE_PATH=build/node_modules \
	$(NODE_BIN)/tap --reporter dot --no-coverage test/unit

test-render: dependencies
	node test/render.test.js

test-query: dependencies
	node test/query.test.js

distclean: clean
	rm -fr $(DEPENDENCIES) .eslintcache

clean:
	rm -fr dist build/min

clean-test:
	find test/integration/*-tests -mindepth 2 -type d -not -exec test -e "{}/style.json" \; -print
	# | xargs -t rm -r

.PHONY: all clean clean-test check lint build dist distclean dependencies
.PHONY: test test-unit test-render test-query
