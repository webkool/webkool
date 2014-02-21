# Webkool
***
open-source platform to develop client and/or server web application.

## Install

    npm install -g webkool
    
## Usage

    wkc [options] file.wk

  options:
  
-   **--server**	compile server based application
-   **--client**	compile client based application
-   **-i**			include directory
-   **-o**			output basename
-	**--hint**		jshint config file


**0.1.0**:

-   initial commit

**0.1.1**:

-   add './' and s'../lib/client' to the default include path

**0.1.2**:

-	update command line parser. now, webkool use 'optimist' module

**0.1.3**:

-	fix output filename for the -o option
-	auto include .webkool.wk file in main file
-	auto create .webkool.wk if it doesn’t exist

**0.1.4**:

-	improved one pass compilation
- 	jshint code fix

**0.1.5**:

-	improved one pass compilation and bug fixing
- 	source map support

**0.1.6**:

-	jshint debug support during compilation process
-	fix problem with line/column in source-map

**0.1.7**:

-	add a config file for jshint (with option --hint )
- 	add a source-map comment at the end of generated files
- 	error handling on request

**0.2.0**:

-	source map support for node server and node-inspector
-	source map support for client
- 	jshint code validation
- 	patch for stylesheet attribute, relative path, -o and --hint options

**0.2.1**:

-	source-map path fix

**0.2.2**:

-	output name fix

**0.3.0**:

-	<include> is now only for .wk
-	config file is now webkool.wk
-	options -i and -o fix
-	debug output fix

**0.3.1**:

-	fix relative path in source-map file

**0.3.2**:

-	fix file saving step

**0.3.3**:

- 	dynamic route

