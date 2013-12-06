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

CLIENT_LIB_SRC='webkool'


SOURCES[0]='ApiRequest'
SOURCES[1]='MySQL'
SOURCES[2]='compass'
SOURCES[3]='less'
SOURCES[4]='mustache'
SOURCES[5]='sass'
SOURCES[6]='square'

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

tsc --target ES5 --outDir ${COMPILER_TMP}  ${COMPILER_SOURCES}${CLIENT_LIB_SRC}'.ts'
tr -d '\r' < ${COMPILER_TMP}${CLIENT_LIB_SRC}'.js' > ${COMPILER_PACKAGE_LIB_CLIENT}${CLIENT_LIB_SRC}'.js'
echo "compiling ${COMPILER_SOURCES_CLIENT}${CLIENT_LIB_SRC}.ts"

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

tree ${COMPILER_PACKAGE}

