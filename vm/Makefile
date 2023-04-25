SRC   = $(wildcard *.lua)
LUA   = lua5.1 luajit lua5.2 lua5.3 lua5.4
TESTS = test.lua

all: build test

build: $(SRC)

test: $(LUA) luacheck

$(LUA): lua%:
	$@ $(TESTS)

luacheck:
	luacheck $(SRC)
