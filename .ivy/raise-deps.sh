#!/bin/bash
set -e

shopt -s globstar
# likely not working on mac
sed -i -E "s|core_product-engine/job/master/|core_product-engine/job/release%2F${1/.[0-9]-SNAPSHOT/}/|" build/**/Jenkinsfile
sed -i -E "s/(\"@axonivy[^\"]*\"): \"[^\"]*\"/\1: \"~${1/SNAPSHOT/next}\"/" extension/webviews/*/package.json
yarn update:axonivy:next
yarn install --ignore-scripts
