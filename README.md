# umi-plugin-circular-check

Umi 4 循环依赖检测插件。

> 实验版

### Usage

Install:

```bash
  pnpm i -D umi-plugin-circular-check
```

Config:

```ts
// .umirc.ts

export default {
  plugins: ['umi-plugin-circular-check']
}
```

Run check command:

```bash
  pnpm umi circular-check
```

Result:

```bash
🚨 Circular dependencies found:
 · src/other.tsx -> src/pages/index.tsx
```

#### Options

 - `--image`: Generate circular dependency graph.
