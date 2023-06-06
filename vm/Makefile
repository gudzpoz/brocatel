SRC   = $(wildcard src/*.lua) $(wildcard spec/*.lua)
LUA   = lua5.1 luajit lua5.2 lua5.3 lua5.4
TESTS = $(wildcard spec/*.lua)
BUSTED_LUA = $(addprefix busted-, $(LUA))

all: build test

build: $(SRC)

test: busted luacheck

busted: $(BUSTED_LUA)

$(BUSTED_LUA): busted-%: $(SRC) $(TESTS)
	busted -v spec/*.lua --lua `which $*`

luacheck:
	luacheck $(SRC)
