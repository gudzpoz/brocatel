# Configuration file for the Sphinx documentation builder.
#
# For the full list of built-in configuration values, see the documentation:
# https://www.sphinx-doc.org/en/master/usage/configuration.html

# -- Project information -----------------------------------------------------
# https://www.sphinx-doc.org/en/master/usage/configuration.html#project-information

project = 'brocatel'
copyright = '2024, gudzpoz'
author = 'gudzpoz'

# -- General configuration ---------------------------------------------------
# https://www.sphinx-doc.org/en/master/usage/configuration.html#general-configuration

extensions = [
    'sphinx.ext.autodoc',
    'sphinxcontrib.luadomain',
    'sphinx_lua'
]

lua_source_path = ["./src/"]
lua_source_encoding = 'utf8'
lua_source_comment_prefix = '---'
lua_source_use_emmy_lua_syntax = True
lua_source_private_prefix = '_'

templates_path = ['./doc/templates/']
exclude_patterns = ['public', 'Thumbs.db', '.DS_Store']

# -- Options for HTML output -------------------------------------------------
# https://www.sphinx-doc.org/en/master/usage/configuration.html#options-for-html-output

html_theme = 'alabaster'
html_static_path = ['./doc/static/']
