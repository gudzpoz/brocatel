SRC   = $(wildcard src/*.lua) $(wildcard src/mdvm/*.lua) $(wildcard spec/*.lua)
LUA   = lua5.1 luajit lua5.2 lua5.3 lua5.4
TESTS = $(wildcard spec/*.lua)
DOCS  = $(wildcard doc/*)
BUSTED_LUA = $(addprefix busted-, $(LUA))
VERSION = $(shell grep version brocatel.rockspec | tr -cd '[0-9.\-]')

all: build test

build: $(SRC)

brocatel.lua: $(SRC)
	pnpm bundle

bundle: brocatel.lua

test: busted luacheck

busted: $(BUSTED_LUA)

$(BUSTED_LUA): busted-%: $(SRC)
	busted -v spec/*.lua --lua `which $*`

luacheck: $(SRC)
	luacheck $(SRC)

rocks: $(SRC) brocatel.rockspec
	cp brocatel.rockspec brocatel-${VERSION}.rockspec
	luarocks --local make brocatel-${VERSION}.rockspec

doc: $(SRC) $(DOCS)
	mv src/brocatel.lua src/brocatel.lua.bak
	sed -e 's/@module "brocatel"/@module brocatel/' src/brocatel.lua.bak > src/brocatel.lua
	sphinx-build doc/ public/
	mv src/brocatel.lua.bak src/brocatel.lua

.PHONY: doc rocks luacheck busted test bundle build all
