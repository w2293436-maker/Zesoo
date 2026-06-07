# 择书Zesoo — 设计规范

## 品牌
- **名称**：择书Zesoo
- **定位**：AI 驱动的智能书籍精读助手
- **Slogan**：上传书籍文件，AI 自动提炼重点，生成精读报告

## 配色方案

| 用途 | 色值 | Tailwind |
|------|------|----------|
| 主色（按钮/强调） | #2563EB | blue-600 |
| 主色悬停 | #1D4ED8 | blue-700 |
| 主色浅底 | #DBEAFE | blue-100 |
| 背景色 | #F8FAFC | gray-50 |
| 卡片白 | #FFFFFF | white |
| 正文色 | #334155 | gray-700 |
| 标题色 | #0F172A | gray-900 |
| 辅助文字 | #94A3B8 | gray-400 |
| 边框色 | #E2E8F0 | gray-200 |
| 成功绿 | #10B981 | green-500 |
| 警示金 | #F59E0B | amber-500 |
| 星光金 | #FBBF24 | yellow-400 |

## 字体
- **系统默认**：-apple-system, BlinkMacSystemFont, Segoe UI, PingFang SC, Microsoft YaHei
- **标题**：font-extrabold / font-bold
- **正文**：font-normal, 11pt-16px

## 组件规范

### Logo
- 打开的书本图标 + 右上金色星光
- 蓝色渐变（左页 #3B82F6→#2563EB，右页 #60A5FA→#3B82F6）
- 尺寸：w-16 h-16 (桌面) / w-14 h-14 (手机)

### 按钮
- 主按钮：bg-blue-500 text-white rounded-xl
- 禁用态：bg-gray-100 text-gray-400
- 悬停：hover:bg-blue-600 active:scale-[0.98]

### 卡片
- bg-white rounded-2xl border border-gray-100 shadow-sm

### 上传区
- 虚线边框 border-2 border-dashed rounded-2xl
- 拖入态：border-blue-400 bg-blue-50

## 页面结构

### 上传页
```
[择书Zesoo 标题]
[书本图标（偏右）]
[副标题]
[上传卡片 + 开始按钮]
```

### 报告页
```
[顶栏：返回 + 书名 + 导出Word]
[侧边栏：章节列表] | [正文：五大板块]
```
