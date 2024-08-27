#!/usr/bin/env node

/**
 * A script that overrides some of the create-react-app build script configurations
 * in order to disable code splitting/chunking and rename the output build files so
 * they have no hash. (Reference: https://mtm.dev/disable-code-splitting-create-react-app).
 *
 * This is crucial for getting React webview code to run because VS Code expects a
 * single (consistently named) JavaScript and CSS file when configuring webviews.
 */

const rewire = require("rewire")
const defaults = rewire("react-scripts/scripts/build.js")
let config = defaults.__get__("config")

const path = require("path")
const fs = require("fs")

// Update paths for webview-ui
const appDirectory = path.resolve(__dirname, '..')
console.log('App directory:', appDirectory)
const resolveApp = relativePath => path.resolve(appDirectory, relativePath)

// Override paths completely
const paths = {
  dotenv: resolveApp('.env'),
  appPath: resolveApp('.'),
  appBuild: resolveApp('build'),
  appPublic: resolveApp('public'),
  appHtml: resolveApp('public/index.html'),
  appIndexJs: resolveApp('src/index.tsx'),
  appPackageJson: resolveApp('package.json'),
  appSrc: resolveApp('src'),
  appTsConfig: resolveApp('tsconfig.json'),
  appJsConfig: resolveApp('jsconfig.json'),
  yarnLockFile: resolveApp('yarn.lock'),
  testsSetup: resolveApp('src/setupTests.ts'),
  proxySetup: resolveApp('src/setupProxy.js'),
  appNodeModules: resolveApp('node_modules'),
  swSrc: resolveApp('src/service-worker.ts'),
  publicUrlOrPath: '/',
  // These properties are used by the Webpack plugin 'ModuleScopePlugin'
  // to check if modules are within the src directory.
  appSrcRoot: resolveApp('src'),
}

console.log('Updated paths:')
console.log('appBuild:', paths.appBuild)
console.log('appPublic:', paths.appPublic)
console.log('appHtml:', paths.appHtml)
console.log('appSrc:', paths.appSrc)

// Modify webpack config
config.output.path = paths.appBuild
config.output.publicPath = paths.publicUrlOrPath

/* Modifying Webpack Configuration for 'shared' and 'api' dirs
This section uses Rewire to modify Create React App's webpack configuration without ejecting. Rewire allows us to inject and alter the internal build scripts of CRA at runtime. This allows us to maintain a flexible project structure that keeps shared and api code outside the webview-ui/src directory, while still adhering to CRA's security model that typically restricts imports to within src/. 
1. Uses the ModuleScopePlugin to whitelist files from the shared and api directories, allowing them to be imported despite being outside src/. (see: https://stackoverflow.com/questions/44114436/the-create-react-app-imports-restriction-outside-of-src-directory/58321458#58321458)
2. Modifies the TypeScript rule to include the shared and api directories in compilation. This essentially transpiles and includes the ts files in these dirs in the output main.js file.
Before, we would just import types from shared dir and specifying include (and alias to have cleaner paths) in tsconfig.json was enough. But now that we are creating values (i.e. models in api.ts) to import into the react app, we must also include these files in the webpack resolution.
- Imports from the shared and api directories must use full paths relative to the src directory, without file extensions.
- Example: import { someFunction } from '../../../src/shared/utils/helpers'
*/
const ModuleScopePlugin = require("react-dev-utils/ModuleScopePlugin")

// Get all files in the shared and api directories
const sharedDir = path.resolve(__dirname, "../../src/shared")
const apiDir = path.resolve(__dirname, "../../src/api")
function getAllFiles(dir) {
	let files = []
	fs.readdirSync(dir).forEach((file) => {
		const filePath = path.join(dir, file)
		if (fs.statSync(filePath).isDirectory()) {
			files = files.concat(getAllFiles(filePath))
		} else {
			const withoutExtension = filePath.split(".")[0]
			files.push(withoutExtension)
		}
	})
	return files
}
const sharedFiles = getAllFiles(sharedDir)
const apiFiles = getAllFiles(apiDir)

console.log('Shared directory:', sharedDir)
console.log('API directory:', apiDir)

// Modify ModuleScopePlugin
config.resolve.plugins.forEach((plugin) => {
	if (plugin instanceof ModuleScopePlugin) {
		console.log("Whitelisting shared and api files: ", [...sharedFiles, ...apiFiles])
		sharedFiles.forEach((file) => plugin.allowedFiles.add(file))
		apiFiles.forEach((file) => plugin.allowedFiles.add(file))
	}
})

// Modify TypeScript rule
config.module.rules[1].oneOf.forEach((rule) => {
	if (rule.test && rule.test.toString().includes("ts|tsx")) {
		rule.include = [paths.appSrc, sharedDir, apiDir].filter(Boolean)
		console.log('TypeScript rule include:', rule.include)
	}
})

// Add fallback for 'stream' module
config.resolve.fallback = {
  ...config.resolve.fallback,
  "stream": require.resolve("stream-browserify")
};

// Disable code splitting
config.optimization.splitChunks = {
	cacheGroups: {
		default: false,
	},
}

// Disable code chunks
config.optimization.runtimeChunk = false

// Rename main.{hash}.js to main.js
config.output.filename = "static/js/[name].js"

// Rename main.{hash}.css to main.css
config.plugins[5].options.filename = "static/css/[name].css"
config.plugins[5].options.moduleFilename = () => "static/css/main.css"

// Set the updated config and paths
defaults.__set__("config", config)
defaults.__set__("paths", paths)

console.log('Build script configuration complete.')
