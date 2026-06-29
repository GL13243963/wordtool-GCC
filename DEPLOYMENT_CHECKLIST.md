# 部署检查清单

## 提交前必须执行



## 历史经验教训

### 2025-06-29 版本不同步问题

**问题：** 本地已推送 main 分支，但线上版本没有更新

**根本原因：** TypeScript 编译错误导致 GitHub Actions 部署失败
- 新增了 readAloud 题型配置到 QuestionTypeSettings 类型
- 但测试文件 scheduler.test.ts 中的 mock 数据没有同步更新 readAloud 属性
- 导致 tsc -b 编译失败 -> 整个部署流程中断
- gh-pages 分支不会被更新 -> 线上版本停留在旧版本

**修复：** 在测试用例中补全 readAloud: false 属性

## 推送后检查清单

1. 访问 GitHub Actions 查看部署状态
2. 确认 Deploy workflow 显示绿色
3. 访问线上页面验证功能

## 类型修改注意事项

修改 interface/type 定义后，必须：
1. 全局搜索该类型的所有使用位置
2. 特别注意：测试文件中的 mock 数据也需要同步更新
3. 运行 npm test 和 npm run build 双重验证
