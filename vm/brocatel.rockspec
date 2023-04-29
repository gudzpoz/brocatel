package = "brocatel"
version = "0.2.0"
source = {
   url = "git://github.com/gudzpoz/brocatel",
}
description = {
   summary = "A VM that runs compiled brocatel scripts.",
   detailed = [[
   ]],
   homepage = "https://github.com/gudzpoz/brocatel",
   license = "MIT",
}
dependencies = {
   "lua >= 5.1, < .5",
}
build = {
   type = "builtin",
   modules = {},
   copy_directories = {
      "docs"
   },
}
