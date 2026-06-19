# Oxford Vocab Trainer

给家里初中学生使用的本地优先背单词网页工具。阶段一实现 React + Vite + TypeScript + Dexie 的静态网页版本。

## 🔗 Live Demo

[![Open App](https://img.shields.io/badge/▶%20Run%20App-Visit%20Live%20Site-brightgreen?style=for-the-badge)](https://GL13243963.github.io/wordtool-GCC/)

## 功能范围

- 内置六上 / 六下示例词库结构
- 今日任务
- 英文选中文、中文选英文、拼写题
- 会 / 模糊 / 跳过 / 答错反馈
- 简单掌握分和复习间隔算法
- Unit 进度
- 本地 IndexedDB 保存
- JSON 完整备份 / 恢复

> 注意：当前词库是用于跑通流程的可替换种子数据，不是完整校对版教材词库。

## 开发命令

```bash
npm run dev
npm test
npm run build
npm run preview
npm run e2e
```

## 数据说明

学习数据保存在浏览器 IndexedDB 中。设置页可以导出和恢复 JSON 备份。
