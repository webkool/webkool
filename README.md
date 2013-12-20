# Webkool
***
open-source platform to develop client and/or server web application.

## Install

    npm install -g webkool
    
## Usage

    wkc [options] file.wk

  options:
  
-   **-server** compile server based application
-   **-client**  compile client based application
-   **-i**        include directory
-   **-o**        output basename


**0.1.0**:

-   initial commit

**0.1.1**:

-   add './' and '../lib/client' to the default include path

**0.1.2**:

-	update command line parser. now, webkool use 'optimist' module

**0.1.3**:

-	fix output filename for the -o option
-	auto include .webkool.wk file in main file
-	auto create .webkool.wk if it doesn’t exist

**0.1.4**:

<<<<<<< HEAD
-	ajax request (apiRequest)
=======
-	improved one pass compilation
- 	jshint code fix
>>>>>>> 911ab0f977f87c0e17078bcda0ec3bbe970ce718
