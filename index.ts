import { IApi } from 'umi'
import { aliasUtils, tryPaths, chalk, logger } from 'umi/plugin-utils'
import { join, relative } from 'path'
import { loadConfig } from 'tsconfig-paths'
import madge from 'madge'

interface ITsconfig {
  baseUrl: string
  paths: Record<string, string[]>
}

const NAME = `circular-check`

export default (api: IApi) => {
  api.registerCommand({
    name: NAME,
    fn: async () => {
      const cwd = api.cwd
      const tsconfig = (await loadConfig(cwd)) as ITsconfig
      const exclude: RegExp[] = [/node_modules/, /\.d\.ts$/, /\.umi/]
      const isExclude = (path: string) => {
        return exclude.some((reg) => reg.test(path))
      }

      const userAlias = api.config.alias
      const parsedAlias = aliasUtils.parseCircleAlias({
        alias: userAlias,
      })
      const filteredAlias = Object.keys(parsedAlias).reduce<ITsconfig['paths']>(
        (acc, key) => {
          const value = parsedAlias[key]
          if (isExclude(value)) {
            return acc
          }
          if (tsconfig.paths?.[key]) {
            return acc
          }
          const tsconfigValue = [join(relative(cwd, value), '/*')]
          const tsconfigKey = `${key}/*`
          if (tsconfig.paths?.[tsconfigKey]) {
            return acc
          }
          acc[tsconfigKey] = tsconfigValue
          return acc
        },
        {}
      )

      logger.debug('filteredAlias: ', filteredAlias)

      // containing `src` folders are supported only
      if (!api.appData.hasSrcDir) {
        throw new Error(`Only supports projects containing "src" folders.`)
      }
      const devTmpDir = join(api.paths.absSrcPath, '.umi')
      const prodTmpDir = join(api.paths.absOutputPath, '.umi-production')
      const tmpPath = tryPaths([devTmpDir, prodTmpDir])
      if (!tmpPath) {
        throw new Error(
          `Umi tmp files not found. Please run \`umi setup\` first.`
        )
      }
      const entryFile = join(tmpPath, 'umi.ts')
      const exportsFile = join(tmpPath, 'exports.ts')
      const res = await madge(entryFile, {
        tsConfig: {
          compilerOptions: {
            baseUrl: tsconfig.baseUrl,
            paths: {
              ...filteredAlias,
              ...tsconfig.paths,
              umi: [exportsFile],
              '@umijs/max': [exportsFile],
            },
            target: 'esnext',
            module: 'esnext',
            moduleResolution: 'node',
            importHelpers: true,
            jsx: 'react-jsx',
            esModuleInterop: true,
            strict: true,
            resolveJsonModule: true,
            allowSyntheticDefaultImports: true,
          },
        },
        fileExtensions: ['ts', 'tsx', 'js', 'jsx'],
        excludeRegExp: exclude,
        baseDir: cwd,
      })
      const needWriteImage = api.args?.image
      if (needWriteImage) {
        try {
          const svgFile = await res.image(join(api.cwd, 'circular.svg'))
          console.log(
            `👀 Circular dependency graph is generated at ${chalk.cyan(
              relative(cwd, svgFile)
            )}`
          )
        } catch (e) {
          console.log(
            `Generate circular dependency graph failed, please check if you have installed ${chalk.bold.blue(
              'Graphviz'
            )}.`
          )
          console.log(
            `See ${chalk.yellow(
              'https://github.com/pahen/madge#graphviz-optional'
            )}`
          )
          throw new Error('Generate circular dependency graph failed.', {
            cause: e,
          })
        }
      }
      const circularDeps = await res.circular()
      if (!circularDeps.length) {
        console.log(`🎉 ${chalk.green('No circular dependencies found.')}`)
        return
      }
      console.log(`🚨 ${chalk.red('Circular dependencies found:')}`)
      circularDeps.forEach((circularDep) => {
        console.log(` · ${chalk.yellow(circularDep.join(chalk.gray(' -> ')))}`)
      })
    },
  })
}
