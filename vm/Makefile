SRC   = $(wildcard src/*.lua) $(wildcard spec/*.lua)
LUA   = lua5.1 luajit lua5.2 lua5.3 lua5.4
TESTS = $(wildcard spec/*.lua)

all: build test

build: $(SRC)

test: busted luacheck

busted: $(SRC)
	busted -v spec/*.lua

$(LUA): lua%:
	$@ $(TESTS)

luacheck:
	luacheck $(SRC)
