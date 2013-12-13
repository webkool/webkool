#! /bin/bash

COMPILER_PACKAGE='./'
COMPILER_PACKAGE_LIB=${COMPILER_PACKAGE}'lib/'
COMPILER_PACKAGE_BIN=${COMPILER_PACKAGE}'bin/'
COMPILER_PACKAGE_LIB_CLIENT=${COMPILER_PACKAGE_LIB}'client/'

COMPILER_SOURCES=${COMPILER_PACKAGE}'sources/'
COMPILER_SOURCES_CLIENT=${COMPILER_PACKAGE}'sources/client/'
COMPILER_TMP=${COMPILER_PACKAGE}'sources/tmp/'

#bins

CLIENT_LIB[0]='hogan-2.0.0.js'
CLIENT_LIB[1]='square_lib.js'


CLIENT_LIB_SRC[0]='webkool'
CLIENT_LIB_SRC[1]='ApiRequest'

SOURCES[0]='MySQL'
SOURCES[1]='compass'
SOURCES[2]='less'
SOURCES[3]='mustache'
SOURCES[4]='sass'
SOURCES[5]='square'

BIN='wkc'

#.ts compiling

echo "[SERVER LIB] .ts compiling"
for ELM in ${SOURCES[*]}
do
	tsc --target ES5 --outDir ${COMPILER_TMP}  ${COMPILER_SOURCES}${ELM}'.ts'
	tr -d '\r' < ${COMPILER_TMP}${ELM}'.js' > ${COMPILER_PACKAGE_LIB}${ELM}'.js'
    echo "compiling ${COMPILER_SOURCES}${ELM}.ts"
done

mkdir ${COMPILER_PACKAGE_LIB_CLIENT}

echo "[CLIENT LIB] .js moving"

for ELM in ${CLIENT_LIB_SRC[*]}
do
	tsc --target ES5 --outDir ${COMPILER_TMP}  ${COMPILER_SOURCES}${ELM}'.ts'
	tr -d '\r' < ${COMPILER_TMP}${ELM}'.js' > ${COMPILER_PACKAGE_LIB_CLIENT}${ELM}'.js'
	echo "compiling ${COMPILER_SOURCES_CLIENT}${ELM}.ts"

done

for ELM in ${CLIENT_LIB[*]}
do
	cp ${COMPILER_SOURCES_CLIENT}${ELM} ${COMPILER_PACKAGE_LIB_CLIENT}
    echo "moving ${COMPILER_SOURCES_BIN}${ELM}"
done

echo "[BIN] .ts compiling"

tsc --target ES5 --outDir ${COMPILER_TMP}  ${COMPILER_SOURCES}${BIN}'.ts'
echo '#! /usr/bin/env node' > ${COMPILER_PACKAGE_BIN}${BIN}
tr -d '\r' < ${COMPILER_TMP}${BIN}'.js' >> ${COMPILER_PACKAGE_BIN}${BIN}
chmod +x ${COMPILER_PACKAGE_BIN}${BIN}

echo "compiling ${COMPILER_SOURCES}${ELM}.ts"

