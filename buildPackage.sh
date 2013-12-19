#!/bin/bash
########################################################
#        			Package Builder 				   #
#													   #
########################################################

COMPILER_TMP='./sources/tmp/'

#compiler name
BIN_INP_DIR='./sources/'
BIN_OUT_DIR='./bin/'

BIN='wkc'

#-----------------------------------------------------------------------------------------
		echo '[0] compiling wkc.ts'
		tsc --target ES5 --outDir ${COMPILER_TMP} 	${BIN_INP_DIR}${BIN}'.ts'
		echo '#! /usr/bin/env node' 				> ${BIN_OUT_DIR}${BIN}
		tr -d '\r' < ${COMPILER_TMP}${BIN}'.js' 	>> ${BIN_OUT_DIR}${BIN}
		chmod +x 									${BIN_OUT_DIR}${BIN}
#-----------------------------------------------------------------------------------------
#sources/client/*.ts 				===> lib/client/*.js
SOURCES_CLIENT_TS_INP_DIR='./sources/client/'
SOURCES_CLIENT_TS_OUT_DIR='./lib/client/'

SOURCES_CLIENT_TS[0]='MySQL'
SOURCES_CLIENT_TS[1]='ApiRequest'
SOURCES_CLIENT_TS[2]='webkool'

#-----------------------------------------------------------------------------------------
		echo '[1] sources/client/*.ts 			===> lib/client/*.js'
		for ELM in ${SOURCES_CLIENT_TS[*]}
		do
			tsc --target ES5 --outDir ${COMPILER_TMP} ${SOURCES_CLIENT_TS_INP_DIR}${ELM}'.ts'
			tr -d '\r' < ${COMPILER_TMP}${ELM}'.js' > ${SOURCES_CLIENT_TS_OUT_DIR}${ELM}'.js'
			echo -e '\tcompiling '${SOURCES_CLIENT_TS_INP_DIR}${ELM}'.ts'
		done
#-----------------------------------------------------------------------------------------
#sources/*.ts 						===> lib/*.js

SOURCES_TS_INP_DIR='./sources/'
SOURCES_TS_OUT_DIR='./lib/'

SOURCES_TS[0]='compass'
SOURCES_TS[1]='less'
SOURCES_TS[2]='mustache'
SOURCES_TS[3]='square'
SOURCES_TS[4]='sass'

#-----------------------------------------------------------------------------------------
		echo '[2] sources/*.ts 				===> lib/*.js'
		for ELM in ${SOURCES_TS[*]}
		do
			tsc --target ES5 --outDir ${COMPILER_TMP} ${SOURCES_TS_INP_DIR}${ELM}'.ts'
			tr -d '\r' < ${COMPILER_TMP}${ELM}'.js' > ${SOURCES_TS_OUT_DIR}${ELM}'.js'
			echo -e '\tcompiling '${SOURCES_TS_INP_DIR}${ELM}'.ts'
		done
#-----------------------------------------------------------------------------------------

#sources/client/*.js 				===> lib/client/*.js
SOURCES_CLIENT_JS_INP_DIR='./sources/client/'
SOURCES_CLIENT_JS_OUT_DIR='./lib/client/'

SOURCES_CLIENT_JS[1]='hogan-2.0.0'
SOURCES_CLIENT_JS[2]='square_lib'

#-----------------------------------------------------------------------------------------
		echo '[3] sources/client/*.js 			===> lib/client/*.js'
		for ELM in ${SOURCES_CLIENT_JS[*]}
		do
			cp ${SOURCES_CLIENT_JS_INP_DIR}${ELM}'.js' ${SOURCES_CLIENT_JS_OUT_DIR}${ELM}'.js'
			echo -e '\tmoving '${SOURCES_CLIENT_JS_INP_DIR}${ELM}'.js'
		done
#-----------------------------------------------------------------------------------------

